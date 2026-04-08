import { createHash } from "node:crypto"

import type { PoolConnection, ResultSetHeader } from "mysql2/promise"

import { findUserBySessionTokenHash, updateUserAnalyticsConsent } from "@/lib/auth/repository"
import { getSessionTokenHash } from "@/lib/auth/session"
import {
  type AnalyticsConsentPreference,
  resolveAnalyticsConsentPreference,
} from "@/lib/analytics/consent"
import { ensureAnalyticsSchema } from "@/lib/analytics/schema"
import { getDbPool } from "@/lib/db"

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "nadeulhae_auth"
const REQUEST_SESSION_COOKIE_NAME = "nadeulhae_sid"
const TRUST_PROXY_HEADERS = /^(1|true|yes)$/i.test(
  process.env.TRUST_PROXY_HEADERS ?? ""
)

type RouteKind = "page" | "api"
type AuthState = "guest" | "authenticated"
type DeviceType = "desktop" | "mobile" | "tablet" | "bot" | "unknown"
type ThemePreference = "light" | "dark" | "system" | "unknown"
type ViewportBucket = "mobile" | "tablet" | "desktop" | "wide" | "unknown"
type UniqueCountTarget =
  | "routeVisitors"
  | "routeUsers"
  | "pageContextVisitors"
  | "pageContextUsers"
  | "consentVisitors"
  | "consentUsers"

export type ConsentDecisionSource = "banner" | "signup" | "profile"

export interface DailyUsageEventInput {
  request: Request
  routeKind: RouteKind
  routePath: string
  method: string
  statusCode: number
  durationMs: number
  locale?: string | null
  sessionId?: string | null
  theme?: string | null
  viewportBucket?: string | null
  timeZone?: string | null
  referrerHost?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
}

export interface DailyConsentDecisionInput {
  request: Request
  preference: AnalyticsConsentPreference
  decisionSource: ConsentDecisionSource
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

function normalizeTheme(value: string | null | undefined): ThemePreference {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "light" || normalized === "dark" || normalized === "system") {
    return normalized
  }

  return "unknown"
}

function normalizeViewportBucket(value: string | null | undefined): ViewportBucket {
  const normalized = (value ?? "").trim().toLowerCase()
  if (
    normalized === "mobile"
    || normalized === "tablet"
    || normalized === "desktop"
    || normalized === "wide"
  ) {
    return normalized
  }

  return "unknown"
}

function normalizeTimeZone(value: string | null | undefined) {
  const normalized = (value ?? "").trim()
  if (!normalized) {
    return "unknown"
  }

  return normalized.slice(0, 48)
}

