import { createHash, randomBytes } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"

import { getClientIp, getUserAgent } from "@/lib/auth/request-security"
import {
  createSessionRecord,
  deleteSessionByTokenHash,
  findUserBySessionTokenHash,
  refreshSessionExpiration,
  touchSession,
} from "@/lib/auth/repository"

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "nadeulhae_auth"
const SESSION_DURATION_DAYS = Number(process.env.AUTH_SESSION_DAYS ?? "30")
const SESSION_REFRESH_WINDOW_HOURS = Number(
  process.env.AUTH_SESSION_REFRESH_WINDOW_HOURS ?? "72"
)

function getExpirationDate() {
  return new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000)
}

function shouldRefreshSession(expiresAt: Date) {
  const refreshWindowMs = Math.max(0, SESSION_REFRESH_WINDOW_HOURS) * 60 * 60 * 1000
  return expiresAt.getTime() - Date.now() <= refreshWindowMs
}

export function getSessionTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function getSessionTokenFromRequest(request: NextRequest) {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })

  return response
}

export async function startAuthenticatedSession(
  request: NextRequest,
  userId: string
) {
  const token = randomBytes(32).toString("hex")
  const expiresAt = getExpirationDate()

  await createSessionRecord({
    id: crypto.randomUUID(),
    userId,
    tokenHash: getSessionTokenHash(token),
    expiresAt,
    userAgent: getUserAgent(request),
    ipAddress: getClientIp(request),
  })

  return {
    token,
    expiresAt,
  }
}

export function attachAuthCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date
) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    expires: expiresAt,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })

  return response
}

export async function getAuthenticatedUserFromRequest(request: NextRequest) {
  const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
  return authenticatedSession?.user ?? null
}

export async function getAuthenticatedSessionFromRequest(request: NextRequest) {
  const token = getSessionTokenFromRequest(request)
  if (!token) {
    return null
  }

  const session = await findUserBySessionTokenHash(getSessionTokenHash(token))
  if (!session) {
    return null
  }

  let expiresAt = session.expiresAt
  let refreshed = false

  if (shouldRefreshSession(session.expiresAt)) {
    expiresAt = getExpirationDate()
    refreshed = true
    await refreshSessionExpiration(session.sessionId, expiresAt)
  } else {
    await touchSession(session.sessionId)
  }

  return {
    user: session.user,
    token,
    expiresAt,
    refreshed,
  }
}

export function attachRefreshedAuthCookie(
  response: NextResponse,
  session: {
    token: string
    expiresAt: Date
    refreshed: boolean
  } | null
) {
  if (!session?.refreshed) {
    return response
  }

  return attachAuthCookie(response, session.token, session.expiresAt)
}

export async function destroyAuthenticatedSession(request: NextRequest) {
  const token = getSessionTokenFromRequest(request)
  if (!token) {
    return
  }

  await deleteSessionByTokenHash(getSessionTokenHash(token))
}
