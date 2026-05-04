/**
 * Jeonju briefing data-access layer.
 * Provides CRUD operations for the jeonju_daily_briefings table
 * with JSON deserialisation and mysql2 ResultSetHeader helpers.
 */
import { executeStatement, queryRows } from "@/lib/db"
import type { JeonjuDailyBriefingRow } from "./schema"

/** Structured briefing object returned to callers after DB row deserialisation. */
export interface JeonjuBriefingData {
  briefingDate: string
  locale: string
  headline: string
  summary: string
  newsItems: Array<{
    title: string
    url: string
    source: string
    snippet: string
    publishedDate: string | null
  }>
  aiInsight: string | null
  weatherNote: string | null
  festivalNote: string | null
  keywordTags: string[]
  modelUsed: string | null
  createdAt: string
  updatedAt: string
}

/** Fetch a single briefing row by date + locale. Returns null when no row exists. */
export async function getJeonjuBriefingByDateAndLocale(
  briefingDate: string,
  locale: string
): Promise<JeonjuBriefingData | null> {
  const rows = await queryRows<JeonjuDailyBriefingRow[]>(
    `
      SELECT *
      FROM jeonju_daily_briefings
      WHERE briefing_date = ?
        AND locale = ?
      LIMIT 1
    `,
    [briefingDate, locale]
  )

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]
  return rowToBriefingData(row)
}

/** Insert or replace a briefing row (UPSERT on duplicate briefing_date + locale). */
export async function saveJeonjuBriefing(data: {
  briefingDate: string
  locale: string
  headline: string
  summary: string
  newsItems: JeonjuBriefingData["newsItems"]
  aiInsight: string | null
  weatherNote: string | null
  festivalNote: string | null
  keywordTags: string[]
  searchQuery?: string
  modelUsed: string | null
  promptTokens: number
  completionTokens: number
  totalTokens: number
}): Promise<void> {
  await executeStatement(
    `
      INSERT INTO jeonju_daily_briefings (
        briefing_date, locale, headline, summary, news_items,
        ai_insight, weather_note, festival_note, keyword_tags,
        search_query, model_used, prompt_tokens, completion_tokens, total_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        headline = VALUES(headline),
        summary = VALUES(summary),
        news_items = VALUES(news_items),
        ai_insight = VALUES(ai_insight),
        weather_note = VALUES(weather_note),
        festival_note = VALUES(festival_note),
        keyword_tags = VALUES(keyword_tags),
        search_query = VALUES(search_query),
        model_used = VALUES(model_used),
        prompt_tokens = VALUES(prompt_tokens),
        completion_tokens = VALUES(completion_tokens),
        total_tokens = VALUES(total_tokens),
        updated_at = NOW()
    `,
    [
      data.briefingDate,
      data.locale,
      data.headline,
      data.summary,
      JSON.stringify(data.newsItems),
      data.aiInsight,
      data.weatherNote,
      data.festivalNote,
      JSON.stringify(data.keywordTags),
      data.searchQuery,
      data.modelUsed,
      data.promptTokens,
      data.completionTokens,
      data.totalTokens,
    ]
  )
}

/** Deserialise a raw DB row into a typed briefing object (JSON columns parsed safely). */
function rowToBriefingData(row: JeonjuDailyBriefingRow): JeonjuBriefingData {
  // Safely parse JSON news_items — malformed data yields an empty list instead of crashing
  let newsItems: JeonjuBriefingData["newsItems"] = []
  try {
    const parsed = JSON.parse(row.news_items)
    if (Array.isArray(parsed)) {
      newsItems = parsed.filter(
        (item): item is JeonjuBriefingData["newsItems"][number] =>
          item && typeof item === "object" && typeof item.title === "string"
      )
    }
  } catch {
    // ignore parse errors; fall through to empty array
  }

  // Safely parse JSON keyword_tags — same defensive approach as news_items
  let keywordTags: string[] = []
  try {
    const parsed = JSON.parse(row.keyword_tags)
    if (Array.isArray(parsed)) {
      keywordTags = parsed.filter((t): t is string => typeof t === "string")
    }
  } catch {
    // ignore parse errors; fall through to empty array
  }

  return {
    briefingDate: row.briefing_date,
    locale: row.locale,
    headline: row.headline,
    summary: row.summary,
    newsItems,
    aiInsight: row.ai_insight,
    weatherNote: row.weather_note,
    festivalNote: row.festival_note,
    keywordTags,
    modelUsed: row.model_used,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Delete briefing(s) for a given date, optionally scoped to one locale. Returns deleted row count. */
export async function deleteJeonjuBriefingsForDate(
  briefingDate: string,
  locale?: string
): Promise<number> {
  const whereClause = locale
    ? "WHERE briefing_date = ? AND locale = ?"
    : "WHERE briefing_date = ?"
  const params = locale ? [briefingDate, locale] : [briefingDate]

  const result = await executeStatement(
    `DELETE FROM jeonju_daily_briefings ${whereClause}`,
    params
  )
  // mysql2 ResultSetHeader has affectedRows
  return (result as any).affectedRows ?? 0
}
