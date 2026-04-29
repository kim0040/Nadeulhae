import { NextRequest, NextResponse } from "next/server"
import { generateOutlook, type OutlookWeatherData } from "@/lib/outlook"

const LOCALES = ["ko", "en", "zh", "ja"] as const

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get("locale") ?? "ko"
  if (!LOCALES.includes(locale as any)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 })
  }

  // Parse weather data from query params
  const temp = parseFloat(searchParams.get("temp") ?? "0")
  const humidity = parseFloat(searchParams.get("humidity") ?? "0")
  const wind = parseFloat(searchParams.get("wind") ?? "0")
  const sky = searchParams.get("sky") ?? ""
  const pty = parseInt(searchParams.get("pty") ?? "0")
  const pm10 = parseInt(searchParams.get("pm10") ?? "0")
  const pm25 = parseInt(searchParams.get("pm25") ?? "0")
  const khai = parseInt(searchParams.get("khai") ?? "0")
  const score = parseInt(searchParams.get("score") ?? "0")
  const status = searchParams.get("status") ?? ""
  const region = searchParams.get("region") ?? ""
  const isRain = searchParams.get("isRain") === "true"
  const hasWarning = searchParams.get("hasWarning") === "true"
  const bulletinSummary = searchParams.get("bulletinSummary") ?? ""

  if (!region) {
    return NextResponse.json({ error: "region required" }, { status: 400 })
  }

  const data: OutlookWeatherData = {
    temp, humidity, wind, sky, pty, pm10, pm25, khai, score, status, region, isRain, hasWarning, bulletinSummary,
  }

  try {
    const outlook = await generateOutlook(data, locale)
    return NextResponse.json({ outlook, locale })
  } catch (error) {
    console.error("[outlook] API error:", error)
    return NextResponse.json({ error: "Failed to generate outlook" }, { status: 500 })
  }
}
