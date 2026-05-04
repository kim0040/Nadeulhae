/**
 * @fileoverview
 * Analytics consent management.
 * Provides types, cookie parsing utilities, and helper functions for reading,
 * resolving, and attaching analytics consent preferences. Consent can be supplied
 * via a front-end cookie or a user account preference, with the cookie taking
 * precedence.
 */

import { NextResponse } from "next/server"

/** Determines whether detailed (allow) or essential-only analytics are collected. */
export type AnalyticsConsentPreference = "allow" | "essential"

/** Name of the client-side cookie that stores the user's analytics consent decision. */
export const ANALYTICS_CONSENT_COOKIE_NAME = "nadeulhae_analytics_consent"

// 180-day TTL matches common regulatory guidance for consent cookies.
const ANALYTICS_CONSENT_MAX_AGE = 60 * 60 * 24 * 180

/**
 * Parses a raw Cookie header string into a Map of name-value pairs.
 * Handles URL-decoded values and entries without an '=' separator.
 */
function parseCookies(cookieHeader: string | null) {
  if (!cookieHeader) {
    return new Map<string, string>()
  }

  return new Map(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=")
        if (separatorIndex === -1) {
          return [part, ""]
        }

        return [
          part.slice(0, separatorIndex),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ]
      })
  )
}

/**
 * Normalises a raw value into an AnalyticsConsentPreference, or null if invalid.
 * Accepts the strings "allow" and "essential" (case-insensitive); all other
 * inputs (including undefined, null, numbers) return null.
 */
export function normalizeAnalyticsConsentPreference(
  value: unknown
): AnalyticsConsentPreference | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === "allow") {
    return "allow"
  }

  if (normalized === "essential") {
    return "essential"
  }

  return null
}

/**
 * Reads and normalises the analytics consent preference from the incoming
 * request's cookies. Returns null when no consent cookie is present.
 */
export function getAnalyticsConsentPreferenceFromRequest(request: Request) {
  const cookies = parseCookies(request.headers.get("cookie"))
  return normalizeAnalyticsConsentPreference(
    cookies.get(ANALYTICS_CONSENT_COOKIE_NAME)
  )
}

/**
 * Resolves the effective analytics consent preference by checking the request
 * cookie first, then falling back to the user's account-level preference.
 * Cookie takes precedence so that users can opt out without altering their
 * account settings.
 */
export function resolveAnalyticsConsentPreference(
  request: Request,
  accountPreference?: boolean | null
) {
  const cookiePreference = getAnalyticsConsentPreferenceFromRequest(request)
  if (cookiePreference) {
    return cookiePreference
  }

  return accountPreference === true ? "allow" : "essential"
}

/**
 * Attaches (or updates) the analytics consent cookie on a NextResponse object.
 * The cookie is httpOnly: false (accessible to client JS so the front-end can
 * read the current state) and uses SameSite=Lax for standard top-level navigation.
 */
export function attachAnalyticsConsentCookie(
  response: NextResponse,
  preference: AnalyticsConsentPreference
) {
  response.cookies.set({
    name: ANALYTICS_CONSENT_COOKIE_NAME,
    value: preference,
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ANALYTICS_CONSENT_MAX_AGE,
  })

  return response
}
