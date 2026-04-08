import { createHash } from "node:crypto"

import type { PoolConnection, ResultSetHeader } from "mysql2/promise"

import { findUserBySessionTokenHash } from "@/lib/auth/repository"
import { getSessionTokenHash } from "@/lib/auth/session"
import { getDbPool } from "@/lib/db"
import { ensureAnalyticsSchema } from "@/lib/analytics/schema"

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "nadeulhae_auth"
const REQUEST_SESSION_COOKIE_NAME = "nadeulhae_sid"
const TRUST_PROXY_HEADERS = /^(1|true|yes)$/i.test(
  process.env.TRUST_PROXY_HEADERS ?? ""
)

type RouteKind = "page" | "api"
type AuthState = "guest" | "authenticated"
type DeviceType = "desktop" | "mobile" | "tablet" | "bot" | "unknown"

export interface DailyUsageEventInput {
  request: Request
  routeKind: RouteKind
  routePath: string
  method: string
  statusCode: number
  durationMs: number
  locale?: string | null
  sessionId?: string | null
}

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

        return [
          part.slice(0, separatorIndex),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ]
      })
  )
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function getKstMetricDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function normalizeLocale(value: string | null | undefined) {
  const raw = (value ?? "").trim().toLowerCase()
  if (!raw) {
    return "und"
  }

  if (raw.startsWith("ko")) {
    return "ko"
  }

  if (raw.startsWith("en")) {
    return "en"
  }

  return raw.slice(0, 8) || "und"
}

function getLocaleFromRequest(request: Request) {
  const header = request.headers.get("accept-language")
  if (!header) {
    return "und"
  }

  return normalizeLocale(header.split(",")[0]?.trim())
}

function normalizeRoutePath(value: string) {
  const trimmed = value.trim()
  if (!trimmed.startsWith("/")) {
    return "/"
  }

  return trimmed.slice(0, 191)
}

function getStatusGroup(statusCode: number) {
  const safeCode = Number.isFinite(statusCode) ? Math.max(100, Math.min(599, statusCode)) : 500
  return `${Math.floor(safeCode / 100)}xx`
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

function getDeviceType(userAgent: string | null): DeviceType {
  const ua = (userAgent ?? "").toLowerCase()
  if (!ua) return "unknown"
  if (/(bot|crawler|spider|preview|slurp)/.test(ua)) return "bot"
  if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/.test(ua)) return "tablet"
  if (/(mobi|iphone|ipod|android.*mobile|windows phone)/.test(ua)) return "mobile"
  return "desktop"
}

async function resolveIdentity(request: Request, fallbackSessionId?: string | null) {
  const cookies = parseCookies(request.headers.get("cookie"))
  const sessionId = fallbackSessionId || cookies.get(REQUEST_SESSION_COOKIE_NAME) || null
  const authToken = cookies.get(AUTH_COOKIE_NAME)
  const userAgent = request.headers.get("user-agent")
  const ipAddress = getClientIp(request)

  let userId: string | null = null
  let authState: AuthState = "guest"

  if (authToken) {
    const session = await findUserBySessionTokenHash(getSessionTokenHash(authToken))
    if (session?.user?.id) {
      userId = session.user.id
      authState = "authenticated"
    }
  }

  const visitorSource = sessionId
    ? `sid:${sessionId}`
    : authToken
      ? `auth:${authToken}`
      : `${ipAddress}|${userAgent ?? "unknown"}`

  return {
    userId,
    authState,
    userAgent,
    visitorHash: hashValue(visitorSource),
  }
}

function buildDimensionKey(input: {
  routeKind: RouteKind
  routePath: string
  method: string
  statusCode: number
  authState: AuthState
  deviceType: DeviceType
  locale: string
}) {
  return hashValue([
    input.routeKind,
    input.routePath,
    input.method,
    String(input.statusCode),
    input.authState,
    input.deviceType,
    input.locale,
  ].join("|"))
}

async function insertUniqueEntity(
  connection: PoolConnection,
  metricDate: string,
  dimensionKey: string,
  entityType: "visitor" | "user",
  entityHash: string
) {
  const [result] = await connection.execute<ResultSetHeader>(
    `
      INSERT IGNORE INTO analytics_daily_unique_entities (
        metric_date,
        dimension_key,
        entity_type,
        entity_hash
      ) VALUES (?, ?, ?, ?)
    `,
    [metricDate, dimensionKey, entityType, entityHash]
  )

  return result.affectedRows > 0
}

