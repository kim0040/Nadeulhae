import { NextRequest } from "next/server"

import { withApiAnalytics } from "@/lib/analytics/route"
import { createAuthJsonResponse, validateAuthMutationRequest } from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import {
  CHAT_CONTEXT_MESSAGE_LIMIT,
  CHAT_INPUT_MAX_CHARACTERS,
} from "@/lib/chat/constants"
import { FactChatError, createFactChatCompletion } from "@/lib/chat/factchat"
import {
  buildChatSystemPrompt,
  buildProfileMemoryPrompt,
  buildSummaryPrompt,
  type ChatWeatherContext,
} from "@/lib/chat/prompt"
import {
  getChatMemorySnapshot,
  getChatPolicySnapshot,
  getChatSessionMemorySnapshot,
  getChatState,
  getCompactionCandidate,
  getProfileMemoryRefreshCandidate,
  getRecentContextMessages,
  logChatRequestEvent,
  markDailyChatFailure,
  persistUserProfileMemory,
  persistChatExchange,
  persistCompactedMemory,
  resolveChatSession,
  reserveDailyChatRequest,
} from "@/lib/chat/repository"
import type { ChatConversationMessage, ChatLocale } from "@/lib/chat/types"

export const runtime = "nodejs"

const CHAT_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    invalidMessage: "메시지를 입력해 주세요.",
    tooLong: `메시지는 ${CHAT_INPUT_MAX_CHARACTERS}자 이하여야 합니다.`,
    rateLimited: "오늘 사용할 수 있는 채팅 횟수를 모두 사용했습니다. 내일 다시 시도해 주세요.",
    providerFailure: "챗봇 응답을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    unexpected: "채팅 처리 중 오류가 발생했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    invalidMessage: "Please enter a message.",
    tooLong: `Messages must be ${CHAT_INPUT_MAX_CHARACTERS} characters or fewer.`,
    rateLimited: "You have reached today’s chat limit. Please try again tomorrow.",
    providerFailure: "Failed to get a chatbot response. Please try again shortly.",
    unexpected: "An unexpected chat error occurred.",
  },
} as const

function getRequestLocale(request: Request, preferred?: unknown): ChatLocale {
  if (preferred === "en" || preferred === "ko") {
    return preferred
  }

  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
  return header.startsWith("en") ? "en" : "ko"
}

function normalizeMessage(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  return value.replace(/\u0000/g, "").trim()
}

function getErrorMessage(locale: ChatLocale, key: keyof typeof CHAT_ERRORS.ko) {
  return CHAT_ERRORS[locale][key]
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return null
  }

  return normalized.slice(0, maxLength)
}

function sanitizeNumber(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }
  return Math.min(max, Math.max(min, value))
}

function sanitizeBoolean(value: unknown) {
  return value === true
}

function sanitizeWeatherTags(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0 && item.length <= 24 && /^[a-z0-9_-]+$/.test(item))
    .slice(0, 6)
}

function sanitizeWeatherContext(value: unknown): ChatWeatherContext | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const input = value as Record<string, unknown>

  const observedAt = sanitizeText(input.observedAt, 64)
  const observedDate = observedAt ? new Date(observedAt) : null

  return {
    region: sanitizeText(input.region, 64),
    score: sanitizeNumber(input.score, 0, 100),
    status: sanitizeText(input.status, 64),
    temperatureC: sanitizeNumber(input.temperatureC, -50, 60),
    feelsLikeC: sanitizeNumber(input.feelsLikeC, -60, 70),
    humidityPct: sanitizeNumber(input.humidityPct, 0, 100),
    windMs: sanitizeNumber(input.windMs, 0, 70),
    uvLabel: sanitizeText(input.uvLabel, 32),
    pm10: sanitizeNumber(input.pm10, 0, 1000),
    pm25: sanitizeNumber(input.pm25, 0, 1000),
    rainingNow: sanitizeBoolean(input.rainingNow),
    severeAlert: sanitizeBoolean(input.severeAlert),
    hazardTags: sanitizeWeatherTags(input.hazardTags),
    bulletin: sanitizeText(input.bulletin, 220),
    observedAt: observedDate && !Number.isNaN(observedDate.getTime())
      ? observedDate.toISOString()
      : null,
  }
}

