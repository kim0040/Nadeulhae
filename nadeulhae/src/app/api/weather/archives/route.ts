import { NextResponse } from "next/server"

type ArchiveResponse = {
  month: string
  highlightedDays: number[]
  daySummaries: Array<{
    day: number
    score: number
    sky: string
    tempMin: number
    tempMax: number
    isRecommended: boolean
  }>
  metadata: {
    dataSource: string
    lastUpdate: string
    mode: "live-forecast" | "fallback"
    coverage: string
    note?: string
  }
}

type CachedArchiveEntry = {
  expiry: number
  data: ArchiveResponse
}

const archiveCache = new Map<string, CachedArchiveEntry>()
const ARCHIVE_CACHE_TTL = 5 * 60 * 1000

function normalizeMonth(input?: string | null) {
  if (typeof input === "string" && /^\d{4}-\d{2}$/.test(input)) {
    return input
  }
  return new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  })
}

function toDay(dateValue: string) {
  const normalized = dateValue.replace(/-/g, "")
  if (normalized.length !== 8) return null
  return Number(normalized.slice(6, 8))
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const month = normalizeMonth(url.searchParams.get("month"))
  const lat = url.searchParams.get("lat")
  const lon = url.searchParams.get("lon")
  const cacheKey = `${month}:${lat || "default"}:${lon || "default"}`
  const cached = archiveCache.get(cacheKey)
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json(cached.data, {
      headers: { "x-nadeulhae-data-mode": cached.data.metadata.mode },
    })
  }

  try {
    const forecastUrl = new URL("/api/weather/forecast", url)
    if (lat) forecastUrl.searchParams.set("lat", lat)
    if (lon) forecastUrl.searchParams.set("lon", lon)

    const forecastResponse = await fetch(forecastUrl.toString(), { cache: "no-store" })
    if (!forecastResponse.ok) {
      throw new Error(`Forecast API responded with ${forecastResponse.status}`)
    }

    const forecastData = await forecastResponse.json()
    const daily = Array.isArray(forecastData?.daily) ? forecastData.daily : []
    const monthToken = month.replace("-", "")
    const monthDays = daily.filter((item: any) => String(item?.date || "").startsWith(monthToken))
    const highlightedDays = monthDays
      .filter((item: any) => Number(item?.score) >= 80)
      .map((item: any) => toDay(String(item?.date || "")))
      .filter((day: number | null): day is number => Number.isFinite(day))
      .sort((a: number, b: number) => a - b)

    const daySummaries = monthDays
      .map((item: any) => {
        const day = toDay(String(item?.date || ""))
        if (!Number.isFinite(day)) return null
        const score = Number(item?.score ?? 0)
        return {
          day,
          score,
          sky: String(item?.sky || ""),
          tempMin: Number(item?.tempMin ?? 0),
          tempMax: Number(item?.tempMax ?? 0),
          isRecommended: score >= 80,
        }
      })
      .filter((entry: any) => entry !== null)

    const payload: ArchiveResponse = {
      month,
      highlightedDays,
      daySummaries,
      metadata: {
        dataSource: "기상청 단기·중기 예보 (KMA)",
        lastUpdate: forecastData?.metadata?.lastUpdate || "--:--",
        mode: "live-forecast",
        coverage: "today+10d",
        note: monthDays.length
          ? undefined
          : "선택한 월에는 현재 제공 범위 내 추천일 데이터가 없습니다.",
      },
    }

    archiveCache.set(cacheKey, {
      data: payload,
      expiry: Date.now() + ARCHIVE_CACHE_TTL,
    })

    return NextResponse.json(payload, {
      headers: { "x-nadeulhae-data-mode": "live-forecast" },
    })
  } catch (error) {
    console.error("Archive API fallback:", error)
    const fallback: ArchiveResponse = {
      month,
      highlightedDays: [],
      daySummaries: [],
      metadata: {
        dataSource: "기상청 단기·중기 예보 (KMA)",
        lastUpdate: "--:--",
        mode: "fallback",
        coverage: "today+10d",
        note: "아카이브 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
    }
    return NextResponse.json(fallback, {
      headers: { "x-nadeulhae-data-mode": "fallback" },
    })
  }
}
