import { NextRequest } from "next/server"

import { withApiAnalytics } from "@/lib/analytics/route"
import {
  createAuthJsonResponse,
  validateAuthMutationRequest,
} from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import { OpenAiClientError, createGeneralChatCompletion } from "@/lib/llm/general-llm"
import { reserveUserActionDailyRequest } from "@/lib/llm/quota"
import { buildLabCardAutofillPrompts } from "@/lib/lab/prompt"
import type { LabLocale } from "@/lib/lab/types"

export const runtime = "nodejs"

const LAB_CARD_AUTOFILL_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    disabled: "실험실 기능이 비활성화되어 있습니다. 대시보드 설정에서 먼저 활성화해 주세요.",
    invalidRequest: "자동 채우기 요청 형식이 올바르지 않습니다.",
    invalidTerm: "자동 채우기할 단어를 입력해 주세요.",
    dailyLimit: "오늘 자동 채우기 한도를 모두 사용했습니다. 내일 다시 시도해 주세요.",
    globalLlmLimit: "오늘 AI 요청 한도에 도달했습니다. 내일 다시 시도해 주세요.",
    providerFailure: "자동 채우기 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    parseFailure: "생성 결과를 해석하지 못했습니다. 단어를 조금 더 구체적으로 입력해 주세요.",
    failed: "자동 채우기 처리 중 오류가 발생했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    disabled: "Lab is disabled. Enable it first from dashboard settings.",
    invalidRequest: "Invalid autofill request.",
    invalidTerm: "Please enter a term to autofill.",
    dailyLimit: "You have reached today's autofill limit. Please try again tomorrow.",
    globalLlmLimit: "The site has reached today's AI request limit. Please try again tomorrow.",
    providerFailure: "Failed to autofill this term. Please try again shortly.",
    parseFailure: "Could not parse generated card details. Please try with a more specific term.",
    failed: "An error occurred while autofilling the card.",
  },
  zh: {
    unauthorized: "请先登录。",
    disabled: "实验室功能未开启。请先在仪表盘设置中启用。",
    invalidRequest: "自动填写请求格式无效。",
    invalidTerm: "请输入要自动填写的单词。",
    dailyLimit: "今日自动填写次数已用完，请明天再试。",
    globalLlmLimit: "今日 AI 请求额度已达上限，请明天再试。",
    providerFailure: "自动填写失败，请稍后再试。",
    parseFailure: "无法解析生成结果，请尝试输入更具体的单词。",
    failed: "自动填写处理过程中发生错误。",
  },
  ja: {
    unauthorized: "ログインが必要です。",
    disabled: "ラボ機能が無効です。ダッシュボード設定から先に有効にしてください。",
    invalidRequest: "自動入力リクエストの形式が正しくありません。",
    invalidTerm: "自動入力する単語を入力してください。",
    dailyLimit: "本日の自動入力上限に達しました。明日再試行してください。",
    globalLlmLimit: "本日の AI リクエスト上限に達しました。明日再試行してください。",
    providerFailure: "自動入力に失敗しました。しばらくしてからお試しください。",
    parseFailure: "生成結果を解析できませんでした。より具体的な単語を入力してください。",
    failed: "自動入力処理中にエラーが発生しました。",
  },
} as const

const LAB_CARD_AUTOFILL_DAILY_LIMIT = (() => {
  const raw = Number(process.env.LAB_CARD_AUTOFILL_DAILY_LIMIT ?? "100")
  if (!Number.isFinite(raw)) {
    return 100
  }
  return Math.max(1, Math.floor(raw))
})()

type AutofillExampleLanguage = "ko" | "en" | "ja"

function getLocale(request: NextRequest): LabLocale {
  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
  if (header.startsWith("zh")) return "zh"
  if (header.startsWith("ja")) return "ja"
  return header.startsWith("en") ? "en" : "ko"
}

function detectTermLanguage(term: string, locale: LabLocale): AutofillExampleLanguage {
  const normalized = term.trim()
  if (!normalized) {
    return locale === "en" ? "en" : "ko"
  }

  const hasHangul = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/u.test(normalized)
  if (hasHangul) {
    return "ko"
  }

  const hasKana = /[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\uFF65-\uFF9F]/u.test(normalized)
  if (hasKana) {
    return "ja"
  }

  const hasLatin = /[A-Za-z]/.test(normalized)
  if (hasLatin) {
    return "en"
  }

  const hasCjkIdeographs = /[\u4E00-\u9FFF]/u.test(normalized)
  if (hasCjkIdeographs) {
    return "ja"
  }

  return locale === "en" ? "en" : "ko"
}