function sanitizeSessionId(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  if (!/^\d+$/.test(normalized)) {
    return null
  }

  return normalized
}

function parseProfileMemoryPayload(content: string) {
  const text = content.trim()
  if (!text) {
    return null
  }

  const tryParse = (source: string) => {
    try {
      const parsed = JSON.parse(source) as { summary?: unknown; assessment?: unknown }
      const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : ""
      const assessment = typeof parsed.assessment === "string" ? parsed.assessment.trim() : null
      if (!summary) {
        return null
      }
      return {
        summary,
        assessment: assessment || null,
      }
    } catch {
      return null
    }
  }

  const direct = tryParse(text)
  if (direct) {
    return direct
  }

  const jsonLike = text.match(/\{[\s\S]*\}/)
  if (jsonLike) {
    const extracted = tryParse(jsonLike[0])
    if (extracted) {
      return extracted
    }
  }

  return {
    summary: text.slice(0, 1200),
    assessment: null,
  }
}

function buildChatPayload(messages: ChatConversationMessage[], systemPrompt: string, userMessage: string) {
  return [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: "user" as const, content: userMessage },
  ]
}

async function compactUserMemory(input: {
  userId: string
  sessionId: number
  locale: ChatLocale
  memorySummary: string | null
}) {
  const candidate = await getCompactionCandidate(input.userId, input.sessionId)
  if (!candidate || candidate.messages.length === 0) {
    return
  }

  const summaryStartedAt = Date.now()

  try {
    const summaryResult = await createFactChatCompletion({
      requestKind: "summary",
      messages: [
        {
          role: "system",
          content: input.locale === "ko"
            ? "당신은 대화 메모리 압축기다. 다음 응답을 위한 핵심만 보존하고 군더더기를 제거한다."
            : "You compress conversation memory for future prompting. Keep only high-value context.",
        },
        {
          role: "user",
          content: buildSummaryPrompt({
            locale: input.locale,
            existingSummary: input.memorySummary,
            messages: candidate.messages,
          }),
        },
      ],
    })

    await persistCompactedMemory({
      userId: input.userId,
      sessionId: input.sessionId,
      locale: input.locale,
      summary: summaryResult.content,
      summarizedMessageIds: candidate.messageIds,
      summarizedMessageCount: candidate.messages.length,
      requestedModel: summaryResult.requestedModel,
      resolvedModel: summaryResult.resolvedModel,
      providerRequestId: summaryResult.providerRequestId,
      usage: summaryResult.usage,
      latencyMs: Date.now() - summaryStartedAt,
    })
  } catch (error) {
    console.error("Chat memory compaction failed:", error)
    const providerError = error instanceof FactChatError ? error : null
    await logChatRequestEvent({
      userId: input.userId,
      sessionId: input.sessionId,
      requestKind: "summary",
      status: "provider_error",
      locale: input.locale,
      messageCount: candidate.messages.length,
      inputCharacters: candidate.messages.reduce((total, message) => total + message.content.length, 0),
      latencyMs: Date.now() - summaryStartedAt,
      errorCode: providerError?.code ?? "summary_failed",
      errorMessage: providerError?.message ?? "Summary compaction failed.",
    })
  }
}

