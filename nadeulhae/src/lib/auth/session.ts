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
import type { AuthUser } from "@/lib/auth/types"

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "nadeulhae_auth"
const SESSION_DURATION_DAYS = parsePositiveInt(
  process.env.AUTH_SESSION_DAYS,
  7,
  1,
  30
)
const SESSION_REFRESH_WINDOW_HOURS = parsePositiveInt(
  process.env.AUTH_SESSION_REFRESH_WINDOW_HOURS,
  24,
  1,
  168
)
const ALWAYS_SECURE_COOKIES = /^(1|true|yes)$/i.test(
  process.env.ALWAYS_SECURE_COOKIES ?? process.env.NODE_ENV ?? ""
)

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number(value ?? "")
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

const AUTH_SESSION_CACHE_TTL_MS = parsePositiveInt(
  process.env.AUTH_SESSION_CACHE_TTL_MS,
  15_000,
  3_000,
  300_000
)
const AUTH_SESSION_TOUCH_INTERVAL_MS = parsePositiveInt(
  process.env.AUTH_SESSION_TOUCH_INTERVAL_MS,
  60_000,
  10_000,
  600_000
)
const AUTH_SESSION_CACHE_MAX_ENTRIES = parsePositiveInt(
  process.env.AUTH_SESSION_CACHE_MAX_ENTRIES,
  4_000,
  100,
  50_000
)

interface AuthSessionCacheEntry {
  sessionId: string
  user: AuthUser
  expiresAt: Date
  cacheExpiresAt: number
  lastTouchedAt: number
}

declare global {
  var __nadeulhaeAuthSessionCache: Map<string, AuthSessionCacheEntry> | undefined
}

function getExpirationDate() {
  return new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000)
}

function shouldRefreshSession(expiresAt: Date) {
  const refreshWindowMs = Math.max(0, SESSION_REFRESH_WINDOW_HOURS) * 60 * 60 * 1000
  return expiresAt.getTime() - Date.now() <= refreshWindowMs
}

function getAuthSessionCache() {
  if (!globalThis.__nadeulhaeAuthSessionCache) {
    globalThis.__nadeulhaeAuthSessionCache = new Map()
  }

  return globalThis.__nadeulhaeAuthSessionCache
}

function pruneAuthSessionCache(cache: Map<string, AuthSessionCacheEntry>) {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (entry.cacheExpiresAt <= now || entry.expiresAt.getTime() <= now) {
      cache.delete(key)
    }
  }

  if (cache.size <= AUTH_SESSION_CACHE_MAX_ENTRIES) {
    return
  }

  const overflow = cache.size - AUTH_SESSION_CACHE_MAX_ENTRIES
  let removed = 0
  for (const key of cache.keys()) {
    cache.delete(key)
    removed += 1
    if (removed >= overflow) {
      break
    }
  }
}

function setAuthSessionCache(tokenHash: string, value: {
  sessionId: string
  user: AuthUser
  expiresAt: Date
  lastTouchedAt?: number
}) {
  const now = Date.now()
  const cache = getAuthSessionCache()
  cache.set(tokenHash, {
    sessionId: value.sessionId,
    user: value.user,
    expiresAt: value.expiresAt,
    cacheExpiresAt: now + Math.max(3_000, AUTH_SESSION_CACHE_TTL_MS),
    lastTouchedAt: value.lastTouchedAt ?? now,
  })
  pruneAuthSessionCache(cache)
}

function deleteAuthSessionCache(tokenHash: string) {
  getAuthSessionCache().delete(tokenHash)
}

export function clearAuthSessionCacheByToken(token: string | null | undefined) {
  if (!token) {
    return
  }

  deleteAuthSessionCache(getSessionTokenHash(token))
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
    secure: ALWAYS_SECURE_COOKIES || process.env.NODE_ENV === "production",
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
    secure: ALWAYS_SECURE_COOKIES || process.env.NODE_ENV === "production",
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

  const tokenHash = getSessionTokenHash(token)
  const now = Date.now()
  const cache = getAuthSessionCache()
  const cachedSession = cache.get(tokenHash)
  if (cachedSession && cachedSession.cacheExpiresAt > now && cachedSession.expiresAt.getTime() > now) {
    let expiresAt = cachedSession.expiresAt
    let refreshed = false

    if (shouldRefreshSession(cachedSession.expiresAt)) {
      expiresAt = getExpirationDate()
      refreshed = true
      await refreshSessionExpiration(cachedSession.sessionId, expiresAt)
      cachedSession.lastTouchedAt = now
    } else if (now - cachedSession.lastTouchedAt >= Math.max(10_000, AUTH_SESSION_TOUCH_INTERVAL_MS)) {
      await touchSession(cachedSession.sessionId)
      cachedSession.lastTouchedAt = now
    }

    setAuthSessionCache(tokenHash, {
      sessionId: cachedSession.sessionId,
      user: cachedSession.user,
      expiresAt,
      lastTouchedAt: cachedSession.lastTouchedAt,
    })

    return {
      user: cachedSession.user,
      token,
      expiresAt,
      refreshed,
    }
  }

  if (cachedSession) {
    deleteAuthSessionCache(tokenHash)
  }

  const session = await findUserBySessionTokenHash(tokenHash)
  if (!session) {
    deleteAuthSessionCache(tokenHash)
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

  setAuthSessionCache(tokenHash, {
    sessionId: session.sessionId,
    user: session.user,
    expiresAt,
  })

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

  const tokenHash = getSessionTokenHash(token)
  await deleteSessionByTokenHash(tokenHash)
  deleteAuthSessionCache(tokenHash)
}
