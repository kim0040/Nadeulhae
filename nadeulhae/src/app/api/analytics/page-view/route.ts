import { NextRequest } from "next/server"

import { recordDailyUsageEventSafely } from "@/lib/analytics/repository"
import {
  createAuthJsonResponse,
  validateSameOriginRequest,
} from "@/lib/auth/request-security"
import { attachSessionCookie, getOrCreateSessionId } from "@/lib/request-session"

export const runtime = "nodejs"

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
  const { sessionId, shouldSetCookie } = getOrCreateSessionId(request)

  await recordDailyUsageEventSafely({
    request,
    routeKind: "page",
    routePath: path,
    method: "VIEW",
    statusCode: 200,
    durationMs: 0,
    locale,
    sessionId,
  })

  return attachSessionCookie(
    createAuthJsonResponse({ success: true }),
    sessionId,
    shouldSetCookie
  )
}