async function refreshUserProfileMemory(input: {
  userId: string
  locale: ChatLocale
}) {
  const candidate = await getProfileMemoryRefreshCandidate(input.userId)
  if (!candidate) {
    return
  }

  const refreshStartedAt = Date.now()

  try {
    const result = await createFactChatCompletion({
      requestKind: "summary",
      messages: [
        {
          role: "system",
          content: input.locale === "ko"
            ? "당신은 개인화 메모리 요약기다. 불필요한 군더더기 없이 핵심 선호와 판단 패턴만 압축한다."
            : "You refresh compact personalization memory. Keep only durable, high-signal user traits.",
        },
        {
          role: "user",
          content: buildProfileMemoryPrompt({
            locale: input.locale,
            existingSummary: candidate.existingSummary,
            existingAssessment: candidate.existingAssessment,
            messages: candidate.messages,
          }),
        },
      ],
    })

    const parsed = parseProfileMemoryPayload(result.content)
    if (!parsed) {
      return
    }

    await persistUserProfileMemory({
      userId: input.userId,
      summary: parsed.summary,
      assessment: parsed.assessment,
      lastMessageId: candidate.lastMessageId,
      modelUsed: result.resolvedModel,
    })
  } catch (error) {
    console.error("Profile memory refresh failed:", error)
    const providerError = error instanceof FactChatError ? error : null
    await logChatRequestEvent({
      userId: input.userId,
      requestKind: "summary",
      status: "provider_error",
      locale: input.locale,
      messageCount: candidate.messages.length,
      inputCharacters: candidate.messages.reduce((total, message) => total + message.content.length, 0),
      latencyMs: Date.now() - refreshStartedAt,
      errorCode: providerError?.code ?? "profile_summary_failed",
      errorMessage: providerError?.message ?? "Profile memory refresh failed.",
    })
  }
}

async function handleGET(request: NextRequest) {
  try {
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    const locale = getRequestLocale(request)
    const requestedSessionId = sanitizeSessionId(request.nextUrl.searchParams.get("sessionId"))

    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: getErrorMessage(locale, "unauthorized") },
          { status: 401 }
        )
      )
    }

    const response = createAuthJsonResponse(await getChatState({
      userId: authenticatedSession.user.id,
      locale,
      requestedSessionId,
    }))
    return attachRefreshedAuthCookie(response, authenticatedSession)
  } catch (error) {
    console.error("Chat GET API failed:", error)
    return createAuthJsonResponse(
      { error: getErrorMessage(getRequestLocale(request), "unexpected") },
      { status: 500 }
    )
  }
}

