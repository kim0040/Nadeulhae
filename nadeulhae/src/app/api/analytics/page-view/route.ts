import { NextRequest } from "next/server"

import { recordDailyUsageEventSafely } from "@/lib/analytics/repository"
import {
  createAuthJsonResponse,
  validateSameOriginRequest,
} from "@/lib/auth/request-security"
import { attachSessionCookie, getOrCreateSessionId } from "@/lib/request-session"

export const runtime = "nodejs"

const PAGE_VIEW_RATE_LIMIT_WINDOW_MS = 10_000
const pageViewRateLimitMap = new Map<string, number>()
const PAGE_VIEW_RATE_LIMIT_MAX_KEYS = 4_000

function isPageViewRateLimited(sessionId: string): boolean {
  const now = Date.now()
  const lastSent = pageViewRateLimitMap.get(sessionId)
  if (lastSent && now - lastSent < PAGE_VIEW_RATE_LIMIT_WINDOW_MS) {
    return true
  }
  pageViewRateLimitMap.set(sessionId, now)
  if (pageViewRateLimitMap.size > PAGE_VIEW_RATE_LIMIT_MAX_KEYS) {
    const overflow = pageViewRateLimitMap.size - PAGE_VIEW_RATE_LIMIT_MAX_KEYS
    let removed = 0
    for (const key of pageViewRateLimitMap.keys()) {
      pageViewRateLimitMap.delete(key)
      removed++
      if (removed >= overflow) break
    }
  }
  return false
}

function normalizePath(value: unknown) {
  const path = typeof value === "string" ? value.trim() : ""
  if (!path.startsWith("/")) {
    return null
  }

  return path.slice(0, 191)
}

function normalizeLocale(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith("ko")) {
    return "ko"
  }

  if (trimmed.startsWith("en")) {
    return "en"
  }

  return trimmed.slice(0, 8)
}

function normalizeTheme(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  if (!trimmed) {
    return null
  }

  if (trimmed === "light" || trimmed === "dark" || trimmed === "system") {
    return trimmed
  }

  return null
}

function normalizeViewportBucket(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  if (!trimmed) {
    return null
  }

  if (["mobile", "tablet", "desktop", "wide"].includes(trimmed)) {
    return trimmed
  }

  return null
}

function normalizeTimeZone(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 48) : null
}

function normalizeHost(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  return trimmed ? trimmed.slice(0, 191) : null
}

function normalizeCampaignValue(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : null
}

function normalizeDuration(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    return 0
  }

  return Math.max(0, Math.min(120_000, Math.round(numeric)))
}

export async function POST(request: NextRequest) {
  const requestViolation = validateSameOriginRequest(request)
  if (requestViolation) {
    return requestViolation
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return createAuthJsonResponse(
      { error: "잘못된 분석 요청입니다." },
      { status: 400 }
    )
  }

  const path = normalizePath(
    typeof payload === "object" && payload !== null && "path" in payload
      ? (payload as { path?: unknown }).path
      : null
  )

  if (!path) {
    return createAuthJsonResponse(
      { error: "수집할 페이지 경로가 필요합니다." },
      { status: 400 }
    )
  }

  const locale = normalizeLocale(
    typeof payload === "object" && payload !== null && "locale" in payload
      ? (payload as { locale?: unknown }).locale
      : null
  )
  const theme = normalizeTheme(
    typeof payload === "object" && payload !== null && "theme" in payload
      ? (payload as { theme?: unknown }).theme
      : null
  )
  const viewportBucket = normalizeViewportBucket(
    typeof payload === "object" && payload !== null && "viewportBucket" in payload
      ? (payload as { viewportBucket?: unknown }).viewportBucket
      : null
  )
  const timeZone = normalizeTimeZone(
    typeof payload === "object" && payload !== null && "timeZone" in payload
      ? (payload as { timeZone?: unknown }).timeZone
      : null
  )
  const referrerHost = normalizeHost(
    typeof payload === "object" && payload !== null && "referrerHost" in payload
      ? (payload as { referrerHost?: unknown }).referrerHost
      : null
  )
  const utmSource = normalizeCampaignValue(
    typeof payload === "object" && payload !== null && "utmSource" in payload
      ? (payload as { utmSource?: unknown }).utmSource
      : null,
    80
  )
  const utmMedium = normalizeCampaignValue(
    typeof payload === "object" && payload !== null && "utmMedium" in payload
      ? (payload as { utmMedium?: unknown }).utmMedium
      : null,
    80
  )
  const utmCampaign = normalizeCampaignValue(
    typeof payload === "object" && payload !== null && "utmCampaign" in payload
      ? (payload as { utmCampaign?: unknown }).utmCampaign
      : null,
    120
  )
  const pageLoadMs = normalizeDuration(
    typeof payload === "object" && payload !== null && "pageLoadMs" in payload
      ? (payload as { pageLoadMs?: unknown }).pageLoadMs
      : 0
  )
  const { sessionId, shouldSetCookie } = getOrCreateSessionId(request)

  if (isPageViewRateLimited(sessionId)) {
    return attachSessionCookie(
      createAuthJsonResponse({ success: true, throttled: true }),
      sessionId,
      shouldSetCookie
    )
  }

  await recordDailyUsageEventSafely({
    request,
    routeKind: "page",
    routePath: path,
    method: "VIEW",
    statusCode: 200,
    durationMs: pageLoadMs,
    locale,
    sessionId,
    theme,
    viewportBucket,
    timeZone,
    referrerHost,
    utmSource,
    utmMedium,
    utmCampaign,
  })

  return attachSessionCookie(
    createAuthJsonResponse({ success: true }),
    sessionId,
    shouldSetCookie
  )
}
