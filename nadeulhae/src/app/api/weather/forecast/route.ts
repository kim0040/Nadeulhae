import { NextResponse } from "next/server"
import {
  HOME_REGION,
  dfsToGrid,
  getMidForecastBase,
  getStableForecastSeed,
  resolveRegionProfile,
} from "@/lib/weather-utils"

type CacheEntry<T> = {
  data: T
  lastUpdate: number
}

const forecastCache = new Map<string, CacheEntry<unknown>>()
const rateLimitMap = new Map<string, { count: number; lastReset: number }>()

const CACHE_DURATION = 3 * 60 * 60 * 1000
const RATE_LIMIT_WINDOW = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 30

function getCachedForecast<T>(key: string) {
  const cached = forecastCache.get(key)
  if (!cached) return null
  if (Date.now() - cached.lastUpdate > CACHE_DURATION) return null
  return cached.data as T
}

async function fetchJsonSafely(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return null
    const text = await response.text()
    if (!text || text.trim().startsWith("<")) return null
    return JSON.parse(text)
  } catch (error) {
    console.error("Forecast fetch failed:", error)
    return null
  }
}

function calculateScore(temp: number, sky: string) {
  let score = 100

  if (sky.includes("비") || sky.includes("눈") || sky.includes("소나기")) return 10
  if (sky.includes("흐림")) score -= 20
  else if (sky.includes("구름")) score -= 10

  if (temp < 10 || temp > 31) score -= 40
  else if ((temp >= 10 && temp <= 11) || (temp >= 29 && temp <= 31)) score -= 20
  else if ((temp >= 12 && temp <= 16) || (temp >= 25 && temp <= 28)) score -= 10

  return Math.max(10, Math.min(100, Math.round(score)))
}

