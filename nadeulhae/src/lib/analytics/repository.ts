/**
 * @fileoverview
 * Analytics data-access layer.
 * Handles page-view logging, API-request tracking, session-based visitor
 * identity resolution, daily-rollup metric recording, and consent-decision
 * persistence. All writes use INSERT … ON DUPLICATE KEY UPDATE within
 * transactions so that concurrent requests produce correct aggregated counts.
 *
 * Architecture decisions
 * -----------------------
 * - Dimension keys are SHA-256 hashes of the composite dimension tuple,
 *   which keeps the primary-key column fixed-width and index-friendly.
 * - Unique entity tracking uses a dedicated table (analytics_daily_unique_entities)
 *   with INSERT IGNORE; a separate UPDATE increments the counter only when a
 *   new row was actually inserted. This avoids SELECT-before-upsert races.
 * - KST (Korea Standard Time) is used for the metric date so that daily
 *   rollups align to Seoul midnight regardless of the server's locale.
 */

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

// ---------------------------------------------------------------------------
// Environment-dependent constants
// ---------------------------------------------------------------------------

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "nadeulhae_auth"
const REQUEST_SESSION_COOKIE_NAME = "nadeulhae_sid"
const TRUST_PROXY_HEADERS = /^(1|true|yes)$/i.test(
  process.env.TRUST_PROXY_HEADERS ?? ""
)

/** Discriminates a request as either a page navigation or an API call. */
type RouteKind = "page" | "api"
/** Whether the requesting actor has an authenticated user session. */
type AuthState = "guest" | "authenticated"
/** Device classification derived from the User-Agent header. */
type DeviceType = "desktop" | "mobile" | "tablet" | "bot" | "unknown"
/** Normalised theme preference, defaulting to "unknown". */
type ThemePreference = "light" | "dark" | "system" | "unknown"
/** Viewport-width bucket used for responsive-analytics grouping. */
type ViewportBucket = "mobile" | "tablet" | "desktop" | "wide" | "unknown"
/**
 * Union of unique-counter columns across the three metric tables.
 * Each variant maps to a specific (table, column) pair so that the generic
 * incrementUniqueCount helper can target the right counter.
 */
type UniqueCountTarget =
  | "routeVisitors"
  | "routeUsers"
  | "pageContextVisitors"
  | "pageContextUsers"
  | "consentVisitors"
  | "consentUsers"

/** Where a consent decision was made: banner widget, sign-up flow, or profile settings. */
export type ConsentDecisionSource = "banner" | "signup" | "profile"

/**
 * Input shape for recordDailyUsageEvent.
 * Carries everything needed to write one row (or increment an existing row) in
 * the route-metrics, page-context-metrics, and actor-activity tables.
 */
export interface DailyUsageEventInput {
  /** The incoming Fetch API Request (used to extract cookies, user-agent, IP). */
  request: Request
  /** "page" for navigations, "api" for fetch/XHR calls. */
  routeKind: RouteKind
  /** Normalised URL path (e.g. "/products/[id]"). */
  routePath: string
  /** HTTP method (GET, POST, PUT, …). */
  method: string
  /** HTTP response status code. */
  statusCode: number
  /** Request duration in milliseconds (clamped to [0, 120_000]). */
  durationMs: number
  /** Optional locale override; falls back to Accept-Language if omitted. */
  locale?: string | null
  /** Optional session ID used for visitor fingerprinting when no auth cookie is present. */
  sessionId?: string | null
  /** UI theme at the time of the event (light / dark / system). */
  theme?: string | null
  /** Viewport-width bucket (mobile / tablet / desktop / wide). */
  viewportBucket?: string | null
  /** Client time-zone IANA identifier. */
  timeZone?: string | null
  /** Referrer hostname, used for acquisition-channel attribution. */
  referrerHost?: string | null
  /** UTM source tag value. */
  utmSource?: string | null
  /** UTM medium tag value. */
  utmMedium?: string | null
  /** UTM campaign tag value. */
  utmCampaign?: string | null
}

