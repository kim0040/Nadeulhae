/**
 * @fileoverview Request-scoped session ID management.
 *
 * Reads a session ID from the incoming `nadeulhae_sid` cookie or generates
 * a new UUID. Provides `attachSessionCookie` to conditionally set the cookie
 * on the outbound response.
 *
 * @module request-session
 */

import { NextResponse } from "next/server"

const SESSION_COOKIE_NAME = "nadeulhae_sid"
const SESSION_MAX_AGE = 60 * 60 * 24 * 30

/**
 * Parses a raw `Cookie` header string into a `Map<string, string>`.
 * Handles URL-decoded values and malformed entries gracefully.
 */
function parseCookies(cookieHeader: string | null) {
  if (!cookieHeader) return new Map<string, string>()

  return new Map(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, ...rest] = part.split("=")
        // join back in case the value itself contains "="
        try {
          return [key, decodeURIComponent(rest.join("="))]
        } catch {
          return [key, rest.join("=")]
        }
      })
  )
}

/**
 * Retrieves the session ID from the request's `nadeulhae_sid` cookie.
 * If absent, generates a new UUID and signals that the cookie should be set.
 */
export function getOrCreateSessionId(request: Request) {
  const cookies = parseCookies(request.headers.get("cookie"))
  const existing = cookies.get(SESSION_COOKIE_NAME)

  if (existing) {
    return {
      sessionId: existing,
      shouldSetCookie: false,
    }
  }

  return {
    sessionId: crypto.randomUUID(),
    shouldSetCookie: true,
  }
}

/**
 * Sets the `nadeulhae_sid` cookie on the response if `shouldSetCookie` is
 * `true` (i.e. the session was newly created). No-op otherwise.
 */
export function attachSessionCookie(response: NextResponse, sessionId: string, shouldSetCookie: boolean) {
  if (!shouldSetCookie) return response

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })

  return response
}
