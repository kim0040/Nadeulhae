/**
 * GET /api/weather/images
 * Proxies weather imagery from KMA (radar, satellite) and hazard maps (fog, dust, earthquake, typhoon, tsunami, volcano).
 * Query: extras (comma-separated keys for additional image types), hazard hint params.
 * Returns: { radar, satellite, extras?, metadata } with reachability-checked image URLs.
 * Caches fetched image metadata with per-type TTL (2-10 minutes).
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiAnalytics } from "@/lib/analytics/route"

type KmaImageItem = {
  name?: string
  tm?: string
  url?: string
}

type WeatherImageSnapshot = {
  name: string
  tm: string
  url: string
}

type ExtraImageKey = "dust" | "lgt" | "fog" | "earthquake" | "typhoon" | "tsunami" | "volcano"
type HazardExtraKey = "typhoon" | "tsunami" | "volcano"

type ImageCacheEntry = {
  data: WeatherImageSnapshot | null
  fetchedAt: string
  expiry: number
}

type ImagesPayload = {
  radar: WeatherImageSnapshot | null
  satellite: WeatherImageSnapshot | null
  extras?: Partial<Record<ExtraImageKey, WeatherImageSnapshot | null>>
  metadata: {
    dataSource: string
    cache: {
      radarMinutes: number
      satelliteMinutes: number
      extras?: Partial<Record<ExtraImageKey, number>>
    }
    fetchedAt: {
      radar: string
      satellite: string
      extras?: Partial<Record<ExtraImageKey, string>>
    }
  }
}

const RADAR_CACHE_MINUTES = 5
const SATELLITE_CACHE_MINUTES = 2
const RADAR_CACHE_TTL = RADAR_CACHE_MINUTES * 60 * 1000
const SATELLITE_CACHE_TTL = SATELLITE_CACHE_MINUTES * 60 * 1000

const EXTRA_IMAGE_CONFIG: Record<Exclude<ExtraImageKey, "fog" | "dust" | "earthquake" | "typhoon" | "tsunami" | "volcano">, { endpoint: string; cacheMinutes: number }> = {
  lgt: {
    endpoint: "https://www.weather.go.kr/w/wnuri-img/rest/lgt/images.do",
    cacheMinutes: 5,
  },
}

let radarCache: ImageCacheEntry | null = null
let satelliteCache: ImageCacheEntry | null = null
const extraImageCaches: Record<ExtraImageKey, ImageCacheEntry | null> = {
  dust: null,
  lgt: null,
  fog: null,
  earthquake: null,
  typhoon: null,
  tsunami: null,
  volcano: null,
}

/** Resolve a possibly-relative KMA image URL to an absolute https URL. */
function resolveImageUrl(url: string) {
  if (!url) return ""
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  if (url.startsWith("/")) return `https://www.weather.go.kr${url}`
  return `https://www.weather.go.kr/${url}`
}

