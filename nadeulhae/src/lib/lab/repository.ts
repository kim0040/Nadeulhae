import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise"

import {
  LAB_DAILY_GENERATION_LIMIT,
  LAB_DEFAULT_DIFFICULTY,
  LAB_DEFAULT_STABILITY_DAYS,
  LAB_DUE_CARD_FETCH_LIMIT,
  LAB_LEARNING_STEPS_MINUTES,
  LAB_MAX_DIFFICULTY,
  LAB_MAX_STABILITY_DAYS,
  LAB_MIN_DIFFICULTY,
  LAB_MIN_STABILITY_DAYS,
  LAB_RELEARNING_STEPS_MINUTES,
  LAB_REVIEW_GRADE_AGAIN,
  LAB_REVIEW_GRADE_EASY,
  LAB_REVIEW_GRADE_HARD,
  LAB_RECENT_DECK_LIMIT,
  LAB_SRS_INTERVAL_MS,
  LAB_SRS_MAX_STAGE,
} from "@/lib/lab/constants"
import { ensureLabSchema } from "@/lib/lab/schema"
import type {
  LabCardSnapshot,
  LabDeckSnapshot,
  LabGeneratedCardInput,
  LabLearningState,
  LabLocale,
  LabReviewGrade,
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
  learning_state: string
  consecutive_correct: number
  stage: number
  stability_days: number
  difficulty: number
  total_reviews: number
  lapses: number
  last_review_outcome: number | null
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

interface LabReviewTransitionInput {
  state: LabLearningState
  grade: LabReviewGrade
  currentStabilityDays: number
  currentDifficulty: number
  currentConsecutiveCorrect: number
  elapsedDays: number
  now: Date
}

interface LabReviewTransitionResult {
  nextState: LabLearningState
  nextStage: number
  nextStabilityDays: number
  nextDifficulty: number
  nextConsecutiveCorrect: number
  nextReviewAt: Date
  lapsesIncrement: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const REVIEW_TARGET_RETENTION = 0.9
const STAGE_ANCHOR_DAYS = LAB_SRS_INTERVAL_MS.map((value) => value / DAY_MS)

function toIsoString(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

function toDate(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
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

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(max, Math.max(min, value))
}

function clampStage(value: number) {
  return Math.max(0, Math.min(LAB_SRS_MAX_STAGE, Math.floor(value)))
}

function normalizeLearningState(value: unknown): LabLearningState {
  if (value === "learning" || value === "review" || value === "relearning") {
    return value
  }

  return "new"
}

function normalizeReviewGrade(value: number): LabReviewGrade {
  const normalized = Math.floor(value)
  if (normalized <= LAB_REVIEW_GRADE_AGAIN) {
    return LAB_REVIEW_GRADE_AGAIN
  }

  if (normalized >= LAB_REVIEW_GRADE_EASY) {
    return LAB_REVIEW_GRADE_EASY
  }

  return normalized as LabReviewGrade
}

function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + Math.max(1, minutes) * 60 * 1000)
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + Math.max(0.01, days) * DAY_MS)
}

function deriveStageFromStabilityDays(stabilityDays: number) {
  let stage = 0
  for (let i = STAGE_ANCHOR_DAYS.length - 1; i >= 0; i -= 1) {
    if (stabilityDays >= STAGE_ANCHOR_DAYS[i]) {
      stage = i
      break
    }
  }
  return clampStage(stage)
}

function calculateRetrievability(stabilityDays: number, elapsedDays: number) {
  const safeStability = clampNumber(stabilityDays, LAB_MIN_STABILITY_DAYS, LAB_MAX_STABILITY_DAYS)
  const safeElapsed = Math.max(0, elapsedDays)
  const value = Math.exp(Math.log(REVIEW_TARGET_RETENTION) * (safeElapsed / safeStability))
  return clampNumber(value, 0, 1)
}

function adjustDifficulty(currentDifficulty: number, delta: number) {
  const reversion = (LAB_DEFAULT_DIFFICULTY - currentDifficulty) * 0.03
  return clampNumber(
    currentDifficulty + delta + reversion,
    LAB_MIN_DIFFICULTY,
    LAB_MAX_DIFFICULTY
  )
}

