import { NextRequest } from "next/server"
import { getAuthenticatedUserFromRequest } from "@/lib/auth/session"
import { executeStatement } from "@/lib/db"
import { withApiAnalytics } from "@/lib/analytics/route"
import {
  createAuthJsonResponse,
  validateSameOriginRequest,
} from "@/lib/auth/request-security"
import { getTrustedClientIp } from "@/lib/request/client-ip"
import { createBlindIndex } from "@/lib/security/data-protection"

export const runtime = "nodejs"

const KAKAO_MAP_DAILY_LIMIT = 50
const KAKAO_USAGE_ACTOR_CONTEXT = "kakao-map-usage"

declare global {
  var __nadeulhaeKakaoUsageSchemaPromise: Promise<void> | undefined
}

function ensureKakaoUsageSchema() {
  if (!globalThis.__nadeulhaeKakaoUsageSchemaPromise) {
    globalThis.__nadeulhaeKakaoUsageSchemaPromise = executeStatement(`
      CREATE TABLE IF NOT EXISTS kakao_api_usage_daily (
        metric_date DATE NOT NULL,
        actor_key VARCHAR(64) NOT NULL,
        request_count INT UNSIGNED NOT NULL DEFAULT 0,
        last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (metric_date, actor_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).then(() => undefined).catch((error) => {
      // Allow a later request to retry schema initialization after a transient DB failure.
      globalThis.__nadeulhaeKakaoUsageSchemaPromise = undefined
      throw error
    })
  }

  return globalThis.__nadeulhaeKakaoUsageSchemaPromise
}

async function handleGET(request: NextRequest) {
  try {
    const requestViolation = validateSameOriginRequest(request)
    if (requestViolation) {
      return requestViolation
    }

    // Kakao JavaScript keys are intentionally delivered to browsers. Domain
    // restrictions in Kakao Developers remain the primary key protection;
    // this endpoint prevents cross-site use and limits abusive page loads.
    const key = process.env.KAKAO_JS_KEY
    if (!key) {
      console.error("[kakao-config] KAKAO_JS_KEY is not defined in environment variables.")
      return createAuthJsonResponse(
        { error: "Map configuration not available" },
        { status: 500 }
      )
    }

    // Resolve an opaque quota key: authenticated user first, otherwise a
    // blinded proxy-verified IP. Never persist raw visitor addresses.
    const user = await getAuthenticatedUserFromRequest(request)
    const actorKey = user?.id
      ? `user_${user.id}`
      // HMAC-SHA256 is 64 hex characters, exactly fitting actor_key VARCHAR(64).
      : createBlindIndex(getTrustedClientIp(request.headers), KAKAO_USAGE_ACTOR_CONTEXT)

    await ensureKakaoUsageSchema()

    // The conditional upsert is atomic. A SELECT-then-increment race could
    // otherwise let concurrent requests run beyond the daily ceiling.
    const result = await executeStatement(`
      INSERT INTO kakao_api_usage_daily (metric_date, actor_key, request_count, last_used_at)
      VALUES (CURRENT_DATE(), ?, 1, NOW())
      ON DUPLICATE KEY UPDATE
        request_count = IF(request_count < ?, request_count + 1, request_count),
        last_used_at = IF(request_count < ?, NOW(), last_used_at)
    `, [actorKey, KAKAO_MAP_DAILY_LIMIT, KAKAO_MAP_DAILY_LIMIT])

    if (result.affectedRows === 0) {
      return createAuthJsonResponse(
        {
          error: "Daily Kakao Map API quota exceeded for your session.",
          kakaoKey: null,
          limitExceeded: true,
          dailyLimit: KAKAO_MAP_DAILY_LIMIT,
        },
        { status: 429 }
      )
    }

    return createAuthJsonResponse({
      kakaoKey: key,
      dailyLimit: KAKAO_MAP_DAILY_LIMIT,
    })
  } catch (error) {
    console.error("[kakao-config] Failed to resolve Kakao JS Key:", error)
    return createAuthJsonResponse(
      { error: "Failed to load map configuration" },
      { status: 500 }
    )
  }
}

export const GET = withApiAnalytics(handleGET)
