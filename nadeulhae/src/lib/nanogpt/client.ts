import {
  LAB_AI_CHAT_PROVIDER_TIMEOUT_MS,
  LAB_AI_CHAT_STREAMING_TIMEOUT_MS,
  LAB_AI_CHAT_SUMMARY_MAX_TOKENS,
  LAB_AI_CHAT_SUMMARY_PROVIDER_TIMEOUT_MS,
  LAB_AI_CHAT_COMPLETION_MAX_TOKENS,
  NANOGPT_MODELS_CACHE_TTL_MS,
  estimateLabAiChatTokens,
} from "@/lib/lab-ai-chat/constants"
import type {
  LabAiChatModelOption,
  NanoGptCompletionResult,
  NanoGptUsage,
} from "@/lib/lab-ai-chat/types"
import {
  recordGlobalLlmRequestOutcome,
  reserveGlobalLlmDailyRequest,
} from "@/lib/llm/quota"

declare global {
  var __nadeulhaeNanoGptModelsCache:
    | {
      fetchedAt: number
      ids: string[]
      allowed: LabAiChatModelOption[]
    }
    | undefined
}

interface NanoGptErrorPayload {
  error?: {
    code?: string | number
    message?: string
  }
}

interface NanoGptModelsPayload {
  data?: Array<{ id?: string }>
}

