/**
 * Lab-specific LLM Chat Wrapper
 *
 * General-purpose AI assistant client with curated model selection,
 * reasoning-effort control, and daily quota enforcement.
 * Uses CrofAI API (OpenAI-compatible) for all lab chat completions.
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
    description: "1.6T MoE 상위 모델. 긴 맥락 분석·추론·복잡한 코딩에 최적화. 1M 컨텍스트.",
    candidates: ["deepseek-v4-pro"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "deepseek-v4-pro-precision",
    label: "DeepSeek V4 Pro Precision",
    description: "V4 Pro의 Q8_0 정밀 양자화 버전. 더 높은 정확도가 필요한 작업에 적합. 1M 컨텍스트.",
    warning: "가격이 2~3배 높아요.",
    candidates: ["deepseek-v4-pro-precision"],
    quantization: "Q8_0",
    reasoningEffort: true,
  },
  {
    slug: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    description: "가성비 높은 효율형 MoE 모델. 빠른 대화·코딩·일상 작업용. 1M 컨텍스트.",
    candidates: ["deepseek-v4-flash"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "deepseek-v3.2",
    label: "DeepSeek V3.2",
    description: "안정적인 범용 모델. 일상 대화와 중간 복잡도 작업에 무난. 163K 컨텍스트.",
    candidates: ["deepseek-v3.2"],
    quantization: "Q4_0",
    reasoningEffort: false,
  },
  {
    slug: "mimo-v2.5-pro",
    label: "MiMo V2.5 Pro",
    description: "Xiaomi의 최신 MoE 모델. 1M 컨텍스트로 장문 처리에 강점.",
    candidates: ["mimo-v2.5-pro"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "glm-5.1",
    label: "GLM 5.1",
    description: "에이전트형 엔지니어링·긴 코딩 작업에 특화. 202K 컨텍스트.",
    warning: "응답 완료가 느린 편이에요.",
    candidates: ["glm-5.1"],
    quantization: "Q6_K",
    reasoningEffort: true,
  },
  {
    slug: "kimi-k2.6",
    label: "Kimi K2.6",
    description: "장기 코딩·문서 작업·에이전트 워크플로에 강함. 262K 컨텍스트.",
    candidates: ["kimi-k2.6"],
    quantization: "Q3_K_L",
    reasoningEffort: true,
  },
  {
    slug: "gemma-4-31b-it",
    label: "Gemma 4 (31B)",
    description: "Google의 경량 범용 모델. 빠른 응답과 짧은 질의에 적합. 262K 컨텍스트.",
    candidates: ["gemma-4-31b-it"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "minimax-m2.5",
    label: "MiniMax M2.5",
    description: "긴 맥락 대화와 창작·요약에 부드러운 성능. 204K 컨텍스트.",
    candidates: ["minimax-m2.5"],
    quantization: "awq",
    reasoningEffort: false,
  },
  {
    slug: "qwen3.6-27b",
    label: "Qwen 3.6 (27B)",
    description: "Alibaba의 27B MoE 모델. 범용 대화와 실무 코딩에 무난. 262K 컨텍스트.",
    candidates: ["qwen3.6-27b"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "qwen3.5-9b",
    label: "Qwen 3.5 (9B)",
    description: "가장 가볍고 빠른 모델. 일상 대화와 간단한 작업에 적합. 262K 컨텍스트.",
    candidates: ["qwen3.5-9b"],
    quantization: "fp8",
    reasoningEffort: true,
  },
  {
    slug: "qwen3.5-397b-a17b",
    label: "Qwen 3.5 (397B-A17B)",
    description: "초대형 MoE 모델. 깊은 추론과 복잡한 분석에 적합. 262K 컨텍스트.",
    candidates: ["qwen3.5-397b-a17b"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "kimi-k2.5",
    label: "Kimi K2.5",
    description: "K2.6 이전 세대. 비전 지원·문서 분석에 안정적. 262K 컨텍스트.",
    candidates: ["kimi-k2.5"],
    quantization: "Q4_K_M",
    reasoningEffort: true,
  },
  {
    slug: "kimi-k2.5-lightning",
    label: "Kimi K2.5 Lightning",
    description: "초고속 추론 특화. 응답 속도가 매우 빠름. 131K 컨텍스트·32K 출력.",
    warning: "최대 출력이 32K로 짧은 편이에요.",
    candidates: ["kimi-k2.5-lightning"],
    quantization: "530b-int4",
    reasoningEffort: true,
  },
  {
    slug: "glm-5",
    label: "GLM 5",
    description: "GLM 5.1 이전 버전. 범용 대화와 코딩에 안정적. 202K 컨텍스트.",
    candidates: ["glm-5"],
    quantization: "Q4_0",
    reasoningEffort: false,
  },
  {
    slug: "glm-4.7",
    label: "GLM 4.7",
    description: "Z.AI의 Q8_0 정밀 모델. 높은 정확도의 범용 작업용. 202K 컨텍스트.",
    candidates: ["glm-4.7"],
    quantization: "Q8_0",
    reasoningEffort: false,
  },
  {
    slug: "glm-4.7-flash",
    label: "GLM 4.7 Flash",
    description: "GLM 4.7의 fp8 경량 버전. 빠른 응답과 저비용이 장점. 202K 컨텍스트.",
    candidates: ["glm-4.7-flash"],
    quantization: "fp8",
    reasoningEffort: false,
  },
  {
    slug: "greg",
    label: "Greg",
    description: "실험적 초고속 모델. 비전 지원·최고 속도가 특징. 229K 컨텍스트.",
    warning: "실험 모델이라 응답 품질이 불안정할 수 있어요.",
    candidates: ["greg"],
    quantization: "greg",
    reasoningEffort: false,
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

/** Resolves the base URL. Defaults to the Nano-GPT API v1 endpoint. */
function resolveBaseUrl(): string {
  return (
    process.env.LAB_LLM_BASE_URL
    || process.env.LLM_BASE_URL
    || process.env.NANOGPT_BASE_URL
    || "https://nano-gpt.com/api/v1"
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
