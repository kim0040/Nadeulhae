import { NextResponse } from "next/server"
import {
  HOME_REGION,
  formatKmaDateTime,
  getCurrentNowcastBase,
  getKstCompactDate,
  getKstDateLabel,
  getRegionProfiles,
  mergeRegionProfileWithForecastLocation,
  resolveForecastGrid,
  pickStationByKeywords,
  resolveRegionProfile,
  stripHtmlTags,
  getNextUpdateTimestamp,
  type RegionProfile,
} from "@/lib/weather-utils"
import { withApiAnalytics } from "@/lib/analytics/route"
import { resolveNearestForecastLocationPoint } from "@/lib/forecast-location/repository"
import { recordLocationUsageProofSafely } from "@/lib/privacy/location-proof"
import { wgs84ToTm } from "@/lib/coords-utils"
import { broadcast } from "@/lib/websocket/broadcast"

interface WeatherAlertPayload {
  alertType: string
  message?: string
  score: number
  status: string
  alertSummary?: unknown
}

let lastAlertKey = ""
let lastAlertTime = 0
const ALERT_DEDUP_INTERVAL_MS = 5 * 60 * 1000

function broadcastWeatherAlertOnce(payload: WeatherAlertPayload) {
  const key = `${payload.alertType}:${payload.message ?? ""}:${payload.status}`
  const now = Date.now()
  if (key === lastAlertKey && now - lastAlertTime < ALERT_DEDUP_INTERVAL_MS) {
    return
  }
  lastAlertKey = key
  lastAlertTime = now
  broadcast("weather_alert", payload)
}
import { attachSessionCookie, getOrCreateSessionId } from "@/lib/request-session"

// Simple in-memory cache for nearest stations based on coords (lat_lon -> stationName)
type NearbyStationCandidate = {
  name: string
  distanceKm?: number
}

type StationCacheEntry = {
  name: string
  tmX: number
  tmY: number
  candidates: NearbyStationCandidate[]
  expiry: number
}

const stationCache = new Map<string, StationCacheEntry>()
const STATION_CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const MAX_STATION_CACHE_KEYS = 2000

type CacheEntry<T> = {
  data: T
  lastUpdate: number
}

type UserCacheEntry<T> = {
  data: T
  expiry: number
}

type CurrentWeatherSnapshot = {
  temp: number
  humidity: number
  wind: number
  pty: number
  rn1: number
  forecastPty: number
  forecastRn1: number
  forecastTime: string
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
  latitude: number | null
  longitude: number | null
}

type TsunamiSnapshot = {
  active: boolean
  title: string
  location: string
  magnitude: number
  remark: string
  issuedAt: string
}

type VolcanoSnapshot = {
  active: boolean
  title: string
  name: string
  location: string
  plumeHeight: number
  remark: string
  issuedAt: string
}

type ScoreBreakdown = {
  air: number
  temperature: number
  sky: number
  wind: number
  knockout: string
  total: number
}

type ThermalLevel = "good" | "moderate" | "caution" | "danger"

type HazardFlags = {
  typhoon: boolean
  tsunami: boolean
  volcano: boolean
}

const MAX_CACHE_KEYS = 2000

const airQualityCache = new Map<string, CacheEntry<AirQualitySnapshot>>()
const uvCache = new Map<string, CacheEntry<string>>()
const bulletinCache = new Map<string, CacheEntry<RegionalBulletinSnapshot>>()
const warningCache = new Map<string, CacheEntry<RegionalWarningSnapshot>>()
const earthquakeCache = new Map<string, CacheEntry<EarthquakeSnapshot>>()
const tsunamiCache = new Map<string, CacheEntry<TsunamiSnapshot>>()
const volcanoCache = new Map<string, CacheEntry<VolcanoSnapshot>>()

function setCacheWithLimit<T>(map: Map<string, CacheEntry<T>>, key: string, value: CacheEntry<T>) {
  map.set(key, value)
  while (map.size > MAX_CACHE_KEYS) {
    const oldestKey = map.keys().next().value as string | undefined
    if (!oldestKey) break
    map.delete(oldestKey)
  }
}

const BULLETIN_FALLBACK_STATION_IDS: Partial<Record<string, string>> = {
  gwangyang: "156",
}

function getDistanceSq(latA: number, lonA: number, latB: number, lonB: number) {
  const dLat = latA - latB
  const dLon = lonA - lonB
  return dLat * dLat + dLon * dLon
}

function getBulletinFallbackStationIds(profile: RegionProfile) {
  const profiles = getRegionProfiles()
  const seen = new Set<string>([profile.weatherStationId])
  const candidates: string[] = []

  const pushStationId = (stationId?: string) => {
    if (!stationId || seen.has(stationId)) return
    seen.add(stationId)
    candidates.push(stationId)
  }

  pushStationId(BULLETIN_FALLBACK_STATION_IDS[profile.key])

  const byDistance = [...profiles]
    .filter((candidate) => candidate.key !== profile.key)
    .sort((a, b) => (
      getDistanceSq(profile.lat, profile.lon, a.lat, a.lon)
      - getDistanceSq(profile.lat, profile.lon, b.lat, b.lon)
    ))

  byDistance
    .filter((candidate) => candidate.airSidoName === profile.airSidoName)
    .forEach((candidate) => pushStationId(candidate.weatherStationId))

  byDistance.forEach((candidate) => pushStationId(candidate.weatherStationId))

  return candidates.slice(0, 5)
}
const currentWeatherCache = new Map<string, CacheEntry<CurrentWeatherSnapshot>>()
const MAX_USER_RESPONSE_CACHE_KEYS = 500
const currentResponseCache = new Map<string, UserCacheEntry<Record<string, unknown>>>()
const EARTHQUAKE_KNOCKOUT_MAGNITUDE = 4.0

