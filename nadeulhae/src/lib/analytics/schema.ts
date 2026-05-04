/**
 * @fileoverview
 * Analytics database schema module.
 * Defines and bootstraps the analytics tables (daily route metrics, unique entities,
 * actor activity, page context metrics, and consent metrics) on application startup.
 * Tables use a pre-aggregated daily rollup design with dimension-keyed primary keys
 * for efficient query-time summarisation.
 */

import { getDbPool } from "@/lib/db"

// Module-level singleton promise that guards schema bootstrap.
// Ensures the five analytics tables are created exactly once across the lifetime
// of the server, even under concurrent requests.
declare global {
  var __nadeulhaeAnalyticsSchemaPromise: Promise<void> | undefined
}

const createDailyRouteMetricsTableSql = `
  CREATE TABLE IF NOT EXISTS analytics_daily_route_metrics (
    metric_date DATE NOT NULL,
    dimension_key CHAR(64) NOT NULL,
    route_kind VARCHAR(16) NOT NULL,
    route_path VARCHAR(191) NOT NULL,
    method VARCHAR(16) NOT NULL,
    status_code SMALLINT UNSIGNED NOT NULL,
    status_group VARCHAR(8) NOT NULL,
    auth_state VARCHAR(16) NOT NULL,
    device_type VARCHAR(16) NOT NULL,
    locale VARCHAR(8) NOT NULL,
    request_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    unique_visitors BIGINT UNSIGNED NOT NULL DEFAULT 0,
    unique_users BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_duration_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
    peak_duration_ms INT UNSIGNED NOT NULL DEFAULT 0,
    first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (metric_date, dimension_key),
    KEY idx_analytics_route_kind_date (route_kind, metric_date),
    KEY idx_analytics_route_path_date (route_path, metric_date),
    KEY idx_analytics_route_last_seen (last_seen_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createDailyUniqueEntitiesTableSql = `
  CREATE TABLE IF NOT EXISTS analytics_daily_unique_entities (
    metric_date DATE NOT NULL,
    dimension_key CHAR(64) NOT NULL,
    entity_type VARCHAR(16) NOT NULL,
    entity_hash CHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (metric_date, dimension_key, entity_type, entity_hash),
    KEY idx_analytics_unique_created (created_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createDailyActorActivityTableSql = `
  CREATE TABLE IF NOT EXISTS analytics_daily_actor_activity (
    metric_date DATE NOT NULL,
    actor_key CHAR(64) NOT NULL,
    actor_type VARCHAR(16) NOT NULL,
    user_id CHAR(36) NULL,
    auth_state VARCHAR(16) NOT NULL,
    device_type VARCHAR(16) NOT NULL,
    locale VARCHAR(8) NOT NULL,
    page_view_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    api_request_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    mutation_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    error_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (metric_date, actor_key),
    KEY idx_actor_activity_user_date (user_id, metric_date),
    KEY idx_actor_activity_last_seen (last_seen_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createDailyPageContextMetricsTableSql = `
  CREATE TABLE IF NOT EXISTS analytics_daily_page_context_metrics (
    metric_date DATE NOT NULL,
    dimension_key CHAR(64) NOT NULL,
    route_path VARCHAR(191) NOT NULL,
    auth_state VARCHAR(16) NOT NULL,
    device_type VARCHAR(16) NOT NULL,
    locale VARCHAR(8) NOT NULL,
    theme VARCHAR(16) NOT NULL,
    viewport_bucket VARCHAR(16) NOT NULL,
    time_zone VARCHAR(48) NOT NULL,
    referrer_host VARCHAR(191) NOT NULL,
    acquisition_channel VARCHAR(32) NOT NULL,
    utm_source VARCHAR(80) NOT NULL,
    utm_medium VARCHAR(80) NOT NULL,
    utm_campaign VARCHAR(120) NOT NULL,
    page_view_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    unique_visitors BIGINT UNSIGNED NOT NULL DEFAULT 0,
    unique_users BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_load_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
    peak_load_ms INT UNSIGNED NOT NULL DEFAULT 0,
    first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (metric_date, dimension_key),
    KEY idx_page_context_route_date (route_path, metric_date),
    KEY idx_page_context_channel_date (acquisition_channel, metric_date),
    KEY idx_page_context_last_seen (last_seen_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createDailyConsentMetricsTableSql = `
  CREATE TABLE IF NOT EXISTS analytics_daily_consent_metrics (
    metric_date DATE NOT NULL,
    dimension_key CHAR(64) NOT NULL,
    decision_source VARCHAR(24) NOT NULL,
    consent_state VARCHAR(16) NOT NULL,
    auth_state VARCHAR(16) NOT NULL,
    device_type VARCHAR(16) NOT NULL,
    locale VARCHAR(8) NOT NULL,
    decision_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    unique_visitors BIGINT UNSIGNED NOT NULL DEFAULT 0,
    unique_users BIGINT UNSIGNED NOT NULL DEFAULT 0,
    first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (metric_date, dimension_key),
    KEY idx_consent_source_date (decision_source, metric_date),
    KEY idx_consent_state_date (consent_state, metric_date),
    KEY idx_consent_last_seen (last_seen_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

/**
 * Ensures all analytics tables exist.
 * Uses a module-level global promise so the DDL runs only once, even when called
 * concurrently from multiple request handlers. Errors are caught and logged so that
 * a single failure does not prevent subsequent requests from retrying.
 */
export async function ensureAnalyticsSchema() {
  // Return the in-flight promise if bootstrap has already been initiated.
  if (globalThis.__nadeulhaeAnalyticsSchemaPromise) {
    return globalThis.__nadeulhaeAnalyticsSchemaPromise
  }

  const bootstrapPromise = (async () => {
    const pool = getDbPool()
    await pool.query(createDailyRouteMetricsTableSql)
    await pool.query(createDailyUniqueEntitiesTableSql)
    await pool.query(createDailyActorActivityTableSql)
    await pool.query(createDailyPageContextMetricsTableSql)
    await pool.query(createDailyConsentMetricsTableSql)
  })()

  // Catch-and-log so a failed bootstrap does not become an unhandled rejection
  // and the global reference stays in place for the next caller.
  globalThis.__nadeulhaeAnalyticsSchemaPromise = bootstrapPromise.catch((error) => {
    console.error("[analytics-schema] Bootstrap failed:", error.message ?? error)
  })

  return globalThis.__nadeulhaeAnalyticsSchemaPromise
}
