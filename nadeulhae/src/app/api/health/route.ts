import { NextResponse } from "next/server"

import { queryRows } from "@/lib/db"
import type { RowDataPacket } from "mysql2"

// Lightweight health/liveness probe for load balancers and monitoring.
// Deliberately NOT wrapped in withApiAnalytics — health polls must not write
// analytics rows or consume the request pipeline.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const startedAt = Date.now()
  let dbUp = false
  try {
    await queryRows<RowDataPacket[]>("SELECT 1")
    dbUp = true
  } catch {
    dbUp = false
  }

  const body = {
    status: dbUp ? "ok" : "degraded",
    db: dbUp ? "up" : "down",
    uptimeSeconds: Math.round(process.uptime()),
    latencyMs: Date.now() - startedAt,
  }

  return NextResponse.json(body, {
    status: dbUp ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}
