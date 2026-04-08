import fs from "node:fs"
import path from "node:path"

import mysql from "mysql2/promise"

const envPath = path.join(process.cwd(), ".env.local")

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8")
  for (const line of envContent.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue
    const separatorIndex = line.indexOf("=")
    if (separatorIndex < 0) continue
    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

const required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

const caPath = process.env.DB_CA_PATH
const ssl = caPath
  ? { ca: fs.readFileSync(caPath, "utf8"), rejectUnauthorized: true }
  : { rejectUnauthorized: true, minVersion: "TLSv1.2" }

const rootConnection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? "4000"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl,
})

await rootConnection.query(
  `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
)
await rootConnection.end()

const appConnection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? "4000"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl,
})

await appConnection.query(`
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
`)

await appConnection.query(`
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
`)

await appConnection.query(`
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
`)

await appConnection.query(`
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
`)

await appConnection.query(`
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
`)

await appConnection.query(`
  CREATE TABLE IF NOT EXISTS analytics_daily_unique_entities (
    metric_date DATE NOT NULL,
    dimension_key CHAR(64) NOT NULL,
    entity_type VARCHAR(16) NOT NULL,
    entity_hash CHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (metric_date, dimension_key, entity_type, entity_hash),
    KEY idx_analytics_unique_created (created_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`)

await appConnection.query(`
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
`)

console.log(`Auth and analytics schema initialized in database: ${process.env.DB_NAME}`)

await appConnection.end()
