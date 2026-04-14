import type { PoolConnection, RowDataPacket } from "mysql2/promise"

import { MAX_ACTIVE_SESSIONS_PER_USER } from "@/lib/auth/guardrails"
import { ensureAuthSchema } from "@/lib/auth/schema"
import type { AuthUser } from "@/lib/auth/types"
import { executeStatement, getDbPool, queryRows } from "@/lib/db"
import {
  createBlindIndex,
  decryptDatabaseValueSafely,
  encryptDatabaseValue,
  encryptDatabaseValueSafely,
} from "@/lib/security/data-protection"

interface UserRow extends RowDataPacket {
  id: string
  email: string
  email_hash: string | null
  display_name: string
  nickname: string
  nickname_hash: string | null
  nickname_tag: string
  password_hash: string
  password_salt: string
  password_algo: string
  age_band: string
  primary_region: string
  interest_tags: string | string[]
  interest_other: string | null
  preferred_time_slot: string
  weather_sensitivity: string | string[]
  marketing_accepted: number
  analytics_accepted: number
  lab_enabled: number
  created_at: Date | string
}

interface SessionJoinRow extends UserRow {
  session_id: string
  session_expires_at: Date | string
}

interface AttemptBucketRow extends RowDataPacket {
  id: number
  action: string
  scope_key: string
  attempt_count: number
  window_started_at: Date | string
  last_attempt_at: Date | string
  blocked_until: Date | string | null
}

export interface AuthRateLimitDecision {
  blocked: boolean
  attemptCount: number
  retryAfterSeconds: number
}

export interface AuthSecurityEventInput {
  eventType: string
  action: string
  outcome: "success" | "failed" | "blocked" | "rejected"
  userId?: string | null
  email?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown> | null
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string")
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : []
    } catch {
      return []
    }
  }

  return []
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function normalizeNickname(value: string) {
  return value.trim().normalize("NFKC")
}

function parseEncryptedJsonArray(value: unknown, context: string) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string")
  }

  if (typeof value !== "string") {
    return []
  }

  const plain = decryptDatabaseValueSafely(value, context) ?? value
  return parseJsonArray(plain)
}

