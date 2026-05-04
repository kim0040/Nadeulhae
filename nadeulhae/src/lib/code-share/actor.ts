/**
 * Actor identity management for the Code Share module.
 *
 * Anonymous (guest) collaborators are assigned a persistent actor ID
 * (UUID stored in an httpOnly cookie) and a human-readable alias
 * (adjective-noun-number) for in-editor presence display.
 * Actor identity is stable per browser session across requests.
 */
import { randomInt, randomUUID } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"

const CODE_SHARE_ACTOR_COOKIE_NAME = process.env.CODE_SHARE_ACTOR_COOKIE_NAME ?? "nadeulhae_code_share_actor"
const CODE_SHARE_ALIAS_COOKIE_NAME = process.env.CODE_SHARE_ALIAS_COOKIE_NAME ?? "nadeulhae_code_share_alias"
const CODE_SHARE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
const ALWAYS_SECURE_COOKIES = /^(1|true|yes)$/i.test(
  process.env.ALWAYS_SECURE_COOKIES ?? process.env.NODE_ENV ?? ""
)

const ACTOR_ID_PATTERN = /^[a-f0-9-]{36}$/i
const ALIAS_PATTERN = /^[A-Za-z0-9가-힣\-_\s]{2,40}$/

const ALIAS_ADJECTIVES = [
  "Swift",
  "Calm",
  "Bright",
  "Quiet",
  "Nimble",
  "Lively",
  "Curious",
  "Steady",
  "Clever",
  "Brave",
  "Keen",
  "Silver",
]

const ALIAS_NOUNS = [
  "Otter",
  "Falcon",
  "Panda",
  "Tiger",
  "Dolphin",
  "Eagle",
  "Sparrow",
  "Koala",
  "Fox",
  "Lynx",
  "Wolf",
  "Hawk",
]

/** Type guard — returns `true` when `value` matches the expected UUID v4 hex pattern. */
function isValidActorId(value: string | null | undefined): value is string {
  if (!value) {
    return false
  }

  return ACTOR_ID_PATTERN.test(value)
}

/** Type guard — returns `true` when `value` matches the alias charset and length constraints. */
function isValidAlias(value: string | null | undefined): value is string {
  if (!value) {
    return false
  }

  const normalized = value.trim()
  return ALIAS_PATTERN.test(normalized)
}

/**
 * Generates a random human-readable alias in the form `Adjective-Noun-Number`.
 * Used for unauthenticated guests so the collaborative editor can
 * show readable participant names instead of opaque UUIDs.
 */
function generateRandomAlias() {
  const adjective = ALIAS_ADJECTIVES[randomInt(ALIAS_ADJECTIVES.length)]
  const noun = ALIAS_NOUNS[randomInt(ALIAS_NOUNS.length)]
  const suffix = String(randomInt(10, 99))
  return `${adjective}-${noun}-${suffix}`
}

/** Reads the actor ID from the request cookie. Returns `null` when the cookie is missing or invalid. */
export function getCodeShareActorIdFromRequest(request: NextRequest) {
  const actorId = request.cookies.get(CODE_SHARE_ACTOR_COOKIE_NAME)?.value ?? null
  return isValidActorId(actorId) ? actorId : null
}

/** Reads the display alias from the request cookie. Returns `null` when the cookie is missing or invalid. */
export function getCodeShareAliasFromRequest(request: NextRequest) {
  const alias = request.cookies.get(CODE_SHARE_ALIAS_COOKIE_NAME)?.value ?? null
  return isValidAlias(alias) ? alias.trim() : null
}

/**
 * Returns the existing actor ID from cookies, or generates a fresh UUID.
 * Used at request boundaries where an identity must exist
 * for downstream owner checks and presence tracking.
 */
export function getOrCreateCodeShareActorId(request: NextRequest) {
  // Stable actor identity per browser session via cookie; used for owner checks and presence.
  return getCodeShareActorIdFromRequest(request) ?? randomUUID()
}

/** Returns the existing alias from cookies, or generates a new random one for display. */
export function getOrCreateCodeShareAlias(request: NextRequest) {
  return getCodeShareAliasFromRequest(request) ?? generateRandomAlias()
}

/** Attaches an httpOnly actor-ID cookie to the response. The cookie lives for 1 year. */
export function attachCodeShareActorCookie(response: NextResponse, actorId: string) {
  response.cookies.set({
    name: CODE_SHARE_ACTOR_COOKIE_NAME,
    value: actorId,
    maxAge: CODE_SHARE_COOKIE_MAX_AGE,
    // httpOnly keeps actor identifiers out of client JS while still attached to requests.
    httpOnly: true,
    sameSite: "lax",
    secure: ALWAYS_SECURE_COOKIES || process.env.NODE_ENV === "production",
    path: "/",
  })

  return response
}

/** Attaches an httpOnly alias cookie to the response. The cookie lives for 1 year. */
export function attachCodeShareAliasCookie(response: NextResponse, alias: string) {
  response.cookies.set({
    name: CODE_SHARE_ALIAS_COOKIE_NAME,
    value: alias,
    maxAge: CODE_SHARE_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: ALWAYS_SECURE_COOKIES || process.env.NODE_ENV === "production",
    path: "/",
  })

  return response
}

/**
 * Ensures both actor-ID and alias cookies are set on the response.
 * Optionally accepts pre-generated identity values to keep them
 * consistent across multiple server-side operations within one
 * request lifecycle.
 */
export function ensureCodeShareIdentityCookies(
  request: NextRequest,
  response: NextResponse,
  identity?: { actorId: string; alias: string }
) {
  // Callers can pass identity to avoid generating different values within one request lifecycle.
  const actorId = identity?.actorId ?? getOrCreateCodeShareActorId(request)
  const alias = identity?.alias ?? getOrCreateCodeShareAlias(request)
  const currentActorId = getCodeShareActorIdFromRequest(request)
  const currentAlias = getCodeShareAliasFromRequest(request)

  if (!currentActorId || currentActorId !== actorId) {
    attachCodeShareActorCookie(response, actorId)
  }

  if (!currentAlias || currentAlias !== alias) {
    attachCodeShareAliasCookie(response, alias)
  }

  return {
    actorId,
    alias,
  }
}
