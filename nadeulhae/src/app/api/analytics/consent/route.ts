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

const CONSENT_ERRORS = {
  ko: {
    invalidRequest: "잘못된 분석 동의 요청입니다.",
    invalidPreference: "유효한 분석 동의 설정이 필요합니다.",
  },
  en: {
    invalidRequest: "Invalid analytics consent request.",
    invalidPreference: "A valid analytics consent preference is required.",
  },
} as const

type ConsentLocale = keyof typeof CONSENT_ERRORS

function normalizeLocale(value: unknown): ConsentLocale | null {
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

  return null
}

function resolveConsentLocale(request: NextRequest, payloadLocale?: unknown): ConsentLocale {
  const fromPayload = normalizeLocale(payloadLocale)
  if (fromPayload) {
    return fromPayload
  }

  const fromHeader = normalizeLocale(request.headers.get("accept-language"))
  return fromHeader ?? "ko"
}

async function handlePOST(request: NextRequest) {
  const headerLocale = resolveConsentLocale(request)
  const requestViolation = validateAuthMutationRequest(request, headerLocale)
  if (requestViolation) {
    return requestViolation
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return createAuthJsonResponse(
      { error: CONSENT_ERRORS[headerLocale].invalidRequest },
      { status: 400 }
    )
  }

  const locale = resolveConsentLocale(
    request,
    typeof payload === "object" && payload !== null && "locale" in payload
      ? (payload as { locale?: unknown }).locale
      : null
  )

  const preference = normalizeAnalyticsConsentPreference(
    typeof payload === "object" && payload !== null && "preference" in payload
      ? (payload as { preference?: unknown }).preference
      : null
  )

  if (!preference) {
    return createAuthJsonResponse(
      { error: CONSENT_ERRORS[locale].invalidPreference },
      { status: 400 }
    )
  }
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
