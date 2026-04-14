function toBoundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? "")
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

export const LAB_DAILY_GENERATION_LIMIT = toBoundedInteger(
  process.env.LAB_DAILY_GENERATION_LIMIT,
  6,
  1,
  30
)

export const LAB_INPUT_MAX_CHARACTERS = 220
export const LAB_MIN_CARD_COUNT = 4
export const LAB_MAX_CARD_COUNT = 10
export const LAB_DEFAULT_CARD_COUNT = 8
export const LAB_DUE_CARD_FETCH_LIMIT = 20
export const LAB_RECENT_DECK_LIMIT = 6

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// vocamaster SRS intervals: 4h, 1d, 3d, 7d, 14d, 30d, 60d, 120d
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
