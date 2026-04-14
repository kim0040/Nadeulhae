export type LabLocale = "ko" | "en"
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
  tip: string | null
  learningState: LabLearningState
  stage: number
  stabilityDays: number
  difficulty: number
  retrievability: number | null
  totalReviews: number
  lapses: number
  nextReviewAt: string
  lastReviewedAt: string | null
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
  tip?: string | null
}
