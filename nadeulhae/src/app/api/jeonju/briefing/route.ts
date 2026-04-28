import { NextRequest, NextResponse } from "next/server"
import { withApiAnalytics } from "@/lib/analytics/route"
import { ensureJeonjuBriefingSchema } from "@/lib/jeonju-briefing/schema"
import { generateJeonjuBriefing } from "@/lib/jeonju-briefing/service"
import type { JeonjuBriefingLocale } from "@/lib/jeonju-briefing/service"

export const runtime = "nodejs"

export const GET = withApiAnalytics(async (request: NextRequest) => {
  try {
    await ensureJeonjuBriefingSchema()
  } catch (schemaError) {
    console.error("[api/jeonju/briefing] Schema initialization failed:", schemaError)
    // Continue anyway - generation will handle errors
  }

  const { searchParams } = new URL(request.url)
  const localeParam = searchParams.get("locale")
  const locale: JeonjuBriefingLocale =
    localeParam === "en" ? "en" : "ko"

  const force = searchParams.get("force") === "true"

  try {
    const result = await generateJeonjuBriefing({
      locale,
      forceRefresh: force,
    })

    return NextResponse.json({
      success: true,
      fromCache: result.fromCache,
      data: result.data,
    })
  } catch (error) {
    console.error("[api/jeonju/briefing] Unhandled error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate briefing",
      },
      { status: 500 }
    )
  }
})
