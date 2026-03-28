import { NextResponse } from "next/server"
import {
  HOME_REGION,
  dfsToGrid,
  formatKmaDateTime,
  getCurrentNowcastBase,
  getKstCompactDate,
  getKstDateLabel,
  getRegionProfileByKey,
  pickStationByKeywords,
  resolveRegionProfile,
  stripHtmlTags,
} from "@/lib/weather-utils"

type CacheEntry<T> = {
  data: T
  lastUpdate: number
}

type CurrentWeatherSnapshot = {
  temp: number
  humidity: number
  wind: number
  pty: number
  rn1: number
  vec: number
  sky: number
  lastUpdate: string
}

type AirQualitySnapshot = {
  dust: string
  pm10: number
  pm25: number
  o3: number
  no2: number
  co: number
  so2: number
  khai: number
  khaiGrade: number
  kr: string
  who: string
  station: string
  lastUpdate: string
}

type RegionalBulletinSnapshot = {
  summary: string
  warningStatus: string
  hasAlert: boolean
  lastUpdate: string
}

type RegionalWarningSnapshot = {
  active: boolean
  title: string
  content: string
  lastUpdate: string
}

type EarthquakeSnapshot = {
  active: boolean
  title: string
  location: string
  magnitude: number
  remark: string
  occurredAt: string
}

type ScoreBreakdown = {
  air: number
  temperature: number
  sky: number
  wind: number
  knockout: string
  total: number
}

const currentWeatherCache = new Map<string, CacheEntry<CurrentWeatherSnapshot>>()
const airQualityCache = new Map<string, CacheEntry<AirQualitySnapshot>>()
const uvCache = new Map<string, CacheEntry<string>>()
const bulletinCache = new Map<string, CacheEntry<RegionalBulletinSnapshot>>()
const warningCache = new Map<string, CacheEntry<RegionalWarningSnapshot>>()
const earthquakeCache = new Map<string, CacheEntry<EarthquakeSnapshot>>()

const KMA_CACHE_DURATION = 10 * 60 * 1000
const AIR_CACHE_DURATION = 60 * 60 * 1000
const UV_CACHE_DURATION = 3 * 60 * 60 * 1000
const ALERT_CACHE_DURATION = 15 * 60 * 1000
const AIR_DAILY_LIMIT = Number(process.env.AIRKOREA_DAILY_LIMIT ?? 500)
const CURRENT_RATE_LIMIT_WINDOW = 60 * 1000
const CURRENT_MAX_REQUESTS_PER_WINDOW = 60

let airQuotaState = {
  date: "",
  count: 0,
}

const currentRateLimitMap = new Map<string, { count: number; lastReset: number }>()

const DEFAULT_AIR_QUALITY: AirQualitySnapshot = {
  dust: "25µg/m³",
  pm10: 25,
  pm25: 12,
  o3: 0.028,
  no2: 0.014,
  co: 0.4,
  so2: 0.003,
  khai: 45,
  khaiGrade: 1,
  kr: "좋음",
  who: "좋음",
  station: "덕진동",
  lastUpdate: "--:--",
}

function getCachedValue<T>(map: Map<string, CacheEntry<T>>, key: string, ttl: number) {
  const cached = map.get(key)
  if (!cached) return null
  if (Date.now() - cached.lastUpdate > ttl) return null
  return cached.data
}

function resetAirQuotaIfNeeded() {
  const today = getKstDateLabel()
  if (airQuotaState.date !== today) {
    airQuotaState = { date: today, count: 0 }
  }
}

function consumeAirQuotaSlot() {
  resetAirQuotaIfNeeded()
  if (airQuotaState.count >= AIR_DAILY_LIMIT) {
    return false
  }
  airQuotaState.count += 1
  return true
}

function parseNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function isInvalidAirFlag(flag: unknown) {
  if (typeof flag !== "string") return false
  const normalized = flag.trim()
  return normalized.length > 0 && normalized !== "-"
}

function getKrAirGrade(pm10: number) {
  if (pm10 <= 30) return "좋음"
  if (pm10 <= 80) return "보통"
  if (pm10 <= 150) return "나쁨"
  return "매우나쁨"
}

function getWhoAirGrade(pm25: number) {
  if (pm25 <= 15) return "좋음"
  if (pm25 <= 35) return "보통"
  if (pm25 <= 75) return "나쁨"
  return "매우나쁨"
}

function getKhaiGrade(khai: number) {
  if (khai <= 50) return 1
  if (khai <= 100) return 2
  if (khai <= 250) return 3
  return 4
}