function normalizeReferrerHost(value: string | null | undefined) {
  const raw = (value ?? "").trim().toLowerCase()
  if (!raw) {
    return "direct"
  }

  if (raw === "direct" || raw === "internal") {
    return raw
  }

  try {
    return new URL(raw).host.slice(0, 191) || "direct"
  } catch {
    return raw.split(/[/?#]/, 1)[0]?.slice(0, 191) || "direct"
  }
}

function normalizeCampaignValue(value: string | null | undefined, maxLength: number) {
  const normalized = (value ?? "").trim().toLowerCase().replace(/\s+/g, "-")
  return normalized ? normalized.slice(0, maxLength) : "none"
}

function normalizeDurationMs(value: number) {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(120_000, Math.round(value)))
    : 0
}

function deriveAcquisitionChannel(input: {
  referrerHost: string
  utmSource: string
  utmMedium: string
}) {
  const medium = input.utmMedium
  const source = input.utmSource
  const referrerHost = input.referrerHost

  if (/(email|newsletter|crm)/.test(medium)) {
    return "email"
  }

  if (/(cpc|ppc|paid|display|banner|ads?|affiliate|sponsored)/.test(medium)) {
    return "paid"
  }

  if (/(social|social-organic|paid-social|social-paid)/.test(medium) || /(facebook|instagram|x\.com|twitter|threads|youtube|tiktok|kakao)/.test(source)) {
    return "social"
  }

  if (medium !== "none") {
    return "campaign"
  }

  if (referrerHost === "direct") {
    return "direct"
  }

  if (referrerHost === "internal") {
    return "internal"
  }

  if (/(google|bing|duckduckgo|naver|daum|yahoo)/.test(referrerHost)) {
    return "search"
  }

  if (/(facebook|instagram|x\.com|twitter|threads|youtube|tiktok|kakao)/.test(referrerHost)) {
    return "social"
  }

  return "referral"
}

async function resolveIdentity(request: Request, fallbackSessionId?: string | null) {
  const cookies = parseCookies(request.headers.get("cookie"))
  const sessionId = fallbackSessionId || cookies.get(REQUEST_SESSION_COOKIE_NAME) || null
  const authToken = cookies.get(AUTH_COOKIE_NAME)
  const userAgent = request.headers.get("user-agent")
  const ipAddress = getClientIp(request)

  let userId: string | null = null
  let authState: AuthState = "guest"
  let analyticsAccepted: boolean | null = null

  if (authToken) {
    const session = await findUserBySessionTokenHash(getSessionTokenHash(authToken))
    if (session?.user?.id) {
      userId = session.user.id
      authState = "authenticated"
      analyticsAccepted = session.user.analyticsAccepted
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
    analyticsAccepted,
  }
}

function buildRouteDimensionKey(input: {
  routeKind: RouteKind
  routePath: string
  method: string
  statusCode: number
  authState: AuthState
  deviceType: DeviceType
  locale: string
}) {
  return hashValue([
    "route",
    input.routeKind,
    input.routePath,
    input.method,
    String(input.statusCode),
    input.authState,
    input.deviceType,
    input.locale,
  ].join("|"))
}

function buildPageContextDimensionKey(input: {
  routePath: string
  authState: AuthState
  deviceType: DeviceType
  locale: string
  theme: ThemePreference
  viewportBucket: ViewportBucket
  timeZone: string
  referrerHost: string
  acquisitionChannel: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
}) {
  return hashValue([
    "page-context",
    input.routePath,
    input.authState,
    input.deviceType,
    input.locale,
    input.theme,
    input.viewportBucket,
    input.timeZone,
    input.referrerHost,
    input.acquisitionChannel,
    input.utmSource,
    input.utmMedium,
    input.utmCampaign,
  ].join("|"))
}

function buildConsentDimensionKey(input: {
  decisionSource: ConsentDecisionSource
  preference: AnalyticsConsentPreference
  authState: AuthState
  deviceType: DeviceType
  locale: string
}) {
  return hashValue([
    "consent",
    input.decisionSource,
    input.preference,
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

function getUniqueCountTargetSql(target: UniqueCountTarget) {
  switch (target) {
    case "routeVisitors":
      return {
        tableName: "analytics_daily_route_metrics",
        columnName: "unique_visitors",
      }
    case "routeUsers":
      return {
        tableName: "analytics_daily_route_metrics",
        columnName: "unique_users",
      }
    case "pageContextVisitors":
      return {
        tableName: "analytics_daily_page_context_metrics",
        columnName: "unique_visitors",
      }
    case "pageContextUsers":
      return {
        tableName: "analytics_daily_page_context_metrics",
        columnName: "unique_users",
      }
    case "consentVisitors":
      return {
        tableName: "analytics_daily_consent_metrics",
        columnName: "unique_visitors",
      }
    case "consentUsers":
      return {
        tableName: "analytics_daily_consent_metrics",
        columnName: "unique_users",
      }
  }
}

async function incrementUniqueCount(
  connection: PoolConnection,
  target: UniqueCountTarget,
  metricDate: string,
  dimensionKey: string
) {
  const { tableName, columnName } = getUniqueCountTargetSql(target)

  await connection.execute(
    `
      UPDATE ${tableName}
      SET ${columnName} = ${columnName} + 1
      WHERE metric_date = ?
        AND dimension_key = ?
    `,
    [metricDate, dimensionKey]
  )
}

async function insertRouteMetrics(
  connection: PoolConnection,
  input: {
    metricDate: string
    dimensionKey: string
    routeKind: RouteKind
    routePath: string
    method: string
    statusCode: number
    statusGroup: string
    authState: AuthState
    deviceType: DeviceType
    locale: string
    durationMs: number
  }
) {
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
      input.metricDate,
      input.dimensionKey,
      input.routeKind,
      input.routePath,
      input.method,
      input.statusCode,
      input.statusGroup,
      input.authState,
      input.deviceType,
      input.locale,
      input.durationMs,
      input.durationMs,
    ]
  )
}

async function insertPageContextMetrics(
  connection: PoolConnection,
  input: {
    metricDate: string
    dimensionKey: string
    routePath: string
    authState: AuthState
    deviceType: DeviceType
    locale: string
    theme: ThemePreference
    viewportBucket: ViewportBucket
    timeZone: string
    referrerHost: string
    acquisitionChannel: string
    utmSource: string
    utmMedium: string
    utmCampaign: string
    loadMs: number
  }
) {
  await connection.execute(
    `
      INSERT INTO analytics_daily_page_context_metrics (
        metric_date,
        dimension_key,
        route_path,
        auth_state,
        device_type,
        locale,
        theme,
        viewport_bucket,
        time_zone,
        referrer_host,
        acquisition_channel,
        utm_source,
        utm_medium,
        utm_campaign,
        page_view_count,
        unique_visitors,
        unique_users,
        total_load_ms,
        peak_load_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?)
      ON DUPLICATE KEY UPDATE
        page_view_count = page_view_count + 1,
        total_load_ms = total_load_ms + VALUES(total_load_ms),
        peak_load_ms = GREATEST(peak_load_ms, VALUES(peak_load_ms)),
        last_seen_at = NOW()
    `,
    [
      input.metricDate,
      input.dimensionKey,
      input.routePath,
      input.authState,
      input.deviceType,
      input.locale,
      input.theme,
      input.viewportBucket,
      input.timeZone,
      input.referrerHost,
      input.acquisitionChannel,
      input.utmSource,
      input.utmMedium,
      input.utmCampaign,
      input.loadMs,
      input.loadMs,
    ]
  )
}

async function insertActorActivity(
  connection: PoolConnection,
  input: {
    metricDate: string
    actorKey: string
    actorType: "user" | "visitor"
    userId: string | null
    authState: AuthState
    deviceType: DeviceType
    locale: string
    pageViewCount: number
    apiRequestCount: number
    mutationCount: number
    errorCount: number
  }
) {
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
      input.metricDate,
      input.actorKey,
      input.actorType,
      input.userId,
      input.authState,
      input.deviceType,
      input.locale,
      input.pageViewCount,
      input.apiRequestCount,
      input.mutationCount,
      input.errorCount,
    ]
  )
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
  const consentPreference = resolveAnalyticsConsentPreference(
    input.request,
    identity.analyticsAccepted
  )
  const allowDetailedAnalytics = consentPreference === "allow"
  const durationMs = normalizeDurationMs(input.durationMs)
  const routeDimensionKey = buildRouteDimensionKey({
    routeKind: input.routeKind,
    routePath,
    method,
    statusCode: safeStatusCode,
    authState: identity.authState,
    deviceType,
    locale,
  })
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

    await insertRouteMetrics(connection, {
      metricDate,
      dimensionKey: routeDimensionKey,
      routeKind: input.routeKind,
      routePath,
      method,
      statusCode: safeStatusCode,
      statusGroup,
      authState: identity.authState,
      deviceType,
      locale,
      durationMs,
    })

    if (allowDetailedAnalytics) {
      const insertedVisitor = await insertUniqueEntity(
        connection,
        metricDate,
        routeDimensionKey,
        "visitor",
        identity.visitorHash
      )

      if (insertedVisitor) {
        await incrementUniqueCount(
          connection,
          "routeVisitors",
          metricDate,
          routeDimensionKey
        )
      }

      if (identity.userId) {
        const insertedUser = await insertUniqueEntity(
          connection,
          metricDate,
          routeDimensionKey,
          "user",
          hashValue(`user:${identity.userId}`)
        )

        if (insertedUser) {
          await incrementUniqueCount(
            connection,
            "routeUsers",
            metricDate,
            routeDimensionKey
          )
        }
      }
    }

    if (input.routeKind === "page" && allowDetailedAnalytics) {
      const theme = normalizeTheme(input.theme)
      const viewportBucket = normalizeViewportBucket(input.viewportBucket)
      const timeZone = normalizeTimeZone(input.timeZone)
      const referrerHost = normalizeReferrerHost(input.referrerHost)
      const utmSource = normalizeCampaignValue(input.utmSource, 80)
      const utmMedium = normalizeCampaignValue(input.utmMedium, 80)
      const utmCampaign = normalizeCampaignValue(input.utmCampaign, 120)
      const acquisitionChannel = deriveAcquisitionChannel({
        referrerHost,
        utmSource,
        utmMedium,
      })
      const pageContextDimensionKey = buildPageContextDimensionKey({
        routePath,
        authState: identity.authState,
        deviceType,
        locale,
        theme,
        viewportBucket,
        timeZone,
        referrerHost,
        acquisitionChannel,
        utmSource,
        utmMedium,
        utmCampaign,
      })

      await insertPageContextMetrics(connection, {
        metricDate,
        dimensionKey: pageContextDimensionKey,
        routePath,
        authState: identity.authState,
        deviceType,
        locale,
        theme,
        viewportBucket,
        timeZone,
        referrerHost,
        acquisitionChannel,
        utmSource,
        utmMedium,
        utmCampaign,
        loadMs: durationMs,
      })

      const insertedContextVisitor = await insertUniqueEntity(
        connection,
        metricDate,
        pageContextDimensionKey,
        "visitor",
        identity.visitorHash
      )

      if (insertedContextVisitor) {
        await incrementUniqueCount(
          connection,
          "pageContextVisitors",
          metricDate,
          pageContextDimensionKey
        )
      }

      if (identity.userId) {
        const insertedContextUser = await insertUniqueEntity(
          connection,
          metricDate,
          pageContextDimensionKey,
          "user",
          hashValue(`user:${identity.userId}`)
        )

        if (insertedContextUser) {
          await incrementUniqueCount(
            connection,
            "pageContextUsers",
            metricDate,
            pageContextDimensionKey
          )
        }
      }
    }

    if (allowDetailedAnalytics) {
      await insertActorActivity(connection, {
        metricDate,
        actorKey,
        actorType,
        userId: identity.userId,
        authState: identity.authState,
        deviceType,
        locale,
        pageViewCount,
        apiRequestCount,
        mutationCount,
        errorCount,
      })
    }

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

export async function recordDailyConsentDecision(input: DailyConsentDecisionInput) {
  await ensureAnalyticsSchema()

  const metricDate = getKstMetricDate()
  const locale = normalizeLocale(input.locale ?? getLocaleFromRequest(input.request))
  const identity = await resolveIdentity(input.request, input.sessionId)
  const deviceType = getDeviceType(identity.userAgent)
  const dimensionKey = buildConsentDimensionKey({
    decisionSource: input.decisionSource,
    preference: input.preference,
    authState: identity.authState,
    deviceType,
    locale,
  })

  if (identity.userId) {
    await updateUserAnalyticsConsent({
      userId: identity.userId,
      analyticsAccepted: input.preference === "allow",
    })
  }

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()

    await connection.execute(
      `
        INSERT INTO analytics_daily_consent_metrics (
          metric_date,
          dimension_key,
          decision_source,
          consent_state,
          auth_state,
          device_type,
          locale,
          decision_count,
          unique_visitors,
          unique_users
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 0)
        ON DUPLICATE KEY UPDATE
          decision_count = decision_count + 1,
          last_seen_at = NOW()
      `,
      [
        metricDate,
        dimensionKey,
        input.decisionSource,
        input.preference,
        identity.authState,
        deviceType,
        locale,
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
      await incrementUniqueCount(connection, "consentVisitors", metricDate, dimensionKey)
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
        await incrementUniqueCount(connection, "consentUsers", metricDate, dimensionKey)
      }
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function recordDailyConsentDecisionSafely(
  input: DailyConsentDecisionInput
) {
  try {
    await recordDailyConsentDecision(input)
  } catch (error) {
    console.error("Failed to record analytics consent decision:", error)
  }
}
