import type { PoolConnection, RowDataPacket } from "mysql2/promise"

import { getDbPool } from "@/lib/db"

declare global {
  var __nadeulhaeLlmQuotaSchemaPromise: Promise<void> | undefined
}

interface LlmGlobalUsageRow extends RowDataPacket {
  metric_date: Date | string
  request_count: number
  success_count: number
  failure_count: number
}

interface LlmUserActionUsageRow extends RowDataPacket {
  metric_date: Date | string
  user_id: string
  quota_key: string
  request_count: number
  success_count: number
  failure_count: number
}

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

const KST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export interface DailyQuotaUsage {
  metricDate: string
  requestCount: number
  successCount: number
  failureCount: number
  limit: number
  remaining: number
}

export interface DailyQuotaReservation {
  allowed: boolean
  usage: DailyQuotaUsage
}

function getKstMetricDate() {
  return KST_DATE_FORMATTER.format(new Date())
}

function normalizeLimit(input: number | undefined, fallback: number) {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return fallback
  }

  return Math.max(1, Math.floor(input))
}

function normalizeQuotaKey(input: string) {
  const normalized = input.trim().toLowerCase()
  if (!normalized || normalized.length > 64 || !/^[a-z0-9_:-]+$/.test(normalized)) {
    throw new Error("Invalid quota key.")
  }

  return normalized
}

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

