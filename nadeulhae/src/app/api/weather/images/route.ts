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

type ExtraImageKey = "dust" | "lgt"

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

const EXTRA_IMAGE_CONFIG: Record<ExtraImageKey, { endpoint: string; cacheMinutes: number }> = {
  dust: {
    endpoint: "https://www.weather.go.kr/w/wnuri-img/rest/sat/images/dust.do",
    cacheMinutes: 10,
  },
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
}

function resolveImageUrl(url: string) {
  if (!url) return ""
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  if (url.startsWith("/")) return `https://www.weather.go.kr${url}`
  return `https://www.weather.go.kr/${url}`
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
  // Prefer current composite radar first. It is generally more informative than forecast-only frames.
  const cmpItems = await fetchJsonArray("https://www.weather.go.kr/w/wnuri-img/rest/radar/cmp/images.do")
  const cmpLatest = await pickLatestReachableItem(cmpItems)
  if (cmpLatest) return cmpLatest

  // Fall back to short-term rainfall forecast radar when composite is unavailable.
  const qpfItems = await fetchJsonArray("https://www.weather.go.kr/w/wnuri-img/rest/radar/qpf/images.do")
  return pickLatestReachableItem(qpfItems)
}

async function fetchSatelliteImage() {
  const items = await fetchJsonArray("https://www.weather.go.kr/w/wnuri-img/rest/sat/images/gk2a.do")
  const reachable = await pickLatestReachableItem(items, 5)
  if (reachable) return reachable
  return pickLatestItem(items)
}

function parseRequestedExtras(request: NextRequest): ExtraImageKey[] {
  const value = request.nextUrl.searchParams.get("extras")
  if (!value) return []
  const candidates = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  const unique = Array.from(new Set(candidates))
  return unique.filter((item): item is ExtraImageKey => item === "dust" || item === "lgt")
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
    const config = EXTRA_IMAGE_CONFIG[key]
    const ttl = config.cacheMinutes * 60 * 1000
    const cached = extraImageCaches[key]

    if (!cached || cached.expiry <= now) {
      const latest = pickLatestItem(await fetchJsonArray(config.endpoint))
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
    extraCacheMinutes[key] = config.cacheMinutes
    extraFetchedAt[key] = extraImageCaches[key]?.fetchedAt ?? new Date(0).toISOString()
  }

  const payload: ImagesPayload = {
    radar: radarCache?.data ?? null,
    satellite: satelliteCache?.data ?? null,
    extras: requestedExtras.length > 0 ? extras : undefined,
    metadata: {
      dataSource: "KMA Weather Image REST (weather.go.kr)",
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
