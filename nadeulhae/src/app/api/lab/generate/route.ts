import { NextRequest } from "next/server"
import { randomUUID } from "node:crypto"

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
import { NanoGptChatError, createNanoGptChatCompletion } from "@/lib/chat/nanogpt"
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
import { broadcastToUser } from "@/lib/websocket/broadcast"

export const runtime = "nodejs"

const LAB_GENERATE_BATCH_MAX = 10
const LAB_GENERATE_MAX_PARALLEL = 3
const LAB_GENERATE_MAX_ROUNDS = 8
const LAB_GENERATE_MAX_STAGNATION = 2
const LAB_GENERATE_EXCLUDE_TERMS_LIMIT = 140
const LAB_GENERATE_REQUEST_ID_MAX = 72

type LabGenerateProgressStatus =
  | "started"
  | "round_started"
  | "round_finished"
  | "saving"
  | "completed"
  | "failed"

type LabGenerateProgressReason =
  | "daily_limit"
  | "global_limit"
  | "provider_failure"
  | "parse_failure"
  | "internal_error"

type LabGenerateProgressPayload = {
  requestId: string
  status: LabGenerateProgressStatus
  targetCount: number
  collectedCount: number
  at: string
  round?: number
  totalRounds?: number
  addedThisRound?: number
  providerFailureCount?: number
  reason?: LabGenerateProgressReason
}

const LAB_GENERATE_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    disabled: "실험실 기능이 비활성화되어 있습니다. 대시보드 설정에서 먼저 활성화해 주세요.",
    invalidRequest: "실험실 카드 생성 요청 형식이 올바르지 않습니다.",
    invalidTopic: "주제는 2자 이상 입력해 주세요.",
    tooLongTopic: `주제는 ${LAB_INPUT_MAX_CHARACTERS}자 이하여야 합니다.`,
    providerFailure: "카드 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    globalLlmLimit: "오늘 AI 요청 한도에 도달했습니다. 내일 다시 시도해 주세요.",
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
    globalLlmLimit: "The site has reached today's AI request limit. Please try again tomorrow.",
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

function normalizeClientRequestId(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > LAB_GENERATE_REQUEST_ID_MAX) {
    return null
  }

  if (!/^[a-zA-Z0-9:_-]+$/.test(trimmed)) {
    return null
  }

  return trimmed
}

function emitLabGenerateProgress(userId: string, payload: LabGenerateProgressPayload) {
  try {
    broadcastToUser(userId, "lab_generate_progress", payload)
  } catch (error) {
    // WebSocket progress should never break the primary API response path.
    console.error("Failed to emit lab generation progress:", error)
  }
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
  const partOfSpeech = typeof source.partOfSpeech === "string" ? source.partOfSpeech.trim() : ""
  const example = typeof source.example === "string" ? source.example.trim() : ""
  const explanation = typeof source.explanation === "string" ? source.explanation.trim() : ""
  const exampleTranslation = typeof source.exampleTranslation === "string" ? source.exampleTranslation.trim() : explanation

  if (!term || !meaning) {
    return null
  }

  return {
    term: term.slice(0, 80),
    meaning: meaning.slice(0, 220),
    partOfSpeech: partOfSpeech ? partOfSpeech.slice(0, 40) : null,
    example: example ? example.slice(0, 280) : null,
    exampleTranslation: exampleTranslation ? exampleTranslation.slice(0, 280) : null,
  }
}

