/**
 * Data Retention Policy Enforcement
 *
 * Periodically sweeps database tables to delete records that have exceeded
 * their configured retention periods. Runs on a background timer and uses
 * global memoisation to prevent concurrent sweeps. Retention periods differ
 * per data category (auth sessions, analytics, location proofs, etc.).
 */
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

/**
 * Executes the full retention sweep across all tracked tables. For each
 * table, deletes rows whose age exceeds the configured retention period.
 * Retention periods differ per data category (auth, analytics, etc.).
 */
async function runRetentionSweep() {
  await ensureAuthSchema()
  await ensureAnalyticsSchema()
  await ensureLocationUsageProofSchema()

  // User sessions: 0-day retention means delete on expiry (already past expires_at).
  // Positive values extend retention to N days past expiry.
  if (AUTH_SESSION_RETENTION_DAYS <= 0) {
    await runRetentionDelete("DELETE FROM user_sessions WHERE expires_at < NOW()")
  } else {
    await runRetentionDelete(
      `DELETE FROM user_sessions WHERE expires_at < DATE_SUB(NOW(), INTERVAL ${AUTH_SESSION_RETENTION_DAYS} DAY)`
    )
  }

  // Auth attempt buckets: rate-limiting data retained for 14 days
  await runRetentionDelete(
    `DELETE FROM auth_attempt_buckets WHERE last_attempt_at < DATE_SUB(NOW(), INTERVAL ${AUTH_ATTEMPT_BUCKET_RETENTION_DAYS} DAY)`
  )
  // Security events: audit trail retained for 90 days
  await runRetentionDelete(
    `DELETE FROM auth_security_events WHERE created_at < DATE_SUB(NOW(), INTERVAL ${AUTH_SECURITY_EVENT_RETENTION_DAYS} DAY)`
  )

  // Analytics unique entities: short-lived identifiers retained for 35 days
  await runRetentionDelete(
    `DELETE FROM analytics_daily_unique_entities WHERE created_at < DATE_SUB(NOW(), INTERVAL ${ANALYTICS_UNIQUE_RETENTION_DAYS} DAY)`
  )

  const analyticsMetricTables = [
    "analytics_daily_route_metrics",
    "analytics_daily_actor_activity",
    "analytics_daily_page_context_metrics",
    "analytics_daily_consent_metrics",
  ]

  // Analytics aggregate metrics: longer retention (365 days) for trend analysis
  for (const tableName of analyticsMetricTables) {
    await runRetentionDelete(
      `DELETE FROM ${tableName} WHERE metric_date < DATE_SUB(CURDATE(), INTERVAL ${ANALYTICS_AGGREGATE_RETENTION_DAYS} DAY)`
    )
  }

  // Delegate to sub-modules for chat messages and location proofs
  await cleanupOldMessages()
  await cleanupExpiredLocationUsageProofs()
}

/**
 * Runs a retention sweep if enough time has passed since the last one.
 * Throttles to the configured interval and deduplicates concurrent calls
 * via a global promise singleton.
 */
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

/**
 * Error-safe wrapper around runRetentionSweepIfNeeded. Logs failures
 * to prevent retention sweep errors from propagating to the caller.
 */
export async function runRetentionSweepIfNeededSafely() {
  try {
    await runRetentionSweepIfNeeded()
  } catch (error) {
    console.error("Retention sweep failed:", error)
  }
}

/**
 * Sets up a background interval timer that periodically triggers the
 * retention sweep. Uses timer.unref() so it does not keep the Node.js
 * process alive. Only one timer is created per process lifetime.
 */
function ensureRetentionSweepTimer() {
  if (globalThis.__nadeulhaeRetentionSweepTimer) {
    return
  }

  const timer = setInterval(() => {
    void runRetentionSweepIfNeededSafely()
  }, RETENTION_SWEEP_INTERVAL_MS)

  // Unref so the timer does not prevent graceful shutdown
  if (typeof timer.unref === "function") {
    timer.unref()
  }

  globalThis.__nadeulhaeRetentionSweepTimer = timer
}

// Fire once at import so the cleanup loop starts automatically
ensureRetentionSweepTimer()
