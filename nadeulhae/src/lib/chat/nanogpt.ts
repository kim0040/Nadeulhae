import {
  CHAT_COMPLETION_MAX_TOKENS,
  CHAT_PROVIDER_TIMEOUT_MS,
  CHAT_STREAMING_TIMEOUT_MS,
  CHAT_SUMMARY_MAX_TOKENS,
  CHAT_SUMMARY_PROVIDER_TIMEOUT_MS,
  FACTCHAT_MODELS_CACHE_TTL_MS,
  estimateTextTokens,
} from "@/lib/chat/constants"
import type { FactChatCompletionResult } from "@/lib/chat/types"
import {
  recordGlobalLlmRequestOutcome,
  reserveGlobalLlmDailyRequest,
} from "@/lib/llm/quota"

declare global {
  var __nadeulhaeChatNanoGptModelsCache:
    | {
      fetchedAt: number
      ids: string[]
    }
    | undefined
}

interface NanoGptErrorPayload {
  error?: {
    code?: string | number
    message?: string
  }
}

interface NanoGptModelPayload {
  data?: Array<{ id?: string }>
}

interface NanoGptCompletionPayload {
  id?: string
  model?: string
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    prompt_tokens_details?: {
      cached_tokens?: number
    }
  }
}

const DASHBOARD_CHAT_MODEL = "deepseek/deepseek-v4-flash"
const DASHBOARD_CHAT_FALLBACK_MODEL = "deepseek/deepseek-v4-pro"

export class NanoGptChatError extends Error {
  statusCode: number
  code: string | null

  constructor(message: string, statusCode: number, code?: string | null) {
    super(message)
    this.name = "NanoGptChatError"
    this.statusCode = statusCode
    this.code = code ?? null
  }
}

function requireNanoGptEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function getNanoGptBaseUrl() {
  return (process.env.NANOGPT_BASE_URL || "https://nano-gpt.com/api/v1").replace(/\/$/, "")
}

function buildNanoGptUrl(path: string) {
  return `${getNanoGptBaseUrl()}/${path.replace(/^\//, "")}`
}

function normalizeModelId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function extractAssistantText(content: unknown) {
  if (typeof content === "string") {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .flatMap((part) => {
        if (typeof part === "string") return [part]
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return [part.text]
        }
        return []
      })
      .join("\n")
      .trim()
  }

  return ""
}

function getGlobalLlmDailyLimit() {
  const raw = Number(process.env.LLM_GLOBAL_DAILY_LIMIT ?? "5000")
  if (!Number.isFinite(raw)) {
    return 5000
  }

  return Math.max(1, Math.floor(raw))
}

