import { NextRequest } from "next/server"

import { recordAuthSecurityEventSafely } from "@/lib/auth/repository"
import {
  createAuthJsonResponse,
  getClientIp,
  getUserAgent,
  validateSameOriginRequest,
} from "@/lib/auth/request-security"
import {
  clearAuthCookie,
  destroyAuthenticatedSession,
} from "@/lib/auth/session"
import { withApiAnalytics } from "@/lib/analytics/route"

export const runtime = "nodejs"

async function handlePOST(request: NextRequest) {
  const ipAddress = getClientIp(request)
  const userAgent = getUserAgent(request)

  try {
    const requestViolation = validateSameOriginRequest(request)
    if (requestViolation) {
      await recordAuthSecurityEventSafely({
        eventType: "logout_request_rejected",
        action: "logout",
        outcome: "rejected",
        ipAddress,
        userAgent,
      })
      return requestViolation
    }

    await destroyAuthenticatedSession(request)
    await recordAuthSecurityEventSafely({
      eventType: "logout_success",
      action: "logout",
      outcome: "success",
      ipAddress,
      userAgent,
    })

    return clearAuthCookie(createAuthJsonResponse({ success: true }))
  } catch (error) {
    console.error("Logout API failed:", error)
    await recordAuthSecurityEventSafely({
      eventType: "logout_internal_error",
      action: "logout",
      outcome: "failed",
      ipAddress,
      userAgent,
    })

    return createAuthJsonResponse(
      { error: "로그아웃 처리 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

export const POST = withApiAnalytics(handlePOST)
