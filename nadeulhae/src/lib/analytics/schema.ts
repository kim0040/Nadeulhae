import { getDbPool } from "@/lib/db"

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

export async function ensureAnalyticsSchema() {
  if (globalThis.__nadeulhaeAnalyticsSchemaPromise) {
    return globalThis.__nadeulhaeAnalyticsSchemaPromise
  }

  const bootstrapPromise = (async () => {
    const pool = getDbPool()
    await pool.query(createDailyRouteMetricsTableSql)
    await pool.query(createDailyUniqueEntitiesTableSql)
    await pool.query(createDailyActorActivityTableSql)
  })()

  globalThis.__nadeulhaeAnalyticsSchemaPromise = bootstrapPromise.catch((error) => {
    globalThis.__nadeulhaeAnalyticsSchemaPromise = undefined
    throw error
  })

  return globalThis.__nadeulhaeAnalyticsSchemaPromise
}