function replaceQueryParam(url: string, key: string, value: string) {
  if (!url) return url
  const pattern = new RegExp(`([?&])${key}=[^&]*`)
  if (pattern.test(url)) {
    return url.replace(pattern, `$1${key}=${value}`)
  }
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}${key}=${value}`
}

function getQueryParam(url: string, key: string) {
  try {
    const resolved = url.startsWith("http") ? new URL(url) : new URL(resolveImageUrl(url))
    return resolved.searchParams.get(key)
  } catch {
    return null
  }
}

async function fetchJsonArray(url: string) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Nadeulhae/1.0)",
      },
    })
    if (!response.ok) return [] as KmaImageItem[]
    const text = await response.text()
    if (!text || text.trim().startsWith("<")) return [] as KmaImageItem[]
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? (parsed as KmaImageItem[]) : []
  } catch {
    return [] as KmaImageItem[]
  }
}

async function fetchJsonObject(url: string) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Nadeulhae/1.0)",
      },
    })
    if (!response.ok) return null
    const text = await response.text()
    if (!text || text.trim().startsWith("<")) return null
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function fetchText(url: string) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Nadeulhae/1.0)",
      },
    })
    if (!response.ok) return ""
    return await response.text()
  } catch {
    return ""
  }
}

/** Pick the latest item by TM field (assumes ascending order). */
function pickLatestItem(items: KmaImageItem[]): WeatherImageSnapshot | null {
  if (!Array.isArray(items) || items.length === 0) return null
  const sorted = [...items].sort((a, b) => String(a.tm || "").localeCompare(String(b.tm || "")))
  const latest = sorted[sorted.length - 1]
  if (!latest?.url) return null
  return {
    name: String(latest.name || ""),
    tm: String(latest.tm || ""),
    url: resolveImageUrl(String(latest.url || "")),
  }
}

async function isReachableImage(url: string) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Nadeulhae/1.0)",
      },
    })
    if (!response.ok) return false
    const contentType = response.headers.get("content-type") || ""
    return contentType.includes("image/")
  } catch {
    return false
  }
}

async function pickLatestReachableItem(items: KmaImageItem[], maxCandidates = 8) {
  if (!Array.isArray(items) || items.length === 0) return null
  const sorted = [...items].sort((a, b) => String(b.tm || "").localeCompare(String(a.tm || "")))
  for (const item of sorted.slice(0, maxCandidates)) {
    const resolvedUrl = resolveImageUrl(String(item.url || ""))
    if (!resolvedUrl) continue
    const reachable = await isReachableImage(resolvedUrl)
    if (!reachable) continue
    return {
      name: String(item.name || ""),
      tm: String(item.tm || ""),
      url: resolvedUrl,
    } satisfies WeatherImageSnapshot
  }
  return null
}

async function fetchRadarImage() {
  // Prefer short-term rainfall forecast because it is more actionable for outdoor planning.
  const qpfItems = await fetchJsonArray("https://www.weather.go.kr/w/wnuri-img/rest/radar/qpf/images.do")
  const qpfLatest = await pickLatestReachableItem(qpfItems)
  if (qpfLatest) {
    const baseTime = getQueryParam(qpfLatest.url, "tm")
    const forecastMinute = getQueryParam(qpfLatest.url, "ef")
    const paddedForecastMinute = forecastMinute?.padStart(3, "0")
    return {
      ...qpfLatest,
      name: "1시간 강수 예측",
      url: baseTime && paddedForecastMinute
        ? `https://vapi.kma.go.kr/BUFD/qpf_ana_img_${baseTime}_m${paddedForecastMinute}_1453.png`
        : resolveImageUrl(replaceQueryParam(qpfLatest.url, "map", "HB")),
    }
  }

  const cmpItems = await fetchJsonArray("https://www.weather.go.kr/w/wnuri-img/rest/radar/cmp/images.do")
  const cmpLatest = await pickLatestReachableItem(cmpItems)
  if (!cmpLatest) return null

  return {
    ...cmpLatest,
    name: "레이더 강수 합성",
    url: resolveImageUrl(replaceQueryParam(cmpLatest.url, "map", "HB")),
  }
}

async function fetchSatelliteImage() {
  const items = await fetchJsonArray("https://www.weather.go.kr/w/wnuri-img/rest/sat/images/gk2a.do")
  const reachable = await pickLatestReachableItem(items, 5)
  if (reachable) return reachable
  return pickLatestItem(items)
}

function getUtcDateOffsetLabel(offsetMinutes = 0) {
  const date = new Date(Date.now() + offsetMinutes * 60 * 1000)
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(date.getUTCDate()).padStart(2, "0")
  const hh = String(date.getUTCHours()).padStart(2, "0")
  const mi = String(date.getUTCMinutes()).padStart(2, "0")
  return `${yyyy}${mm}${dd}${hh}${mi}`
}

