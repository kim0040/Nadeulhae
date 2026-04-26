import { NextRequest } from "next/server"

import { withApiAnalytics } from "@/lib/analytics/route"
import { createAuthJsonResponse, validateAuthMutationRequest } from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import {
  LAB_AI_CHAT_CONTEXT_MESSAGE_LIMIT,
  LAB_AI_CHAT_INPUT_MAX_CHARACTERS,
} from "@/lib/lab-ai-chat/constants"
import { buildLabAiChatSummaryPrompt, buildLabAiChatSystemPrompt } from "@/lib/lab-ai-chat/prompt"
import {
  getLabAiChatCompactionCandidate,
  getLabAiChatPolicySnapshot,
  getLabAiChatSessionMemorySnapshot,
  getLabAiChatStateCore,
  getRecentLabAiChatContextMessages,
  logLabAiChatRequestEvent,
  markDailyLabAiChatFailure,
  persistLabAiChatCompactedMemory,
  persistLabAiChatExchange,
  resolveLabAiChatSession,
  reserveDailyLabAiChatRequest,
} from "@/lib/lab-ai-chat/repository"
import type { LabAiChatLocale, LabAiChatStateResponse } from "@/lib/lab-ai-chat/types"
import { resolveLabAiChatWebSearchContext } from "@/lib/lab-ai-chat/web-search"
import { sanitizeAssistantMarkdown } from "@/lib/markdown/sanitize-assistant-markdown"
import {
  NanoGptError,
  createNanoGptCompletion,
  createNanoGptCompletionStream,
  resolveAllowedNanoGptModels,
  resolveRequestedNanoGptModel,
} from "@/lib/nanogpt/client"

export const runtime = "nodejs"

const LAB_AI_CHAT_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    disabled: "실험실 활성화 사용자만 이용할 수 있습니다.",
    invalidMessage: "메시지를 입력해 주세요.",
    invalidModel: "허용되지 않은 모델입니다.",
    tooLong: `메시지는 ${LAB_AI_CHAT_INPUT_MAX_CHARACTERS}자 이하여야 합니다.`,
    rateLimited: "오늘 대화 가능 횟수를 모두 사용했어요. 내일 다시 이어서 도와드릴게요.",
    globalLlmLimit: "오늘 AI 요청 한도에 도달했습니다. 내일 다시 시도해 주세요.",
    busy: "이전 답변을 생성 중입니다. 잠시 후 다시 시도해 주세요.",
    providerFailure: "AI 응답을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    unexpected: "채팅 처리 중 오류가 발생했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    disabled: "This feature is available only when the lab is enabled.",
    invalidMessage: "Please enter a message.",
    invalidModel: "This model is not allowed.",
    tooLong: `Messages must be ${LAB_AI_CHAT_INPUT_MAX_CHARACTERS} characters or fewer.`,
    rateLimited: "You have used all available chats for today. Come back tomorrow to continue.",
    globalLlmLimit: "The site has reached today's AI request limit. Please try again tomorrow.",
    busy: "Your previous message is still being processed. Please try again shortly.",
    providerFailure: "Failed to get an AI response. Please try again shortly.",
    unexpected: "An unexpected chat error occurred.",
  },
} as const

declare global {
  var __nadeulhaeLabAiChatUsersInFlight: Set<string> | undefined
}

function getChatUsersInFlight() {
  if (!globalThis.__nadeulhaeLabAiChatUsersInFlight) {
    globalThis.__nadeulhaeLabAiChatUsersInFlight = new Set()
  }

  return globalThis.__nadeulhaeLabAiChatUsersInFlight
}

function acquireChatUserLock(userId: string) {
  const inFlight = getChatUsersInFlight()
  if (inFlight.has(userId)) {
    return false
  }

  inFlight.add(userId)
  return true
}

function releaseChatUserLock(userId: string | null) {
  if (!userId) {
    return
  }

  getChatUsersInFlight().delete(userId)
}

function getRequestLocale(request: Request, preferred?: unknown): LabAiChatLocale {
  if (preferred === "en" || preferred === "ko") {
    return preferred
  }

  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
  return header.startsWith("en") ? "en" : "ko"
}

function getErrorMessage(locale: LabAiChatLocale, key: keyof typeof LAB_AI_CHAT_ERRORS.ko) {
  return LAB_AI_CHAT_ERRORS[locale][key]
}

