/** Lab module type definitions — shared domain types for cards, decks, usage, and reports. */

/** Supported UI locales in the Lab. */
export type LabLocale = "ko" | "en" | "zh" | "ja"
/** SRS learning state machine: new → learning → review, or review → relearning → review. */
export type LabLearningState = "new" | "learning" | "review" | "relearning"
/** Review button grades: 1=Again, 2=Hard, 3=Good, 4=Easy. */
export type LabReviewGrade = 1 | 2 | 3 | 4

/** Read-only snapshot of a Lab deck returned to consumers. */
export interface LabDeckSnapshot {
  id: string
  locale: LabLocale
  title: string
  topic: string
  cardCount: number
  requestedModel: string | null
  resolvedModel: string | null
  createdAt: string
}

/** Read-only snapshot of a Lab card including SRS state and computed retrievability. */
export interface LabCardSnapshot {
  id: string
  deckId: string
  term: string
  meaning: string
  example: string | null
  learningState: LabLearningState
  stage: number
  stabilityDays: number
  difficulty: number
  retrievability: number | null
  totalReviews: number
  lapses: number
  nextReviewAt: string
  lastReviewedAt: string | null
  partOfSpeech: string | null
  exampleTranslation: string | null
  createdAt: string
}

/** Daily usage quota and counters for a user. */
export interface LabUsageSnapshot {
  metricDate: string
  generationCount: number
  remainingGenerations: number
  dailyGenerationLimit: number
  reviewCount: number
}

/** Full Lab state returned on the home screen: due cards, recent decks, and daily usage. */
export interface LabStateSnapshot {
  dueCards: LabCardSnapshot[]
  recentDecks: LabDeckSnapshot[]
  usage: LabUsageSnapshot
}

/** Raw card input from LLM generation or import — before normalization and encryption. */
export interface LabGeneratedCardInput {
  term: string
  meaning: string
  example?: string | null
  exampleTranslation?: string | null
  partOfSpeech?: string | null
}

/** Aggregate totals for the Lab report snapshot. */
export interface LabReportTotals {
  deckCount: number
  cardCount: number
  dueCount: number
  masteredCount: number
  generatedToday: number
  reviewedToday: number
  avgDifficulty: number
  avgStabilityDays: number
  avgRetrievability: number | null
  totalReviews: number
  totalLapses: number
}

/** One data point in a daily usage trend series. */
export interface LabReportTrendPoint {
  metricDate: string
  generationCount: number
  reviewCount: number
}

/** Count of cards in each learning state. */
export interface LabReportStateBreakdown {
  state: LabLearningState
  count: number
}

/** Per-deck summary used in the report's deck leaderboard. */
export interface LabReportDeckSummary {
  deckId: string
  title: string
  cardCount: number
  dueCount: number
  totalReviews: number
  avgDifficulty: number
  avgStabilityDays: number
}

/** Highest-difficulty cards for the user, surfaced in the report. */
export interface LabReportDifficultCard {
  cardId: string
  deckId: string
  deckTitle: string
  term: string
  difficulty: number
  lapses: number
  stage: number
  nextReviewAt: string
}

export interface LabReportInsights {
  /** Percentage of cards in "review" state out of all cards. */
  reviewRatePercent: number
  /** Percentage of cards that are mastered (stage >= 4) out of all cards. */
  masteryPercent: number
  /** Lapse rate: lapses / totalReviews. Lower is better. */
  lapseRatePercent: number
  /** Number of consecutive days with at least 1 review in this period. */
  activeStreakDays: number
  /** Average reviews per active day in this period. */
  avgReviewsPerActiveDay: number
  /** Estimated days until current due queue is cleared at current pace. */
  estimatedClearDays: number | null
}

/** Full Lab report returned from getLabReportSnapshot. */
export interface LabReportSnapshot {
  generatedAt: string
  periodDays: number
  totals: LabReportTotals
  insights: LabReportInsights
  trend: LabReportTrendPoint[]
  stateBreakdown: LabReportStateBreakdown[]
  deckSummaries: LabReportDeckSummary[]
  difficultCards: LabReportDifficultCard[]
}
