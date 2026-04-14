import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise"

import {
  LAB_DAILY_GENERATION_LIMIT,
  LAB_DUE_CARD_FETCH_LIMIT,
  LAB_RECENT_DECK_LIMIT,
  LAB_SRS_INTERVAL_MS,
  LAB_SRS_MAX_STAGE,
} from "@/lib/lab/constants"
import { ensureLabSchema } from "@/lib/lab/schema"
import type {
  LabCardSnapshot,
  LabDeckSnapshot,
  LabGeneratedCardInput,
  LabLocale,
  LabStateSnapshot,
  LabUsageSnapshot,
} from "@/lib/lab/types"
import { executeStatement, getDbPool, queryRows } from "@/lib/db"
import {
  decryptDatabaseValueSafely,
  encryptDatabaseValue,
  encryptDatabaseValueSafely,
} from "@/lib/security/data-protection"

interface LabDeckRow extends RowDataPacket {
  id: number
  user_id: string
  locale: string
  title_text: string
  topic_text: string
  requested_model: string | null
  resolved_model: string | null
  card_count: number
  created_at: Date | string
}

interface LabCardRow extends RowDataPacket {
  id: number
  deck_id: number
  user_id: string
  term_text: string
  meaning_text: string
  example_text: string | null
  tip_text: string | null
  stage: number
  next_review_at: Date | string
  last_reviewed_at: Date | string | null
  created_at: Date | string
}

interface LabUsageRow extends RowDataPacket {
  metric_date: Date | string
  user_id: string
  generation_count: number
  review_count: number
}

function toIsoString(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

function normalizeText(value: string, maxLength: number) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
}

function normalizeOptionalText(value: string | null | undefined, maxLength: number) {
  if (!value) {
    return null
  }

  const normalized = normalizeText(value, maxLength)
  return normalized.length > 0 ? normalized : null
}

function decryptLabText(value: string | null, context: string, fallback: string | null = null) {
  if (typeof value !== "string") {
    return fallback
  }

  return decryptDatabaseValueSafely(value, context) ?? value
}

function mapCardRow(row: LabCardRow): LabCardSnapshot {
  return {
    id: String(row.id),
    deckId: String(row.deck_id),
    term: decryptLabText(row.term_text, "lab.card.term", "-") ?? "-",
    meaning: decryptLabText(row.meaning_text, "lab.card.meaning", "-") ?? "-",
    example: decryptLabText(row.example_text, "lab.card.example"),
    tip: decryptLabText(row.tip_text, "lab.card.tip"),
    stage: Math.max(0, Math.min(LAB_SRS_MAX_STAGE, Number(row.stage ?? 0))),
    nextReviewAt: toIsoString(row.next_review_at),
    lastReviewedAt: row.last_reviewed_at ? toIsoString(row.last_reviewed_at) : null,
    createdAt: toIsoString(row.created_at),
  }
}

function mapDeckRow(row: LabDeckRow): LabDeckSnapshot {
  return {
    id: String(row.id),
    locale: (row.locale === "en" ? "en" : "ko") as LabLocale,
    title: decryptLabText(row.title_text, "lab.deck.title", "Lab Deck") ?? "Lab Deck",
    topic: decryptLabText(row.topic_text, "lab.deck.topic", "-") ?? "-",
    cardCount: Math.max(0, Number(row.card_count ?? 0)),
    requestedModel: row.requested_model,
    resolvedModel: row.resolved_model,
    createdAt: toIsoString(row.created_at),
  }
}

function getKstMetricDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function createUsageSnapshot(metricDate: string, generationCount: number, reviewCount: number): LabUsageSnapshot {
  const safeGeneration = Math.max(0, generationCount)
  const safeReview = Math.max(0, reviewCount)
  return {
    metricDate,
    generationCount: safeGeneration,
    remainingGenerations: Math.max(0, LAB_DAILY_GENERATION_LIMIT - safeGeneration),
    dailyGenerationLimit: LAB_DAILY_GENERATION_LIMIT,
    reviewCount: safeReview,
  }
}

async function upsertDailyUsageRow(connection: PoolConnection, metricDate: string, userId: string) {
  await connection.execute(
    `
      INSERT INTO lab_daily_usage (
        metric_date,
        user_id,
        generation_count,
        review_count
      ) VALUES (?, ?, 0, 0)
      ON DUPLICATE KEY UPDATE user_id = user_id
    `,
    [metricDate, userId]
  )
}