function computeLearningTransition(input: LabReviewTransitionInput): LabReviewTransitionResult {
  const now = input.now
  const isRelearning = input.state === "relearning"
  const steps = isRelearning
    ? LAB_RELEARNING_STEPS_MINUTES
    : LAB_LEARNING_STEPS_MINUTES

  if (input.grade === LAB_REVIEW_GRADE_AGAIN) {
    return {
      nextState: input.state === "new" ? "learning" : input.state,
      nextStage: 0,
      nextStabilityDays: clampNumber(input.currentStabilityDays * 0.95, LAB_MIN_STABILITY_DAYS, LAB_MAX_STABILITY_DAYS),
      nextDifficulty: adjustDifficulty(input.currentDifficulty, 0.25),
      nextConsecutiveCorrect: 0,
      nextReviewAt: addMinutes(now, steps[0]),
      lapsesIncrement: 0,
    }
  }

  if (input.grade === LAB_REVIEW_GRADE_HARD) {
    return {
      nextState: input.state === "new" ? "learning" : input.state,
      nextStage: 0,
      nextStabilityDays: clampNumber(input.currentStabilityDays * 1.02, LAB_MIN_STABILITY_DAYS, LAB_MAX_STABILITY_DAYS),
      nextDifficulty: adjustDifficulty(input.currentDifficulty, 0.08),
      nextConsecutiveCorrect: 0,
      nextReviewAt: addMinutes(now, Math.max(15, Math.floor(steps[0] * 2))),
      lapsesIncrement: 0,
    }
  }

  const nextConsecutive = Math.max(0, input.currentConsecutiveCorrect) + 1
  if (nextConsecutive >= 2) {
    const nextStabilityDays = clampNumber(
      Math.max(input.currentStabilityDays, input.grade === LAB_REVIEW_GRADE_EASY ? 3 : 2),
      LAB_MIN_STABILITY_DAYS,
      LAB_MAX_STABILITY_DAYS
    )

    return {
      nextState: "review",
      nextStage: deriveStageFromStabilityDays(nextStabilityDays),
      nextStabilityDays,
      nextDifficulty: adjustDifficulty(input.currentDifficulty, input.grade === LAB_REVIEW_GRADE_EASY ? -0.3 : -0.18),
      nextConsecutiveCorrect: 0,
      nextReviewAt: addDays(now, input.grade === LAB_REVIEW_GRADE_EASY ? nextStabilityDays * 1.1 : nextStabilityDays),
      lapsesIncrement: 0,
    }
  }

  const stepIndex = Math.min(nextConsecutive - 1, steps.length - 1)
  const stepMinutes = input.grade === LAB_REVIEW_GRADE_EASY
    ? Math.max(5, Math.floor(steps[stepIndex] * 0.7))
    : steps[stepIndex]

  return {
    nextState: input.state === "new" ? "learning" : input.state,
    nextStage: Math.min(1, nextConsecutive),
    nextStabilityDays: clampNumber(input.currentStabilityDays * 1.03, LAB_MIN_STABILITY_DAYS, LAB_MAX_STABILITY_DAYS),
    nextDifficulty: adjustDifficulty(input.currentDifficulty, input.grade === LAB_REVIEW_GRADE_EASY ? -0.2 : -0.1),
    nextConsecutiveCorrect: nextConsecutive,
    nextReviewAt: addMinutes(now, stepMinutes),
    lapsesIncrement: 0,
  }
}

