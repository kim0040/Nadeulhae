import { createHash } from "node:crypto"

import { getSessionTokenHash } from "@/lib/auth/session"
import { executeStatement, getDbPool } from "@/lib/db"

const TRUST_PROXY_HEADERS = /^(1|true|yes)$/i.test(
  process.env.TRUST_PROXY_HEADERS ?? ""
)

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "nadeulhae_auth"
const REQUEST_SESSION_COOKIE_NAME = "nadeulhae_sid"

declare global {
  var __nadeulhaeLocationProofSchemaPromise: Promise<void> | undefined
}

const createLocationUsageProofTableSql = `
  CREATE TABLE IF NOT EXISTS location_usage_proofs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_hash CHAR(64) NOT NULL,
    auth_token_hash CHAR(64) NULL,
    route_path VARCHAR(191) NOT NULL,
    request_method VARCHAR(16) NOT NULL,
    region_key VARCHAR(32) NOT NULL,
    event_kind VARCHAR(32) NOT NULL DEFAULT 'location_lookup',
    used_device_coordinates TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_location_usage_created (created_at),
    KEY idx_location_usage_session_created (session_hash, created_at),
    KEY idx_location_usage_route_created (route_path, created_at)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

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

        const rawValue = part.slice(separatorIndex + 1)
        try {
          return [part.slice(0, separatorIndex), decodeURIComponent(rawValue)]
        } catch {
          return [part.slice(0, separatorIndex), rawValue]
        }
      })
  )
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function getClientIp(request: Request) {
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

function normalizeRoutePath(value: string) {
  const trimmed = value.trim()
  if (!trimmed.startsWith("/")) {
    return "/"
  }

  return trimmed.slice(0, 191)
}

function normalizeMethod(value: string) {
  const normalized = value.trim().toUpperCase()
  return normalized ? normalized.slice(0, 16) : "GET"
}

function normalizeRegionKey(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized ? normalized.slice(0, 32) : "unknown"
}

export async function ensureLocationUsageProofSchema() {
  if (globalThis.__nadeulhaeLocationProofSchemaPromise) {
    return globalThis.__nadeulhaeLocationProofSchemaPromise
  }

  const bootstrapPromise = (async () => {
    await getDbPool().query(createLocationUsageProofTableSql)
  })()

  globalThis.__nadeulhaeLocationProofSchemaPromise = bootstrapPromise.catch((error) => {
    globalThis.__nadeulhaeLocationProofSchemaPromise = undefined
    throw error
  })

  return globalThis.__nadeulhaeLocationProofSchemaPromise
}

export interface LocationUsageProofInput {
  request: Request
  routePath: string
  method: string
  regionKey: string
  sessionId?: string | null
  eventKind?: "location_lookup" | "weather_current" | "weather_forecast" | "fire_summary"
}

export async function recordLocationUsageProof(input: LocationUsageProofInput) {
  await ensureLocationUsageProofSchema()

  const cookies = parseCookies(input.request.headers.get("cookie"))
  const userAgent = input.request.headers.get("user-agent") ?? "unknown"
  const ipAddress = getClientIp(input.request)
  const sessionId = input.sessionId || cookies.get(REQUEST_SESSION_COOKIE_NAME) || null
  const authToken = cookies.get(AUTH_COOKIE_NAME) || null

  const sessionSource = sessionId
    ? `sid:${sessionId}`
    : `anon:${ipAddress}|${userAgent}`

  await executeStatement(
    `
      INSERT INTO location_usage_proofs (
        session_hash,
        auth_token_hash,
        route_path,
        request_method,
        region_key,
        event_kind,
        used_device_coordinates
      ) VALUES (?, ?, ?, ?, ?, ?, 1)
    `,
    [
      hashValue(sessionSource),
      authToken ? getSessionTokenHash(authToken) : null,
      normalizeRoutePath(input.routePath),
      normalizeMethod(input.method),
      normalizeRegionKey(input.regionKey),
      input.eventKind ?? "location_lookup",
    ]
  )
}

export async function recordLocationUsageProofSafely(input: LocationUsageProofInput) {
  try {
    await recordLocationUsageProof(input)
  } catch (error) {
    console.error("Failed to record location usage proof:", error)
  }
}

export async function cleanupExpiredLocationUsageProofs() {
  await ensureLocationUsageProofSchema()

  await executeStatement(
    `
      DELETE FROM location_usage_proofs
      WHERE created_at < DATE_SUB(NOW(), INTERVAL 6 MONTH)
    `
  )
}
