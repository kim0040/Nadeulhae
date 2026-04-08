import { getDbPool } from "@/lib/db"
import type { RowDataPacket } from "mysql2/promise"
import {
  createBlindIndex,
  decryptDatabaseValueSafely,
  encryptDatabaseValue,
  encryptDatabaseValueSafely,
  isEncryptedDatabaseValue,
} from "@/lib/security/data-protection"

declare global {
  var __nadeulhaeAuthSchemaPromise: Promise<void> | undefined
}

const createUsersTableSql = `
  CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(700) NOT NULL,
    email_hash CHAR(64) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    nickname VARCHAR(32) NOT NULL DEFAULT '',
    nickname_tag CHAR(4) NOT NULL DEFAULT '0000',
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
    analytics_accepted TINYINT(1) NOT NULL DEFAULT 0,
    analytics_agreed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email_hash (email_hash),
    UNIQUE KEY uq_users_nickname_tag (nickname, nickname_tag)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const modifyUsersEmailColumnSql = `
  ALTER TABLE users
    MODIFY COLUMN email VARCHAR(700) NOT NULL
`

const addUsersEmailHashColumnSql = `
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_hash CHAR(64) NULL AFTER email
`

const addUsersEmailHashUniqueIndexSql = `
  ALTER TABLE users
    ADD UNIQUE KEY uq_users_email_hash (email_hash)
`

const modifyUsersDisplayNameColumnSql = `
  ALTER TABLE users
    MODIFY COLUMN display_name VARCHAR(255) NOT NULL
`

const modifyUsersInterestOtherColumnSql = `
  ALTER TABLE users
    MODIFY COLUMN interest_other VARCHAR(512) NULL
