import { NextResponse } from "next/server";
import { mockCourse } from "@/data/mockData";
import { withApiAnalytics } from "@/lib/analytics/route";

async function handlePOST(request: Request) {
  await request.json();

  // [BACKEND_LINK]: 실제 고도화 시 여기서 LLM(GPT/Gemini) API를 호출합니다.
  return NextResponse.json(mockCourse, {
    headers: { "x-nadeulhae-data-mode": "mock" },
  });
}

export const POST = withApiAnalytics(handlePOST)
