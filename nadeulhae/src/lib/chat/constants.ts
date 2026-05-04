/**
 * Chat module constants and text token estimation.
 *
 * Defines all tunable parameters for the dashboard chat feature: daily usage
 * caps, input limits, compaction triggers, timeout values, and the KST time
 * zone used for daily metric rollover.
 */

export const CHAT_DAILY_REQUEST_LIMIT = 200
export const CHAT_INPUT_MAX_CHARACTERS = 1600
export const CHAT_VISIBLE_MESSAGE_LIMIT = 20
export const CHAT_CONTEXT_MESSAGE_LIMIT = 12
export const CHAT_COMPACTION_KEEP_MESSAGE_COUNT = 8
export const CHAT_COMPACTION_TRIGGER_MESSAGE_COUNT = 12
export const CHAT_COMPACTION_TRIGGER_ESTIMATED_TOKENS = 2400
export const CHAT_COMPLETION_MAX_TOKENS = 720
export const CHAT_SUMMARY_MAX_TOKENS = 360
export const CHAT_MODELS_CACHE_TTL_MS = 15 * 60 * 1000
export const CHAT_PROVIDER_TIMEOUT_MS = 30_000
export const CHAT_STREAMING_TIMEOUT_MS = 120_000
export const CHAT_SUMMARY_PROVIDER_TIMEOUT_MS = 25_000
export const CHAT_MEMORY_SUMMARY_MAX_CHARACTERS = 2200
export const CHAT_TIME_ZONE = "Asia/Seoul"

/**
 * Roughly estimate the token count of a text string.
 *
 * Uses a simple heuristic of 1 token per 4 characters — sufficient for
 * compaction-trigger decisions without incurring the cost of real tokenization.
 */
export function estimateTextTokens(text: string) {
  return Math.max(1, Math.ceil(text.trim().length / 4))
}