export async function recordDailyUsageEvent(input: DailyUsageEventInput) {
  await ensureAnalyticsSchema()

  const metricDate = getKstMetricDate()
  const routePath = normalizeRoutePath(input.routePath)
  const method = input.method.trim().toUpperCase().slice(0, 16) || "GET"
  const safeStatusCode = Number.isFinite(input.statusCode)
    ? Math.max(100, Math.min(599, Math.floor(input.statusCode)))
    : 500
  const locale = normalizeLocale(input.locale ?? getLocaleFromRequest(input.request))
  const identity = await resolveIdentity(input.request, input.sessionId)
  const deviceType = getDeviceType(identity.userAgent)
  const statusGroup = getStatusGroup(safeStatusCode)
  const dimensionKey = buildDimensionKey({
    routeKind: input.routeKind,
    routePath,
    method,
    statusCode: safeStatusCode,
    authState: identity.authState,
    deviceType,
    locale,
  })
  const durationMs = Math.max(0, Math.min(60_000, Math.round(input.durationMs)))
  const actorKey = identity.userId
    ? hashValue(`user:${identity.userId}`)
    : identity.visitorHash
  const actorType = identity.userId ? "user" : "visitor"
  const pageViewCount = input.routeKind === "page" ? 1 : 0
  const apiRequestCount = input.routeKind === "api" ? 1 : 0
  const mutationCount = input.routeKind === "api" && method !== "GET" ? 1 : 0
  const errorCount = safeStatusCode >= 400 ? 1 : 0

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()

    await connection.execute(
      `
        INSERT INTO analytics_daily_route_metrics (
          metric_date,
          dimension_key,
          route_kind,
          route_path,
          method,
          status_code,
          status_group,
          auth_state,
          device_type,
          locale,
          request_count,
          unique_visitors,
          unique_users,
          total_duration_ms,
          peak_duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?)
        ON DUPLICATE KEY UPDATE
          request_count = request_count + 1,
          total_duration_ms = total_duration_ms + VALUES(total_duration_ms),
          peak_duration_ms = GREATEST(peak_duration_ms, VALUES(peak_duration_ms)),
          last_seen_at = NOW()
      `,
      [
        metricDate,
        dimensionKey,
        input.routeKind,
        routePath,
        method,
        safeStatusCode,
        statusGroup,
        identity.authState,
        deviceType,
        locale,
        durationMs,
        durationMs,
      ]
    )

    const insertedVisitor = await insertUniqueEntity(
      connection,
      metricDate,
      dimensionKey,
      "visitor",
      identity.visitorHash
    )

    if (insertedVisitor) {
      await connection.execute(
        `
          UPDATE analytics_daily_route_metrics
          SET unique_visitors = unique_visitors + 1
          WHERE metric_date = ?
            AND dimension_key = ?
        `,
        [metricDate, dimensionKey]
      )
    }

    if (identity.userId) {
      const insertedUser = await insertUniqueEntity(
        connection,
        metricDate,
        dimensionKey,
        "user",
        hashValue(`user:${identity.userId}`)
      )

      if (insertedUser) {
        await connection.execute(
          `
            UPDATE analytics_daily_route_metrics
            SET unique_users = unique_users + 1
            WHERE metric_date = ?
              AND dimension_key = ?
          `,
          [metricDate, dimensionKey]
        )
      }
    }

    await connection.execute(
      `
        INSERT INTO analytics_daily_actor_activity (
          metric_date,
          actor_key,
          actor_type,
          user_id,
          auth_state,
          device_type,
          locale,
          page_view_count,
          api_request_count,
          mutation_count,
          error_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          user_id = COALESCE(VALUES(user_id), user_id),
          auth_state = VALUES(auth_state),
          device_type = VALUES(device_type),
          locale = VALUES(locale),
          page_view_count = page_view_count + VALUES(page_view_count),
          api_request_count = api_request_count + VALUES(api_request_count),
          mutation_count = mutation_count + VALUES(mutation_count),
          error_count = error_count + VALUES(error_count),
          last_seen_at = NOW()
      `,
      [
        metricDate,
        actorKey,
        actorType,
        identity.userId,
        identity.authState,
        deviceType,
        locale,
        pageViewCount,
        apiRequestCount,
        mutationCount,
        errorCount,
      ]
    )

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function recordDailyUsageEventSafely(input: DailyUsageEventInput) {
  try {
    await recordDailyUsageEvent(input)
  } catch (error) {
    console.error("Failed to record analytics event:", error)
  }
}
