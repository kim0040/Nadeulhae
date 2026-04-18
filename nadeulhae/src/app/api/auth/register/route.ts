import { NextRequest } from "next/server"

import {
  REGISTER_EMAIL_LIMIT,
  REGISTER_IP_LIMIT,
  getAuthScopeKey,
} from "@/lib/auth/guardrails"
import { PASSWORD_ALGORITHM, hashPassword } from "@/lib/auth/password"
import {
  consumeAuthRateLimit,
  createUser,
  findActiveAuthBlock,
  findUserByEmail,
  NicknameTagExhaustedError,
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
import { validateRegisterPayload } from "@/lib/auth/validation"
import { getAuthMessage, resolveAuthLocale } from "@/lib/auth/messages"
import { recordDailyConsentDecisionSafely } from "@/lib/analytics/repository"
import { attachAnalyticsConsentCookie } from "@/lib/analytics/consent"
import { withApiAnalytics } from "@/lib/analytics/route"

export const runtime = "nodejs"

function getDuplicateErrorContext(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return { isDuplicate: false, message: "" }
  }

  const mysqlError = error as { code?: unknown; sqlMessage?: unknown; message?: unknown }
  const mysqlCode = String(mysqlError.code ?? "")
  const mysqlMessage = typeof mysqlError.sqlMessage === "string"
    ? mysqlError.sqlMessage
    : typeof mysqlError.message === "string"
      ? mysqlError.message
      : ""

  return {
    isDuplicate: mysqlCode === "ER_DUP_ENTRY",
    message: mysqlMessage,
  }
}