`

const addNicknameColumnSql = `
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS nickname VARCHAR(32) NOT NULL DEFAULT '' AFTER display_name
`

const addNicknameTagColumnSql = `
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS nickname_tag CHAR(4) NOT NULL DEFAULT '0000' AFTER nickname
`

const addAnalyticsAcceptedColumnSql = `
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS analytics_accepted TINYINT(1) NOT NULL DEFAULT 0 AFTER marketing_agreed_at
`

const addAnalyticsAgreedAtColumnSql = `
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS analytics_agreed_at DATETIME NULL AFTER analytics_accepted
`

const createSessionsTableSql = `
  CREATE TABLE IF NOT EXISTS user_sessions (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_agent VARCHAR(700) NULL,
    ip_address VARCHAR(255) NULL,
    UNIQUE KEY uq_user_sessions_token_hash (token_hash),
    KEY idx_user_sessions_user_id (user_id),
    KEY idx_user_sessions_expires_at (expires_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const modifySessionUserAgentColumnSql = `
  ALTER TABLE user_sessions
    MODIFY COLUMN user_agent VARCHAR(700) NULL
`

const modifySessionIpAddressColumnSql = `
  ALTER TABLE user_sessions
    MODIFY COLUMN ip_address VARCHAR(255) NULL
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
    email VARCHAR(700) NULL,
    email_hash CHAR(64) NULL,
    ip_address VARCHAR(255) NULL,
    user_agent VARCHAR(700) NULL,
    metadata JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_auth_event_created (created_at),
    KEY idx_auth_event_email_hash (email_hash),
    KEY idx_auth_event_user (user_id)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const modifySecurityEventEmailColumnSql = `
  ALTER TABLE auth_security_events
    MODIFY COLUMN email VARCHAR(700) NULL
`

const addSecurityEventEmailHashColumnSql = `
  ALTER TABLE auth_security_events
    ADD COLUMN IF NOT EXISTS email_hash CHAR(64) NULL AFTER email
`

const addSecurityEventEmailHashIndexSql = `
  ALTER TABLE auth_security_events
    ADD KEY idx_auth_event_email_hash (email_hash)
`

const modifySecurityEventIpAddressColumnSql = `
  ALTER TABLE auth_security_events
    MODIFY COLUMN ip_address VARCHAR(255) NULL
`

const modifySecurityEventUserAgentColumnSql = `
  ALTER TABLE auth_security_events
    MODIFY COLUMN user_agent VARCHAR(700) NULL
`

interface MigrationUserRow extends RowDataPacket {
  id: string
  email: string
  email_hash: string | null
  display_name: string
  interest_other: string | null
}

interface MigrationSessionRow extends RowDataPacket {
  id: string
  user_agent: string | null
  ip_address: string | null
}

interface MigrationSecurityEventRow extends RowDataPacket {
  id: number
  email: string | null
  email_hash: string | null
  ip_address: string | null
  user_agent: string | null
}

const MAX_MIGRATION_BATCHES = 200

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

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

async function migrateUsersSensitiveColumns() {
  const pool = getDbPool()

  for (let i = 0; i < MAX_MIGRATION_BATCHES; i++) {
    const [rows] = await pool.query<MigrationUserRow[]>(
      `
        SELECT
          id,
          email,
          email_hash,
          display_name,
          interest_other
        FROM users
        WHERE email_hash IS NULL
          OR email NOT LIKE 'enc:v1:%'
          OR display_name NOT LIKE 'enc:v1:%'
          OR (interest_other IS NOT NULL AND interest_other <> '' AND interest_other NOT LIKE 'enc:v1:%')
        LIMIT 200
      `
    )

    if (rows.length === 0) {
      return
    }

    for (const row of rows) {
      const emailPlain = normalizeEmail(decryptDatabaseValueSafely(row.email, "users.email") ?? row.email)
      const displayNamePlain = decryptDatabaseValueSafely(row.display_name, "users.display_name") ?? row.display_name
      const interestOtherPlain = decryptDatabaseValueSafely(row.interest_other, "users.interest_other")

      await pool.execute(
        `
          UPDATE users
          SET
            email = ?,
            email_hash = ?,
            display_name = ?,
            interest_other = ?
          WHERE id = ?
        `,
        [
          isEncryptedDatabaseValue(row.email) ? row.email : encryptDatabaseValue(emailPlain, "users.email"),
          createBlindIndex(emailPlain, "users.email"),
          isEncryptedDatabaseValue(row.display_name) ? row.display_name : encryptDatabaseValue(displayNamePlain, "users.display_name"),
          interestOtherPlain
            ? (row.interest_other && isEncryptedDatabaseValue(row.interest_other)
              ? row.interest_other
              : encryptDatabaseValue(interestOtherPlain, "users.interest_other"))
            : null,
          row.id,
        ]
      )
    }
  }
}

async function migrateSessionSensitiveColumns() {
  const pool = getDbPool()

  for (let i = 0; i < MAX_MIGRATION_BATCHES; i++) {
    const [rows] = await pool.query<MigrationSessionRow[]>(
      `
        SELECT
          id,
          user_agent,
          ip_address
        FROM user_sessions
        WHERE (user_agent IS NOT NULL AND user_agent <> '' AND user_agent NOT LIKE 'enc:v1:%')
          OR (ip_address IS NOT NULL AND ip_address <> '' AND ip_address NOT LIKE 'enc:v1:%')
        LIMIT 200
      `
    )

    if (rows.length === 0) {
      return
    }

    for (const row of rows) {
      await pool.execute(
        `
          UPDATE user_sessions
          SET
            user_agent = ?,
            ip_address = ?
          WHERE id = ?
        `,
        [
          encryptDatabaseValueSafely(row.user_agent, "sessions.user_agent"),
          encryptDatabaseValueSafely(row.ip_address, "sessions.ip_address"),
          row.id,
        ]
      )
    }
  }
}

async function migrateSecurityEventSensitiveColumns() {
  const pool = getDbPool()

  for (let i = 0; i < MAX_MIGRATION_BATCHES; i++) {
    const [rows] = await pool.query<MigrationSecurityEventRow[]>(
      `
        SELECT
          id,
          email,
          email_hash,
          ip_address,
          user_agent
        FROM auth_security_events
        WHERE (email IS NOT NULL AND email <> '' AND email NOT LIKE 'enc:v1:%')
          OR email_hash IS NULL
          OR (ip_address IS NOT NULL AND ip_address <> '' AND ip_address NOT LIKE 'enc:v1:%')
          OR (user_agent IS NOT NULL AND user_agent <> '' AND user_agent NOT LIKE 'enc:v1:%')
        LIMIT 200
      `
    )

    if (rows.length === 0) {
      return
    }

    for (const row of rows) {
      const emailPlain = row.email
        ? normalizeEmail(decryptDatabaseValueSafely(row.email, "auth.events.email") ?? row.email)
        : null

      await pool.execute(
        `
          UPDATE auth_security_events
          SET
            email = ?,
            email_hash = ?,
            ip_address = ?,
            user_agent = ?
          WHERE id = ?
        `,
        [
          emailPlain
            ? (row.email && isEncryptedDatabaseValue(row.email)
              ? row.email
              : encryptDatabaseValue(emailPlain, "auth.events.email"))
            : null,
          emailPlain ? createBlindIndex(emailPlain, "auth.events.email") : null,
          encryptDatabaseValueSafely(row.ip_address, "auth.events.ip_address"),
          encryptDatabaseValueSafely(row.user_agent, "auth.events.user_agent"),
          row.id,
        ]
      )
    }
  }
}

export async function ensureAuthSchema() {
  if (globalThis.__nadeulhaeAuthSchemaPromise) {
    return globalThis.__nadeulhaeAuthSchemaPromise
  }

  const bootstrapPromise = (async () => {
    const pool = getDbPool()
    await pool.query(createUsersTableSql)
    await pool.query(modifyUsersEmailColumnSql)
    await pool.query(addUsersEmailHashColumnSql)
    await runIgnoreDuplicateKey(addUsersEmailHashUniqueIndexSql)
    await pool.query(modifyUsersDisplayNameColumnSql)
    await pool.query(modifyUsersInterestOtherColumnSql)
    await pool.query(addNicknameColumnSql)
    await pool.query(addNicknameTagColumnSql)
    await pool.query(addAnalyticsAcceptedColumnSql)
    await pool.query(addAnalyticsAgreedAtColumnSql)
    await pool.query(createSessionsTableSql)
    await pool.query(modifySessionUserAgentColumnSql)
    await pool.query(modifySessionIpAddressColumnSql)
    await pool.query(createAttemptBucketsTableSql)
    await pool.query(createSecurityEventsTableSql)
    await pool.query(modifySecurityEventEmailColumnSql)
    await pool.query(addSecurityEventEmailHashColumnSql)
    await runIgnoreDuplicateKey(addSecurityEventEmailHashIndexSql)
    await pool.query(modifySecurityEventIpAddressColumnSql)
    await pool.query(modifySecurityEventUserAgentColumnSql)

    await migrateUsersSensitiveColumns()
    await migrateSessionSensitiveColumns()
    await migrateSecurityEventSensitiveColumns()
  })()

  globalThis.__nadeulhaeAuthSchemaPromise = bootstrapPromise.catch((error) => {
    globalThis.__nadeulhaeAuthSchemaPromise = undefined
    throw error
  })

  return globalThis.__nadeulhaeAuthSchemaPromise
}