async function fetchFogImage() {
  const authKey = process.env.APIHUB_KEY || process.env.KMA_API_KEY
  if (!authKey) return null

  const end = getUtcDateOffsetLabel(0)
  const start = getUtcDateOffsetLabel(-180)
  const url = new URL("https://apihub.kma.go.kr/api/typ05/api/GK2A/LE2/FOG/KO/imageList")
  url.searchParams.set("sDate", start)
  url.searchParams.set("eDate", end)
  url.searchParams.set("authKey", authKey)

  const data = await fetchJsonObject(url.toString())
  const items = Array.isArray(data?.list) ? data.list : []
  const latest = items
    .map((item: { item?: string }) => String(item?.item || ""))
    .filter(Boolean)
    .sort()
    .pop()

  if (!latest) return null

  return {
    name: "GK2A 안개 산출물",
    tm: latest,
    url: `/api/weather/images/asset?kind=fog&tm=${latest}`,
  } satisfies WeatherImageSnapshot
}

async function fetchAdpsImage() {
  const authKey = process.env.APIHUB_KEY || process.env.KMA_API_KEY
  if (!authKey) return null

  const end = getUtcDateOffsetLabel(0)
  const start = getUtcDateOffsetLabel(-360)
  const url = new URL("https://apihub.kma.go.kr/api/typ05/api/GK2A/LE2/ADPS/KO/imageList")
  url.searchParams.set("sDate", start)
  url.searchParams.set("eDate", end)
  url.searchParams.set("authKey", authKey)

  const data = await fetchJsonObject(url.toString())
  const items = Array.isArray(data?.list) ? data.list : []
  const latest = items
    .map((item: { item?: string }) => String(item?.item || ""))
    .filter(Boolean)
    .sort()
    .pop()

  if (!latest) return null

  return {
    name: "GK2A 황사 탐지",
    tm: latest,
    url: `/api/weather/images/asset?kind=dust&tm=${latest}`,
  } satisfies WeatherImageSnapshot
}

function parseNumber(value: unknown, fallback = Number.NaN) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function toArray<T>(value: T | T[] | null | undefined) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function getShiftedKstDate(offsetDays: number) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value ?? "0000"
  const month = parts.find((part) => part.type === "month")?.value ?? "01"
  const day = parts.find((part) => part.type === "day")?.value ?? "01"
  return `${year}${month}${day}`
}

