import { NextResponse } from "next/server";
import { mockCourse } from "@/data/mockData";

export async function POST(request: Request) {
  const body = await request.json();
  console.log("Generating course for:", body);

  // [BACKEND_LINK]: 실제 고도화 시 여기서 LLM(GPT/Gemini) API를 호출합니다.
  // 시뮬레이션 지연 (2초)
  await new Promise(resolve => setTimeout(resolve, 2000));

  return NextResponse.json(mockCourse);
}