function truncateText(value: string, maxLength = 140) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1).trimEnd()}…`
}

function toArray<T>(value: T | T[] | null | undefined) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function getShiftedKstDate(offsetDays: number) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return getKstCompactDate(date)
}

function hasRelevantRegionKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function formatEarthquakeTitle(location: string, magnitude: number) {
  if (!location && !Number.isFinite(magnitude)) return ""
  if (!location) return `규모 ${magnitude.toFixed(1)} 지진`
  if (!Number.isFinite(magnitude)) return location
  return `${location} 규모 ${magnitude.toFixed(1)}`
}

function getAirScore(khaiGrade: number) {
  if (khaiGrade === 1) return 40
  if (khaiGrade === 2) return 30
  if (khaiGrade === 3) return 10
  return 0
}

function getTemperatureScore(temp: number) {
  if (temp >= 17 && temp <= 24) return 30
  if ((temp >= 12 && temp <= 16) || (temp >= 25 && temp <= 28)) return 20
  if ((temp >= 10 && temp <= 11) || (temp >= 29 && temp <= 31)) return 10
  return 0
}

function getSkyScore(sky: number) {
  if (sky === 1 || sky === 3) return 20
  if (sky === 4) return 10
  return 10
}

function getWindScore(wind: number) {
  if (wind <= 3) return 10
  if (wind <= 6) return 5
  return 0
}

async function fetchJsonSafely(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return null
    const text = await response.text()
    if (!text || text.trim().startsWith("<")) return null
    return JSON.parse(text)
  } catch (error) {
    console.error("External fetch failed:", error)
    return null
  }
}

async function fetchCurrentWeather(nx: number, ny: number, apiKey: string) {
  const cacheKey = `${nx}_${ny}`
  const cached = getCachedValue(currentWeatherCache, cacheKey, KMA_CACHE_DURATION)
  if (cached) return cached

  const { baseDate, baseTime } = getCurrentNowcastBase()
  const nowcastUrl = `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtNcst?authKey=${apiKey}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`
  const forecastUrl = `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtFcst?authKey=${apiKey}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`
  const [nowcastData, forecastData] = await Promise.all([
    fetchJsonSafely(nowcastUrl),
    fetchJsonSafely(forecastUrl),
  ])
  const items = nowcastData?.response?.body?.items?.item

  if (!Array.isArray(items)) {
    return null
  }

  const byCategory = items.reduce<Record<string, string>>((acc, item) => {
    acc[item.category] = item.obsrValue
    return acc
  }, {})

  const skyItems = forecastData?.response?.body?.items?.item
  const sky = Array.isArray(skyItems)
    ? skyItems
        .filter((item) => item.category === "SKY")
        .sort((a, b) => `${a.fcstDate}${a.fcstTime}`.localeCompare(`${b.fcstDate}${b.fcstTime}`))[0]?.fcstValue
    : null

  const snapshot: CurrentWeatherSnapshot = {
    temp: parseNumber(byCategory.T1H),
    humidity: parseNumber(byCategory.REH),
    wind: parseNumber(byCategory.WSD),
    pty: parseNumber(byCategory.PTY),
    rn1: parseNumber(byCategory.RN1),
    vec: parseNumber(byCategory.VEC),
    sky: parseNumber(sky, 3),
    lastUpdate: formatKmaDateTime(baseDate, baseTime),
  }

  currentWeatherCache.set(cacheKey, { data: snapshot, lastUpdate: Date.now() })
  return snapshot
}

async function fetchAirQuality(profileKey: string, serviceKey: string) {
  const explicitProfile = getRegionProfileByKey(profileKey)

  const cacheKey = explicitProfile.key
  const cached = getCachedValue(airQualityCache, cacheKey, AIR_CACHE_DURATION)
  if (cached) {
    return { data: cached, isFallback: false }
  }

  if (consumeAirQuotaSlot()) {
    const url = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${serviceKey}&returnType=json&numOfRows=100&pageNo=1&sidoName=${encodeURIComponent(explicitProfile.airSidoName)}&ver=1.0`
    const data = await fetchJsonSafely(url)
    const items = data?.response?.body?.items
    if (Array.isArray(items) && items.length > 0) {
      const station = pickStationByKeywords(items, explicitProfile.stationKeywords)
      if (station) {
        const pm10 = isInvalidAirFlag(station.pm10Flag)
          ? DEFAULT_AIR_QUALITY.pm10
          : parseNumber(station.pm10Value, DEFAULT_AIR_QUALITY.pm10)
        const pm25 = isInvalidAirFlag(station.pm25Flag)
          ? DEFAULT_AIR_QUALITY.pm25
          : parseNumber(station.pm25Value, DEFAULT_AIR_QUALITY.pm25)
        const khai = parseNumber(station.khaiValue, DEFAULT_AIR_QUALITY.khai)
        const khaiGrade = parseNumber(station.khaiGrade, getKhaiGrade(khai))
        const snapshot: AirQualitySnapshot = {
          dust: `${pm10}µg/m³`,
          pm10,
          pm25,
          o3: parseNumber(station.o3Value),
          no2: parseNumber(station.no2Value),
          co: parseNumber(station.coValue),
          so2: parseNumber(station.so2Value),
          khai,
          khaiGrade,
          kr: getKrAirGrade(pm10),
          who: getWhoAirGrade(pm25),
          station: station.stationName ?? DEFAULT_AIR_QUALITY.station,
          lastUpdate: typeof station.dataTime === "string" ? station.dataTime.replace(/-/g, ".") : "--:--",
        }

        airQualityCache.set(cacheKey, { data: snapshot, lastUpdate: Date.now() })
        return { data: snapshot, isFallback: false }
      }
    }
  }

  const homeCached = getCachedValue(airQualityCache, HOME_REGION.key, AIR_CACHE_DURATION)
  if (homeCached) {
    return { data: homeCached, isFallback: true }
  }

  airQualityCache.set(HOME_REGION.key, { data: DEFAULT_AIR_QUALITY, lastUpdate: Date.now() })
  return { data: DEFAULT_AIR_QUALITY, isFallback: true }
}

