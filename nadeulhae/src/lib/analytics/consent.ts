import { NextResponse } from "next/server"

export type AnalyticsConsentPreference = "allow" | "essential"

export const ANALYTICS_CONSENT_COOKIE_NAME = "nadeulhae_analytics_consent"
const ANALYTICS_CONSENT_MAX_AGE = 60 * 60 * 24 * 180

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

export function getAnalyticsConsentPreferenceFromRequest(request: Request) {
  const cookies = parseCookies(request.headers.get("cookie"))
  return normalizeAnalyticsConsentPreference(
    cookies.get(ANALYTICS_CONSENT_COOKIE_NAME)
  )
}

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
