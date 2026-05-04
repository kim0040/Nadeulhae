/**
 * POST /api/auth/login
 * Authenticates user by email + password. Validates request, checks IP/email rate limits and active blocks,
 * verifies password against stored hash, starts a session, and returns user profile + auth cookie.
 * Body: { email, password }
 * Returns: { user } with Set-Cookie header.
 * Rate-limited per IP and per email; delayed failure response to prevent enumeration.
 */

import { NextRequest } from "next/server"

import {
  AUTH_FAILURE_DELAY_MS,
  LOGIN_EMAIL_LIMIT,
  LOGIN_IP_LIMIT,
  getAuthScopeKey,
  sleep,
} from "@/lib/auth/guardrails"
import {
  verifyPassword,
  verifyPasswordAgainstDummy,
} from "@/lib/auth/password"
import {
  clearAuthRateLimits,
  consumeAuthRateLimit,
  findActiveAuthBlock,
  findUserByEmail,
  recordAuthSecurityEventSafely,
  toPublicUser,
} from "@/lib/auth/repository"
import {
  createAuthJsonResponse,
  getClientIp,
  getUserAgent,
  validateAuthMutationRequest,
} from "@/lib/auth/request-security"
import { attachAuthCookie, startAuthenticatedSession } from "@/lib/auth/session"
import { validateLoginPayload } from "@/lib/auth/validation"
import { getAuthMessage, resolveAuthLocale } from "@/lib/auth/messages"
import {
  attachAnalyticsConsentCookie,
  getAnalyticsConsentPreferenceFromRequest,
} from "@/lib/analytics/consent"
import { withApiAnalytics } from "@/lib/analytics/route"

export const runtime = "nodejs"