function formatEarthquakeTitle(location: string, magnitude: number) {
  if (!location && !Number.isFinite(magnitude)) return "지진 발생 지점"
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

function truncateText(value: string, max = 120) {
  if (!value) return ""
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`
}

function extractXmlBlocks(xml: string, tag: string) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi")
  const matches: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml))) {
    matches.push(match[1] || "")
  }
  return matches
}

function extractXmlTag(xml: string, tag: string) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i")
  const match = xml.match(regex)
  return stripHtmlTags(match?.[1] || "")
}

function parseKstDateTime(raw: string) {
  const compact = raw.replace(/\D/g, "")
  if (compact.length < 12) return null
  const yyyy = Number(compact.slice(0, 4))
  const mm = Number(compact.slice(4, 6))
  const dd = Number(compact.slice(6, 8))
  const hh = Number(compact.slice(8, 10))
  const mi = Number(compact.slice(10, 12))
  if (![yyyy, mm, dd, hh, mi].every(Number.isFinite)) return null
  return new Date(Date.UTC(yyyy, mm - 1, dd, hh - 9, mi))
}

function isRecentIssue(raw: string, hours: number) {
  const parsed = parseKstDateTime(raw)
  if (!parsed) return false
  return Date.now() - parsed.getTime() <= hours * 60 * 60 * 1000
}

function buildHazardSnapshot(
  key: HazardExtraKey,
  input: { title: string; tm?: string; note?: string }
): WeatherImageSnapshot {
  const params = new URLSearchParams()
  params.set("kind", "hazard")
  params.set("type", key)
  params.set("title", truncateText(input.title || `${key} alert`, 120))
  if (input.tm) {
    params.set("tm", getEarthquakeTimeLabel(input.tm))
  }
  if (input.note) {
    params.set("note", truncateText(input.note, 180))
  }

  return {
    name: truncateText(input.title || `${key} alert`, 80),
    tm: input.tm || "",
    url: `/api/weather/images/asset?${params.toString()}`,
  }
}

type HazardHintMap = Partial<Record<HazardExtraKey, { title: string; tm?: string; note?: string }>>

function isHazardExtraKey(key: ExtraImageKey): key is HazardExtraKey {
  return key === "typhoon" || key === "tsunami" || key === "volcano"
}

function parseHazardHints(request: NextRequest): HazardHintMap {
  const get = (key: string) => (request.nextUrl.searchParams.get(key) || "").trim()
  const hints: HazardHintMap = {}

  const typhoonTitle = get("typhoonTitle")
  const tsunamiTitle = get("tsunamiTitle")
  const volcanoTitle = get("volcanoTitle")
  if (typhoonTitle) {
    hints.typhoon = {
      title: typhoonTitle,
      tm: get("typhoonTm"),
      note: get("typhoonNote"),
    }
  }
  if (tsunamiTitle) {
    hints.tsunami = {
      title: tsunamiTitle,
      tm: get("tsunamiTm"),
      note: get("tsunamiNote"),
    }
  }
  if (volcanoTitle) {
    hints.volcano = {
      title: volcanoTitle,
      tm: get("volcanoTm"),
      note: get("volcanoNote"),
    }
  }

  return hints
}

async function fetchEarthquakeImage() {
  const serviceKey = process.env.AIRKOREA_API_KEY
  if (!serviceKey) return null

  const fromTmFc = getShiftedKstDate(-2)
  const toTmFc = getShiftedKstDate(0)
  const url = `https://apis.data.go.kr/1360000/EqkInfoService/getEqkMsg?serviceKey=${serviceKey}&pageNo=1&numOfRows=20&dataType=JSON&fromTmFc=${fromTmFc}&toTmFc=${toTmFc}`
  const data = await fetchJsonObject(url)
  const items = toArray(data?.response?.body?.items?.item)

  const latest = items
    .map((item: any) => ({
      location: stripHtmlTags(String(item?.loc || "")),
      magnitude: parseNumber(item?.mt ?? item?.mag, Number.NaN),
      occurredAt: String(item?.tmEqk || ""),
      latitude: parseNumber(item?.lat ?? item?.latitude ?? item?.eqkLat ?? item?.latEqk, Number.NaN),
      longitude: parseNumber(item?.lon ?? item?.longitude ?? item?.eqkLon ?? item?.lonEqk, Number.NaN),
    }))
    .filter((item) => item.occurredAt.length > 0)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]

  if (!latest) return null

  const params = new URLSearchParams()
  params.set("kind", "earthquake")
  if (Number.isFinite(latest.latitude) && Number.isFinite(latest.longitude)) {
    params.set("lat", latest.latitude.toFixed(4))
    params.set("lon", latest.longitude.toFixed(4))
  }
  if (Number.isFinite(latest.magnitude)) {
    params.set("mag", latest.magnitude.toFixed(1))
  }
  if (latest.location) {
    params.set("loc", latest.location.slice(0, 80))
  }
  const timeLabel = getEarthquakeTimeLabel(latest.occurredAt)
  if (timeLabel) {
    params.set("tm", timeLabel)
  }

  return {
    name: formatEarthquakeTitle(latest.location, latest.magnitude),
    tm: latest.occurredAt,
    url: `/api/weather/images/asset?${params.toString()}`,
  } satisfies WeatherImageSnapshot
}

async function fetchTyphoonImage() {
  const serviceKey = process.env.AIRKOREA_API_KEY
  if (!serviceKey) return null

  const fromTmFc = getShiftedKstDate(-1)
  const toTmFc = getShiftedKstDate(1)
  const url = `https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList?serviceKey=${serviceKey}&pageNo=1&numOfRows=30&dataType=JSON&fromTmFc=${fromTmFc}&toTmFc=${toTmFc}`
  const data = await fetchJsonObject(url)
  const items = toArray(data?.response?.body?.items?.item)
  const latest = items
    .map((item: any) => {
      const title = stripHtmlTags(String(item?.title || ""))
      const content = stripHtmlTags(String(item?.content || ""))
      return {
        title,
        content,
        joined: `${title} ${content}`.trim(),
        tm: String(item?.tmFc || item?.tmSeq || item?.tmEf || ""),
      }
    })
    .filter((item) => /(태풍|typhoon)/i.test(item.joined) && !/해제/.test(item.joined))
    .sort((a, b) => b.tm.localeCompare(a.tm))[0]

  if (!latest) return null
  return buildHazardSnapshot("typhoon", {
    title: latest.title || "태풍 감시",
    tm: latest.tm,
    note: latest.content,
  })
}

