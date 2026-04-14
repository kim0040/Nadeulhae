import { NextRequest, NextResponse } from "next/server"

import { AUTH_BODY_LIMIT_BYTES } from "@/lib/auth/guardrails"
import {
  type AuthLocale,
  getAuthMessage,
  resolveAuthLocale,
} from "@/lib/auth/messages"

const TRUST_PROXY_HEADERS = /^(1|true|yes)$/i.test(
  process.env.TRUST_PROXY_HEADERS ?? ""
)

export function getClientIp(request: NextRequest) {
  if (!TRUST_PROXY_HEADERS) {
    return "anonymous"
  }

  return (
    request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "anonymous"
  ).slice(0, 64)
}

export function getUserAgent(request: NextRequest) {
  return request.headers.get("user-agent")?.slice(0, 255) ?? null
}

export function createAuthJsonResponse(
  body: unknown,
  init?: {
    status?: number
    retryAfterSeconds?: number
  }
) {
  const response = NextResponse.json(body, {
    status: init?.status ?? 200,
  })

  response.headers.set("Cache-Control", "no-store, max-age=0")
  response.headers.set("Pragma", "no-cache")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "same-origin")

  if (init?.retryAfterSeconds != null) {
    response.headers.set("Retry-After", String(init.retryAfterSeconds))
  }

  return response
}

function getAllowedOrigins(request: NextRequest) {
  const allowedOrigins = new Set<string>()

  const addOrigin = (value: string | null | undefined) => {
    if (!value) return
    try {
      const normalized = new URL(value).origin
      if (normalized) {
        allowedOrigins.add(normalized)
      }
    } catch {
      // Ignore invalid origin candidates.
    }
  }

  const pickHeaderToken = (value: string | null) => {
    if (!value) return ""
    return value.split(",")[0]?.trim() ?? ""
  }

  const normalizeProtocol = (value: string) => value.replace(/:$/, "").toLowerCase()

  addOrigin(request.nextUrl.origin)
  addOrigin(process.env.APP_BASE_URL)

  const forwardedHost = pickHeaderToken(request.headers.get("x-forwarded-host"))
  const host = forwardedHost || pickHeaderToken(request.headers.get("host"))
  const forwardedProto = pickHeaderToken(request.headers.get("x-forwarded-proto"))
  const requestProtocol = normalizeProtocol(request.nextUrl.protocol)
  const protocol = normalizeProtocol(forwardedProto || requestProtocol)

  if (host) {
    const protocolCandidates = new Set<string>([protocol, "https", "http"])
    for (const candidateProtocol of protocolCandidates) {
      addOrigin(`${candidateProtocol}://${host}`)
    }
  }

  return allowedOrigins
}

export function validateSameOriginRequest(request: NextRequest, locale?: AuthLocale) {
  const resolvedLocale = locale ?? resolveAuthLocale(request.headers.get("accept-language"))
  const originHeader = request.headers.get("origin")
  const allowedOrigins = getAllowedOrigins(request)

  const origin = (() => {
    if (!originHeader) return null
    if (originHeader === "null") return "null"
    try {
      return new URL(originHeader).origin
    } catch {
      return null
    }
  })()

  if (originHeader === "null") {
    const refererHeader = request.headers.get("referer")
    const refererOrigin = (() => {
      if (!refererHeader) return null
      try {
        return new URL(refererHeader).origin
      } catch {
        return null
      }
    })()
    if (refererOrigin && allowedOrigins.has(refererOrigin)) {
      return null
    }
  }

  if (originHeader && origin !== "null" && !origin) {
    return createAuthJsonResponse(
      { error: getAuthMessage(resolvedLocale, "invalidRequestOrigin") },
      { status: 403 }
    )
  }

  if (origin && origin !== "null" && !allowedOrigins.has(origin)) {
    return createAuthJsonResponse(
      { error: getAuthMessage(resolvedLocale, "invalidRequestOrigin") },
      { status: 403 }
    )
  }

  const secFetchSite = request.headers.get("sec-fetch-site")
  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    return createAuthJsonResponse(
      { error: getAuthMessage(resolvedLocale, "crossSiteBlocked") },
      { status: 403 }
    )
  }

  return null
}

export function validateAuthMutationRequest(request: NextRequest, locale?: AuthLocale) {
  const resolvedLocale = locale ?? resolveAuthLocale(request.headers.get("accept-language"))
  const sameOriginViolation = validateSameOriginRequest(request, resolvedLocale)
  if (sameOriginViolation) {
    return sameOriginViolation
  }

  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().includes("application/json")) {
    return createAuthJsonResponse(
      { error: getAuthMessage(resolvedLocale, "jsonOnly") },
      { status: 415 }
    )
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(contentLength) && contentLength > AUTH_BODY_LIMIT_BYTES) {
    return createAuthJsonResponse(
      { error: getAuthMessage(resolvedLocale, "requestBodyTooLarge") },
      { status: 413 }
    )
  }

  return null
}
