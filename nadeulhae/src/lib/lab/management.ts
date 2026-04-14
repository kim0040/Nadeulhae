import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise"

import {
  LAB_DEFAULT_DIFFICULTY,
  LAB_DEFAULT_STABILITY_DAYS,
  LAB_EXPORT_CARD_LIMIT,
  LAB_IMPORT_MAX_CARD_COUNT,
} from "@/lib/lab/constants"
import { ensureLabSchema } from "@/lib/lab/schema"
import type { LabCardSnapshot, LabDeckSnapshot, LabGeneratedCardInput, LabLocale } from "@/lib/lab/types"
import { getDbPool, queryRows } from "@/lib/db"
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
  learning_state: string
  stage: number
  stability_days: number
  difficulty: number
  total_reviews: number
  lapses: number
  next_review_at: Date | string
  last_reviewed_at: Date | string | null
  created_at: Date | string
}

interface LabCardKeyRow extends RowDataPacket {
  term_text: string
  meaning_text: string
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

function mapCardRow(row: LabCardRow): LabCardSnapshot {
  return {
    id: String(row.id),
    deckId: String(row.deck_id),
    term: decryptLabText(row.term_text, "lab.card.term", "-") ?? "-",
    meaning: decryptLabText(row.meaning_text, "lab.card.meaning", "-") ?? "-",
    example: decryptLabText(row.example_text, "lab.card.example"),
    tip: decryptLabText(row.tip_text, "lab.card.tip"),
    learningState: row.learning_state === "learning"
      ? "learning"
      : row.learning_state === "review"
        ? "review"
        : row.learning_state === "relearning"
          ? "relearning"
          : "new",
    stage: Math.max(0, Math.floor(Number(row.stage ?? 0))),
    stabilityDays: Number(row.stability_days ?? LAB_DEFAULT_STABILITY_DAYS),
    difficulty: Number(row.difficulty ?? LAB_DEFAULT_DIFFICULTY),
    retrievability: null,
    totalReviews: Math.max(0, Number(row.total_reviews ?? 0)),
    lapses: Math.max(0, Number(row.lapses ?? 0)),
    nextReviewAt: toIsoString(row.next_review_at),
    lastReviewedAt: row.last_reviewed_at ? toIsoString(row.last_reviewed_at) : null,
    createdAt: toIsoString(row.created_at),
  }
}

function toDeckDedupKey(term: string, meaning: string) {
  return `${term.toLowerCase().replace(/\s+/g, "")}|${meaning.toLowerCase().replace(/\s+/g, "")}`
}

function normalizeCards(cards: LabGeneratedCardInput[]) {
  const safeCards: LabGeneratedCardInput[] = []

  for (const card of cards.slice(0, LAB_IMPORT_MAX_CARD_COUNT)) {
    const term = normalizeText(card.term ?? "", 80)
    const meaning = normalizeText(card.meaning ?? "", 220)
    const example = normalizeOptionalText(card.example ?? null, 280)
    const tip = normalizeOptionalText(card.tip ?? null, 200)

    if (!term || !meaning) {
      continue
    }

    safeCards.push({
      term,
      meaning,
      example,
      tip,
    })
  }

  return safeCards
}

async function getDeckById(connection: PoolConnection, userId: string, deckId: number) {
  const [rows] = await connection.query<LabDeckRow[]>(
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
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [deckId, userId]
  )

  return rows[0] ?? null
}

async function refreshDeckCardCount(connection: PoolConnection, userId: string, deckId: number) {
  await connection.execute(
    `
      UPDATE lab_decks d
      SET
        d.card_count = (
          SELECT COUNT(*)
          FROM lab_cards c
          WHERE c.deck_id = d.id
            AND c.user_id = d.user_id
        ),
        d.updated_at = NOW()
      WHERE d.id = ?
        AND d.user_id = ?
    `,
    [deckId, userId]
  )
}

export async function listLabDecksForUser(userId: string, limit = 80) {
  await ensureLabSchema()

  const safeLimit = Math.min(300, Math.max(1, Math.floor(limit)))
  const rows = await queryRows<LabDeckRow[]>(
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
    [userId, safeLimit]
  )

  return rows.map(mapDeckRow)
}

export async function createEmptyLabDeck(input: {
  userId: string
  locale: LabLocale
  title: string
  topic: string | null
}) {
  await ensureLabSchema()

  const title = normalizeText(input.title, 120) || "Nadeul Lab"
  const topic = normalizeOptionalText(input.topic, 200) ?? title

  const connection = await getDbPool().getConnection()

  try {
    await connection.beginTransaction()

    const [insertResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO lab_decks (
          user_id,
          locale,
          title_text,
          topic_text,
          requested_model,
          resolved_model,
          card_count
        ) VALUES (?, ?, ?, ?, NULL, NULL, 0)
      `,
      [
        input.userId,
        input.locale,
        encryptDatabaseValue(title, "lab.deck.title"),
        encryptDatabaseValue(topic, "lab.deck.topic"),
      ]
    )

    const deckId = Number(insertResult.insertId)
    const row = await getDeckById(connection, input.userId, deckId)

    await connection.commit()

    if (!row) {
      throw new Error("Failed to read created lab deck.")
    }

    return mapDeckRow(row)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function updateLabDeckForUser(input: {
  userId: string
  deckId: number
  title: string
  topic: string | null
}) {
  await ensureLabSchema()

  const title = normalizeText(input.title, 120)
  if (!title) {
    return null
  }

  const topic = normalizeOptionalText(input.topic, 200) ?? title

  const connection = await getDbPool().getConnection()

  try {
    await connection.beginTransaction()

    const row = await getDeckById(connection, input.userId, input.deckId)
    if (!row) {
      await connection.rollback()
      return null
    }

    await connection.execute(
      `
        UPDATE lab_decks
        SET
          title_text = ?,
          topic_text = ?,
          updated_at = NOW()
        WHERE id = ?
          AND user_id = ?
      `,
      [
        encryptDatabaseValue(title, "lab.deck.title"),
        encryptDatabaseValue(topic, "lab.deck.topic"),
        input.deckId,
        input.userId,
      ]
    )

    const updatedRow = await getDeckById(connection, input.userId, input.deckId)
    await connection.commit()

    if (!updatedRow) {
      return null
    }

    return mapDeckRow(updatedRow)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function resolveDeckForWrite(input: {
  connection: PoolConnection
  userId: string
  locale: LabLocale
  deckId: number | null
  deckTitle: string | null
  deckTopic: string | null
}) {
  if (input.deckId && input.deckId > 0) {
    const existing = await getDeckById(input.connection, input.userId, input.deckId)
    return existing
  }

  const title = normalizeText(input.deckTitle ?? "", 120) || "Nadeul Lab"
  const topic = normalizeOptionalText(input.deckTopic, 200) ?? title

  const [insertResult] = await input.connection.execute<ResultSetHeader>(
    `
      INSERT INTO lab_decks (
        user_id,
        locale,
        title_text,
        topic_text,
        requested_model,
        resolved_model,
        card_count
      ) VALUES (?, ?, ?, ?, NULL, NULL, 0)
    `,
    [
      input.userId,
      input.locale,
      encryptDatabaseValue(title, "lab.deck.title"),
      encryptDatabaseValue(topic, "lab.deck.topic"),
    ]
  )

  const deckId = Number(insertResult.insertId)
  return getDeckById(input.connection, input.userId, deckId)
}

export async function addLabCardsToDeck(input: {
  userId: string
  locale: LabLocale
  deckId: number | null
  deckTitle: string | null
  deckTopic: string | null
  cards: LabGeneratedCardInput[]
}) {
  await ensureLabSchema()

  const cards = normalizeCards(input.cards)
  if (cards.length === 0) {
    return {
      deck: null,
      addedCount: 0,
      skippedCount: 0,
    }
  }

  const connection = await getDbPool().getConnection()

  try {
    await connection.beginTransaction()

    const deckRow = await resolveDeckForWrite({
      connection,
      userId: input.userId,
      locale: input.locale,
      deckId: input.deckId,
      deckTitle: input.deckTitle,
      deckTopic: input.deckTopic,
    })

    if (!deckRow) {
      await connection.rollback()
      return {
        deck: null,
        addedCount: 0,
        skippedCount: cards.length,
      }
    }

    const deckId = Number(deckRow.id)

    const [existingRows] = await connection.query<LabCardKeyRow[]>(
      `
        SELECT
          term_text,
          meaning_text
        FROM lab_cards
        WHERE user_id = ?
          AND deck_id = ?
      `,
      [input.userId, deckId]
    )

    const dedupeKeys = new Set<string>()
    for (const row of existingRows) {
      const term = decryptLabText(row.term_text, "lab.card.term", "") ?? ""
      const meaning = decryptLabText(row.meaning_text, "lab.card.meaning", "") ?? ""
      if (!term || !meaning) {
        continue
      }
      dedupeKeys.add(toDeckDedupKey(term, meaning))
    }

    const now = new Date()
    let addedCount = 0

    for (const card of cards) {
      const key = toDeckDedupKey(card.term, card.meaning)
      if (dedupeKeys.has(key)) {
        continue
      }

      dedupeKeys.add(key)

      await connection.execute(
        `
          INSERT INTO lab_cards (
            deck_id,
            user_id,
            term_text,
            meaning_text,
            example_text,
            tip_text,
            learning_state,
            consecutive_correct,
            stage,
            stability_days,
            difficulty,
            total_reviews,
            lapses,
            last_review_outcome,
            next_review_at,
            last_reviewed_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'new', 0, 0, ?, ?, 0, 0, NULL, NOW(), NULL)
        `,
        [
          deckId,
          input.userId,
          encryptDatabaseValue(card.term, "lab.card.term"),
          encryptDatabaseValue(card.meaning, "lab.card.meaning"),
          encryptDatabaseValueSafely(card.example ?? null, "lab.card.example"),
          encryptDatabaseValueSafely(card.tip ?? null, "lab.card.tip"),
          LAB_DEFAULT_STABILITY_DAYS,
          LAB_DEFAULT_DIFFICULTY,
        ]
      )

      addedCount += 1
    }

    await refreshDeckCardCount(connection, input.userId, deckId)

    const refreshedDeckRow = await getDeckById(connection, input.userId, deckId)

    await connection.commit()

    return {
      deck: refreshedDeckRow ? mapDeckRow(refreshedDeckRow) : null,
      addedCount,
      skippedCount: Math.max(0, cards.length - addedCount),
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function getLabDeckExportData(input: {
  userId: string
  deckId: number
}) {
  await ensureLabSchema()

  const [deckRows, cardRows] = await Promise.all([
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
          AND id = ?
        LIMIT 1
      `,
      [input.userId, input.deckId]
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
          learning_state,
          stage,
          stability_days,
          difficulty,
          total_reviews,
          lapses,
          next_review_at,
          last_reviewed_at,
          created_at
        FROM lab_cards
        WHERE user_id = ?
          AND deck_id = ?
        ORDER BY created_at ASC, id ASC
        LIMIT ?
      `,
      [input.userId, input.deckId, LAB_EXPORT_CARD_LIMIT]
    ),
  ])

  const deck = deckRows[0]
  if (!deck) {
    return null
  }

  return {
    deck: mapDeckRow(deck),
    cards: cardRows.map(mapCardRow),
  }
}

export async function deleteLabDeckForUser(input: {
  userId: string
  deckId: number
}) {
  await ensureLabSchema()

  const connection = await getDbPool().getConnection()

  try {
    await connection.beginTransaction()

    const row = await getDeckById(connection, input.userId, input.deckId)
    if (!row) {
      await connection.rollback()
      return false
    }

    await connection.execute(
      `DELETE FROM lab_cards WHERE deck_id = ? AND user_id = ?`,
      [input.deckId, input.userId]
    )

    await connection.execute(
      `DELETE FROM lab_decks WHERE id = ? AND user_id = ?`,
      [input.deckId, input.userId]
    )

    await connection.commit()
    return true
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