async function fetchTsunamiImage() {
  const authKey = process.env.APIHUB_KEY || process.env.KMA_API_KEY
  if (!authKey) return null

  const url = `https://apihub.kma.go.kr/api/typ09/url/tsnm/urlTsnmList.do?orderTy=xml&orderCm=L&authKey=${authKey}`
  const xml = await fetchText(url)
  const info = extractXmlBlocks(xml, "info")[0] || ""
  if (!info) return null

  const messageType = extractXmlTag(info, "msgKo")
  const issueTime = extractXmlTag(info, "tmIssue")
  const warningHigh = extractXmlTag(info, "wrnHighLoc")
  const warningLow = extractXmlTag(info, "wrnLowLoc")
  const location = extractXmlTag(info, "eqkLoc")
  const magnitude = parseNumber(extractXmlTag(info, "eqkMag"), Number.NaN)
  const hasWarningRegion = [warningHigh, warningLow].some((value) => value && value !== "-")
  const hasAlertWord = /(특보|경보|주의보)/.test(`${messageType} ${warningHigh} ${warningLow}`)
  const active = (hasWarningRegion || hasAlertWord) && isRecentIssue(issueTime, 72)
  if (!active) return null

  return buildHazardSnapshot("tsunami", {
    title: formatEarthquakeTitle(location, magnitude) || "지진해일 감시",
    tm: issueTime,
    note: [messageType, warningHigh !== "-" ? warningHigh : "", warningLow !== "-" ? warningLow : ""].filter(Boolean).join(" / "),
  })
}

async function fetchVolcanoImage() {
  const authKey = process.env.APIHUB_KEY || process.env.KMA_API_KEY
  if (!authKey) return null

  const url = `https://apihub.kma.go.kr/api/typ09/url/volc/selectVolcInfoList.do?orderTy=xml&orderCm=L&authKey=${authKey}`
  const xml = await fetchText(url)
  const info = extractXmlBlocks(xml, "info")[0] || ""
  if (!info) return null

  const messageType = extractXmlTag(info, "msgCodeKo")
  const issueTime = extractXmlTag(info, "tmIssue")
  const name = extractXmlTag(info, "volcName")
  const warningRegion = extractXmlTag(info, "wrnLoc")
  const remark = extractXmlTag(info, "refer")
  const hasWarningRegion = warningRegion && warningRegion !== "-"
  const hasAlertWord = /(특보|주의|경보)/.test(`${messageType} ${warningRegion}`)
  const hasDomesticImpact = !/국내영향\s*예상\s*안\s*됨|국내영향없음/.test(remark)
  const active = (hasWarningRegion || hasAlertWord || hasDomesticImpact) && isRecentIssue(issueTime, 72)
  if (!active) return null

  return buildHazardSnapshot("volcano", {
    title: name ? `${name} 화산 정보` : (messageType || "화산 감시"),
    tm: issueTime,
    note: warningRegion && warningRegion !== "-" ? warningRegion : remark,
  })
}

function parseRequestedExtras(request: NextRequest): ExtraImageKey[] {
  const value = request.nextUrl.searchParams.get("extras")
  if (!value) return []
  const candidates = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  const unique = Array.from(new Set(candidates))
  return unique.filter((item): item is ExtraImageKey =>
    item === "dust"
    || item === "lgt"
    || item === "fog"
    || item === "earthquake"
    || item === "typhoon"
    || item === "tsunami"
    || item === "volcano"
  )
}