function computeReviewTransition(input: LabReviewTransitionInput): LabReviewTransitionResult {
  const now = input.now
  const retrievability = calculateRetrievability(input.currentStabilityDays, input.elapsedDays)

  if (input.grade === LAB_REVIEW_GRADE_AGAIN) {
    return {
      nextState: "relearning",
      nextStage: 0,
      nextStabilityDays: clampNumber(
        input.currentStabilityDays * 0.45,
        LAB_MIN_STABILITY_DAYS,
        LAB_MAX_STABILITY_DAYS
      ),
      nextDifficulty: adjustDifficulty(input.currentDifficulty, 0.85),
      nextConsecutiveCorrect: 0,
      nextReviewAt: addMinutes(now, LAB_RELEARNING_STEPS_MINUTES[0]),
      lapsesIncrement: 1,
    }
  }

  const difficultyWeight = (11 - input.currentDifficulty) / 10
  const recallPenalty = 1 - retrievability

  if (input.grade === LAB_REVIEW_GRADE_HARD) {
    const growth = 1 + 0.28 * difficultyWeight * (0.65 + 0.45 * recallPenalty)
    const nextStabilityDays = clampNumber(
      input.currentStabilityDays * growth,
      LAB_MIN_STABILITY_DAYS,
      LAB_MAX_STABILITY_DAYS
    )

    return {
      nextState: "review",
      nextStage: deriveStageFromStabilityDays(nextStabilityDays),
      nextStabilityDays,
      nextDifficulty: adjustDifficulty(input.currentDifficulty, 0.18),
      nextConsecutiveCorrect: 0,
      nextReviewAt: addDays(now, Math.max(0.7, nextStabilityDays * 0.65)),
      lapsesIncrement: 0,
    }
  }

  if (input.grade === LAB_REVIEW_GRADE_EASY) {
    const growth = 1 + 0.65 * difficultyWeight * (0.95 + 0.8 * recallPenalty)
    const nextStabilityDays = clampNumber(
      input.currentStabilityDays * growth,
      LAB_MIN_STABILITY_DAYS,
      LAB_MAX_STABILITY_DAYS
    )

    return {
      nextState: "review",
      nextStage: deriveStageFromStabilityDays(nextStabilityDays),
      nextStabilityDays,
      nextDifficulty: adjustDifficulty(input.currentDifficulty, -0.28),
      nextConsecutiveCorrect: 0,
      nextReviewAt: addDays(now, Math.min(LAB_MAX_STABILITY_DAYS, nextStabilityDays * 1.25)),
      lapsesIncrement: 0,
    }
  }

  const growth = 1 + 0.45 * difficultyWeight * (0.8 + 0.7 * recallPenalty)
  const nextStabilityDays = clampNumber(
    input.currentStabilityDays * growth,
    LAB_MIN_STABILITY_DAYS,
    LAB_MAX_STABILITY_DAYS
  )

  return {
    nextState: "review",
    nextStage: deriveStageFromStabilityDays(nextStabilityDays),
    nextStabilityDays,
    nextDifficulty: adjustDifficulty(input.currentDifficulty, -0.12),
    nextConsecutiveCorrect: 0,
    nextReviewAt: addDays(now, nextStabilityDays),
    lapsesIncrement: 0,
  }
}

function computeTransition(input: LabReviewTransitionInput) {
  const normalizedState = input.state === "new" || input.state === "learning" || input.state === "relearning"
    ? input.state
    : "review"

  if (normalizedState === "review") {
    return computeReviewTransition(input)
  }

  return computeLearningTransition(input)
}

function mapCardRow(row: LabCardRow, referenceDate: Date = new Date()): LabCardSnapshot {
  const learningState = normalizeLearningState(row.learning_state)
  const stabilityDays = clampNumber(Number(row.stability_days ?? LAB_DEFAULT_STABILITY_DAYS), LAB_MIN_STABILITY_DAYS, LAB_MAX_STABILITY_DAYS)
  const difficulty = clampNumber(Number(row.difficulty ?? LAB_DEFAULT_DIFFICULTY), LAB_MIN_DIFFICULTY, LAB_MAX_DIFFICULTY)
  const createdAt = toDate(row.created_at) ?? referenceDate
  const lastReviewedAt = toDate(row.last_reviewed_at)
  const elapsedBase = lastReviewedAt ?? createdAt
  const elapsedDays = Math.max(0, (referenceDate.getTime() - elapsedBase.getTime()) / DAY_MS)

  return {
    id: String(row.id),
    deckId: String(row.deck_id),
    term: decryptLabText(row.term_text, "lab.card.term", "-") ?? "-",
    meaning: decryptLabText(row.meaning_text, "lab.card.meaning", "-") ?? "-",
    example: decryptLabText(row.example_text, "lab.card.example"),
    tip: decryptLabText(row.tip_text, "lab.card.tip"),
    learningState,
    stage: learningState === "review"
      ? deriveStageFromStabilityDays(stabilityDays)
      : clampStage(Number(row.stage ?? 0)),
    stabilityDays,
    difficulty,
    retrievability: learningState === "review"
      ? calculateRetrievability(stabilityDays, elapsedDays)
      : null,
    totalReviews: Math.max(0, Number(row.total_reviews ?? 0)),
    lapses: Math.max(0, Number(row.lapses ?? 0)),
    nextReviewAt: toIsoString(row.next_review_at),
    lastReviewedAt: row.last_reviewed_at ? toIsoString(row.last_reviewed_at) : null,
    createdAt: toIsoString(createdAt),
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
          encryptDatabaseValueSafely(card.example, "lab.card.example"),
          encryptDatabaseValueSafely(card.tip, "lab.card.tip"),
          LAB_DEFAULT_STABILITY_DAYS,
          LAB_DEFAULT_DIFFICULTY,
        ]
      )

      snapshots.push({
        id: String(cardInsert.insertId),
        deckId: String(deckId),
        term: card.term,
        meaning: card.meaning,
        example: card.example,
        tip: card.tip,
        learningState: "new",
        stage: 0,
        stabilityDays: LAB_DEFAULT_STABILITY_DAYS,
        difficulty: LAB_DEFAULT_DIFFICULTY,
        retrievability: null,
        totalReviews: 0,
        lapses: 0,
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
  const now = new Date()
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
          learning_state,
          consecutive_correct,
          stage,
          stability_days,
          difficulty,
          total_reviews,
          lapses,
          last_review_outcome,
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
    dueCards: dueRows.map((row) => mapCardRow(row, now)),
    recentDecks: recentDeckRows.map(mapDeckRow),
  }
}

