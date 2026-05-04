/**
 * Code Share schema management.
 *
 * Lazily bootstraps the DDL for `code_share_sessions` on first data
 * access. Uses a process-global singleton promise so concurrent
 * requests do not race on table creation.
 */
import { getDbPool } from "@/lib/db"

declare global {
  // Process-local singleton so concurrent requests do not race on DDL.
  var __nadeulhaeCodeShareSchemaPromise: Promise<void> | undefined
}

const createCodeShareSessionsTableSql = `
  CREATE TABLE IF NOT EXISTS code_share_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    session_id VARCHAR(48) NOT NULL,
    owner_actor_id CHAR(36) NOT NULL,
    owner_user_id CHAR(36) NULL,
    title_text VARCHAR(191) NOT NULL,
    language_code VARCHAR(64) NOT NULL,
    code_text LONGTEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_code_share_session_id (session_id),
    KEY idx_code_share_owner_actor_created (owner_actor_id, created_at),
    KEY idx_code_share_owner_user_created (owner_user_id, created_at),
    KEY idx_code_share_status_activity (status, last_activity_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

/**
 * Ensures the `code_share_sessions` table exists.
 *
 * Idempotent across concurrent calls — reuses the in-flight
 * bootstrap promise. Resets the promise on failure so the
 * next caller retries schema creation.
 */
export async function ensureCodeShareSchema() {
  // Reuse the in-flight bootstrap promise for all callers.
  if (globalThis.__nadeulhaeCodeShareSchemaPromise) {
    return globalThis.__nadeulhaeCodeShareSchemaPromise
  }

  const bootstrapPromise = (async () => {
    const pool = getDbPool()
    await pool.query(createCodeShareSessionsTableSql)
  })()

  globalThis.__nadeulhaeCodeShareSchemaPromise = bootstrapPromise.catch((error) => {
    // Allow retry on the next call if first bootstrap failed.
    globalThis.__nadeulhaeCodeShareSchemaPromise = undefined
    throw error
  })

  return globalThis.__nadeulhaeCodeShareSchemaPromise
}
