import { NextResponse } from "next/server";
import { mockInsights } from "@/data/mockData";

export async function GET() {
  // [BACKEND_LINK]: 실제 DB 연동 시 여기서 MySQL 데이터를 조회하여 반환합니다.
  return NextResponse.json(mockInsights, {
    headers: { "x-nadeulhae-data-mode": "mock" },
  });
}
