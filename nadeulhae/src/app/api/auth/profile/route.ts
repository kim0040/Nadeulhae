import { NextRequest } from "next/server"

import {
  findUserById,
  recordAuthSecurityEventSafely,
  toPublicUser,
  updateUserProfile,
} from "@/lib/auth/repository"
import {
  createAuthJsonResponse,
  getClientIp,
  getUserAgent,
  validateAuthMutationRequest,
} from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import { validateUpdateProfilePayload } from "@/lib/auth/validation"
import { withApiAnalytics } from "@/lib/analytics/route"

export const runtime = "nodejs"

async function handlePATCH(request: NextRequest) {
  const ipAddress = getClientIp(request)
  const userAgent = getUserAgent(request)

  try {
    const requestViolation = validateAuthMutationRequest(request)
    if (requestViolation) {
      return requestViolation
    }

    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: "로그인이 필요합니다." },
          { status: 401 }
        )
      )
    }

    const sessionUser = authenticatedSession.user

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return createAuthJsonResponse(
        { error: "잘못된 JSON 요청입니다." },
        { status: 400 }
      )
    }

    const validation = validateUpdateProfilePayload(payload)
    if ("error" in validation) {
      return createAuthJsonResponse({ error: validation.error }, { status: 400 })
    }

    const existingUser = await findUserById(sessionUser.id)
    if (!existingUser) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: "계정 정보를 찾을 수 없습니다." },
          { status: 404 }
        )
      )
    }

    const updatedUser = await updateUserProfile({
      userId: sessionUser.id,
      displayName: validation.data.displayName,
      ageBand: validation.data.ageBand,
      primaryRegion: validation.data.primaryRegion,
      interestTags: validation.data.interestTags,
      interestOther: validation.data.interestOther,
      preferredTimeSlot: validation.data.preferredTimeSlot,
      weatherSensitivity: validation.data.weatherSensitivity,
      marketingAccepted: validation.data.marketingAccepted,
    })

    if (!updatedUser) {
      throw new Error("Updated user could not be reloaded")
    }

    await recordAuthSecurityEventSafely({
      eventType: "profile_update_success",
      action: "profile_update",
      outcome: "success",
      userId: updatedUser.id,
      email: updatedUser.email,
      ipAddress,
      userAgent,
    })

    return attachRefreshedAuthCookie(
      createAuthJsonResponse({
        user: toPublicUser({
          id: updatedUser.id,
          email: updatedUser.email,
          display_name: updatedUser.displayName,
          age_band: updatedUser.ageBand,
          primary_region: updatedUser.primaryRegion,
          interest_tags: updatedUser.interestTags,
          interest_other: updatedUser.interestOther,
          preferred_time_slot: updatedUser.preferredTimeSlot,
          weather_sensitivity: updatedUser.weatherSensitivity,
          marketing_accepted: updatedUser.marketingAccepted ? 1 : 0,
          created_at: updatedUser.createdAt,
        }),
      }),
      authenticatedSession
    )
  } catch (error) {
    console.error("Profile update API failed:", error)
    await recordAuthSecurityEventSafely({
      eventType: "profile_update_failed",
      action: "profile_update",
      outcome: "failed",
      ipAddress,
      userAgent,
    })

    return createAuthJsonResponse(
      { error: "회원 정보를 수정하는 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

export const PATCH = withApiAnalytics(handlePATCH)
