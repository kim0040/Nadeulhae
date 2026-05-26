import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUserFromRequest } from "@/lib/auth/session"
import { executeStatement, queryRows } from "@/lib/db"
import { withApiAnalytics } from "@/lib/analytics/route"
import type { RowDataPacket } from "mysql2"

export const runtime = "nodejs"

interface UsageRow extends RowDataPacket {
  request_count: number
}

async function handleGET(request: NextRequest) {
  try {
    // 1. Resolve actor key: try authenticated user, fallback to IP address hash
    const user = await getAuthenticatedUserFromRequest(request)
    let actorKey = ""
    
    if (user?.id) {
      actorKey = `user_${user.id}`
    } else {
      const forwarded = request.headers.get("x-forwarded-for")
      const clientIp = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1"
      actorKey = `ip_${clientIp}`
    }

    // 2. Ensure the API usage table exists (self-migrating)
    await executeStatement(`
      CREATE TABLE IF NOT EXISTS kakao_api_usage_daily (
        metric_date DATE NOT NULL,
        actor_key VARCHAR(64) NOT NULL,
        request_count INT UNSIGNED NOT NULL DEFAULT 0,
        last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (metric_date, actor_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // 3. Query the actor's usage for today
    const rows = await queryRows<UsageRow[]>(
      `SELECT request_count FROM kakao_api_usage_daily WHERE metric_date = CURRENT_DATE() AND actor_key = ?`,
      [actorKey]
    )

    const currentCount = rows[0]?.request_count ?? 0
    const DAILY_LIMIT = 50 // Limit: 50 loads per user/IP per day

    if (currentCount >= DAILY_LIMIT) {
      console.warn(`[kakao-config] Quota exceeded for ${actorKey}: ${currentCount}/${DAILY_LIMIT}`)
      return NextResponse.json(
        { 
          error: "Daily Kakao Map API quota exceeded for your session.", 
          kakaoKey: null,
          limitExceeded: true 
        },
        { status: 429 }
      )
    }

    // 4. Increment usage in the database
    await executeStatement(`
      INSERT INTO kakao_api_usage_daily (metric_date, actor_key, request_count, last_used_at)
      VALUES (CURRENT_DATE(), ?, 1, NOW())
      ON DUPLICATE KEY UPDATE request_count = request_count + 1, last_used_at = NOW()
    `, [actorKey])

    // 5. Retrieve key from environment
    const key = process.env.KAKAO_JS_KEY
    if (!key) {
      console.error("[kakao-config] KAKAO_JS_KEY is not defined in environment variables.")
      return NextResponse.json(
        { error: "Map configuration not available" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      kakaoKey: key,
      usageCount: currentCount + 1,
      dailyLimit: DAILY_LIMIT
    })
  } catch (error) {
    console.error("[kakao-config] Failed to resolve Kakao JS Key:", error)
    return NextResponse.json(
      { error: "Failed to load map configuration" },
      { status: 500 }
    )
  }
}

export const GET = withApiAnalytics(handleGET)