interface NanoGptCompletionPayload {
  id?: string
  model?: string
  choices?: Array<{
    finish_reason?: unknown
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

type AllowedModelSpec = {
  slug: string
  label: string
  description: string
  candidates: string[]
  thinkingCandidates?: string[]
}

const ALLOWED_MODEL_SPECS: AllowedModelSpec[] = [
  {
    slug: "deepseek-v3-2",
    label: "DeepSeek V3.2",
    description: "빠른 범용 대화와 코딩·분석 작업에 균형이 좋아요.",
    candidates: [
      "deepseek/deepseek-v3.2",
      "TEE/deepseek-v3.2",
      "deepseek-ai/deepseek-v3.2-exp",
    ],
    thinkingCandidates: [
      "deepseek/deepseek-v3.2:thinking",
      "deepseek-ai/deepseek-v3.2-exp-thinking",
      "deepseek-r1",
      "deepseek-reasoner",
    ],
  },
  {
    slug: "kimi-k2-5",
    label: "Kimi K2.5",
    description: "긴 문서와 복잡한 맥락을 이어가는 작업에 적합해요.",
    candidates: [
      "moonshotai/kimi-k2.5",
      "TEE/kimi-k2.5",
    ],
    thinkingCandidates: [
      "moonshotai/kimi-k2.5:thinking",
      "moonshotai/kimi-k2.5-thinking",
      "moonshotai/kimi-k2-thinking",
    ],
  },
  {
    slug: "qwen-3-5",
    label: "Qwen 3.5",
    description: "다국어 대화와 일반 지식·코딩 보조에 강해요.",
    candidates: [
      "qwen/qwen3.5-397b-a17b",
      "TEE/qwen3.5-397b-a17b",
      "qwen/qwen3.5-plus",
      "qwen3.5-27b",
    ],
    thinkingCandidates: [
      "qwen/qwen3.5-397b-a17b-thinking",
      "qwen3.5-27b:thinking",
    ],
  },
  {
    slug: "glm-5",
    label: "GLM 5",
    description: "간결한 답변과 실무형 정리·작성에 안정적이에요.",
    candidates: [
      "zai-org/glm-5",
      "TEE/glm-5",
      "z-ai/glm-5-turbo",
    ],
    thinkingCandidates: [
      "zai-org/glm-5:thinking",
    ],
  },
  {
    slug: "minimax-m2-7",
    label: "MiniMax M2.7",
    description: "긴 맥락 대화와 창작·요약을 부드럽게 이어가요.",
    candidates: [
      "minimax/minimax-m2.7",
      "minimax/minimax-m2.7-turbo",
    ],
  },
  {
    slug: "gpt-oss-120b",
    label: "GPT-OSS 120B",
    description: "큰 오픈 모델로 깊이 있는 추론과 코딩 분석에 적합해요.",
    candidates: [
      "openai/gpt-oss-120b",
      "TEE/gpt-oss-120b",
    ],
  },
  {
    slug: "gpt-oss-20b",
    label: "GPT-OSS 20B",
    description: "가벼운 오픈 모델로 빠른 답변과 일상 작업에 적합해요.",
    candidates: [
      "openai/gpt-oss-20b",
      "TEE/gpt-oss-20b",
    ],
  },
  {
    slug: "gemma-4",
    label: "Gemma 4",
    description: "가벼운 범용 모델로 짧은 질의와 빠른 초안 작성에 좋아요.",
    candidates: [
      "google/gemma-4-31b-it",
      "TEE/gemma4-31b",
      "google/gemma-4-26b-a4b-it",
    ],
    thinkingCandidates: [
      "google/gemma-4-31b-it:thinking",
      "google/gemma-4-26b-a4b-it:thinking",
    ],
  },
]

export class NanoGptError extends Error {
  statusCode: number
  code: string | null

  constructor(message: string, statusCode: number, code?: string | null) {
    super(message)
    this.name = "NanoGptError"
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

function normalizeFinishReason(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
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

function pickModelCandidate(preferred: string, available: string[]) {
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

async function listNanoGptModelIds() {
  const cache = globalThis.__nadeulhaeNanoGptModelsCache
  if (cache && Date.now() - cache.fetchedAt < NANOGPT_MODELS_CACHE_TTL_MS) {
    return cache.ids
  }

  const { response, json } = await fetchJson<NanoGptModelsPayload>(
    buildNanoGptUrl("models"),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${requireNanoGptEnv("NANOGPT_API_KEY")}`,
      },
      cache: "no-store",
    },
    LAB_AI_CHAT_PROVIDER_TIMEOUT_MS
  )

  if (!response.ok) {
    const payload = json as NanoGptErrorPayload
    throw new NanoGptError(
      payload.error?.message ?? "Failed to fetch NanoGPT models.",
      response.status,
      payload.error?.code ? String(payload.error.code) : null
    )
  }

  const ids = (json.data ?? [])
    .map((item) => item.id?.trim())
    .filter((value): value is string => Boolean(value))

  globalThis.__nadeulhaeNanoGptModelsCache = {
    fetchedAt: Date.now(),
    ids,
    allowed: cache?.allowed ?? [],
  }

  return ids
}

export async function resolveAllowedNanoGptModels() {
  const cache = globalThis.__nadeulhaeNanoGptModelsCache
  if (cache && Date.now() - cache.fetchedAt < NANOGPT_MODELS_CACHE_TTL_MS && cache.allowed.length > 0) {
    return cache.allowed
  }

  const available = await listNanoGptModelIds()
  const allowed = ALLOWED_MODEL_SPECS.flatMap((spec) => {
    const matched = spec.candidates
      .map((candidate) => pickModelCandidate(candidate, available))
      .find((value): value is string => Boolean(value))

    if (!matched) {
      return []
    }

    const thinkingMatched = spec.thinkingCandidates
      ?.map((candidate) => pickModelCandidate(candidate, available))
      ?.find((value): value is string => Boolean(value))

    return [{
      id: matched,
      slug: spec.slug,
      label: spec.label,
      description: spec.description,
      thinkingId: thinkingMatched,
    } satisfies LabAiChatModelOption]
  })

  if (allowed.length === 0) {
    throw new Error("No allowed NanoGPT models are available for the configured API key.")
  }

  globalThis.__nadeulhaeNanoGptModelsCache = {
    fetchedAt: Date.now(),
    ids: available,
    allowed,
  }

  return allowed
}

export function resolveRequestedNanoGptModel(
  allowedModels: LabAiChatModelOption[],
  requestedModel: string | null | undefined
) {
  const normalizedRequested = typeof requestedModel === "string" ? requestedModel.trim() : ""
  if (!normalizedRequested) {
    return allowedModels[0]
  }

  return allowedModels.find((item) => 
    item.id === normalizedRequested || 
    item.slug === normalizedRequested || 
    item.thinkingId === normalizedRequested
  ) ?? allowedModels[0]
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
    throw new NanoGptError(
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
          stream: false,
        }),
        cache: "no-store",
      },
      input.timeoutMs
    )

    if (!response.ok) {
      const payload = json as NanoGptErrorPayload
      throw new NanoGptError(
        payload.error?.message ?? "NanoGPT request failed.",
        response.status,
        payload.error?.code ? String(payload.error.code) : null
      )
    }

    const payload = json as NanoGptCompletionPayload
    const firstChoice = payload.choices?.[0]
    const content = extractAssistantText(firstChoice?.message?.content)
    if (!content) {
      throw new NanoGptError("NanoGPT returned an empty response.", 502, "empty_content")
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
      finishReason: normalizeFinishReason(firstChoice?.finish_reason),
      usage: {
        promptTokens: Math.max(0, payload.usage?.prompt_tokens ?? 0),
        completionTokens: Math.max(0, payload.usage?.completion_tokens ?? 0),
        totalTokens: Math.max(0, payload.usage?.total_tokens ?? 0),
        cachedPromptTokens: Math.max(0, payload.usage?.prompt_tokens_details?.cached_tokens ?? 0),
      } satisfies NanoGptUsage,
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
  if (!(error instanceof NanoGptError)) {
    return true
  }

  return ![401, 402].includes(error.statusCode)
}

export async function createNanoGptCompletion(input: {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  requestKind: "chat" | "summary"
}): Promise<NanoGptCompletionResult> {
  const timeoutMs = input.requestKind === "summary"
    ? LAB_AI_CHAT_SUMMARY_PROVIDER_TIMEOUT_MS
    : LAB_AI_CHAT_PROVIDER_TIMEOUT_MS
  const maxTokens = input.requestKind === "summary"
    ? LAB_AI_CHAT_SUMMARY_MAX_TOKENS
    : LAB_AI_CHAT_COMPLETION_MAX_TOKENS
  const temperature = input.requestKind === "summary" ? 0.2 : 0.55

  const primaryResult = await requestCompletion({
    model: input.model,
    messages: input.messages,
    temperature,
    maxTokens,
    timeoutMs,
  })

  return {
    providerRequestId: primaryResult.providerRequestId,
    requestedModel: input.model,
    resolvedModel: primaryResult.resolvedModel,
    content: primaryResult.content,
    finishReason: primaryResult.finishReason,
    usage: primaryResult.usage,
  }
}

async function requestCompletionStream(input: {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  temperature: number
  maxTokens: number
  timeoutMs: number
  onToken: (token: string) => void
}) {
  const reservation = await reserveGlobalLlmDailyRequest({
    limit: getGlobalLlmDailyLimit(),
  })
  if (!reservation.allowed) {
    throw new NanoGptError(
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
      throw new NanoGptError(
        errorPayload.error?.message ?? "NanoGPT request failed.",
        response.status,
        errorPayload.error?.code ? String(errorPayload.error.code) : null
      )
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new NanoGptError("No response body for streaming.", 502, "no_body")
    }

    const decoder = new TextDecoder()
    let accumulated = ""
    let buffer = ""
    let providerRequestId: string | null = null
    let resolvedModel: string | null = input.model
    let finishReason: string | null = null

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
                finish_reason?: unknown
                delta?: {
                  content?: string
                }
              }>
            }
            providerRequestId = parsed.id ?? providerRequestId
            resolvedModel = parsed.model ?? resolvedModel
            finishReason = normalizeFinishReason(parsed.choices?.[0]?.finish_reason) ?? finishReason

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
      throw new NanoGptError("NanoGPT returned an empty streaming response.", 502, "empty_content")
    }

    return {
      providerRequestId,
      requestedModel: input.model,
      resolvedModel: resolvedModel ?? input.model,
      content: accumulated,
      finishReason,
      usage: {
        promptTokens: 0,
        completionTokens: Math.max(1, estimateLabAiChatTokens(accumulated)),
        totalTokens: Math.max(1, estimateLabAiChatTokens(accumulated)),
        cachedPromptTokens: 0,
      } satisfies NanoGptUsage,
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

export async function createNanoGptCompletionStream(input: {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  requestKind: "chat" | "summary"
  onToken: (token: string) => void
}): Promise<NanoGptCompletionResult> {
  const timeoutMs = input.requestKind === "summary"
    ? LAB_AI_CHAT_SUMMARY_PROVIDER_TIMEOUT_MS
    : LAB_AI_CHAT_STREAMING_TIMEOUT_MS
  const maxTokens = input.requestKind === "summary"
    ? LAB_AI_CHAT_SUMMARY_MAX_TOKENS
    : LAB_AI_CHAT_COMPLETION_MAX_TOKENS
  const temperature = input.requestKind === "summary" ? 0.2 : 0.55

  try {
    return await requestCompletionStream({
      model: input.model,
      messages: input.messages,
      temperature,
      maxTokens,
      timeoutMs,
      onToken: input.onToken,
    })
  } catch (error) {
    if (!shouldFallback(error)) {
      throw error
    }
    throw error
  }
}
