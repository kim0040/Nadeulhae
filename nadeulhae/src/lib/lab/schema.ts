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
    learning_state VARCHAR(16) NOT NULL DEFAULT 'new',
    consecutive_correct TINYINT UNSIGNED NOT NULL DEFAULT 0,
    stage TINYINT UNSIGNED NOT NULL DEFAULT 0,
    stability_days DOUBLE NOT NULL DEFAULT 0.2,
    difficulty DOUBLE NOT NULL DEFAULT 5,
    total_reviews INT UNSIGNED NOT NULL DEFAULT 0,
    lapses INT UNSIGNED NOT NULL DEFAULT 0,
    last_review_outcome TINYINT UNSIGNED NULL,
    next_review_at DATETIME NOT NULL,
    last_reviewed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_lab_cards_user_due (user_id, next_review_at),
    KEY idx_lab_cards_deck (deck_id, created_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const addLabCardsLearningStateColumnSql = `
  ALTER TABLE lab_cards
    ADD COLUMN IF NOT EXISTS learning_state VARCHAR(16) NOT NULL DEFAULT 'new' AFTER tip_text
`

const addLabCardsConsecutiveCorrectColumnSql = `
  ALTER TABLE lab_cards
    ADD COLUMN IF NOT EXISTS consecutive_correct TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER learning_state
`

const addLabCardsStabilityColumnSql = `
  ALTER TABLE lab_cards
    ADD COLUMN IF NOT EXISTS stability_days DOUBLE NOT NULL DEFAULT 0.2 AFTER stage
`

const addLabCardsDifficultyColumnSql = `
  ALTER TABLE lab_cards
    ADD COLUMN IF NOT EXISTS difficulty DOUBLE NOT NULL DEFAULT 5 AFTER stability_days
`

const addLabCardsTotalReviewsColumnSql = `
  ALTER TABLE lab_cards
    ADD COLUMN IF NOT EXISTS total_reviews INT UNSIGNED NOT NULL DEFAULT 0 AFTER difficulty
`

const addLabCardsLapsesColumnSql = `
  ALTER TABLE lab_cards
    ADD COLUMN IF NOT EXISTS lapses INT UNSIGNED NOT NULL DEFAULT 0 AFTER total_reviews
`

const addLabCardsLastOutcomeColumnSql = `
  ALTER TABLE lab_cards
    ADD COLUMN IF NOT EXISTS last_review_outcome TINYINT UNSIGNED NULL AFTER lapses
`

const backfillLabCardsLearningStateSql = `
  UPDATE lab_cards
  SET learning_state = CASE
    WHEN last_reviewed_at IS NULL AND stage = 0 THEN 'new'
    WHEN stage >= 2 THEN 'review'
    WHEN stage = 1 THEN 'learning'
    ELSE 'relearning'
  END
  WHERE learning_state = 'new'
`

const backfillLabCardsStabilitySql = `
  UPDATE lab_cards
  SET stability_days = CASE
    WHEN stage <= 0 THEN 0.2
    WHEN stage = 1 THEN 1
    WHEN stage = 2 THEN 3
    WHEN stage = 3 THEN 7
    WHEN stage = 4 THEN 14
    WHEN stage = 5 THEN 30
    WHEN stage = 6 THEN 60
    ELSE 120
  END
  WHERE stability_days <= 0.2
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
    await pool.query(addLabCardsLearningStateColumnSql)
    await pool.query(addLabCardsConsecutiveCorrectColumnSql)
    await pool.query(addLabCardsStabilityColumnSql)
    await pool.query(addLabCardsDifficultyColumnSql)
    await pool.query(addLabCardsTotalReviewsColumnSql)
    await pool.query(addLabCardsLapsesColumnSql)
    await pool.query(addLabCardsLastOutcomeColumnSql)
    await pool.query(backfillLabCardsLearningStateSql)
    await pool.query(backfillLabCardsStabilitySql)
    await pool.query(createLabDailyUsageTableSql)
  })()

  globalThis.__nadeulhaeLabSchemaPromise = bootstrapPromise.catch((error) => {
    globalThis.__nadeulhaeLabSchemaPromise = undefined
    throw error
  })

  return globalThis.__nadeulhaeLabSchemaPromise
}
