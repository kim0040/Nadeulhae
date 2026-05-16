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
    description: "1.6T MoE (49B 활성). Codeforces 3206·LiveCodeBench 93.5%로 코딩 최상위권. 복잡한 추론·에이전트·SWE 작업에 적합.",
    candidates: ["deepseek-v4-pro"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    description: "284B MoE (13B 활성). V4 Pro의 1/10 비용으로 근접 성능. 빠른 대화·일상 코딩·고처리량 워크로드에 최적.",
    candidates: ["deepseek-v4-flash"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "deepseek-v3.2",
    label: "DeepSeek V3.2",
    description: "이전 세대 안정형 모델. 일상 대화·중간 복잡도 작업에 무난한 범용 성능.",
    candidates: ["deepseek-v3.2"],
    quantization: "Q4_0",
    reasoningEffort: false,
  },
  {
    slug: "mimo-v2.5-pro",
    label: "MiMo V2.5 Pro",
    description: "1.02T MoE (42B 활성). SWE-Bench Pro 57.2·컴파일러 4.3시간 자동 작성. 토큰 효율 40~60% 우위. 장시간 에이전트 코딩 특화.",
    candidates: ["mimo-v2.5-pro"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "glm-5.1",
    label: "GLM 5.1",
    description: "754B MoE·8전문가 활성. SWE-Bench Pro 58.4로 전체 1위. 8시간 자율 실행·화웨이 Ascend 학습. 장기 에이전트 코딩에 탁월.",
    candidates: ["glm-5.1"],
    quantization: "Q6_K",
    reasoningEffort: true,
  },
  {
    slug: "kimi-k2.6",
    label: "Kimi K2.6",
    description: "1T MoE (32B 활성)·비전. SWE-Bench Pro 58.6·12시간 자율 실행·300 에이전트 스웜. 멀티모달 장기 코딩 최강.",
    candidates: ["kimi-k2.6"],
    quantization: "Q3_K_L",
    reasoningEffort: true,
  },
  {
    slug: "gemma-4-31b-it",
    label: "Gemma 4 (31B)",
    description: "Google 경량 모델·비전. 빠른 응답과 짧은 질의에 적합한 범용 챗봇.",
    candidates: ["gemma-4-31b-it"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "minimax-m2.5",
    label: "MiniMax M2.5",
    description: "AWQ 경량화·204K 컨텍스트. 긴 대화·창작·요약에 부드러운 성능. 가성비 좋은 범용 모델.",
    candidates: ["minimax-m2.5"],
    quantization: "awq",
    reasoningEffort: false,
  },
  {
    slug: "qwen3.6-27b",
    label: "Qwen 3.6 (27B)",
    description: "Alibaba 27B MoE·비전. 빠른 범용 대화와 실무 코딩에 무난한 밸런스형.",
    candidates: ["qwen3.6-27b"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "qwen3.5-9b",
    label: "Qwen 3.5 (9B)",
    description: "fp8 초경량·189 t/s 초고속. 일상 대화·간단한 작업·저지연 요구에 최적.",
    candidates: ["qwen3.5-9b"],
    quantization: "fp8",
    reasoningEffort: true,
  },
  {
    slug: "qwen3.5-397b-a17b",
    label: "Qwen 3.5 (397B-A17B)",
    description: "397B 초대형 MoE·비전. 깊은 추론·복잡한 분석·고난도 수학에 적합.",
    candidates: ["qwen3.5-397b-a17b"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "kimi-k2.5",
    label: "Kimi K2.5",
    description: "1T MoE (32B 활성)·비전. K2.6 이전 세대. 비전 지원 문서 분석·에이전트 작업에 안정적.",
    candidates: ["kimi-k2.5"],
    quantization: "Q4_K_M",
    reasoningEffort: true,
  },
  {
    slug: "kimi-k2.5-lightning",
    label: "Kimi K2.5 Lightning",
    description: "530b-int4·1,417 t/s 초고속 추론. 응답 속도 최우선 작업에 적합.",
    warning: "최대 출력이 32K로 짧은 편이에요.",
    candidates: ["kimi-k2.5-lightning"],
    quantization: "530b-int4",
    reasoningEffort: true,
  },
  {
    slug: "glm-5",
    label: "GLM 5",
    description: "754B MoE·화웨이 Ascend 학습. 시스템 설계·장기 에이전트 워크플로에 강점. 5.1 이전 세대.",
    candidates: ["glm-5"],
    quantization: "Q4_0",
    reasoningEffort: false,
  },
  {
    slug: "glm-4.7",
    label: "GLM 4.7",
    description: "Q8_0 고정밀·Preserved Thinking. 코딩·도구 사용에 강한 오픈소스 모델. Claude Code 호환.",
    candidates: ["glm-4.7"],
    quantization: "Q8_0",
    reasoningEffort: false,
  },
  {
    slug: "glm-4.7-flash",
    label: "GLM 4.7 Flash",
    description: "fp8 경량·102 t/s 고속. GLM 4.7의 빠른 버전. 저비용 일상 코딩·대화용.",
    candidates: ["glm-4.7-flash"],
    quantization: "fp8",
    reasoningEffort: false,
  },
  {
    slug: "greg",
    label: "Greg",
    description: "실험적 초고속 모델·213 t/s·비전. 응답 속도가 가장 빠르지만 품질은 불안정.",
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
