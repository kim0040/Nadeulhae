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
    nickname VARCHAR(700) NOT NULL DEFAULT '',
    nickname_hash CHAR(64) NOT NULL,
    nickname_tag CHAR(4) NOT NULL DEFAULT '0000',
    password_hash CHAR(128) NOT NULL,
    password_salt CHAR(32) NOT NULL,
    password_algo VARCHAR(24) NOT NULL DEFAULT 'scrypt-v1',
    age_band VARCHAR(700) NOT NULL,
    primary_region VARCHAR(700) NOT NULL,
    interest_tags LONGTEXT NOT NULL,
    interest_other VARCHAR(120) NULL,
    preferred_time_slot VARCHAR(700) NOT NULL,
    weather_sensitivity LONGTEXT NOT NULL,
    terms_agreed_at DATETIME NOT NULL,
    privacy_agreed_at DATETIME NOT NULL,
    age_confirmed_at DATETIME NOT NULL,
    marketing_accepted TINYINT(1) NOT NULL DEFAULT 0,
    marketing_agreed_at DATETIME NULL,
    analytics_accepted TINYINT(1) NOT NULL DEFAULT 0,
    analytics_agreed_at DATETIME NULL,
    lab_enabled TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email_hash (email_hash),
    UNIQUE KEY uq_users_nickname_hash_tag (nickname_hash, nickname_tag)
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

const modifyUsersNicknameColumnSql = `
  ALTER TABLE users
    MODIFY COLUMN nickname VARCHAR(700) NOT NULL
`

const addUsersNicknameHashColumnSql = `
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS nickname_hash CHAR(64) NULL AFTER nickname
`

const addUsersNicknameHashUniqueIndexSql = `
  ALTER TABLE users
    ADD UNIQUE KEY uq_users_nickname_hash_tag (nickname_hash, nickname_tag)
`

const dropUsersNicknameLegacyUniqueIndexSql = `
  ALTER TABLE users
    DROP INDEX IF EXISTS uq_users_nickname_tag
`

const modifyUsersAgeBandColumnSql = `
  ALTER TABLE users
    MODIFY COLUMN age_band VARCHAR(700) NOT NULL
`

const modifyUsersPrimaryRegionColumnSql = `
  ALTER TABLE users
    MODIFY COLUMN primary_region VARCHAR(700) NOT NULL
`

const modifyUsersInterestTagsColumnSql = `
  ALTER TABLE users
    MODIFY COLUMN interest_tags LONGTEXT NOT NULL
`

const modifyUsersInterestOtherColumnSql = `
  ALTER TABLE users
    MODIFY COLUMN interest_other VARCHAR(512) NULL
`

const modifyUsersPreferredTimeSlotColumnSql = `
  ALTER TABLE users
    MODIFY COLUMN preferred_time_slot VARCHAR(700) NOT NULL
`

const modifyUsersWeatherSensitivityColumnSql = `
  ALTER TABLE users
    MODIFY COLUMN weather_sensitivity LONGTEXT NOT NULL
`

const addNicknameColumnSql = `
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS nickname VARCHAR(700) NOT NULL DEFAULT '' AFTER display_name
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

const addLabEnabledColumnSql = `
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS lab_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER analytics_agreed_at
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
    ip_address VARCHAR(700) NULL,
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
    MODIFY COLUMN ip_address VARCHAR(700) NULL
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
    ip_address VARCHAR(700) NULL,
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
    MODIFY COLUMN ip_address VARCHAR(700) NULL
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
  nickname: string
  nickname_hash: string | null
  age_band: string
  primary_region: string
  interest_tags: string | string[]
  interest_other: string | null
  preferred_time_slot: string
  weather_sensitivity: string | string[]
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
const MAX_EMAIL_PLAIN_LENGTH = 254
const MAX_IP_PLAIN_LENGTH = 64
const MAX_USER_AGENT_PLAIN_LENGTH = 255

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function normalizeNickname(value: string) {
  return value.trim().normalize("NFKC")
}

function truncateUtf8(value: string, maxBytes: number) {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) {
    return value
  }

  let result = value
  while (result.length > 0 && Buffer.byteLength(result, "utf8") > maxBytes) {
    result = result.slice(0, -1)
  }
  return result
}

