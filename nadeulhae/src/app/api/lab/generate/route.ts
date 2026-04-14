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
import { FactChatError, createFactChatCompletion } from "@/lib/chat/factchat"
import {
  LAB_DEFAULT_CARD_COUNT,
  LAB_INPUT_MAX_CHARACTERS,
  LAB_MAX_CARD_COUNT,
  LAB_MIN_CARD_COUNT,
} from "@/lib/lab/constants"
import { buildLabGenerationPrompts } from "@/lib/lab/prompt"
import {
  createLabDeckWithCards,
  getLabState,
  refundDailyLabGeneration,
  reserveDailyLabGeneration,
} from "@/lib/lab/repository"
import type { LabGeneratedCardInput, LabLocale } from "@/lib/lab/types"

export const runtime = "nodejs"

const LAB_GENERATE_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    disabled: "실험실 기능이 비활성화되어 있습니다. 대시보드 설정에서 먼저 활성화해 주세요.",
    invalidRequest: "실험실 카드 생성 요청 형식이 올바르지 않습니다.",
    invalidTopic: "주제는 2자 이상 입력해 주세요.",
    tooLongTopic: `주제는 ${LAB_INPUT_MAX_CHARACTERS}자 이하여야 합니다.`,
    providerFailure: "카드 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    parseFailure: "생성 결과를 해석하지 못했습니다. 표현을 바꿔 다시 시도해 주세요.",
    dailyLimit: "오늘 실험실 카드 생성 한도를 모두 사용했습니다.",
    internal: "실험실 카드 생성 중 오류가 발생했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    disabled: "Lab is disabled. Enable it first from dashboard settings.",
    invalidRequest: "Invalid lab card generation request.",
    invalidTopic: "Please enter a topic with at least 2 characters.",
    tooLongTopic: `Topic must be ${LAB_INPUT_MAX_CHARACTERS} characters or fewer.`,
    providerFailure: "Failed to generate cards. Please try again shortly.",
    parseFailure: "Could not parse generated cards. Please try with a different prompt.",
    dailyLimit: "You have reached today's lab generation limit.",
    internal: "An error occurred while generating lab cards.",
  },
} as const

function getLocale(request: NextRequest): LabLocale {
  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
  return header.startsWith("en") ? "en" : "ko"
}

function normalizeTopic(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeCardCount(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return LAB_DEFAULT_CARD_COUNT
  }

  return Math.min(LAB_MAX_CARD_COUNT, Math.max(LAB_MIN_CARD_COUNT, Math.floor(parsed)))
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

function sanitizeCardDraft(input: unknown): LabGeneratedCardInput | null {
  if (!input || typeof input !== "object") {
    return null
  }

  const source = input as Record<string, unknown>
  const term = typeof source.term === "string" ? source.term.trim() : ""
  const meaning = typeof source.meaning === "string" ? source.meaning.trim() : ""
  const example = typeof source.example === "string" ? source.example.trim() : ""
  const tip = typeof source.tip === "string" ? source.tip.trim() : ""

  if (!term || !meaning) {
    return null
  }

  return {
    term: term.slice(0, 80),
    meaning: meaning.slice(0, 220),
    example: example ? example.slice(0, 280) : null,
    tip: tip ? tip.slice(0, 200) : null,
  }
}

function normalizeDeckPayload(payload: unknown, maxCards: number) {
  const base = payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : null

  const title = typeof base?.title === "string"
    ? base.title.trim().slice(0, 120)
    : ""

  const cardsSource = Array.isArray(base?.cards)
    ? base?.cards
    : Array.isArray(payload)
      ? payload
      : []

  const cards: LabGeneratedCardInput[] = []
  const seen = new Set<string>()

  for (const item of cardsSource) {
    const draft = sanitizeCardDraft(item)
    if (!draft) {
      continue
    }

    const dedupeKey = draft.term.toLowerCase().replace(/\s+/g, "")
    if (seen.has(dedupeKey)) {
      continue
    }

    seen.add(dedupeKey)
    cards.push(draft)
    if (cards.length >= maxCards) {
      break
    }
  }

  return {
    title,
    cards,
  }
}

function parseDeckFromCompletion(content: string, maxCards: number) {
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

    const normalized = normalizeDeckPayload(parsed, maxCards)
    if (normalized.cards.length > 0) {
      return normalized
    }
  }

  return {
    title: "",
    cards: [] as LabGeneratedCardInput[],
  }
}