async function fetchJson<T>(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    })

    const json = await response.json().catch(() => ({}))
    return {
      response,
      json: json as T,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function listNanoGptModels() {
  const cache = globalThis.__nadeulhaeChatNanoGptModelsCache
  if (cache && Date.now() - cache.fetchedAt < FACTCHAT_MODELS_CACHE_TTL_MS) {
    return cache.ids
  }

  const { response, json } = await fetchJson<NanoGptModelPayload>(
    buildNanoGptUrl("models"),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${requireNanoGptEnv("NANOGPT_API_KEY")}`,
      },
      cache: "no-store",
    },
    CHAT_PROVIDER_TIMEOUT_MS
  )

  if (!response.ok) {
    const payload = json as NanoGptErrorPayload
    throw new NanoGptChatError(
      payload.error?.message ?? "Failed to fetch NanoGPT models.",
      response.status,
      payload.error?.code ? String(payload.error.code) : null
    )
  }

  const ids = (json.data ?? [])
    .map((item) => item.id?.trim())
    .filter((value): value is string => Boolean(value))

  globalThis.__nadeulhaeChatNanoGptModelsCache = {
    fetchedAt: Date.now(),
    ids,
  }

  return ids
}

function pickModelCandidate(preferred: string | null, available: string[]) {
  if (!preferred) {
    return null
  }

  const exact = available.find((modelId) => modelId === preferred)
  if (exact) {
    return exact
  }

  const normalizedPreferred = normalizeModelId(preferred)
  const normalizedExact = available.find((modelId) => normalizeModelId(modelId) === normalizedPreferred)
  if (normalizedExact) {
    return normalizedExact
  }

  return (
    available.find((modelId) => normalizeModelId(modelId).includes(normalizedPreferred))
    || available.find((modelId) => normalizedPreferred.includes(normalizeModelId(modelId)))
    || null
  )
}

async function resolveModelPair() {
  const available = await listNanoGptModels()
  if (available.length === 0) {
    throw new Error("No NanoGPT models are available for the current API key.")
  }

  const primary = pickModelCandidate(DASHBOARD_CHAT_MODEL, available) || available[0]
  const secondary = pickModelCandidate(DASHBOARD_CHAT_FALLBACK_MODEL, available) || null

  return {
    primary,
    secondary: secondary && secondary !== primary ? secondary : null,
  }
}

async function requestCompletion(input: {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  temperature: number
  maxTokens: number
  timeoutMs: number
}) {
  const reservation = await reserveGlobalLlmDailyRequest({
    limit: getGlobalLlmDailyLimit(),
  })
  if (!reservation.allowed) {
    throw new NanoGptChatError(
      "Global daily LLM request limit reached.",
      429,
      "global_daily_limit_reached"
    )
  }

  try {
    const { response, json } = await fetchJson<NanoGptCompletionPayload | NanoGptErrorPayload>(
      buildNanoGptUrl("chat/completions"),
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${requireNanoGptEnv("NANOGPT_API_KEY")}`,
        },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages,
          temperature: input.temperature,
          max_tokens: input.maxTokens,
        }),
        cache: "no-store",
      },
      input.timeoutMs
    )

    if (!response.ok) {
      const payload = json as NanoGptErrorPayload
      throw new NanoGptChatError(
        payload.error?.message ?? "NanoGPT request failed.",
        response.status,
        payload.error?.code ? String(payload.error.code) : null
      )
    }

    const payload = json as NanoGptCompletionPayload
    const content = extractAssistantText(payload.choices?.[0]?.message?.content)
    if (!content) {
      throw new NanoGptChatError("NanoGPT returned an empty response.", 502, "empty_content")
    }

    await recordGlobalLlmRequestOutcome({
      metricDate: reservation.usage.metricDate,
      success: true,
    }).catch((error) => {
      console.error("Failed to record global LLM success usage:", error)
    })

    return {
      providerRequestId: payload.id ?? null,
      resolvedModel: payload.model ?? input.model,
      content,
      usage: {
        promptTokens: Math.max(0, payload.usage?.prompt_tokens ?? 0),
        completionTokens: Math.max(0, payload.usage?.completion_tokens ?? 0),
        totalTokens: Math.max(0, payload.usage?.total_tokens ?? 0),
        cachedPromptTokens: Math.max(0, payload.usage?.prompt_tokens_details?.cached_tokens ?? 0),
      },
    }
  } catch (error) {
    await recordGlobalLlmRequestOutcome({
      metricDate: reservation.usage.metricDate,
      success: false,
    }).catch((recordError) => {
      console.error("Failed to record global LLM failure usage:", recordError)
    })
    throw error
  }
}

function shouldFallback(error: unknown) {
  if (!(error instanceof NanoGptChatError)) {
    return true
  }

  return ![401, 402].includes(error.statusCode)
}

export async function createNanoGptChatCompletion(input: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  requestKind: "chat" | "summary"
  maxTokens?: number
  temperature?: number
}): Promise<FactChatCompletionResult> {
  const models = await resolveModelPair()
  const timeoutMs = input.requestKind === "summary"
    ? CHAT_SUMMARY_PROVIDER_TIMEOUT_MS
    : CHAT_PROVIDER_TIMEOUT_MS
  const maxTokens = input.maxTokens ?? (input.requestKind === "summary"
    ? CHAT_SUMMARY_MAX_TOKENS
    : CHAT_COMPLETION_MAX_TOKENS)
  const temperature = input.temperature ?? (input.requestKind === "summary" ? 0.2 : 0.55)

  try {
    const primaryResult = await requestCompletion({
      model: models.primary,
      messages: input.messages,
      temperature,
      maxTokens,
      timeoutMs,
    })

    return {
      providerRequestId: primaryResult.providerRequestId,
      requestedModel: models.primary,
      resolvedModel: primaryResult.resolvedModel,
      content: primaryResult.content,
      usage: primaryResult.usage,
    }
  } catch (error) {
    if (!models.secondary || !shouldFallback(error)) {
      throw error
    }

    const fallbackResult = await requestCompletion({
      model: models.secondary,
      messages: input.messages,
      temperature,
      maxTokens,
      timeoutMs,
    })

    return {
      providerRequestId: fallbackResult.providerRequestId,
      requestedModel: models.secondary,
      resolvedModel: fallbackResult.resolvedModel,
      content: fallbackResult.content,
      usage: fallbackResult.usage,
    }
  }
}

