/**
 * Shared language detection helpers for the client LanguageProvider.
 *
 * Keeping this module UI-free makes locale selection testable without rendering.
 */

export const SUPPORTED_LANGUAGES = ["ko", "en", "zh", "ja"] as const

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_STORAGE_KEY = "nadeulhae_language"

const LANGUAGE_SET = new Set<string>(SUPPORTED_LANGUAGES)

export function parseLanguage(value: unknown): AppLanguage | null {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase().split(/[-_]/)[0]
  return LANGUAGE_SET.has(normalized) ? (normalized as AppLanguage) : null
}

/** Map an Accept-Language header (or navigator.language) to a supported locale. */
export function detectLanguageFromAcceptLanguage(header: string | null | undefined): AppLanguage | null {
  if (!header) return null

  const candidates = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...parameters] = part.trim().split(";")
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="))
      const qualityValue = qualityParameter
        ? Number.parseFloat(qualityParameter.trim().slice(2))
        : 1

      return {
        language: parseLanguage(tag),
        quality: Number.isFinite(qualityValue) ? Math.max(0, Math.min(1, qualityValue)) : 0,
        index,
      }
    })
    .filter((candidate) => candidate.language && candidate.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)

  const preferred = candidates[0]?.language
  if (preferred) {
    return preferred
  }

  // Keep the existing English fallback when the browser sends no supported locale.
  return header.trim() ? "en" : null
}

export function resolvePreferredLanguage(input: {
  stored?: string | null
  acceptLanguage?: string | null
  fallback?: AppLanguage
}): AppLanguage {
  return (
    parseLanguage(input.stored)
    ?? detectLanguageFromAcceptLanguage(input.acceptLanguage)
    ?? input.fallback
    ?? "ko"
  )
}
