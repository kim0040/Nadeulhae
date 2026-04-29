import type { PoolConnection, RowDataPacket } from "mysql2/promise"

import { getDbPool } from "@/lib/db"

/**
 * LLM API Request Quota System
 *
 * Manages rate-limiting quotas for LLM API calls across two dimensions:
 *
 * 1. **Global daily quota** — caps the total number of LLM requests across all users
 *    per calendar day (KST timezone). Stored in `llm_global_usage_daily`.
 *
 * 2. **Per-user per-action daily quota** — caps the number of requests a single user
 *    can make for a specific action category (e.g., "generate_description", "translate")
 *    per calendar day. Stored in `llm_user_action_usage_daily`.
 *
 * Both tables follow the same concurrency strategy:
 * - Transactions begin with an **upsert** (`INSERT ... ON DUPLICATE KEY UPDATE`)
 *   to ensure the row for today exists without introducing a gap between `SELECT` and `INSERT`.
 * - The row is then locked with `SELECT ... FOR UPDATE` to serialize quota checks.
 * - If under the limit, the counter is incremented atomically within the transaction.
 * - If at or over the limit, the transaction commits without incrementing
 *   (no row was modified, but the lock ensures consistent reads).
 *
 * Quota reservation and outcome recording are separate steps:
 * - `reserve*` functions atomically check-and-increment at request time.
 * - `record*Outcome` functions update success/failure counts after the LLM call completes.
 *
 * Refund semantics (not yet implemented):
 * - `refundGlobalLlmDailyRequest` would decrement `request_count` on the global table
 *   when a reserved request is cancelled before execution, freeing the slot for others.
 * - `refundUserActionDailyRequest` would do the same for per-user per-action rows.
 *   Refunds must happen in a `FOR UPDATE` transaction to avoid underflow below zero.
 *
 * Schema initialization is idempotent and memoised globally via a module-level
 * `Promise<void>` singleton (`__nadeulhaeLlmQuotaSchemaPromise`), so multiple
 * concurrent callers never issue duplicate DDL.
 */

declare global {
  var __nadeulhaeLlmQuotaSchemaPromise: Promise<void> | undefined
}

/** Row shape returned by queries against the `llm_global_usage_daily` table. */
interface LlmGlobalUsageRow extends RowDataPacket {
  metric_date: Date | string
  request_count: number
  success_count: number
  failure_count: number
}

/** Row shape returned by queries against the `llm_user_action_usage_daily` table. */
interface LlmUserActionUsageRow extends RowDataPacket {
  metric_date: Date | string
  user_id: string
  quota_key: string
  request_count: number
  success_count: number
  failure_count: number
}

