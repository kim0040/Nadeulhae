import { ensureAnalyticsSchema } from "@/lib/analytics/schema"
import { ensureAuthSchema } from "@/lib/auth/schema"
import { executeStatement } from "@/lib/db"
import { cleanupOldMessages } from "@/lib/jeonju-chat/repository"
import {
  cleanupExpiredLocationUsageProofs,
  ensureLocationUsageProofSchema,
} from "@/lib/privacy/location-proof"

declare global {
  var __nadeulhaeRetentionLastSweepAt: number | undefined
  var __nadeulhaeRetentionSweepPromise: Promise<void> | undefined
  var __nadeulhaeRetentionSweepTimer: ReturnType<typeof setInterval> | undefined
}

const RETENTION_SWEEP_INTERVAL_MS = 30 * 60 * 1000
const AUTH_SESSION_RETENTION_DAYS = 0
const AUTH_ATTEMPT_BUCKET_RETENTION_DAYS = 14
const AUTH_SECURITY_EVENT_RETENTION_DAYS = 90
const ANALYTICS_UNIQUE_RETENTION_DAYS = 35
const ANALYTICS_AGGREGATE_RETENTION_DAYS = 365

function runRetentionDelete(sql: string) {
  return executeStatement(sql)
}

async function runRetentionSweep() {
  await ensureAuthSchema()
  await ensureAnalyticsSchema()
  await ensureLocationUsageProofSchema()

  if (AUTH_SESSION_RETENTION_DAYS <= 0) {
    await runRetentionDelete("DELETE FROM user_sessions WHERE expires_at < NOW()")
  } else {
    await runRetentionDelete(
      `DELETE FROM user_sessions WHERE expires_at < DATE_SUB(NOW(), INTERVAL ${AUTH_SESSION_RETENTION_DAYS} DAY)`
    )
  }

  await runRetentionDelete(
    `DELETE FROM auth_attempt_buckets WHERE last_attempt_at < DATE_SUB(NOW(), INTERVAL ${AUTH_ATTEMPT_BUCKET_RETENTION_DAYS} DAY)`
  )
  await runRetentionDelete(
    `DELETE FROM auth_security_events WHERE created_at < DATE_SUB(NOW(), INTERVAL ${AUTH_SECURITY_EVENT_RETENTION_DAYS} DAY)`
  )

  await runRetentionDelete(
    `DELETE FROM analytics_daily_unique_entities WHERE created_at < DATE_SUB(NOW(), INTERVAL ${ANALYTICS_UNIQUE_RETENTION_DAYS} DAY)`
  )

  const analyticsMetricTables = [
    "analytics_daily_route_metrics",
    "analytics_daily_actor_activity",
    "analytics_daily_page_context_metrics",
    "analytics_daily_consent_metrics",
  ]

  for (const tableName of analyticsMetricTables) {
    await runRetentionDelete(
      `DELETE FROM ${tableName} WHERE metric_date < DATE_SUB(CURDATE(), INTERVAL ${ANALYTICS_AGGREGATE_RETENTION_DAYS} DAY)`
    )
  }

  await cleanupOldMessages()
  await cleanupExpiredLocationUsageProofs()
}

export async function runRetentionSweepIfNeeded() {
  const now = Date.now()
  const lastSweepAt = globalThis.__nadeulhaeRetentionLastSweepAt ?? 0

  if (now - lastSweepAt < RETENTION_SWEEP_INTERVAL_MS) {
    return
  }

  if (globalThis.__nadeulhaeRetentionSweepPromise) {
    await globalThis.__nadeulhaeRetentionSweepPromise
    return
  }

  globalThis.__nadeulhaeRetentionSweepPromise = (async () => {
    await runRetentionSweep()
    globalThis.__nadeulhaeRetentionLastSweepAt = Date.now()
  })().finally(() => {
    globalThis.__nadeulhaeRetentionSweepPromise = undefined
  })

  await globalThis.__nadeulhaeRetentionSweepPromise
}

export async function runRetentionSweepIfNeededSafely() {
  try {
    await runRetentionSweepIfNeeded()
  } catch (error) {
    console.error("Retention sweep failed:", error)
  }
}

function ensureRetentionSweepTimer() {
  if (globalThis.__nadeulhaeRetentionSweepTimer) {
    return
  }

  const timer = setInterval(() => {
    void runRetentionSweepIfNeededSafely()
  }, RETENTION_SWEEP_INTERVAL_MS)

  if (typeof timer.unref === "function") {
    timer.unref()
  }

  globalThis.__nadeulhaeRetentionSweepTimer = timer
}

ensureRetentionSweepTimer()
