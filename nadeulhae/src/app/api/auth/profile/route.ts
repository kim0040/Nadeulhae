import { NextRequest } from "next/server"

import {
  findUserById,
  NicknameTagExhaustedError,
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
  clearAuthSessionCacheByToken,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import { validateUpdateProfilePayload } from "@/lib/auth/validation"
import { getAuthMessage, resolveAuthLocale } from "@/lib/auth/messages"
import { recordDailyConsentDecisionSafely } from "@/lib/analytics/repository"
import { attachAnalyticsConsentCookie } from "@/lib/analytics/consent"
import { withApiAnalytics } from "@/lib/analytics/route"

export const runtime = "nodejs"

async function handlePATCH(request: NextRequest) {
  const locale = resolveAuthLocale(request.headers.get("accept-language"))
  const ipAddress = getClientIp(request)
  const userAgent = getUserAgent(request)

  try {
    const requestViolation = validateAuthMutationRequest(request, locale)
    if (requestViolation) {
      return requestViolation
    }

    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: getAuthMessage(locale, "authRequired") },
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
        { error: getAuthMessage(locale, "invalidJsonRequest") },
        { status: 400 }
      )
    }

    const validation = validateUpdateProfilePayload(payload, locale)
    if ("error" in validation) {
      return createAuthJsonResponse({ error: validation.error }, { status: 400 })
    }

    const existingUser = await findUserById(sessionUser.id)
    if (!existingUser) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: getAuthMessage(locale, "accountNotFound") },
          { status: 404 }
        )
      )
    }

    const updatedUser = await updateUserProfile({
      userId: sessionUser.id,
      displayName: validation.data.displayName,
      nickname: validation.data.nickname,
      ageBand: validation.data.ageBand,
      primaryRegion: validation.data.primaryRegion,
      interestTags: validation.data.interestTags,
      interestOther: validation.data.interestOther,
      preferredTimeSlot: validation.data.preferredTimeSlot,
      weatherSensitivity: validation.data.weatherSensitivity,
      marketingAccepted: validation.data.marketingAccepted,
      analyticsAccepted: validation.data.analyticsAccepted,
      labEnabled: validation.data.labEnabled,
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

    if (existingUser.analyticsAccepted !== updatedUser.analyticsAccepted) {
      await recordDailyConsentDecisionSafely({
        request,
        preference: updatedUser.analyticsAccepted ? "allow" : "essential",
        decisionSource: "profile",
        locale: request.headers.get("accept-language"),
      })
    }

    clearAuthSessionCacheByToken(authenticatedSession.token)

    const response = attachRefreshedAuthCookie(
      createAuthJsonResponse({
        user: toPublicUser({
          id: updatedUser.id,
          email: updatedUser.email,
          display_name: updatedUser.displayName,
          nickname: updatedUser.nickname,
          nickname_tag: updatedUser.nicknameTag,
          age_band: updatedUser.ageBand,
          primary_region: updatedUser.primaryRegion,
          interest_tags: updatedUser.interestTags,
          interest_other: updatedUser.interestOther,
          preferred_time_slot: updatedUser.preferredTimeSlot,
          weather_sensitivity: updatedUser.weatherSensitivity,
          marketing_accepted: updatedUser.marketingAccepted ? 1 : 0,
          analytics_accepted: updatedUser.analyticsAccepted ? 1 : 0,
          lab_enabled: updatedUser.labEnabled ? 1 : 0,
          created_at: updatedUser.createdAt,
        }),
      }),
      authenticatedSession
    )
    attachAnalyticsConsentCookie(
      response,
      updatedUser.analyticsAccepted ? "allow" : "essential"
    )
    return response
  } catch (error) {
    const duplicateNickname = error instanceof NicknameTagExhaustedError
      || (
        typeof error === "object"
        && error !== null
        && "code" in error
        && String((error as { code?: unknown }).code) === "ER_DUP_ENTRY"
      )

    if (duplicateNickname) {
      return createAuthJsonResponse(
        { error: getAuthMessage(locale, "duplicateNickname") },
        { status: 409 }
      )
    }

    console.error("Profile update API failed:", error)
    await recordAuthSecurityEventSafely({
      eventType: "profile_update_failed",
      action: "profile_update",
      outcome: "failed",
      ipAddress,
      userAgent,
    })

    return createAuthJsonResponse(
      { error: getAuthMessage(locale, "profileUpdateInternalError") },
      { status: 500 }
    )
  }
}

export const PATCH = withApiAnalytics(handlePATCH)