async function fetchUvIndex(areaNo: string, serviceKey: string) {
  const cached = getCachedValue(uvCache, areaNo, UV_CACHE_DURATION)
  if (cached) return cached

  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const url = `https://apis.data.go.kr/1360000/LivingWthrIdxServiceV4/getUVIdxV4?serviceKey=${serviceKey}&dataType=JSON&areaNo=${areaNo}&time=${year}${month}${day}${hour}`
  const data = await fetchJsonSafely(url)
  const value = parseNumber(data?.response?.body?.items?.item?.[0]?.h0, -1)

  let label = "보통"
  if (value >= 0) {
    if (value <= 2) label = "낮음"
    else if (value <= 5) label = "보통"
    else if (value <= 7) label = "높음"
    else if (value <= 10) label = "매우높음"
    else label = "위험"
  }

  uvCache.set(areaNo, { data: label, lastUpdate: Date.now() })
  return label
}

async function fetchRegionalBulletin(profileKey: string, serviceKey: string) {
  const profile = getRegionProfileByKey(profileKey)
  const cached = getCachedValue(bulletinCache, profile.key, ALERT_CACHE_DURATION)
  if (cached) return cached

  const url = `https://apis.data.go.kr/1360000/VilageFcstMsgService/getWthrSituation?serviceKey=${serviceKey}&pageNo=1&numOfRows=10&dataType=JSON&stnId=${profile.weatherStationId}`
  const data = await fetchJsonSafely(url)
  const item = toArray(data?.response?.body?.items?.item)[0]

  const summary = truncateText(
    stripHtmlTags(String(item?.wfSv1 || item?.wfSv || item?.wn || "")).replace(/\s+/g, " ").trim(),
    180
  )
  const warningStatus = stripHtmlTags(String(item?.wr || "")).trim()
  const normalizedWarning = warningStatus.replace(/\s+/g, "")
  const snapshot: RegionalBulletinSnapshot = {
    summary,
    warningStatus,
    hasAlert: Boolean(warningStatus) && !/없음|none|o없음/i.test(normalizedWarning),
    lastUpdate: String(item?.tmFc || item?.tmSeq || "--:--"),
  }

  bulletinCache.set(profile.key, { data: snapshot, lastUpdate: Date.now() })
  return snapshot
}

