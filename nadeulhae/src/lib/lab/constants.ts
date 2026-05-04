/** Lab module constants — SRS parameters, limits, and grade definitions. */

// --- Daily usage limits ---
export const LAB_DAILY_GENERATION_LIMIT = 10

// --- Input & UI limits ---
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

// --- SRS stage intervals ---
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

// --- SRS bounds ---
export const LAB_SRS_MAX_STAGE = LAB_SRS_INTERVAL_MS.length - 1

export const LAB_MIN_STABILITY_DAYS = 0.15
export const LAB_MAX_STABILITY_DAYS = 240
export const LAB_DEFAULT_STABILITY_DAYS = 0.2

export const LAB_MIN_DIFFICULTY = 1
export const LAB_MAX_DIFFICULTY = 10
export const LAB_DEFAULT_DIFFICULTY = 5

// --- Learning & relearning step intervals (minutes) ---
// Initial learning queue: consecutive learning steps then graduate.
export const LAB_LEARNING_STEPS_MINUTES = [5, 10] as const
export const LAB_RELEARNING_STEPS_MINUTES = [5, 10] as const

// --- Review grade constants ---
export const LAB_REVIEW_GRADE_AGAIN = 1
export const LAB_REVIEW_GRADE_HARD = 2
export const LAB_REVIEW_GRADE_GOOD = 3
export const LAB_REVIEW_GRADE_EASY = 4

export const LAB_REVIEW_GRADE_MIN = LAB_REVIEW_GRADE_AGAIN
export const LAB_REVIEW_GRADE_MAX = LAB_REVIEW_GRADE_EASY
