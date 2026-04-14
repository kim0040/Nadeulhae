function toBoundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? "")
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

export const LAB_DAILY_GENERATION_LIMIT = 10

export const LAB_INPUT_MAX_CHARACTERS = 220
export const LAB_MIN_CARD_COUNT = 4
export const LAB_MAX_CARD_COUNT = 50
export const LAB_DEFAULT_CARD_COUNT = 10
export const LAB_DUE_CARD_FETCH_LIMIT = 50
export const LAB_RECENT_DECK_LIMIT = 6
export const LAB_IMPORT_MAX_CARD_COUNT = 400
export const LAB_IMPORT_MAX_BYTES = 512 * 1024
export const LAB_EXPORT_CARD_LIMIT = 5000

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// Legacy stage anchors used for stage rendering.
export const LAB_SRS_INTERVAL_MS = [
  4 * HOUR_MS,
  1 * DAY_MS,
  3 * DAY_MS,
  7 * DAY_MS,
  14 * DAY_MS,
  30 * DAY_MS,
  60 * DAY_MS,
  120 * DAY_MS,
] as const

export const LAB_SRS_MAX_STAGE = LAB_SRS_INTERVAL_MS.length - 1

export const LAB_MIN_STABILITY_DAYS = 0.15
export const LAB_MAX_STABILITY_DAYS = 240
export const LAB_DEFAULT_STABILITY_DAYS = 0.2

export const LAB_MIN_DIFFICULTY = 1
export const LAB_MAX_DIFFICULTY = 10
export const LAB_DEFAULT_DIFFICULTY = 5

// Initial learning queue: two successful recalls to graduate.
export const LAB_LEARNING_STEPS_MINUTES = [10, 1440] as const
export const LAB_RELEARNING_STEPS_MINUTES = [10, 720] as const

export const LAB_REVIEW_GRADE_AGAIN = 1
export const LAB_REVIEW_GRADE_HARD = 2
export const LAB_REVIEW_GRADE_GOOD = 3
export const LAB_REVIEW_GRADE_EASY = 4

export const LAB_REVIEW_GRADE_MIN = LAB_REVIEW_GRADE_AGAIN
export const LAB_REVIEW_GRADE_MAX = LAB_REVIEW_GRADE_EASY