/**
 * Input shape for recordDailyConsentDecision.
 * Records one consent-decision event and, when the actor is authenticated,
 * persists the preference to the user's account.
 */
export interface DailyConsentDecisionInput {
  /** The incoming Fetch API Request. */
  request: Request
  /** The consent preference the user chose. */
  preference: AnalyticsConsentPreference
  /** Surface on which the choice was made. */
  decisionSource: ConsentDecisionSource
  /** Optional locale override. */
  locale?: string | null
  /** Optional session ID for visitor fingerprinting. */
  sessionId?: string | null
}

/**
 * Parses a raw Cookie header into a Map of name-value pairs.
 * Handles URL-decoded values, entries without '=', and empty headers gracefully.
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

        return [
          part.slice(0, separatorIndex),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ]
      })
  )
}

/** SHA-256 hex digest used for dimension keys and entity hashes. */
function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

/**
 * Returns today's date in YYYY-MM-DD format (ISO 8601) according to
 * Korea Standard Time (Asia/Seoul). All daily rollups are aligned to
 * Seoul midnight for consistency.
 */
function getKstMetricDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/**
 * Normalises a BCP 47 locale string.
 * - Empty / null → "und" (undetermined)
 * - "ko-*"       → "ko"
 * - "en-*"       → "en"
 * - Otherwise    → first 8 chars, or "und"
 */
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

/**
 * Extracts the preferred locale from the Accept-Language header.
 * Only the first language tag is considered; falls back to "und".
 */
function getLocaleFromRequest(request: Request) {
  const header = request.headers.get("accept-language")
  if (!header) {
    return "und"
  }

  return normalizeLocale(header.split(",")[0]?.trim())
}

/** Trims and truncates a route path (max 191 chars), defaulting to "/" on invalid input. */
function normalizeRoutePath(value: string) {
  const trimmed = value.trim()
  if (!trimmed.startsWith("/")) {
    return "/"
  }

  return trimmed.slice(0, 191)
}

/** Converts a status code to its "x"x group (e.g. 200 → "2xx", 503 → "5xx"). */
function getStatusGroup(statusCode: number) {
  const safeCode = Number.isFinite(statusCode) ? Math.max(100, Math.min(599, statusCode)) : 500
  return `${Math.floor(safeCode / 100)}xx`
}

/**
 * Resolves the client IP address from proxy-aware headers.
 * Respects the TRUST_PROXY_HEADERS env-var — when falsy, always returns
 * "anonymous" to avoid ingesting untrusted header values.
 * Resolution order: cf-connecting-ip → x-real-ip → x-forwarded-for (first) → "anonymous"
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

/**
 * Classifies the user-agent into a DeviceType by pattern matching.
 * Bot/crawler checks come first so that headless browsers used by search
 * engines are not misclassified as desktop.
 */
function getDeviceType(userAgent: string | null): DeviceType {
  const ua = (userAgent ?? "").toLowerCase()
  if (!ua) return "unknown"
  if (/(bot|crawler|spider|preview|slurp)/.test(ua)) return "bot"
  if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/.test(ua)) return "tablet"
  if (/(mobi|iphone|ipod|android.*mobile|windows phone)/.test(ua)) return "mobile"
  return "desktop"
}

/** Normalises a theme string (light / dark / system) into a ThemePreference. */
function normalizeTheme(value: string | null | undefined): ThemePreference {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "light" || normalized === "dark" || normalized === "system") {
    return normalized
  }

  return "unknown"
}

/** Normalises a viewport-bucket string into a ViewportBucket, defaulting to "unknown". */
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

/** Trims and truncates an IANA time-zone identifier (max 48 chars). */
function normalizeTimeZone(value: string | null | undefined) {
  const normalized = (value ?? "").trim()
  if (!normalized) {
    return "unknown"
  }

  return normalized.slice(0, 48)
}

