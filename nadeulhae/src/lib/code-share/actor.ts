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

function isValidActorId(value: string | null | undefined): value is string {
  if (!value) {
    return false
  }

  return ACTOR_ID_PATTERN.test(value)
}

function isValidAlias(value: string | null | undefined): value is string {
  if (!value) {
    return false
  }

  const normalized = value.trim()
  return ALIAS_PATTERN.test(normalized)
}

// Human-readable guest aliases keep collaboration UX understandable without auth.
function generateRandomAlias() {
  const adjective = ALIAS_ADJECTIVES[randomInt(ALIAS_ADJECTIVES.length)]
  const noun = ALIAS_NOUNS[randomInt(ALIAS_NOUNS.length)]
  const suffix = String(randomInt(10, 99))
  return `${adjective}-${noun}-${suffix}`
}

export function getCodeShareActorIdFromRequest(request: NextRequest) {
  const actorId = request.cookies.get(CODE_SHARE_ACTOR_COOKIE_NAME)?.value ?? null
  return isValidActorId(actorId) ? actorId : null
}

export function getCodeShareAliasFromRequest(request: NextRequest) {
  const alias = request.cookies.get(CODE_SHARE_ALIAS_COOKIE_NAME)?.value ?? null
  return isValidAlias(alias) ? alias.trim() : null
}

export function getOrCreateCodeShareActorId(request: NextRequest) {
  // Stable actor identity per browser session via cookie; used for owner checks and presence.
  return getCodeShareActorIdFromRequest(request) ?? randomUUID()
}

export function getOrCreateCodeShareAlias(request: NextRequest) {
  return getCodeShareAliasFromRequest(request) ?? generateRandomAlias()
}

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
