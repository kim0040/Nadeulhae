export const CHAT_DAILY_REQUEST_LIMIT = 200
export const CHAT_INPUT_MAX_CHARACTERS = 1600
export const CHAT_VISIBLE_MESSAGE_LIMIT = 20
export const CHAT_CONTEXT_MESSAGE_LIMIT = 12
export const CHAT_COMPACTION_KEEP_MESSAGE_COUNT = 8
export const CHAT_COMPACTION_TRIGGER_MESSAGE_COUNT = 12
export const CHAT_COMPACTION_TRIGGER_ESTIMATED_TOKENS = 2400
export const CHAT_COMPLETION_MAX_TOKENS = 720
export const CHAT_SUMMARY_MAX_TOKENS = 360
export const FACTCHAT_MODELS_CACHE_TTL_MS = 15 * 60 * 1000
export const CHAT_PROVIDER_TIMEOUT_MS = 30_000
export const CHAT_STREAMING_TIMEOUT_MS = 120_000
export const CHAT_SUMMARY_PROVIDER_TIMEOUT_MS = 25_000
export const CHAT_MEMORY_SUMMARY_MAX_CHARACTERS = 2200
export const CHAT_TIME_ZONE = "Asia/Seoul"

export function estimateTextTokens(text: string) {
  return Math.max(1, Math.ceil(text.trim().length / 4))
}