async function handlePOST(request: NextRequest) {
  const locale = resolveAuthLocale(request.headers.get("accept-language"))
  const ipAddress = getClientIp(request)
  const userAgent = getUserAgent(request)
  const ipScopeKey = getAuthScopeKey("ip", ipAddress)

  try {
    const requestViolation = validateAuthMutationRequest(request, locale)
    if (requestViolation) {
      await recordAuthSecurityEventSafely({
        eventType: "register_request_rejected",
        action: "register",
        outcome: "rejected",
        ipAddress,
        userAgent,
        metadata: {
          reason: "request_validation_failed",
        },
      })
      return requestViolation
    }

    const blockedByIp = await findActiveAuthBlock("register", [ipScopeKey])
    if (blockedByIp) {
      await recordAuthSecurityEventSafely({
        eventType: "register_blocked",
        action: "register",
        outcome: "blocked",
        ipAddress,
        userAgent,
        metadata: {
          scopeKey: blockedByIp.scopeKey,
          retryAfterSeconds: blockedByIp.retryAfterSeconds,
        },
      })

      return createAuthJsonResponse(
        { error: getAuthMessage(locale, "registerTooManyAttempts") },
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
        ...REGISTER_IP_LIMIT,
        scopeKey: ipScopeKey,
      })
      await recordAuthSecurityEventSafely({
        eventType: "register_malformed_json",
        action: "register",
        outcome: "rejected",
        ipAddress,
        userAgent,
      })

      return createAuthJsonResponse(
        { error: getAuthMessage(locale, "invalidJsonRequest") },
        { status: 400 }
      )
    }

    const validation = validateRegisterPayload(payload, locale)

    if ("error" in validation) {
      await consumeAuthRateLimit({
        ...REGISTER_IP_LIMIT,
        scopeKey: ipScopeKey,
      })
      await recordAuthSecurityEventSafely({
        eventType: "register_validation_failed",
        action: "register",
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
    const activeBlock = await findActiveAuthBlock("register", [ipScopeKey, emailScopeKey])
    if (activeBlock) {
      await recordAuthSecurityEventSafely({
        eventType: "register_blocked",
        action: "register",
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
        { error: getAuthMessage(locale, "registerTooManyAttempts") },
        {
          status: 429,
          retryAfterSeconds: activeBlock.retryAfterSeconds,
        }
      )
    }

    const [ipRateDecision, emailRateDecision] = await Promise.all([
      consumeAuthRateLimit({
        ...REGISTER_IP_LIMIT,
        scopeKey: ipScopeKey,
      }),
      consumeAuthRateLimit({
        ...REGISTER_EMAIL_LIMIT,
        scopeKey: emailScopeKey,
      }),
    ])

    if (ipRateDecision.blocked || emailRateDecision.blocked) {
      const retryAfterSeconds = Math.max(
        ipRateDecision.retryAfterSeconds,
        emailRateDecision.retryAfterSeconds
      )
      await recordAuthSecurityEventSafely({
        eventType: "register_rate_limited",
        action: "register",
        outcome: "blocked",
        email: validation.data.email,
        ipAddress,
        userAgent,
        metadata: {
          retryAfterSeconds,
          ipAttemptCount: ipRateDecision.attemptCount,
          emailAttemptCount: emailRateDecision.attemptCount,
        },
      })

      return createAuthJsonResponse(
        { error: getAuthMessage(locale, "registerTooManyAttempts") },
        {
          status: 429,
          retryAfterSeconds,
        }
      )
    }

    const existingUser = await findUserByEmail(validation.data.email)
    if (existingUser) {
      await recordAuthSecurityEventSafely({
        eventType: "register_duplicate_email",
        action: "register",
        outcome: "rejected",
        email: validation.data.email,
        ipAddress,
        userAgent,
      })

      return createAuthJsonResponse(
        { error: getAuthMessage(locale, "registerDuplicateEmail") },
        { status: 409 }
      )
    }

    const password = await hashPassword(validation.data.password)
    const createdUser = await createUser({
      id: crypto.randomUUID(),
      email: validation.data.email,
      displayName: validation.data.displayName,
      nickname: validation.data.nickname,
      passwordHash: password.hash,
      passwordSalt: password.salt,
      passwordAlgorithm: PASSWORD_ALGORITHM,
      ageBand: validation.data.ageBand,
      primaryRegion: validation.data.primaryRegion,
      interestTags: validation.data.interestTags,
      interestOther: validation.data.interestOther,
      preferredTimeSlot: validation.data.preferredTimeSlot,
      weatherSensitivity: validation.data.weatherSensitivity,
      marketingAccepted: validation.data.marketingAccepted,
      analyticsAccepted: validation.data.analyticsAccepted,
      labEnabled: false,
      agreedAt: new Date(),
    })

    const session = await startAuthenticatedSession(request, createdUser.id)
    await recordAuthSecurityEventSafely({
      eventType: "register_success",
      action: "register",
      outcome: "success",
      userId: createdUser.id,
      email: createdUser.email,
      ipAddress,
      userAgent,
      metadata: {
        marketingAccepted: createdUser.marketingAccepted,
        analyticsAccepted: createdUser.analyticsAccepted,
      },
    })

    await recordDailyConsentDecisionSafely({
      request,
      preference: createdUser.analyticsAccepted ? "allow" : "essential",
      decisionSource: "signup",
      locale: request.headers.get("accept-language"),
    })

    const response = createAuthJsonResponse(
      { user: toPublicUser({
        id: createdUser.id,
        email: createdUser.email,
        display_name: createdUser.displayName,
        nickname: createdUser.nickname,
        nickname_tag: createdUser.nicknameTag,
        age_band: createdUser.ageBand,
        primary_region: createdUser.primaryRegion,
        interest_tags: createdUser.interestTags,
        interest_other: createdUser.interestOther,
        preferred_time_slot: createdUser.preferredTimeSlot,
        weather_sensitivity: createdUser.weatherSensitivity,
        marketing_accepted: createdUser.marketingAccepted ? 1 : 0,
        analytics_accepted: createdUser.analyticsAccepted ? 1 : 0,
        lab_enabled: createdUser.labEnabled ? 1 : 0,
        created_at: createdUser.createdAt,
      }) },
      { status: 201 }
    )
    attachAuthCookie(response, session.token, session.expiresAt)
    attachAnalyticsConsentCookie(
      response,
      createdUser.analyticsAccepted ? "allow" : "essential"
    )
    return response
  } catch (error) {
    const duplicateContext = getDuplicateErrorContext(error)
    const duplicateNickname = error instanceof NicknameTagExhaustedError
      || (duplicateContext.isDuplicate && /uq_users_nickname_hash_tag|nickname_tag/i.test(duplicateContext.message))

    if (duplicateNickname) {
      await recordAuthSecurityEventSafely({
        eventType: "register_duplicate_nickname",
        action: "register",
        outcome: "rejected",
        ipAddress,
        userAgent,
      })

      return createAuthJsonResponse(
        { error: getAuthMessage(locale, "duplicateNickname") },
        { status: 409 }
      )
    }

    const duplicateEmail = duplicateContext.isDuplicate

    if (duplicateEmail) {
      await recordAuthSecurityEventSafely({
        eventType: "register_duplicate_email",
        action: "register",
        outcome: "rejected",
        ipAddress,
        userAgent,
      })

      return createAuthJsonResponse(
        { error: getAuthMessage(locale, "registerDuplicateEmail") },
        { status: 409 }
      )
    }

    console.error("Register API failed:", error)
    await recordAuthSecurityEventSafely({
      eventType: "register_internal_error",
      action: "register",
      outcome: "failed",
      ipAddress,
      userAgent,
    })

    return createAuthJsonResponse(
      { error: getAuthMessage(locale, "registerInternalError") },
      { status: 500 }
    )
  }
}

export const POST = withApiAnalytics(handlePOST)