function toIsoString(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function toPublicUser(row: Pick<
  UserRow,
  | "id"
  | "email"
  | "display_name"
  | "nickname"
  | "nickname_tag"
  | "age_band"
  | "primary_region"
  | "interest_tags"
  | "interest_other"
  | "preferred_time_slot"
  | "weather_sensitivity"
  | "marketing_accepted"
  | "analytics_accepted"
  | "lab_enabled"
  | "created_at"
>): AuthUser {
  const displayName = decryptDatabaseValueSafely(row.display_name, "users.display_name") ?? row.display_name
  const decryptedNickname = decryptDatabaseValueSafely(row.nickname, "users.nickname")
  const nickname = normalizeNickname(decryptedNickname ?? row.nickname) || displayName
  const ageBand = decryptDatabaseValueSafely(row.age_band, "users.age_band") ?? row.age_band
  const primaryRegion = decryptDatabaseValueSafely(row.primary_region, "users.primary_region") ?? row.primary_region
  const preferredTimeSlot = decryptDatabaseValueSafely(row.preferred_time_slot, "users.preferred_time_slot")
    ?? row.preferred_time_slot

  return {
    id: row.id,
    email: normalizeEmail(decryptDatabaseValueSafely(row.email, "users.email") ?? row.email),
    displayName,
    nickname,
    nicknameTag: row.nickname_tag ?? "0000",
    ageBand,
    primaryRegion,
    interestTags: parseEncryptedJsonArray(row.interest_tags, "users.interest_tags"),
    interestOther: decryptDatabaseValueSafely(row.interest_other, "users.interest_other"),
    preferredTimeSlot,
    weatherSensitivity: parseEncryptedJsonArray(row.weather_sensitivity, "users.weather_sensitivity"),
    marketingAccepted: row.marketing_accepted === 1,
    analyticsAccepted: row.analytics_accepted === 1,
    labEnabled: row.lab_enabled === 1,
    createdAt: toIsoString(row.created_at),
  }
}

export interface StoredUserRecord extends AuthUser {
  passwordHash: string
  passwordSalt: string
  passwordAlgorithm: string
}

function toStoredUser(row: UserRow): StoredUserRecord {
  return {
    ...toPublicUser(row),
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    passwordAlgorithm: row.password_algo,
  }
}

export async function findUserByEmail(email: string) {
  await ensureAuthSchema()
  const normalizedEmail = normalizeEmail(email)
  const emailHash = createBlindIndex(normalizedEmail, "users.email")

  const rows = await queryRows<UserRow[]>(
    `
      SELECT
        id,
        email,
        email_hash,
        display_name,
        nickname,
        nickname_hash,
        nickname_tag,
        password_hash,
        password_salt,
        password_algo,
        age_band,
        primary_region,
        interest_tags,
        interest_other,
        preferred_time_slot,
        weather_sensitivity,
        marketing_accepted,
        analytics_accepted,
        lab_enabled,
        created_at
      FROM users
      WHERE email_hash = ?
         OR email = ?
      LIMIT 1
    `,
    [emailHash, normalizedEmail]
  )

  return rows[0] ? toStoredUser(rows[0]) : null
}

export async function findUserById(userId: string) {
  await ensureAuthSchema()

  const rows = await queryRows<UserRow[]>(
    `
      SELECT
        id,
        email,
        email_hash,
        display_name,
        nickname,
        nickname_hash,
        nickname_tag,
        password_hash,
        password_salt,
        password_algo,
        age_band,
        primary_region,
        interest_tags,
        interest_other,
        preferred_time_slot,
        weather_sensitivity,
        marketing_accepted,
        analytics_accepted,
        lab_enabled,
        created_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId]
  )

  return rows[0] ? toStoredUser(rows[0]) : null
}

async function generateUniqueNicknameTag(nickname: string): Promise<string> {
  const normalizedNickname = normalizeNickname(nickname)
  const nicknameHash = createBlindIndex(normalizedNickname, "users.nickname")
  const maxAttempts = 20
  for (let i = 0; i < maxAttempts; i++) {
    const tag = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    const existing = await queryRows<RowDataPacket[]>(
      'SELECT 1 FROM users WHERE (nickname_hash = ? OR nickname = ?) AND nickname_tag = ? LIMIT 1',
      [nicknameHash, normalizedNickname, tag]
    )
    if (existing.length === 0) return tag
  }
  // Fallback: sequential scan for available tag
  const usedTags = await queryRows<RowDataPacket[]>(
    'SELECT nickname_tag FROM users WHERE nickname_hash = ? OR nickname = ?',
    [nicknameHash, normalizedNickname]
  )
  const usedSet = new Set(usedTags.map(r => r.nickname_tag))
  for (let n = 0; n < 10000; n++) {
    const tag = String(n).padStart(4, '0')
    if (!usedSet.has(tag)) return tag
  }
  throw new Error('All nickname tags exhausted for this nickname')
}

export async function createUser(input: {
  id: string
  email: string
  displayName: string
  nickname: string
  passwordHash: string
  passwordSalt: string
  passwordAlgorithm: string
  ageBand: string
  primaryRegion: string
  interestTags: string[]
  interestOther: string
  preferredTimeSlot: string
  weatherSensitivity: string[]
  marketingAccepted: boolean
  analyticsAccepted: boolean
  labEnabled?: boolean
  agreedAt: Date
}) {
  await ensureAuthSchema()

  const normalizedEmail = normalizeEmail(input.email)
  const normalizedNickname = normalizeNickname(input.nickname)
  const nicknameTag = await generateUniqueNicknameTag(normalizedNickname)
  const normalizedInterestTags = Array.isArray(input.interestTags)
    ? input.interestTags.filter((item): item is string => typeof item === "string")
    : []
  const normalizedWeatherSensitivity = Array.isArray(input.weatherSensitivity)
    ? input.weatherSensitivity.filter((item): item is string => typeof item === "string")
    : []

  await executeStatement(
    `
      INSERT INTO users (
        id,
        email,
        email_hash,
        display_name,
        nickname,
        nickname_hash,
        nickname_tag,
        password_hash,
        password_salt,
        password_algo,
        age_band,
        primary_region,
        interest_tags,
        interest_other,
        preferred_time_slot,
        weather_sensitivity,
        terms_agreed_at,
        privacy_agreed_at,
        age_confirmed_at,
        marketing_accepted,
        marketing_agreed_at,
        analytics_accepted,
        analytics_agreed_at,
        lab_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.id,
      encryptDatabaseValue(normalizedEmail, "users.email"),
      createBlindIndex(normalizedEmail, "users.email"),
      encryptDatabaseValue(input.displayName, "users.display_name"),
      encryptDatabaseValue(normalizedNickname, "users.nickname"),
      createBlindIndex(normalizedNickname, "users.nickname"),
      nicknameTag,
      input.passwordHash,
      input.passwordSalt,
      input.passwordAlgorithm,
      encryptDatabaseValue(input.ageBand, "users.age_band"),
      encryptDatabaseValue(input.primaryRegion, "users.primary_region"),
      encryptDatabaseValue(JSON.stringify(normalizedInterestTags), "users.interest_tags"),
      encryptDatabaseValueSafely(input.interestOther || null, "users.interest_other"),
      encryptDatabaseValue(input.preferredTimeSlot, "users.preferred_time_slot"),
      encryptDatabaseValue(JSON.stringify(normalizedWeatherSensitivity), "users.weather_sensitivity"),
      input.agreedAt,
      input.agreedAt,
      input.agreedAt,
      input.marketingAccepted ? 1 : 0,
      input.marketingAccepted ? input.agreedAt : null,
      input.analyticsAccepted ? 1 : 0,
      input.analyticsAccepted ? input.agreedAt : null,
      input.labEnabled ? 1 : 0,
    ]
  )

  const created = await findUserByEmail(normalizedEmail)
  if (!created) {
    throw new Error("User creation verification failed")
  }
  return created
}

export async function createSessionRecord(input: {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  userAgent: string | null
  ipAddress: string | null
}) {
  await ensureAuthSchema()
  const sessionCap = Math.max(1, Math.floor(MAX_ACTIVE_SESSIONS_PER_USER))

  await executeStatement("DELETE FROM user_sessions WHERE expires_at < NOW()", [])

  await executeStatement(
    `
      INSERT INTO user_sessions (
        id,
        user_id,
        token_hash,
        expires_at,
        user_agent,
        ip_address
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      input.id,
      input.userId,
      input.tokenHash,
      input.expiresAt,
      encryptDatabaseValueSafely(input.userAgent, "sessions.user_agent"),
      encryptDatabaseValueSafely(input.ipAddress, "sessions.ip_address"),
    ]
  )

  await executeStatement(
    `
      DELETE FROM user_sessions
      WHERE user_id = ?
        AND id NOT IN (
          SELECT id FROM (
            SELECT id
            FROM user_sessions
            WHERE user_id = ?
            ORDER BY last_used_at DESC, created_at DESC
            LIMIT ${sessionCap}
          ) AS kept_sessions
        )
    `,
    [input.userId, input.userId]
  )
}

export async function findUserBySessionTokenHash(tokenHash: string) {
  await ensureAuthSchema()

  const rows = await queryRows<SessionJoinRow[]>(
    `
      SELECT
        s.id AS session_id,
        s.expires_at AS session_expires_at,
        u.id,
        u.email,
        u.display_name,
        u.nickname,
        u.nickname_hash,
        u.nickname_tag,
        u.password_hash,
        u.password_salt,
        u.password_algo,
        u.age_band,
        u.primary_region,
        u.interest_tags,
        u.interest_other,
        u.preferred_time_slot,
        u.weather_sensitivity,
        u.marketing_accepted,
        u.analytics_accepted,
        u.lab_enabled,
        u.created_at
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.expires_at > NOW()
      LIMIT 1
    `,
    [tokenHash]
  )

  if (!rows[0]) {
    return null
  }

  return {
    sessionId: rows[0].session_id,
    expiresAt: toDate(rows[0].session_expires_at) ?? new Date(),
    user: toPublicUser(rows[0]),
  }
}

export async function touchSession(sessionId: string) {
  await ensureAuthSchema()
  await executeStatement(
    "UPDATE user_sessions SET last_used_at = NOW() WHERE id = ?",
    [sessionId]
  )
}

export async function refreshSessionExpiration(sessionId: string, expiresAt: Date) {
  await ensureAuthSchema()
  await executeStatement(
    `
      UPDATE user_sessions
      SET
        expires_at = ?,
        last_used_at = NOW()
      WHERE id = ?
    `,
    [expiresAt, sessionId]
  )
}

export async function deleteSessionByTokenHash(tokenHash: string) {
  await ensureAuthSchema()
  await executeStatement("DELETE FROM user_sessions WHERE token_hash = ?", [tokenHash])
}

export async function updateUserProfile(input: {
  userId: string
  displayName: string
  nickname: string
  ageBand: string
  primaryRegion: string
  interestTags: string[]
  interestOther: string
  preferredTimeSlot: string
  weatherSensitivity: string[]
  marketingAccepted: boolean
  analyticsAccepted: boolean
  labEnabled: boolean
}) {
  await ensureAuthSchema()
  const normalizedNickname = normalizeNickname(input.nickname)
  const normalizedInterestTags = Array.isArray(input.interestTags)
    ? input.interestTags.filter((item): item is string => typeof item === "string")
    : []
  const normalizedWeatherSensitivity = Array.isArray(input.weatherSensitivity)
    ? input.weatherSensitivity.filter((item): item is string => typeof item === "string")
    : []

  // Check if nickname changed and regenerate tag if needed
  const currentUser = await findUserById(input.userId)
  let nicknameTag = currentUser?.nicknameTag ?? '0000'
  if (currentUser && currentUser.nickname !== normalizedNickname) {
    nicknameTag = await generateUniqueNicknameTag(normalizedNickname)
  }

  await executeStatement(
    `
      UPDATE users
      SET
        display_name = ?,
        nickname = ?,
        nickname_hash = ?,
        nickname_tag = ?,
        age_band = ?,
        primary_region = ?,
        interest_tags = ?,
        interest_other = ?,
        preferred_time_slot = ?,
        weather_sensitivity = ?,
        marketing_accepted = ?,
        analytics_accepted = ?,
        lab_enabled = ?,
        marketing_agreed_at = CASE
          WHEN ? = 1 THEN COALESCE(marketing_agreed_at, NOW())
          ELSE NULL
        END,
        analytics_agreed_at = CASE
          WHEN ? = 1 THEN COALESCE(analytics_agreed_at, NOW())
          ELSE NULL
        END
      WHERE id = ?
    `,
    [
      encryptDatabaseValue(input.displayName, "users.display_name"),
      encryptDatabaseValue(normalizedNickname, "users.nickname"),
      createBlindIndex(normalizedNickname, "users.nickname"),
      nicknameTag,
      encryptDatabaseValue(input.ageBand, "users.age_band"),
      encryptDatabaseValue(input.primaryRegion, "users.primary_region"),
      encryptDatabaseValue(JSON.stringify(normalizedInterestTags), "users.interest_tags"),
      encryptDatabaseValueSafely(input.interestOther || null, "users.interest_other"),
      encryptDatabaseValue(input.preferredTimeSlot, "users.preferred_time_slot"),
      encryptDatabaseValue(JSON.stringify(normalizedWeatherSensitivity), "users.weather_sensitivity"),
      input.marketingAccepted ? 1 : 0,
      input.analyticsAccepted ? 1 : 0,
      input.labEnabled ? 1 : 0,
      input.marketingAccepted ? 1 : 0,
      input.analyticsAccepted ? 1 : 0,
      input.userId,
    ]
  )

  return findUserById(input.userId)
}

export async function updateUserAnalyticsConsent(input: {
  userId: string
  analyticsAccepted: boolean
}) {
  await ensureAuthSchema()

  await executeStatement(
    `
      UPDATE users
      SET
        analytics_accepted = ?,
        analytics_agreed_at = CASE
          WHEN ? = 1 THEN COALESCE(analytics_agreed_at, NOW())
          ELSE NULL
        END
      WHERE id = ?
    `,
    [
      input.analyticsAccepted ? 1 : 0,
      input.analyticsAccepted ? 1 : 0,
      input.userId,
    ]
  )

  return findUserById(input.userId)
}

export async function deleteUserAccount(userId: string) {
  await ensureAuthSchema()

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()

    await connection.execute("DELETE FROM user_chat_messages WHERE user_id = ?", [userId])
    await connection.execute("DELETE FROM user_chat_sessions WHERE user_id = ?", [userId])
    await connection.execute("DELETE FROM user_chat_memory WHERE user_id = ?", [userId])
    await connection.execute("DELETE FROM user_chat_usage_daily WHERE user_id = ?", [userId])
    await connection.execute("DELETE FROM user_chat_request_events WHERE user_id = ?", [userId])

    await connection.execute("DELETE FROM lab_cards WHERE user_id = ?", [userId])
    await connection.execute("DELETE FROM lab_decks WHERE user_id = ?", [userId])
    await connection.execute("DELETE FROM lab_daily_usage WHERE user_id = ?", [userId])

    await connection.execute("DELETE FROM user_sessions WHERE user_id = ?", [userId])
    await connection.execute("DELETE FROM users WHERE id = ?", [userId])

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function findActiveAuthBlock(action: string, scopeKeys: string[]) {
  await ensureAuthSchema()

  if (scopeKeys.length === 0) {
    return null
  }

  const placeholders = scopeKeys.map(() => "?").join(", ")
  const rows = await queryRows<AttemptBucketRow[]>(
    `
      SELECT
        id,
        action,
        scope_key,
        attempt_count,
        window_started_at,
        last_attempt_at,
        blocked_until
      FROM auth_attempt_buckets
      WHERE action = ?
        AND scope_key IN (${placeholders})
        AND blocked_until IS NOT NULL
        AND blocked_until > NOW()
      ORDER BY blocked_until DESC
      LIMIT 1
    `,
    [action, ...scopeKeys]
  )

  if (!rows[0]) {
    return null
  }

  const blockedUntil = toDate(rows[0].blocked_until)
  if (!blockedUntil) {
    return null
  }

  return {
    scopeKey: rows[0].scope_key,
    blockedUntil,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((blockedUntil.getTime() - Date.now()) / 1000)
    ),
  }
}

async function withLockedAttemptBucket<T>(
  action: string,
  scopeKey: string,
  callback: (connection: PoolConnection, row: AttemptBucketRow | null) => Promise<T>
) {
  await ensureAuthSchema()

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.query<AttemptBucketRow[]>(
      `
        SELECT
          id,
          action,
          scope_key,
          attempt_count,
          window_started_at,
          last_attempt_at,
          blocked_until
        FROM auth_attempt_buckets
        WHERE action = ?
          AND scope_key = ?
        LIMIT 1
        FOR UPDATE
      `,
      [action, scopeKey]
    )

    const result = await callback(connection, rows[0] ?? null)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function consumeAuthRateLimit(input: {
  action: string
  scopeKey: string
  limit: number
  windowMs: number
  blockMs: number
}) {
  return withLockedAttemptBucket(
    input.action,
    input.scopeKey,
    async (connection, row) => {
      const now = new Date()

      if (!row) {
        await connection.execute(
          `
            INSERT INTO auth_attempt_buckets (
              action,
              scope_key,
              attempt_count,
              window_started_at,
              last_attempt_at,
              blocked_until
            ) VALUES (?, ?, ?, ?, ?, ?)
          `,
          [input.action, input.scopeKey, 1, now, now, null]
        )

        return {
          blocked: false,
          attemptCount: 1,
          retryAfterSeconds: 0,
        } satisfies AuthRateLimitDecision
      }

      const blockedUntil = toDate(row.blocked_until)
      if (blockedUntil && blockedUntil.getTime() > now.getTime()) {
        await connection.execute(
          `
            UPDATE auth_attempt_buckets
            SET last_attempt_at = ?
            WHERE id = ?
          `,
          [now, row.id]
        )

        return {
          blocked: true,
          attemptCount: row.attempt_count,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000)
          ),
        } satisfies AuthRateLimitDecision
      }

      const windowStartedAt = toDate(row.window_started_at) ?? now
      const shouldResetWindow = now.getTime() - windowStartedAt.getTime() >= input.windowMs
      const nextAttemptCount = shouldResetWindow ? 1 : row.attempt_count + 1
      const nextBlockedUntil = nextAttemptCount >= input.limit
        ? new Date(now.getTime() + input.blockMs)
        : null

      await connection.execute(
        `
          UPDATE auth_attempt_buckets
          SET attempt_count = ?,
              window_started_at = ?,
              last_attempt_at = ?,
              blocked_until = ?
          WHERE id = ?
        `,
        [
          nextAttemptCount,
          shouldResetWindow ? now : windowStartedAt,
          now,
          nextBlockedUntil,
          row.id,
        ]
      )

      return {
        blocked: nextBlockedUntil != null,
        attemptCount: nextAttemptCount,
        retryAfterSeconds: nextBlockedUntil
          ? Math.max(1, Math.ceil((nextBlockedUntil.getTime() - now.getTime()) / 1000))
          : 0,
      } satisfies AuthRateLimitDecision
    }
  )
}

export async function clearAuthRateLimits(action: string, scopeKeys: string[]) {
  await ensureAuthSchema()

  if (scopeKeys.length === 0) {
    return
  }

  const placeholders = scopeKeys.map(() => "?").join(", ")
  await executeStatement(
    `
      DELETE FROM auth_attempt_buckets
      WHERE action = ?
        AND scope_key IN (${placeholders})
    `,
    [action, ...scopeKeys]
  )
}

export async function recordAuthSecurityEvent(input: AuthSecurityEventInput) {
  await ensureAuthSchema()
  const normalizedEmail = input.email?.trim().toLowerCase() || null

  await executeStatement(
    `
      INSERT INTO auth_security_events (
        event_type,
        action,
        outcome,
        user_id,
        email,
        email_hash,
        ip_address,
        user_agent,
        metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.eventType,
      input.action,
      input.outcome,
      input.userId ?? null,
      normalizedEmail ? encryptDatabaseValue(normalizedEmail, "auth.events.email") : null,
      normalizedEmail ? createBlindIndex(normalizedEmail, "auth.events.email") : null,
      encryptDatabaseValueSafely(input.ipAddress ?? null, "auth.events.ip_address"),
      encryptDatabaseValueSafely(input.userAgent ?? null, "auth.events.user_agent"),
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  )
}

export async function recordAuthSecurityEventSafely(input: AuthSecurityEventInput) {
  try {
    await recordAuthSecurityEvent(input)
  } catch (error) {
    console.error("Failed to record auth security event:", error)
  }
}
