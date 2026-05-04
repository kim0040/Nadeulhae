/** Lab deck management layer: create, update, delete decks and cards, with encryption, deduplication, and transactional safety. */

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

/** Raw deck row from the lab_decks table. */
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

/** Raw card row from the lab_cards table. */
interface LabCardRow extends RowDataPacket {
  id: number
  deck_id: number
  user_id: string
  term_text: string
  meaning_text: string
  pos_text: string | null
  example_text: string | null
  example_translation_text: string | null
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

/** Subset row used for deduplication key lookup (term + meaning only). */
interface LabCardKeyRow extends RowDataPacket {
  term_text: string
  meaning_text: string
}

/** Subset row with id, used for dedup check excluding the current card. */
interface LabCardKeyWithIdRow extends RowDataPacket {
  id: number
  term_text: string
  meaning_text: string
}

// --- Internal helpers ---

/** Safely convert Date or date string to ISO-8601, falling back to current time on parse failure. */
function toIsoString(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

/** Strip control characters, collapse whitespace, trim, and truncate to maxLength. */
function normalizeText(value: string, maxLength: number) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
}

/** Same as normalizeText but returns null for falsy or empty input. */
function normalizeOptionalText(value: string | null | undefined, maxLength: number) {
  if (!value) {
    return null
  }

  const normalized = normalizeText(value, maxLength)
  return normalized.length > 0 ? normalized : null
}

/** Decrypt an encrypted text field; returns the fallback value if the input is not a string. */
function decryptLabText(value: string | null, context: string, fallback: string | null = null) {
  if (typeof value !== "string") {
    return fallback
  }

  return decryptDatabaseValueSafely(value, context) ?? value
}

/** Map a raw deck database row to a LabDeckSnapshot, decrypting text fields. */
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

/** Map a raw card database row to a LabCardSnapshot, decrypting text fields and clamping numeric values. */
function mapCardRow(row: LabCardRow): LabCardSnapshot {
  return {
    id: String(row.id),
    deckId: String(row.deck_id),
    term: decryptLabText(row.term_text, "lab.card.term", "-") ?? "-",
    meaning: decryptLabText(row.meaning_text, "lab.card.meaning", "-") ?? "-",
    partOfSpeech: decryptLabText(row.pos_text, "lab.card.pos"),
    example: decryptLabText(row.example_text, "lab.card.example"),
    exampleTranslation: decryptLabText(row.example_translation_text, "lab.card.example_translation"),
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

/** Build a case-insensitive, whitespace-normalized dedup key from term and meaning. */
function toDeckDedupKey(term: string, meaning: string) {
  return `${term.toLowerCase().replace(/\s+/g, "")}|${meaning.toLowerCase().replace(/\s+/g, "")}`
}

/** Normalize an array of card inputs: truncate fields, skip cards without term/meaning. */
function normalizeCards(cards: LabGeneratedCardInput[]) {
  const safeCards: LabGeneratedCardInput[] = []

  for (const card of cards.slice(0, LAB_IMPORT_MAX_CARD_COUNT)) {
    const term = normalizeText(card.term ?? "", 80)
    const meaning = normalizeText(card.meaning ?? "", 220)
    const example = normalizeOptionalText(card.example ?? null, 280)
    const exampleTranslation = normalizeOptionalText(card.exampleTranslation ?? null, 280)

    if (!term || !meaning) {
      continue
    }

    safeCards.push({
      term,
      meaning,
      partOfSpeech: normalizeOptionalText(card.partOfSpeech ?? null, 40),
      example,
      exampleTranslation,
    })
  }

  return safeCards
}

/** Fetch a deck row with a row-level lock (FOR UPDATE) within an existing transaction. */
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

/** Fetch a card row with a row-level lock (FOR UPDATE) within an existing transaction. */
async function getCardById(connection: PoolConnection, userId: string, cardId: number) {
  const [rows] = await connection.query<LabCardRow[]>(
    `
      SELECT
        id,
        deck_id,
        user_id,
        term_text,
        meaning_text,
        pos_text,
        example_text,
        example_translation_text,
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
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [cardId, userId]
  )

  return rows[0] ?? null
}

/** Recalculate card_count on a deck by counting its cards. Called after inserts/deletes. */
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

// --- Exported deck operations ---

/** List a user's decks, most recent first. Returns up to `limit` (clamped to 300). */
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

/** Create an empty deck with the given title and topic. Uses a transaction with encrypted text fields. */
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

/** Update a deck's title and/or topic. Returns null if the deck is not found or the new title is empty. */
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

/** Resolve a deck for a write operation: use existing deck if deckId > 0, otherwise create a new one. */
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

/** Add cards to a deck (existing or auto-created). Deduplicates by term+meaning. Returns added/skipped counts. */
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

    // Load existing card keys to build dedup set
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

    let addedCount = 0

    // Insert each card if its term+meaning is not already in the deck
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
            pos_text,
            example_text,
            example_translation_text,
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
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', 0, 0, ?, ?, 0, 0, NULL, NOW(), NULL)
        `,
        [
          deckId,
          input.userId,
          encryptDatabaseValue(card.term, "lab.card.term"),
          encryptDatabaseValue(card.meaning, "lab.card.meaning"),
          encryptDatabaseValueSafely(card.partOfSpeech ?? null, "lab.card.pos"),
          encryptDatabaseValueSafely(card.example ?? null, "lab.card.example"),
          encryptDatabaseValueSafely(card.exampleTranslation ?? null, "lab.card.example_translation"),
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

/** Get a deck and its cards. Returns null if the deck does not exist. */
export async function getLabDeckCardsForUser(input: {
  userId: string
  deckId: number
  limit?: number
}) {
  await ensureLabSchema()

  const safeLimit = Math.min(
    LAB_EXPORT_CARD_LIMIT,
    Math.max(1, Math.floor(input.limit ?? LAB_IMPORT_MAX_CARD_COUNT))
  )

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
          pos_text,
          example_text,
          example_translation_text,
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
      [input.userId, input.deckId, safeLimit]
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

/** Update a single card's fields. Checks for duplicates within the same deck (excluding the card itself). Returns status: "updated" | "invalid" | "not_found" | "duplicate". */
export async function updateLabCardForUser(input: {
  userId: string
  cardId: number
  term: string
  meaning: string
  partOfSpeech: string | null
  example: string | null
  exampleTranslation: string | null
}) {
  await ensureLabSchema()

  const term = normalizeText(input.term, 80)
  const meaning = normalizeText(input.meaning, 220)
  const partOfSpeech = normalizeOptionalText(input.partOfSpeech, 40)
  const example = normalizeOptionalText(input.example, 280)
  const exampleTranslation = normalizeOptionalText(input.exampleTranslation, 280)

  if (!term || !meaning) {
    return {
      status: "invalid" as const,
      deck: null,
      card: null,
    }
  }

  const connection = await getDbPool().getConnection()

  try {
    await connection.beginTransaction()

    const currentCard = await getCardById(connection, input.userId, input.cardId)
    if (!currentCard) {
      await connection.rollback()
      return {
        status: "not_found" as const,
        deck: null,
        card: null,
      }
    }

    const deckId = Number(currentCard.deck_id)
    const nextDedupKey = toDeckDedupKey(term, meaning)

    // Check that the new term+meaning doesn't conflict with another card in the deck
    const [existingRows] = await connection.query<LabCardKeyWithIdRow[]>(
      `
        SELECT
          id,
          term_text,
          meaning_text
        FROM lab_cards
        WHERE user_id = ?
          AND deck_id = ?
          AND id <> ?
      `,
      [input.userId, deckId, input.cardId]
    )

    for (const row of existingRows) {
      const rowTerm = decryptLabText(row.term_text, "lab.card.term", "") ?? ""
      const rowMeaning = decryptLabText(row.meaning_text, "lab.card.meaning", "") ?? ""
      if (!rowTerm || !rowMeaning) {
        continue
      }
      // If a matching dedup key is found, reject the update as a duplicate
      if (toDeckDedupKey(rowTerm, rowMeaning) === nextDedupKey) {
        await connection.rollback()
        return {
          status: "duplicate" as const,
          deck: null,
          card: null,
        }
      }
    }

    await connection.execute(
      `
        UPDATE lab_cards
        SET
          term_text = ?,
          meaning_text = ?,
          pos_text = ?,
          example_text = ?,
          example_translation_text = ?,
          updated_at = NOW()
        WHERE id = ?
          AND user_id = ?
      `,
      [
        encryptDatabaseValue(term, "lab.card.term"),
        encryptDatabaseValue(meaning, "lab.card.meaning"),
        encryptDatabaseValueSafely(partOfSpeech, "lab.card.pos"),
        encryptDatabaseValueSafely(example, "lab.card.example"),
        encryptDatabaseValueSafely(exampleTranslation, "lab.card.example_translation"),
        input.cardId,
        input.userId,
      ]
    )

    await refreshDeckCardCount(connection, input.userId, deckId)

    const updatedCard = await getCardById(connection, input.userId, input.cardId)
    const deckRow = await getDeckById(connection, input.userId, deckId)

    await connection.commit()

    if (!updatedCard || !deckRow) {
      return {
        status: "not_found" as const,
        deck: null,
        card: null,
      }
    }

    return {
      status: "updated" as const,
      deck: mapDeckRow(deckRow),
      card: mapCardRow(updatedCard),
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/** Delete a single card by id. Also refreshes the parent deck's card_count. */
export async function deleteLabCardForUser(input: {
  userId: string
  cardId: number
}) {
  await ensureLabSchema()

  const connection = await getDbPool().getConnection()

  try {
    await connection.beginTransaction()

    const currentCard = await getCardById(connection, input.userId, input.cardId)
    if (!currentCard) {
      await connection.rollback()
      return {
        status: "not_found" as const,
        deck: null,
      }
    }

    const deckId = Number(currentCard.deck_id)

    await connection.execute(
      `
        DELETE FROM lab_cards
        WHERE id = ?
          AND user_id = ?
      `,
      [input.cardId, input.userId]
    )

    await refreshDeckCardCount(connection, input.userId, deckId)
    const deckRow = await getDeckById(connection, input.userId, deckId)
    await connection.commit()

    return {
      status: "deleted" as const,
      deck: deckRow ? mapDeckRow(deckRow) : null,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/** Get a deck and all its cards for export. Returns null if the deck does not exist. */
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
          pos_text,
          example_text,
          example_translation_text,
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

/** Delete a deck and all its cards in a single transaction. Returns true on success. */
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
