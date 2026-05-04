/**
 * Chat database schema management and data migration.
 *
 * Creates / migrates the five user_chat_* tables (messages, sessions, memory,
 * usage_daily, request_events) on first access via {@link ensureChatSchema}.
 * Also runs one-shot content-encryption migrations that re-encrypt plaintext
 * columns with the application-level encryption layer.
 *
 * All migrations are idempotent — safe to call on every server start.
 */

import { getDbPool } from "@/lib/db"
import { decryptDatabaseValueSafely, encryptDatabaseValue, isEncryptedDatabaseValue } from "@/lib/security/data-protection"
import type { RowDataPacket } from "mysql2/promise"

/**
 * Module-level singleton guard.
 * Once the schema bootstrap promise settles (success or failure), subsequent
 * calls return the cached promise so concurrent requests share the same
 * bootstrap cycle.
 */
declare global {
  var __nadeulhaeChatSchemaPromise: Promise<void> | undefined
}

const createChatMessagesTableSql = `
  CREATE TABLE IF NOT EXISTS user_chat_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    session_id BIGINT NULL,
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
    KEY idx_chat_messages_user_memory (user_id, included_in_memory_at, id),
    KEY idx_chat_messages_user_session_created (user_id, session_id, created_at),
    KEY idx_chat_messages_user_session_memory (user_id, session_id, included_in_memory_at, id)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createChatSessionsTableSql = `
  CREATE TABLE IF NOT EXISTS user_chat_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    title VARCHAR(512) NOT NULL,
    locale VARCHAR(8) NOT NULL DEFAULT 'und',
    is_auto_title TINYINT(1) NOT NULL DEFAULT 1,
    memory_summary_text LONGTEXT NULL,
    memory_token_estimate INT UNSIGNED NOT NULL DEFAULT 0,
    summarized_message_count INT UNSIGNED NOT NULL DEFAULT 0,
    memory_model_used VARCHAR(120) NULL,
    last_compacted_at DATETIME NULL,
    last_message_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_chat_sessions_user_updated (user_id, updated_at),
    KEY idx_chat_sessions_user_created (user_id, created_at),
    KEY idx_chat_sessions_user_last_message (user_id, last_message_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createChatMemoryTableSql = `
  CREATE TABLE IF NOT EXISTS user_chat_memory (
    user_id CHAR(36) PRIMARY KEY,
    summary_text LONGTEXT NOT NULL,
    assessment_text LONGTEXT NULL,
    summary_token_estimate INT UNSIGNED NOT NULL DEFAULT 0,
    summarized_message_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_profile_message_id BIGINT NULL,
    model_used VARCHAR(120) NULL,
    profile_model_used VARCHAR(120) NULL,
    last_compacted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    profile_refreshed_at DATETIME NULL,
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
    session_id BIGINT NULL,
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
    KEY idx_chat_events_user_session_created (user_id, session_id, created_at),
    KEY idx_chat_events_status_created (status, created_at),
    KEY idx_chat_events_kind_created (request_kind, created_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const addChatMessagesSessionIdColumnSql = `
  ALTER TABLE user_chat_messages
    ADD COLUMN IF NOT EXISTS session_id BIGINT NULL AFTER user_id
`

const addChatMessagesSessionCreatedIndexSql = `
  ALTER TABLE user_chat_messages
    ADD KEY idx_chat_messages_user_session_created (user_id, session_id, created_at)
`

const addChatMessagesSessionMemoryIndexSql = `
  ALTER TABLE user_chat_messages
    ADD KEY idx_chat_messages_user_session_memory (user_id, session_id, included_in_memory_at, id)
`

const addChatRequestEventsSessionIdColumnSql = `
  ALTER TABLE user_chat_request_events
    ADD COLUMN IF NOT EXISTS session_id BIGINT NULL AFTER user_id
`

const addChatRequestEventsSessionIndexSql = `
  ALTER TABLE user_chat_request_events
    ADD KEY idx_chat_events_user_session_created (user_id, session_id, created_at)
`

const addChatMemoryAssessmentTextColumnSql = `
  ALTER TABLE user_chat_memory
    ADD COLUMN IF NOT EXISTS assessment_text LONGTEXT NULL AFTER summary_text
`

const addChatMemoryLastProfileMessageIdColumnSql = `
  ALTER TABLE user_chat_memory
    ADD COLUMN IF NOT EXISTS last_profile_message_id BIGINT NULL AFTER summarized_message_count
`

const addChatMemoryProfileModelUsedColumnSql = `
  ALTER TABLE user_chat_memory
    ADD COLUMN IF NOT EXISTS profile_model_used VARCHAR(120) NULL AFTER model_used
`

const addChatMemoryProfileRefreshedAtColumnSql = `
  ALTER TABLE user_chat_memory
    ADD COLUMN IF NOT EXISTS profile_refreshed_at DATETIME NULL AFTER last_compacted_at
`

/** Row shape for the chat-message-content encryption migration */
interface ChatMessageMigrationRow extends RowDataPacket {
  id: number
  role: "user" | "assistant"
  content: string
}

/** Row shape for the memory-summary encryption migration */
interface ChatMemoryMigrationRow extends RowDataPacket {
  user_id: string
  summary_text: string
}

/** Row shape for the memory-assessment encryption migration */
interface ChatMemoryAssessmentMigrationRow extends RowDataPacket {
  user_id: string
  assessment_text: string | null
}

/** Row shape for the session-memory-summary encryption migration */
interface ChatSessionMemoryMigrationRow extends RowDataPacket {
  id: number
  memory_summary_text: string | null
}

/** Safety cap: at most 200 batches (40 000 rows) per migration to avoid runaway loops */
const MAX_MIGRATION_BATCHES = 200

/**
 * Execute a DDL statement, ignoring MySQL "duplicate key name" errors.
 *
 * Some ALTER TABLE ADD KEY statements may fail on replicas or concurrent
 * schema changes. This helper silences those expected errors while still
 * propagating unexpected failures.
 */
async function runIgnoreDuplicateKey(sql: string) {
  try {
    await getDbPool().query(sql)
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : ""

    if (code === "ER_DUP_KEYNAME" || code === "ER_MULTIPLE_PRI_KEY") {
      return
    }

    throw error
  }
}

/**
 * One-shot migration: encrypt all user_chat_messages.content values.
 *
 * Reads rows whose content does NOT already start with "enc:v1:", decrypts
 * (in case of partial migration), and re-encrypts under the app key.
 * Processes 200 rows per batch, up to MAX_MIGRATION_BATCHES batches.
 */
async function migrateChatMessageContents() {
  const pool = getDbPool()

  // Process up to 200 batches of 200 rows each to avoid long-running transactions
  for (let i = 0; i < MAX_MIGRATION_BATCHES; i++) {
    const [rows] = await pool.query<ChatMessageMigrationRow[]>(
      `
        SELECT id, role, content
        FROM user_chat_messages
        WHERE content NOT LIKE 'enc:v1:%'
        LIMIT 200
      `
    )

    // All remaining rows are already encrypted — migration complete
    if (rows.length === 0) {
      return
    }

    for (const row of rows) {
      // Safely attempt decryption; if it fails, treat raw value as plaintext
      const plain = decryptDatabaseValueSafely(row.content, `chat.message.${row.role}`) ?? row.content
      await pool.execute(
        `
          UPDATE user_chat_messages
          SET content = ?
          WHERE id = ?
        `,
        [
          // Idempotent: if already encrypted, keep as-is; otherwise encrypt
          isEncryptedDatabaseValue(row.content)
            ? row.content
            : encryptDatabaseValue(plain, `chat.message.${row.role}`),
          row.id,
        ]
      )
    }
  }
}

/**
 * One-shot migration: encrypt user_chat_memory.summary_text.
 *
 * Same batch pattern as migrateChatMessageContents. Targets rows where
 * summary_text does not already carry the "enc:v1:" prefix.
 */
async function migrateChatMemorySummaries() {
  const pool = getDbPool()

  for (let i = 0; i < MAX_MIGRATION_BATCHES; i++) {
    const [rows] = await pool.query<ChatMemoryMigrationRow[]>(
      `
        SELECT user_id, summary_text
        FROM user_chat_memory
        WHERE summary_text NOT LIKE 'enc:v1:%'
        LIMIT 200
      `
    )

    if (rows.length === 0) {
      return
    }

    for (const row of rows) {
      const plain = decryptDatabaseValueSafely(row.summary_text, "chat.memory.summary") ?? row.summary_text
      await pool.execute(
        `
          UPDATE user_chat_memory
          SET summary_text = ?
          WHERE user_id = ?
        `,
        [
          isEncryptedDatabaseValue(row.summary_text)
            ? row.summary_text
            : encryptDatabaseValue(plain, "chat.memory.summary"),
          row.user_id,
        ]
      )
    }
  }
}

/**
 * One-shot migration: encrypt user_chat_memory.assessment_text.
 *
 * Only processes non-null, non-empty, non-encrypted rows.
 */
async function migrateChatMemoryAssessments() {
  const pool = getDbPool()

  for (let i = 0; i < MAX_MIGRATION_BATCHES; i++) {
    const [rows] = await pool.query<ChatMemoryAssessmentMigrationRow[]>(
      `
        SELECT user_id, assessment_text
        FROM user_chat_memory
        WHERE assessment_text IS NOT NULL
          AND assessment_text <> ''
          AND assessment_text NOT LIKE 'enc:v1:%'
        LIMIT 200
      `
    )

    if (rows.length === 0) {
      return
    }

    for (const row of rows) {
      const plain = decryptDatabaseValueSafely(row.assessment_text, "chat.profile.assessment") ?? row.assessment_text
      await pool.execute(
        `
          UPDATE user_chat_memory
          SET assessment_text = ?
          WHERE user_id = ?
        `,
        [
          row.assessment_text && isEncryptedDatabaseValue(row.assessment_text)
            ? row.assessment_text
            : encryptDatabaseValue(plain || "", "chat.profile.assessment"),
          row.user_id,
        ]
      )
    }
  }
}

/**
 * One-shot migration: encrypt user_chat_sessions.memory_summary_text.
 *
 * Only processes non-null, non-empty, non-encrypted session memory rows.
 */
async function migrateChatSessionMemorySummaries() {
  const pool = getDbPool()

  for (let i = 0; i < MAX_MIGRATION_BATCHES; i++) {
    const [rows] = await pool.query<ChatSessionMemoryMigrationRow[]>(
      `
        SELECT id, memory_summary_text
        FROM user_chat_sessions
        WHERE memory_summary_text IS NOT NULL
          AND memory_summary_text <> ''
          AND memory_summary_text NOT LIKE 'enc:v1:%'
        LIMIT 200
      `
    )

    if (rows.length === 0) {
      return
    }

    for (const row of rows) {
      const plain = decryptDatabaseValueSafely(row.memory_summary_text, "chat.session.memory") ?? row.memory_summary_text
      await pool.execute(
        `
          UPDATE user_chat_sessions
          SET memory_summary_text = ?
          WHERE id = ?
        `,
        [
          row.memory_summary_text && isEncryptedDatabaseValue(row.memory_summary_text)
            ? row.memory_summary_text
            : encryptDatabaseValue(plain || "", "chat.session.memory"),
          row.id,
        ]
      )
    }
  }
}

/**
 * Ensure all chat tables exist and run any pending data migrations.
 *
 * Idempotent — safe to call on every request. Uses a module-level global
 * promise singleton so concurrent requests coalesce into a single
 * bootstrap cycle.
 */
export async function ensureChatSchema() {
  if (globalThis.__nadeulhaeChatSchemaPromise) {
    return globalThis.__nadeulhaeChatSchemaPromise
  }

  const bootstrapPromise = (async () => {
    const pool = getDbPool()

    // Create core tables (IF NOT EXISTS)
    await pool.query(createChatMessagesTableSql)
    await pool.query(createChatSessionsTableSql)
    await pool.query(createChatMemoryTableSql)
    await pool.query(createChatUsageDailyTableSql)
    await pool.query(createChatRequestEventsTableSql)

    // Migrate schema: add columns and indexes that were introduced after v1
    await pool.query(addChatMessagesSessionIdColumnSql)
    await runIgnoreDuplicateKey(addChatMessagesSessionCreatedIndexSql)
    await runIgnoreDuplicateKey(addChatMessagesSessionMemoryIndexSql)

    await pool.query(addChatRequestEventsSessionIdColumnSql)
    await runIgnoreDuplicateKey(addChatRequestEventsSessionIndexSql)

    await pool.query(addChatMemoryAssessmentTextColumnSql)
    await pool.query(addChatMemoryLastProfileMessageIdColumnSql)
    await pool.query(addChatMemoryProfileModelUsedColumnSql)
    await pool.query(addChatMemoryProfileRefreshedAtColumnSql)

    // One-shot encryption migrations for existing plaintext data
    await migrateChatMessageContents()
    await migrateChatMemorySummaries()
    await migrateChatMemoryAssessments()
    await migrateChatSessionMemorySummaries()
  })()

  globalThis.__nadeulhaeChatSchemaPromise = bootstrapPromise.catch((error) => {
    globalThis.__nadeulhaeChatSchemaPromise = undefined
    throw error
  })

  return globalThis.__nadeulhaeChatSchemaPromise
}
