/**
 * Location Usage Proof System
 *
 * Records verifiable proof of location data usage for privacy compliance.
 * Every location-related API call is logged with session or anonymous
 * fingerprints, route path, and region key to create an auditable trail.
 * Proofs are retained for 6 months per the data retention policy.
 */
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

/**
 * Parses a raw Cookie header string into a Map of name-value pairs.
 * Handles URL-encoded values and malformed entries gracefully.
 */
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

/** SHA-256 hashes an input string and returns the hex digest. */
function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

/**
 * Extracts the client IP from a Request, respecting trusted proxy headers
 * (Cloudflare CF-Connecting-IP, X-Real-IP, X-Forwarded-For).
 * Falls back to "anonymous" when headers are not trusted or absent.
 */
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

/** Normalises and truncates a route path for safe DB insertion. Ensures it starts with "/" and does not exceed 191 characters. */
function normalizeRoutePath(value: string) {
  const trimmed = value.trim()
  if (!trimmed.startsWith("/")) {
    return "/"
  }

  return trimmed.slice(0, 191)
}

/** Normalises an HTTP method to uppercase, truncated to 16 chars. Defaults to "GET". */
function normalizeMethod(value: string) {
  const normalized = value.trim().toUpperCase()
  return normalized ? normalized.slice(0, 16) : "GET"
}

/** Normalises a region key to lowercase, truncated to 32 chars. Defaults to "unknown". */
function normalizeRegionKey(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized ? normalized.slice(0, 32) : "unknown"
}

/**
 * Ensures the location_usage_proofs table exists. Idempotent — uses
 * CREATE TABLE IF NOT EXISTS. Memoised globally so DDL runs once per
 * process lifetime. Resets the promise on failure to allow retries.
 */
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

/**
 * Input data for recording a location usage proof. Captures who
 * (session or anonymous fingerprint), what (route and method), and where
 * (region key) was accessed, along with the type of location event.
 */
export interface LocationUsageProofInput {
  request: Request
  routePath: string
  method: string
  regionKey: string
  sessionId?: string | null
  eventKind?: "location_lookup" | "weather_current" | "weather_forecast" | "fire_summary"
}

/**
 * Records a verifiable proof of location data usage. Computes a session
 * or anonymous fingerprint, hashes identifiers for privacy, and inserts
 * a row into the location_usage_proofs table.
 */
export async function recordLocationUsageProof(input: LocationUsageProofInput) {
  await ensureLocationUsageProofSchema()

  const cookies = parseCookies(input.request.headers.get("cookie"))
  const userAgent = input.request.headers.get("user-agent") ?? "unknown"
  const ipAddress = getClientIp(input.request)
  const sessionId = input.sessionId || cookies.get(REQUEST_SESSION_COOKIE_NAME) || null
  const authToken = cookies.get(AUTH_COOKIE_NAME) || null

  // Derive session source: use session ID for authenticated users,
  // fall back to IP+UserAgent fingerprint for anonymous visitors.
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
      // event kind distinguishes location_lookup from weather or fire-summary access
      input.eventKind ?? "location_lookup",
    ]
  )
}

/**
 * Error-safe wrapper around recordLocationUsageProof. Logs and swallows
 * errors to prevent location tracking failures from breaking the request.
 */
export async function recordLocationUsageProofSafely(input: LocationUsageProofInput) {
  try {
    await recordLocationUsageProof(input)
  } catch (error) {
    console.error("Failed to record location usage proof:", error)
  }
}

/**
 * Deletes location usage proof records older than 6 months.
 * Run periodically via the retention sweep to comply with policy.
 */
export async function cleanupExpiredLocationUsageProofs() {
  await ensureLocationUsageProofSchema()

  await executeStatement(
    `
      DELETE FROM location_usage_proofs
      WHERE created_at < DATE_SUB(NOW(), INTERVAL 6 MONTH)
    `
  )
}
