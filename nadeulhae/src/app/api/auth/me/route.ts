import { NextRequest } from "next/server"

import { createAuthJsonResponse } from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import { getAuthMessage, resolveAuthLocale } from "@/lib/auth/messages"
import { withApiAnalytics } from "@/lib/analytics/route"

export const runtime = "nodejs"

async function handleGET(request: NextRequest) {
  const locale = resolveAuthLocale(request.headers.get("accept-language"))
  try {
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)

    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: getAuthMessage(locale, "sessionMissing") },
          { status: 401 }
        )
      )
    }

    return attachRefreshedAuthCookie(
      createAuthJsonResponse({ user: authenticatedSession.user }),
      authenticatedSession
    )
  } catch (error) {
    console.error("Auth me API failed:", error)
    return createAuthJsonResponse(
      { error: getAuthMessage(locale, "sessionCheckError") },
      { status: 500 }
    )
  }
}

export const GET = withApiAnalytics(handleGET)
