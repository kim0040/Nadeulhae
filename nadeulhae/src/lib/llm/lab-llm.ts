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
    description: "1.6T MoE (49B 활성). 하이브리드 어텐션으로 1M 컨텍스트 처리. MIT 라이선스. LiveCodeBench 93.5%·Codeforces 3206으로 코딩 최상위권. Claude Code 백엔드로도 사용 가능.",
    candidates: ["deepseek-v4-pro"],
    quantization: "FP4+FP8 혼합",
    reasoningEffort: true,
  },
  {
    slug: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    description: "292B MoE (158B). V4 Pro 대비 1/10 비용으로 근접 성능. 빠른 추론 속도와 효율적인 토큰 처리. 일상 코딩·고처리량 워크로드에 최적.",
    candidates: ["deepseek-v4-flash"],
    quantization: "FP8",
    reasoningEffort: true,
  },
  {
    slug: "glm-5.1",
    label: "GLM 5.1",
    description: "744B MoE·8전문가 활성. 세계 최초 8시간 연속 자율 작업 가능. SWE-Bench Pro 58.4로 GPT-5.4 추월. MIT 라이선스. 장기 에이전트 코딩의 새 패러다임.",
    candidates: ["glm-5.1"],
    quantization: "Q6_K",
    reasoningEffort: true,
  },
  {
    slug: "glm-5",
    label: "GLM 5",
    description: "754B MoE·화웨이 Ascend 학습. 시스템 설계·장기 에이전트 워크플로에 강점. 5.1 이전 세대의 안정적인 선택.",
    candidates: ["glm-5"],
    quantization: "Q4_0",
    reasoningEffort: false,
  },
  {
    slug: "kimi-k2.6",
    label: "Kimi K2.6",
    description: "1T MoE (32B 활성). 256K 컨텍스트·300 에이전트 스웜·4000단계 자율 실행. SWE-Bench Pro 58.6으로 Claude Opus 4.6 추월. 멀티모달 장기 코딩 최강.",
    candidates: ["kimi-k2.6"],
    quantization: "Q3_K_L",
    reasoningEffort: true,
  },
  {
    slug: "kimi-k2.5",
    label: "Kimi K2.5",
    description: "1T MoE (32B 활성). K2.6 이전 세대. 비전 지원 문서 분석·에이전트 작업에 안정적. Cursor의 Composer 2 내부 모델로도 사용됨.",
    candidates: ["kimi-k2.5"],
    quantization: "Q4_K_M",
    reasoningEffort: true,
  },
  {
    slug: "mimo-v2.5-pro",
    label: "MiMo V2.5 Pro",
    description: "Xiaomi 플래그십. SWE-Bench Pro·ClawEval 상위. 1000+ 도구 호출 자율 작업 가능. 아날로그 회로 설계부터 영상 편집까지 가능한 범위.",
    candidates: ["mimo-v2.5-pro"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "mimo-v2.5",
    label: "MiMo V2.5",
    description: "MiMo V2.5 시리즈의 범용 모델. 안정적인 성능과 빠른 응답. 일반 대화·코딩에 무난.",
    candidates: ["mimo-v2.5"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "mimo-v2-pro",
    label: "MiMo V2 Pro",
    description: "MiMo V2 시리즈의 프로 모델. 이전 세대 안정형. 검증된 성능.",
    candidates: ["mimo-v2-pro"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "mimo-v2-omni",
    label: "MiMo V2 Omni",
    description: "멀티모달 지원 MiMo 모델. 텍스트와 이미지 처리 가능. 비전 작업에 유용.",
    candidates: ["mimo-v2-omni"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "qwen3.7-max",
    label: "Qwen 3.7 Max",
    description: "Alibaba 최신 플래그십. 1M 컨텍스트. Chinese 모델 중 Artificial Analysis 최고 순위. GPT-5.4·Gemini 3.5 Flash와 경쟁. 복잡한 추론·장기 워크플로 특화.",
    candidates: ["qwen3.7-max"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "qwen3.6-plus",
    label: "Qwen 3.6 Plus",
    description: "Alibaba 27B MoE·비전. 빠른 범용 대화와 실무 코딩에 무난한 밸런스형. 256K 컨텍스트.",
    candidates: ["qwen3.6-plus"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "qwen3.5-plus",
    label: "Qwen 3.5 Plus",
    description: "Qwen 3.5 시리즈의 플러스 모델. 향상된 성능과 안정성. 범용 작업에 적합.",
    candidates: ["qwen3.5-plus"],
    quantization: "Q4_0",
    reasoningEffort: true,
  },
  {
    slug: "minimax-m2.7",
    label: "MiniMax M2.7",
    description: "세계 최초 자기 진화 모델. 자가 학습 파이프라인 참여 가능. 205K 컨텍스트. GDPval-AA 1495 ELO. 10B 파라미터로 GLM-5급 지능. 연구 워크플로 30-50% 자동화.",
    candidates: ["minimax-m2.7"],
    quantization: "awq",
    reasoningEffort: false,
  },
  {
    slug: "minimax-m2.5",
    label: "MiniMax M2.5",
    description: "가성비 최강 범용 모델. 205K 컨텍스트. 긴 대화·창작·요약에 부드러운 성능. Frontier 성능을 1/10 비용으로.",
    candidates: ["minimax-m2.5"],
    quantization: "awq",
    reasoningEffort: false,
  },
  {
    slug: "hy3-preview",
    label: "HY3 Preview",
    description: "실험적 프리뷰 모델. 최신 기능 테스트용. 검증되지 않은 성능.",
    warning: "실험 모델이라 응답 품질이 불안정할 수 있어요.",
    candidates: ["hy3-preview"],
    quantization: "Q4_0",
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
