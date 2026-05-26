import { NextResponse } from "next/server"
import { generateCourse, type CourseRequest } from "@/lib/course-engine"
import { withApiAnalytics } from "@/lib/analytics/route"

export const runtime = "nodejs"

async function handlePOST(request: Request) {
  let body: CourseRequest = {}
  try {
    body = await request.json()
  } catch {
    // Use defaults
  }

  const course = await generateCourse({
    timeRange: body.timeRange,
    location: body.location,
    weatherContext: body.weatherContext ?? null,
    userProfile: body.userProfile ?? null,
    userLat: body.userLat ?? null,
    userLon: body.userLon ?? null,
    excludeNames: body.excludeNames ?? [],
  })

  return NextResponse.json(course, {
    headers: { "x-nadeulhae-data-mode": "live" },
  })
}

export const POST = withApiAnalytics(handlePOST)
