import { NextRequest } from "next/server"

import { withApiAnalytics } from "@/lib/analytics/route"
import { createAuthJsonResponse, validateAuthMutationRequest } from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import {
  createChatSession,
  deleteChatSession,
  getChatState,
  listChatSessions,
} from "@/lib/chat/repository"
import type { ChatLocale } from "@/lib/chat/types"

export const runtime = "nodejs"

const SESSION_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    invalidSession: "유효한 세션을 찾을 수 없습니다.",
    cannotDelete: "마지막 세션은 삭제할 수 없습니다.",
    unexpected: "세션 처리 중 오류가 발생했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    invalidSession: "Unable to find a valid session.",
    cannotDelete: "The last remaining session cannot be deleted.",
    unexpected: "An unexpected session error occurred.",
  },
} as const

function getRequestLocale(request: Request, preferred?: unknown): ChatLocale {
  if (preferred === "en" || preferred === "ko") {
    return preferred
  }

  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
  return header.startsWith("en") ? "en" : "ko"
}

function getErrorMessage(locale: ChatLocale, key: keyof typeof SESSION_ERRORS.ko) {
  return SESSION_ERRORS[locale][key]
}

function withServerNow<T extends object>(payload: T) {
  return {
    ...payload,
    serverNow: new Date().toISOString(),
  }
}

function sanitizeSessionId(value: string | null) {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  if (!/^\d+$/.test(normalized)) {
    return null
  }

  return normalized
}

async function handleGET(request: NextRequest) {
  try {
    const locale = getRequestLocale(request)
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          withServerNow({ error: getErrorMessage(locale, "unauthorized") }),
          { status: 401 }
        )
      )
    }

    const sessions = await listChatSessions(authenticatedSession.user.id)
    const response = createAuthJsonResponse(withServerNow({ sessions }))
    return attachRefreshedAuthCookie(response, authenticatedSession)
  } catch (error) {
    console.error("Chat sessions GET API failed:", error)
    return createAuthJsonResponse(
      withServerNow({ error: getErrorMessage(getRequestLocale(request), "unexpected") }),
      { status: 500 }
    )
  }
}

async function handlePOST(request: NextRequest) {
  const invalidRequestResponse = validateAuthMutationRequest(request)
  if (invalidRequestResponse) {
    return invalidRequestResponse
  }

  let body: { locale?: ChatLocale; title?: string } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const locale = getRequestLocale(request, body.locale)

  try {
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          withServerNow({ error: getErrorMessage(locale, "unauthorized") }),
          { status: 401 }
        )
      )
    }

    const newSessionId = await createChatSession({
      userId: authenticatedSession.user.id,
      locale,
      title: typeof body.title === "string" ? body.title : null,
    })

    const response = createAuthJsonResponse(
      withServerNow(await getChatState({
        userId: authenticatedSession.user.id,
        locale,
        requestedSessionId: newSessionId,
      }))
    )
    return attachRefreshedAuthCookie(response, authenticatedSession)
  } catch (error) {
    console.error("Chat sessions POST API failed:", error)
    return createAuthJsonResponse(
      withServerNow({ error: getErrorMessage(locale, "unexpected") }),
      { status: 500 }
    )
  }
}

async function handleDELETE(request: NextRequest) {
  const invalidRequestResponse = validateAuthMutationRequest(request)
  if (invalidRequestResponse) {
    return invalidRequestResponse
  }

  const locale = getRequestLocale(request)
  const sessionId = sanitizeSessionId(request.nextUrl.searchParams.get("sessionId"))
  if (!sessionId) {
    return createAuthJsonResponse(
      withServerNow({ error: getErrorMessage(locale, "invalidSession") }),
      { status: 400 }
    )
  }

  try {
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          withServerNow({ error: getErrorMessage(locale, "unauthorized") }),
          { status: 401 }
        )
      )
    }

    const nextSessionId = await deleteChatSession({
      userId: authenticatedSession.user.id,
      sessionId,
    })

    if (!nextSessionId) {
      return createAuthJsonResponse(
        withServerNow({ error: getErrorMessage(locale, "cannotDelete") }),
        { status: 400 }
      )
    }

    const response = createAuthJsonResponse(
      withServerNow(await getChatState({
        userId: authenticatedSession.user.id,
        locale,
        requestedSessionId: nextSessionId,
      }))
    )
    return attachRefreshedAuthCookie(response, authenticatedSession)
  } catch (error) {
    console.error("Chat sessions DELETE API failed:", error)
    return createAuthJsonResponse(
      withServerNow({ error: getErrorMessage(locale, "unexpected") }),
      { status: 500 }
    )
  }
}

export const GET = withApiAnalytics(handleGET)
export const POST = withApiAnalytics(handlePOST)
export const DELETE = withApiAnalytics(handleDELETE)
