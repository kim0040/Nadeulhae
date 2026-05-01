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

type AllowedModelSpec = {
  slug: string
  label: string
  description: string
  warning?: string
  candidates: string[]
  thinkingCandidates?: string[]
  thinkingWarning?: string
}

const ALLOWED_MODEL_SPECS: AllowedModelSpec[] = [
  {
    slug: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    description: "1M 컨텍스트를 지원하는 효율형 MoE 모델로, 빠른 대화·코딩·일상 작업에 좋아요.",
    candidates: ["deepseek/deepseek-v4-flash"],
    thinkingCandidates: ["deepseek/deepseek-v4-flash:thinking"],
    thinkingWarning: "생각 모드는 일반 모드보다 응답 시작이 느릴 수 있어요.",
  },
  {
    slug: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    description: "1.6T급 V4 상위 모델로, 긴 맥락 분석·추론·복잡한 코드 작업에 적합해요.",
    candidates: ["deepseek/deepseek-v4-pro"],
    thinkingCandidates: ["deepseek/deepseek-v4-pro:thinking"],
    thinkingWarning: "생각 모드는 느리고 긴 답변에서 중간에 멈출 수 있어요.",
  },
  {
    slug: "kimi-k2-6",
    label: "Kimi K2.6",
    description: "장기 코딩, 문서 기반 작업, 에이전트형 워크플로를 길게 이어가는 데 강해요.",
    candidates: ["moonshotai/kimi-k2.6"],
    thinkingCandidates: ["moonshotai/kimi-k2.6:thinking"],
    thinkingWarning: "현재 생각 모드는 빈 응답이 나올 수 있어 사용에 주의가 필요해요.",
  },
  {
    slug: "qwen-3-6",
    label: "Qwen 3.6",
    description: "35B/3B 활성 MoE 모델로, 빠른 일반 대화와 실무형 코딩 보조에 무난해요.",
    candidates: ["Qwen/Qwen3.6-35B-A3B"],
    thinkingCandidates: ["Qwen/Qwen3.6-35B-A3B:thinking"],
    thinkingWarning: "생각 모드는 최종 답변보다 reasoning 텍스트가 노출될 수 있어요.",
  },
  {
    slug: "glm-5-1",
    label: "GLM 5.1",
    description: "에이전트형 엔지니어링과 긴 코딩 작업에 초점을 둔 모델이에요.",
    warning: "실측 기준 응답 완료가 느린 편이에요.",
    candidates: ["zai-org/glm-5.1"],
    thinkingCandidates: ["zai-org/glm-5.1:thinking"],
    thinkingWarning: "현재 생각 모드는 타임아웃 가능성이 높아 사용에 주의가 필요해요.",
  },
  {
    slug: "minimax-m2-7",
    label: "MiniMax M2.7",
    description: "긴 맥락 대화와 창작·요약을 부드럽게 이어가요.",
    candidates: ["minimax/minimax-m2.7", "minimax/minimax-m2.7-turbo"],
  },
  {
    slug: "gpt-oss-120b",
    label: "GPT-OSS 120B",
    description: "큰 오픈 모델로 깊이 있는 추론과 코딩 분석에 적합해요.",
    candidates: ["openai/gpt-oss-120b", "TEE/gpt-oss-120b"],
  },
  {
    slug: "gpt-oss-20b",
    label: "GPT-OSS 20B",
    description: "가벼운 오픈 모델로 빠른 답변과 일상 작업에 적합해요.",
    candidates: ["openai/gpt-oss-20b", "TEE/gpt-oss-20b"],
  },
  {
    slug: "gemma-4",
    label: "Gemma 4",
    description: "가벼운 범용 모델로 짧은 질의와 빠른 초안 작성에 좋아요.",
    candidates: ["google/gemma-4-31b-it", "TEE/gemma4-31b", "google/gemma-4-26b-a4b-it"],
    thinkingCandidates: ["google/gemma-4-31b-it:thinking", "google/gemma-4-26b-a4b-it:thinking"],
  },
]

export class LabChatError extends OpenAiClientError {
  constructor(message: string, statusCode: number, code?: string | null) {
    super(message, statusCode, code)
    this.name = "LabChatError"
  }
}

function resolveApiKey(): string {
  return (
    process.env.LAB_LLM_API_KEY
    || process.env.LLM_API_KEY
    || process.env.NANOGPT_API_KEY
    || (() => { throw new Error("Missing LAB_LLM_API_KEY (or NANOGPT_API_KEY)") })()
  )
}

