export const LAB_AI_CHAT_DAILY_REQUEST_LIMIT = 100
export const LAB_AI_CHAT_INPUT_MAX_CHARACTERS = 16000
export const LAB_AI_CHAT_VISIBLE_MESSAGE_LIMIT = 30
export const LAB_AI_CHAT_CONTEXT_MESSAGE_LIMIT = 40
export const LAB_AI_CHAT_COMPACTION_KEEP_MESSAGE_COUNT = 24
export const LAB_AI_CHAT_COMPACTION_TRIGGER_MESSAGE_COUNT = 48
export const LAB_AI_CHAT_COMPACTION_TRIGGER_ESTIMATED_TOKENS = 20000
export const LAB_AI_CHAT_COMPLETION_MAX_TOKENS = 8000
export const LAB_AI_CHAT_SUMMARY_MAX_TOKENS = 1600
export const LAB_AI_CHAT_PROVIDER_TIMEOUT_MS = 120_000
export const LAB_AI_CHAT_STREAMING_TIMEOUT_MS = 480_000
export const LAB_AI_CHAT_SUMMARY_PROVIDER_TIMEOUT_MS = 90_000
export const LAB_AI_CHAT_MEMORY_SUMMARY_MAX_CHARACTERS = 8000
export const LAB_AI_CHAT_TIME_ZONE = "Asia/Seoul"
export const NANOGPT_MODELS_CACHE_TTL_MS = 15 * 60 * 1000
export const LAB_AI_CHAT_WEB_SEARCH_CACHE_MAX_CHARACTERS = 24000

function parsePositiveIntEnv(raw: string | undefined, fallback: number) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.max(1, Math.floor(parsed))
}

export const LAB_AI_CHAT_WEB_SEARCH_SESSION_CALL_LIMIT = parsePositiveIntEnv(
  process.env.LAB_AI_CHAT_WEB_SEARCH_SESSION_CALL_LIMIT,
  5
)

export const LAB_AI_CHAT_WEB_SEARCH_MONTHLY_CALL_LIMIT = parsePositiveIntEnv(
  process.env.LAB_AI_CHAT_WEB_SEARCH_MONTHLY_CALL_LIMIT,
  800
)

export function estimateLabAiChatTokens(text: string) {
  return Math.max(1, Math.ceil(text.trim().length / 4))
}
