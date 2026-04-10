import { NextResponse } from "next/server"
import {
  HOME_REGION,
  getCurrentNowcastBase,
  getMidForecastBase,
  getVillageForecastBase,
  getStableForecastSeed,
  mergeRegionProfileWithForecastLocation,
  resolveForecastGrid,
  resolveRegionProfile,
  getKstCompactDate,
  getNextUpdateTimestamp,
} from "@/lib/weather-utils"
import { withApiAnalytics } from "@/lib/analytics/route"
import { resolveNearestForecastLocationPoint } from "@/lib/forecast-location/repository"
import { recordLocationUsageProofSafely } from "@/lib/privacy/location-proof"
import { attachSessionCookie, getOrCreateSessionId } from "@/lib/request-session"

type CacheEntry<T> = {
  data: T
  lastUpdate: number
}

type UserCacheEntry<T> = {
  data: T
  expiry: number
}

const villageCache = new Map<string, CacheEntry<Record<string, unknown>>>()
const midCache = new Map<string, CacheEntry<Record<string, unknown>>>()
const ultraCache = new Map<string, CacheEntry<Record<string, unknown>>>()
const rateLimitMap = new Map<string, { count: number; lastReset: number }>()
const MAX_FORECAST_CACHE_KEYS = 500
const forecastResponseCache = new Map<string, UserCacheEntry<Record<string, unknown>>>()

const CACHE_DURATION = 3 * 60 * 60 * 1000
const MID_CACHE_DURATION = 12 * 60 * 60 * 1000
const ULTRA_CACHE_DURATION = 60 * 60 * 1000
const USER_RESPONSE_CACHE_DURATION = 5 * 60 * 1000
const RATE_LIMIT_WINDOW = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 30
const MAX_RATE_LIMIT_ENTRIES = 5000
const CACHE_SWEEP_INTERVAL = 5 * 60 * 1000
let lastMaintenanceSweep = 0

/**
 * Smart cache check aligned with update cycles
 */
function getSmartCachedValue<T>(map: Map<string, CacheEntry<T>>, key: string, type: 'village' | 'mid', defaultTtl: number) {
  const entry = map.get(key)
  if (!entry) return null
  const now = Date.now()
  if (now - entry.lastUpdate > defaultTtl * 2) return null
  const nextUpdate = getNextUpdateTimestamp(type, new Date(entry.lastUpdate))
  if (now >= nextUpdate) return null
  return entry.data
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  const realIp = request.headers.get("x-real-ip")
  return realIp?.trim() || "127.0.0.1"
}

function cleanupLastUpdateCache<T>(map: Map<string, CacheEntry<T>>, maxAgeMs: number, now: number) {
  for (const [key, value] of map.entries()) {
    if (now - value.lastUpdate > maxAgeMs) {
      map.delete(key)
    }
  }
}

function cleanupExpiringCache<T extends { expiry: number }>(map: Map<string, T>, now: number) {
  for (const [key, value] of map.entries()) {
    if (value.expiry <= now) {
      map.delete(key)
    }
  }
}

function cleanupRateLimitMap(map: Map<string, { count: number; lastReset: number }>, windowMs: number, now: number, maxEntries = 5000) {
  for (const [key, value] of map.entries()) {
    if (now - value.lastReset > windowMs * 5) {
      map.delete(key)
    }
  }
  if (map.size > maxEntries) {
    const overflow = map.size - maxEntries
    let removed = 0
    for (const key of map.keys()) {
      map.delete(key)
      removed++
      if (removed >= overflow) break
    }
  }
}

function runMaintenanceSweepIfNeeded() {
  const now = Date.now()
  if (now - lastMaintenanceSweep < CACHE_SWEEP_INTERVAL) {
    return
  }

  cleanupLastUpdateCache(villageCache, CACHE_DURATION * 3, now)
  cleanupLastUpdateCache(midCache, MID_CACHE_DURATION * 3, now)
  cleanupLastUpdateCache(ultraCache, ULTRA_CACHE_DURATION * 3, now)
  cleanupExpiringCache(forecastResponseCache, now)
  cleanupRateLimitMap(rateLimitMap, RATE_LIMIT_WINDOW, now, MAX_RATE_LIMIT_ENTRIES)

  lastMaintenanceSweep = now
}

