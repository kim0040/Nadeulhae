import { NextResponse } from "next/server";
import { mockCalendarData } from "@/data/mockData";

// [BACKEND_LINK]: 실제 MySQL 연동 시 Prisma 등을 사용하여 DB에서 연도/월별 데이터를 조회하도록 구현합니다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // e.g., "2026-03"

  // 시뮬레이션 지연
  await new Promise(resolve => setTimeout(resolve, 500));

  if (month && mockCalendarData[month]) {
    return NextResponse.json({
      month,
      highlightedDays: mockCalendarData[month],
      metadata: {
        dataSource: "Nadeulhae Archives (Historical)",
        lastUpdate: "2026-01-01"
      }
    });
  }

  // 기본값 또는 에러 처리
  return NextResponse.json({
    month: month || "Unknown",
    highlightedDays: [],
    metadata: { dataSource: "Nadeulhae Archives", lastUpdate: "N/A" }
  });
}
