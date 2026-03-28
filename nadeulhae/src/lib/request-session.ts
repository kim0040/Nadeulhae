import { NextResponse } from "next/server"

const SESSION_COOKIE_NAME = "nadeulhae_sid"
const SESSION_MAX_AGE = 60 * 60 * 24 * 30

function parseCookies(cookieHeader: string | null) {
  if (!cookieHeader) return new Map<string, string>()

  return new Map(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, ...rest] = part.split("=")
        return [key, decodeURIComponent(rest.join("="))]
      })
  )
}

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
