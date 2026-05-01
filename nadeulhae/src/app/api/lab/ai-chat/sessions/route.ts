import { NextRequest } from "next/server"

import { withApiAnalytics } from "@/lib/analytics/route"
import { createAuthJsonResponse, validateAuthMutationRequest } from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import {
  createLabAiChatSession,
  deleteLabAiChatSession,
  getLabAiChatStateCore,
} from "@/lib/lab-ai-chat/repository"
import type { LabAiChatLocale, LabAiChatStateResponse } from "@/lib/lab-ai-chat/types"
import { resolveAllowedLabModels } from "@/lib/llm/lab-llm"

export const runtime = "nodejs"

const SESSION_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    disabled: "실험실 활성화 사용자만 이용할 수 있습니다.",
    invalidSession: "유효한 세션을 찾을 수 없습니다.",
    cannotDelete: "마지막 세션은 삭제할 수 없습니다.",
    unexpected: "세션 처리 중 오류가 발생했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    disabled: "This feature is available only when the lab is enabled.",
    invalidSession: "Unable to find a valid session.",
    cannotDelete: "The last remaining session cannot be deleted.",
    unexpected: "An unexpected session error occurred.",
  },
  zh: {
    unauthorized: "请先登录。",
    disabled: "仅限启用实验室功能的用户使用。",
    invalidSession: "无法找到有效的会话。",
    cannotDelete: "无法删除最后一个会话。",
    unexpected: "会话处理过程中发生错误。",
  },
  ja: {
    unauthorized: "ログインが必要です。",
    disabled: "ラボ機能が有効なユーザーのみ利用できます。",
    invalidSession: "有効なセッションが見つかりません。",
    cannotDelete: "最後のセッションは削除できません。",
    unexpected: "セッション処理中にエラーが発生しました。",
  },
} as const

function getRequestLocale(request: Request, preferred?: unknown): LabAiChatLocale {
  if (preferred === "en" || preferred === "ko" || preferred === "zh" || preferred === "ja") {
    return preferred as LabAiChatLocale
  }

  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
  if (header.startsWith("zh")) return "zh"
  if (header.startsWith("ja")) return "ja"
  return header.startsWith("en") ? "en" : "ko"
}

function getErrorMessage(locale: LabAiChatLocale, key: keyof typeof SESSION_ERRORS.ko) {
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

async function buildStateResponse(input: {
  userId: string
  locale: LabAiChatLocale
  requestedSessionId?: string | null
}): Promise<LabAiChatStateResponse> {
  const [models, coreState] = await Promise.all([
    resolveAllowedLabModels(),
    getLabAiChatStateCore(input),
  ])

  return {
    ...coreState,
    models,
    defaultModelId: models[0].id,
  }
}

async function handlePOST(request: NextRequest) {
  const invalidRequestResponse = validateAuthMutationRequest(request)
  if (invalidRequestResponse) {
    return invalidRequestResponse
  }

  let body: { locale?: LabAiChatLocale; title?: string } = {}
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

    if (!authenticatedSession.user.labEnabled) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          withServerNow({ error: getErrorMessage(locale, "disabled") }),
          { status: 403 }
        ),
        authenticatedSession
      )
    }

    const newSessionId = await createLabAiChatSession({
      userId: authenticatedSession.user.id,
      locale,
      title: typeof body.title === "string" ? body.title : null,
    })

    const response = createAuthJsonResponse(
      withServerNow(await buildStateResponse({
        userId: authenticatedSession.user.id,
        locale,
        requestedSessionId: newSessionId,
      }))
    )

    return attachRefreshedAuthCookie(response, authenticatedSession)
  } catch (error) {
    console.error("Lab AI chat sessions POST API failed:", error)
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

    if (!authenticatedSession.user.labEnabled) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          withServerNow({ error: getErrorMessage(locale, "disabled") }),
          { status: 403 }
        ),
        authenticatedSession
      )
    }

    const nextSessionId = await deleteLabAiChatSession({
      userId: authenticatedSession.user.id,
      sessionId,
    })

    if (!nextSessionId) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          withServerNow({ error: getErrorMessage(locale, "cannotDelete") }),
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const response = createAuthJsonResponse(
      withServerNow(await buildStateResponse({
        userId: authenticatedSession.user.id,
        locale,
        requestedSessionId: nextSessionId,
      }))
    )

    return attachRefreshedAuthCookie(response, authenticatedSession)
  } catch (error) {
    console.error("Lab AI chat sessions DELETE API failed:", error)
    return createAuthJsonResponse(
      withServerNow({ error: getErrorMessage(locale, "unexpected") }),
      { status: 500 }
    )
  }
}

export const POST = withApiAnalytics(handlePOST)
export const DELETE = withApiAnalytics(handleDELETE)
