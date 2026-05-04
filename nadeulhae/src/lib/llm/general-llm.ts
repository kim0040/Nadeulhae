/**
 * General-purpose LLM Chat Wrapper
 *
 * Weather-chat-oriented LLM client with automatic model fallback, daily
 * quota enforcement, and an in-memory model list cache. Supports both
 * regular chat and content summarisation (e.g. weather descriptions).
 * On primary model failure, automatically retries with a configured
 * secondary model unless the error is auth/payment-related.
 */
import type { LlmCompletionResult, LlmRequestKind, LlmConfig } from "@/lib/llm/types"
export { OpenAiClientError } from "@/lib/llm/openai-client"
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
  var __nadeulhaeGeneralLlmModelsCache:
    | { fetchedAt: number; ids: string[] }
    | undefined
}

const MODELS_CACHE_TTL_MS = 15 * 60 * 1000
const PROVIDER_TIMEOUT_MS = 30_000
const STREAMING_TIMEOUT_MS = 120_000
const SUMMARY_PROVIDER_TIMEOUT_MS = 25_000
const COMPLETION_MAX_TOKENS = 720
const SUMMARY_MAX_TOKENS = 360

/**
 * Error class for general chat LLM failures. Distinguishes general chat
 * errors from other OpenAiClientError subtypes.
 */
export class GeneralChatError extends OpenAiClientError {
  constructor(message: string, statusCode: number, code?: string | null) {
    super(message, statusCode, code)
    this.name = "GeneralChatError"
  }
}

/** Resolves the API key from GENERAL_LLM_* env vars, falling back to LLM_* and legacy NANOGPT_* keys. */
function resolveApiKey(): string {
  return (
    process.env.GENERAL_LLM_API_KEY
    || process.env.LLM_API_KEY
    || process.env.NANOGPT_API_KEY
    || (() => { throw new Error("Missing GENERAL_LLM_API_KEY (or NANOGPT_API_KEY)") })()
  )
}

/** Resolves the base URL. Defaults to the Nano-GPT API v1 endpoint. */
function resolveBaseUrl(): string {
  return (
    process.env.GENERAL_LLM_BASE_URL
    || process.env.LLM_BASE_URL
    || process.env.NANOGPT_BASE_URL
    || "https://nano-gpt.com/api/v1"
  ).replace(/\/$/, "")
}

/** Resolves the primary (preferred) model ID from the environment. */
function resolvePrimaryModel(): string {
  return process.env.GENERAL_LLM_MODEL || process.env.LLM_MODEL || "deepseek/deepseek-v4-flash"
}

/** Resolves the fallback model ID, used when the primary model fails. */
function resolveFallbackModel(): string {
  return process.env.GENERAL_LLM_FALLBACK_MODEL || process.env.LLM_FALLBACK_MODEL || "deepseek/deepseek-v4-pro"
}

/** Reads the global daily request limit from the environment. Defaults to 5000. */
function getGlobalDailyLimit() {
  const raw = Number(
    process.env.GENERAL_LLM_GLOBAL_DAILY_LIMIT
    ?? process.env.LLM_GLOBAL_DAILY_LIMIT
    ?? "5000"
  )
  return Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : 5000
}

/** Builds an LlmConfig from environment variables and defaults. */
function getConfig(): LlmConfig {
  return {
    apiKey: resolveApiKey(),
    baseUrl: resolveBaseUrl(),
    model: resolvePrimaryModel(),
    fallbackModel: resolveFallbackModel(),
  }
}

/** Fetches and caches the available model list. Cache TTL is 15 minutes. */
async function listModels() {
  // Return cached list if still fresh; otherwise re-fetch from the API
  const cache = globalThis.__nadeulhaeGeneralLlmModelsCache
  if (cache && Date.now() - cache.fetchedAt < MODELS_CACHE_TTL_MS) {
    return cache.ids
  }
  const ids = await fetchModels(getConfig(), PROVIDER_TIMEOUT_MS)
  globalThis.__nadeulhaeGeneralLlmModelsCache = { fetchedAt: Date.now(), ids }
  return ids
}

/**
 * Resolves primary and optional fallback model IDs, matching against the
 * available models list. Uses the first available model if primary is
 * not found; secondary must differ from primary to be useful.
 */
async function resolveModelPair() {
  const available = await listModels()
  if (available.length === 0) {
    throw new Error("No models are available for the configured API key.")
  }
  const primary = pickModelCandidate(resolvePrimaryModel(), available) || available[0]
  const secondary = pickModelCandidate(resolveFallbackModel(), available) || null
  return {
    // Use primary if available, otherwise the first available model
    primary,
    // Secondary must differ from primary to provide meaningful fallback
    secondary: secondary && secondary !== primary ? secondary : null,
  }
}

/**
 * Determines whether to attempt a fallback model. Skips fallback on
 * 401/402 errors (auth/payment) since those would also fail on the
 * secondary model.
 */
function shouldFallback(error: unknown) {
  if (!(error instanceof OpenAiClientError)) return true
  return ![401, 402].includes(error.statusCode)
}

