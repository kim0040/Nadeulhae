import { NextResponse } from "next/server"

import { attachSessionCookie, getOrCreateSessionId } from "@/lib/request-session"
import { getRegionProfileByKey, resolveRegionProfile } from "@/lib/weather-utils"

type FireSummaryItem = {
  OCRN_YMD: string
  SIDO_NM: string
  FIRE_RCPT_MNB: number
  FIRE_PROG_MNB: number
  STN_END_MNB: number
  SLF_EXTSH_MNB: number
  FLSRP_PRCS_MNB: number
  FALS_DCLR_MNB: number
}

type FirePlaceItem = {
  OCRN_YMD: string
  SIDO_NM: string
  FIRE_PLCE_SCTN_NM: string
  OCRN_MNB: number
  PRPT_DMG_SBTT_AMT: number
  LIFE_DMG_PERCNT: number
  VCTM_PERCNT: number
  INJRDPR_PERCNT: number
}

type FireTopPlace = {
  name: string
  count: number
  propertyDamage: number
  casualties: number
  outdoor: boolean
}

type FireSummaryResponse = {
  regionKey: string
  regionName: string
  fireSidoName: string
  metadata: {
    source: string
    latestDate: string
    coverageDays: number
    cacheHours: number
  }
  overview: {
    latestFireReceipt: number
    latestInProgress: number
    latestSituationEnd: number
    sevenDayAverage: number
    sevenDayTotal: number
    peakDate: string
    peakFireReceipt: number
    cautionLevel: "low" | "moderate" | "high"
    showOnHome: boolean
    shortMessageKo: string
    shortMessageEn: string
  }
  dailyTrend: Array<{
    date: string
    fireReceipt: number
    inProgress: number
  }>
  topPlaces: Array<{
    name: string
    count: number
    propertyDamage: number
    casualties: number
    outdoor: boolean
  }>
}

type CacheEntry = {
  expiry: number
  data: FireSummaryResponse
}

type DailySummaryCacheEntry = {
  expiry: number
  items: FireSummaryItem[]
}

type DailyPlaceCacheEntry = {
  expiry: number
  items: FirePlaceItem[]
}

const fireCache = new Map<string, CacheEntry>()
const dailySummaryCache = new Map<string, DailySummaryCacheEntry>()
const dailyPlaceCache = new Map<string, DailyPlaceCacheEntry>()

const FIRE_TODAY_CACHE_TTL = 2 * 60 * 60 * 1000
const FIRE_HISTORY_CACHE_TTL = 30 * 24 * 60 * 60 * 1000

const FIRE_SIDO_NAME_MAP: Record<string, string> = {
  서울: "서울특별시",
  부산: "부산광역시",
  대구: "대구광역시",
  인천: "인천광역시",
  광주: "광주광역시",
  대전: "대전광역시",
  울산: "울산광역시",
  세종: "세종특별자치시",
  경기: "경기도",
  강원: "강원도",
  충북: "충청북도",
  충남: "충청남도",
  전북: "전라북도",
  전남: "전라남도",
  경북: "경상북도",
  경남: "경상남도",
  제주: "제주특별자치도",
}

const OUTDOOR_PLACE_KEYWORDS = ["야외", "들불", "논밭두렁", "쓰레기", "임야", "도로", "산", "들판"]

function getKstDateOffsetLabel(offset: number) {
  const date = new Date()
  date.setHours(date.getHours() + 9)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10).replace(/-/g, "")
}

function toNumber(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function isOutdoorPlace(name: string) {
  return OUTDOOR_PLACE_KEYWORDS.some((keyword) => name.includes(keyword))
}

function getDateCacheTtl(dateKey: string) {
  return dateKey === getKstDateOffsetLabel(0) ? FIRE_TODAY_CACHE_TTL : FIRE_HISTORY_CACHE_TTL
}

async function fetchJsonSafely(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store", next: { revalidate: 0 } })
    if (!response.ok) return null
    const text = await response.text()
    if (!text || text.trim().startsWith("<")) return null
    return JSON.parse(text)
  } catch (error) {
    console.error("Fire API fetch failed:", error)
    return null
  }
}

