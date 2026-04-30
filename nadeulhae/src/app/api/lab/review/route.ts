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
import { applyLabCardReview, getLabState } from "@/lib/lab/repository"
import type { LabLocale } from "@/lib/lab/types"
import {
  LAB_REVIEW_GRADE_MAX,
  LAB_REVIEW_GRADE_MIN,
} from "@/lib/lab/constants"

export const runtime = "nodejs"

const LAB_REVIEW_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    disabled: "실험실 기능이 비활성화되어 있습니다. 대시보드 설정에서 먼저 활성화해 주세요.",
    invalidRequest: "실험실 복습 요청 형식이 올바르지 않습니다.",
    cardNotFound: "해당 카드를 찾을 수 없습니다.",
    failed: "실험실 복습 처리 중 오류가 발생했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    disabled: "Lab is disabled. Enable it first from dashboard settings.",
    invalidRequest: "Invalid lab review request.",
    cardNotFound: "The card could not be found.",
    failed: "An error occurred while processing lab review.",
  },
  zh: {
    unauthorized: "请先登录。",
    disabled: "实验室功能未开启。请先在仪表盘设置中启用。",
    invalidRequest: "实验室复习请求格式无效。",
    cardNotFound: "未找到该卡片。",
    failed: "实验室复习处理过程中发生错误。",
  },
  ja: {
    unauthorized: "ログインが必要です。",
    disabled: "ラボ機能が無効です。ダッシュボード設定から先に有効にしてください。",
    invalidRequest: "ラボ復習リクエストの形式が正しくありません。",
    cardNotFound: "カードが見つかりません。",
    failed: "ラボ復習処理中にエラーが発生しました。",
  },
} as const

function getLocale(request: NextRequest): LabLocale {
  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
  if (header.startsWith("zh")) return "zh"
  if (header.startsWith("ja")) return "ja"
  return header.startsWith("en") ? "en" : "ko"
}

function parseCardId(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  const integer = Math.floor(parsed)
  return integer > 0 ? integer : null
}

function parseReviewGrade(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  const integer = Math.floor(parsed)
  if (integer < LAB_REVIEW_GRADE_MIN || integer > LAB_REVIEW_GRADE_MAX) {
    return null
  }

  return integer
}

async function handlePOST(request: NextRequest) {
  const locale = getLocale(request)
  const authLocale: "ko" | "en" = locale === "zh" || locale === "ja" ? "en" : locale

  try {
    const requestViolation = validateAuthMutationRequest(request, authLocale)
    if (requestViolation) {
      return requestViolation
    }

    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: LAB_REVIEW_ERRORS[locale].unauthorized },
          { status: 401 }
        )
      )
    }

    if (!authenticatedSession.user.labEnabled) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_REVIEW_ERRORS[locale].disabled },
          { status: 403 }
        ),
        authenticatedSession
      )
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_REVIEW_ERRORS[locale].invalidRequest },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const cardId = parseCardId(
      typeof payload === "object" && payload && "cardId" in payload
        ? (payload as { cardId?: unknown }).cardId
        : null
    )
    const grade = parseReviewGrade(
      typeof payload === "object" && payload && "grade" in payload
        ? (payload as { grade?: unknown }).grade
        : typeof payload === "object" && payload && "known" in payload
          ? (payload as { known?: unknown }).known === true
            ? 3
            : 1
          : null
    )

    if (!cardId || !grade) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_REVIEW_ERRORS[locale].invalidRequest },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const reviewed = await applyLabCardReview({
      userId: authenticatedSession.user.id,
      cardId,
      grade,
    })

    if (!reviewed) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_REVIEW_ERRORS[locale].cardNotFound },
          { status: 404 }
        ),
        authenticatedSession
      )
    }

    const state = await getLabState(authenticatedSession.user.id)

    return attachRefreshedAuthCookie(
      createAuthJsonResponse({
        card: reviewed.card,
        usage: reviewed.usage,
        state,
      }),
      authenticatedSession
    )
  } catch (error) {
    console.error("Lab review API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_REVIEW_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

export const POST = withApiAnalytics(handlePOST)
