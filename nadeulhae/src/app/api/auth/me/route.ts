import { NextRequest } from "next/server"

import { createAuthJsonResponse } from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import { withApiAnalytics } from "@/lib/analytics/route"

export const runtime = "nodejs"

async function handleGET(request: NextRequest) {
  try {
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)

    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: "인증된 세션이 없습니다." },
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
      { error: "세션 확인 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

export const GET = withApiAnalytics(handleGET)
