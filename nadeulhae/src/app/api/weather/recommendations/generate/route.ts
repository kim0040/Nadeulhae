import { NextResponse } from "next/server"
import { generateCourse } from "@/lib/course-engine"
import type { CourseTheme, CourseEngineLanguage } from "@/lib/course-types"
import { withApiAnalytics } from "@/lib/analytics/route"

export const runtime = "nodejs"

async function handlePOST(request: Request) {
  let body: { theme?: CourseTheme; language?: CourseEngineLanguage; [key: string]: unknown } = {}
  try {
    body = await request.json()
  } catch {
    // Use defaults
  }

  // Validate theme parameter
  const validThemes: CourseTheme[] = ["balanced", "foodie_focus", "nature_heal", "date_night", "family_fun", "hidden_gem", "rainy_day"]
  const theme = validThemes.includes(body.theme as CourseTheme) ? body.theme as CourseTheme : "balanced"

  // Validate language parameter
  const validLanguages: CourseEngineLanguage[] = ["ko", "en", "zh", "ja"]
  const language = validLanguages.includes(body.language as CourseEngineLanguage) ? body.language as CourseEngineLanguage : "ko"

  const course = await generateCourse({
    timeRange: body.timeRange as string,
    location: body.location as string,
    weatherContext: (body.weatherContext as any) ?? null,
    userProfile: (body.userProfile as any) ?? null,
    userLat: (body.userLat as number) ?? null,
    userLon: (body.userLon as number) ?? null,
    excludeNames: (body.excludeNames as string[]) ?? [],
    theme,
    language,
  })

  return NextResponse.json(course, {
    headers: { "x-nadeulhae-data-mode": "live" },
  })
}

export const POST = withApiAnalytics(handlePOST)