function createStableFallbackForecast(startDate: Date, index: number) {
  const date = new Date(startDate)
  date.setDate(date.getDate() + index)
  const dateKey = date.toISOString().split("T")[0].replace(/-/g, "")
  const seed = getStableForecastSeed(dateKey)
  const baseTemp = 16 + (seed % 7)
  const skyOptions = ["맑음", "구름많음", "맑음", "흐림", "맑음"]
  const sky = skyOptions[seed % skyOptions.length]

  return {
    date: dateKey,
    tempMin: baseTemp - 5,
    tempMax: baseTemp + 5,
    sky,
    precipChance: sky.includes("비") ? 60 : 10,
    precipAmount: sky.includes("비") ? "1mm 미만" : "0mm",
    snowAmount: sky.includes("눈") ? "1cm 미만" : "0cm",
    score: calculateScore(baseTemp + 5, sky),
    isMock: true,
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const lat = url.searchParams.get("lat")
  const lon = url.searchParams.get("lon")
  const userLat = lat ? Number(lat) : null
  const userLon = lon ? Number(lon) : null

  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1"
  const now = Date.now()
  const rateData = rateLimitMap.get(ip)

  if (!rateData) {
    rateLimitMap.set(ip, { count: 1, lastReset: now })
  } else if (now - rateData.lastReset > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, lastReset: now })
  } else {
    rateData.count += 1
    if (rateData.count > MAX_REQUESTS_PER_WINDOW) {
      return NextResponse.json({ error: "Too Many Requests. API Rate Limit Exceeded." }, { status: 429 })
    }
  }

  const kmaKey = process.env.KMA_API_KEY
  if (!kmaKey) {
    return NextResponse.json({ error: "KMA Key Missing" }, { status: 500 })
  }

  const profile = resolveRegionProfile(userLat, userLon)
  const grid = userLat != null && userLon != null
    ? dfsToGrid(userLat, userLon)
    : {
        nx: Number(process.env.KMA_NX ?? 63),
        ny: Number(process.env.KMA_NY ?? 89),
      }

  const cacheKey = `${grid.nx}_${grid.ny}_${profile.key}`
  const cached = getCachedForecast<any>(cacheKey)
  if (cached) {
    return NextResponse.json(cached)
  }

  const { forecastDate, tmFc } = getMidForecastBase()
  const villageUrl = `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst?authKey=${kmaKey}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${forecastDate}&base_time=0500&nx=${grid.nx}&ny=${grid.ny}`
  const midLandUrl = `https://apihub.kma.go.kr/api/typ02/openApi/MidFcstInfoService/getMidLandFcst?authKey=${kmaKey}&pageNo=1&numOfRows=10&dataType=JSON&regId=${profile.forecastLandReg}&tmFc=${tmFc}`
  const midTempUrl = `https://apihub.kma.go.kr/api/typ02/openApi/MidFcstInfoService/getMidTa?authKey=${kmaKey}&pageNo=1&numOfRows=10&dataType=JSON&regId=${profile.forecastTempReg}&tmFc=${tmFc}`

  const [villageData, midLandData, midTempData] = await Promise.all([
    fetchJsonSafely(villageUrl),
    fetchJsonSafely(midLandUrl),
    fetchJsonSafely(midTempUrl),
  ])

  const dailyForecasts: Array<{
    date: string
    tempMin: number
    tempMax: number
    sky: string
    precipChance: number
    precipAmount: string
    snowAmount: string
    score: number
    isMock?: boolean
  }> = []
  const groupedDaily: Record<string, { temps: number[]; skies: number[]; ptys: number[]; pops: number[]; pcps: string[]; snos: string[] }> = {}

  const villageItems = villageData?.response?.body?.items?.item
  if (Array.isArray(villageItems)) {
    for (const item of villageItems) {
      const dateKey = item.fcstDate
      if (!groupedDaily[dateKey]) {
        groupedDaily[dateKey] = { temps: [], skies: [], ptys: [], pops: [], pcps: [], snos: [] }
      }
      if (item.category === "TMP") groupedDaily[dateKey].temps.push(Number(item.fcstValue))
      if (item.category === "SKY") groupedDaily[dateKey].skies.push(Number(item.fcstValue))
      if (item.category === "PTY") groupedDaily[dateKey].ptys.push(Number(item.fcstValue))
      if (item.category === "POP") groupedDaily[dateKey].pops.push(Number(item.fcstValue))
      if (item.category === "PCP" && item.fcstValue) groupedDaily[dateKey].pcps.push(String(item.fcstValue))
      if (item.category === "SNO" && item.fcstValue) groupedDaily[dateKey].snos.push(String(item.fcstValue))
    }

    for (const dateKey of Object.keys(groupedDaily).sort()) {
      const bucket = groupedDaily[dateKey]
      if (!bucket.temps.length) continue
      const pty = Math.max(...bucket.ptys, 0)
      const averageSky = bucket.skies.length
        ? bucket.skies.reduce((sum, value) => sum + value, 0) / bucket.skies.length
        : 1
      const sky =
        pty > 0
          ? pty === 3
            ? "눈"
            : pty === 4
              ? "소나기"
              : "비"
          : averageSky <= 1.5
            ? "맑음"
            : averageSky <= 3.3
              ? "구름많음"
              : "흐림"

      const tempMin = Math.min(...bucket.temps)
      const tempMax = Math.max(...bucket.temps)
      const precipChance = bucket.pops.length ? Math.max(...bucket.pops) : pty > 0 ? 60 : 0
      const precipAmount = bucket.pcps.find((value) => value && value !== "강수없음") || "0mm"
      const snowAmount = bucket.snos.find((value) => value && value !== "적설없음") || "0cm"

      dailyForecasts.push({
        date: dateKey,
        tempMin,
        tempMax,
        sky,
        precipChance,
        precipAmount,
        snowAmount,
        score: calculateScore(tempMax, sky),
      })
    }
  }

  const midLandItems = midLandData?.response?.body?.items?.item
  const midTempItems = midTempData?.response?.body?.items?.item
  const midLand = Array.isArray(midLandItems) ? midLandItems[0] : midLandItems
  const midTemp = Array.isArray(midTempItems) ? midTempItems[0] : midTempItems

  if (midLand && midTemp) {
    for (let index = 3; index <= 10; index += 1) {
      const date = new Date()
      date.setDate(date.getDate() + index)
      const dateKey = date.toISOString().split("T")[0].replace(/-/g, "")
      if (dailyForecasts.some((item) => item.date === dateKey)) continue

      const sky = String(midLand[`wf${index}Am`] || midLand[`wf${index}`] || midLand[`wf${index}Pm`] || "맑음")
      const tempMin = Number(midTemp[`taMin${index}`])
      const tempMax = Number(midTemp[`taMax${index}`])
      const rnAm = Number(midLand[`rnSt${index}Am`])
      const rnPm = Number(midLand[`rnSt${index}Pm`])
      const precipChanceCandidates = [rnAm, rnPm].filter(Number.isFinite)
      const precipChance = precipChanceCandidates.length
        ? Math.max(...precipChanceCandidates)
        : sky.includes("비") || sky.includes("소나기")
          ? 60
          : 10

      if (Number.isFinite(tempMin) && Number.isFinite(tempMax)) {
        dailyForecasts.push({
          date: dateKey,
          tempMin,
          tempMax,
          sky,
          precipChance,
          precipAmount: precipChance > 0 ? `${precipChance}%` : "0mm",
          snowAmount: sky.includes("눈") ? "가능성 있음" : "0cm",
          score: calculateScore(tempMax, sky),
        })
      }
    }
  }

  const today = new Date()
  while (dailyForecasts.length < 11) {
    dailyForecasts.push(createStableFallbackForecast(today, dailyForecasts.length))
  }

  const finalResult = {
    location: userLat != null && userLon != null ? profile.displayName : HOME_REGION.displayName,
    daily: dailyForecasts.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 11),
    metadata: {
      dataSource: "기상청",
      lastUpdate: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      info: dailyForecasts.some((day) => day.isMock) ? "Partial data generated" : "Real-time sync",
    },
  }

  forecastCache.set(cacheKey, { data: finalResult, lastUpdate: now })
  return NextResponse.json(finalResult)
}