async function handlePOST(request: NextRequest) {
  // === 1. INIT ===
  const locale = resolveAuthLocale(request.headers.get("accept-language"))
  const ipAddress = getClientIp(request)
  const userAgent = getUserAgent(request)
  const ipScopeKey = getAuthScopeKey("ip", ipAddress)

  try {
    const requestViolation = validateAuthMutationRequest(request, locale)
    if (requestViolation) {
      await recordAuthSecurityEventSafely({
        eventType: "login_request_rejected",
        action: "login",
        outcome: "rejected",
        ipAddress,
        userAgent,
        metadata: {
          reason: "request_validation_failed",
        },
      })
      return requestViolation
    }

    const blockedByIp = await findActiveAuthBlock("login", [ipScopeKey])
    if (blockedByIp) {
      await recordAuthSecurityEventSafely({
        eventType: "login_blocked",
        action: "login",
        outcome: "blocked",
        ipAddress,
        userAgent,
        metadata: {
          scopeKey: blockedByIp.scopeKey,
          retryAfterSeconds: blockedByIp.retryAfterSeconds,
        },
      })

      return createAuthJsonResponse(
        { error: getAuthMessage(locale, "loginTooManyAttempts") },
        {
          status: 429,
          retryAfterSeconds: blockedByIp.retryAfterSeconds,
        }
      )
    }

    let payload: unknown

    try {
      payload = await request.json()
    } catch {
      await consumeAuthRateLimit({
        ...LOGIN_IP_LIMIT,
        scopeKey: ipScopeKey,
      })
      await recordAuthSecurityEventSafely({
        eventType: "login_malformed_json",
        action: "login",
        outcome: "rejected",
        ipAddress,
        userAgent,
      })

      return createAuthJsonResponse(
        { error: getAuthMessage(locale, "invalidJsonRequest") },
        { status: 400 }
      )
    }

    // === 2. PAYLOAD VALIDATION ===
    const validation = validateLoginPayload(payload, locale)

    if ("error" in validation) {
      await recordAuthSecurityEventSafely({
        eventType: "login_validation_failed",
        action: "login",
        outcome: "rejected",
        ipAddress,
        userAgent,
        metadata: {
          error: validation.error,
        },
      })

      return createAuthJsonResponse({ error: validation.error }, { status: 400 })
    }

    const emailScopeKey = getAuthScopeKey("email", validation.data.email)
    const activeBlock = await findActiveAuthBlock("login", [ipScopeKey, emailScopeKey])
    if (activeBlock) {
      await recordAuthSecurityEventSafely({
        eventType: "login_blocked",
        action: "login",
        outcome: "blocked",
        email: validation.data.email,
        ipAddress,
        userAgent,
        metadata: {
          scopeKey: activeBlock.scopeKey,
          retryAfterSeconds: activeBlock.retryAfterSeconds,
        },
      })

      return createAuthJsonResponse(
        { error: getAuthMessage(locale, "loginTooManyAttempts") },
        {
          status: 429,
          retryAfterSeconds: activeBlock.retryAfterSeconds,
        }
      )
    }

    // === 3. PASSWORD VERIFICATION ===
    const user = await findUserByEmail(validation.data.email)
    if (!user) {
      await verifyPasswordAgainstDummy(validation.data.password)
    }

    const isValidPassword = user
      ? await verifyPassword(
          validation.data.password,
          user.passwordHash,
          user.passwordSalt
        )
      : false

    if (!isValidPassword) {
      const [ipRateDecision, emailRateDecision] = await Promise.all([
        consumeAuthRateLimit({
          ...LOGIN_IP_LIMIT,
          scopeKey: ipScopeKey,
        }),
        consumeAuthRateLimit({
          ...LOGIN_EMAIL_LIMIT,
          scopeKey: emailScopeKey,
        }),
      ])

      const retryAfterSeconds = Math.max(
        ipRateDecision.retryAfterSeconds,
        emailRateDecision.retryAfterSeconds
      )

      await recordAuthSecurityEventSafely({
        eventType: ipRateDecision.blocked || emailRateDecision.blocked
          ? "login_rate_limited"
          : "login_failed",
        action: "login",
        outcome: ipRateDecision.blocked || emailRateDecision.blocked ? "blocked" : "failed",
        email: validation.data.email,
        ipAddress,
        userAgent,
        metadata: {
          ipAttemptCount: ipRateDecision.attemptCount,
          emailAttemptCount: emailRateDecision.attemptCount,
        },
      })

      await sleep(AUTH_FAILURE_DELAY_MS)

      if (ipRateDecision.blocked || emailRateDecision.blocked) {
        return createAuthJsonResponse(
          { error: getAuthMessage(locale, "loginTooManyAttempts") },
          {
            status: 429,
            retryAfterSeconds,
          }
        )
      }

      return createAuthJsonResponse(
        { error: getAuthMessage(locale, "loginInvalidCredentials") },
        { status: 401 }
      )
    }

    if (!user) {
      throw new Error("User resolved to null after successful password verification")
    }

    // === 4. SUCCESS — clear rate limits, start session, build response ===
    const authenticatedUser = user
    await clearAuthRateLimits("login", [ipScopeKey, emailScopeKey])

    const session = await startAuthenticatedSession(request, authenticatedUser.id)
    await recordAuthSecurityEventSafely({
      eventType: "login_success",
      action: "login",
      outcome: "success",
      userId: authenticatedUser.id,
      email: authenticatedUser.email,
      ipAddress,
      userAgent,
    })

    const response = createAuthJsonResponse(
      { user: toPublicUser({
        id: authenticatedUser.id,
        email: authenticatedUser.email,
        display_name: authenticatedUser.displayName,
        nickname: authenticatedUser.nickname,
        nickname_tag: authenticatedUser.nicknameTag,
        age_band: authenticatedUser.ageBand,
        primary_region: authenticatedUser.primaryRegion,
        interest_tags: authenticatedUser.interestTags,
        interest_other: authenticatedUser.interestOther,
        preferred_time_slot: authenticatedUser.preferredTimeSlot,
        weather_sensitivity: authenticatedUser.weatherSensitivity,
        marketing_accepted: authenticatedUser.marketingAccepted ? 1 : 0,
        analytics_accepted: authenticatedUser.analyticsAccepted ? 1 : 0,
        lab_enabled: authenticatedUser.labEnabled ? 1 : 0,
        created_at: authenticatedUser.createdAt,
      }) }
    )
    attachAuthCookie(response, session.token, session.expiresAt)

    if (!getAnalyticsConsentPreferenceFromRequest(request)) {
      attachAnalyticsConsentCookie(
        response,
        authenticatedUser.analyticsAccepted ? "allow" : "essential"
      )
    }

    return response
  } catch (error) {
    console.error("Login API failed:", error)
    await recordAuthSecurityEventSafely({
      eventType: "login_internal_error",
      action: "login",
      outcome: "failed",
      ipAddress,
      userAgent,
    })

    return createAuthJsonResponse(
      { error: getAuthMessage(locale, "loginInternalError") },
      { status: 500 }
    )
  }
}

export const POST = withApiAnalytics(handlePOST)
