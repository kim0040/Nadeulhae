/**
 * @fileoverview Server time utilities with KST (Asia/Seoul) handling and
 * i18n-aware formatting.
 *
 * Parses timestamps from various server-side formats (Date, epoch ms/s,
 * compact `yyyyMMdd`, ISO-like strings), then formats them as clock time,
 * date-time, or relative ("3분 전") strings in Korean, English, Chinese,
 * or Japanese. Also exports `getServerNowMs` to compute an approximated
 * server clock via a known offset.
 *
 * @module server-time
 */

/**
 * Supported display languages for formatted date/time strings.
 * Accepts standard two-letter codes or a custom string (falls back to `en-US`).
 */
export type SupportedLocale = "ko" | "en" | "zh" | "ja" | string

/** IANA time zone identifier for the server (KST). */
export const SERVER_TIME_ZONE = "Asia/Seoul"

/**
 * Creates a Date from KST date parts by adjusting for the UTC-9 offset
 * (KST = UTC+9, so subtract 9 hours when constructing the UTC Date).
 */
function createDateFromKstParts(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
) {
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, second))
}

/**
 * Parses a compact date string (`yyyyMMdd` or `yyyyMMddHHmm` or `yyyyMMddHHmmss`).
 * Strips all non-digit characters first, then extracts date parts by position.
 */
function parseCompactDateString(input: string) {
  const compact = input.replace(/\D/g, "")
  if (!/^\d{8}(\d{4}(\d{2})?)?$/.test(compact)) {
    return null
  }

  const year = Number(compact.slice(0, 4))
  const month = Number(compact.slice(4, 6))
  const day = Number(compact.slice(6, 8))
  const hour = compact.length >= 10 ? Number(compact.slice(8, 10)) : 0
  const minute = compact.length >= 12 ? Number(compact.slice(10, 12)) : 0
  const second = compact.length >= 14 ? Number(compact.slice(12, 14)) : 0

  return createDateFromKstParts(year, month, day, hour, minute, second)
}

/**
 * Parses a server timestamp of unknown shape into a `Date` (or `null`).
 *
 * Accepts:
 * - `Date` instances (validated against `NaN`)
 * - Numbers (epoch ms > 1e12, or epoch seconds ≤ 1e12 auto-converted)
 * - Strings: compact `yyyyMMdd[HHmm[ss]]`, ISO-like (missing TZ → assumes KST),
 *   or special sentinels like `"--:--"` → `null`
 */
export function parseServerTimestamp(value: unknown): Date | null {
  if (value == null) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === "number") {
    // Values ≤ 1e12 are likely Unix epoch seconds; multiply to ms.
    const normalized = value > 1_000_000_000_000 ? value : value * 1000
    const parsed = new Date(normalized)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  // "--:--" is a sentinel from the weather API indicating unavailable time.
  if (!trimmed || trimmed === "--:--") {
    return null
  }

  const compactParsed = parseCompactDateString(trimmed)
  if (compactParsed && !Number.isNaN(compactParsed.getTime())) {
    return compactParsed
  }

  // If the string lacks an explicit timezone, assume KST (+09:00).
  const hasExplicitTimeZone = /(?:z|[+-]\d{2}:\d{2})$/i.test(trimmed)
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T")
  const parsed = new Date(hasExplicitTimeZone ? normalized : `${normalized}+09:00`)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

/** Maps a short language code to its full BCP 47 locale tag. */
function getLocaleCode(language: SupportedLocale) {
  const localeMap: Record<string, string> = { ko: "ko-KR", en: "en-US", zh: "zh-CN", ja: "ja-JP" }
  return localeMap[language] ?? "en-US"
}

/**
 * Formats a server timestamp as a short clock time (HH:MM) in KST.
 * Returns empty string for unparseable input.
 */
export function formatServerClockTime(value: unknown, language: SupportedLocale) {
  const parsed = parseServerTimestamp(value)
  if (!parsed) {
    return ""
  }

  return parsed.toLocaleTimeString(getLocaleCode(language), {
    timeZone: SERVER_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Formats a server timestamp as a full date-time string (e.g. "2025-05-04 14:30")
 * in KST. Returns `"-"` for unparseable input.
 */
export function formatServerDateTime(value: unknown, language: SupportedLocale) {
  const parsed = parseServerTimestamp(value)
  if (!parsed) {
    return "-"
  }

  return parsed.toLocaleString(getLocaleCode(language), {
    timeZone: SERVER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Computes the difference (in ms) between the server's clock and the local
 * clock. Returns `null` if the server timestamp cannot be parsed.
 * Positive means the server is ahead of local time.
 */
export function computeServerClockOffsetMs(serverNow: unknown) {
  const parsed = parseServerTimestamp(serverNow)
  if (!parsed) {
    return null
  }

  return parsed.getTime() - Date.now()
}

/**
 * Returns an approximate server timestamp (ms) by applying the pre-computed
 * clock offset to `Date.now()`. Falls back to local time when offset is
 * null/undefined/infinite.
 */
export function getServerNowMs(offsetMs: number | null | undefined) {
  if (typeof offsetMs === "number" && Number.isFinite(offsetMs)) {
    return Date.now() + offsetMs
  }

  return Date.now()
}

/**
 * Formats a timestamp as a human-readable relative time string
 * (e.g. "방금", "3분 전", "2h ago", "May 4 14:30") in the given language.
 *
 * Thresholds:
 * - < 1 min   → "Just now" (localised)
 * - < 1 hour  → "Xm ago" (localised)
 * - < 1 day   → "Xh ago" (localised)
 * - ≥ 1 day   → absolute date-time (no fallback to relative)
 */
export function formatServerRelativeTime(value: unknown, nowMs: number, language: SupportedLocale) {
  const parsed = parseServerTimestamp(value)
  if (!parsed) {
    return ""
  }

  // Clamp diff to 0 to avoid showing negative time for future timestamps.
  const diff = Math.max(0, nowMs - parsed.getTime())

  if (diff < 60_000) {
    return language === "ko" ? "방금" : language === "zh" ? "刚刚" : language === "ja" ? "たった今" : "Just now"
  }

  if (diff < 3_600_000) {
    const minutes = Math.floor(diff / 60_000)
    return language === "ko" ? `${minutes}분 전` : language === "zh" ? `${minutes}分钟前` : language === "ja" ? `${minutes}分前` : `${minutes}m ago`
  }

  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3_600_000)
    return language === "ko" ? `${hours}시간 전` : language === "zh" ? `${hours}小时前` : language === "ja" ? `${hours}時間前` : `${hours}h ago`
  }

  // Older than 1 day: fall back to localised absolute date-time in KST.
  return parsed.toLocaleString(getLocaleCode(language), {
    timeZone: SERVER_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
