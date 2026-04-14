import { getDbPool } from "@/lib/db"

declare global {
  var __nadeulhaeLabSchemaPromise: Promise<void> | undefined
}

const createLabDecksTableSql = `
  CREATE TABLE IF NOT EXISTS lab_decks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    locale VARCHAR(8) NOT NULL,
    title_text LONGTEXT NOT NULL,
    topic_text LONGTEXT NOT NULL,
    requested_model VARCHAR(191) NULL,
    resolved_model VARCHAR(191) NULL,
    card_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_lab_decks_user_created (user_id, created_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createLabCardsTableSql = `
  CREATE TABLE IF NOT EXISTS lab_cards (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    deck_id BIGINT UNSIGNED NOT NULL,
    user_id CHAR(36) NOT NULL,
    term_text LONGTEXT NOT NULL,
    meaning_text LONGTEXT NOT NULL,
    example_text LONGTEXT NULL,
    tip_text LONGTEXT NULL,
    stage TINYINT UNSIGNED NOT NULL DEFAULT 0,
    next_review_at DATETIME NOT NULL,
    last_reviewed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_lab_cards_user_due (user_id, next_review_at),
    KEY idx_lab_cards_deck (deck_id, created_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const createLabDailyUsageTableSql = `
  CREATE TABLE IF NOT EXISTS lab_daily_usage (
    metric_date DATE NOT NULL,
    user_id CHAR(36) NOT NULL,
    generation_count INT UNSIGNED NOT NULL DEFAULT 0,
    review_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (metric_date, user_id),
    KEY idx_lab_usage_user_metric (user_id, metric_date)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

export async function ensureLabSchema() {
  if (globalThis.__nadeulhaeLabSchemaPromise) {
    return globalThis.__nadeulhaeLabSchemaPromise
  }

  const bootstrapPromise = (async () => {
    const pool = getDbPool()
    await pool.query(createLabDecksTableSql)
    await pool.query(createLabCardsTableSql)
    await pool.query(createLabDailyUsageTableSql)
  })()

  globalThis.__nadeulhaeLabSchemaPromise = bootstrapPromise.catch((error) => {
    globalThis.__nadeulhaeLabSchemaPromise = undefined
    throw error
  })

  return globalThis.__nadeulhaeLabSchemaPromise
}
