"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { translations, type Language } from "@/data/locales"

const LANGUAGE_STORAGE_KEY = "nadeulhae_language"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, seed?: string | number) => string
}


const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("ko")

  useEffect(() => {
    const savedLanguage = typeof window !== "undefined"
      ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
      : null

    if (savedLanguage === "ko" || savedLanguage === "en" || savedLanguage === "zh" || savedLanguage === "ja") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLanguage(savedLanguage)
      return
    }

    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ko'
    const targetLang: Language = (() => {
      if (browserLang === 'ko') return 'ko'
      if (browserLang === 'zh') return 'zh'
      if (browserLang === 'ja') return 'ja'
      return 'en'
    })()

    setLanguage(targetLang)
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    }

    if (typeof document !== "undefined") {
      document.documentElement.lang = language
    }
  }, [language])

  const getSeedValue = (seed?: string | number) => {
    if (typeof seed === "number") return seed
    if (typeof seed === "string") {
      return Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0)
    }
    return null
  }

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