async function fetchRegionalWarning(profileKey: string, serviceKey: string) {
  const profile = getRegionProfileByKey(profileKey)
  const cached = getCachedValue(warningCache, profile.key, ALERT_CACHE_DURATION)
  if (cached) return cached

  const fromTmFc = getShiftedKstDate(-1)
  const toTmFc = getShiftedKstDate(1)
  const url = `https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList?serviceKey=${serviceKey}&pageNo=1&numOfRows=30&dataType=JSON&fromTmFc=${fromTmFc}&toTmFc=${toTmFc}`
  const data = await fetchJsonSafely(url)
  const items = toArray(data?.response?.body?.items?.item)

  const relevantItems = items
    .map((item: any) => {
      const title = stripHtmlTags(String(item?.title || ""))
      const content = stripHtmlTags(String(item?.content || ""))
      const joined = `${title} ${content}`.trim()
      return {
        title,
        content,
        joined,
        timestamp: String(item?.tmFc || item?.tmSeq || item?.tmEf || ""),
      }
    })
    .filter((item) => item.joined && hasRelevantRegionKeyword(item.joined, profile.warningKeywords))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const latest = relevantItems[0]
  const active = Boolean(latest) && !/해제/.test(latest.joined) && /(주의보|경보|특보|호우|건조|강풍|대설|폭염|한파|태풍|풍랑|황사)/.test(latest.joined)
  const snapshot: RegionalWarningSnapshot = {
    active,
    title: latest?.title || "",
    content: truncateText(latest?.content || "", 180),
    lastUpdate: latest?.timestamp || "--:--",
  }

  warningCache.set(profile.key, { data: snapshot, lastUpdate: Date.now() })
  return snapshot
}

