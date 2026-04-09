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
import { getAuthMessage, resolveAuthLocale } from "@/lib/auth/messages"
import { withApiAnalytics } from "@/lib/analytics/route"

export const runtime = "nodejs"

async function handlePOST(request: NextRequest) {
  const locale = resolveAuthLocale(request.headers.get("accept-language"))
  const ipAddress = getClientIp(request)
  const userAgent = getUserAgent(request)

  try {
    const requestViolation = validateSameOriginRequest(request, locale)
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
      { error: getAuthMessage(locale, "logoutInternalError") },
      { status: 500 }
    )
  }
}

export const POST = withApiAnalytics(handlePOST)
