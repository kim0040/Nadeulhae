/**
 * Lab-specific LLM Chat Wrapper
 *
 * General-purpose AI assistant client with curated model selection,
 * reasoning-effort control, and daily quota enforcement.
 * Uses the official DeepSeek API (OpenAI-compatible) for all lab chat
 * completions, limited to the V4 Pro and V4 Flash models exposed by
 * the configured API key.
 */
import type { LlmCompletionResult, LlmRequestKind, LlmConfig, LlmModelOption } from "@/lib/llm/types"
import {
  OpenAiClientError,
  fetchModels,
  pickModelCandidate,
  requestCompletion,
  requestCompletionStream,
} from "@/lib/llm/openai-client"
import {
  recordGlobalLlmRequestOutcome,
  reserveGlobalLlmDailyRequest,
} from "@/lib/llm/quota"

declare global {
  var __nadeulhaeLabLlmModelsCache:
    | { fetchedAt: number; ids: string[]; allowed: LlmModelOption[] }
    | undefined
}

const MODELS_CACHE_TTL_MS = 15 * 60 * 1000
const PROVIDER_TIMEOUT_MS = 120_000
const STREAMING_TIMEOUT_MS = 480_000
const SUMMARY_PROVIDER_TIMEOUT_MS = 90_000
const COMPLETION_MAX_TOKENS = 8000
const SUMMARY_MAX_TOKENS = 1600

/** Internal spec for an allowed lab model. Defines slug, display info, candidate model IDs, and reasoning support. */
type AllowedModelSpec = {
  slug: string
  label: string
  description: string
  warning?: string
  candidates: string[]
  quantization?: string
  reasoningEffort: boolean
}

const ALLOWED_MODEL_SPECS: AllowedModelSpec[] = [
  {
    slug: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    description: "DeepSeek 공식 플래그십. 1.6T MoE (49B 활성)·하이브리드 어텐션으로 1M 컨텍스트 처리. 코딩·복잡한 추론·장기 워크플로에 최상위 성능. 사고 모드 지원.",
    candidates: ["deepseek-v4-pro", "deepseek-reasoner"],
    quantization: "FP4+FP8 혼합",
    reasoningEffort: true,
  },
  {
    slug: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    description: "DeepSeek 경량 모델. 292B MoE (158B 활성)·V4 Pro 대비 1/10 비용으로 근접 성능. 빠른 응답과 효율적인 토큰 처리. 일상 코딩·고처리량 워크로드에 최적. 사고 모드 지원.",
    candidates: ["deepseek-v4-flash", "deepseek-chat"],
    quantization: "FP8",
    reasoningEffort: true,
  },
]

/** Error class for lab chat LLM failures. Distinguishes lab errors from general chat or other OpenAI client errors. */
export class LabChatError extends OpenAiClientError {
  constructor(message: string, statusCode: number, code?: string | null) {
    super(message, statusCode, code)
    this.name = "LabChatError"
  }
}

/** Resolves the API key from LAB_LLM_* env vars, falling back to LLM_* and legacy NANOGPT_* keys. */
function resolveApiKey(): string {
  return (
    process.env.LAB_LLM_API_KEY
    || process.env.LLM_API_KEY
    || process.env.NANOGPT_API_KEY
    || (() => { throw new Error("Missing LAB_LLM_API_KEY (or NANOGPT_API_KEY)") })()
  )
}

/** Resolves the base URL. Defaults to the official DeepSeek API v1 endpoint. */
function resolveBaseUrl(): string {
  return (
    process.env.LAB_LLM_BASE_URL
    || process.env.LLM_BASE_URL
    || "https://api.deepseek.com/v1"
  ).replace(/\/$/, "")
}

/** Reads the global daily request limit from the environment. Defaults to 5000. */
function getGlobalDailyLimit() {
  const raw = Number(
    process.env.LAB_LLM_GLOBAL_DAILY_LIMIT
    ?? process.env.LLM_GLOBAL_DAILY_LIMIT
    ?? "5000"
  )
  return Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : 5000
}

/** Builds an LlmConfig from environment variables. Model is left empty because lab-llm resolves models dynamically. */
function getConfig(): LlmConfig {
  return {
    apiKey: resolveApiKey(),
    baseUrl: resolveBaseUrl(),
    model: "",
  }
}

/** Fetches and caches available model IDs from the API. Cache TTL is 15 minutes. */
async function listModelIds() {
  const cache = globalThis.__nadeulhaeLabLlmModelsCache
  if (cache && Date.now() - cache.fetchedAt < MODELS_CACHE_TTL_MS) {
    return cache.ids
  }
  const ids = await fetchModels(getConfig(), PROVIDER_TIMEOUT_MS)
  globalThis.__nadeulhaeLabLlmModelsCache = { fetchedAt: Date.now(), ids, allowed: cache?.allowed ?? [] }
  return ids
}

/**
 * Resolves the list of allowed lab models by matching curated model specs
 * against models available from the API. Only specs with at least one
 * matching candidate are included. Results are cached globally.
 */