async function fetchEarthquakeInfo(serviceKey: string) {
  const cached = getCachedValue(earthquakeCache, "national", ALERT_CACHE_DURATION)
  if (cached) return cached

  const fromTmFc = getShiftedKstDate(-2)
  const toTmFc = getShiftedKstDate(0)
  const url = `https://apis.data.go.kr/1360000/EqkInfoService/getEqkMsg?serviceKey=${serviceKey}&pageNo=1&numOfRows=20&dataType=JSON&fromTmFc=${fromTmFc}&toTmFc=${toTmFc}`
  const data = await fetchJsonSafely(url)
  const items = toArray(data?.response?.body?.items?.item)

  const latest = items
    .map((item: any) => ({
      title: stripHtmlTags(String(item?.rem || "")),
      location: stripHtmlTags(String(item?.loc || "")),
      magnitude: parseNumber(item?.mt ?? item?.mag, Number.NaN),
      remark: stripHtmlTags(String(item?.rem || "")),
      occurredAt: String(item?.tmEqk || ""),
    }))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]

  const active = Boolean(latest) && latest.occurredAt.length > 0 && !/국내영향없음|국내 영향 없음|영향없음/.test(latest.remark)
  const snapshot: EarthquakeSnapshot = {
    active,
    title: latest ? formatEarthquakeTitle(latest.location, latest.magnitude) : "",
    location: latest?.location || "",
    magnitude: latest?.magnitude || 0,
    remark: latest?.remark || "",
    occurredAt: latest?.occurredAt || "--:--",
  }

  earthquakeCache.set("national", { data: snapshot, lastUpdate: Date.now() })
  return snapshot
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const lat = url.searchParams.get("lat")
  const lon = url.searchParams.get("lon")
  const userLat = lat ? Number(lat) : null
  const userLon = lon ? Number(lon) : null
  const ip = (req.headers.get("x-forwarded-for") || "127.0.0.1").split(",")[0].trim()
  const now = Date.now()
  const rateData = currentRateLimitMap.get(ip)

  if (!rateData) {
    currentRateLimitMap.set(ip, { count: 1, lastReset: now })
  } else if (now - rateData.lastReset > CURRENT_RATE_LIMIT_WINDOW) {
    currentRateLimitMap.set(ip, { count: 1, lastReset: now })
  } else {
    rateData.count += 1
    if (rateData.count > CURRENT_MAX_REQUESTS_PER_WINDOW) {
      return NextResponse.json({ error: "Too Many Requests. Current weather rate limit exceeded." }, { status: 429 })
    }
  }

  const kmaKey = process.env.KMA_API_KEY
  const publicServiceKey = process.env.AIRKOREA_API_KEY

  if (!kmaKey || !publicServiceKey) {
    return NextResponse.json({ error: "API Keys not configured" }, { status: 500 })
  }

  const profile = resolveRegionProfile(userLat, userLon)
  const grid = userLat != null && userLon != null ? dfsToGrid(userLat, userLon) : {
    nx: Number(process.env.KMA_NX ?? 63),
    ny: Number(process.env.KMA_NY ?? 89),
  }

  const [weatherData, airResponse, uvIndex, bulletin, warning, earthquake] = await Promise.all([
    fetchCurrentWeather(grid.nx, grid.ny, kmaKey),
    fetchAirQuality(profile.key, publicServiceKey),
    fetchUvIndex(profile.areaNo, publicServiceKey),
    fetchRegionalBulletin(profile.key, publicServiceKey),
    fetchRegionalWarning(profile.key, publicServiceKey),
    fetchEarthquakeInfo(publicServiceKey),
  ])

  if (!weatherData) {
    return NextResponse.json({ error: "Failed to fetch weather data from KMA" }, { status: 503 })
  }

  const airQuality = airResponse.data
  const isFallback = airResponse.isFallback
  const isRain = weatherData.pty > 0 || weatherData.rn1 > 0
  const isEarthquake = earthquake.active
  const isWeatherWarning = warning.active || bulletin.hasAlert
  const isHomeRegion = isFallback || profile.key === HOME_REGION.key
  const scoreBreakdown: ScoreBreakdown = {
    air: 0,
    temperature: 0,
    sky: 0,
    wind: 0,
    knockout: "clear",
    total: 0,
  }

  let score = 100
  let statusKey = "status_good"
  let messageKey = isHomeRegion ? "msg_home_good" : "msg_away_good"

  if (isRain || isEarthquake || isWeatherWarning) {
    score = isRain ? 10 : 0
    scoreBreakdown.knockout = isRain ? "rain" : "warning"
    scoreBreakdown.total = score
    statusKey = "status_poor"
    messageKey = isHomeRegion ? "msg_home_poor" : "msg_away_poor"
  } else {
    scoreBreakdown.air = getAirScore(airQuality.khaiGrade)
    scoreBreakdown.temperature = getTemperatureScore(weatherData.temp)
    scoreBreakdown.sky = getSkyScore(weatherData.sky)
    scoreBreakdown.wind = getWindScore(weatherData.wind)

    score = scoreBreakdown.air
      + scoreBreakdown.temperature
      + scoreBreakdown.sky
      + scoreBreakdown.wind

    score = Math.max(10, Math.min(100, score))
    scoreBreakdown.total = score

    if (score >= 86) {
      statusKey = "status_excellent"
      messageKey = isHomeRegion ? "msg_home_excellent" : "msg_away_excellent"
    } else if (score >= 66) {
      statusKey = "status_good"
      messageKey = isHomeRegion ? "msg_home_good" : "msg_away_good"
    } else if (score >= 36) {
      statusKey = "status_fair"
      messageKey = isHomeRegion ? "msg_home_fair" : "msg_away_fair"
    } else {
      statusKey = "status_poor"
      messageKey = isHomeRegion ? "msg_home_poor" : "msg_away_poor"
    }
  }

  const warningMessage = isEarthquake
    ? earthquake.title || earthquake.remark
    : isWeatherWarning
      ? warning.title || bulletin.warningStatus || bulletin.summary
      : isFallback
        ? "전주 기준 대기질 데이터를 표시 중입니다."
        : bulletin.summary

  const locationLabel = isFallback ? HOME_REGION.displayName : profile.displayName
  const locationLabelEn = isFallback ? HOME_REGION.englishName : profile.englishName

  return NextResponse.json({
    score,
    status: statusKey,
    message: messageKey,
    isFallback,
    eventData: {
      isEarthquake,
      isWeatherWarning,
      isRain,
      warningMessage,
    },
    details: {
      ...weatherData,
      ...airQuality,
      uv: uvIndex,
    },
    metadata: {
      dataSource: "기상청, 한국환경공단 API (KMA, AirKorea)",
      station: airQuality.station || process.env.AIRKOREA_STATION_NAME || "덕진동",
      region: locationLabel,
      regionEn: locationLabelEn,
      regionKey: isFallback ? HOME_REGION.key : profile.key,
      lastUpdate: { kma: weatherData.lastUpdate, air: airQuality.lastUpdate },
      intervals: { kma: "interval_45m", air: "interval_0m" },
      cachePolicy: {
        weatherMinutes: 10,
        airMinutes: 60,
        alertMinutes: 15,
        forecastHours: 3,
      },
      scoreBreakdown,
      bulletin: {
        summary: bulletin.summary,
        warningStatus: bulletin.warningStatus,
        updatedAt: bulletin.lastUpdate,
      },
      alertSummary: {
        warningTitle: warning.title,
        warningUpdatedAt: warning.lastUpdate,
        earthquakeTitle: earthquake.title,
        earthquakeUpdatedAt: earthquake.occurredAt,
      },
    },
  })
}
