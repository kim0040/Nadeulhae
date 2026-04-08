import { NextResponse } from "next/server";
import { mockTrends } from "@/data/mockData";
import { withApiAnalytics } from "@/lib/analytics/route";

async function handleGET() {
  // [BACKEND_LINK]: 실제 DB 연동 시 여기서 실시간 트렌드 데이터를 조회하여 반환합니다.
  return NextResponse.json(mockTrends, {
    headers: { "x-nadeulhae-data-mode": "mock" },
  });
}

export const GET = withApiAnalytics(handleGET)