export async function applyLabCardReview(input: {
  userId: string
  cardId: number
  grade: number
}) {
  await ensureLabSchema()

  const grade = normalizeReviewGrade(input.grade)
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
          learning_state,
          consecutive_correct,
          stage,
          stability_days,
          difficulty,
          total_reviews,
          lapses,
          last_review_outcome,
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

    const now = new Date()
    const learningState = normalizeLearningState(current.learning_state)
    const currentStabilityDays = clampNumber(
      Number(current.stability_days ?? LAB_DEFAULT_STABILITY_DAYS),
      LAB_MIN_STABILITY_DAYS,
      LAB_MAX_STABILITY_DAYS
    )
    const currentDifficulty = clampNumber(
      Number(current.difficulty ?? LAB_DEFAULT_DIFFICULTY),
      LAB_MIN_DIFFICULTY,
      LAB_MAX_DIFFICULTY
    )
    const currentConsecutiveCorrect = Math.max(0, Number(current.consecutive_correct ?? 0))
    const currentTotalReviews = Math.max(0, Number(current.total_reviews ?? 0))
    const currentLapses = Math.max(0, Number(current.lapses ?? 0))

    const anchorDate = toDate(current.last_reviewed_at)
      ?? toDate(current.created_at)
      ?? now
    const elapsedDays = Math.max(0, (now.getTime() - anchorDate.getTime()) / DAY_MS)

    const transition = computeTransition({
      state: learningState,
      grade,
      currentStabilityDays,
      currentDifficulty,
      currentConsecutiveCorrect,
      elapsedDays,
      now,
    })

    const nextTotalReviews = currentTotalReviews + 1
    const nextLapses = currentLapses + transition.lapsesIncrement

    await connection.execute(
      `
        UPDATE lab_cards
        SET
          learning_state = ?,
          consecutive_correct = ?,
          stage = ?,
          stability_days = ?,
          difficulty = ?,
          total_reviews = ?,
          lapses = ?,
          last_review_outcome = ?,
          next_review_at = ?,
          last_reviewed_at = ?,
          updated_at = NOW()
        WHERE id = ?
          AND user_id = ?
      `,
      [
        transition.nextState,
        transition.nextConsecutiveCorrect,
        transition.nextStage,
        transition.nextStabilityDays,
        transition.nextDifficulty,
        nextTotalReviews,
        nextLapses,
        grade,
        transition.nextReviewAt,
        now,
        input.cardId,
        input.userId,
      ]
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
        learningState: transition.nextState,
        stage: transition.nextStage,
        stabilityDays: transition.nextStabilityDays,
        difficulty: transition.nextDifficulty,
        retrievability: transition.nextState === "review" ? 1 : null,
        totalReviews: nextTotalReviews,
        lapses: nextLapses,
        nextReviewAt: transition.nextReviewAt.toISOString(),
        lastReviewedAt: now.toISOString(),
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
export async function applyLabCardReviewBatch(input: {
  userId: string
  reviews: { cardId: number; grade: number }[]
}) {
  if (!input.reviews || input.reviews.length === 0) {
    return { usage: null, results: [] }
  }

  await ensureLabSchema()
  const connection = await getDbPool().getConnection()
  const now = new Date()

  try {
    await connection.beginTransaction()

    const cardIds = input.reviews.map(r => r.cardId)
    const placeholders = cardIds.map(() => "?").join(",")
    
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
          learning_state,
          consecutive_correct,
          stage,
          stability_days,
          difficulty,
          total_reviews,
          lapses,
          last_review_outcome,
          next_review_at,
          last_reviewed_at,
          created_at
        FROM lab_cards
        WHERE user_id = ?
          AND id IN (${placeholders})
        FOR UPDATE
      `,
      [input.userId, ...cardIds]
    )

    const rowMap = new Map(rows.map(r => [Number(r.id), r]))
    const updatePromises: Promise<any>[] = []
    const results: LabCardSnapshot[] = []
    let actualReviewCount = 0

    for (const review of input.reviews) {
      const current = rowMap.get(review.cardId)
      if (!current) continue

      const grade = normalizeReviewGrade(review.grade)
      const learningState = normalizeLearningState(current.learning_state)
      const currentStabilityDays = clampNumber(
        Number(current.stability_days ?? LAB_DEFAULT_STABILITY_DAYS),
        LAB_MIN_STABILITY_DAYS,
        LAB_MAX_STABILITY_DAYS
      )
      const currentDifficulty = clampNumber(
        Number(current.difficulty ?? LAB_DEFAULT_DIFFICULTY),
        LAB_MIN_DIFFICULTY,
        LAB_MAX_DIFFICULTY
      )
      const currentConsecutiveCorrect = Math.max(0, Number(current.consecutive_correct ?? 0))
      const currentTotalReviews = Math.max(0, Number(current.total_reviews ?? 0))
      const currentLapses = Math.max(0, Number(current.lapses ?? 0))

      const anchorDate = toDate(current.last_reviewed_at)
        ?? toDate(current.created_at)
        ?? now
      const elapsedDays = Math.max(0, (now.getTime() - anchorDate.getTime()) / DAY_MS)

      const transition = computeTransition({
        state: learningState,
        grade,
        currentStabilityDays,
        currentDifficulty,
        currentConsecutiveCorrect,
        elapsedDays,
        now,
      })

      const nextTotalReviews = currentTotalReviews + 1
      const nextLapses = currentLapses + transition.lapsesIncrement
      actualReviewCount++

      updatePromises.push(
        connection.execute(
          `
            UPDATE lab_cards
            SET
              learning_state = ?,
              consecutive_correct = ?,
              stage = ?,
              stability_days = ?,
              difficulty = ?,
              total_reviews = ?,
              lapses = ?,
              last_review_outcome = ?,
              next_review_at = ?,
              last_reviewed_at = ?
            WHERE id = ?
              AND user_id = ?
          `,
          [
            transition.nextState,
            transition.nextConsecutiveCorrect,
            transition.nextStage,
            transition.nextStabilityDays,
            transition.nextDifficulty,
            nextTotalReviews,
            nextLapses,
            grade,
            transition.nextReviewAt,
            now,
            review.cardId,
            input.userId,
          ]
        )
      )

      results.push({
        id: String(current.id),
        deckId: String(current.deck_id),
        term: decryptLabText(current.term_text, "lab.card.term", "-") ?? "-",
        meaning: decryptLabText(current.meaning_text, "lab.card.meaning", "-") ?? "-",
        example: decryptLabText(current.example_text, "lab.card.example"),
        tip: decryptLabText(current.tip_text, "lab.card.tip"),
        learningState: transition.nextState,
        stage: transition.nextStage,
        stabilityDays: transition.nextStabilityDays,
        difficulty: transition.nextDifficulty,
        retrievability: transition.nextState === "review" ? 1 : null,
        totalReviews: nextTotalReviews,
        lapses: nextLapses,
        nextReviewAt: transition.nextReviewAt.toISOString(),
        lastReviewedAt: now.toISOString(),
        createdAt: toIsoString(current.created_at),
      })
    }

    if (updatePromises.length > 0) {
       await Promise.all(updatePromises)
    }

    const metricDate = getKstMetricDate()
    
    // Create row if missing
    await connection.execute(
      `
        INSERT IGNORE INTO lab_daily_usage (user_id, metric_date, generation_count, review_count)
        VALUES (?, ?, 0, 0)
      `,
      [input.userId, metricDate]
    )

    if (actualReviewCount > 0) {
      await connection.execute(
        `
          UPDATE lab_daily_usage
          SET
            review_count = review_count + ?,
            updated_at = NOW()
          WHERE metric_date = ?
            AND user_id = ?
        `,
        [actualReviewCount, metricDate, input.userId]
      )
    }

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

    return { results, usage }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