/**
 * Executes a non-streaming LLM completion with daily quota reservation.
 * Reserves a global quota slot before the API call and records success
 * or failure outcome after the call completes.
 */
async function doCompletion(input: {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  temperature: number
  maxTokens: number
  timeoutMs: number
}) {
  // Reserve a quota slot before the API call to fail fast if daily limit is exhausted
  const reservation = await reserveGlobalLlmDailyRequest({ limit: getGlobalDailyLimit() })
  if (!reservation.allowed) {
    throw new GeneralChatError("Global daily LLM request limit reached.", 429, "global_daily_limit_reached")
  }
  try {
    const result = await requestCompletion(
      { ...getConfig(), model: input.model },
      { messages: input.messages, temperature: input.temperature, maxTokens: input.maxTokens, timeoutMs: input.timeoutMs }
    )
    await recordGlobalLlmRequestOutcome({ metricDate: reservation.usage.metricDate, success: true }).catch(() => {})
    return result
  } catch (error) {
    await recordGlobalLlmRequestOutcome({ metricDate: reservation.usage.metricDate, success: false }).catch(() => {})
    throw error
  }
}

/**
 * Executes a streaming LLM completion with daily quota reservation.
 * Same quota flow as doCompletion but uses the streaming API path.
 */
async function doCompletionStream(input: {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  temperature: number
  maxTokens: number
  timeoutMs: number
  onToken: (token: string) => void
}) {
  const reservation = await reserveGlobalLlmDailyRequest({ limit: getGlobalDailyLimit() })
  if (!reservation.allowed) {
    throw new GeneralChatError("Global daily LLM request limit reached.", 429, "global_daily_limit_reached")
  }
  try {
    const result = await requestCompletionStream(
      { ...getConfig(), model: input.model },
      { messages: input.messages, temperature: input.temperature, maxTokens: input.maxTokens, timeoutMs: input.timeoutMs, onToken: input.onToken }
    )
    await recordGlobalLlmRequestOutcome({ metricDate: reservation.usage.metricDate, success: true }).catch(() => {})
    return result
  } catch (error) {
    await recordGlobalLlmRequestOutcome({ metricDate: reservation.usage.metricDate, success: false }).catch(() => {})
    throw error
  }
}

/**
 * Creates a general-purpose chat completion with automatic model fallback.
 * Selects primary/secondary models, timeouts, tokens, and temperature based
 * on request kind. On primary failure, retries with the fallback model if
 * the error type allows it (skips fallback on auth/payment errors).
 */
export async function createGeneralChatCompletion(input: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  requestKind: LlmRequestKind
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
}): Promise<LlmCompletionResult> {
  const models = await resolveModelPair()
  // Summary requests use shorter timeouts, fewer max tokens, and lower temperature (more deterministic output)
  const timeoutMs = input.timeoutMs ?? (input.requestKind === "summary" ? SUMMARY_PROVIDER_TIMEOUT_MS : PROVIDER_TIMEOUT_MS)
  const maxTokens = input.maxTokens ?? (input.requestKind === "summary" ? SUMMARY_MAX_TOKENS : COMPLETION_MAX_TOKENS)
  const temperature = input.temperature ?? (input.requestKind === "summary" ? 0.2 : 0.55)

  try {
    const result = await doCompletion({ model: models.primary, messages: input.messages, temperature, maxTokens, timeoutMs })
    return { ...result, requestedModel: models.primary }
  } catch (error) {
    if (!models.secondary || !shouldFallback(error)) throw error
    const fallbackResult = await doCompletion({ model: models.secondary, messages: input.messages, temperature, maxTokens, timeoutMs })
    return { ...fallbackResult, requestedModel: models.secondary }
  }
}

/**
 * Creates a streaming general-purpose chat completion with fallback.
 * Same fallback and parameter selection as createGeneralChatCompletion
 * but uses SSE streaming for progressive token delivery.
 */
export async function createGeneralChatCompletionStream(input: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  requestKind: LlmRequestKind
  onToken: (token: string) => void
}): Promise<LlmCompletionResult> {
  const models = await resolveModelPair()
  const timeoutMs = input.requestKind === "summary" ? SUMMARY_PROVIDER_TIMEOUT_MS : STREAMING_TIMEOUT_MS
  const maxTokens = input.requestKind === "summary" ? SUMMARY_MAX_TOKENS : COMPLETION_MAX_TOKENS
  const temperature = input.requestKind === "summary" ? 0.2 : 0.55

  try {
    const result = await doCompletionStream({ model: models.primary, messages: input.messages, temperature, maxTokens, timeoutMs, onToken: input.onToken })
    return { ...result, requestedModel: models.primary }
  } catch (error) {
    if (!models.secondary || !shouldFallback(error)) throw error
    const fallbackResult = await doCompletionStream({ model: models.secondary, messages: input.messages, temperature, maxTokens, timeoutMs, onToken: input.onToken })
    return { ...fallbackResult, requestedModel: models.secondary }
  }
}
