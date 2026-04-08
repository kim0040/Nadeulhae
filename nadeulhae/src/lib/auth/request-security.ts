import { NextRequest, NextResponse } from "next/server"

import { AUTH_BODY_LIMIT_BYTES } from "@/lib/auth/guardrails"

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
  body: Record<string, unknown>,
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

  if (request.nextUrl.origin) {
    allowedOrigins.add(request.nextUrl.origin)
  }

  if (process.env.APP_BASE_URL) {
    allowedOrigins.add(process.env.APP_BASE_URL)
  }

  const forwardedHost = request.headers.get("x-forwarded-host")
  const host = forwardedHost || request.headers.get("host")
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const protocol = forwardedProto || request.nextUrl.protocol.replace(/:$/, "")

  if (host) {
    allowedOrigins.add(`${protocol}://${host}`)
  }

  return allowedOrigins
}

export function validateSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin")
  const allowedOrigins = getAllowedOrigins(request)
  if (origin && !allowedOrigins.has(origin)) {
    return createAuthJsonResponse(
      { error: "허용되지 않은 요청 출처입니다." },
      { status: 403 }
    )
  }

  const secFetchSite = request.headers.get("sec-fetch-site")
  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    return createAuthJsonResponse(
      { error: "교차 사이트 요청은 허용되지 않습니다." },
      { status: 403 }
    )
  }

  return null
}

export function validateAuthMutationRequest(request: NextRequest) {
  const sameOriginViolation = validateSameOriginRequest(request)
  if (sameOriginViolation) {
    return sameOriginViolation
  }

  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().includes("application/json")) {
    return createAuthJsonResponse(
      { error: "JSON 요청만 허용됩니다." },
      { status: 415 }
    )
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(contentLength) && contentLength > AUTH_BODY_LIMIT_BYTES) {
    return createAuthJsonResponse(
      { error: "요청 본문이 너무 큽니다." },
      { status: 413 }
    )
  }

  return null
}
