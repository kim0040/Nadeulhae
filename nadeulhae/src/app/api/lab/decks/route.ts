import { NextRequest } from "next/server"

import { withApiAnalytics } from "@/lib/analytics/route"
import {
  createAuthJsonResponse,
  validateAuthMutationRequest,
} from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import {
  createEmptyLabDeck,
  listLabDecksForUser,
  updateLabDeckForUser,
  deleteLabDeckForUser,
} from "@/lib/lab/management"
import type { LabLocale } from "@/lib/lab/types"

export const runtime = "nodejs"

const LAB_DECK_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    disabled: "실험실 기능이 비활성화되어 있습니다. 대시보드 설정에서 먼저 활성화해 주세요.",
    invalidRequest: "단어장 요청 형식이 올바르지 않습니다.",
    invalidDeckId: "단어장 식별자가 올바르지 않습니다.",
    invalidTitle: "단어장 이름을 1자 이상 입력해 주세요.",
    notFound: "해당 단어장을 찾을 수 없습니다.",
    failed: "단어장 정보를 처리하지 못했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    disabled: "Lab is disabled. Enable it first from dashboard settings.",
    invalidRequest: "Invalid deck request.",
    invalidDeckId: "Invalid deck id.",
    invalidTitle: "Please enter a deck title.",
    notFound: "Deck not found.",
    failed: "Failed to process deck request.",
  },
  zh: {
    unauthorized: "请先登录。",
    disabled: "实验室功能未开启。请先在仪表盘设置中启用。",
    invalidRequest: "词库请求格式无效。",
    invalidDeckId: "词库标识符无效。",
    invalidTitle: "请输入词库名称。",
    notFound: "未找到该词库。",
    failed: "词库信息处理失败。",
  },
  ja: {
    unauthorized: "ログインが必要です。",
    disabled: "ラボ機能が無効です。ダッシュボード設定から先に有効にしてください。",
    invalidRequest: "デッキリクエストの形式が正しくありません。",
    invalidDeckId: "デッキIDが正しくありません。",
    invalidTitle: "デッキ名を入力してください。",
    notFound: "デッキが見つかりません。",
    failed: "デッキ情報の処理に失敗しました。",
  },
} as const

function getLocale(request: NextRequest): LabLocale {
  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
  if (header.startsWith("zh")) return "zh"
  if (header.startsWith("ja")) return "ja"
  return header.startsWith("en") ? "en" : "ko"
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
}

function parseDeckId(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  const integer = Math.floor(parsed)
  return integer > 0 ? integer : null
}

async function requireLabSession(request: NextRequest, locale: LabLocale) {
  const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
  if (!authenticatedSession) {
    return {
      session: null,
      response: clearAuthCookie(
        createAuthJsonResponse(
          { error: LAB_DECK_ERRORS[locale].unauthorized },
          { status: 401 }
        )
      ),
    }
  }

  if (!authenticatedSession.user.labEnabled) {
    return {
      session: null,
      response: attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_DECK_ERRORS[locale].disabled },
          { status: 403 }
        ),
        authenticatedSession
      ),
    }
  }

  return {
    session: authenticatedSession,
    response: null,
  }
}

