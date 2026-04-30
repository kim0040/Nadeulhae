export type LabLocale = "ko" | "en" | "zh" | "ja"
export type LabLearningState = "new" | "learning" | "review" | "relearning"
export type LabReviewGrade = 1 | 2 | 3 | 4

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

export interface LabUsageSnapshot {
  metricDate: string
  generationCount: number
  remainingGenerations: number
  dailyGenerationLimit: number
  reviewCount: number
}

export interface LabStateSnapshot {
  dueCards: LabCardSnapshot[]
  recentDecks: LabDeckSnapshot[]
  usage: LabUsageSnapshot
}

export interface LabGeneratedCardInput {
  term: string
  meaning: string
  example?: string | null
  exampleTranslation?: string | null
  partOfSpeech?: string | null
}

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

export interface LabReportTrendPoint {
  metricDate: string
  generationCount: number
  reviewCount: number
}

export interface LabReportStateBreakdown {
  state: LabLearningState
  count: number
}

export interface LabReportDeckSummary {
  deckId: string
  title: string
  cardCount: number
  dueCount: number
  totalReviews: number
  avgDifficulty: number
  avgStabilityDays: number
}

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