async function handleGET(request: NextRequest) {
  // === 1. PARSE REQUEST ===
  const now = Date.now()
  const requestedExtras = parseRequestedExtras(request)
  const hazardHints = parseHazardHints(request)

  // === 2. CORE IMAGES — radar (prefer QPF, fallback CMP) ===
  if (!radarCache || radarCache.expiry <= now) {
    const latest = await fetchRadarImage()
    if (latest || !radarCache) {
      radarCache = {
        data: latest,
        fetchedAt: new Date().toISOString(),
        expiry: now + RADAR_CACHE_TTL,
      }
    } else {
      radarCache = {
        ...radarCache,
        expiry: now + RADAR_CACHE_TTL,
      }
    }
  }

  // === 3. SATELLITE IMAGE ===
  if (!satelliteCache || satelliteCache.expiry <= now) {
    const latest = await fetchSatelliteImage()
    if (latest || !satelliteCache) {
      satelliteCache = {
        data: latest,
        fetchedAt: new Date().toISOString(),
        expiry: now + SATELLITE_CACHE_TTL,
      }
    } else {
      satelliteCache = {
        ...satelliteCache,
        expiry: now + SATELLITE_CACHE_TTL,
      }
    }
  }

  // === 4. EXTRA IMAGES (fog, dust, earthquake, typhoon, tsunami, volcano) ===
  const extras: Partial<Record<ExtraImageKey, WeatherImageSnapshot | null>> = {}
  const extraCacheMinutes: Partial<Record<ExtraImageKey, number>> = {}
  const extraFetchedAt: Partial<Record<ExtraImageKey, string>> = {}

  for (const key of requestedExtras) {
    const cached = extraImageCaches[key]
    const cacheMinutes = key === "fog" || key === "dust"
      ? 10
      : key === "earthquake" || key === "typhoon" || key === "tsunami" || key === "volcano"
        ? 5
        : EXTRA_IMAGE_CONFIG[key].cacheMinutes
    const ttl = cacheMinutes * 60 * 1000

    if (!cached || cached.expiry <= now) {
      let latest: WeatherImageSnapshot | null = null
      if (key === "fog") {
        latest = await fetchFogImage()
      } else if (key === "dust") {
        latest = await fetchAdpsImage()
      } else if (key === "earthquake") {
        latest = await fetchEarthquakeImage()
      } else if (key === "typhoon") {
        latest = await fetchTyphoonImage()
      } else if (key === "tsunami") {
        latest = await fetchTsunamiImage()
      } else if (key === "volcano") {
        latest = await fetchVolcanoImage()
      } else {
        latest = pickLatestItem(await fetchJsonArray(EXTRA_IMAGE_CONFIG[key].endpoint))
      }
      if (latest || !cached) {
        extraImageCaches[key] = {
          data: latest,
          fetchedAt: new Date().toISOString(),
          expiry: now + ttl,
        }
      } else {
        extraImageCaches[key] = {
          ...cached,
          expiry: now + ttl,
        }
      }
    }

    let resolved = extraImageCaches[key]?.data ?? null
    if (!resolved && isHazardExtraKey(key)) {
      const hint = hazardHints[key]
      if (hint?.title) {
        // Hint-based fallback must stay request-scoped and should never pollute the shared cache.
        resolved = buildHazardSnapshot(key, hint)
      }
    }

    extras[key] = resolved
    extraCacheMinutes[key] = cacheMinutes
    extraFetchedAt[key] = extraImageCaches[key]?.fetchedAt ?? new Date(0).toISOString()
  }

  // === 5. RESPONSE BUILDING ===
  const payload: ImagesPayload = {
    radar: radarCache?.data ?? null,
    satellite: satelliteCache?.data ?? null,
    extras: requestedExtras.length > 0 ? extras : undefined,
    metadata: {
      dataSource: "KMA Weather Image REST + API Hub",
      cache: {
        radarMinutes: RADAR_CACHE_MINUTES,
        satelliteMinutes: SATELLITE_CACHE_MINUTES,
        extras: requestedExtras.length > 0 ? extraCacheMinutes : undefined,
      },
      fetchedAt: {
        radar: radarCache?.fetchedAt ?? new Date(0).toISOString(),
        satellite: satelliteCache?.fetchedAt ?? new Date(0).toISOString(),
        extras: requestedExtras.length > 0 ? extraFetchedAt : undefined,
      },
    },
  }

  return NextResponse.json(payload)
}

export const GET = withApiAnalytics(handleGET)