function toTermDedupKey(term: string, meaning: string) {
  return `${term.toLowerCase().replace(/\s+/g, "")}|${meaning.toLowerCase().replace(/\s+/g, "")}`
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

    const dedupeKey = toTermDedupKey(draft.term, draft.meaning)
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
    const requestId = normalizeClientRequestId(
      typeof payload === "object" && payload && "requestId" in payload
        ? (payload as { requestId?: unknown }).requestId
        : null
    ) ?? randomUUID()

    const reservation = await reserveDailyLabGeneration(authenticatedSession.user.id)
    if (!reservation.allowed) {
      emitLabGenerateProgress(authenticatedSession.user.id, {
        requestId,
        status: "failed",
        reason: "daily_limit",
        targetCount: cardCount,
        collectedCount: 0,
        at: new Date().toISOString(),
      })

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
      const seenTerms = new Set<string>()
      let rounds = 0
      let stagnationRounds = 0
      let providerFailureCount = 0
      let globalLlmLimitHit = false
      let deckTitle = topic
      let lastRequestedModel: string | null = null
      let lastResolvedModel: string | null = null

      emitLabGenerateProgress(authenticatedSession.user.id, {
        requestId,
        status: "started",
        targetCount: cardCount,
        collectedCount: 0,
        totalRounds: LAB_GENERATE_MAX_ROUNDS,
        at: new Date().toISOString(),
      })

      while (
        collectedCards.length < cardCount
        && rounds < LAB_GENERATE_MAX_ROUNDS
        && stagnationRounds < LAB_GENERATE_MAX_STAGNATION
      ) {
        rounds++
        emitLabGenerateProgress(authenticatedSession.user.id, {
          requestId,
          status: "round_started",
          targetCount: cardCount,
          collectedCount: collectedCards.length,
          round: rounds,
          totalRounds: LAB_GENERATE_MAX_ROUNDS,
          at: new Date().toISOString(),
        })

        const remainingCount = cardCount - collectedCards.length
        const parallelCount = remainingCount <= LAB_MIN_CARD_COUNT
          ? 1
          : Math.min(
            LAB_GENERATE_MAX_PARALLEL,
            Math.max(1, Math.ceil(remainingCount / LAB_GENERATE_BATCH_MAX))
          )
        const batchSize = Math.min(
          LAB_GENERATE_BATCH_MAX,
          Math.max(LAB_MIN_CARD_COUNT, Math.ceil(remainingCount / parallelCount))
        )

        const blockedTerms = Array.from(seenTerms).slice(0, LAB_GENERATE_EXCLUDE_TERMS_LIMIT)
        const repetitionConstraint = blockedTerms.length > 0
          ? locale === "ko"
            ? `\n\n절대 아래 단어(term)를 다시 만들지 마세요:\n${blockedTerms.join(", ")}`
            : `\n\nNever generate any of these terms again:\n${blockedTerms.join(", ")}`
          : ""

        const generationJobs = Array.from({ length: parallelCount }, (_, index) => {
          const prompts = buildLabGenerationPrompts({
            locale,
            user: authenticatedSession.user,
            topic,
            cardCount: batchSize,
          })

          const branchHint = locale === "ko"
            ? `\n\n이번은 분할 생성 배치 ${rounds}-${index + 1} 입니다. 다른 배치와 겹치지 않게 다양한 단어를 생성하세요.`
            : `\n\nThis is parallel split batch ${rounds}-${index + 1}. Generate diverse terms that do not overlap with other batches.`

          return createNanoGptChatCompletion({
            requestKind: "chat",
            messages: [
              { role: "system", content: prompts.systemPrompt },
              { role: "user", content: prompts.userPrompt + repetitionConstraint + branchHint },
            ],
          })
        })

        const generationResults = await Promise.allSettled(generationJobs)
        let roundAdded = 0

        for (const result of generationResults) {
          if (result.status === "rejected") {
            if (result.reason instanceof NanoGptChatError) {
              if (
                result.reason.statusCode === 429
                && result.reason.code === "global_daily_limit_reached"
              ) {
                globalLlmLimitHit = true
              }
              providerFailureCount += 1
            }
            continue
          }

          const completion = result.value
          if (!lastRequestedModel) {
            lastRequestedModel = completion.requestedModel
          }
          if (!lastResolvedModel) {
            lastResolvedModel = completion.resolvedModel
          }

          const parsedDeck = parseDeckFromCompletion(completion.content, batchSize)
          if (parsedDeck.title && parsedDeck.title.length > 2) {
            deckTitle = parsedDeck.title
          }

          for (const card of parsedDeck.cards) {
            const dedupeKey = toTermDedupKey(card.term, card.meaning)
            if (seenTerms.has(dedupeKey)) {
              continue
            }

            seenTerms.add(dedupeKey)
            collectedCards.push(card)
            roundAdded += 1

            if (collectedCards.length >= cardCount) {
              break
            }
          }

          if (collectedCards.length >= cardCount) {
            break
          }
        }

        if (roundAdded === 0) {
          stagnationRounds += 1
        } else {
          stagnationRounds = 0
        }

        emitLabGenerateProgress(authenticatedSession.user.id, {
          requestId,
          status: "round_finished",
          targetCount: cardCount,
          collectedCount: collectedCards.length,
          round: rounds,
          totalRounds: LAB_GENERATE_MAX_ROUNDS,
          addedThisRound: roundAdded,
          providerFailureCount,
          at: new Date().toISOString(),
        })

        if (globalLlmLimitHit && collectedCards.length < cardCount) {
          break
        }
      }

      if (globalLlmLimitHit && collectedCards.length < LAB_MIN_CARD_COUNT) {
        await refundDailyLabGeneration(authenticatedSession.user.id)
        shouldRefund = false
        emitLabGenerateProgress(authenticatedSession.user.id, {
          requestId,
          status: "failed",
          reason: "global_limit",
          targetCount: cardCount,
          collectedCount: collectedCards.length,
          providerFailureCount,
          at: new Date().toISOString(),
        })

        return attachRefreshedAuthCookie(
          createAuthJsonResponse(
            { error: LAB_GENERATE_ERRORS[locale].globalLlmLimit },
            { status: 429 }
          ),
          authenticatedSession
        )
      }

      if (collectedCards.length < LAB_MIN_CARD_COUNT) {
        await refundDailyLabGeneration(authenticatedSession.user.id)
        shouldRefund = false
        emitLabGenerateProgress(authenticatedSession.user.id, {
          requestId,
          status: "failed",
          reason: providerFailureCount > 0 ? "provider_failure" : "parse_failure",
          targetCount: cardCount,
          collectedCount: collectedCards.length,
          providerFailureCount,
          at: new Date().toISOString(),
        })

        return attachRefreshedAuthCookie(
          createAuthJsonResponse(
            { error: providerFailureCount > 0 ? LAB_GENERATE_ERRORS[locale].providerFailure : LAB_GENERATE_ERRORS[locale].parseFailure },
            { status: 502 }
          ),
          authenticatedSession
        )
      }

      emitLabGenerateProgress(authenticatedSession.user.id, {
        requestId,
        status: "saving",
        targetCount: cardCount,
        collectedCount: collectedCards.length,
        at: new Date().toISOString(),
      })

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
      emitLabGenerateProgress(authenticatedSession.user.id, {
        requestId,
        status: "completed",
        targetCount: cardCount,
        collectedCount: savedDeck.cards.length,
        at: new Date().toISOString(),
      })

      return attachRefreshedAuthCookie(
        createAuthJsonResponse({
          requestId,
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

      if (error instanceof NanoGptChatError) {
        if (error.statusCode === 429 && error.code === "global_daily_limit_reached") {
          emitLabGenerateProgress(authenticatedSession.user.id, {
            requestId,
            status: "failed",
            reason: "global_limit",
            targetCount: cardCount,
            collectedCount: 0,
            at: new Date().toISOString(),
          })

          return attachRefreshedAuthCookie(
            createAuthJsonResponse(
              { error: LAB_GENERATE_ERRORS[locale].globalLlmLimit },
              { status: 429 }
            ),
            authenticatedSession
          )
        }

        emitLabGenerateProgress(authenticatedSession.user.id, {
          requestId,
          status: "failed",
          reason: "provider_failure",
          targetCount: cardCount,
          collectedCount: 0,
          at: new Date().toISOString(),
        })

        return attachRefreshedAuthCookie(
          createAuthJsonResponse(
            { error: LAB_GENERATE_ERRORS[locale].providerFailure },
            { status: 502 }
          ),
          authenticatedSession
        )
      }

      emitLabGenerateProgress(authenticatedSession.user.id, {
        requestId,
        status: "failed",
        reason: "internal_error",
        targetCount: cardCount,
        collectedCount: 0,
        at: new Date().toISOString(),
      })

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