function resolveBaseUrl(): string {
  return (
    process.env.LAB_LLM_BASE_URL
    || process.env.LLM_BASE_URL
    || process.env.NANOGPT_BASE_URL
    || "https://nano-gpt.com/api/v1"
  ).replace(/\/$/, "")
}

function getGlobalDailyLimit() {
  const raw = Number(
    process.env.LAB_LLM_GLOBAL_DAILY_LIMIT
    ?? process.env.LLM_GLOBAL_DAILY_LIMIT
    ?? "5000"
  )
  return Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : 5000
}

function getConfig(): LlmConfig {
  return {
    apiKey: resolveApiKey(),
    baseUrl: resolveBaseUrl(),
    model: "",
  }
}

async function listModelIds() {
  const cache = globalThis.__nadeulhaeLabLlmModelsCache
  if (cache && Date.now() - cache.fetchedAt < MODELS_CACHE_TTL_MS) {
    return cache.ids
  }
  const ids = await fetchModels(getConfig(), PROVIDER_TIMEOUT_MS)
  globalThis.__nadeulhaeLabLlmModelsCache = { fetchedAt: Date.now(), ids, allowed: cache?.allowed ?? [] }
  return ids
}

export async function resolveAllowedLabModels(): Promise<LlmModelOption[]> {
  const cache = globalThis.__nadeulhaeLabLlmModelsCache
  if (cache && Date.now() - cache.fetchedAt < MODELS_CACHE_TTL_MS && cache.allowed.length > 0) {
    return cache.allowed
  }

  const available = await listModelIds()
  const allowed = ALLOWED_MODEL_SPECS.flatMap((spec): LlmModelOption[] => {
    const matched = spec.candidates
      .map((candidate) => pickModelCandidate(candidate, available))
      .find((value): value is string => Boolean(value))
    if (!matched) return []

    const thinkingMatched = spec.thinkingCandidates
      ?.map((candidate) => pickModelCandidate(candidate, available))
      ?.find((value): value is string => Boolean(value))

    return [{
      id: matched,
      slug: spec.slug,
      label: spec.label,
      description: spec.description,
      warning: spec.warning,
      thinkingId: thinkingMatched,
      thinkingWarning: spec.thinkingWarning,
    }]
  })

  if (allowed.length === 0) {
    throw new Error("No allowed models are available for the configured API key.")
  }

  globalThis.__nadeulhaeLabLlmModelsCache = { fetchedAt: Date.now(), ids: available, allowed }
  return allowed
}

export function resolveRequestedLabModel(
  allowedModels: LlmModelOption[],
  requestedModel: string | null | undefined
): LlmModelOption {
  const normalized = typeof requestedModel === "string" ? requestedModel.trim() : ""
  if (!normalized) return allowedModels[0]
  return allowedModels.find((item) =>
    item.id === normalized || item.slug === normalized || item.thinkingId === normalized
  ) ?? allowedModels[0]
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
    throw new LabChatError("Global daily LLM request limit reached.", 429, "global_daily_limit_reached")
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
    throw new LabChatError("Global daily LLM request limit reached.", 429, "global_daily_limit_reached")
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

export async function createLabChatCompletion(input: {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  requestKind: LlmRequestKind
}): Promise<LlmCompletionResult> {
  const timeoutMs = input.requestKind === "summary" ? SUMMARY_PROVIDER_TIMEOUT_MS : PROVIDER_TIMEOUT_MS
  const maxTokens = input.requestKind === "summary" ? SUMMARY_MAX_TOKENS : COMPLETION_MAX_TOKENS
  const temperature = input.requestKind === "summary" ? 0.2 : 0.55

  const result = await doCompletion({ model: input.model, messages: input.messages, temperature, maxTokens, timeoutMs })
  return { ...result, requestedModel: input.model }
}

export async function createLabChatCompletionStream(input: {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  requestKind: LlmRequestKind
  onToken: (token: string) => void
}): Promise<LlmCompletionResult> {
  const timeoutMs = input.requestKind === "summary" ? SUMMARY_PROVIDER_TIMEOUT_MS : STREAMING_TIMEOUT_MS
  const maxTokens = input.requestKind === "summary" ? SUMMARY_MAX_TOKENS : COMPLETION_MAX_TOKENS
  const temperature = input.requestKind === "summary" ? 0.2 : 0.55

  const result = await doCompletionStream({ model: input.model, messages: input.messages, temperature, maxTokens, timeoutMs, onToken: input.onToken })
  return { ...result, requestedModel: input.model }
}
