import { getDbPool } from "@/lib/db"

declare global {
  var __nadeulhaeChatSchemaPromise: Promise<void> | undefined
}

const createChatMessagesTableSql = `
  CREATE TABLE IF NOT EXISTS user_chat_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    role VARCHAR(16) NOT NULL,
    locale VARCHAR(8) NOT NULL DEFAULT 'und',
    content LONGTEXT NOT NULL,
    provider_message_id VARCHAR(128) NULL,
    requested_model VARCHAR(120) NULL,
    resolved_model VARCHAR(120) NULL,
    prompt_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    completion_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    total_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    cached_prompt_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    included_in_memory_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_chat_messages_user_created (user_id, created_at),
    KEY idx_chat_messages_user_memory (user_id, included_in_memory_at, id)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createChatMemoryTableSql = `
  CREATE TABLE IF NOT EXISTS user_chat_memory (
    user_id CHAR(36) PRIMARY KEY,
    summary_text LONGTEXT NOT NULL,
    summary_token_estimate INT UNSIGNED NOT NULL DEFAULT 0,
    summarized_message_count INT UNSIGNED NOT NULL DEFAULT 0,
    model_used VARCHAR(120) NULL,
    last_compacted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createChatUsageDailyTableSql = `
  CREATE TABLE IF NOT EXISTS user_chat_usage_daily (
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
    KEY idx_chat_usage_user_date (user_id, metric_date),
    KEY idx_chat_usage_last_used (last_used_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createChatRequestEventsTableSql = `
  CREATE TABLE IF NOT EXISTS user_chat_request_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    request_kind VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL,
    locale VARCHAR(8) NOT NULL DEFAULT 'und',
    requested_model VARCHAR(120) NULL,
    resolved_model VARCHAR(120) NULL,
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
    KEY idx_chat_events_user_created (user_id, created_at),
    KEY idx_chat_events_status_created (status, created_at),
    KEY idx_chat_events_kind_created (request_kind, created_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

export async function ensureChatSchema() {
  if (globalThis.__nadeulhaeChatSchemaPromise) {
    return globalThis.__nadeulhaeChatSchemaPromise
  }

  const bootstrapPromise = (async () => {
    const pool = getDbPool()
    await pool.query(createChatMessagesTableSql)
    await pool.query(createChatMemoryTableSql)
    await pool.query(createChatUsageDailyTableSql)
    await pool.query(createChatRequestEventsTableSql)
  })()

  globalThis.__nadeulhaeChatSchemaPromise = bootstrapPromise.catch((error) => {
    globalThis.__nadeulhaeChatSchemaPromise = undefined
    throw error
  })

  return globalThis.__nadeulhaeChatSchemaPromise
}