const WEATHER_CACHE_DURATION = 30 * 60 * 1000
const AIR_CACHE_DURATION = 30 * 60 * 1000
const UV_CACHE_DURATION = 30 * 60 * 1000
const ALERT_CACHE_DURATION = 5 * 60 * 1000
const USER_RESPONSE_CACHE_DURATION = 3 * 60 * 1000
const AIR_DAILY_LIMIT = Number(process.env.AIRKOREA_DAILY_LIMIT ?? 500)
const CURRENT_RATE_LIMIT_WINDOW = 60 * 1000
const CURRENT_MAX_REQUESTS_PER_WINDOW = 60
const CACHE_SWEEP_INTERVAL = 5 * 60 * 1000

let airQuotaState = {
  date: "",
  count: 0,
}

const currentRateLimitMap = new Map<string, { count: number; lastReset: number }>()
let lastMaintenanceSweep = 0

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



function getKstComparableDateTime(dateValue?: string, timeValue?: string) {
  if (!dateValue || !timeValue || dateValue.length !== 8 || timeValue.length !== 4) return null
  return Number(`${dateValue}${timeValue}`)
}

function getKstCompactTime() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date())

  const hour = parts.find((part) => part.type === "hour")?.value ?? "00"
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00"
  return `${hour}${minute}`
}

const TRUST_PROXY_HEADERS = /^(1|true|yes)$/i.test(
  process.env.TRUST_PROXY_HEADERS ?? ""
)

