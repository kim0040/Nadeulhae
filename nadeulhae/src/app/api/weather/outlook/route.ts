import { NextRequest, NextResponse } from "next/server"
import { generateOutlook, type OutlookWeatherData } from "@/lib/outlook"

const LOCALES = ["ko", "en", "zh", "ja"] as const

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get("locale") ?? "ko"
  if (!LOCALES.includes(locale as (typeof LOCALES)[number])) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 })
  }

  // Parse weather data from query params. Coerce non-numeric input to the
  // default (0) so a bad param like temp=abc can't leak NaN into the outlook
  // generator.
  const numParam = (key: string, integer = false) => {
    const parsed = integer
      ? parseInt(searchParams.get(key) ?? "0", 10)
      : parseFloat(searchParams.get(key) ?? "0")
    return Number.isFinite(parsed) ? parsed : 0
  }
  const temp = numParam("temp")
  const humidity = numParam("humidity")
  const wind = numParam("wind")
  const sky = searchParams.get("sky") ?? ""
  const pty = numParam("pty", true)
  const pm10 = numParam("pm10", true)
  const pm25 = numParam("pm25", true)
  const khai = numParam("khai", true)
  const score = numParam("score", true)
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