export async function resolveAllowedLabModels(): Promise<LlmModelOption[]> {
  const cache = globalThis.__nadeulhaeLabLlmModelsCache
  if (cache && Date.now() - cache.fetchedAt < MODELS_CACHE_TTL_MS && cache.allowed.length > 0) {
    return cache.allowed
  }

  const available = await listModelIds()
  // Match each spec's candidates against available models; pick the first match per spec
  const allowed = ALLOWED_MODEL_SPECS.flatMap((spec): LlmModelOption[] => {
    const matched = spec.candidates
      .map((candidate) => pickModelCandidate(candidate, available))
      .find((value): value is string => Boolean(value))
    if (!matched) return []

    return [{
      id: matched,
      slug: spec.slug,
      label: spec.label,
      description: spec.description,
      warning: spec.warning,
      quantization: spec.quantization,
      reasoningEffort: spec.reasoningEffort,
    }]
  })

  if (allowed.length === 0) {
    throw new Error("No allowed models are available for the configured API key.")
  }

  globalThis.__nadeulhaeLabLlmModelsCache = { fetchedAt: Date.now(), ids: available, allowed }
  return allowed
}

/**
 * Resolves a user-requested model to an allowed LlmModelOption. Matches by
 * exact model ID or slug. Falls back to the first available model if no
 * match is found or the input is empty.
 */
export function resolveRequestedLabModel(
  allowedModels: LlmModelOption[],
  requestedModel: string | null | undefined
): LlmModelOption {
  const normalized = typeof requestedModel === "string" ? requestedModel.trim() : ""
  if (!normalized) return allowedModels[0]
  return allowedModels.find((item) =>
    item.id === normalized || item.slug === normalized
  ) ?? allowedModels[0]
}

/**
 * Executes a non-streaming lab LLM completion with daily quota reservation.
 * Reserves a global quota slot before the API call and records outcome after.
 */
async function doCompletion(input: {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  temperature: number
  maxTokens: number
  timeoutMs: number
  reasoningEffort?: string
}) {
  const reservation = await reserveGlobalLlmDailyRequest({ limit: getGlobalDailyLimit() })
  if (!reservation.allowed) {
    throw new LabChatError("Global daily LLM request limit reached.", 429, "global_daily_limit_reached")
  }
  try {
    const result = await requestCompletion(
      { ...getConfig(), model: input.model },
      { messages: input.messages, temperature: input.temperature, maxTokens: input.maxTokens, timeoutMs: input.timeoutMs, reasoningEffort: input.reasoningEffort }
    )
    await recordGlobalLlmRequestOutcome({ metricDate: reservation.usage.metricDate, success: true }).catch(() => {})
    return result
  } catch (error) {
    await recordGlobalLlmRequestOutcome({ metricDate: reservation.usage.metricDate, success: false }).catch(() => {})
    throw error
  }
}

/**
 * Executes a streaming lab LLM completion with daily quota reservation.
 * Same quota flow as doCompletion but uses the streaming API path.
 */
async function doCompletionStream(input: {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  temperature: number
  maxTokens: number
  timeoutMs: number
  reasoningEffort?: string
  onToken: (token: string) => void
}) {
  const reservation = await reserveGlobalLlmDailyRequest({ limit: getGlobalDailyLimit() })
  if (!reservation.allowed) {
    throw new LabChatError("Global daily LLM request limit reached.", 429, "global_daily_limit_reached")
  }
  try {
    const result = await requestCompletionStream(
      { ...getConfig(), model: input.model },
      { messages: input.messages, temperature: input.temperature, maxTokens: input.maxTokens, timeoutMs: input.timeoutMs, reasoningEffort: input.reasoningEffort, onToken: input.onToken }
    )
    await recordGlobalLlmRequestOutcome({ metricDate: reservation.usage.metricDate, success: true }).catch(() => {})
    return result
  } catch (error) {
    await recordGlobalLlmRequestOutcome({ metricDate: reservation.usage.metricDate, success: false }).catch(() => {})
    throw error
  }
}

/**
 * Creates a lab chat completion using the specified model. Adjusts timeouts,
 * max tokens, and temperature based on request kind. Optionally enables
 * reasoning_effort for models that support it.
 */
export async function createLabChatCompletion(input: {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  requestKind: LlmRequestKind
  reasoningEffort?: string
}): Promise<LlmCompletionResult> {
  // Summary requests: shorter timeout, fewer tokens, lower temperature for deterministic output
  const timeoutMs = input.requestKind === "summary" ? SUMMARY_PROVIDER_TIMEOUT_MS : PROVIDER_TIMEOUT_MS
  const maxTokens = input.requestKind === "summary" ? SUMMARY_MAX_TOKENS : COMPLETION_MAX_TOKENS
  const temperature = input.requestKind === "summary" ? 0.2 : 0.55

  const result = await doCompletion({ model: input.model, messages: input.messages, temperature, maxTokens, timeoutMs, reasoningEffort: input.reasoningEffort })
  return { ...result, requestedModel: input.model }
}

/**
 * Creates a streaming lab chat completion using the specified model.
 * Same parameter selection as createLabChatCompletion but uses SSE streaming.
 */
export async function createLabChatCompletionStream(input: {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  requestKind: LlmRequestKind
  reasoningEffort?: string
  onToken: (token: string) => void
}): Promise<LlmCompletionResult> {
  const timeoutMs = input.requestKind === "summary" ? SUMMARY_PROVIDER_TIMEOUT_MS : STREAMING_TIMEOUT_MS
  const maxTokens = input.requestKind === "summary" ? SUMMARY_MAX_TOKENS : COMPLETION_MAX_TOKENS
  const temperature = input.requestKind === "summary" ? 0.2 : 0.55

  const result = await doCompletionStream({ model: input.model, messages: input.messages, temperature, maxTokens, timeoutMs, reasoningEffort: input.reasoningEffort, onToken: input.onToken })
  return { ...result, requestedModel: input.model }
}