export async function reserveDailyLabGeneration(userId: string) {
  await ensureLabSchema()

  const metricDate = getKstMetricDate()
  const connection = await getDbPool().getConnection()

  try {
    await connection.beginTransaction()
    await upsertDailyUsageRow(connection, metricDate, userId)

    const [rows] = await connection.query<LabUsageRow[]>(
      `
        SELECT
          metric_date,
          user_id,
          generation_count,
          review_count
        FROM lab_daily_usage
        WHERE metric_date = ?
          AND user_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [metricDate, userId]
    )

    const usage = rows[0] ?? {
      metric_date: metricDate,
      user_id: userId,
      generation_count: 0,
      review_count: 0,
    }

    if (usage.generation_count >= LAB_DAILY_GENERATION_LIMIT) {
      await connection.commit()
      return {
        allowed: false,
        usage: createUsageSnapshot(metricDate, usage.generation_count, usage.review_count),
      }
    }

    const nextGenerationCount = usage.generation_count + 1
    await connection.execute(
      `
        UPDATE lab_daily_usage
        SET
          generation_count = ?,
          updated_at = NOW()
        WHERE metric_date = ?
          AND user_id = ?
      `,
      [nextGenerationCount, metricDate, userId]
    )

    await connection.commit()

    return {
      allowed: true,
      usage: createUsageSnapshot(metricDate, nextGenerationCount, usage.review_count),
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function refundDailyLabGeneration(userId: string) {
  await ensureLabSchema()
  const metricDate = getKstMetricDate()

  await executeStatement(
    `
      UPDATE lab_daily_usage
      SET
        generation_count = GREATEST(generation_count - 1, 0),
        updated_at = NOW()
      WHERE metric_date = ?
        AND user_id = ?
    `,
    [metricDate, userId]
  )
}

function clampStage(value: number) {
  return Math.max(0, Math.min(LAB_SRS_MAX_STAGE, Math.floor(value)))
}

function getNextStage(currentStage: number, known: boolean) {
  if (known) {
    return Math.min(currentStage + 1, LAB_SRS_MAX_STAGE)
  }
  return Math.max(currentStage - 2, 0)
}

export async function createLabDeckWithCards(input: {
  userId: string
  locale: LabLocale
  title: string
  topic: string
  cards: LabGeneratedCardInput[]
  requestedModel: string | null
  resolvedModel: string | null
}) {
  await ensureLabSchema()

  const normalizedTitle = normalizeText(input.title, 120) || "Nadeul Lab"
  const normalizedTopic = normalizeText(input.topic, 200)
  const normalizedCards = input.cards
    .map((card) => ({
      term: normalizeText(card.term, 80),
      meaning: normalizeText(card.meaning, 220),
      example: normalizeOptionalText(card.example ?? null, 280),
      tip: normalizeOptionalText(card.tip ?? null, 200),
    }))
    .filter((card) => card.term.length > 0 && card.meaning.length > 0)

  if (normalizedCards.length === 0) {
    throw new Error("No valid lab cards were generated.")
  }

  const now = new Date()
  const connection = await getDbPool().getConnection()

  try {
    await connection.beginTransaction()

    const [deckInsert] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO lab_decks (
          user_id,
          locale,
          title_text,
          topic_text,
          requested_model,
          resolved_model,
          card_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.userId,
        input.locale,
        encryptDatabaseValue(normalizedTitle, "lab.deck.title"),
        encryptDatabaseValue(normalizedTopic, "lab.deck.topic"),
        input.requestedModel,
        input.resolvedModel,
        normalizedCards.length,
      ]
    )

    const deckId = Number(deckInsert.insertId)
    const snapshots: LabCardSnapshot[] = []

    for (const card of normalizedCards) {
      const [cardInsert] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO lab_cards (
            deck_id,
            user_id,
            term_text,
            meaning_text,
            example_text,
            tip_text,
            stage,
            next_review_at,
            last_reviewed_at
          ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL)
        `,
        [
          deckId,
          input.userId,
          encryptDatabaseValue(card.term, "lab.card.term"),
          encryptDatabaseValue(card.meaning, "lab.card.meaning"),
          encryptDatabaseValueSafely(card.example, "lab.card.example"),
          encryptDatabaseValueSafely(card.tip, "lab.card.tip"),
          now,
        ]
      )

      snapshots.push({
        id: String(cardInsert.insertId),
        deckId: String(deckId),
        term: card.term,
        meaning: card.meaning,
        example: card.example,
        tip: card.tip,
        stage: 0,
        nextReviewAt: now.toISOString(),
        lastReviewedAt: null,
        createdAt: now.toISOString(),
      })
    }

    await connection.commit()

    return {
      deck: {
        id: String(deckId),
        locale: input.locale,
        title: normalizedTitle,
        topic: normalizedTopic,
        cardCount: snapshots.length,
        requestedModel: input.requestedModel,
        resolvedModel: input.resolvedModel,
        createdAt: now.toISOString(),
      } satisfies LabDeckSnapshot,
      cards: snapshots,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function getLabState(userId: string): Promise<LabStateSnapshot> {
  await ensureLabSchema()

  const metricDate = getKstMetricDate()
  const [usageRows, dueRows, recentDeckRows] = await Promise.all([
    queryRows<LabUsageRow[]>(
      `
        SELECT
          metric_date,
          user_id,
          generation_count,
          review_count
        FROM lab_daily_usage
        WHERE metric_date = ?
          AND user_id = ?
        LIMIT 1
      `,
      [metricDate, userId]
    ),
    queryRows<LabCardRow[]>(
      `
        SELECT
          id,
          deck_id,
          user_id,
          term_text,
          meaning_text,
          example_text,
          tip_text,
          stage,
          next_review_at,
          last_reviewed_at,
          created_at
        FROM lab_cards
        WHERE user_id = ?
          AND next_review_at <= NOW()
        ORDER BY next_review_at ASC, id ASC
        LIMIT ?
      `,
      [userId, LAB_DUE_CARD_FETCH_LIMIT]
    ),
    queryRows<LabDeckRow[]>(
      `
        SELECT
          id,
          user_id,
          locale,
          title_text,
          topic_text,
          requested_model,
          resolved_model,
          card_count,
          created_at
        FROM lab_decks
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `,
      [userId, LAB_RECENT_DECK_LIMIT]
    ),
  ])

  const usageRow = usageRows[0]
  const usage = createUsageSnapshot(
    metricDate,
    usageRow?.generation_count ?? 0,
    usageRow?.review_count ?? 0
  )

  return {
    usage,
    dueCards: dueRows.map(mapCardRow),
    recentDecks: recentDeckRows.map(mapDeckRow),
  }
}

export async function applyLabCardReview(input: {
  userId: string
  cardId: number
  known: boolean
}) {
  await ensureLabSchema()

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()

    const [rows] = await connection.query<LabCardRow[]>(
      `
        SELECT
          id,
          deck_id,
          user_id,
          term_text,
          meaning_text,
          example_text,
          tip_text,
          stage,
          next_review_at,
          last_reviewed_at,
          created_at
        FROM lab_cards
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [input.cardId, input.userId]
    )

    const current = rows[0]
    if (!current) {
      await connection.rollback()
      return null
    }

    const currentStage = clampStage(Number(current.stage ?? 0))
    const nextStage = getNextStage(currentStage, input.known)
    const nextReviewAt = new Date(Date.now() + LAB_SRS_INTERVAL_MS[nextStage])
    const reviewedAt = new Date()

    await connection.execute(
      `
        UPDATE lab_cards
        SET
          stage = ?,
          next_review_at = ?,
          last_reviewed_at = ?,
          updated_at = NOW()
        WHERE id = ?
          AND user_id = ?
      `,
      [nextStage, nextReviewAt, reviewedAt, input.cardId, input.userId]
    )

    const metricDate = getKstMetricDate()
    await upsertDailyUsageRow(connection, metricDate, input.userId)
    await connection.execute(
      `
        UPDATE lab_daily_usage
        SET
          review_count = review_count + 1,
          updated_at = NOW()
        WHERE metric_date = ?
          AND user_id = ?
      `,
      [metricDate, input.userId]
    )

    const [usageRows] = await connection.query<LabUsageRow[]>(
      `
        SELECT
          metric_date,
          user_id,
          generation_count,
          review_count
        FROM lab_daily_usage
        WHERE metric_date = ?
          AND user_id = ?
        LIMIT 1
      `,
      [metricDate, input.userId]
    )

    await connection.commit()

    const usage = createUsageSnapshot(
      metricDate,
      usageRows[0]?.generation_count ?? 0,
      usageRows[0]?.review_count ?? 0
    )

    return {
      card: {
        id: String(current.id),
        deckId: String(current.deck_id),
        term: decryptLabText(current.term_text, "lab.card.term", "-") ?? "-",
        meaning: decryptLabText(current.meaning_text, "lab.card.meaning", "-") ?? "-",
        example: decryptLabText(current.example_text, "lab.card.example"),
        tip: decryptLabText(current.tip_text, "lab.card.tip"),
        stage: nextStage,
        nextReviewAt: nextReviewAt.toISOString(),
        lastReviewedAt: reviewedAt.toISOString(),
        createdAt: toIsoString(current.created_at),
      } satisfies LabCardSnapshot,
      usage,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function deleteLabDataForUser(userId: string) {
  await ensureLabSchema()

  await executeStatement("DELETE FROM lab_cards WHERE user_id = ?", [userId])
  await executeStatement("DELETE FROM lab_decks WHERE user_id = ?", [userId])
  await executeStatement("DELETE FROM lab_daily_usage WHERE user_id = ?", [userId])
}