async function getDailySummaryItems(dateKey: string, serviceKey: string) {
  const cached = dailySummaryCache.get(dateKey)
  if (cached && cached.expiry > Date.now()) {
    return cached.items
  }

  const endpoint = "https://apis.data.go.kr/1661000/FireInformationService/getOcBysidoFireSmrzPcnd"
  const query = new URLSearchParams({
    pageNo: "1",
    numOfRows: "30",
    resultType: "json",
    ocrn_ymd: dateKey,
    ServiceKey: serviceKey,
  })
  const data = await fetchJsonSafely(`${endpoint}?${query.toString()}`)
  const items = Array.isArray(data?.body?.items) ? data.body.items : []

  dailySummaryCache.set(dateKey, {
    items,
    expiry: Date.now() + getDateCacheTtl(dateKey),
  })

  return items
}

async function getDailyPlaceItems(dateKey: string, serviceKey: string) {
  const cached = dailyPlaceCache.get(dateKey)
  if (cached && cached.expiry > Date.now()) {
    return cached.items
  }

  const endpoint = "https://apis.data.go.kr/1661000/FireInformationService/getArFireByplceFpcnd"
  const query = new URLSearchParams({
    pageNo: "1",
    numOfRows: "300",
    resultType: "json",
    ocrn_ymd: dateKey,
    ServiceKey: serviceKey,
  })
  const data = await fetchJsonSafely(`${endpoint}?${query.toString()}`)
  const items = Array.isArray(data?.body?.items) ? data.body.items : []

  dailyPlaceCache.set(dateKey, {
    items,
    expiry: Date.now() + getDateCacheTtl(dateKey),
  })

  return items
}