function withServerNow<T extends object>(payload: T) {
  return {
    ...payload,
    serverNow: new Date().toISOString(),
  }
}

function normalizeMessage(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202F]/g, "")
    .trim()
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

function sanitizeModelId(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 && normalized.length <= 191 ? normalized : null
}

function sanitizeBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true") return true
    if (normalized === "false") return false
  }
  return false
}

const ASSISTANT_NAME_KO = "나들 AI"
const ASSISTANT_NAME_EN = "Nadeul AI"
const MODEL_DISCLOSURE_PATTERN = /\b(chatgpt|gpt(?:-|_)?\d[\w.-]*|openai|claude|gemini|llama|mistral|deepseek|qwen|kimi|glm|minimax|gemma)\b/i
const SELF_REFERENCE_PATTERN = /(저는|나는|제가|내가|i am|i'm|as an?)/i

function stripAssistantReasoning(content: string) {
  return content
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/<think\b[^>]*>[\s\S]*$/gi, "")
    .replace(/<thinking\b[^>]*>[\s\S]*$/gi, "")
    .replace(/<reasoning\b[^>]*>[\s\S]*$/gi, "")
    .trim()
}

function createAssistantReasoningStreamFilter() {
  let buffer = ""
  let hiddenTag: "think" | "thinking" | "reasoning" | null = null
  const startPattern = /<(think|thinking|reasoning)\b[^>]*>/i

  const push = (chunk: string) => {
    buffer += chunk
    let visible = ""

    while (buffer.length > 0) {
      if (hiddenTag) {
        const endPattern = new RegExp(`</${hiddenTag}>`, "i")
        const endMatch = endPattern.exec(buffer)
        if (!endMatch) {
          buffer = buffer.slice(-16)
          return visible
        }

        buffer = buffer.slice(endMatch.index + endMatch[0].length)
        hiddenTag = null
        continue
      }

      const startMatch = startPattern.exec(buffer)
      if (!startMatch) {
        const keep = Math.min(buffer.length, 16)
        visible += buffer.slice(0, buffer.length - keep)
        buffer = buffer.slice(buffer.length - keep)
        return visible
      }

      visible += buffer.slice(0, startMatch.index)
      hiddenTag = startMatch[1].toLowerCase() as "think" | "thinking" | "reasoning"
      buffer = buffer.slice(startMatch.index + startMatch[0].length)
    }

    return visible
  }

  const flush = () => {
    if (hiddenTag) {
      buffer = ""
      hiddenTag = null
      return ""
    }

    const visible = stripAssistantReasoning(buffer)
    buffer = ""
    return visible
  }

  return { push, flush }
}

