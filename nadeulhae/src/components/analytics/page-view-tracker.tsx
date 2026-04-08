"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"

import { useLanguage } from "@/context/LanguageContext"

const ACQUISITION_STORAGE_KEY = "nadeulhae_acquisition_context"

function getViewportBucket(width: number) {
  if (width < 768) return "mobile"
  if (width < 1024) return "tablet"
  if (width < 1536) return "desktop"
  return "wide"
}

function readStoredAcquisitionContext() {
  try {
    const raw = window.sessionStorage.getItem(ACQUISITION_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as {
      referrerHost?: string
      utmSource?: string
      utmMedium?: string
      utmCampaign?: string
    }

    return {
      referrerHost: parsed.referrerHost ?? "direct",
      utmSource: parsed.utmSource ?? null,
      utmMedium: parsed.utmMedium ?? null,
      utmCampaign: parsed.utmCampaign ?? null,
    }
  } catch {
    return null
  }
}

function saveAcquisitionContext(context: {
  referrerHost: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
}) {
  try {
    window.sessionStorage.setItem(ACQUISITION_STORAGE_KEY, JSON.stringify(context))
  } catch {
    // Ignore storage failures and keep analytics best-effort only.
  }
}

function getCurrentReferrerHost() {
  if (!document.referrer) {
    return "direct"
  }

  try {
    const url = new URL(document.referrer)
    return url.host === window.location.host ? "internal" : url.host
  } catch {
    return "direct"
  }
}

function getAcquisitionContext(search: string) {
  const params = new URLSearchParams(search)
  const utmSource = params.get("utm_source")?.trim() || null
  const utmMedium = params.get("utm_medium")?.trim() || null
  const utmCampaign = params.get("utm_campaign")?.trim() || null
  const referrerHost = getCurrentReferrerHost()
  const hasCampaignData = Boolean(utmSource || utmMedium || utmCampaign)

  if (hasCampaignData || referrerHost !== "direct") {
    const context = {
      referrerHost,
      utmSource,
      utmMedium,
      utmCampaign,
    }
    saveAcquisitionContext(context)
    return context
  }

  return (
    readStoredAcquisitionContext()
    ?? {
      referrerHost: "direct",
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    }
  )
}

function getInitialPageLoadMs(isInitialView: boolean) {
  if (!isInitialView) {
    return 0
  }

  const navigationEntry = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined

  return navigationEntry ? Math.round(navigationEntry.duration) : 0
}

export function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const { resolvedTheme } = useTheme()
  const lastTrackedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || pathname.startsWith("/_next")) {
      return
    }

    const search = searchParams?.toString() ?? ""
    const trackingKey = search ? `${pathname}?${search}` : pathname
    if (lastTrackedKeyRef.current === trackingKey) {
      return
    }

    const isInitialView = lastTrackedKeyRef.current === null
    lastTrackedKeyRef.current = trackingKey
    const acquisition = getAcquisitionContext(search)

    const body = JSON.stringify({
      path: pathname,
      locale: language,
      theme: resolvedTheme,
      viewportBucket: getViewportBucket(window.innerWidth),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      referrerHost: acquisition.referrerHost,
      utmSource: acquisition.utmSource,
      utmMedium: acquisition.utmMedium,
      utmCampaign: acquisition.utmCampaign,
      pageLoadMs: getInitialPageLoadMs(isInitialView),
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
  }, [language, pathname, resolvedTheme, searchParams])

  return null
}
