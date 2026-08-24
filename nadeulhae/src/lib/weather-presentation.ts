/**
 * Pure weather presentation helpers.
 *
 * Extracted so location labeling, fallback flags, icon choice, rain detection,
 * and UV localization can be unit-tested without spinning up the weather API.
 */

import type { AppLanguage } from "@/lib/language"

export const AIR_QUALITY_FALLBACK_WARNING_KEY = "aq_fallback_warning"

/** Browser geolocation options shared by home and dashboard (avoid GPS timeouts). */
export const BROWSER_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 300_000,
}

export type WeatherScoreBand = "excellent" | "good" | "fair" | "poor"
export type WeatherIconKind = "rain" | "sun" | "cloud"

export type RegionLabelSource = {
  key: string
  displayName: string
  englishName: string
}

export type CurrentWeatherIconInput = {
  isRain?: boolean | null
  pty?: number | null
  forecastPty?: number | null
  rn1?: number | null
  forecastRn1?: number | null
  sky?: number | null
}

export type ForecastSkyInput = {
  sky?: string | null
  precipChance?: number | null
  precipAmount?: string | null
  knockout?: string | null
  pty?: number | null
}

const UV_KEY_BY_NORMALIZED: Record<string, string> = {
  낮음: "uv_low",
  보통: "uv_mod",
  높음: "uv_high",
  매우높음: "uv_v_high",
  위험: "uv_extreme",
  low: "uv_low",
  moderate: "uv_mod",
  high: "uv_high",
  veryhigh: "uv_v_high",
  extreme: "uv_extreme",
}

const UV_LABELS: Record<string, Record<AppLanguage, string>> = {
  uv_low: { ko: "낮음", en: "Low", zh: "低", ja: "低い" },
  uv_mod: { ko: "보통", en: "Moderate", zh: "中等", ja: "中程度" },
  uv_high: { ko: "높음", en: "High", zh: "高", ja: "高い" },
  uv_v_high: { ko: "매우높음", en: "Very High", zh: "非常高", ja: "非常に高い" },
  uv_extreme: { ko: "위험", en: "Extreme", zh: "极高", ja: "極端" },
}

export function scoreToBand(score: number): WeatherScoreBand {
  if (score >= 86) return "excellent"
  if (score >= 66) return "good"
  if (score >= 36) return "fair"
  return "poor"
}

/**
 * Keep the GPS/observed region even when air quality fell back to Jeonju defaults.
 * Only the AQ warning (and `isFallback`) should mention the Jeonju default.
 */
export function resolveObservedRegionPresentation(input: {
  isAirQualityFallback: boolean
  profile: RegionLabelSource
  homeRegion: RegionLabelSource
  scoreBand: WeatherScoreBand
}) {
  const isHomeRegion = input.profile.key === input.homeRegion.key
  const band = input.scoreBand

  return {
    isHomeRegion,
    locationLabel: input.profile.displayName,
    locationLabelEn: input.profile.englishName,
    regionKey: input.profile.key,
    messageKey: isHomeRegion ? `msg_home_${band}` : `msg_away_${band}`,
    airQualityFallbackWarningKey: input.isAirQualityFallback
      ? AIR_QUALITY_FALLBACK_WARNING_KEY
      : null,
  }
}

/** Mark mock/error payloads as fallback so the UI never treats them as live. */
export function markWeatherAsFallback<T extends { isFallback?: boolean }>(
  data: T,
): T & { isFallback: true } {
  return { ...data, isFallback: true }
}

export function isPrecipitatingNow(input: CurrentWeatherIconInput) {
  return Boolean(
    input.isRain
    || (input.pty ?? 0) > 0
    || (input.forecastPty ?? 0) > 0
    || (input.rn1 ?? 0) > 0
    || (input.forecastRn1 ?? 0) > 0,
  )
}

/** Dashboard icon: use PTY / isRain / SKY codes, never i18n status strings. */
export function classifyCurrentWeatherIcon(input: CurrentWeatherIconInput): WeatherIconKind {
  if (isPrecipitatingNow(input)) return "rain"
  const sky = input.sky ?? 3
  if (sky <= 1) return "sun"
  return "cloud"
}

function normalizeSkyText(sky?: string | null) {
  return (sky ?? "").replace(/\s+/g, "").toLowerCase()
}

export function isPrecipSkyLabel(sky?: string | null) {
  const normalized = normalizeSkyText(sky)
  if (!normalized) return false
  return /비|눈|소나기|rain|snow|shower|sleet|storm|雨|雪|雷/.test(normalized)
}

export function isClearSkyLabel(sky?: string | null) {
  if (isPrecipSkyLabel(sky)) return false
  const normalized = normalizeSkyText(sky)
  if (!normalized) return false
  return /맑음|clear|sunny|晴|快晴/.test(normalized)
}

function hasMeasuredPrecipAmount(amount?: string | null) {
  if (!amount) return false
  const normalized = amount.replace(/\s+/g, "")
  if (!normalized) return false
  if (/%$/.test(normalized)) return false
  if (/^(0+(?:\.0+)?(?:mm|cm)?|강수없음|적설없음|없음|none|-)$/i.test(normalized)) return false
  return /\d/.test(normalized)
}

/** Picnic / archive rain: precipChance + PTY-like sky tokens, not Hangul-only includes. */
export function isWetForecastDay(day: ForecastSkyInput) {
  if (day.knockout === "rain") return true
  if ((day.pty ?? 0) > 0) return true
  if ((day.precipChance ?? 0) >= 50) return true
  if (isPrecipSkyLabel(day.sky)) return true
  return hasMeasuredPrecipAmount(day.precipAmount)
}

export function classifyForecastWeatherIcon(day: ForecastSkyInput): WeatherIconKind {
  if (isWetForecastDay(day)) return "rain"
  if (isClearSkyLabel(day.sky)) return "sun"
  return "cloud"
}

export function localizeUvLabel(
  value: string | undefined,
  language: AppLanguage,
  translate?: (key: string) => string,
) {
  if (!value) return "--"

  const normalized = value.trim().replace(/\s+/g, "").toLowerCase()
  const key = UV_KEY_BY_NORMALIZED[normalized] ?? UV_KEY_BY_NORMALIZED[value.trim().replace(/\s+/g, "")]
  if (!key) return value
  if (translate) return translate(key)
  return UV_LABELS[key]?.[language] ?? value
}