async function handlePOST(request: NextRequest) {
  const locale = getLocale(request)

  try {
    const requestViolation = validateAuthMutationRequest(request, locale)
    if (requestViolation) {
      return requestViolation
    }

    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: LAB_GENERATE_ERRORS[locale].unauthorized },
          { status: 401 }
        )
      )
    }

    if (!authenticatedSession.user.labEnabled) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_GENERATE_ERRORS[locale].disabled },
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
          { error: LAB_GENERATE_ERRORS[locale].invalidRequest },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const topic = normalizeTopic(
      typeof payload === "object" && payload && "topic" in payload
        ? (payload as { topic?: unknown }).topic
        : ""
    )

    if (topic.length < 2) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_GENERATE_ERRORS[locale].invalidTopic },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    if (topic.length > LAB_INPUT_MAX_CHARACTERS) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_GENERATE_ERRORS[locale].tooLongTopic },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const cardCount = normalizeCardCount(
      typeof payload === "object" && payload && "cardCount" in payload
        ? (payload as { cardCount?: unknown }).cardCount
        : LAB_DEFAULT_CARD_COUNT
    )

    const reservation = await reserveDailyLabGeneration(authenticatedSession.user.id)
    if (!reservation.allowed) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          {
            error: LAB_GENERATE_ERRORS[locale].dailyLimit,
            usage: reservation.usage,
          },
          { status: 429 }
        ),
        authenticatedSession
      )
    }

    let shouldRefund = true
    try {
      const collectedCards: LabGeneratedCardInput[] = []
      let attempts = 0
      const maxAttempts = 6
      let deckTitle = topic
      let lastRequestedModel: string | null = null
      let lastResolvedModel: string | null = null

      while (collectedCards.length < cardCount && attempts < maxAttempts) {
        attempts++
        const remainingCount = cardCount - collectedCards.length
        const batchSize = Math.min(15, remainingCount)
        
        const prompts = buildLabGenerationPrompts({
          locale,
          user: authenticatedSession.user,
          topic,
          cardCount: batchSize,
        })

        const existingTerms = collectedCards.map((c) => c.term).join(", ")
        const repetitionConstraint = existingTerms ? `\n\nDO NOT GENERATE ANY OF THESE TERMS AGAIN: ${existingTerms}` : ""

        const completion = await createFactChatCompletion({
          requestKind: "chat",
          messages: [
            { role: "system", content: prompts.systemPrompt },
            { role: "user", content: prompts.userPrompt + repetitionConstraint },
          ],
        })

        if (!lastRequestedModel) lastRequestedModel = completion.requestedModel
        if (!lastResolvedModel) lastResolvedModel = completion.resolvedModel

        const parsedDeck = parseDeckFromCompletion(completion.content, batchSize)
        if (parsedDeck.title && parsedDeck.title.length > 2) {
          deckTitle = parsedDeck.title
        }

        const newCards = parsedDeck.cards.filter((c) => 
          !collectedCards.some((ec) => ec.term.toLowerCase() === c.term.toLowerCase())
        )

        if (newCards.length === 0) {
          break // Model is failing to generate new cards
        }

        collectedCards.push(...newCards)
      }

      if (collectedCards.length < LAB_MIN_CARD_COUNT) {
        await refundDailyLabGeneration(authenticatedSession.user.id)
        shouldRefund = false

        return attachRefreshedAuthCookie(
          createAuthJsonResponse(
            { error: LAB_GENERATE_ERRORS[locale].parseFailure },
            { status: 502 }
          ),
          authenticatedSession
        )
      }

      const savedDeck = await createLabDeckWithCards({
        userId: authenticatedSession.user.id,
        locale,
        title: deckTitle,
        topic,
        cards: collectedCards,
        requestedModel: lastRequestedModel,
        resolvedModel: lastResolvedModel,
      })

      shouldRefund = false
      const state = await getLabState(authenticatedSession.user.id)

      return attachRefreshedAuthCookie(
        createAuthJsonResponse({
          deck: savedDeck.deck,
          cards: savedDeck.cards,
          usage: state.usage,
          state,
        }),
        authenticatedSession
      )
    } catch (error) {
      if (shouldRefund) {
        try {
          await refundDailyLabGeneration(authenticatedSession.user.id)
        } catch (refundError) {
          console.error("Failed to refund lab generation quota:", refundError)
        }
      }

      if (error instanceof FactChatError) {
        return attachRefreshedAuthCookie(
          createAuthJsonResponse(
            { error: LAB_GENERATE_ERRORS[locale].providerFailure },
            { status: 502 }
          ),
          authenticatedSession
        )
      }

      throw error
    }
  } catch (error) {
    console.error("Lab generate API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_GENERATE_ERRORS[locale].internal },
      { status: 500 }
    )
  }
}

export const POST = withApiAnalytics(handlePOST)
