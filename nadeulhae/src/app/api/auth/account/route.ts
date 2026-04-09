import { NextRequest } from "next/server"

import {
  deleteUserAccount,
  recordAuthSecurityEventSafely,
} from "@/lib/auth/repository"
import {
  createAuthJsonResponse,
  getClientIp,
  getUserAgent,
  validateAuthMutationRequest,
} from "@/lib/auth/request-security"
import {
  clearAuthCookie,
  getAuthenticatedUserFromRequest,
} from "@/lib/auth/session"
import { getAuthMessage, resolveAuthLocale } from "@/lib/auth/messages"
import { withApiAnalytics } from "@/lib/analytics/route"

export const runtime = "nodejs"

async function handleDELETE(request: NextRequest) {
  const locale = resolveAuthLocale(request.headers.get("accept-language"))
  const ipAddress = getClientIp(request)
  const userAgent = getUserAgent(request)

  try {
    const requestViolation = validateAuthMutationRequest(request, locale)
    if (requestViolation) {
      return requestViolation
    }

    const sessionUser = await getAuthenticatedUserFromRequest(request)
    if (!sessionUser) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: getAuthMessage(locale, "authRequired") },
          { status: 401 }
        )
      )
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return createAuthJsonResponse(
        { error: getAuthMessage(locale, "invalidJsonRequest") },
        { status: 400 }
      )
    }

    const confirmText = typeof payload === "object" && payload !== null && "confirmText" in payload
      ? String((payload as { confirmText?: unknown }).confirmText ?? "").trim()
      : ""

    if (confirmText !== "DELETE") {
      return createAuthJsonResponse(
        { error: getAuthMessage(locale, "accountDeleteConfirm") },
        { status: 400 }
      )
    }

    await recordAuthSecurityEventSafely({
      eventType: "account_delete_requested",
      action: "account_delete",
      outcome: "success",
      userId: sessionUser.id,
      email: sessionUser.email,
      ipAddress,
      userAgent,
    })

    await deleteUserAccount(sessionUser.id)

    return clearAuthCookie(
      createAuthJsonResponse({ success: true })
    )
  } catch (error) {
    console.error("Account delete API failed:", error)
    await recordAuthSecurityEventSafely({
      eventType: "account_delete_failed",
      action: "account_delete",
      outcome: "failed",
      ipAddress,
      userAgent,
    })

    return createAuthJsonResponse(
      { error: getAuthMessage(locale, "accountDeleteInternalError") },
      { status: 500 }
    )
  }
}

export const DELETE = withApiAnalytics(handleDELETE)
