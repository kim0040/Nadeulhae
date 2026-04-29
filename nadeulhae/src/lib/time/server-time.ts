export type SupportedLocale = "ko" | "en" | "zh" | "ja" | string

export const SERVER_TIME_ZONE = "Asia/Seoul"

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

export function parseServerTimestamp(value: unknown): Date | null {
  if (value == null) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === "number") {
    const normalized = value > 1_000_000_000_000 ? value : value * 1000
    const parsed = new Date(normalized)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed === "--:--") {
    return null
  }

  const compactParsed = parseCompactDateString(trimmed)
  if (compactParsed && !Number.isNaN(compactParsed.getTime())) {
    return compactParsed
  }

  const hasExplicitTimeZone = /(?:z|[+-]\d{2}:\d{2})$/i.test(trimmed)
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T")
  const parsed = new Date(hasExplicitTimeZone ? normalized : `${normalized}+09:00`)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function getLocaleCode(language: SupportedLocale) {
  return language === "ko" ? "ko-KR" : "en-US"
}

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

export function computeServerClockOffsetMs(serverNow: unknown) {
  const parsed = parseServerTimestamp(serverNow)
  if (!parsed) {
    return null
  }

  return parsed.getTime() - Date.now()
}

export function getServerNowMs(offsetMs: number | null | undefined) {
  if (typeof offsetMs === "number" && Number.isFinite(offsetMs)) {
    return Date.now() + offsetMs
  }

  return Date.now()
}

export function formatServerRelativeTime(value: unknown, nowMs: number, language: SupportedLocale) {
  const parsed = parseServerTimestamp(value)
  if (!parsed) {
    return ""
  }

  const diff = Math.max(0, nowMs - parsed.getTime())

  if (diff < 60_000) {
    return language === "ko" ? "방금" : "Just now"
  }

  if (diff < 3_600_000) {
    const minutes = Math.floor(diff / 60_000)
    return language === "ko" ? `${minutes}분 전` : `${minutes}m ago`
  }

  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3_600_000)
    return language === "ko" ? `${hours}시간 전` : `${hours}h ago`
  }

  return parsed.toLocaleString(getLocaleCode(language), {
    timeZone: SERVER_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
