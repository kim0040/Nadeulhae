import { NextRequest, NextResponse } from "next/server"

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

type ExtraImageKey = "dust" | "lgt" | "fog"

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

const EXTRA_IMAGE_CONFIG: Record<Exclude<ExtraImageKey, "fog" | "dust">, { endpoint: string; cacheMinutes: number }> = {
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
}

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

function parseRequestedExtras(request: NextRequest): ExtraImageKey[] {
  const value = request.nextUrl.searchParams.get("extras")
  if (!value) return []
  const candidates = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  const unique = Array.from(new Set(candidates))
  return unique.filter((item): item is ExtraImageKey => item === "dust" || item === "lgt" || item === "fog")
}

export async function GET(request: NextRequest) {
  const now = Date.now()
  const requestedExtras = parseRequestedExtras(request)

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

  const extras: Partial<Record<ExtraImageKey, WeatherImageSnapshot | null>> = {}
  const extraCacheMinutes: Partial<Record<ExtraImageKey, number>> = {}
  const extraFetchedAt: Partial<Record<ExtraImageKey, string>> = {}

  for (const key of requestedExtras) {
    const cached = extraImageCaches[key]
    const cacheMinutes = key === "fog" || key === "dust" ? 10 : EXTRA_IMAGE_CONFIG[key].cacheMinutes
    const ttl = cacheMinutes * 60 * 1000

    if (!cached || cached.expiry <= now) {
      const latest = key === "fog"
        ? await fetchFogImage()
        : key === "dust"
          ? await fetchAdpsImage()
          : pickLatestItem(await fetchJsonArray(EXTRA_IMAGE_CONFIG[key].endpoint))
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

    extras[key] = extraImageCaches[key]?.data ?? null
    extraCacheMinutes[key] = cacheMinutes
    extraFetchedAt[key] = extraImageCaches[key]?.fetchedAt ?? new Date(0).toISOString()
  }

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