function parseJsonStringArray(input: unknown) {
  if (Array.isArray(input)) {
    return input.filter((item): item is string => typeof item === "string")
  }

  if (typeof input !== "string") {
    return [] as string[]
  }

  try {
    const parsed = JSON.parse(input)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}

function readEncryptedOrPlainArrayValue(value: unknown, context: string) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string")
  }

  if (typeof value !== "string") {
    return [] as string[]
  }

  const plain = decryptDatabaseValueSafely(value, context) ?? value
  return parseJsonStringArray(plain)
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
          nickname,
          nickname_hash,
          age_band,
          primary_region,
          interest_tags,
          interest_other,
          preferred_time_slot,
          weather_sensitivity
        FROM users
        WHERE email_hash IS NULL
          OR email NOT LIKE 'enc:v1:%'
          OR display_name NOT LIKE 'enc:v1:%'
          OR nickname_hash IS NULL
          OR nickname NOT LIKE 'enc:v1:%'
          OR age_band NOT LIKE 'enc:v1:%'
          OR primary_region NOT LIKE 'enc:v1:%'
          OR interest_tags NOT LIKE 'enc:v1:%'
          OR (interest_other IS NOT NULL AND interest_other <> '' AND interest_other NOT LIKE 'enc:v1:%')
          OR preferred_time_slot NOT LIKE 'enc:v1:%'
          OR weather_sensitivity NOT LIKE 'enc:v1:%'
        LIMIT 200
      `
    )

    if (rows.length === 0) {
      return
    }

    for (const row of rows) {
      const emailPlain = normalizeEmail(decryptDatabaseValueSafely(row.email, "users.email") ?? row.email)
      const displayNamePlain = decryptDatabaseValueSafely(row.display_name, "users.display_name") ?? row.display_name
      const nicknamePlainCandidate = normalizeNickname(
        decryptDatabaseValueSafely(row.nickname, "users.nickname") ?? row.nickname
      )
      const nicknamePlain = nicknamePlainCandidate || displayNamePlain
      const ageBandPlain = decryptDatabaseValueSafely(row.age_band, "users.age_band") ?? row.age_band
      const primaryRegionPlain = decryptDatabaseValueSafely(row.primary_region, "users.primary_region") ?? row.primary_region
      const interestTagsPlain = readEncryptedOrPlainArrayValue(row.interest_tags, "users.interest_tags")
      const interestOtherPlain = decryptDatabaseValueSafely(row.interest_other, "users.interest_other")
      const preferredTimeSlotPlain = decryptDatabaseValueSafely(
        row.preferred_time_slot,
        "users.preferred_time_slot"
      ) ?? row.preferred_time_slot
      const weatherSensitivityPlain = readEncryptedOrPlainArrayValue(
        row.weather_sensitivity,
        "users.weather_sensitivity"
      )

      await pool.execute(
        `
          UPDATE users
          SET
            email = ?,
            email_hash = ?,
            display_name = ?,
            nickname = ?,
            nickname_hash = ?,
            age_band = ?,
            primary_region = ?,
            interest_tags = ?,
            interest_other = ?,
            preferred_time_slot = ?,
            weather_sensitivity = ?
          WHERE id = ?
        `,
        [
          isEncryptedDatabaseValue(row.email) ? row.email : encryptDatabaseValue(emailPlain, "users.email"),
          createBlindIndex(emailPlain, "users.email"),
          isEncryptedDatabaseValue(row.display_name) ? row.display_name : encryptDatabaseValue(displayNamePlain, "users.display_name"),
          isEncryptedDatabaseValue(row.nickname) ? row.nickname : encryptDatabaseValue(nicknamePlain, "users.nickname"),
          createBlindIndex(nicknamePlain, "users.nickname"),
          isEncryptedDatabaseValue(row.age_band) ? row.age_band : encryptDatabaseValue(ageBandPlain, "users.age_band"),
          isEncryptedDatabaseValue(row.primary_region)
            ? row.primary_region
            : encryptDatabaseValue(primaryRegionPlain, "users.primary_region"),
          isEncryptedDatabaseValue(String(row.interest_tags))
            ? String(row.interest_tags)
            : encryptDatabaseValue(JSON.stringify(interestTagsPlain), "users.interest_tags"),
          interestOtherPlain
            ? (row.interest_other && isEncryptedDatabaseValue(row.interest_other)
              ? row.interest_other
              : encryptDatabaseValue(interestOtherPlain, "users.interest_other"))
            : null,
          isEncryptedDatabaseValue(row.preferred_time_slot)
            ? row.preferred_time_slot
            : encryptDatabaseValue(preferredTimeSlotPlain, "users.preferred_time_slot"),
          isEncryptedDatabaseValue(String(row.weather_sensitivity))
            ? String(row.weather_sensitivity)
            : encryptDatabaseValue(JSON.stringify(weatherSensitivityPlain), "users.weather_sensitivity"),
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
      const normalizedUserAgent = row.user_agent
        ? truncateUtf8(row.user_agent, MAX_USER_AGENT_PLAIN_LENGTH)
        : null
      const normalizedIpAddress = row.ip_address
        ? truncateUtf8(row.ip_address, MAX_IP_PLAIN_LENGTH)
        : null

      await pool.execute(
        `
          UPDATE user_sessions
          SET
            user_agent = ?,
            ip_address = ?
          WHERE id = ?
        `,
        [
          row.user_agent && isEncryptedDatabaseValue(row.user_agent)
            ? row.user_agent
            : encryptDatabaseValueSafely(normalizedUserAgent, "sessions.user_agent"),
          row.ip_address && isEncryptedDatabaseValue(row.ip_address)
            ? row.ip_address
            : encryptDatabaseValueSafely(normalizedIpAddress, "sessions.ip_address"),
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
        WHERE (
          email IS NOT NULL
          AND email <> ''
          AND (
            email NOT LIKE 'enc:v1:%'
            OR email_hash IS NULL
          )
        )
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
        ? truncateUtf8(
          normalizeEmail(decryptDatabaseValueSafely(row.email, "auth.events.email") ?? row.email),
          MAX_EMAIL_PLAIN_LENGTH
        )
        : null
      const ipAddressPlain = row.ip_address
        ? truncateUtf8(
          decryptDatabaseValueSafely(row.ip_address, "auth.events.ip_address") ?? row.ip_address,
          MAX_IP_PLAIN_LENGTH
        )
        : null
      const userAgentPlain = row.user_agent
        ? truncateUtf8(
          decryptDatabaseValueSafely(row.user_agent, "auth.events.user_agent") ?? row.user_agent,
          MAX_USER_AGENT_PLAIN_LENGTH
        )
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
          row.ip_address && isEncryptedDatabaseValue(row.ip_address)
            ? row.ip_address
            : encryptDatabaseValueSafely(ipAddressPlain, "auth.events.ip_address"),
          row.user_agent && isEncryptedDatabaseValue(row.user_agent)
            ? row.user_agent
            : encryptDatabaseValueSafely(userAgentPlain, "auth.events.user_agent"),
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
    await pool.query(addNicknameColumnSql)
    await pool.query(addNicknameTagColumnSql)
    await pool.query(modifyUsersNicknameColumnSql)
    await pool.query(addUsersNicknameHashColumnSql)
    await pool.query(modifyUsersAgeBandColumnSql)
    await pool.query(modifyUsersPrimaryRegionColumnSql)
    await pool.query(modifyUsersInterestTagsColumnSql)
    await pool.query(modifyUsersInterestOtherColumnSql)
    await pool.query(modifyUsersPreferredTimeSlotColumnSql)
    await pool.query(modifyUsersWeatherSensitivityColumnSql)
    await pool.query(dropUsersNicknameLegacyUniqueIndexSql)
    await runIgnoreDuplicateKey(addUsersNicknameHashUniqueIndexSql)
    await pool.query(addAnalyticsAcceptedColumnSql)
    await pool.query(addAnalyticsAgreedAtColumnSql)
    await pool.query(addLabEnabledColumnSql)
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
    console.error("[auth-schema] Bootstrap failed:", error.message ?? error)
  })

  return globalThis.__nadeulhaeAuthSchemaPromise
}
