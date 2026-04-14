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
import { applyLabCardReviewBatch, getLabState } from "@/lib/lab/repository"
import type { LabLocale } from "@/lib/lab/types"
import {
  LAB_REVIEW_GRADE_MAX,
  LAB_REVIEW_GRADE_MIN,
} from "@/lib/lab/constants"

export const runtime = "nodejs"

const LAB_REVIEW_BATCH_MAX = 200

const LAB_REVIEW_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    disabled: "실험실 기능이 비활성화되어 있습니다. 대시보드 설정에서 먼저 활성화해 주세요.",
    invalidRequest: "실험실 복습 동기화 요청이 올바르지 않습니다.",
    failed: "실험실 동기화 중 부분적인 오류가 발생했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    disabled: "Lab is disabled. Enable it first from dashboard settings.",
    invalidRequest: "Invalid lab review sync request.",
    failed: "An error occurred while syncing lab reviews.",
  },
} as const

function getLocale(request: NextRequest): LabLocale {
  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
  return header.startsWith("en") ? "en" : "ko"
}

async function handlePOST(request: NextRequest) {
  const locale = getLocale(request)

  try {
    const requestViolation = validateAuthMutationRequest(request, locale)
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

    if (
      !payload ||
      typeof payload !== "object" ||
      !("reviews" in payload) ||
      !Array.isArray((payload as { reviews: unknown }).reviews)
    ) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_REVIEW_ERRORS[locale].invalidRequest },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const rawReviews = (payload as { reviews: unknown[] }).reviews

    if (rawReviews.length > LAB_REVIEW_BATCH_MAX) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_REVIEW_ERRORS[locale].invalidRequest },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const dedupedReviews = new Map<number, number>()
    
    for (const r of rawReviews) {
      if (!r || typeof r !== "object") continue
      
      const rawCardId = Number((r as { cardId?: unknown }).cardId)
      const rawGrade = Number((r as { grade?: unknown }).grade)

      if (
        Number.isFinite(rawCardId) &&
        Math.floor(rawCardId) > 0 &&
        Number.isFinite(rawGrade) &&
        Math.floor(rawGrade) >= LAB_REVIEW_GRADE_MIN &&
        Math.floor(rawGrade) <= LAB_REVIEW_GRADE_MAX
      ) {
        dedupedReviews.set(Math.floor(rawCardId), Math.floor(rawGrade))
      }
    }

    const validReviews = Array.from(dedupedReviews.entries()).map(([cardId, grade]) => ({ cardId, grade }))

    if (validReviews.length === 0) {
      // Nothing to process, return state
      const state = await getLabState(authenticatedSession.user.id)
      return attachRefreshedAuthCookie(
        createAuthJsonResponse({ state }),
        authenticatedSession
      )
    }

    const batchResult = await applyLabCardReviewBatch({
      userId: authenticatedSession.user.id,
      reviews: validReviews,
    })

    const state = await getLabState(authenticatedSession.user.id)

    return attachRefreshedAuthCookie(
      createAuthJsonResponse({
        results: batchResult.results,
        usage: batchResult.usage,
        state,
      }),
      authenticatedSession
    )
  } catch (error) {
    console.error("Lab batch review API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_REVIEW_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

export const POST = withApiAnalytics(handlePOST)
