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

export class GeneralChatError extends OpenAiClientError {
  constructor(message: string, statusCode: number, code?: string | null) {
    super(message, statusCode, code)
    this.name = "GeneralChatError"
  }
}

function resolveApiKey(): string {
  return (
    process.env.GENERAL_LLM_API_KEY
    || process.env.LLM_API_KEY
    || process.env.NANOGPT_API_KEY
    || (() => { throw new Error("Missing GENERAL_LLM_API_KEY (or NANOGPT_API_KEY)") })()
  )
}

function resolveBaseUrl(): string {
  return (
    process.env.GENERAL_LLM_BASE_URL
    || process.env.LLM_BASE_URL
    || process.env.NANOGPT_BASE_URL
    || "https://nano-gpt.com/api/v1"
  ).replace(/\/$/, "")
}

function resolvePrimaryModel(): string {
  return process.env.GENERAL_LLM_MODEL || process.env.LLM_MODEL || "deepseek/deepseek-v4-flash"
}

function resolveFallbackModel(): string {
  return process.env.GENERAL_LLM_FALLBACK_MODEL || process.env.LLM_FALLBACK_MODEL || "deepseek/deepseek-v4-pro"
}

function getGlobalDailyLimit() {
  const raw = Number(
    process.env.GENERAL_LLM_GLOBAL_DAILY_LIMIT
    ?? process.env.LLM_GLOBAL_DAILY_LIMIT
    ?? "5000"
  )
  return Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : 5000
}

function getConfig(): LlmConfig {
  return {
    apiKey: resolveApiKey(),
    baseUrl: resolveBaseUrl(),
    model: resolvePrimaryModel(),
    fallbackModel: resolveFallbackModel(),
  }
}

async function listModels() {
  const cache = globalThis.__nadeulhaeGeneralLlmModelsCache
  if (cache && Date.now() - cache.fetchedAt < MODELS_CACHE_TTL_MS) {
    return cache.ids
  }
  const ids = await fetchModels(getConfig(), PROVIDER_TIMEOUT_MS)
  globalThis.__nadeulhaeGeneralLlmModelsCache = { fetchedAt: Date.now(), ids }
  return ids
}

async function resolveModelPair() {
  const available = await listModels()
  if (available.length === 0) {
    throw new Error("No models are available for the configured API key.")
  }
  const primary = pickModelCandidate(resolvePrimaryModel(), available) || available[0]
  const secondary = pickModelCandidate(resolveFallbackModel(), available) || null
  return {
    primary,
    secondary: secondary && secondary !== primary ? secondary : null,
  }
}

function shouldFallback(error: unknown) {
  if (!(error instanceof OpenAiClientError)) return true
  return ![401, 402].includes(error.statusCode)
}

async function doCompletion(input: {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  temperature: number
  maxTokens: number
  timeoutMs: number
}) {
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

export async function createGeneralChatCompletion(input: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  requestKind: LlmRequestKind
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
}): Promise<LlmCompletionResult> {
  const models = await resolveModelPair()
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
