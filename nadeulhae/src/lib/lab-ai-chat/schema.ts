import { getDbPool } from "@/lib/db"
import type { RowDataPacket } from "mysql2/promise"

declare global {
  var __nadeulhaeLabAiChatSchemaPromise: Promise<void> | undefined
}

const createLabAiChatMessagesTableSql = `
  CREATE TABLE IF NOT EXISTS lab_ai_chat_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    session_id BIGINT NOT NULL,
    role VARCHAR(16) NOT NULL,
    locale VARCHAR(8) NOT NULL DEFAULT 'und',
    content LONGTEXT NOT NULL,
    provider_message_id VARCHAR(128) NULL,
    requested_model VARCHAR(191) NULL,
    resolved_model VARCHAR(191) NULL,
    prompt_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    completion_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    total_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    cached_prompt_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    included_in_memory_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_lab_ai_chat_messages_user_created (user_id, created_at),
    KEY idx_lab_ai_chat_messages_user_session_created (user_id, session_id, created_at),
    KEY idx_lab_ai_chat_messages_user_session_memory (user_id, session_id, included_in_memory_at, id)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createLabAiChatSessionsTableSql = `
  CREATE TABLE IF NOT EXISTS lab_ai_chat_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    title_text LONGTEXT NOT NULL,
    locale VARCHAR(8) NOT NULL DEFAULT 'und',
    memory_summary_text LONGTEXT NULL,
    memory_token_estimate INT UNSIGNED NOT NULL DEFAULT 0,
    summarized_message_count INT UNSIGNED NOT NULL DEFAULT 0,
    memory_model_used VARCHAR(191) NULL,
    last_compacted_at DATETIME NULL,
    last_message_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_lab_ai_chat_sessions_user_updated (user_id, updated_at),
    KEY idx_lab_ai_chat_sessions_user_created (user_id, created_at),
    KEY idx_lab_ai_chat_sessions_user_last_message (user_id, last_message_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createLabAiChatUsageDailyTableSql = `
  CREATE TABLE IF NOT EXISTS lab_ai_chat_usage_daily (
    metric_date DATE NOT NULL,
    user_id CHAR(36) NOT NULL,
    request_count INT UNSIGNED NOT NULL DEFAULT 0,
    success_count INT UNSIGNED NOT NULL DEFAULT 0,
    failure_count INT UNSIGNED NOT NULL DEFAULT 0,
    summary_count INT UNSIGNED NOT NULL DEFAULT 0,
    prompt_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
    completion_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
    cached_prompt_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
    summary_prompt_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
    summary_completion_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
    summary_total_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
    last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (metric_date, user_id),
    KEY idx_lab_ai_chat_usage_user_date (user_id, metric_date),
    KEY idx_lab_ai_chat_usage_last_used (last_used_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createLabAiChatRequestEventsTableSql = `
  CREATE TABLE IF NOT EXISTS lab_ai_chat_request_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    session_id BIGINT NULL,
    request_kind VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL,
    locale VARCHAR(8) NOT NULL DEFAULT 'und',
    requested_model VARCHAR(191) NULL,
    resolved_model VARCHAR(191) NULL,
    provider_request_id VARCHAR(128) NULL,
    message_count INT UNSIGNED NOT NULL DEFAULT 0,
    input_characters INT UNSIGNED NOT NULL DEFAULT 0,
    output_characters INT UNSIGNED NOT NULL DEFAULT 0,
    prompt_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    completion_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    total_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    cached_prompt_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    latency_ms INT UNSIGNED NOT NULL DEFAULT 0,
    error_code VARCHAR(64) NULL,
    error_message VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_lab_ai_chat_events_user_created (user_id, created_at),
    KEY idx_lab_ai_chat_events_user_session_created (user_id, session_id, created_at),
    KEY idx_lab_ai_chat_events_status_created (status, created_at),
    KEY idx_lab_ai_chat_events_kind_created (request_kind, created_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createLabAiChatWebSearchStateTableSql = `
  CREATE TABLE IF NOT EXISTS lab_ai_chat_web_search_state (
    user_id CHAR(36) NOT NULL,
    session_id BIGINT NOT NULL,
    session_call_count INT UNSIGNED NOT NULL DEFAULT 0,
    fallback_call_count INT UNSIGNED NOT NULL DEFAULT 0,
    cache_query_text LONGTEXT NULL,
    cache_result_text LONGTEXT NULL,
    cache_topic VARCHAR(16) NULL,
    cache_time_range VARCHAR(16) NULL,
    cache_start_date DATE NULL,
    cache_end_date DATE NULL,
    cache_result_count INT UNSIGNED NOT NULL DEFAULT 0,
    cache_updated_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, session_id),
    KEY idx_lab_ai_chat_web_state_updated (updated_at),
    KEY idx_lab_ai_chat_web_state_cache (cache_updated_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

async function ensureWebSearchStateColumns() {
  const pool = getDbPool()
  const [fallbackColumnRows] = await pool.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM lab_ai_chat_web_search_state LIKE 'fallback_call_count'"
  )
  if (fallbackColumnRows.length === 0) {
    await pool.query(
      "ALTER TABLE lab_ai_chat_web_search_state ADD COLUMN fallback_call_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER session_call_count"
    )
  }
}

const createLabAiChatWebSearchUsageMonthlyTableSql = `
  CREATE TABLE IF NOT EXISTS lab_ai_chat_web_search_usage_monthly (
    metric_month CHAR(7) NOT NULL PRIMARY KEY,
    request_count INT UNSIGNED NOT NULL DEFAULT 0,
    success_count INT UNSIGNED NOT NULL DEFAULT 0,
    failure_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_lab_ai_chat_web_monthly_last_used (last_used_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

export async function ensureLabAiChatSchema() {
  if (globalThis.__nadeulhaeLabAiChatSchemaPromise) {
    return globalThis.__nadeulhaeLabAiChatSchemaPromise
  }

  const bootstrapPromise = (async () => {
    const pool = getDbPool()
    await pool.query(createLabAiChatSessionsTableSql)
    await pool.query(createLabAiChatMessagesTableSql)
    await pool.query(createLabAiChatUsageDailyTableSql)
    await pool.query(createLabAiChatRequestEventsTableSql)
    await pool.query(createLabAiChatWebSearchStateTableSql)
    await pool.query(createLabAiChatWebSearchUsageMonthlyTableSql)
    await ensureWebSearchStateColumns()
  })()

  globalThis.__nadeulhaeLabAiChatSchemaPromise = bootstrapPromise.catch((error) => {
    globalThis.__nadeulhaeLabAiChatSchemaPromise = undefined
    throw error
  })

  return globalThis.__nadeulhaeLabAiChatSchemaPromise
}