function normalizeTerm(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function extractCodeBlockJson(value: string) {
  const match = value.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return match?.[1]?.trim() ?? null
}

function extractBracketedJson(value: string, open: "{" | "[", close: "}" | "]") {
  const start = value.indexOf(open)
  const end = value.lastIndexOf(close)
  if (start < 0 || end < 0 || end <= start) {
    return null
  }
  return value.slice(start, end + 1)
}

function parseAutofillContent(content: string) {
  const candidates = [
    content,
    extractCodeBlockJson(content),
    extractBracketedJson(content, "{", "}"),
    extractBracketedJson(content, "[", "]"),
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim().length > 0))

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate)
    if (!parsed) {
      continue
    }

    const base = Array.isArray(parsed)
      ? parsed[0]
      : parsed && typeof parsed === "object" && "card" in (parsed as Record<string, unknown>)
        ? (parsed as Record<string, unknown>).card
        : parsed

    if (!base || typeof base !== "object") {
      continue
    }

    const source = base as Record<string, unknown>
    const meaning = sanitizeText(source.meaning, 220)
    const partOfSpeech = sanitizeText(source.partOfSpeech, 40)
    const example = sanitizeText(source.example, 280)
    const exampleTranslation = sanitizeText(source.explanation || source.exampleTranslation, 280)

    if (!meaning) {
      continue
    }

    return {
      meaning,
      partOfSpeech: partOfSpeech || null,
      example: example || null,
      exampleTranslation: exampleTranslation || null,
    }
  }

  return null
}

async function handlePOST(request: NextRequest) {
  const locale = getLocale(request)
  const authLocale: "ko" | "en" = locale === "zh" || locale === "ja" ? "en" : locale

  try {
    const requestViolation = validateAuthMutationRequest(request, authLocale)
    if (requestViolation) {
      return requestViolation
    }

    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_AUTOFILL_ERRORS[locale].unauthorized },
          { status: 401 }
        )
      )
    }

    if (!authenticatedSession.user.labEnabled) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_AUTOFILL_ERRORS[locale].disabled },
          { status: 403 }
        ),
        authenticatedSession
      )
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_AUTOFILL_ERRORS[locale].invalidRequest },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const term = normalizeTerm(
      typeof payload === "object" && payload && "term" in payload
        ? (payload as { term?: unknown }).term
        : ""
    )
    if (!term) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_AUTOFILL_ERRORS[locale].invalidTerm },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const autofillReservation = await reserveUserActionDailyRequest({
      userId: authenticatedSession.user.id,
      quotaKey: "lab_card_autofill",
      limit: LAB_CARD_AUTOFILL_DAILY_LIMIT,
    })
    if (!autofillReservation.allowed) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          {
            error: LAB_CARD_AUTOFILL_ERRORS[locale].dailyLimit,
            usage: autofillReservation.usage,
          },
          { status: 429 }
        ),
        authenticatedSession
      )
    }

    try {
      const exampleLanguage = detectTermLanguage(term, locale)
      const prompts = buildLabCardAutofillPrompts({
        locale,
        user: authenticatedSession.user,
        term,
        exampleLanguage,
      })

      const completion = await createGeneralChatCompletion({
        requestKind: "chat",
        messages: [
          { role: "system", content: prompts.systemPrompt },
          { role: "user", content: prompts.userPrompt },
        ],
      })

      const parsed = parseAutofillContent(completion.content)
      if (!parsed) {
        return attachRefreshedAuthCookie(
          createAuthJsonResponse(
            { error: LAB_CARD_AUTOFILL_ERRORS[locale].parseFailure },
            { status: 502 }
          ),
          authenticatedSession
        )
      }

      return attachRefreshedAuthCookie(
        createAuthJsonResponse({
          card: {
            term,
            meaning: parsed.meaning,
            partOfSpeech: parsed.partOfSpeech,
            example: parsed.example,
            exampleTranslation: parsed.exampleTranslation,
          },
          requestedModel: completion.requestedModel,
          resolvedModel: completion.resolvedModel,
        }),
        authenticatedSession
      )
    } catch (error) {
      if (error instanceof OpenAiClientError) {
        if (error.statusCode === 429 && error.code === "global_daily_limit_reached") {
          return attachRefreshedAuthCookie(
            createAuthJsonResponse(
              { error: LAB_CARD_AUTOFILL_ERRORS[locale].globalLlmLimit },
              { status: 429 }
            ),
            authenticatedSession
          )
        }

        return attachRefreshedAuthCookie(
          createAuthJsonResponse(
            { error: LAB_CARD_AUTOFILL_ERRORS[locale].providerFailure },
            { status: 502 }
          ),
          authenticatedSession
        )
      }
      throw error
    }
  } catch (error) {
    console.error("Lab card autofill API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_CARD_AUTOFILL_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

export const POST = withApiAnalytics(handlePOST)