/**
 * Normalises a referrer hostname.
 * Recognises "direct" (no referrer) and "internal" (same-site navigation);
 * otherwise attempts URL parsing and falls back to splitting on /, ?, #.
 */
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

/** Normalises a UTM parameter value: trims, lowercases, collapses whitespace, and truncates. */
function normalizeCampaignValue(value: string | null | undefined, maxLength: number) {
  const normalized = (value ?? "").trim().toLowerCase().replace(/\s+/g, "-")
  return normalized ? normalized.slice(0, maxLength) : "none"
}

/** Clamps a duration value to [0, 120_000] ms, rounding to the nearest integer. */
function normalizeDurationMs(value: number) {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(120_000, Math.round(value)))
    : 0
}

/**
 * Derives a high-level acquisition channel from referrer/UTM data.
 * Priority order: email → paid → social (UTM-based) → campaign → direct → internal → search → social (referrer) → referral.
 * UTM-tagged traffic is classified before raw referrer-based classification so
 * that marketing campaigns always take precedence over organic referrers.
 */
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

/**
 * Resolves the actor's identity from the request: auth token → user ID,
 * session cookie → visitor hash, IP+UA → visitor hash.
 * Also returns the user's analytics-consent flag from the account record
 * when an authenticated session is present.
 */
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

  // Visitor fingerprint: session ID is preferred; fall back to auth token hash,
  // then to IP|UA composite for anonymous / non-session-tracked requests.
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

/**
 * Builds a deterministic SHA-256 hash from the route-metrics dimension tuple.
 * Used as the primary key in analytics_daily_route_metrics.
 * The "route" prefix prevents cross-table collisions with other dimension-key
 * namespaces.
 */
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

/**
 * Builds a deterministic SHA-256 hash from the page-context dimension tuple
 * (includes theme, viewport, time-zone, referrer, UTM params and the derived
 * acquisition channel).
 */
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

/**
 * Builds a deterministic SHA-256 hash from the consent-decision dimension tuple.
 */
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

/**
 * Attempts to insert a unique-entity row (INSERT IGNORE).
 * Returns true when the row was actually inserted (i.e. this entity+dimension
 * combination was seen for the first time today), which the caller uses to
 * decide whether to increment the corresponding counter.
 */
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

/** Maps a UniqueCountTarget variant to the (table_name, column_name) pair it affects. */
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

/** Increments a single unique-counter column on the target metric table. */
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

/**
 * Upserts one row in analytics_daily_route_metrics.
 * On duplicate key: increments request_count, accumulates total_duration_ms,
 * tracks the peak duration, and updates last_seen_at.
 */
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

/**
 * Upserts one row in analytics_daily_page_context_metrics.
 * On duplicate key: increments page_view_count, accumulates total_load_ms,
 * tracks the peak load duration, and updates last_seen_at.
 */
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

/**
 * Upserts one row in analytics_daily_actor_activity.
 * On duplicate key: coalesces user_id (first-seen wins), updates auth/device/locale,
 * accumulates counters, and refreshes last_seen_at.
 */
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

/**
 * Records a daily usage event (page view or API request) inside a database
 * transaction. Writes or increments rows in:
 *   - analytics_daily_route_metrics
 *   - analytics_daily_page_context_metrics  (page events only, when consent = "allow")
 *   - analytics_daily_actor_activity         (when consent = "allow")
 *   - analytics_daily_unique_entities        (when consent = "allow")
 *
 * Consent-gated detailed analytics (unique counters, page context, actor
 * activity) are skipped when the resolved preference is "essential".
 */