function createFireNotice(
  cautionLevel: "low" | "moderate" | "high",
  fireSidoName: string,
  topPlaces: Array<{ name: string; outdoor: boolean }>
) {
  const topPlace = topPlaces[0]?.name
  const hasOutdoorSignal = topPlaces.some((place) => place.outdoor)

  if (cautionLevel === "high") {
    return {
      ko: `최근 ${fireSidoName} 화재 접수가 평소보다 많은 편입니다. 바깥 일정 전 한 번 더 살펴두면 좋겠습니다.`,
      en: `Recent fire reports in ${fireSidoName} are running above the usual baseline. It is worth checking before heading outside.`,
    }
  }

  if (hasOutdoorSignal && topPlace) {
    return {
      ko: `최근 ${fireSidoName}에서는 '${topPlace}' 쪽 화재가 눈에 띕니다. 야외 일정 전 가볍게 참고해 두면 좋겠습니다.`,
      en: `Recent fire activity in ${fireSidoName} stands out around '${topPlace}'-type locations. It is a useful extra check before outdoor plans.`,
    }
  }

  return {
    ko: `최근 ${fireSidoName} 화재 흐름은 비교적 차분한 편입니다. 지역 안전 흐름을 가볍게 참고해 주세요.`,
    en: `Recent fire activity in ${fireSidoName} looks relatively calm. Use it as a light regional safety reference.`,
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const regionKey = url.searchParams.get("regionKey")
  const lat = url.searchParams.get("lat")
  const lon = url.searchParams.get("lon")
  const days = Math.min(Math.max(Number(url.searchParams.get("days") || 7), 3), 10)
  const { sessionId, shouldSetCookie } = getOrCreateSessionId(request)

  const userLat = lat ? Number(lat) : null
  const userLon = lon ? Number(lon) : null
  const profile = regionKey
    ? getRegionProfileByKey(regionKey)
    : resolveRegionProfile(userLat, userLon)

  const fireSidoName = FIRE_SIDO_NAME_MAP[profile.airSidoName] || profile.displayName
  const cacheKey = `${profile.key}:${days}`
  const todayKey = getKstDateOffsetLabel(0)
  const includesToday = Array.from({ length: days }, (_, index) => getKstDateOffsetLabel(-index)).includes(todayKey)
  const cached = fireCache.get(cacheKey)
  if (cached && cached.expiry > Date.now()) {
    const response = NextResponse.json(cached.data)
    return attachSessionCookie(response, sessionId, shouldSetCookie)
  }

  const serviceKey = process.env.AIRKOREA_API_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: "Public service key missing" }, { status: 500 })
  }

  const summaryDates = Array.from({ length: days }, (_, index) => getKstDateOffsetLabel(-index))

  const summaryResults = await Promise.all(
    summaryDates.map(async (dateKey) => {
      const items = await getDailySummaryItems(dateKey, serviceKey)
      const match = items.find((item: any) => item?.SIDO_NM === fireSidoName)
      if (!match) return null

      return {
        date: String(match.OCRN_YMD || dateKey),
        fireReceipt: toNumber(match.FIRE_RCPT_MNB),
        inProgress: toNumber(match.FIRE_PROG_MNB),
        situationEnd: toNumber(match.STN_END_MNB),
        selfExtinguish: toNumber(match.SLF_EXTSH_MNB),
        falseProcess: toNumber(match.FLSRP_PRCS_MNB),
        falseDeclaration: toNumber(match.FALS_DCLR_MNB),
      }
    })
  )

  const dailyTrend = summaryResults.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  if (!dailyTrend.length) {
    return NextResponse.json(
      {
        error: "No fire data available for region",
      },
      { status: 404 }
    )
  }

  const latest = dailyTrend[0]
  const sevenDayTotal = dailyTrend.reduce((sum, day) => sum + day.fireReceipt, 0)
  const sevenDayAverage = Math.round((sevenDayTotal / dailyTrend.length) * 10) / 10
  const peakDay = dailyTrend.reduce((peak, current) => current.fireReceipt > peak.fireReceipt ? current : peak, dailyTrend[0])

  const placeData = await getDailyPlaceItems(latest.date, serviceKey)
  const placeItems: FireTopPlace[] = placeData
    .filter((item: FirePlaceItem) => item?.SIDO_NM === fireSidoName)
    .map((item: FirePlaceItem) => ({
      name: String(item.FIRE_PLCE_SCTN_NM || "기타"),
      count: toNumber(item.OCRN_MNB),
      propertyDamage: toNumber(item.PRPT_DMG_SBTT_AMT),
      casualties: toNumber(item.LIFE_DMG_PERCNT),
      outdoor: isOutdoorPlace(String(item.FIRE_PLCE_SCTN_NM || "")),
    }))
    .sort((a: FireTopPlace, b: FireTopPlace) => b.count - a.count || b.propertyDamage - a.propertyDamage)
    .slice(0, 5)

  const cautionLevel: "low" | "moderate" | "high" = (
    latest.fireReceipt >= Math.max(12, sevenDayAverage * 1.4)
      ? "high"
      : latest.fireReceipt >= Math.max(6, sevenDayAverage * 1.1) || placeItems.some((item) => item.outdoor && item.count >= 2)
        ? "moderate"
        : "low"
  )

  const notice = createFireNotice(cautionLevel, fireSidoName, placeItems)

  const payload: FireSummaryResponse = {
    regionKey: profile.key,
    regionName: profile.displayName,
    fireSidoName,
    metadata: {
      source: "소방청 국가화재정보서비스",
      latestDate: latest.date,
      coverageDays: dailyTrend.length,
      cacheHours: includesToday ? 2 : 24,
    },
    overview: {
      latestFireReceipt: latest.fireReceipt,
      latestInProgress: latest.inProgress,
      latestSituationEnd: latest.situationEnd,
      sevenDayAverage,
      sevenDayTotal,
      peakDate: peakDay.date,
      peakFireReceipt: peakDay.fireReceipt,
      cautionLevel,
      showOnHome: cautionLevel !== "low",
      shortMessageKo: notice.ko,
      shortMessageEn: notice.en,
    },
    dailyTrend: dailyTrend.map((day) => ({
      date: day.date,
      fireReceipt: day.fireReceipt,
      inProgress: day.inProgress,
    })),
    topPlaces: placeItems,
  }

  fireCache.set(cacheKey, {
    data: payload,
    expiry: Date.now() + (includesToday ? FIRE_TODAY_CACHE_TTL : FIRE_HISTORY_CACHE_TTL),
  })

  const response = NextResponse.json(payload)
  return attachSessionCookie(response, sessionId, shouldSetCookie)
}
