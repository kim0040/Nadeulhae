import { getDbPool } from "@/lib/db"
import type { RowDataPacket } from "mysql2/promise"

declare global {
  var __nadeulhaeJeonjuBriefingSchemaPromise: Promise<void> | undefined
}

const createJeonjuDailyBriefingTableSql = `
  CREATE TABLE IF NOT EXISTS jeonju_daily_briefings (
    briefing_date DATE NOT NULL PRIMARY KEY,
    locale VARCHAR(8) NOT NULL DEFAULT 'ko',
    headline VARCHAR(255) NOT NULL DEFAULT '',
    summary LONGTEXT NOT NULL,
    news_items JSON NOT NULL,
    ai_insight LONGTEXT NULL,
    weather_note VARCHAR(255) NULL,
    festival_note VARCHAR(255) NULL,
    keyword_tags JSON NOT NULL,
    search_query TEXT NOT NULL,
    model_used VARCHAR(191) NULL,
    prompt_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    completion_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    total_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_jeonju_briefing_date (briefing_date),
    KEY idx_jeonju_briefing_updated (updated_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

export async function ensureJeonjuBriefingSchema() {
  if (globalThis.__nadeulhaeJeonjuBriefingSchemaPromise) {
    return globalThis.__nadeulhaeJeonjuBriefingSchemaPromise
  }

  const bootstrapPromise = (async () => {
    const pool = getDbPool()
    await pool.query(createJeonjuDailyBriefingTableSql)
  })()

  globalThis.__nadeulhaeJeonjuBriefingSchemaPromise = bootstrapPromise.catch((error) => {
    globalThis.__nadeulhaeJeonjuBriefingSchemaPromise = undefined
    throw error
  })

  return globalThis.__nadeulhaeJeonjuBriefingSchemaPromise
}

export interface JeonjuDailyBriefingRow extends RowDataPacket {
  briefing_date: string
  locale: string
  headline: string
  summary: string
  news_items: string // JSON
  ai_insight: string | null
  weather_note: string | null
  festival_note: string | null
  keyword_tags: string // JSON
  search_query: string
  model_used: string | null
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  created_at: string
  updated_at: string
}
