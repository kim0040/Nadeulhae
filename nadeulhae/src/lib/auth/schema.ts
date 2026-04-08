import { getDbPool } from "@/lib/db"

declare global {
  var __nadeulhaeAuthSchemaPromise: Promise<void> | undefined
}

const createUsersTableSql = `
  CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    password_hash CHAR(128) NOT NULL,
    password_salt CHAR(32) NOT NULL,
    password_algo VARCHAR(24) NOT NULL DEFAULT 'scrypt-v1',
    age_band VARCHAR(24) NOT NULL,
    primary_region VARCHAR(32) NOT NULL,
    interest_tags JSON NOT NULL,
    interest_other VARCHAR(120) NULL,
    preferred_time_slot VARCHAR(32) NOT NULL,
    weather_sensitivity JSON NOT NULL,
    terms_agreed_at DATETIME NOT NULL,
    privacy_agreed_at DATETIME NOT NULL,
    age_confirmed_at DATETIME NOT NULL,
    marketing_accepted TINYINT(1) NOT NULL DEFAULT 0,
    marketing_agreed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createSessionsTableSql = `
  CREATE TABLE IF NOT EXISTS user_sessions (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_agent VARCHAR(255) NULL,
    ip_address VARCHAR(64) NULL,
    UNIQUE KEY uq_user_sessions_token_hash (token_hash),
    KEY idx_user_sessions_user_id (user_id),
    KEY idx_user_sessions_expires_at (expires_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createAttemptBucketsTableSql = `
  CREATE TABLE IF NOT EXISTS auth_attempt_buckets (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    action VARCHAR(32) NOT NULL,
    scope_key VARCHAR(191) NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    window_started_at DATETIME NOT NULL,
    last_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    blocked_until DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_auth_attempt_scope (action, scope_key),
    KEY idx_auth_attempt_blocked (action, blocked_until),
    KEY idx_auth_attempt_last (last_attempt_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createSecurityEventsTableSql = `
  CREATE TABLE IF NOT EXISTS auth_security_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    event_type VARCHAR(48) NOT NULL,
    action VARCHAR(24) NOT NULL,
    outcome VARCHAR(24) NOT NULL,
    user_id CHAR(36) NULL,
    email VARCHAR(255) NULL,
    ip_address VARCHAR(64) NULL,
    user_agent VARCHAR(255) NULL,
    metadata JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_auth_event_created (created_at),
    KEY idx_auth_event_email (email),
    KEY idx_auth_event_user (user_id)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

export async function ensureAuthSchema() {
  if (globalThis.__nadeulhaeAuthSchemaPromise) {
    return globalThis.__nadeulhaeAuthSchemaPromise
  }

  const bootstrapPromise = (async () => {
    const pool = getDbPool()
    await pool.query(createUsersTableSql)
    await pool.query(createSessionsTableSql)
    await pool.query(createAttemptBucketsTableSql)
    await pool.query(createSecurityEventsTableSql)
  })()

  globalThis.__nadeulhaeAuthSchemaPromise = bootstrapPromise.catch((error) => {
    globalThis.__nadeulhaeAuthSchemaPromise = undefined
    throw error
  })

  return globalThis.__nadeulhaeAuthSchemaPromise
}