async function requestCompletionStream(input: {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  temperature: number
  maxTokens: number
  timeoutMs: number
  onToken: (token: string) => void
}): Promise<FactChatCompletionResult> {
  const reservation = await reserveGlobalLlmDailyRequest({
    limit: getGlobalLlmDailyLimit(),
  })
  if (!reservation.allowed) {
    throw new NanoGptChatError(
      "Global daily LLM request limit reached.",
      429,
      "global_daily_limit_reached"
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs)

  try {
    const response = await fetch(buildNanoGptUrl("chat/completions"), {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        Authorization: `Bearer ${requireNanoGptEnv("NANOGPT_API_KEY")}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        stream: true,
      }),
      cache: "no-store",
      signal: controller.signal,
    })

    if (!response.ok) {
      let errorPayload: NanoGptErrorPayload = {}
      try {
        errorPayload = await response.json()
      } catch {}
      throw new NanoGptChatError(
        errorPayload.error?.message ?? "NanoGPT request failed.",
        response.status,
        errorPayload.error?.code ? String(errorPayload.error.code) : null
      )
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new NanoGptChatError("No response body for streaming.", 502, "no_body")
    }

    const decoder = new TextDecoder()
    let accumulated = ""
    let buffer = ""
    let providerRequestId: string | null = null
    let resolvedModel = input.model

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split("\n\n")
      buffer = parts.pop() ?? ""

      for (const part of parts) {
        for (const rawLine of part.split("\n")) {
          const trimmed = rawLine.trim()
          if (!trimmed.startsWith("data: ")) {
            continue
          }

          const data = trimmed.slice(6)
          if (data === "[DONE]") {
            continue
          }

          try {
            const parsed = JSON.parse(data) as {
              id?: string
              model?: string
              choices?: Array<{
                delta?: {
                  content?: string
                }
              }>
            }
            providerRequestId = parsed.id ?? providerRequestId
            resolvedModel = parsed.model ?? resolvedModel

            const token = typeof parsed.choices?.[0]?.delta?.content === "string"
              ? parsed.choices[0].delta.content
              : ""

            if (!token) {
              continue
            }

            accumulated += token
            input.onToken(token)
          } catch {}
        }
      }
    }

    await reader.cancel()

    await recordGlobalLlmRequestOutcome({
      metricDate: reservation.usage.metricDate,
      success: true,
    }).catch((error) => {
      console.error("Failed to record global LLM success usage:", error)
    })

    if (!accumulated.trim()) {
      throw new NanoGptChatError("NanoGPT returned an empty streaming response.", 502, "empty_content")
    }

    return {
      providerRequestId,
      requestedModel: input.model,
      resolvedModel,
      content: accumulated,
      usage: {
        promptTokens: 0,
        completionTokens: Math.max(1, estimateTextTokens(accumulated)),
        totalTokens: Math.max(1, estimateTextTokens(accumulated)),
        cachedPromptTokens: 0,
      },
    }
  } catch (error) {
    await recordGlobalLlmRequestOutcome({
      metricDate: reservation.usage.metricDate,
      success: false,
    }).catch((recordError) => {
      console.error("Failed to record global LLM failure usage:", recordError)
    })
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function createNanoGptChatCompletionStream(
  input: {
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
    requestKind: "chat" | "summary"
    onToken: (token: string) => void
  }
): Promise<FactChatCompletionResult> {
  const models = await resolveModelPair()
  const timeoutMs = input.requestKind === "summary"
    ? CHAT_SUMMARY_PROVIDER_TIMEOUT_MS
    : CHAT_STREAMING_TIMEOUT_MS
  const maxTokens = input.requestKind === "summary"
    ? CHAT_SUMMARY_MAX_TOKENS
    : CHAT_COMPLETION_MAX_TOKENS
  const temperature = input.requestKind === "summary" ? 0.2 : 0.55

  try {
    const primaryResult = await requestCompletionStream({
      model: models.primary,
      messages: input.messages,
      temperature,
      maxTokens,
      timeoutMs,
      onToken: input.onToken,
    })

    return {
      providerRequestId: primaryResult.providerRequestId,
      requestedModel: models.primary,
      resolvedModel: primaryResult.resolvedModel,
      content: primaryResult.content,
      usage: primaryResult.usage,
    }
  } catch (error) {
    if (!models.secondary || !shouldFallback(error)) {
      throw error
    }

    const fallbackResult = await requestCompletionStream({
      model: models.secondary,
      messages: input.messages,
      temperature,
      maxTokens,
      timeoutMs,
      onToken: input.onToken,
    })

    return {
      providerRequestId: fallbackResult.providerRequestId,
      requestedModel: models.secondary,
      resolvedModel: fallbackResult.resolvedModel,
      content: fallbackResult.content,
      usage: fallbackResult.usage,
    }
  }
}