async function handlePOST(request: NextRequest) {
  const requestStartedAt = Date.now()
  const invalidRequestResponse = validateAuthMutationRequest(request)
  if (invalidRequestResponse) {
    return invalidRequestResponse
  }

  let body: { message?: string; locale?: ChatLocale; weatherContext?: unknown; sessionId?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    const locale = getRequestLocale(request)
    return createAuthJsonResponse(
      { error: getErrorMessage(locale, "invalidMessage") },
      { status: 400 }
    )
  }

  const locale = getRequestLocale(request, body.locale)
  const message = normalizeMessage(body.message)
  const weatherContext = sanitizeWeatherContext(body.weatherContext)
  const requestedSessionId = sanitizeSessionId(body.sessionId)
  if (!message) {
    return createAuthJsonResponse(
      { error: getErrorMessage(locale, "invalidMessage") },
      { status: 400 }
    )
  }

  if (message.length > CHAT_INPUT_MAX_CHARACTERS) {
    return createAuthJsonResponse(
      { error: getErrorMessage(locale, "tooLong") },
      { status: 413 }
    )
  }

  let resolvedSessionId: number | null = null

  try {
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: getErrorMessage(locale, "unauthorized") },
          { status: 401 }
        )
      )
    }

    const resolvedSession = await resolveChatSession({
      userId: authenticatedSession.user.id,
      locale,
      requestedSessionId,
    })
    resolvedSessionId = resolvedSession.activeSessionId

    const sessionMemory = await getChatSessionMemorySnapshot({
      userId: authenticatedSession.user.id,
      sessionId: resolvedSession.activeSessionId,
    })

    await compactUserMemory({
      userId: authenticatedSession.user.id,
      sessionId: resolvedSession.activeSessionId,
      locale,
      memorySummary: sessionMemory?.summary ?? null,
    })

    const reservation = await reserveDailyChatRequest(authenticatedSession.user.id)
    if (!reservation.allowed) {
      await logChatRequestEvent({
        userId: authenticatedSession.user.id,
        sessionId: resolvedSession.activeSessionId,
        requestKind: "chat",
        status: "rate_limited",
        locale,
        inputCharacters: message.length,
        errorCode: "daily_limit_reached",
        errorMessage: getErrorMessage(locale, "rateLimited"),
      })

      const state = await getChatState({
        userId: authenticatedSession.user.id,
        locale,
        requestedSessionId: String(resolvedSession.activeSessionId),
      })

      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          {
            ...state,
            error: getErrorMessage(locale, "rateLimited"),
            usage: reservation.usage,
            policy: getChatPolicySnapshot(),
          },
          { status: 429 }
        ),
        authenticatedSession
      )
    }

    const [latestSessionMemory, profileMemory, contextMessages] = await Promise.all([
      getChatSessionMemorySnapshot({
        userId: authenticatedSession.user.id,
        sessionId: resolvedSession.activeSessionId,
      }),
      getChatMemorySnapshot(authenticatedSession.user.id),
      getRecentContextMessages(
        authenticatedSession.user.id,
        resolvedSession.activeSessionId,
        CHAT_CONTEXT_MESSAGE_LIMIT
      ),
    ])

    const completionResult = await createFactChatCompletion({
      requestKind: "chat",
      messages: buildChatPayload(
        contextMessages,
        buildChatSystemPrompt({
          locale,
          user: authenticatedSession.user,
          memorySummary: latestSessionMemory?.summary ?? null,
          profileSummary: profileMemory?.summary ?? null,
          profileAssessment: profileMemory?.assessment ?? null,
          weatherContext,
        }),
        message
      ),
    })

    await persistChatExchange({
      userId: authenticatedSession.user.id,
      sessionId: resolvedSession.activeSessionId,
      locale,
      userMessage: message,
      assistantMessage: completionResult.content,
      requestedModel: completionResult.requestedModel,
      resolvedModel: completionResult.resolvedModel,
      providerRequestId: completionResult.providerRequestId,
      usage: completionResult.usage,
      latencyMs: Date.now() - requestStartedAt,
      contextMessageCount: contextMessages.length,
    })

    await refreshUserProfileMemory({
      userId: authenticatedSession.user.id,
      locale,
    })

    const response = createAuthJsonResponse(await getChatState({
      userId: authenticatedSession.user.id,
      locale,
      requestedSessionId: String(resolvedSession.activeSessionId),
    }))
    return attachRefreshedAuthCookie(response, authenticatedSession)
  } catch (error) {
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request).catch(() => null)
    const providerError = error instanceof FactChatError ? error : null

    if (authenticatedSession) {
      await markDailyChatFailure({
        userId: authenticatedSession.user.id,
        sessionId: resolvedSessionId,
        locale,
        latencyMs: Date.now() - requestStartedAt,
        inputCharacters: message.length,
        messageCount: CHAT_CONTEXT_MESSAGE_LIMIT,
        errorCode: providerError?.code ?? "chat_failed",
        errorMessage: providerError?.message ?? "Chat request failed.",
      }).catch((loggingError) => {
        console.error("Failed to record chat failure:", loggingError)
      })
    }

    console.error("Chat POST API failed:", error)
    const status = providerError?.statusCode && providerError.statusCode < 500
      ? 502
      : 500
    const errorMessage = providerError
      ? getErrorMessage(locale, "providerFailure")
      : getErrorMessage(locale, "unexpected")

    const response = createAuthJsonResponse({ error: errorMessage }, { status })
    return authenticatedSession
      ? attachRefreshedAuthCookie(response, authenticatedSession)
      : response
  }
}

export const GET = withApiAnalytics(handleGET)
export const POST = withApiAnalytics(handlePOST)
