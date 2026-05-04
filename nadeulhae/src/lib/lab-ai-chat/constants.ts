/**
 * Lab AI Chat — tunable constants for rate limits, token budgets, timeouts, and web-search thresholds.
 * Env-var overrides allow per-deployment tuning without code changes.
 */

/** Max chat requests per user per calendar day (KST). */
export const LAB_AI_CHAT_DAILY_REQUEST_LIMIT = 100
/** Max characters a single user message may contain. */
export const LAB_AI_CHAT_INPUT_MAX_CHARACTERS = 16000
/** How many recent messages to return to the UI. */
export const LAB_AI_CHAT_VISIBLE_MESSAGE_LIMIT = 30
/** How many un-compacted messages to include in the LLM context window. */
export const LAB_AI_CHAT_CONTEXT_MESSAGE_LIMIT = 40
/** After compaction, keep this many most-recent messages unsummarised. */
export const LAB_AI_CHAT_COMPACTION_KEEP_MESSAGE_COUNT = 24
/** Trigger compaction when raw message count exceeds this threshold. */
export const LAB_AI_CHAT_COMPACTION_TRIGGER_MESSAGE_COUNT = 48
/** Trigger compaction when estimated token count of candidate messages exceeds this. */
export const LAB_AI_CHAT_COMPACTION_TRIGGER_ESTIMATED_TOKENS = 20000
/** Max tokens the model may generate per completion. */
export const LAB_AI_CHAT_COMPLETION_MAX_TOKENS = 8000
/** Max tokens for a memory-summary completion. */
export const LAB_AI_CHAT_SUMMARY_MAX_TOKENS = 1600
/** Single-chat-completion timeout (ms). */
export const LAB_AI_CHAT_PROVIDER_TIMEOUT_MS = 120_000
/** Streaming-chat timeout (ms) — longer to accommodate slow streams. */
export const LAB_AI_CHAT_STREAMING_TIMEOUT_MS = 480_000
/** Memory-summary completion timeout (ms). */
export const LAB_AI_CHAT_SUMMARY_PROVIDER_TIMEOUT_MS = 90_000
/** Max characters for the memory-summary text stored in the DB. */
export const LAB_AI_CHAT_MEMORY_SUMMARY_MAX_CHARACTERS = 8000
/** Time zone used for daily/monthly metric rollover. */
export const LAB_AI_CHAT_TIME_ZONE = "Asia/Seoul"
/** How long to cache the model-options list (15 min). */
export const LAB_MODELS_CACHE_TTL_MS = 15 * 60 * 1000
/** Max characters for cached web-search result text. */
export const LAB_AI_CHAT_WEB_SEARCH_CACHE_MAX_CHARACTERS = 24000

/** Parse a positive integer from an env var, falling back to a default. */
function parsePositiveIntEnv(raw: string | undefined, fallback: number) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.max(1, Math.floor(parsed))
}

/** Parse a fraction [0, 1] from an env var, falling back to a default. */
function parseFractionEnv(raw: string | undefined, fallback: number) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(1, Math.max(0, parsed))
}

export const LAB_AI_CHAT_WEB_SEARCH_SESSION_CALL_LIMIT = parsePositiveIntEnv(
  process.env.LAB_AI_CHAT_WEB_SEARCH_SESSION_CALL_LIMIT,
  7
)

export const LAB_AI_CHAT_WEB_SEARCH_FALLBACK_CALL_LIMIT = parsePositiveIntEnv(
  process.env.LAB_AI_CHAT_WEB_SEARCH_FALLBACK_CALL_LIMIT,
  3
)

export const LAB_AI_CHAT_WEB_SEARCH_SESSION_TOTAL_CALL_LIMIT =
  LAB_AI_CHAT_WEB_SEARCH_SESSION_CALL_LIMIT + LAB_AI_CHAT_WEB_SEARCH_FALLBACK_CALL_LIMIT

export const LAB_AI_CHAT_WEB_SEARCH_MONTHLY_CALL_LIMIT = parsePositiveIntEnv(
  process.env.LAB_AI_CHAT_WEB_SEARCH_MONTHLY_CALL_LIMIT,
  800
)

export const LAB_AI_CHAT_WEB_SEARCH_RESULT_SCORE_THRESHOLD = parseFractionEnv(
  process.env.LAB_AI_CHAT_WEB_SEARCH_RESULT_SCORE_THRESHOLD,
  0.5
)

/** Rough token estimate: ~1 token per 4 characters (UTF-8 heuristic). */
export function estimateLabAiChatTokens(text: string) {
  return Math.max(1, Math.ceil(text.trim().length / 4))
}
