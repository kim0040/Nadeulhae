"use client"

import { useLanguage } from "@/context/LanguageContext"

/** Keeps the keyboard skip link in sync with client-side language changes. */
export function SkipToContentLink() {
  const { t } = useLanguage()

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-card focus:px-5 focus:py-2.5 focus:text-sm focus:font-bold focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-sky-blue/50"
    >
      {t("skip_to_content")}
    </a>
  )
}