export async function recordDailyUsageEvent(input: DailyUsageEventInput) {
  // Ensure tables exist before any writes.
  await ensureAnalyticsSchema()

  const metricDate = getKstMetricDate()
  const routePath = normalizeRoutePath(input.routePath)

  // Normalise HTTP method: uppercase, max 16 chars, default to GET.
  const method = input.method.trim().toUpperCase().slice(0, 16) || "GET"
  const safeStatusCode = Number.isFinite(input.statusCode)
    ? Math.max(100, Math.min(599, Math.floor(input.statusCode)))
    : 500
  // Resolve locale (explicit input wins over Accept-Language), identity, device
  // type, and consent preference in a single pass.
  const locale = normalizeLocale(input.locale ?? getLocaleFromRequest(input.request))
  const identity = await resolveIdentity(input.request, input.sessionId)
  const deviceType = getDeviceType(identity.userAgent)
  const statusGroup = getStatusGroup(safeStatusCode)
  const consentPreference = resolveAnalyticsConsentPreference(
    input.request,
    identity.analyticsAccepted
  )
  // Detailed (non-essential) analytics are gated on "allow".
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
  // Actor key: authenticated users get a deterministic hash scoped to their
  // user ID; anonymous visitors are identified by their session/IP fingerprint.
  const actorKey = identity.userId
    ? hashValue(`user:${identity.userId}`)
    : identity.visitorHash
  const actorType = identity.userId ? "user" : "visitor"
  // Derive per-event counters from the route kind, method, and status code.
  const pageViewCount = input.routeKind === "page" ? 1 : 0
  const apiRequestCount = input.routeKind === "api" ? 1 : 0
  // Non-GET API calls are treated as mutations (POST, PUT, PATCH, DELETE, …).
  const mutationCount = input.routeKind === "api" && method !== "GET" ? 1 : 0
  // HTTP 4xx/5xx responses increment the error counter.
  const errorCount = safeStatusCode >= 400 ? 1 : 0

  // -----------------------------------------------------------------------
  // Transaction: all metric writes happen atomically so that a partial
  // failure does not leave orphaned or inconsistent rows.
  // -----------------------------------------------------------------------
  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()

    // 1. Route metrics — always written (even for "essential" consent level).
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

    // 2. Unique-entity tracking — only with "allow" consent.
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

    // 3. Page-context metrics — page views only, and only with "allow" consent.
    //    Includes theme, viewport, time-zone, referrer, and UTM-derived channel.
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

      // Upsert the page-context aggregate row.
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

      // Track unique visitor per page-context dimension.
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

    // 4. Actor-activity rollup — per-actor daily counters, consent-gated.
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

/**
 * Wraps recordDailyUsageEvent in a try-catch that logs the error instead of
 * propagating it. Safe for use in fire-and-forget contexts (e.g. middleware)
 * where analytics should never crash the request.
 */
export async function recordDailyUsageEventSafely(input: DailyUsageEventInput) {
  try {
    await recordDailyUsageEvent(input)
  } catch (error) {
    console.error("Failed to record analytics event:", error)
  }
}

/**
 * Records a consent-decision event and, for authenticated users, persists
 * the preference to the user account. Writes one row (or increments an
 * existing row) in analytics_daily_consent_metrics and tracks unique
 * visitors/users per consent dimension.
 */
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

  // Persist the consent choice to the user's account when authenticated,
  // so that it survives cookie clearance.
  if (identity.userId) {
    await updateUserAnalyticsConsent({
      userId: identity.userId,
      analyticsAccepted: input.preference === "allow",
    })
  }

  // -----------------------------------------------------------------------
  // Transaction: consent metric + unique entities
  // -----------------------------------------------------------------------
  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()

    // 1. Consent-metric row — upsert increments the decision counter.
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

    // 2. Unique visitor tracking per consent dimension.
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

/**
 * Wraps recordDailyConsentDecision in a try-catch that logs the error instead
 * of propagating it. Safe for fire-and-forget contexts where a consent-logging
 * failure must not interrupt the response.
 */
export async function recordDailyConsentDecisionSafely(
  input: DailyConsentDecisionInput
) {
  try {
    await recordDailyConsentDecision(input)
  } catch (error) {
    console.error("Failed to record analytics consent decision:", error)
  }
}