async function fetchVillageData(nx: number, ny: number, serviceKey: string) {
  const { baseDate, baseTime } = getVillageForecastBase()
  const cacheKey = `${nx}_${ny}_${baseDate}_${baseTime}`
  const cached = getSmartCachedValue(villageCache, cacheKey, 'village', CACHE_DURATION)
  if (cached) return cached

  const url = `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst?authKey=${serviceKey}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`
  const data = await fetchJsonSafely(url)
  if (data) villageCache.set(cacheKey, { data, lastUpdate: Date.now() })
  return data
}

async function fetchUltraForecastData(nx: number, ny: number, serviceKey: string) {
  const { baseDate, baseTime } = getCurrentNowcastBase()
  const cacheKey = `${nx}_${ny}_${baseDate}_${baseTime}`
  const cached = getSmartCachedValue(ultraCache, cacheKey, 'village', ULTRA_CACHE_DURATION)
  if (cached) return cached

  const url = `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtFcst?authKey=${serviceKey}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`
  const data = await fetchJsonSafely(url)
  if (data) ultraCache.set(cacheKey, { data, lastUpdate: Date.now() })
  return data
}

async function fetchMidData(profile: any, serviceKey: string) {
  const { tmFc } = getMidForecastBase()
  const cacheKey = `${profile.key}_${tmFc}`
  const cached = getSmartCachedValue(midCache, cacheKey, 'mid', MID_CACHE_DURATION)
  if (cached) return cached

  const midLandUrl = `https://apihub.kma.go.kr/api/typ02/openApi/MidFcstInfoService/getMidLandFcst?authKey=${serviceKey}&pageNo=1&numOfRows=10&dataType=JSON&regId=${profile.forecastLandReg}&tmFc=${tmFc}`
  const midTempUrl = `https://apihub.kma.go.kr/api/typ02/openApi/MidFcstInfoService/getMidTa?authKey=${serviceKey}&pageNo=1&numOfRows=10&dataType=JSON&regId=${profile.forecastTempReg}&tmFc=${tmFc}`

  const [midLand, midTemp] = await Promise.all([
    fetchJsonSafely(midLandUrl),
    fetchJsonSafely(midTempUrl),
  ])

  const result = { midLand, midTemp, tmFc }
  if (midLand && midTemp) midCache.set(cacheKey, { data: result, lastUpdate: Date.now() })
  return result
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

function getKstNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
}

function getKstTimeLabel(date: Date) {
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  return `${hour}${minute}`
}

