import { NextResponse } from "next/server";
import { mockInsights } from "@/data/mockData";
import { withApiAnalytics } from "@/lib/analytics/route";

// This GET takes no request argument; without an explicit dynamic signal Next
// could statically evaluate/cache it once. force-dynamic keeps it request-time
// so that when the [BACKEND_LINK] real DB read lands it won't serve stale data.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGET() {
  // [BACKEND_LINK]: 실제 DB 연동 시 여기서 MySQL 데이터를 조회하여 반환합니다.
  return NextResponse.json(mockInsights, {
    headers: { "x-nadeulhae-data-mode": "mock" },
  });
}

export const GET = withApiAnalytics(handleGET)
