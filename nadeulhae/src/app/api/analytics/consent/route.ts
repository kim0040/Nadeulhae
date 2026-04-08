import { NextRequest } from "next/server"

import {
  attachAnalyticsConsentCookie,
  normalizeAnalyticsConsentPreference,
} from "@/lib/analytics/consent"
import { recordDailyConsentDecisionSafely } from "@/lib/analytics/repository"
import { withApiAnalytics } from "@/lib/analytics/route"
import {
  createAuthJsonResponse,
  validateAuthMutationRequest,
} from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import { attachSessionCookie, getOrCreateSessionId } from "@/lib/request-session"

export const runtime = "nodejs"

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

async function handlePOST(request: NextRequest) {
  const requestViolation = validateAuthMutationRequest(request)
  if (requestViolation) {
    return requestViolation
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return createAuthJsonResponse(
      { error: "잘못된 분석 동의 요청입니다." },
      { status: 400 }
    )
  }

  const preference = normalizeAnalyticsConsentPreference(
    typeof payload === "object" && payload !== null && "preference" in payload
      ? (payload as { preference?: unknown }).preference
      : null
  )

  if (!preference) {
    return createAuthJsonResponse(
      { error: "유효한 분석 동의 설정이 필요합니다." },
      { status: 400 }
    )
  }

  const locale = normalizeLocale(
    typeof payload === "object" && payload !== null && "locale" in payload
      ? (payload as { locale?: unknown }).locale
      : null
  )
  const { sessionId, shouldSetCookie } = getOrCreateSessionId(request)
  const authenticatedSession = await getAuthenticatedSessionFromRequest(request)

  await recordDailyConsentDecisionSafely({
    request,
    preference,
    decisionSource: "banner",
    locale,
    sessionId,
  })

  const response = attachRefreshedAuthCookie(
    createAuthJsonResponse({
      success: true,
      preference,
    }),
    authenticatedSession
  )

  attachAnalyticsConsentCookie(response, preference)
  return attachSessionCookie(response, sessionId, shouldSetCookie)
}

export const POST = withApiAnalytics(handlePOST)