function enforceAssistantIdentity(content: string, locale: LabAiChatLocale) {
  const identity = locale === "ko"
    ? `저는 ${ASSISTANT_NAME_KO}입니다.`
    : `I am ${ASSISTANT_NAME_EN}.`

  const disclosureNote = locale === "ko"
    ? "모델명이나 내부 시스템 정보는 공개하지 않아요."
    : "I can't share model or internal system details."

  const normalized = stripAssistantReasoning(content)
  if (!normalized) {
    return identity
  }

  const sanitized = normalized
    .replace(
      /(?:저는|나는|제가|내가)\s*(?:chatgpt|gpt[^\s,.!?]*|openai[^\s,.!?]*|ai\s*언어\s*모델|인공지능\s*모델)[^.!?\n]*[.!?]?/gi,
      identity
    )
    .replace(
      /(?:i am|i'm)\s*(?:chatgpt|gpt[^\s,.!?]*|an?\s+(?:ai\s+)?language model|openai[^\s,.!?]*)[^.!?\n]*[.!?]?/gi,
      identity
    )
    .replace(
      /as an?\s+(?:ai\s+)?language model[^.!?\n]*[.!?]?/gi,
      identity
    )
    .trim()

  if (!sanitized) {
    return identity
  }

  if (MODEL_DISCLOSURE_PATTERN.test(sanitized) && SELF_REFERENCE_PATTERN.test(sanitized)) {
    return `${identity} ${disclosureNote}`
  }

  return sanitized
}

function stripLeakedWebSearchScaffold(content: string) {
  const lines = content.split(/\r?\n/)
  const kept: string[] = []

  let inContextBlock = false
  let inSourceList = false

  const contextHeaderPattern = /^\[(?:웹 검색 컨텍스트|Web Search Context|캐시된 웹 검색 컨텍스트|Cached Web Search Context|내부 웹 검색 컨텍스트.*|Internal Web Search Context.*)\]$/i
  const sourceHeaderPattern = /^\[(?:출처 후보|Candidate Sources)\]$/i
  const metadataPattern = /^(?:질의|토픽|기간|결과 수|시작일|종료일|요약 답변|이전 질의|캐시 시각|Query|Topic|Range|Result count|Start|End|Summary answer|Previous query|Cached at)\s*:/i
  const sourceItemPattern = /^(?:\d+\.\s|URL\s*:|발행일\s*:|Published\s*:|요약\s*:|Snippet\s*:)/i

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (contextHeaderPattern.test(line)) {
      inContextBlock = true
      inSourceList = false
      continue
    }

    if (inContextBlock && sourceHeaderPattern.test(line)) {
      inSourceList = true
      continue
    }

    if (inContextBlock) {
      if (!line) {
        continue
      }

      if (metadataPattern.test(line)) {
        continue
      }

      if (inSourceList) {
        if (sourceItemPattern.test(line)) {
          continue
        }
      }

      // Exit leaked scaffold mode once we hit normal prose.
      inContextBlock = false
      inSourceList = false
      kept.push(rawLine)
      continue
    }

    kept.push(rawLine)
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function addLengthLimitNotice(content: string, locale: LabAiChatLocale) {
  const trimmed = content.trim()
  if (!trimmed) {
    return trimmed
  }

  const notice = locale === "ko"
    ? "답변이 길어져 여기서 잠시 멈췄어요. '계속'이라고 보내면 이어서 작성할게요."
    : "The answer got long, so I paused here. Send \"continue\" and I will keep going."

  if (trimmed.includes(notice)) {
    return trimmed
  }

  return `${trimmed}\n\n${notice}`
}

function finalizeAssistantMessage(content: string, locale: LabAiChatLocale, finishReason?: string | null) {
  const sanitizedMessage = sanitizeAssistantMarkdown({
    content: stripLeakedWebSearchScaffold(enforceAssistantIdentity(content, locale)),
    language: locale,
  })
  const assistantMessage = sanitizedMessage.trim().length > 0
    ? sanitizedMessage
    : (locale === "ko"
      ? "검색 내용을 바탕으로 핵심만 정리해 다시 답변할게요."
      : "I will summarize the search findings and answer concisely.")
  return finishReason === "length"
    ? addLengthLimitNotice(assistantMessage, locale)
    : assistantMessage
}

function sanitizeStateIdentity(state: LabAiChatStateResponse, locale: LabAiChatLocale): LabAiChatStateResponse {
  return {
    ...state,
    messages: state.messages.map((message) => {
      if (message.role !== "assistant") {
        return message
      }

      return {
        ...message,
        content: sanitizeAssistantMarkdown({
          content: stripLeakedWebSearchScaffold(enforceAssistantIdentity(message.content, locale)),
          language: locale,
        }),
      }
    }),
  }
}

function buildChatPayload(
  messages: LabAiChatStateResponse["messages"],
  systemPrompt: string,
  userMessage: string
) {
  return [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: "user" as const, content: userMessage },
  ]
}

async function buildStateResponse(input: {
  userId: string
  locale: LabAiChatLocale
  requestedSessionId?: string | null
}): Promise<LabAiChatStateResponse> {
  const [models, coreState] = await Promise.all([
    resolveAllowedNanoGptModels(),
    getLabAiChatStateCore(input),
  ])

  return {
    ...coreState,
    models,
    defaultModelId: models[0].id,
  }
}

type LabAiChatStatusKind =
  | "memory_check"
  | "memory_compacting"
  | "memory_compacted"
  | "memory_skip"
  | "memory_failed"
  | "context_loading"
  | "response_generating"
  | "response_saving"
  | "state_syncing"

function getLabAiChatStatusMessage(locale: LabAiChatLocale, kind: LabAiChatStatusKind) {
  if (locale === "ko") {
    switch (kind) {
      case "memory_check":
        return "세션 메모리 상태를 점검하는 중..."
      case "memory_compacting":
        return "세션 메모리를 요약 정리하는 중..."
      case "memory_compacted":
        return "세션 메모리 요약이 완료되었어요."
      case "memory_skip":
        return "세션 메모리 점검 완료."
      case "memory_failed":
        return "세션 메모리 요약에 실패해 기존 메모리로 진행합니다."
      case "context_loading":
        return "대화 맥락을 불러오는 중..."
      case "response_generating":
        return "답변을 생성하는 중..."
      case "response_saving":
        return "답변을 저장하는 중..."
      case "state_syncing":
        return "최종 상태를 반영하는 중..."
      default:
        return ""
    }
  }

  switch (kind) {
    case "memory_check":
      return "Checking session memory status..."
    case "memory_compacting":
      return "Compacting session memory..."
    case "memory_compacted":
      return "Session memory compaction completed."
    case "memory_skip":
      return "Session memory check completed."
    case "memory_failed":
      return "Memory compaction failed; continuing with current memory."
    case "context_loading":
      return "Loading conversation context..."
    case "response_generating":
      return "Generating the response..."
    case "response_saving":
      return "Saving the response..."
    case "state_syncing":
      return "Syncing final state..."
    default:
      return ""
  }
}

async function compactLabAiChatMemory(input: {
  userId: string
  sessionId: number
  locale: LabAiChatLocale
  memorySummary: string | null
  modelId: string
  onStatus?: (message: string) => void
}) {
  const candidate = await getLabAiChatCompactionCandidate(input.userId, input.sessionId)
  if (!candidate || candidate.messages.length === 0) {
    input.onStatus?.(getLabAiChatStatusMessage(input.locale, "memory_skip"))
    return
  }

  input.onStatus?.(getLabAiChatStatusMessage(input.locale, "memory_compacting"))
  const summaryStartedAt = Date.now()

  try {
    const summaryResult = await createNanoGptCompletion({
      model: input.modelId,
      requestKind: "summary",
      messages: [
        {
          role: "system",
          content: input.locale === "ko"
            ? "당신은 대화 메모리 압축기다. 다음 응답에 필요한 핵심 맥락만 남긴다."
            : "You compress conversation memory and keep only the context needed for future replies.",
        },
        {
          role: "user",
          content: buildLabAiChatSummaryPrompt({
            locale: input.locale,
            existingSummary: input.memorySummary,
            messages: candidate.messages,
          }),
        },
      ],
    })

    await persistLabAiChatCompactedMemory({
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
    input.onStatus?.(getLabAiChatStatusMessage(input.locale, "memory_compacted"))
  } catch (error) {
    console.error("Lab AI chat memory compaction failed:", error)
    const providerError = error instanceof NanoGptError ? error : null
    input.onStatus?.(getLabAiChatStatusMessage(input.locale, "memory_failed"))
    await logLabAiChatRequestEvent({
      userId: input.userId,
      sessionId: input.sessionId,
      requestKind: "summary",
      status: "provider_error",
      locale: input.locale,
      requestedModel: input.modelId,
      messageCount: candidate.messages.length,
      inputCharacters: candidate.messages.reduce((total, message) => total + message.content.length, 0),
      latencyMs: Date.now() - summaryStartedAt,
      errorCode: providerError?.code ?? "summary_failed",
      errorMessage: providerError?.message ?? "Summary compaction failed.",
    })
  }
}

async function prepareLabAiChatContext(input: {
  userId: string
  sessionId: number
  locale: LabAiChatLocale
  modelId: string
  onStatus?: (message: string) => void
}) {
  input.onStatus?.(getLabAiChatStatusMessage(input.locale, "memory_check"))
  const sessionMemory = await getLabAiChatSessionMemorySnapshot({
    userId: input.userId,
    sessionId: input.sessionId,
  })

  await compactLabAiChatMemory({
    userId: input.userId,
    sessionId: input.sessionId,
    locale: input.locale,
    memorySummary: sessionMemory?.summary ?? null,
    modelId: input.modelId,
    onStatus: input.onStatus,
  })

  input.onStatus?.(getLabAiChatStatusMessage(input.locale, "context_loading"))
  const [latestSessionMemory, contextMessages] = await Promise.all([
    getLabAiChatSessionMemorySnapshot({
      userId: input.userId,
      sessionId: input.sessionId,
    }),
    getRecentLabAiChatContextMessages(
      input.userId,
      input.sessionId,
      LAB_AI_CHAT_CONTEXT_MESSAGE_LIMIT
    ),
  ])

  return { latestSessionMemory, contextMessages }
}

async function handleGET(request: NextRequest) {
  try {
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    const locale = getRequestLocale(request)
    const requestedSessionId = sanitizeSessionId(request.nextUrl.searchParams.get("sessionId"))

    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          withServerNow({ error: getErrorMessage(locale, "unauthorized") }),
          { status: 401 }
        )
      )
    }

    if (!authenticatedSession.user.labEnabled) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          withServerNow({ error: getErrorMessage(locale, "disabled") }),
          { status: 403 }
        ),
        authenticatedSession
      )
    }

    const state = await buildStateResponse({
      userId: authenticatedSession.user.id,
      locale,
      requestedSessionId,
    })

    return attachRefreshedAuthCookie(
      createAuthJsonResponse(withServerNow(sanitizeStateIdentity(state, locale))),
      authenticatedSession
    )
  } catch (error) {
    console.error("Lab AI chat GET API failed:", error)
    return createAuthJsonResponse(
      withServerNow({ error: getErrorMessage(getRequestLocale(request), "unexpected") }),
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

  let body: { message?: string; locale?: LabAiChatLocale; sessionId?: unknown; modelId?: unknown; webSearchEnabled?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    const locale = getRequestLocale(request)
    return createAuthJsonResponse(
      withServerNow({ error: getErrorMessage(locale, "invalidMessage") }),
      { status: 400 }
    )
  }

  const locale = getRequestLocale(request, body.locale)
  const message = normalizeMessage(body.message)
  const requestedSessionId = sanitizeSessionId(body.sessionId)
  const requestedModelId = sanitizeModelId(body.modelId)
  const webSearchEnabled = sanitizeBoolean(body.webSearchEnabled)

  if (!message) {
    return createAuthJsonResponse(
      withServerNow({ error: getErrorMessage(locale, "invalidMessage") }),
      { status: 400 }
    )
  }

  if (message.length > LAB_AI_CHAT_INPUT_MAX_CHARACTERS) {
    return createAuthJsonResponse(
      withServerNow({ error: getErrorMessage(locale, "tooLong") }),
      { status: 413 }
    )
  }

  let resolvedSessionId: number | null = null
  let lockedUserId: string | null = null
  let lockReleased = false
  let contextMessageCount = 0
  let selectedModelId: string | null = null

  try {
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          withServerNow({ error: getErrorMessage(locale, "unauthorized") }),
          { status: 401 }
        )
      )
    }

    if (!authenticatedSession.user.labEnabled) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          withServerNow({ error: getErrorMessage(locale, "disabled") }),
          { status: 403 }
        ),
        authenticatedSession
      )
    }

    const allowedModels = await resolveAllowedNanoGptModels()
    const selectedModel = resolveRequestedNanoGptModel(allowedModels, requestedModelId)
    const isRequestedModelAllowed = !requestedModelId
      || selectedModel.id === requestedModelId
      || selectedModel.slug === requestedModelId
      || selectedModel.thinkingId === requestedModelId

    if (!isRequestedModelAllowed) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          withServerNow({ error: getErrorMessage(locale, "invalidModel") }),
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    selectedModelId = requestedModelId ?? selectedModel.id

    if (!acquireChatUserLock(authenticatedSession.user.id)) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          withServerNow({ error: getErrorMessage(locale, "busy") }),
          { status: 429 }
        ),
        authenticatedSession
      )
    }
    lockedUserId = authenticatedSession.user.id

    const resolvedSession = await resolveLabAiChatSession({
      userId: authenticatedSession.user.id,
      locale,
      requestedSessionId,
    })
    resolvedSessionId = resolvedSession.activeSessionId

    const reservation = await reserveDailyLabAiChatRequest(authenticatedSession.user.id)
    if (!reservation.allowed) {
      await logLabAiChatRequestEvent({
        userId: authenticatedSession.user.id,
        sessionId: resolvedSession.activeSessionId,
        requestKind: "chat",
        status: "rate_limited",
        locale,
        requestedModel: selectedModelId,
        inputCharacters: message.length,
        errorCode: "daily_limit_reached",
        errorMessage: getErrorMessage(locale, "rateLimited"),
      })

      const state = await buildStateResponse({
        userId: authenticatedSession.user.id,
        locale,
        requestedSessionId: String(resolvedSession.activeSessionId),
      })

      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          withServerNow({
            ...sanitizeStateIdentity(state, locale),
            error: getErrorMessage(locale, "rateLimited"),
            usage: reservation.usage,
            policy: getLabAiChatPolicySnapshot(),
          }),
          { status: 429 }
        ),
        authenticatedSession
      )
    }

    const acceptSSE = request.headers.get("accept")?.includes("text/event-stream")

    if (acceptSSE) {
      const encoder = new TextEncoder()
      let accumulated = ""
      const reasoningFilter = createAssistantReasoningStreamFilter()
      const abortController = new AbortController()
      request.signal.addEventListener("abort", () => {
        abortController.abort()
      }, { once: true })

      const stream = new ReadableStream({
        async start(controller) {
          let clientDisconnected = false

          const sendEvent = (event: string, data: unknown) => {
            if (clientDisconnected) {
              return
            }

            try {
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
            } catch {
              clientDisconnected = true
            }
          }

          const checkAlive = () => !clientDisconnected && !abortController.signal.aborted

          try {
            const { latestSessionMemory, contextMessages } = await prepareLabAiChatContext({
              userId: authenticatedSession.user.id,
              sessionId: resolvedSession.activeSessionId,
              locale,
              modelId: selectedModelId!,
              onStatus: (statusMessage) => {
                sendEvent("status", { message: statusMessage })
              },
            })
            contextMessageCount = contextMessages.length

            const webSearchResolution = await resolveLabAiChatWebSearchContext({
              userId: authenticatedSession.user.id,
              sessionId: resolvedSession.activeSessionId,
              locale,
              modelId: selectedModelId!,
              question: message,
              webSearchEnabled,
              recentMessages: contextMessages.map((m) => ({ role: m.role, content: m.content })),
              onStatus: (statusMessage) => {
                sendEvent("status", { message: statusMessage })
              },
            })

            const chatMessages = buildChatPayload(
              contextMessages,
              buildLabAiChatSystemPrompt({
                locale,
                user: authenticatedSession.user,
                memorySummary: latestSessionMemory?.summary ?? null,
                webSearchContext: webSearchResolution.context,
              }),
              message
            )

            sendEvent("status", { message: getLabAiChatStatusMessage(locale, "response_generating") })
            const completionResult = await createNanoGptCompletionStream({
              model: selectedModelId!,
              requestKind: "chat",
              messages: chatMessages,
              onToken: (token) => {
                if (!checkAlive()) {
                  return
                }

                const visibleToken = reasoningFilter.push(token)
                if (!visibleToken) {
                  return
                }

                accumulated += visibleToken
                sendEvent("token", { content: visibleToken })
              },
            })

            if (!checkAlive()) {
              return
            }

            const visibleTail = reasoningFilter.flush()
            if (visibleTail) {
              accumulated += visibleTail
              sendEvent("token", { content: visibleTail })
            }

            const assistantMessage = finalizeAssistantMessage(
              accumulated || completionResult.content,
              locale,
              completionResult.finishReason
            )

            sendEvent("status", { message: getLabAiChatStatusMessage(locale, "response_saving") })
            await persistLabAiChatExchange({
              userId: authenticatedSession.user.id,
              sessionId: resolvedSession.activeSessionId,
              locale,
              userMessage: message,
              assistantMessage,
              requestedModel: completionResult.requestedModel,
              resolvedModel: completionResult.resolvedModel,
              providerRequestId: completionResult.providerRequestId,
              usage: completionResult.usage,
              latencyMs: Date.now() - requestStartedAt,
              contextMessageCount: contextMessages.length,
            })

            if (!checkAlive()) {
              return
            }

            sendEvent("status", { message: getLabAiChatStatusMessage(locale, "state_syncing") })
            const state = await buildStateResponse({
              userId: authenticatedSession.user.id,
              locale,
              requestedSessionId: String(resolvedSession.activeSessionId),
            })

            sendEvent("done", {
              ...withServerNow(sanitizeStateIdentity(state, locale)),
              resolvedModel: completionResult.resolvedModel,
            })

            controller.close()
          } catch (streamError) {
            const providerError = streamError instanceof NanoGptError ? streamError : null
            const isGlobalLlmLimitError = providerError?.statusCode === 429
              && providerError.code === "global_daily_limit_reached"
            const errorMessage = isGlobalLlmLimitError
              ? getErrorMessage(locale, "globalLlmLimit")
              : providerError
                ? getErrorMessage(locale, "providerFailure")
                : getErrorMessage(locale, "unexpected")

            sendEvent("error", { error: errorMessage })

            await markDailyLabAiChatFailure({
              userId: authenticatedSession.user.id,
              sessionId: resolvedSessionId,
              locale,
              latencyMs: Date.now() - requestStartedAt,
              inputCharacters: message.length,
              messageCount: contextMessageCount,
              requestedModel: selectedModel.id,
              errorCode: providerError?.code ?? "chat_failed",
              errorMessage: providerError?.message ?? "Lab AI chat request failed.",
            }).catch(() => {})

            controller.close()
          } finally {
            lockReleased = true
            releaseChatUserLock(lockedUserId)
          }
        },
      })

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-store",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      })
    }

    const { latestSessionMemory, contextMessages } = await prepareLabAiChatContext({
      userId: authenticatedSession.user.id,
      sessionId: resolvedSession.activeSessionId,
      locale,
      modelId: selectedModelId!,
    })
    contextMessageCount = contextMessages.length

    const webSearchResolution = await resolveLabAiChatWebSearchContext({
      userId: authenticatedSession.user.id,
      sessionId: resolvedSession.activeSessionId,
      locale,
      modelId: selectedModelId!,
      question: message,
      webSearchEnabled,
      recentMessages: contextMessages.map((m) => ({ role: m.role, content: m.content })),
    })

    const chatMessages = buildChatPayload(
      contextMessages,
      buildLabAiChatSystemPrompt({
        locale,
        user: authenticatedSession.user,
        memorySummary: latestSessionMemory?.summary ?? null,
        webSearchContext: webSearchResolution.context,
      }),
      message
    )

    const completionResult = await createNanoGptCompletion({
      model: selectedModelId!,
      requestKind: "chat",
      messages: chatMessages,
    })
    const assistantMessage = finalizeAssistantMessage(
      completionResult.content,
      locale,
      completionResult.finishReason
    )

    await persistLabAiChatExchange({
      userId: authenticatedSession.user.id,
      sessionId: resolvedSession.activeSessionId,
      locale,
      userMessage: message,
      assistantMessage,
      requestedModel: completionResult.requestedModel,
      resolvedModel: completionResult.resolvedModel,
      providerRequestId: completionResult.providerRequestId,
      usage: completionResult.usage,
      latencyMs: Date.now() - requestStartedAt,
      contextMessageCount: contextMessages.length,
    })

    const state = await buildStateResponse({
      userId: authenticatedSession.user.id,
      locale,
      requestedSessionId: String(resolvedSession.activeSessionId),
    })

    return attachRefreshedAuthCookie(
      createAuthJsonResponse(withServerNow(sanitizeStateIdentity(state, locale))),
      authenticatedSession
    )
  } catch (error) {
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request).catch(() => null)
    const providerError = error instanceof NanoGptError ? error : null
    const runtimeError = error instanceof Error ? error : null
    const runtimeErrorCode = runtimeError?.name
      ? `lab_ai_chat_${runtimeError.name}`.slice(0, 64)
      : "chat_failed"
    const runtimeErrorMessage = runtimeError?.message?.slice(0, 255) || "Lab AI chat request failed."

    if (authenticatedSession) {
      await markDailyLabAiChatFailure({
        userId: authenticatedSession.user.id,
        sessionId: resolvedSessionId,
        locale,
        latencyMs: Date.now() - requestStartedAt,
        inputCharacters: message.length,
        messageCount: contextMessageCount,
        requestedModel: selectedModelId,
        errorCode: providerError?.code ?? runtimeErrorCode,
        errorMessage: providerError?.message ?? runtimeErrorMessage,
      }).catch((loggingError) => {
        console.error("Failed to record lab AI chat failure:", loggingError)
      })
    }

    console.error("Lab AI chat POST API failed:", error)
    const isGlobalLlmLimitError = providerError?.statusCode === 429
      && providerError.code === "global_daily_limit_reached"
    const status = isGlobalLlmLimitError
      ? 429
      : providerError
        ? 502
        : 500
    const errorMessage = isGlobalLlmLimitError
      ? getErrorMessage(locale, "globalLlmLimit")
      : providerError
        ? getErrorMessage(locale, "providerFailure")
        : getErrorMessage(locale, "unexpected")

    const response = createAuthJsonResponse(
      withServerNow({ error: errorMessage }),
      { status }
    )
    return authenticatedSession
      ? attachRefreshedAuthCookie(response, authenticatedSession)
      : response
  } finally {
    if (!lockReleased) {
      releaseChatUserLock(lockedUserId)
    }
  }
}

export const GET = withApiAnalytics(handleGET)
export const POST = withApiAnalytics(handlePOST)