async function handleGET(request: Request) {
  runMaintenanceSweepIfNeeded()
  const url = new URL(request.url)
  const lat = url.searchParams.get("lat")
  const lon = url.searchParams.get("lon")
  const parsedLat = lat ? Number(lat) : null
  const parsedLon = lon ? Number(lon) : null
  const userLat = Number.isFinite(parsedLat) ? parsedLat : null
  const userLon = Number.isFinite(parsedLon) ? parsedLon : null
  const hasDeviceCoordinates = userLat != null && userLon != null
  const dbForecastPoint = await resolveNearestForecastLocationPoint(userLat, userLon)
  const isInternalUpstreamCall = request.headers.get("x-nadeulhae-internal-call") === "1"
  const { sessionId, shouldSetCookie } = getOrCreateSessionId(request)
  const profile = mergeRegionProfileWithForecastLocation(
    resolveRegionProfile(userLat, userLon),
    dbForecastPoint
  )
  const recordLocationUsageProof = () => {
    if (!hasDeviceCoordinates || isInternalUpstreamCall) {
      return
    }

    void recordLocationUsageProofSafely({
      request,
      routePath: url.pathname,
      method: request.method,
      regionKey: profile.key,
      sessionId,
      eventKind: "weather_forecast",
    })
  }
  const grid = dbForecastPoint
    ? {
      nx: dbForecastPoint.gridX,
      ny: dbForecastPoint.gridY,
    }
    : (resolveForecastGrid(userLat, userLon)
      ?? {
      nx: Number(process.env.KMA_NX ?? 63),
      ny: Number(process.env.KMA_NY ?? 89),
    })

  const ip = getClientIp(request)
  const userCacheKey = [
    sessionId,
    profile.key,
    grid.nx,
    grid.ny,
    userLat != null ? Math.round(userLat * 100) : "home",
    userLon != null ? Math.round(userLon * 100) : "home",
  ].join(":")
  const cachedResponse = forecastResponseCache.get(userCacheKey)
  if (cachedResponse && cachedResponse.expiry > Date.now()) {
    recordLocationUsageProof()
    const response = NextResponse.json(cachedResponse.data)
    return attachSessionCookie(response, sessionId, shouldSetCookie)
  }

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

  const kstToday = getKstCompactDate()
  
  const [villageData, ultraForecastData, midForecast] = await Promise.all([
    fetchVillageData(grid.nx, grid.ny, kmaKey),
    fetchUltraForecastData(grid.nx, grid.ny, kmaKey),
    fetchMidData(profile, kmaKey),
  ])

  const { midLand: midLandData, midTemp: midTempData, tmFc } = midForecast

  const dailyForecastMap = new Map<string, {
    date: string
    tempMin: number
    tempMax: number
    sky: string
    precipChance: number
    precipAmount: string
    snowAmount: string
    score: number
    isMock?: boolean
  }>()
  const hourlyTimelineMap = new Map<string, {
    date: string
    time: string
    temp?: number
    sky?: number
    pty?: number
    precipChance?: number
    precipAmount?: string
  }>()

  const villageItems = villageData?.response?.body?.items?.item
  if (Array.isArray(villageItems)) {
    const groupedDaily: Record<string, { temps: number[]; skies: number[]; ptys: number[]; pops: number[]; pcps: string[]; snos: string[] }> = {}
    
    for (const item of villageItems) {
      const dateKey = item.fcstDate
      // Skip dates before today in KST
      if (dateKey < kstToday) continue
      
      if (!groupedDaily[dateKey]) {
        groupedDaily[dateKey] = { temps: [], skies: [], ptys: [], pops: [], pcps: [], snos: [] }
      }
      if (item.category === "TMP") groupedDaily[dateKey].temps.push(Number(item.fcstValue))
      if (item.category === "SKY") groupedDaily[dateKey].skies.push(Number(item.fcstValue))
      if (item.category === "PTY") groupedDaily[dateKey].ptys.push(Number(item.fcstValue))
      if (item.category === "POP") groupedDaily[dateKey].pops.push(Number(item.fcstValue))
      if (item.category === "PCP" && item.fcstValue) groupedDaily[dateKey].pcps.push(String(item.fcstValue))
      if (item.category === "SNO" && item.fcstValue) groupedDaily[dateKey].snos.push(String(item.fcstValue))

      if (dateKey >= kstToday) {
        const hourlyKey = `${item.fcstDate}${item.fcstTime}`
        const existing: {
          date: string
          time: string
          temp?: number
          sky?: number
          pty?: number
          precipChance?: number
          precipAmount?: string
        } = hourlyTimelineMap.get(hourlyKey) || {
          date: item.fcstDate,
          time: item.fcstTime,
        }

        if (item.category === "TMP") existing.temp = Number(item.fcstValue)
        if (item.category === "SKY") existing.sky = Number(item.fcstValue)
        if (item.category === "PTY") existing.pty = Number(item.fcstValue)
        if (item.category === "POP") existing.precipChance = Number(item.fcstValue)
        if (item.category === "PCP" && item.fcstValue) existing.precipAmount = String(item.fcstValue)

        hourlyTimelineMap.set(hourlyKey, existing)
      }
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

      dailyForecastMap.set(dateKey, {
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
      // Use KST-aware date calculation for consistency
      const kstBase = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
      kstBase.setHours(0, 0, 0, 0)
      kstBase.setDate(kstBase.getDate() + index)
      const dateKey = kstBase.toISOString().split("T")[0].replace(/-/g, "")
      
      if (dailyForecastMap.has(dateKey)) continue

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
        dailyForecastMap.set(dateKey, {
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

  // Ensure 11 days (today + 10) starting from kstToday
  const finalDaily: Array<{
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
  
  const todayDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
  todayDate.setHours(0, 0, 0, 0)
  const nowKst = getKstNow()
  const currentTimeLabel = getKstTimeLabel(nowKst)
  const currentDateTimeLabel = `${kstToday}${currentTimeLabel}`

  for (let i = 0; i < 11; i++) {
    const checkDate = new Date(todayDate)
    checkDate.setDate(checkDate.getDate() + i)
    const checkKey = checkDate.toISOString().split("T")[0].replace(/-/g, "")
    
    const existing = dailyForecastMap.get(checkKey)
    if (existing) {
      finalDaily.push(existing)
    } else {
      finalDaily.push(createStableFallbackForecast(todayDate, i))
    }
  }

  const ultraItems = ultraForecastData?.response?.body?.items?.item
  if (Array.isArray(ultraItems)) {
    for (const item of ultraItems) {
      if (!item?.fcstDate || !item?.fcstTime) continue
      const hourlyKey = `${item.fcstDate}${item.fcstTime}`
      const existing: {
        date: string
        time: string
        temp?: number
        sky?: number
        pty?: number
        precipChance?: number
        precipAmount?: string
      } = hourlyTimelineMap.get(hourlyKey) || {
        date: item.fcstDate,
        time: item.fcstTime,
      }

      if (item.category === "T1H") existing.temp = Number(item.fcstValue)
      if (item.category === "SKY") existing.sky = Number(item.fcstValue)
      if (item.category === "PTY") existing.pty = Number(item.fcstValue)
      if (item.category === "POP") existing.precipChance = Number(item.fcstValue)
      if (item.category === "RN1" && item.fcstValue) existing.precipAmount = String(item.fcstValue)

      hourlyTimelineMap.set(hourlyKey, existing)
    }
  }

  const hourlyEntries = Array.from(hourlyTimelineMap.values())
    .filter((entry) => `${entry.date}${entry.time}` >= currentDateTimeLabel || hourlyTimelineMap.size <= 4)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 18)
    .map((entry) => {
      const pty = entry.pty ?? 0
      const skyCode = entry.sky ?? 1
      const sky =
        pty > 0
          ? pty === 3
            ? "눈"
            : pty === 4
              ? "소나기"
              : "비"
          : skyCode <= 1
            ? "맑음"
            : skyCode <= 3
              ? "구름많음"
              : "흐림"

      return {
        date: entry.date,
        time: entry.time,
        temp: Number.isFinite(entry.temp) ? entry.temp : finalDaily[0]?.tempMax ?? 20,
        sky,
        precipChance: Number.isFinite(entry.precipChance) ? entry.precipChance : pty > 0 ? 60 : 0,
        precipAmount: entry.precipAmount && entry.precipAmount !== "강수없음" ? entry.precipAmount : "0mm",
      }
    })

  const finalResult = {
    location: userLat != null && userLon != null ? profile.displayName : HOME_REGION.displayName,
    daily: finalDaily,
    todayHourly: hourlyEntries,
    metadata: {
      dataSource: "기상청",
      lastUpdate: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }),
      info: finalDaily.some((day) => day.isMock) ? "Partial data generated" : "Real-time sync",
      baseTime: `V:${tmFc} M:${tmFc}`, // tmFc used as unified marker for consistency
    },
  }

  forecastResponseCache.set(userCacheKey, {
    data: finalResult,
    expiry: Date.now() + USER_RESPONSE_CACHE_DURATION,
  })

  while (forecastResponseCache.size > MAX_FORECAST_CACHE_KEYS) {
    const oldestKey = forecastResponseCache.keys().next().value as string | undefined
    if (!oldestKey) break
    forecastResponseCache.delete(oldestKey)
  }

  const response = NextResponse.json(finalResult)
  recordLocationUsageProof()
  return attachSessionCookie(response, sessionId, shouldSetCookie)
}

export const GET = withApiAnalytics(handleGET)
