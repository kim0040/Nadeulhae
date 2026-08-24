/**
 * Shared language detection helpers used by both the server layout (cookie /
 * Accept-Language) and the client LanguageProvider (localStorage).
 *
 * Keeping this module UI-free lets the first HTML `lang` attribute match the
 * resolved locale and avoids a Korean flash for EN/ZH/JA users.
 */

export const SUPPORTED_LANGUAGES = ["ko", "en", "zh", "ja"] as const

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_COOKIE_NAME = "nadeulhae_language"
export const LANGUAGE_STORAGE_KEY = "nadeulhae_language"
export const LANGUAGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

const LANGUAGE_SET = new Set<string>(SUPPORTED_LANGUAGES)

export function parseLanguage(value: unknown): AppLanguage | null {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase().split(/[-_]/)[0]
  return LANGUAGE_SET.has(normalized) ? (normalized as AppLanguage) : null
}

/** Map an Accept-Language header (or navigator.language) to a supported locale. */
export function detectLanguageFromAcceptLanguage(header: string | null | undefined): AppLanguage | null {
  if (!header) return null

  for (const part of header.split(",")) {
    const tag = part.trim().split(";")[0]
    const parsed = parseLanguage(tag)
    if (parsed) return parsed
    // Unknown tags such as `fr-FR` follow the existing client rule: English.
    if (tag) return "en"
  }

  return null
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

export function buildLanguageCookie(language: AppLanguage) {
  return `${LANGUAGE_COOKIE_NAME}=${language}; Path=/; Max-Age=${LANGUAGE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`
}

export const SKIP_TO_CONTENT_COPY: Record<AppLanguage, string> = {
  ko: "본문으로 건너뛰기",
  en: "Skip to main content",
  zh: "跳到主要内容",
  ja: "本文へスキップ",
}