function getClientIp(req: Request) {
  if (!TRUST_PROXY_HEADERS) {
    return "anonymous"
  }
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  const realIp = req.headers.get("x-real-ip")
  return realIp?.trim() || "anonymous"
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

function setExpiringCacheWithLimit<T extends { expiry: number }>(
  map: Map<string, T>,
  key: string,
  value: T,
  maxKeys: number
) {
  map.set(key, value)
  while (map.size > maxKeys) {
    const oldestKey = map.keys().next().value as string | undefined
    if (!oldestKey) break
    map.delete(oldestKey)
  }
}

function cleanupRateLimitMap(map: Map<string, { count: number; lastReset: number }>, windowMs: number, now: number, maxEntries = 10000) {
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

function detectHazards(text: string): HazardFlags {
  const normalized = text.replace(/\s+/g, "")
  return {
    typhoon: /(태풍|typhoon)/i.test(normalized),
    tsunami: /(지진해일|해일경보|쓰나미|tsunami)/i.test(normalized),
    volcano: /(화산|화산재|volcano|ash)/i.test(normalized),
  }
}

function runMaintenanceSweepIfNeeded() {
  const now = Date.now()
  if (now - lastMaintenanceSweep < CACHE_SWEEP_INTERVAL) {
    return
  }

  cleanupLastUpdateCache(airQualityCache, AIR_CACHE_DURATION * 3, now)
  cleanupLastUpdateCache(uvCache, UV_CACHE_DURATION * 3, now)
  cleanupLastUpdateCache(bulletinCache, ALERT_CACHE_DURATION * 3, now)
  cleanupLastUpdateCache(warningCache, ALERT_CACHE_DURATION * 3, now)
  cleanupLastUpdateCache(earthquakeCache, ALERT_CACHE_DURATION * 3, now)
  cleanupLastUpdateCache(tsunamiCache, ALERT_CACHE_DURATION * 3, now)
  cleanupLastUpdateCache(volcanoCache, ALERT_CACHE_DURATION * 3, now)
  cleanupLastUpdateCache(currentWeatherCache, WEATHER_CACHE_DURATION * 2, now)
  cleanupExpiringCache(currentResponseCache, now)
  cleanupExpiringCache(stationCache, now)
  cleanupRateLimitMap(currentRateLimitMap, CURRENT_RATE_LIMIT_WINDOW, now)

  lastMaintenanceSweep = now
}

/**
 * Enhanced cache check that considers the next scheduled update time.
 */
function getSmartCachedValue<T>(map: Map<string, CacheEntry<T>>, key: string, type: 'village' | 'mid' | 'air', defaultTtl: number) {
  const entry = map.get(key)
  if (!entry) return null

  const now = Date.now()
  // 1. Basic TTL check (safety fallback)
  if (now - entry.lastUpdate > defaultTtl * 3) return null

  // 2. Scheduled update check: If the current time is past the next update time calculated AFTER the last entry update, it's stale.
  const nextUpdateForEntry = getNextUpdateTimestamp(type, new Date(entry.lastUpdate))
  if (now >= nextUpdateForEntry) {
    return null 
  }

  return entry.data
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

function buildAirQualitySnapshot(station: any): AirQualitySnapshot {
  const pm10 = isInvalidAirFlag(station?.pm10Flag)
    ? DEFAULT_AIR_QUALITY.pm10
    : parseNumber(station?.pm10Value, DEFAULT_AIR_QUALITY.pm10)
  const pm25 = isInvalidAirFlag(station?.pm25Flag)
    ? DEFAULT_AIR_QUALITY.pm25
    : parseNumber(station?.pm25Value, DEFAULT_AIR_QUALITY.pm25)
  const khai = parseNumber(station?.khaiValue, DEFAULT_AIR_QUALITY.khai)
  const khaiGrade = parseNumber(station?.khaiGrade, getKhaiGrade(khai))

  return {
    dust: `${pm10}µg/m³`,
    pm10,
    pm25,
    o3: parseNumber(station?.o3Value),
    no2: parseNumber(station?.no2Value),
    co: parseNumber(station?.coValue),
    so2: parseNumber(station?.so2Value),
    khai,
    khaiGrade,
    kr: getKrAirGrade(pm10),
    who: getWhoAirGrade(pm25),
    station: station?.stationName ?? DEFAULT_AIR_QUALITY.station,
    lastUpdate: typeof station?.dataTime === "string" ? station.dataTime.replace(/-/g, ".") : "--:--",
  }
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

function getEarthquakeTimeLabel(value: string) {
  if (!value) return ""
  const compact = value.replace(/\D/g, "")
  if (compact.length >= 12) return compact.slice(0, 12)
  return compact
}

function buildEarthquakeImageUrl(snapshot: EarthquakeSnapshot) {
  const params = new URLSearchParams()
  params.set("kind", "earthquake")

  if (Number.isFinite(snapshot.latitude) && Number.isFinite(snapshot.longitude)) {
    params.set("lat", Number(snapshot.latitude).toFixed(4))
    params.set("lon", Number(snapshot.longitude).toFixed(4))
  }

  if (Number.isFinite(snapshot.magnitude) && snapshot.magnitude > 0) {
    params.set("mag", snapshot.magnitude.toFixed(1))
  }

  if (snapshot.location) {
    params.set("loc", snapshot.location.slice(0, 80))
  }

  const timeLabel = getEarthquakeTimeLabel(snapshot.occurredAt)
  if (timeLabel) {
    params.set("tm", timeLabel)
  }

  return `/api/weather/images/asset?${params.toString()}`
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

function roundToOne(value: number) {
  return Math.round(value * 10) / 10
}

function calculateHeatIndexC(tempC: number, humidity: number) {
  const tempF = tempC * 9 / 5 + 32
  const hiF =
    -42.379
    + 2.04901523 * tempF
    + 10.14333127 * humidity
    - 0.22475541 * tempF * humidity
    - 6.83783e-3 * tempF * tempF
    - 5.481717e-2 * humidity * humidity
    + 1.22874e-3 * tempF * tempF * humidity
    + 8.5282e-4 * tempF * humidity * humidity
    - 1.99e-6 * tempF * tempF * humidity * humidity

  return (hiF - 32) * 5 / 9
}

function calculateFeelsLike(tempC: number, humidity: number, windMs: number) {
  const windKmh = windMs * 3.6

  if (tempC <= 10 && windKmh >= 4.8) {
    const chill =
      13.12
      + 0.6215 * tempC
      - 11.37 * Math.pow(windKmh, 0.16)
      + 0.3965 * tempC * Math.pow(windKmh, 0.16)
    return roundToOne(chill)
  }

  if (tempC >= 27 && humidity >= 40) {
    return roundToOne(calculateHeatIndexC(tempC, humidity))
  }

  const vaporPressure = (humidity / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC))
  const apparentTemp = tempC + 0.33 * vaporPressure - 0.7 * windMs - 4
  return roundToOne(apparentTemp)
}

function getKrThermalLevel(feelsLike: number): ThermalLevel {
  if (feelsLike >= 18 && feelsLike <= 24) return "good"
  if ((feelsLike >= 12 && feelsLike < 18) || (feelsLike > 24 && feelsLike <= 28)) return "moderate"
  if ((feelsLike >= 5 && feelsLike < 12) || (feelsLike > 28 && feelsLike <= 32)) return "caution"
  return "danger"
}

function getWhoThermalLevel(feelsLike: number): ThermalLevel {
  if (feelsLike >= 18 && feelsLike <= 26) return "good"
  if ((feelsLike >= 10 && feelsLike < 18) || (feelsLike > 26 && feelsLike <= 30)) return "moderate"
  if ((feelsLike >= 0 && feelsLike < 10) || (feelsLike > 30 && feelsLike <= 35)) return "caution"
  return "danger"
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

async function fetchTextSafely(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return ""
    return await response.text()
  } catch (error) {
    console.error("External text fetch failed:", error)
    return ""
  }
}

function extractXmlBlocks(xml: string, tagName: string) {
  if (!xml) return []
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "gi")
  const blocks: string[] = []
  let match = regex.exec(xml)
  while (match) {
    blocks.push(match[1] || "")
    match = regex.exec(xml)
  }
  return blocks
}

function extractXmlTag(block: string, tagName: string) {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i")
  const match = block.match(regex)
  if (!match) return ""
  return stripHtmlTags(match[1] || "").replace(/\s+/g, " ").trim()
}

function isRecentIssue(timestamp: string, hours = 72) {
  if (!timestamp) return false
  const normalized = timestamp.replace(/\./g, "-")
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return false
  const diff = Date.now() - parsed.getTime()
  return diff >= 0 && diff <= hours * 60 * 60 * 1000
}

async function fetchCurrentWeather(nx: number, ny: number, apiKey: string) {
  const { baseDate, baseTime } = getCurrentNowcastBase()
  const cacheKey = `${nx}_${ny}_${baseDate}_${baseTime}`
  const cached = getCachedValue(currentWeatherCache, cacheKey, WEATHER_CACHE_DURATION)
  if (cached) {
    return cached
  }

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
  const forecastDateTimeThreshold = Number(`${getKstCompactDate()}${getKstCompactTime()}`)
  const sortedForecastItems = Array.isArray(skyItems)
    ? [...skyItems].sort((a, b) => `${a.fcstDate}${a.fcstTime}`.localeCompare(`${b.fcstDate}${b.fcstTime}`))
    : []
  const sky = Array.isArray(skyItems)
    ? sortedForecastItems
        .filter((item) => item.category === "SKY")
        .find((item) => (getKstComparableDateTime(item.fcstDate, item.fcstTime) ?? 0) >= forecastDateTimeThreshold)?.fcstValue
      ?? sortedForecastItems.find((item) => item.category === "SKY")?.fcstValue
    : null
  const nearestForecastPty = sortedForecastItems
    .filter((item) => item.category === "PTY")
    .find((item) => {
      const dateTime = getKstComparableDateTime(item.fcstDate, item.fcstTime)
      return dateTime != null && dateTime >= forecastDateTimeThreshold
    }) ?? sortedForecastItems.find((item) => item.category === "PTY")
  const nearestForecastRn1 = sortedForecastItems
    .filter((item) => item.category === "RN1")
    .find((item) => {
      const dateTime = getKstComparableDateTime(item.fcstDate, item.fcstTime)
      return dateTime != null && dateTime >= forecastDateTimeThreshold
    }) ?? sortedForecastItems.find((item) => item.category === "RN1")

  const snapshot: CurrentWeatherSnapshot = {
    temp: parseNumber(byCategory.T1H),
    humidity: parseNumber(byCategory.REH),
    wind: parseNumber(byCategory.WSD),
    pty: parseNumber(byCategory.PTY),
    rn1: parseNumber(byCategory.RN1),
    forecastPty: parseNumber(nearestForecastPty?.fcstValue),
    forecastRn1: parseNumber(nearestForecastRn1?.fcstValue),
    forecastTime: String(nearestForecastPty?.fcstTime || nearestForecastRn1?.fcstTime || ""),
    vec: parseNumber(byCategory.VEC),
    sky: parseNumber(sky, 3),
    lastUpdate: formatKmaDateTime(baseDate, baseTime),
  }

  setCacheWithLimit(currentWeatherCache, cacheKey, { data: snapshot, lastUpdate: Date.now() })
  return snapshot
}

async function fetchAirQuality(profile: RegionProfile, serviceKey: string, dynamicStationName?: string) {
  const explicitProfile = profile
  const normalizedStationName = dynamicStationName?.trim()
  const profileCacheKey = `profile:${explicitProfile.key}:${explicitProfile.areaNo}`
  const homeProfileCacheKey = `profile:${HOME_REGION.key}:${HOME_REGION.areaNo}`
  const cacheKey = normalizedStationName
    ? `station:${normalizedStationName}`
    : profileCacheKey
  const cached = getSmartCachedValue(airQualityCache, cacheKey, 'air', AIR_CACHE_DURATION)
  if (cached) {
    return { data: cached, isFallback: false }
  }

  if (consumeAirQuotaSlot()) {
    if (normalizedStationName) {
      const stationUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?serviceKey=${serviceKey}&returnType=json&numOfRows=48&pageNo=1&stationName=${encodeURIComponent(normalizedStationName)}&dataTerm=DAILY&ver=1.0`
      const stationData = await fetchJsonSafely(stationUrl)
      const stationItems = toArray(stationData?.response?.body?.items?.item)
      const exactStation = stationItems.find(
        (item) => String((item as any)?.stationName ?? "").trim() === normalizedStationName
      )
      const station = exactStation ?? stationItems[0] ?? null

      if (station) {
        const resolvedCacheKey = station.stationName
          ? `station:${station.stationName.trim()}`
          : cacheKey
        const snapshot = buildAirQualitySnapshot(station)

        setCacheWithLimit(airQualityCache, resolvedCacheKey, { data: snapshot, lastUpdate: Date.now() })
        setCacheWithLimit(airQualityCache, profileCacheKey, { data: snapshot, lastUpdate: Date.now() })
        return { data: snapshot, isFallback: false }
      }
    }

    const url = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${serviceKey}&returnType=json&numOfRows=100&pageNo=1&sidoName=${encodeURIComponent(explicitProfile.airSidoName)}&ver=1.0`
    const data = await fetchJsonSafely(url)
    const items = data?.response?.body?.items
    if (Array.isArray(items) && items.length > 0) {
      const station = normalizedStationName
        ? items.find((item) => String(item?.stationName ?? "").trim() === normalizedStationName)
          || pickStationByKeywords(items, explicitProfile.stationKeywords)
        : pickStationByKeywords(items, explicitProfile.stationKeywords)
      if (station) {
        const resolvedCacheKey = station.stationName
          ? `station:${station.stationName.trim()}`
          : cacheKey
        const snapshot = buildAirQualitySnapshot(station)

        setCacheWithLimit(airQualityCache, resolvedCacheKey, { data: snapshot, lastUpdate: Date.now() })
        setCacheWithLimit(airQualityCache, profileCacheKey, { data: snapshot, lastUpdate: Date.now() })
        return { data: snapshot, isFallback: false }
      }
    }
  }

  const profileCached = getSmartCachedValue(airQualityCache, profileCacheKey, "air", AIR_CACHE_DURATION)
  if (profileCached) {
    return { data: profileCached, isFallback: false }
  }

  const homeCached = getSmartCachedValue(airQualityCache, homeProfileCacheKey, "air", AIR_CACHE_DURATION)
    ?? getSmartCachedValue(airQualityCache, HOME_REGION.key, "air", AIR_CACHE_DURATION)
    ?? getCachedValue(airQualityCache, homeProfileCacheKey, AIR_CACHE_DURATION)
    ?? getCachedValue(airQualityCache, HOME_REGION.key, AIR_CACHE_DURATION)
  if (homeCached) {
    return { data: homeCached, isFallback: true }
  }

  setCacheWithLimit(airQualityCache, homeProfileCacheKey, { data: DEFAULT_AIR_QUALITY, lastUpdate: Date.now() })
  setCacheWithLimit(airQualityCache, HOME_REGION.key, { data: DEFAULT_AIR_QUALITY, lastUpdate: Date.now() })
  return { data: DEFAULT_AIR_QUALITY, isFallback: true }
}

async function fetchUvIndex(profile: RegionProfile, serviceKey: string) {
  const cacheKey = `${profile.key}:${profile.areaNo}`
  const cached = getCachedValue(uvCache, cacheKey, UV_CACHE_DURATION)
  if (cached) return cached

  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const url = `https://apis.data.go.kr/1360000/LivingWthrIdxServiceV4/getUVIdxV4?serviceKey=${serviceKey}&dataType=JSON&areaNo=${profile.areaNo}&time=${year}${month}${day}${hour}`
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

  setCacheWithLimit(uvCache, cacheKey, { data: label, lastUpdate: Date.now() })
  return label
}

async function fetchRegionalBulletin(profile: RegionProfile, serviceKey: string) {
  const cacheKey = `${profile.key}:${profile.areaNo}`
  const cached = getCachedValue(bulletinCache, cacheKey, ALERT_CACHE_DURATION)
  if (cached) return cached

  const fetchBulletinItem = async (stationId: string) => {
    const url = `https://apis.data.go.kr/1360000/VilageFcstMsgService/getWthrSituation?serviceKey=${serviceKey}&pageNo=1&numOfRows=10&dataType=JSON&stnId=${stationId}`
    const data = await fetchJsonSafely(url)
    return toArray(data?.response?.body?.items?.item)[0]
  }

  let item = await fetchBulletinItem(profile.weatherStationId)
  if (!item) {
    for (const fallbackStationId of getBulletinFallbackStationIds(profile)) {
      item = await fetchBulletinItem(fallbackStationId)
      if (item) {
        break
      }
    }
  }

  const summary = truncateText(
    stripHtmlTags(String(item?.wfSv1 || item?.wfSv || item?.wn || "")).replace(/\s+/g, " ").trim(),
    420
  )
  const warningStatus = stripHtmlTags(String(item?.wr || "")).trim()
  const normalizedWarning = warningStatus.replace(/\s+/g, "")
  const snapshot: RegionalBulletinSnapshot = {
    summary,
    warningStatus,
    hasAlert: Boolean(warningStatus) && !/없음|none|o없음/i.test(normalizedWarning),
    lastUpdate: String(item?.tmFc || item?.tmSeq || "--:--"),
  }

  setCacheWithLimit(bulletinCache, cacheKey, { data: snapshot, lastUpdate: Date.now() })
  return snapshot
}

async function fetchRegionalWarning(profile: RegionProfile, serviceKey: string) {
  const cacheKey = `${profile.key}:${profile.areaNo}`
  const cached = getCachedValue(warningCache, cacheKey, ALERT_CACHE_DURATION)
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

  setCacheWithLimit(warningCache, cacheKey, { data: snapshot, lastUpdate: Date.now() })
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
    .map((item) => {
      const typedItem = item as any
      return {
        title: stripHtmlTags(String(typedItem?.rem || "")),
        location: stripHtmlTags(String(typedItem?.loc || "")),
        magnitude: parseNumber(typedItem?.mt ?? typedItem?.mag, Number.NaN),
        latitude: parseNumber(typedItem?.lat ?? typedItem?.latitude ?? typedItem?.eqkLat ?? typedItem?.latEqk, Number.NaN),
        longitude: parseNumber(typedItem?.lon ?? typedItem?.longitude ?? typedItem?.eqkLon ?? typedItem?.lonEqk, Number.NaN),
        remark: stripHtmlTags(String(typedItem?.rem || "")),
        occurredAt: String(typedItem?.tmEqk || ""),
      }
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]

  const active = Boolean(latest) && latest.occurredAt.length > 0 && !/국내영향없음|국내 영향 없음|영향없음/.test(latest.remark)
  const snapshot: EarthquakeSnapshot = {
    active,
    title: latest ? formatEarthquakeTitle(latest.location, latest.magnitude) : "",
    location: latest?.location || "",
    magnitude: latest?.magnitude || 0,
    remark: latest?.remark || "",
    occurredAt: latest?.occurredAt || "--:--",
    latitude: Number.isFinite(latest?.latitude) ? latest.latitude : null,
    longitude: Number.isFinite(latest?.longitude) ? latest.longitude : null,
  }

  setCacheWithLimit(earthquakeCache, "national", { data: snapshot, lastUpdate: Date.now() })
  return snapshot
}

async function fetchTsunamiInfo(apiHubKey: string) {
  const cached = getCachedValue(tsunamiCache, "national", ALERT_CACHE_DURATION)
  if (cached) return cached

  const url = `https://apihub.kma.go.kr/api/typ09/url/tsnm/urlTsnmList.do?orderTy=xml&orderCm=L&authKey=${apiHubKey}`
  const xml = await fetchTextSafely(url)
  const info = extractXmlBlocks(xml, "info")[0] || ""

  const messageType = extractXmlTag(info, "msgKo")
  const issueTime = extractXmlTag(info, "tmIssue")
  const eqkTime = extractXmlTag(info, "eqkTm")
  const location = extractXmlTag(info, "eqkLoc")
  const magnitude = parseNumber(extractXmlTag(info, "eqkMag"), Number.NaN)
  const warningHigh = extractXmlTag(info, "wrnHighLoc")
  const warningLow = extractXmlTag(info, "wrnLowLoc")

  const hasWarningRegion = [warningHigh, warningLow].some((value) => value && value !== "-")
  const hasAlertWord = /(특보|경보|주의보)/.test(`${messageType} ${warningHigh} ${warningLow}`)
  const active = (hasWarningRegion || hasAlertWord) && isRecentIssue(issueTime, 72)

  const snapshot: TsunamiSnapshot = {
    active,
    title: formatEarthquakeTitle(location, magnitude),
    location,
    magnitude: Number.isFinite(magnitude) ? magnitude : 0,
    remark: [messageType, warningHigh !== "-" ? warningHigh : "", warningLow !== "-" ? warningLow : ""].filter(Boolean).join(" / "),
    issuedAt: issueTime || eqkTime || "--:--",
  }

  setCacheWithLimit(tsunamiCache, "national", { data: snapshot, lastUpdate: Date.now() })
  return snapshot
}

async function fetchVolcanoInfo(apiHubKey: string) {
  const cached = getCachedValue(volcanoCache, "global", ALERT_CACHE_DURATION)
  if (cached) return cached

  const url = `https://apihub.kma.go.kr/api/typ09/url/volc/selectVolcInfoList.do?orderTy=xml&orderCm=L&authKey=${apiHubKey}`
  const xml = await fetchTextSafely(url)
  const info = extractXmlBlocks(xml, "info")[0] || ""

  const messageType = extractXmlTag(info, "msgCodeKo")
  const name = extractXmlTag(info, "volcName")
  const issueTime = extractXmlTag(info, "tmIssue")
  const location = extractXmlTag(info, "volcLoc")
  const plumeHeight = parseNumber(extractXmlTag(info, "volcHtPlume"), Number.NaN)
  const warningRegion = extractXmlTag(info, "wrnLoc")
  const remark = extractXmlTag(info, "refer")

  const hasWarningRegion = warningRegion && warningRegion !== "-"
  const hasAlertWord = /(특보|주의|경보)/.test(`${messageType} ${warningRegion}`)
  const hasDomesticImpact = !/국내영향\s*예상\s*안\s*됨|국내영향없음/.test(remark)
  const active = (hasWarningRegion || hasAlertWord || hasDomesticImpact) && isRecentIssue(issueTime, 72)

  const snapshot: VolcanoSnapshot = {
    active,
    title: name ? `${name} 화산 정보` : (messageType || "화산 정보"),
    name,
    location,
    plumeHeight: Number.isFinite(plumeHeight) ? plumeHeight : 0,
    remark,
    issuedAt: issueTime || "--:--",
  }

  setCacheWithLimit(volcanoCache, "global", { data: snapshot, lastUpdate: Date.now() })
  return snapshot
}

async function handleGET(req: Request) {
  runMaintenanceSweepIfNeeded()
  const url = new URL(req.url)
  const lat = url.searchParams.get("lat")
  const lon = url.searchParams.get("lon")
  const parsedLat = lat ? Number(lat) : null
  const parsedLon = lon ? Number(lon) : null
  const userLat = Number.isFinite(parsedLat) ? parsedLat : null
  const userLon = Number.isFinite(parsedLon) ? parsedLon : null
  const hasDeviceCoordinates = userLat != null && userLon != null
  const dbForecastPoint = await resolveNearestForecastLocationPoint(userLat, userLon)
  const ip = getClientIp(req)
  const { sessionId, shouldSetCookie } = getOrCreateSessionId(req)
  const profile = mergeRegionProfileWithForecastLocation(
    resolveRegionProfile(userLat, userLon),
    dbForecastPoint
  )
  const recordLocationUsageProof = () => {
    if (!hasDeviceCoordinates) {
      return
    }

    void recordLocationUsageProofSafely({
      request: req,
      routePath: url.pathname,
      method: req.method,
      regionKey: profile.key,
      sessionId,
      eventKind: "weather_current",
    })
  }
  const grid = dbForecastPoint
    ? {
      nx: dbForecastPoint.gridX,
      ny: dbForecastPoint.gridY,
    }
    : (resolveForecastGrid(userLat, userLon) ?? {
      nx: Number(process.env.KMA_NX ?? 63),
      ny: Number(process.env.KMA_NY ?? 89),
    })
  const userCacheKey = [
    sessionId,
    profile.key,
    grid.nx,
    grid.ny,
    userLat != null ? Math.round(userLat * 1000) : "home",
    userLon != null ? Math.round(userLon * 1000) : "home",
  ].join(":")
  const cachedResponse = currentResponseCache.get(userCacheKey)
  if (cachedResponse && cachedResponse.expiry > Date.now()) {
    recordLocationUsageProof()
    const response = NextResponse.json(cachedResponse.data)
    return attachSessionCookie(response, sessionId, shouldSetCookie)
  }

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
    console.error("Weather API keys not configured - KMA:", !!kmaKey, "AIRKOREA:", !!publicServiceKey)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  // 1. Dynamic Nearest Station Lookup
  let dynamicStationName = ""
  let stationLookupSource: "profile" | "cache" | "live_api" = "profile"
  let nearbyStationCandidates: NearbyStationCandidate[] = []
  let tmCoords: { x: number | null; y: number | null } = { x: null, y: null }
  if (hasDeviceCoordinates && userLat != null && userLon != null) {
    const [tmX, tmY] = wgs84ToTm(userLat, userLon)
    tmCoords = { x: tmX, y: tmY }
    const coordsKey = `${Math.round(userLat * 1000)}_${Math.round(userLon * 1000)}`
    const cached = stationCache.get(coordsKey)
    if (cached && cached.expiry > Date.now()) {
      dynamicStationName = cached.name
      nearbyStationCandidates = cached.candidates
      stationLookupSource = "cache"
      tmCoords = { x: cached.tmX, y: cached.tmY }
    } else {
      const nearbyStationUrl = `https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList?serviceKey=${publicServiceKey}&returnType=json&tmX=${tmX}&tmY=${tmY}&ver=1.0`
      const nearbyData = await fetchJsonSafely(nearbyStationUrl)
      const nearbyItems = toArray(nearbyData?.response?.body?.items?.item)
      nearbyStationCandidates = nearbyItems
        .map((item: any) => ({
          name: String(item?.stationName || "").trim(),
          distanceKm: parseNumber(item?.tm, Number.NaN),
        }))
        .filter((item) => item.name.length > 0)
        .slice(0, 3)
        .map((item) => ({
          name: item.name,
          distanceKm: Number.isFinite(item.distanceKm) ? Number(item.distanceKm.toFixed(1)) : undefined,
        }))
      const nearestStation = nearbyStationCandidates[0]?.name
      if (nearestStation) {
        dynamicStationName = nearestStation
        stationLookupSource = "live_api"
        setExpiringCacheWithLimit(stationCache, coordsKey, {
          name: nearestStation,
          tmX,
          tmY,
          candidates: nearbyStationCandidates,
          expiry: Date.now() + STATION_CACHE_TTL,
        }, MAX_STATION_CACHE_KEYS)
      }
    }
  }

  const [weatherData, airResponse, uvIndex, bulletin, warning, earthquake, tsunami, volcano] = await Promise.all([
    fetchCurrentWeather(grid.nx, grid.ny, kmaKey),
    fetchAirQuality(profile, publicServiceKey, dynamicStationName),
    fetchUvIndex(profile, publicServiceKey),
    fetchRegionalBulletin(profile, publicServiceKey),
    fetchRegionalWarning(profile, publicServiceKey),
    fetchEarthquakeInfo(publicServiceKey),
    fetchTsunamiInfo(kmaKey),
    fetchVolcanoInfo(kmaKey),
  ])

  if (!weatherData) {
    return NextResponse.json({ error: "Failed to fetch weather data from KMA" }, { status: 503 })
  }

  const airQuality = airResponse.data
  const isFallback = airResponse.isFallback
  const isRain = (
    weatherData.pty > 0
    || weatherData.rn1 > 0
    || weatherData.forecastPty > 0
    || weatherData.forecastRn1 > 0
  )
  const isEarthquake = earthquake.active
  const isSevereEarthquake = isEarthquake && earthquake.magnitude >= EARTHQUAKE_KNOCKOUT_MAGNITUDE
  const isTsunami = tsunami.active
  const isVolcano = volcano.active
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

  if (isRain || isSevereEarthquake || isWeatherWarning || isTsunami || isVolcano) {
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

  let warningMessage = bulletin.summary
  if (isFallback) {
    warningMessage = "전주 기준 대기질 데이터를 표시 중입니다."
  }
  if (isWeatherWarning) {
    warningMessage = warning.title || bulletin.warningStatus || bulletin.summary
  }
  if (isVolcano) {
    warningMessage = volcano.title || volcano.remark
  }
  if (isTsunami) {
    warningMessage = tsunami.title || tsunami.remark
  }
  if (isEarthquake) {
    warningMessage = earthquake.title || earthquake.remark
  }

  const hasEarthquakeRecord = Boolean(
    earthquake.title
    || (earthquake.occurredAt && earthquake.occurredAt !== "--:--")
  )

  const hazardSourceItems = [
    warning.title,
    warning.content,
    bulletin.warningStatus,
    bulletin.summary,
    earthquake.title,
    earthquake.remark,
  ]
  if (isTsunami) {
    hazardSourceItems.push(tsunami.title, tsunami.remark)
  }
  if (isVolcano) {
    hazardSourceItems.push(volcano.title, volcano.remark)
  }
  const hazardSourceText = hazardSourceItems.join(" ")
  const hazardFlags = detectHazards(hazardSourceText)
  const hazardTags = [
    ...(hazardFlags.typhoon ? ["typhoon"] : []),
    ...((isTsunami || hazardFlags.tsunami) ? ["tsunami"] : []),
    ...((isVolcano || hazardFlags.volcano) ? ["volcano"] : []),
  ]

  const locationLabel = isFallback ? HOME_REGION.displayName : profile.displayName
  const locationLabelEn = isFallback ? HOME_REGION.englishName : profile.englishName
  const feelsLike = calculateFeelsLike(weatherData.temp, weatherData.humidity, weatherData.wind)
  const thermalKrLevel = getKrThermalLevel(feelsLike)
  const thermalWhoLevel = getWhoThermalLevel(feelsLike)

  const responsePayload = {
    score,
    status: statusKey,
    message: messageKey,
    isFallback,
    eventData: {
      isEarthquake,
      isWeatherWarning,
      isRain,
      isTyphoon: hazardFlags.typhoon,
      isTsunami,
      isVolcano,
      warningMessage,
    },
    details: {
      ...weatherData,
      ...airQuality,
      uv: uvIndex,
      feelsLike,
      thermalKrLevel,
      thermalWhoLevel,
    },
    metadata: {
      dataSource: "기상청, 한국환경공단 API (KMA, AirKorea)",
      station: airQuality.station || process.env.AIRKOREA_STATION_NAME || "덕진동",
      region: locationLabel,
      regionEn: locationLabelEn,
      regionKey: isFallback ? HOME_REGION.key : profile.key,
      lastUpdate: { kma: weatherData.lastUpdate, air: airQuality.lastUpdate },
      intervals: { kma: "interval_45m", air: "interval_60m" },
      cachePolicy: {
        weatherMinutes: 45,
        airMinutes: 60,
        alertMinutes: 15,
        forecastHours: 3,
        userMinutes: 5,
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
        earthquakeMagnitude: hasEarthquakeRecord && Number.isFinite(earthquake.magnitude)
          ? Number(earthquake.magnitude.toFixed(1))
          : 0,
        earthquakeCoordinates: hasEarthquakeRecord
          ? {
            lat: earthquake.latitude,
            lon: earthquake.longitude,
          }
          : null,
        earthquakeImageUrl: hasEarthquakeRecord ? buildEarthquakeImageUrl(earthquake) : "",
        tsunamiTitle: isTsunami ? tsunami.title : "",
        tsunamiUpdatedAt: isTsunami ? tsunami.issuedAt : "",
        volcanoTitle: isVolcano ? volcano.title : "",
        volcanoUpdatedAt: isVolcano ? volcano.issuedAt : "",
        hazardTags,
      },
      locationContext: {
        coordinates: {
          lat: userLat,
          lon: userLon,
          source: userLat != null && userLon != null ? "device" : "default",
        },
        grid: {
          nx: grid.nx,
          ny: grid.ny,
        },
        tm: {
          x: tmCoords.x != null ? Math.round(tmCoords.x) : null,
          y: tmCoords.y != null ? Math.round(tmCoords.y) : null,
        },
        stationMap: {
          selected: dynamicStationName || airQuality.station || "",
          source: stationLookupSource,
          candidates: nearbyStationCandidates,
        },
        profile: {
          key: profile.key,
          weatherStationId: profile.weatherStationId,
          forecastLandReg: profile.forecastLandReg,
          forecastTempReg: profile.forecastTempReg,
        },
      },
    },
  }

  currentResponseCache.set(userCacheKey, {
    data: responsePayload,
    expiry: Date.now() + USER_RESPONSE_CACHE_DURATION,
  })

  while (currentResponseCache.size > MAX_USER_RESPONSE_CACHE_KEYS) {
    const oldestKey = currentResponseCache.keys().next().value as string | undefined
    if (!oldestKey) break
    currentResponseCache.delete(oldestKey)
  }

  if (responsePayload.eventData.isWeatherWarning || responsePayload.eventData.isEarthquake || responsePayload.eventData.isTsunami || responsePayload.eventData.isVolcano) {
    broadcastWeatherAlertOnce({
      alertType: responsePayload.eventData.isEarthquake ? "earthquake" : responsePayload.eventData.isTsunami ? "tsunami" : responsePayload.eventData.isVolcano ? "volcano" : "warning",
      message: responsePayload.eventData.warningMessage || undefined,
      score: responsePayload.score,
      status: responsePayload.status,
      alertSummary: responsePayload.metadata?.alertSummary,
    })
  }

  const response = NextResponse.json(responsePayload)
  recordLocationUsageProof()
  return attachSessionCookie(response, sessionId, shouldSetCookie)
}

export const GET = withApiAnalytics(handleGET)
