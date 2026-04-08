"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

import { useLanguage } from "@/context/LanguageContext"

export function PageViewTracker() {
  const pathname = usePathname()
  const { language } = useLanguage()
  const lastTrackedPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || pathname.startsWith("/_next")) {
      return
    }

    if (lastTrackedPathRef.current === pathname) {
      return
    }

    lastTrackedPathRef.current = pathname

    const body = JSON.stringify({
      path: pathname,
      locale: language,
    })

    void fetch("/api/analytics/page-view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      credentials: "include",
      cache: "no-store",
      keepalive: true,
    }).catch((error) => {
      console.error("Failed to record page view:", error)
    })
  }, [language, pathname])

  return null
}
