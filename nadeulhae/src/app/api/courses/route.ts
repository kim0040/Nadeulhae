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
  deleteSavedCourse,
  listSavedCoursesForUser,
  saveCourse,
  setSavedCourseVisibility,
} from "@/lib/saved-courses/repository"

export const runtime = "nodejs"

const ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    invalidRequest: "요청 형식이 올바르지 않습니다.",
    emptyCourse: "저장할 코스가 없습니다.",
    tooLarge: "코스 데이터가 너무 큽니다.",
    notFound: "해당 코스를 찾을 수 없습니다.",
    failed: "코스 저장 요청을 처리하지 못했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    invalidRequest: "Invalid request.",
    emptyCourse: "There is no course to save.",
    tooLarge: "Course data is too large.",
    notFound: "Course not found.",
    failed: "Failed to process the course request.",
  },
} as const

function getAuthLocale(request: NextRequest): "ko" | "en" {
  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
  return header.startsWith("en") ? "en" : "ko"
}

async function handlePOST(request: NextRequest) {
  const locale = getAuthLocale(request)
  try {
    const violation = validateAuthMutationRequest(request, locale)
    if (violation) return violation

    const session = await getAuthenticatedSessionFromRequest(request)
    if (!session) {
      return clearAuthCookie(
        createAuthJsonResponse({ error: ERRORS[locale].unauthorized }, { status: 401 })
      )
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse({ error: ERRORS[locale].invalidRequest }, { status: 400 }),
        session
      )
    }

    const body = (payload ?? {}) as { title?: unknown; slots?: unknown; weatherSnapshot?: unknown; isPublic?: unknown }
    const slots = Array.isArray(body.slots) ? body.slots : null
    if (!slots || slots.length === 0) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse({ error: ERRORS[locale].emptyCourse }, { status: 400 }),
        session
      )
    }

    try {
      const saved = await saveCourse({
        userId: session.user.id,
        title: typeof body.title === "string" ? body.title : "",
        slots,
        weatherSnapshot: body.weatherSnapshot ?? null,
        isPublic: body.isPublic === false ? false : true,
      })
      return attachRefreshedAuthCookie(
        createAuthJsonResponse({ id: saved.id, shareToken: saved.shareToken }, { status: 201 }),
        session
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      const isTooLarge = message.includes("too large")
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: isTooLarge ? ERRORS[locale].tooLarge : ERRORS[locale].failed },
          { status: isTooLarge ? 413 : 500 }
        ),
        session
      )
    }
  } catch (error) {
    console.error("Saved courses POST failed:", error)
    return createAuthJsonResponse({ error: ERRORS[locale].failed }, { status: 500 })
  }
}

async function handleGET(request: NextRequest) {
  const locale = getAuthLocale(request)
  try {
    const session = await getAuthenticatedSessionFromRequest(request)
    if (!session) {
      return clearAuthCookie(
        createAuthJsonResponse({ error: ERRORS[locale].unauthorized }, { status: 401 })
      )
    }
    const courses = await listSavedCoursesForUser(session.user.id)
    return attachRefreshedAuthCookie(createAuthJsonResponse({ courses }), session)
  } catch (error) {
    console.error("Saved courses GET failed:", error)
    return createAuthJsonResponse({ error: ERRORS[locale].failed }, { status: 500 })
  }
}

async function handleDELETE(request: NextRequest) {
  const locale = getAuthLocale(request)
  try {
    const violation = validateAuthMutationRequest(request, locale)
    if (violation) return violation

    const session = await getAuthenticatedSessionFromRequest(request)
    if (!session) {
      return clearAuthCookie(
        createAuthJsonResponse({ error: ERRORS[locale].unauthorized }, { status: 401 })
      )
    }

    const id = new URL(request.url).searchParams.get("id")?.trim()
    if (!id) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse({ error: ERRORS[locale].invalidRequest }, { status: 400 }),
        session
      )
    }

    const removed = await deleteSavedCourse({ userId: session.user.id, id })
    if (!removed) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse({ error: ERRORS[locale].notFound }, { status: 404 }),
        session
      )
    }
    return attachRefreshedAuthCookie(createAuthJsonResponse({ ok: true }), session)
  } catch (error) {
    console.error("Saved courses DELETE failed:", error)
    return createAuthJsonResponse({ error: ERRORS[locale].failed }, { status: 500 })
  }
}

async function handlePATCH(request: NextRequest) {
  const locale = getAuthLocale(request)
  try {
    const violation = validateAuthMutationRequest(request, locale)
    if (violation) return violation

    const session = await getAuthenticatedSessionFromRequest(request)
    if (!session) {
      return clearAuthCookie(
        createAuthJsonResponse({ error: ERRORS[locale].unauthorized }, { status: 401 })
      )
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse({ error: ERRORS[locale].invalidRequest }, { status: 400 }),
        session
      )
    }

    const body = (payload ?? {}) as { id?: unknown; isPublic?: unknown }
    const id = typeof body.id === "string" ? body.id.trim() : ""
    if (!id || typeof body.isPublic !== "boolean") {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse({ error: ERRORS[locale].invalidRequest }, { status: 400 }),
        session
      )
    }

    const updated = await setSavedCourseVisibility({ userId: session.user.id, id, isPublic: body.isPublic })
    if (!updated) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse({ error: ERRORS[locale].notFound }, { status: 404 }),
        session
      )
    }
    return attachRefreshedAuthCookie(
      createAuthJsonResponse({ ok: true, isPublic: body.isPublic }),
      session
    )
  } catch (error) {
    console.error("Saved courses PATCH failed:", error)
    return createAuthJsonResponse({ error: ERRORS[locale].failed }, { status: 500 })
  }
}

export const POST = withApiAnalytics(handlePOST)
export const GET = withApiAnalytics(handleGET)
export const PATCH = withApiAnalytics(handlePATCH)
export const DELETE = withApiAnalytics(handleDELETE)