async function handleGET(request: NextRequest) {
  const locale = getLocale(request)

  try {
    const required = await requireLabSession(request, locale)
    if (!required.session) {
      return required.response as Response
    }

    const decks = await listLabDecksForUser(required.session.user.id)

    return attachRefreshedAuthCookie(
      createAuthJsonResponse({ decks }),
      required.session
    )
  } catch (error) {
    console.error("Lab decks GET API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_DECK_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

async function handlePOST(request: NextRequest) {
  const locale = getLocale(request)
  const authLocale: "ko" | "en" = locale === "zh" || locale === "ja" ? "en" : locale

  try {
    const requestViolation = validateAuthMutationRequest(request, authLocale)
    if (requestViolation) {
      return requestViolation
    }

    const required = await requireLabSession(request, locale)
    if (!required.session) {
      return required.response as Response
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_DECK_ERRORS[locale].invalidRequest },
          { status: 400 }
        ),
        required.session
      )
    }

    const title = normalizeText(
      typeof payload === "object" && payload && "title" in payload
        ? (payload as { title?: unknown }).title
        : "",
      120
    )
    const topic = normalizeText(
      typeof payload === "object" && payload && "topic" in payload
        ? (payload as { topic?: unknown }).topic
        : "",
      200
    )

    if (!title) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_DECK_ERRORS[locale].invalidTitle },
          { status: 400 }
        ),
        required.session
      )
    }

    const deck = await createEmptyLabDeck({
      userId: required.session.user.id,
      locale,
      title,
      topic: topic || null,
    })
    const decks = await listLabDecksForUser(required.session.user.id)

    return attachRefreshedAuthCookie(
      createAuthJsonResponse({ deck, decks }),
      required.session
    )
  } catch (error) {
    console.error("Lab decks POST API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_DECK_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

async function handlePATCH(request: NextRequest) {
  const locale = getLocale(request)
  const authLocale: "ko" | "en" = locale === "zh" || locale === "ja" ? "en" : locale

  try {
    const requestViolation = validateAuthMutationRequest(request, authLocale)
    if (requestViolation) {
      return requestViolation
    }

    const required = await requireLabSession(request, locale)
    if (!required.session) {
      return required.response as Response
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_DECK_ERRORS[locale].invalidRequest },
          { status: 400 }
        ),
        required.session
      )
    }

    const deckId = parseDeckId(
      typeof payload === "object" && payload && "deckId" in payload
        ? (payload as { deckId?: unknown }).deckId
        : null
    )

    if (!deckId) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_DECK_ERRORS[locale].invalidDeckId },
          { status: 400 }
        ),
        required.session
      )
    }

    const title = normalizeText(
      typeof payload === "object" && payload && "title" in payload
        ? (payload as { title?: unknown }).title
        : "",
      120
    )
    const topic = normalizeText(
      typeof payload === "object" && payload && "topic" in payload
        ? (payload as { topic?: unknown }).topic
        : "",
      200
    )

    if (!title) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_DECK_ERRORS[locale].invalidTitle },
          { status: 400 }
        ),
        required.session
      )
    }

    const deck = await updateLabDeckForUser({
      userId: required.session.user.id,
      deckId,
      title,
      topic: topic || null,
    })

    if (!deck) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_DECK_ERRORS[locale].notFound },
          { status: 404 }
        ),
        required.session
      )
    }

    const decks = await listLabDecksForUser(required.session.user.id)

    return attachRefreshedAuthCookie(
      createAuthJsonResponse({ deck, decks }),
      required.session
    )
  } catch (error) {
    console.error("Lab decks PATCH API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_DECK_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

async function handleDELETE(request: NextRequest) {
  const locale = getLocale(request)
  const authLocale: "ko" | "en" = locale === "zh" || locale === "ja" ? "en" : locale

  try {
    const requestViolation = validateAuthMutationRequest(request, authLocale)
    if (requestViolation) {
      return requestViolation
    }

    const required = await requireLabSession(request, locale)
    if (!required.session) {
      return required.response as Response
    }

    const { searchParams } = new URL(request.url)
    const deckId = parseDeckId(searchParams.get("deckId"))

    if (!deckId) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_DECK_ERRORS[locale].invalidDeckId },
          { status: 400 }
        ),
        required.session
      )
    }

    const success = await deleteLabDeckForUser({
      userId: required.session.user.id,
      deckId,
    })

    if (!success) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_DECK_ERRORS[locale].notFound },
          { status: 404 }
        ),
        required.session
      )
    }

    const decks = await listLabDecksForUser(required.session.user.id)

    return attachRefreshedAuthCookie(
      createAuthJsonResponse({ decks, success: true }),
      required.session
    )
  } catch (error) {
    console.error("Lab decks DELETE API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_DECK_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

export const GET = withApiAnalytics(handleGET)
export const POST = withApiAnalytics(handlePOST)
export const PATCH = withApiAnalytics(handlePATCH)
export const DELETE = withApiAnalytics(handleDELETE)