// Global daily usage table.
// - Single row per calendar date (KST), enforced by PRIMARY KEY on metric_date.
// - `request_count` is the atomic counter incremented inside a FOR UPDATE transaction.
// - `success_count` / `failure_count` are updated *after* the LLM call completes
//   and are informational only — they do NOT gate the quota limit.
// - Index on `last_used_at` supports housekeeping queries (e.g. purging old rows).
const createLlmGlobalUsageTableSql = `
  CREATE TABLE IF NOT EXISTS llm_global_usage_daily (
    metric_date DATE NOT NULL PRIMARY KEY,
    request_count INT UNSIGNED NOT NULL DEFAULT 0,
    success_count INT UNSIGNED NOT NULL DEFAULT 0,
    failure_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_llm_global_last_used (last_used_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

// Per-user per-action daily usage table.
// - Composite PRIMARY KEY on (metric_date, user_id, quota_key) ensures at most one
//   row per user-action-date combination — the natural unit of quota enforcement.
// - `quota_key` is a normalized slug (e.g. "generate_description") validated by
//   `normalizeQuotaKey()` — lowercase alphanumeric + underscores/hyphens/colons.
// - Index on (user_id, metric_date) supports "show me all of today's usage for
//   user X" queries without scanning the whole table.
// - Index on (quota_key, metric_date) supports "how many requests for action Y
//   happened today" across all users.
// - Index on `last_used_at` supports housekeeping / purge queries.
const createLlmUserActionUsageTableSql = `
  CREATE TABLE IF NOT EXISTS llm_user_action_usage_daily (
    metric_date DATE NOT NULL,
    user_id CHAR(36) NOT NULL,
    quota_key VARCHAR(64) NOT NULL,
    request_count INT UNSIGNED NOT NULL DEFAULT 0,
    success_count INT UNSIGNED NOT NULL DEFAULT 0,
    failure_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (metric_date, user_id, quota_key),
    KEY idx_llm_user_action_usage_user_date (user_id, metric_date),
    KEY idx_llm_user_action_usage_key_date (quota_key, metric_date),
    KEY idx_llm_user_action_usage_last_used (last_used_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

// Produces YYYY-MM-DD strings in Asia/Seoul timezone ("en-CA" locale produces
// ISO 8601 date format). Used as the `metric_date` partition key throughout the quota system.
const KST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/**
 * Snapshot of daily quota usage returned to callers.
 *
 * `remaining` is derived as `max(0, limit - requestCount)` and represents
 * how many more requests may be made within the current calendar day.
 */
export interface DailyQuotaUsage {
  metricDate: string
  requestCount: number
  successCount: number
  failureCount: number
  limit: number
  remaining: number
}

/**
 * Result of a quota reservation attempt.
 *
 * `allowed` is `true` when the request may proceed (counter was incremented).
 * `allowed` is `false` when the daily limit has already been reached, in which
 * case `usage.remaining` will be 0 and the caller should return a rate-limit error.
 */
export interface DailyQuotaReservation {
  allowed: boolean
  usage: DailyQuotaUsage
}

// Returns today's date string in KST (Asia/Seoul), e.g. "2026-04-29".
// All quota partitions are keyed by this date to align with the Korean business day.
function getKstMetricDate() {
  return KST_DATE_FORMATTER.format(new Date())
}

// Coerces a limit value to a safe positive integer.
// - `undefined`, `NaN`, `Infinity`, and non-number types fall back to `fallback`.
// - Negative values are clamped to 1 (minimum quota) via `Math.max(1, ...)`.
// - Fractional values are floored to integers.
function normalizeLimit(input: number | undefined, fallback: number) {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return fallback
  }

  return Math.max(1, Math.floor(input))
}

// Validates and normalizes a quota_key string for safe use in SQL and as a URL/slug identifier.
// - Trims whitespace and lowercases.
// - Rejects empty strings, strings longer than 64 characters (VARCHAR(64) column limit),
//   and strings containing characters outside `[a-z0-9_:-]`.
// - Throws an `Error` on invalid input — the caller should treat this as a programmer error
//   (invalid action slug), not a runtime rate-limit condition.
function normalizeQuotaKey(input: string) {
  const normalized = input.trim().toLowerCase()
  if (!normalized || normalized.length > 64 || !/^[a-z0-9_:-]+$/.test(normalized)) {
    throw new Error("Invalid quota key.")
  }

  return normalized
}

// Builds a `DailyQuotaUsage` snapshot from raw row data.
// Clamps `requestCount`, `successCount`, and `failureCount` to ≥0 defensively
// (the DB columns are UNSIGNED, but this guards against client errors).
// `remaining` is computed as `limit - requestCount`, floored at 0.
function toUsageSnapshot(input: {
  metricDate: string
  requestCount: number
  successCount: number
  failureCount: number
  limit: number
}): DailyQuotaUsage {
  return {
    metricDate: input.metricDate,
    requestCount: Math.max(0, input.requestCount),
    successCount: Math.max(0, input.successCount),
    failureCount: Math.max(0, input.failureCount),
    limit: input.limit,
    remaining: Math.max(0, input.limit - Math.max(0, input.requestCount)),
  }
}

// Idempotently ensures a row exists for `metricDate` in the global usage table.
// Uses `INSERT ... ON DUPLICATE KEY UPDATE metric_date = metric_date` (a no-op update)
// so the row is guaranteed to exist before the caller locks it with `SELECT ... FOR UPDATE`.
// Must run inside an active transaction on `connection`.
async function upsertGlobalUsageRow(connection: PoolConnection, metricDate: string) {
  await connection.execute(
    `
      INSERT INTO llm_global_usage_daily (
        metric_date,
        request_count,
        success_count,
        failure_count
      ) VALUES (?, 0, 0, 0)
      ON DUPLICATE KEY UPDATE metric_date = metric_date
    `,
    [metricDate]
  )
}

// Idempotently ensures a row exists for the (metricDate, userId, quotaKey) triple
// in the user-action usage table.  Same no-op upsert pattern as `upsertGlobalUsageRow`
// (`ON DUPLICATE KEY UPDATE user_id = user_id`) — relies on the composite PRIMARY KEY.
// Must run inside an active transaction on `connection`.
async function upsertUserActionUsageRow(
  connection: PoolConnection,
  metricDate: string,
  userId: string,
  quotaKey: string
) {
  await connection.execute(
    `
      INSERT INTO llm_user_action_usage_daily (
        metric_date,
        user_id,
        quota_key,
        request_count,
        success_count,
        failure_count
      ) VALUES (?, ?, ?, 0, 0, 0)
      ON DUPLICATE KEY UPDATE user_id = user_id
    `,
    [metricDate, userId, quotaKey]
  )
}

/**
 * Ensures both quota tables (`llm_global_usage_daily` and `llm_user_action_usage_daily`)
 * exist in the database.
 *
 * Initialization is memoised at the module level via a `Promise<void>` singleton
 * stored on `globalThis.__nadeulhaeLlmQuotaSchemaPromise`. All concurrent callers
 * await the same promise, so DDL is issued exactly once per process lifetime.
 * If the DDL fails, the singleton is reset so a subsequent call will retry.
 *
 * This function is automatically called by every public quota function — external
 * callers do not need to invoke it directly.
 *
 * @returns A promise that resolves when the schema is ready or throws on DDL failure.
 */
export async function ensureLlmQuotaSchema() {
  if (globalThis.__nadeulhaeLlmQuotaSchemaPromise) {
    return globalThis.__nadeulhaeLlmQuotaSchemaPromise
  }

  const bootstrapPromise = (async () => {
    const pool = getDbPool()
    await pool.query(createLlmGlobalUsageTableSql)
    await pool.query(createLlmUserActionUsageTableSql)
  })()

  globalThis.__nadeulhaeLlmQuotaSchemaPromise = bootstrapPromise.catch((error) => {
    globalThis.__nadeulhaeLlmQuotaSchemaPromise = undefined
    throw error
  })

  return globalThis.__nadeulhaeLlmQuotaSchemaPromise
}

/**
 * Reserves a slot in the **global** daily LLM request quota.
 *
 * ## Flow
 * 1. Ensure the schema exists (`ensureLlmQuotaSchema`).
 * 2. Obtain a dedicated DB connection from the pool.
 * 3. Open a transaction and upsert today's row (guarantees a row exists).
 * 4. `SELECT ... FOR UPDATE` on today's row to serialise concurrent reservations.
 * 5. If `request_count >= limit`, the quota is exhausted:
 *    - Commit (no rows modified) and return `{ allowed: false }`.
 * 6. Otherwise, increment `request_count` via `UPDATE`, commit, and return `{ allowed: true }`.
 *
 * ## Concurrency strategy
 * `SELECT ... FOR UPDATE` ensures that only one caller at a time can evaluate
 * the quota for a given date. Other callers block until the transaction commits,
 * guaranteeing that the counter never overshoots the limit.
 *
 * ## Error handling
 * On any error the transaction is rolled back and the connection is released.
 * The error is re-thrown so the caller can handle it (typically as a 500 / retry).
 *
 * @param input.limit — Maximum allowed requests per day. Defaults to 5000.
 * @returns A `DailyQuotaReservation` indicating whether the request is allowed
 *          and the current usage snapshot.
 */
export async function reserveGlobalLlmDailyRequest(input?: { limit?: number }): Promise<DailyQuotaReservation> {
  await ensureLlmQuotaSchema()

  const limit = normalizeLimit(input?.limit, 5000)
  const metricDate = getKstMetricDate()
  const connection = await getDbPool().getConnection()

  try {
    await connection.beginTransaction()
    await upsertGlobalUsageRow(connection, metricDate)

    const [rows] = await connection.query<LlmGlobalUsageRow[]>(
      `
        SELECT
          metric_date,
          request_count,
          success_count,
          failure_count
        FROM llm_global_usage_daily
        WHERE metric_date = ?
        LIMIT 1
        FOR UPDATE
      `,
      [metricDate]
    )

    const usage = rows[0] ?? {
      metric_date: metricDate,
      request_count: 0,
      success_count: 0,
      failure_count: 0,
    }

    if (usage.request_count >= limit) {
      await connection.commit()
      return {
        allowed: false,
        usage: toUsageSnapshot({
          metricDate,
          requestCount: usage.request_count,
          successCount: usage.success_count,
          failureCount: usage.failure_count,
          limit,
        }),
      }
    }

    const nextRequestCount = usage.request_count + 1
    await connection.execute(
      `
        UPDATE llm_global_usage_daily
        SET
          request_count = ?,
          last_used_at = NOW()
        WHERE metric_date = ?
      `,
      [nextRequestCount, metricDate]
    )

    await connection.commit()
    return {
      allowed: true,
      usage: toUsageSnapshot({
        metricDate,
        requestCount: nextRequestCount,
        successCount: usage.success_count,
        failureCount: usage.failure_count,
        limit,
      }),
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/**
 * Records the outcome (success or failure) of a previously-reserved global LLM request.
 *
 * This is a **non-transactional, fire-and-forget** update — it does not use
 * `FOR UPDATE` because it only increments `success_count` or `failure_count`
 * for observability, and does not gate future reservations.
 *
 * The `metricDate` must match the date string returned by a prior
 * `reserveGlobalLlmDailyRequest` call (so the outcome is attributed to the
 * correct calendar day even if the LLM call spans midnight KST).
 *
 * @param input.metricDate — The KST date string (YYYY-MM-DD) from the reservation.
 * @param input.success — `true` to increment `success_count`, `false` for `failure_count`.
 */
export async function recordGlobalLlmRequestOutcome(input: {
  metricDate: string
  success: boolean
}) {
  await ensureLlmQuotaSchema()
  const metricDate = input.metricDate
  const targetColumn = input.success ? "success_count" : "failure_count"

  await getDbPool().execute(
    `
      UPDATE llm_global_usage_daily
      SET
        ${targetColumn} = ${targetColumn} + 1,
        last_used_at = NOW()
      WHERE metric_date = ?
    `,
    [metricDate]
  )
}

/**
 * Reserves a slot in the **per-user per-action** daily LLM request quota.
 *
 * ## Flow
 * 1. Ensure the schema exists (`ensureLlmQuotaSchema`).
 * 2. Validate and normalise `quotaKey` via `normalizeQuotaKey()` — throws on invalid keys.
 * 3. Obtain a dedicated DB connection from the pool.
 * 4. Open a transaction and upsert the (date, userId, quotaKey) row.
 * 5. `SELECT ... FOR UPDATE` on that specific row to serialise reservations
 *    for the same user + action + date combination.
 * 6. If `request_count >= limit`, commit and return `{ allowed: false }`.
 * 7. Otherwise, increment `request_count`, commit, and return `{ allowed: true }`.
 *
 * ## Concurrency strategy
 * Lock granularity is the (metric_date, user_id, quota_key) row — two different
 * users (or the same user with different actions) do **not** block each other.
 * Only concurrent requests for the same user-action-date triple are serialised.
 *
 * ## Error handling
 * On any error the transaction is rolled back and the connection is released.
 * The error is re-thrown. Invalid `quotaKey` values throw a synchronous `Error`
 * before any DB work begins.
 *
 * @param input.userId — The user ID (UUID string, CHAR(36)).
 * @param input.quotaKey — The action slug (e.g. "generate_description").
 *                         Validated by `normalizeQuotaKey`.
 * @param input.limit — Maximum allowed requests per user per action per day.
 *                      Defaults to 100.
 * @returns A `DailyQuotaReservation` indicating whether the request is allowed
 *          and the current usage snapshot for this user-action pair.
 */
export async function reserveUserActionDailyRequest(input: {
  userId: string
  quotaKey: string
  limit?: number
}): Promise<DailyQuotaReservation> {
  await ensureLlmQuotaSchema()

  const limit = normalizeLimit(input.limit, 100)
  const metricDate = getKstMetricDate()
  const quotaKey = normalizeQuotaKey(input.quotaKey)
  const connection = await getDbPool().getConnection()

  try {
    await connection.beginTransaction()
    await upsertUserActionUsageRow(connection, metricDate, input.userId, quotaKey)

    const [rows] = await connection.query<LlmUserActionUsageRow[]>(
      `
        SELECT
          metric_date,
          user_id,
          quota_key,
          request_count,
          success_count,
          failure_count
        FROM llm_user_action_usage_daily
        WHERE metric_date = ?
          AND user_id = ?
          AND quota_key = ?
        LIMIT 1
        FOR UPDATE
      `,
      [metricDate, input.userId, quotaKey]
    )

    const usage = rows[0] ?? {
      metric_date: metricDate,
      user_id: input.userId,
      quota_key: quotaKey,
      request_count: 0,
      success_count: 0,
      failure_count: 0,
    }

    if (usage.request_count >= limit) {
      await connection.commit()
      return {
        allowed: false,
        usage: toUsageSnapshot({
          metricDate,
          requestCount: usage.request_count,
          successCount: usage.success_count,
          failureCount: usage.failure_count,
          limit,
        }),
      }
    }

    const nextRequestCount = usage.request_count + 1
    await connection.execute(
      `
        UPDATE llm_user_action_usage_daily
        SET
          request_count = ?,
          last_used_at = NOW()
        WHERE metric_date = ?
          AND user_id = ?
          AND quota_key = ?
      `,
      [nextRequestCount, metricDate, input.userId, quotaKey]
    )

    await connection.commit()
    return {
      allowed: true,
      usage: toUsageSnapshot({
        metricDate,
        requestCount: nextRequestCount,
        successCount: usage.success_count,
        failureCount: usage.failure_count,
        limit,
      }),
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

