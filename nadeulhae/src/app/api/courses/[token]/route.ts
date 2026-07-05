import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { withApiAnalytics } from "@/lib/analytics/route"
import { getSavedCourseByShareToken } from "@/lib/saved-courses/repository"

export const runtime = "nodejs"

const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{8,32}$/

async function handleGET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await context.params
    const token = (rawToken ?? "").trim()
    if (!SHARE_TOKEN_RE.test(token)) {
      return NextResponse.json({ error: "Invalid share link." }, { status: 400 })
    }

    const course = await getSavedCourseByShareToken(token)
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 })
    }

    // Public read-only view — never expose the owner id.
    return NextResponse.json(
      {
        title: course.title,
        slots: course.slots,
        weatherSnapshot: course.weatherSnapshot,
        createdAt: course.createdAt,
      },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } }
    )
  } catch (error) {
    console.error("Public saved course GET failed:", error)
    return NextResponse.json({ error: "Failed to load course." }, { status: 500 })
  }
}

export const GET = withApiAnalytics(handleGET)
