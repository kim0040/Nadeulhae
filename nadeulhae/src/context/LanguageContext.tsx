"use client"

/**
 * Language/i18n context for the Nadeulhae app.
 *
 * ## How translations work
 * All UI strings are stored in `src/data/locales/{ko,en,zh,ja}.ts` as flat
 * key-value objects. The `t()` function resolves a key against the currently
 * selected language, falling back to Korean, then to the raw key.
 *
 * ## Language detection priority
 * 1. Cookie / `localStorage` key `nadeulhae_language` (server reads the cookie
 *    so `html lang` matches before hydration)
 * 2. Browser `Accept-Language` / `navigator.language`
 * 3. Default: Korean (`"ko"`)
 *
 * ## Adding a new language
 * See `src/data/locales/index.ts` for the full step-by-step guide.
 *
 * ## State persistence
 * The selected language is synced to `localStorage`, a first-party cookie, and
 * `document.documentElement.lang` on every change.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { translations, type Language } from "@/data/locales"
import {
  buildLanguageCookie,
  LANGUAGE_STORAGE_KEY,
  parseLanguage,
  resolvePreferredLanguage,
} from "@/lib/language"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, seed?: string | number) => string
}


const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

function persistLanguage(language: Language) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    document.cookie = buildLanguageCookie(language)
  }

  if (typeof document !== "undefined") {
    document.documentElement.lang = language
  }
}

export function LanguageProvider({
  children,
  initialLanguage = "ko",
}: {
  children: React.ReactNode
  initialLanguage?: Language
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)

  useEffect(() => {
    const savedLanguage = typeof window !== "undefined"
      ? parseLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY))
      : null

    const resolved = resolvePreferredLanguage({
      stored: savedLanguage,
      acceptLanguage: typeof navigator !== "undefined" ? navigator.language : null,
      fallback: initialLanguage,
    })

    if (resolved !== language) {
      setLanguageState(resolved)
    }
    persistLanguage(resolved)
    // Mount-only reconciliation against cookie/localStorage/browser language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    persistLanguage(next)
  }, [])

  const getSeedValue = (seed?: string | number) => {
    if (typeof seed === "number") return seed
    if (typeof seed === "string") {
      return Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0)
    }
    return null
  }

  /**
   * Resolve a translation key for the current language.
   *
   * ## Resolution strategy
   * 1. Look up `key` in the current language's translation object
   * 2. If missing, fall back to Korean (`translations.ko`)
   * 3. If still missing, return the raw key string (visible bug signal in UI)
   *
   * ## Array values (randomised variants)
   * When the resolved value is a `string[]`, one element is selected using
   * a deterministic seed derived from the current hour + the key's char codes.
   * This gives natural variety to greeting/status messages without flickering.
   * An optional `seed` parameter overrides the time-based seed for reproducibility.
   *
   * @param key - Translation key matching the locale file key names
   * @param seed - Optional seed for deterministic array selection
   * @returns The resolved translation string, or the raw key if not found
   */
  const t = (key: string, seed?: string | number) => {
    const val = translations[language]?.[key] ?? translations.ko?.[key]
    if (Array.isArray(val)) {
      const hourSeed = new Date().getHours()
      const keySeed = Array.from(key).reduce((sum, char) => sum + char.charCodeAt(0), 0)
      const customSeed = getSeedValue(seed)
      const finalSeed = customSeed ?? hourSeed
      return val[(finalSeed + keySeed) % val.length]
    }
    return val || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
