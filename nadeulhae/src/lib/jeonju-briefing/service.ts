import {
  createTavilySearch,
  type TavilySearchDepth,
  type TavilyTimeRange,
  type TavilyTopic,
} from "@/lib/tavily/client"
import { createNanoGptChatCompletion } from "@/lib/chat/nanogpt"
import { saveJeonjuBriefing, getJeonjuBriefingByDateAndLocale, type JeonjuBriefingData } from "./repository"

export type JeonjuBriefingLocale = "ko" | "en"

interface GenerateBriefingOptions {
  locale?: JeonjuBriefingLocale
  forceRefresh?: boolean
  skipMemoryCache?: boolean
}

interface BriefingGenerationResult {
  fromCache: boolean
  data: JeonjuBriefingData
}

type AttemptState = {
  attempts: number
  blockedUntilMs: number
}

type BriefingMemoryCacheEntry = {
  data: JeonjuBriefingData
  expiresAtMs: number
  lastAccessMs: number
}

declare global {
  var __nadeulhaeJeonjuBriefingInflight: Map<string, Promise<BriefingGenerationResult>> | undefined
  var __nadeulhaeJeonjuBriefingAttempts: Map<string, AttemptState> | undefined
  var __nadeulhaeJeonjuBriefingMemoryCache: Map<string, BriefingMemoryCacheEntry> | undefined
}

const JEONJU_BRIEFING_MAX_AUTO_ATTEMPTS = 3
const JEONJU_BRIEFING_MEMORY_CACHE_MAX_ENTRIES = 24

// ------------------------------------------------------------------
// KST Helpers
// ------------------------------------------------------------------

function getYesterdayInKst(): string {
  const now = new Date()
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const yesterday = new Date(kstNow)
  yesterday.setDate(yesterday.getDate() - 1)
  return yesterday.toISOString().slice(0, 10)
}

function getTodayInKst(): string {
  const now = new Date()
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kstNow.toISOString().slice(0, 10)
}

function getFormattedDateLabel(dateStr: string, locale: JeonjuBriefingLocale): string {
  if (locale === "ko") {
    const [year, month, day] = dateStr.split("-")
    return `${year}년 ${Number(month)}월 ${Number(day)}일`
  }
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function getRelativeDayLabel(dateStr: string, locale: JeonjuBriefingLocale): string {
  const today = getTodayInKst()
  if (dateStr === today) return locale === "ko" ? "오늘" : "today"
  if (dateStr === getYesterdayInKst()) return locale === "ko" ? "어제" : "yesterday"
  return getFormattedDateLabel(dateStr, locale)
}

function getBriefingCacheKey(dateStr: string, locale: JeonjuBriefingLocale) {
  return `${dateStr}:${locale}`
}

function getInflightMap() {
  if (!globalThis.__nadeulhaeJeonjuBriefingInflight) {
    globalThis.__nadeulhaeJeonjuBriefingInflight = new Map()
  }
  return globalThis.__nadeulhaeJeonjuBriefingInflight
}

function getAttemptMap() {
  if (!globalThis.__nadeulhaeJeonjuBriefingAttempts) {
    globalThis.__nadeulhaeJeonjuBriefingAttempts = new Map()
  }
  return globalThis.__nadeulhaeJeonjuBriefingAttempts
}

function getBriefingMemoryCacheMap() {
  if (!globalThis.__nadeulhaeJeonjuBriefingMemoryCache) {
    globalThis.__nadeulhaeJeonjuBriefingMemoryCache = new Map()
  }
  return globalThis.__nadeulhaeJeonjuBriefingMemoryCache
}

function isAutoGenerationBlocked(cacheKey: string) {
  const attemptMap = getAttemptMap()
  const state = attemptMap.get(cacheKey)
  if (!state) return false
  return state.blockedUntilMs > Date.now()
}

function markAutoGenerationFailure(cacheKey: string) {
  const attemptMap = getAttemptMap()
  const current = attemptMap.get(cacheKey)
  const nextAttempts = (current?.attempts ?? 0) + 1
  const shouldBlock = nextAttempts >= JEONJU_BRIEFING_MAX_AUTO_ATTEMPTS
  attemptMap.set(cacheKey, {
    attempts: nextAttempts,
    blockedUntilMs: shouldBlock ? getNextKstMidnightMs() : 0,
  })
}

function clearAutoGenerationFailures(cacheKey: string) {
  getAttemptMap().delete(cacheKey)
}

function getKstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}

function getNextKstMidnightMs() {
  const kstNow = getKstNow()
  const next = new Date(kstNow)
  next.setHours(24, 0, 0, 0)
  return next.getTime()
}

function cleanupBriefingMemoryCache(nowMs: number) {
  const cache = getBriefingMemoryCacheMap()
  for (const [key, value] of cache.entries()) {
    if (value.expiresAtMs <= nowMs) {
      cache.delete(key)
    }
  }

  if (cache.size <= JEONJU_BRIEFING_MEMORY_CACHE_MAX_ENTRIES) return

  const sorted = [...cache.entries()].sort((a, b) => a[1].lastAccessMs - b[1].lastAccessMs)
  const overflow = cache.size - JEONJU_BRIEFING_MEMORY_CACHE_MAX_ENTRIES
  for (let i = 0; i < overflow; i += 1) {
    const key = sorted[i]?.[0]
    if (key) cache.delete(key)
  }
}

function getCachedBriefingFromMemory(cacheKey: string): JeonjuBriefingData | null {
  const nowMs = Date.now()
  cleanupBriefingMemoryCache(nowMs)
  const cache = getBriefingMemoryCacheMap()
  const entry = cache.get(cacheKey)
  if (!entry) return null
  if (entry.expiresAtMs <= nowMs) {
    cache.delete(cacheKey)
    return null
  }
  entry.lastAccessMs = nowMs
  cache.set(cacheKey, entry)
  return entry.data
}

function setCachedBriefingToMemory(cacheKey: string, data: JeonjuBriefingData) {
  const nowMs = Date.now()
  const expiresAtMs = Math.max(nowMs + 5 * 60 * 1000, getNextKstMidnightMs())
  const cache = getBriefingMemoryCacheMap()
  cache.set(cacheKey, {
    data,
    expiresAtMs,
    lastAccessMs: nowMs,
  })
  cleanupBriefingMemoryCache(nowMs)
}

function clearCachedBriefingFromMemory(cacheKey: string) {
  getBriefingMemoryCacheMap().delete(cacheKey)
}

function clearAutoGenerationBlock(cacheKey: string) {
  getAttemptMap().delete(cacheKey)
}

export function purgeJeonjuBriefingCache(dateStr: string, locale: JeonjuBriefingLocale) {
  const cacheKey = getBriefingCacheKey(dateStr, locale)
  clearCachedBriefingFromMemory(cacheKey)
  clearAutoGenerationBlock(cacheKey)
}

// ------------------------------------------------------------------
// Tavily Search Types
// ------------------------------------------------------------------

interface SearchResultItem {
  title: string
  url: string
  content: string
  score: number
  weightedScore: number
  publishedDate: string | null
  source: string
  trackKey: string
}

type SearchTrack = {
  key: string
  query: string
  topic: TavilyTopic
  searchDepth: TavilySearchDepth
  timeRange?: TavilyTimeRange
  includeDomains?: string[]
  excludeDomains?: string[]
  includeAnswer?: boolean | "basic" | "advanced"
  country?: string
}

const OFFICIAL_JEONJU_DOMAINS = [
  "jeonju.go.kr",
  "tour.jeonju.go.kr",
  "jeonbuk.go.kr",
]

const LOCAL_NEWS_DOMAINS = [
  "jjan.kr",
  "domin.co.kr",
  "jjn.co.kr",
  "sjbnews.com",
  "jbnews.com",
  "jeonbukilbo.co.kr",
  "jeollailbo.com",
  "jeonmin.co.kr",
  "jeonbuktoday.com",
  "jbsori.com",
]

const LOCAL_BROADCAST_DOMAINS = [
  "jmbc.co.kr",
  "jtv.co.kr",
]

const LOCAL_CULTURE_DOMAINS = [
  "jfac.or.kr",
  "jjcf.or.kr",
]

const LOCAL_EDUCATION_DOMAINS = [
  "jbnu.ac.kr",
  "jj.ac.kr",
]

const LOCAL_UTILITY_DOMAINS = [
  ...OFFICIAL_JEONJU_DOMAINS,
  ...LOCAL_NEWS_DOMAINS,
  ...LOCAL_BROADCAST_DOMAINS,
  ...LOCAL_CULTURE_DOMAINS,
  ...LOCAL_EDUCATION_DOMAINS,
  "nocutnews.co.kr",
  "yna.co.kr",
  "yonhapnews.co.kr",
  "newsis.com",
  "news1.kr",
]

const NOISE_DOMAINS = [
  "namu.wiki",
  "kin.naver.com",
  "blog.naver.com",
  "tistory.com",
  "brunch.co.kr",
  "youtube.com",
  "m.youtube.com",
  "instagram.com",
  "facebook.com",
]

const LOW_VALUE_TITLE_PATTERNS = [
  /보도자료\(목록\)/i,
  /고시\/공고\(목록\)/i,
  /자유게시판/i,
  /Buy 전주/i,
  /알뜰정보마당/i,
  /목록\)/i,
  /보도자료\s*$/i,
  /목록\s*$/i,
  /list$/i,
]

const LOW_VALUE_URL_PATTERNS = [
  /\/board\/list/i,
  /\/planweb\/board\/list/i,
  /\/pdf\/php\/check\.php/i,
  /\/index\.jeonju/i,
]

const UTILITY_SIGNAL_PATTERN = /(교통|통제|우회|안전|주의|행사|축제|공연|전시|개최|운영|마감|신청|접수|점검|단속|공지|보도자료|시정|호우|폭염|미세먼지|개방|휴관|개장|버스|주차|도로)/i
const LOW_UTILITY_PATTERN = /(연예가|가십|트럼프|해외연예)/i

function hasJeonjuSignal(text: string) {
  return /(전주|jeonju|완산|덕진|한옥마을|전주천|전주시청|전주국제영화제)/i.test(text)
}

function normalizePublishedDate(raw: string | null): string | null {
  if (!raw) return null
  const match = raw.match(/(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

function normalizeUrlForDedup(raw: string): string {
  try {
    const url = new URL(raw)
    const keepKeys = new Set(["dataUid", "contentUid", "idxno", "uid"])
    const kept = new URLSearchParams()
    for (const [key, value] of url.searchParams.entries()) {
      if (keepKeys.has(key) && value.length <= 80) {
        kept.set(key, value)
      }
    }
    const query = kept.toString()
    return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`
  } catch {
    return raw
  }
}

function isLowValueResult(url: string, title: string, content: string) {
  if (LOW_VALUE_TITLE_PATTERNS.some((pattern) => pattern.test(title))) return true
  if (LOW_VALUE_URL_PATTERNS.some((pattern) => pattern.test(url))) return true
  if (title.trim().length < 4) return true
  if (content.trim().length < 10) return true
  return false
}

function isLikelyArticleUrl(url: string) {
  return /\/(view|article|news)\b|idxno=|dataUid=|contentUid=/i.test(url)
}

function calcDateDiffDays(baseDateYmd: string, targetDateYmd: string) {
  const baseDate = new Date(`${baseDateYmd}T00:00:00+09:00`)
  const targetDate = new Date(`${targetDateYmd}T00:00:00+09:00`)
  const diffMs = Math.abs(baseDate.getTime() - targetDate.getTime())
  return Math.floor(diffMs / 86_400_000)
}

function calcWeightedScore(item: {
  score: number
  url: string
  title: string
  content: string
  publishedDate: string | null
}, targetDate: string) {
  let weighted = item.score
  const source = extractDomain(item.url)

  if (OFFICIAL_JEONJU_DOMAINS.some((domain) => source.endsWith(domain))) {
    weighted += 0.16
  } else if (LOCAL_UTILITY_DOMAINS.some((domain) => source.endsWith(domain))) {
    weighted += 0.18
  }

  if (item.publishedDate) {
    const days = calcDateDiffDays(targetDate, item.publishedDate)
    if (days <= 1) weighted += 0.28
    else if (days <= 7) weighted += 0.18
    else if (days <= 30) weighted += 0.08
    else if (days > 365) weighted -= 0.35
  } else {
    weighted -= 0.04
  }

  if (/(행사|축제|공연|전시|교통|통제|주의|안전|공지|보도자료|브리핑)/i.test(`${item.title} ${item.content}`)) {
    weighted += 0.08
  }

  if (UTILITY_SIGNAL_PATTERN.test(`${item.title} ${item.content}`)) {
    weighted += 0.22
  } else if (!OFFICIAL_JEONJU_DOMAINS.some((domain) => source.endsWith(domain))) {
    weighted -= 0.1
  }

  if (LOW_UTILITY_PATTERN.test(`${item.title} ${item.content}`)) {
    weighted -= 0.18
  }

  if (isLowValueResult(item.url, item.title, item.content)) {
    weighted -= 0.4
  }

  return weighted
}

function pickDiverseTopResults(items: SearchResultItem[], limit: number) {
  const prioritizedTracks = ["city-hall", "events", "safety", "governance", "local-news", "fallback-news", "fallback-general"]
  const picked: SearchResultItem[] = []
  const consumed = new Set<number>()
  const trackCounts = new Map<string, number>()
  const increment = (trackKey: string) => {
    trackCounts.set(trackKey, (trackCounts.get(trackKey) ?? 0) + 1)
  }
  const canPick = (trackKey: string) => (trackCounts.get(trackKey) ?? 0) < 3

  for (const track of prioritizedTracks) {
    const index = items.findIndex((item, idx) => !consumed.has(idx) && item.trackKey === track && canPick(item.trackKey))
    if (index >= 0) {
      consumed.add(index)
      picked.push(items[index])
      increment(items[index].trackKey)
    }
    if (picked.length >= limit) break
  }

  for (let i = 0; i < items.length && picked.length < limit; i += 1) {
    if (consumed.has(i)) continue
    if (!canPick(items[i].trackKey)) continue
    consumed.add(i)
    picked.push(items[i])
    increment(items[i].trackKey)
  }

  return picked
}

function buildPrimarySearchTracks(dateStr: string, locale: JeonjuBriefingLocale): SearchTrack[] {
  if (locale === "ko") {
    return [
      {
        key: "local-news",
        query: `전주 어제 주요 뉴스 소식 교통 행사 ${dateStr}`,
        topic: "news",
        searchDepth: "basic",
        timeRange: "week",
        includeDomains: LOCAL_UTILITY_DOMAINS,
        excludeDomains: NOISE_DOMAINS,
        includeAnswer: "advanced",
        country: "south korea",
      },
      {
        key: "city-hall",
        query: `전주시청 전라북도 보도자료 공지 행사 안내 ${dateStr}`,
        topic: "general",
        searchDepth: "basic",
        timeRange: "week",
        includeDomains: [...OFFICIAL_JEONJU_DOMAINS, "jeonbuk.go.kr"],
        excludeDomains: NOISE_DOMAINS,
        country: "south korea",
      },
      {
        key: "events",
        query: `전주 축제 행사 공연 교통통제 사건사고 ${dateStr}`,
        topic: "news",
        searchDepth: "basic",
        timeRange: "week",
        includeDomains: LOCAL_UTILITY_DOMAINS,
        excludeDomains: NOISE_DOMAINS,
      },
    ]
  }

  return [
      {
        key: "local-news",
        query: `Jeonju latest news local events traffic updates yesterday ${dateStr}`,
        topic: "news",
      searchDepth: "basic",
      timeRange: "week",
      includeDomains: LOCAL_UTILITY_DOMAINS,
      excludeDomains: NOISE_DOMAINS,
      includeAnswer: "advanced",
      country: "south korea",
    },
      {
        key: "city-hall",
        query: `Jeonju city hall press release official notice announcement ${dateStr}`,
        topic: "general",
        searchDepth: "basic",
        timeRange: "week",
        includeDomains: [...OFFICIAL_JEONJU_DOMAINS, "jeonbuk.go.kr"],
        excludeDomains: NOISE_DOMAINS,
        country: "south korea",
      },
    {
      key: "events",
      query: `Jeonju festival event traffic safety update ${dateStr}`,
      topic: "news",
      searchDepth: "basic",
      timeRange: "week",
      includeDomains: LOCAL_UTILITY_DOMAINS,
      excludeDomains: NOISE_DOMAINS,
    },
  ]
}

function buildFallbackSearchTracks(dateStr: string, locale: JeonjuBriefingLocale): SearchTrack[] {
  if (locale === "ko") {
    return [
      {
        key: "fallback-news",
        query: `전주 최근 소식 요약 ${dateStr}`,
        topic: "news",
        searchDepth: "basic",
        timeRange: "week",
        excludeDomains: NOISE_DOMAINS,
      },
      {
        key: "fallback-general",
        query: `전주 생활 정보 교통 행사 공지 ${dateStr}`,
        topic: "general",
        searchDepth: "basic",
        timeRange: "month",
        excludeDomains: NOISE_DOMAINS,
        country: "south korea",
      },
    ]
  }

  return [
    {
      key: "fallback-news",
      query: `recent Jeonju local updates ${dateStr}`,
      topic: "news",
      searchDepth: "basic",
      timeRange: "week",
      excludeDomains: NOISE_DOMAINS,
    },
    {
      key: "fallback-general",
      query: `Jeonju local advisory events traffic notice ${dateStr}`,
      topic: "general",
      searchDepth: "basic",
      timeRange: "month",
      excludeDomains: NOISE_DOMAINS,
      country: "south korea",
    },
  ]
}

function getPlannedQuerySummary(dateStr: string, locale: JeonjuBriefingLocale) {
  return buildPrimarySearchTracks(dateStr, locale).map((track) => track.query).join(" | ")
}

async function executeMultiSearch(dateStr: string, locale: JeonjuBriefingLocale): Promise<{
  results: SearchResultItem[]
  answer: string | null
  totalSearches: number
  mergedQuerySummary: string
}> {
  const selectedByUrl = new Map<string, SearchResultItem>()
  const allTrackQueries: string[] = []
  let combinedAnswer: string | null = null

  const collectTracks = async (tracks: SearchTrack[]) => {
    const settled = await Promise.allSettled(tracks.map(async (track) => {
      try {
        const response = await createTavilySearch({
          query: track.query,
          topic: track.topic,
          searchDepth: track.searchDepth,
          maxResults: 10,
          includeAnswer: track.includeAnswer ?? false,
          timeRange: track.timeRange,
          includeDomains: track.includeDomains,
          excludeDomains: track.excludeDomains,
          country: track.country,
        })

        return { track, response }
      } catch (error) {
        console.warn(`[jeonju-briefing] Tavily search failed for "${track.query}":`, error)
        return null
      }
    }))

    for (const candidate of settled) {
      if (candidate.status !== "fulfilled" || !candidate.value) continue
      const { track, response } = candidate.value
      allTrackQueries.push(track.query)
      if (response.answer && !combinedAnswer) {
        combinedAnswer = response.answer
      }

      for (const item of response.results) {
        if (!item.url || item.score < 0.2) continue
        const normalizedDate = normalizePublishedDate(item.publishedDate)
        const composedText = `${item.title} ${item.content}`
        const domain = extractDomain(item.url)
        const hasUtilitySignal = UTILITY_SIGNAL_PATTERN.test(composedText)
        if (!hasJeonjuSignal(composedText) && !domain.includes("jeonju")) continue
        if (LOW_UTILITY_PATTERN.test(composedText) && !hasUtilitySignal) continue
        if (!normalizedDate && !isLikelyArticleUrl(item.url) && !hasUtilitySignal) continue
        if (isLowValueResult(item.url, item.title, item.content)) continue

        const weightedScore = calcWeightedScore({
          score: item.score,
          url: item.url,
          title: item.title,
          content: item.content,
          publishedDate: normalizedDate,
        }, dateStr)
        if (weightedScore < 0.2) continue

        const normalizedUrl = normalizeUrlForDedup(item.url)
        const mapped: SearchResultItem = {
          title: item.title.trim(),
          url: item.url.trim(),
          content: item.content.trim(),
          score: item.score,
          weightedScore,
          publishedDate: normalizedDate,
          source: domain,
          trackKey: track.key,
        }

        const existing = selectedByUrl.get(normalizedUrl)
        if (!existing || mapped.weightedScore > existing.weightedScore) {
          selectedByUrl.set(normalizedUrl, mapped)
        }
      }
    }
  }

  await collectTracks(buildPrimarySearchTracks(dateStr, locale))
  if (selectedByUrl.size < 5) {
    await collectTracks(buildFallbackSearchTracks(dateStr, locale))
  }

  const ranked = [...selectedByUrl.values()].sort((a, b) => b.weightedScore - a.weightedScore)
  const allResults = pickDiverseTopResults(ranked, 10)

  return {
    results: allResults,
    answer: combinedAnswer,
    totalSearches: allTrackQueries.length,
    mergedQuerySummary: allTrackQueries.join(" | "),
  }
}

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname
    return hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

// ------------------------------------------------------------------
// JSON Extraction
// ------------------------------------------------------------------

function extractJsonFromResponse(content: string): string | null {
  const trimmed = content.trim()

  if (trimmed.startsWith("```")) {
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start >= 0 && end > start) {
      return trimmed.slice(start, end + 1)
    }
  }

  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return null
}

// ------------------------------------------------------------------
// Main Public API
// ------------------------------------------------------------------

export async function generateJeonjuBriefing(
  options: GenerateBriefingOptions = {}
): Promise<BriefingGenerationResult> {
  const {
    locale = "ko",
    forceRefresh = false,
    skipMemoryCache = false,
  } = options
  const yesterdayDate = getYesterdayInKst()
  const cacheKey = getBriefingCacheKey(yesterdayDate, locale)

  // 1. Check in-memory cache first (per process, fast-path).
  if (!forceRefresh && !skipMemoryCache) {
    const memoryCached = getCachedBriefingFromMemory(cacheKey)
    if (memoryCached) {
      return { fromCache: true, data: memoryCached }
    }
  }

  // 2. Check DB cache.
  if (!forceRefresh) {
    try {
      const cached = await getJeonjuBriefingByDateAndLocale(yesterdayDate, locale)
      if (cached && cached.newsItems.length > 0) {
        setCachedBriefingToMemory(cacheKey, cached)
        console.log(`[jeonju-briefing] Serving cached briefing for ${yesterdayDate} (${locale})`)
        return { fromCache: true, data: cached }
      }
    } catch {
      // ignore cache errors
    }
  }

  // 3. Auto-generation safety: avoid repeated re-calls when upstream fails.
  if (!forceRefresh && isAutoGenerationBlocked(cacheKey)) {
    const blocked = createFallbackBriefing(yesterdayDate, locale)
    setCachedBriefingToMemory(cacheKey, blocked)
    return { fromCache: false, data: blocked }
  }

  // 4. De-duplicate concurrent requests for the same date/locale.
  const inflightMap = getInflightMap()
  const existing = inflightMap.get(cacheKey)
  if (existing) return existing

  const generationPromise = (async (): Promise<BriefingGenerationResult> => {
    // 5. Generate fresh briefing
    try {
      const result = await fetchAndSummarize(yesterdayDate, locale)

      // Save to memory cache first so repeated reads do not hit DB.
      setCachedBriefingToMemory(cacheKey, result)

      // 6. Save to DB (best-effort)
      try {
        const plannedQueries = getPlannedQuerySummary(yesterdayDate, locale)
        await saveJeonjuBriefing({
          briefingDate: yesterdayDate,
          locale: result.locale,
          headline: result.headline,
          summary: result.summary,
          newsItems: result.newsItems,
          aiInsight: result.aiInsight,
          weatherNote: result.weatherNote,
          festivalNote: result.festivalNote,
          keywordTags: result.keywordTags,
          searchQuery: plannedQueries,
          modelUsed: result.modelUsed,
          promptTokens: result.tokenUsage?.promptTokens ?? 0,
          completionTokens: result.tokenUsage?.completionTokens ?? 0,
          totalTokens: result.tokenUsage?.totalTokens ?? 0,
        })
        console.log(`[jeonju-briefing] Saved briefing for ${yesterdayDate} (${locale})`)
      } catch (saveError) {
        console.warn("[jeonju-briefing] Save to DB failed:", saveError)
      }

      clearAutoGenerationFailures(cacheKey)
      return { fromCache: false, data: result }
    } catch (error) {
      console.error("[jeonju-briefing] Generation failed:", error)
      markAutoGenerationFailure(cacheKey)

      // Stale cache fallback (same date+locale)
      try {
        const stale = await getJeonjuBriefingByDateAndLocale(yesterdayDate, locale)
        if (stale) {
          setCachedBriefingToMemory(cacheKey, stale)
          return { fromCache: true, data: stale }
        }
      } catch {
        // ignore
      }

      // Save fallback once to prevent repeated auto-calls on this date.
      const fallback = createFallbackBriefing(yesterdayDate, locale)
      setCachedBriefingToMemory(cacheKey, fallback)
      try {
        await saveJeonjuBriefing({
          briefingDate: yesterdayDate,
          locale,
          headline: fallback.headline,
          summary: fallback.summary,
          newsItems: fallback.newsItems,
          aiInsight: fallback.aiInsight,
          weatherNote: fallback.weatherNote,
          festivalNote: fallback.festivalNote,
          keywordTags: fallback.keywordTags,
          searchQuery: "fallback",
          modelUsed: null,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        })
      } catch {
        // ignore save fallback failure
      }

      return { fromCache: false, data: fallback }
    } finally {
      inflightMap.delete(cacheKey)
    }
  })()

  inflightMap.set(cacheKey, generationPromise)

  return generationPromise
}

// ------------------------------------------------------------------
// Core: Fetch + Summarize
// ------------------------------------------------------------------

export async function fetchAndSummarize(
  dateStr: string,
  locale: JeonjuBriefingLocale
): Promise<JeonjuBriefingData & { tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  const dateLabel = getFormattedDateLabel(dateStr, locale)
  const relativeLabel = getRelativeDayLabel(dateStr, locale)

  // 1. Run Tavily searches
  const { results: allResults, answer: searchAnswer, totalSearches } = await executeMultiSearch(dateStr, locale)

  console.log(`[jeonju-briefing] Tavily returned ${allResults.length} unique results from ${totalSearches} queries`)

  // 2. Build structured search context for LLM
  const searchContext = buildSearchContext(allResults, searchAnswer, locale, dateLabel)

  // 3. Build LLM prompt
  const systemPrompt = buildSystemPrompt(dateLabel, relativeLabel, locale)

  // 4. Call NanoGPT LLM
  let completionContent: string
  let modelUsed: string | null = null
  let tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  }
  try {
    const completion = await createNanoGptChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: searchContext },
      ],
      requestKind: "chat",
      maxTokens: 2200,
      temperature: 0.2,
    })
    completionContent = completion.content
    modelUsed = completion.resolvedModel
    tokenUsage = {
      promptTokens: completion.usage.promptTokens ?? 0,
      completionTokens: completion.usage.completionTokens ?? 0,
      totalTokens: completion.usage.totalTokens ?? 0,
    }
    console.log(`[jeonju-briefing] LLM response: ${completionContent.slice(0, 100)}... (tokens: ${tokenUsage.totalTokens})`)
  } catch (llmError) {
    const msg = llmError instanceof Error ? llmError.message : String(llmError)
    const cause = (llmError as any)?.cause?.code ?? (llmError as any)?.cause?.message ?? ""
    const prefix = msg.includes("AbortError") || cause.includes("ETIMEDOUT") || cause.includes("ECONNREFUSED")
      ? `LLM connection failed${cause ? ` (${cause})` : ""}`
      : msg.includes("global_daily_limit")
        ? "LLM daily limit reached"
        : `LLM error: ${msg.slice(0, 80)}`
    console.error(`[jeonju-briefing] ${prefix} — falling back to search-only briefing. Check NANOGPT_API_KEY and NANOGPT_BASE_URL in .env.local.`)
    return buildPartialBriefing(dateStr, locale, allResults, null)
  }

  // 5. Parse LLM JSON
  const jsonText = extractJsonFromResponse(completionContent)

  let parsed: ParsedBriefing = {
    headline: "",
    summary: "",
    newsItems: [],
    aiInsight: null,
    weatherNote: null,
    festivalNote: null,
    keywordTags: [],
  }

  if (jsonText) {
    try {
      parsed = parseBriefingJson(jsonText)
    } catch (parseError) {
      console.error("[jeonju-briefing] JSON parse failed, using raw content as summary:", parseError)
      // Strip JSON structure from raw content: keep only text before the first '{'
      const firstBrace = completionContent.indexOf("{")
      const textOnly = firstBrace > 0
        ? completionContent.slice(0, firstBrace).trim()
        : completionContent
      parsed.summary = textOnly.slice(0, 1200)
    }
  } else {
    parsed.summary = completionContent.slice(0, 1200)
  }

  // 6. Normalize & build final result
  return buildFinalBriefing(dateStr, locale, allResults, parsed, modelUsed, tokenUsage)
}

// ------------------------------------------------------------------
// Context Building
// ------------------------------------------------------------------

function buildSearchContext(
  results: SearchResultItem[],
  searchAnswer: string | null,
  locale: JeonjuBriefingLocale,
  dateLabel: string
): string {
  const lines: string[] = []

  if (searchAnswer) {
    lines.push(`[Search Summary]\n${searchAnswer}\n`)
  }

  if (results.length > 0) {
    lines.push(`[Results: ${results.length}]`)
    results.slice(0, 10).forEach((r, i) => {
      lines.push(
        `${i + 1}. ${r.title}` +
        `\n   ${r.source} | ${r.publishedDate || "date unknown"}` +
        `\n   ${r.content.slice(0, 400)}`
      )
    })
  } else {
    lines.push("[No search results found]")
  }

  lines.push(`\nReference date: ${dateLabel}`)
  return lines.join("\n")
}

// ------------------------------------------------------------------
// System Prompt
// ------------------------------------------------------------------

function buildSystemPrompt(
  dateLabel: string,
  relativeLabel: string,
  locale: JeonjuBriefingLocale
): string {
  if (locale === "ko") {
    return `당신은 '나들AI'입니다. 전주 시민과 방문객을 위해 어제(${dateLabel}, ${relativeLabel})의 전주 소식을 친근하게 브리핑합니다.

순수 JSON만 반환하세요. 마크다운/코드블록/설명 텍스트 없이 JSON 오브젝트만 출력합니다.

{
  "headline": "어제 전주 핵심을 담은 친근한 한 줄 제목 (25자 이내)",
  "summary": "5~7문장의 상세하고 자연스러운 아침 브리핑. 기사 내용을 구체적으로 풀어서 친한 친구에게 이야기하듯 써주세요.",
  "newsItems": [{"title":"제목","url":"https://...","source":"출처","snippet":"핵심 요약(80자이내)","publishedDate":"YYYY-MM-DD"}],
  "aiInsight": "오늘 일정에 참고할 실용적인 팁 1~2개 (각 항목 '•'로 시작)",
  "weatherNote": "날씨 정보 또는 null",
  "festivalNote": "행사/축제 정보 또는 null",
  "keywordTags": ["#전주", "#태그"]
}

규칙:
- summary 첫 문장: "안녕하세요! 나들AI예요 ☀️ 어제 전주에서 있었던 일들을 알려드릴게요~" 로 시작
- 이후 4~6문장으로 어제의 핵심 소식을 구체적으로 브리핑. 기사의 단순 나열을 피하고 자연스러운 흐름으로 설명.
- 마지막 문장은 오늘 하루를 응원하는 따뜻한 마무리.
- '핵심상황:', '오늘영향:', '체크포인트' 같은 딱딱한 라벨 절대 금지.
- newsItems: 최대 6개, 실제 URL만. snippet은 구체적으로 80자 이내.
- aiInsight: 어제 소식과 관련된 실용적 팁 1~2개. "•" 로 시작. 예: "• 방문 전 운영시간을 꼭 확인하세요."
- 검색 결과가 부족하면 솔직하게 "어제는 특별한 새 소식이 많지 않았어요" 라고 자연스럽게.
- 지어내기 금지. null은 null로 (빈 문자열 금지).
- JSON 외 텍스트 출력 금지.`
  }

  return `You are 'NadeulAI'. You brief Jeonju visitors and residents on yesterday's (${dateLabel}, ${relativeLabel}) local news in a warm, friendly tone.

Return ONLY pure JSON. No markdown, no code blocks, no extra text.

{
  "headline": "Friendly one-line title about yesterday's Jeonju news (under 35 chars)",
  "summary": "5-7 sentence detailed and warm morning briefing, covering each story naturally like telling a friend.",
  "newsItems": [{"title":"Title","url":"https://...","source":"Source","snippet":"Specific summary of the article (under 80 chars)","publishedDate":"YYYY-MM-DD"}],
  "aiInsight": "1-2 practical tips related to yesterday's news, each starting with '•'",
  "weatherNote": "Weather info or null",
  "festivalNote": "Event/festival info or null",
  "keywordTags": ["#Jeonju", "#tag"]
}

Rules:
- summary must start with: "Hi there! It's NadeulAI ☀️ Let me catch you up on what happened in Jeonju yesterday~"
- Follow with 4-6 sentences detailing the key stories with smooth transitions.
- End with a warm, encouraging closing line for today.
- NO rigid labels like "Core:", "Impact:", "Checklist:".
- newsItems: max 6, real URLs only. Snippets up to 80 chars.
- aiInsight: 1-2 practical tips tied to the news. E.g. "• Verify operating hours before visiting."
- If search results are thin, honestly say "there weren't many notable updates yesterday".
- Never fabricate. Use null for missing fields (not empty strings).
- Output NOTHING besides valid JSON.`
}

// ------------------------------------------------------------------
// Parsing
// ------------------------------------------------------------------

interface ParsedBriefing {
  headline: string
  summary: string
  newsItems: JeonjuBriefingData["newsItems"]
  aiInsight: string | null
  weatherNote: string | null
  festivalNote: string | null
  keywordTags: string[]
}

function ensureFriendlyIntro(summary: string, locale: JeonjuBriefingLocale) {
  const trimmed = summary.trim()
  if (!trimmed) return trimmed
  const koIntro = "안녕하세요! 나들AI예요 ☀️ 어제 전주에서 있었던 일들을 알려드릴게요~"
  const enIntro = "Hi there! It's NadeulAI ☀️ Let me catch you up on what happened in Jeonju yesterday~"
  const intro = locale === "ko" ? koIntro : enIntro
  if (trimmed.startsWith(koIntro) || trimmed.startsWith(enIntro)) {
    return trimmed
  }
  // Also check for old intros
  if (trimmed.startsWith("안녕하세요!") || trimmed.startsWith("Hi there!") || trimmed.startsWith("Hello!")) {
    return trimmed
  }
  return `${intro} ${trimmed}`
}

function parseBriefingJson(jsonText: string): ParsedBriefing {
  const parsed = JSON.parse(jsonText) as Record<string, unknown>

  const parseNewsItems = (): JeonjuBriefingData["newsItems"] => {
    if (!Array.isArray(parsed.newsItems)) return []
    return parsed.newsItems
      .map((item: unknown) => {
        if (typeof item !== "object" || item === null) return null
        const i = item as Record<string, unknown>
        const url = String(i.url || "")
        if (!url.startsWith("http")) return null
        const title = String(i.title || "").trim()
        if (!title) return null
        return {
          title,
          url,
          source: String(i.source || extractDomain(url)).trim() || "링크",
          snippet: String(i.snippet || "").trim(),
          publishedDate: i.publishedDate && String(i.publishedDate).length > 0
            ? String(i.publishedDate)
            : null,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }

  const parseNullable = (key: string): string | null => {
    const value = parsed[key]
    if (value === null || value === undefined) return null
    const str = String(value).trim()
    return str.length > 0 ? str : null
  }

  const parseTags = (): string[] => {
    if (!Array.isArray(parsed.keywordTags)) return []
    return parsed.keywordTags.map((t) => String(t).trim()).filter((t) => t.length > 0)
  }

  return {
    headline: String(parsed.headline || "").trim(),
    summary: String(parsed.summary || "").trim(),
    newsItems: parseNewsItems(),
    aiInsight: parseNullable("aiInsight"),
    weatherNote: parseNullable("weatherNote"),
    festivalNote: parseNullable("festivalNote"),
    keywordTags: parseTags(),
  }
}

// ------------------------------------------------------------------
// Final Assembly
// ------------------------------------------------------------------

function extractYmd(value: string | null | undefined): string | null {
  if (!value) return null
  const match = value.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function resolveNewsItemDate(item: JeonjuBriefingData["newsItems"][number]): string | null {
  return (
    extractYmd(item.publishedDate)
    || extractYmd(item.snippet)
    || extractYmd(item.url)
    || null
  )
}

function isStaleComparedToTarget(targetDate: string, candidateDate: string | null) {
  if (!candidateDate) return false
  const days = calcDateDiffDays(targetDate, candidateDate)
  return days > 120
}

function isLowUtilityNewsItem(
  item: JeonjuBriefingData["newsItems"][number],
  targetDate: string
) {
  const merged = `${item.title} ${item.snippet}`
  const sourceDomain = extractDomain(item.url)
  const hasOfficialSource = OFFICIAL_JEONJU_DOMAINS.some((domain) => sourceDomain.endsWith(domain))
  if (!hasOfficialSource && !hasJeonjuSignal(merged)) return true
  if (isLowValueResult(item.url, item.title, item.snippet)) return true
  if (LOW_UTILITY_PATTERN.test(merged)) return true
  const resolvedDate = resolveNewsItemDate(item)
  if (isStaleComparedToTarget(targetDate, resolvedDate)) return true
  return false
}

function normalizeNewsItemsForBriefing(
  items: JeonjuBriefingData["newsItems"],
  targetDate: string
) {
  const dedup = new Set<string>()
  const normalized: JeonjuBriefingData["newsItems"] = []

  for (const raw of items) {
    const key = normalizeUrlForDedup(raw.url)
    if (dedup.has(key)) continue
    dedup.add(key)

    const nextItem = {
      ...raw,
      publishedDate: resolveNewsItemDate(raw),
      snippet: raw.snippet.replace(/\s+/g, " ").trim().slice(0, 110),
    }

    if (isLowUtilityNewsItem(nextItem, targetDate)) continue
    normalized.push(nextItem)
    if (normalized.length >= 6) break
  }

  return normalized
}



function buildNarrativeSummary(
  locale: JeonjuBriefingLocale,
  dateLabel: string,
  items: JeonjuBriefingData["newsItems"]
) {
  const top = items[0]
  const second = items[1]

  if (locale === "ko") {
    if (!top) {
      return ensureFriendlyIntro(
        `어제는 전주에서 특별히 새로운 소식이 많지 않았어요. 전주시청 공지나 교통 정보를 가볍게 확인해보시는 걸 추천드려요. 오늘도 좋은 하루 되세요! 😊`,
        locale
      )
    }
    const body = second
      ? `어제는 "${top.title}" 소식이 있었고, "${second.title}" 관련 내용도 확인됐어요. 총 ${items.length}건의 소식을 모아봤는데요, 오늘 외출하시기 전에 한번 훑어보시면 도움이 될 거예요!`
      : `어제는 "${top.title}" 관련 소식이 주목할 만했어요. 오늘 일정 시작 전에 가볍게 확인해보세요!`
    return ensureFriendlyIntro(body, locale)
  }

  if (!top) {
    return ensureFriendlyIntro(
      `It was a pretty quiet day in Jeonju yesterday! I'd recommend checking official city notices and traffic updates. Have a wonderful day! 😊`,
      locale
    )
  }
  const body = second
    ? `Yesterday, "${top.title}" was notable, along with "${second.title}". I've gathered ${items.length} updates total — take a quick look before heading out today!`
    : `Yesterday's highlight was "${top.title}". Give it a quick read before you start your day!`
  return ensureFriendlyIntro(body, locale)
}

function buildInsightFromItems(
  locale: JeonjuBriefingLocale,
  items: JeonjuBriefingData["newsItems"]
) {
  if (items.length === 0) {
    return locale === "ko"
      ? "• 전주시청 공지와 교통 안내를 먼저 확인하세요.\n• 방문 예정 장소의 운영 시간 변동 여부를 확인하세요."
      : "• Check Jeonju city notices and traffic updates first.\n• Verify operating hours for planned destinations."
  }

  const bullets: string[] = []
  const top = items[0]
  const second = items[1]
  const mergedTop = `${top.title} ${top.snippet}`
  const mergedSecond = second ? `${second.title} ${second.snippet}` : ""

  if (locale === "ko") {
    bullets.push(`• ${top.source} 원문에서 "${top.title}" 관련 최신 갱신 시각을 먼저 확인하세요.`)
    if (/(교통|통제|도로|우회|혼잡|안전|사고)/i.test(`${mergedTop} ${mergedSecond}`)) {
      bullets.push("• 이동 전 우회 동선·주차 가능 구역을 함께 확인하면 대기 시간을 줄일 수 있습니다.")
    }
    if (/(행사|축제|공연|전시|박물관|문화)/i.test(`${mergedTop} ${mergedSecond}`)) {
      bullets.push("• 행사/전시 참여 전 운영 시간·입장 조건(사전신청/현장접수)을 확인하세요.")
    }
    if (bullets.length < 3) {
      bullets.push("• 오늘 일정과 직접 관련된 링크 2~3개만 먼저 확인하고 출발하세요.")
    }
    return bullets.slice(0, 4).join("\n")
  }

  bullets.push(`• Check the latest update time in ${top.source} for "${top.title}".`)
  if (/(traffic|road|closure|safety|accident|transport|parking)/i.test(`${mergedTop} ${mergedSecond}`)) {
    bullets.push("• Confirm detour and parking options before departure to reduce delays.")
  }
  if (/(event|festival|concert|exhibition|museum|culture)/i.test(`${mergedTop} ${mergedSecond}`)) {
    bullets.push("• Verify event hours and entry requirements before joining.")
  }
  if (bullets.length < 3) {
    bullets.push("• Prioritize checking 2-3 links directly tied to your plan today.")
  }
  return bullets.slice(0, 4).join("\n")
}

function deriveKeywordTags(
  locale: JeonjuBriefingLocale,
  items: JeonjuBriefingData["newsItems"]
) {
  const joined = items.map((item) => `${item.title} ${item.snippet}`).join(" ")
  const tagsKo: string[] = ["#전주"]
  if (/(교통|통제|도로|우회|안전)/i.test(joined)) tagsKo.push("#전주교통")
  if (/(행사|축제|공연|전시|문화|박물관)/i.test(joined)) tagsKo.push("#전주행사")
  if (/(시정|공고|보도자료|의회|정책)/i.test(joined)) tagsKo.push("#전주시정")
  if (/(관광|한옥마을|여행)/i.test(joined)) tagsKo.push("#전주여행")
  if (tagsKo.length < 3) tagsKo.push("#전주생활", "#어제브리핑")
  const uniqueKo = [...new Set(tagsKo)].slice(0, 5)

  if (locale === "ko") return uniqueKo

  const tagsEn: string[] = ["#Jeonju"]
  if (uniqueKo.includes("#전주교통")) tagsEn.push("#JeonjuTraffic")
  if (uniqueKo.includes("#전주행사")) tagsEn.push("#JeonjuEvents")
  if (uniqueKo.includes("#전주시정")) tagsEn.push("#JeonjuCivic")
  if (uniqueKo.includes("#전주여행")) tagsEn.push("#JeonjuTravel")
  if (tagsEn.length < 3) tagsEn.push("#JeonjuDaily", "#NadeulAI")
  return [...new Set(tagsEn)].slice(0, 5)
}

function buildFinalBriefing(
  dateStr: string,
  locale: JeonjuBriefingLocale,
  searchResults: SearchResultItem[],
  parsed: ParsedBriefing,
  modelUsed: string | null,
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number }
): JeonjuBriefingData & { tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } } {
  const dateLabel = getFormattedDateLabel(dateStr, locale)
  const isKo = locale === "ko"

  // Headline: use LLM's or generate
  const headline = (parsed.headline || `${dateLabel} ${isKo ? "전주 브리핑" : "Jeonju Briefing"}`).replace(/[\x00-\x1f]/g, " ").trim()

  // Summary: use LLM's or fallback
  let summary = parsed.summary
  if (!summary) {
    summary = isKo
      ? `어제 하루 동안 확인된 전주 관련 업데이트를 모아봤어요. 생활 동선에 영향을 줄 수 있는 공지나 행사, 교통 정보를 위주로 정리했으니, 오늘 일정 시작 전에 가볍게 확인해 보세요!`
      : `I've summarized the verified Jeonju updates for you. I prioritized helpful notices, events, and traffic changes to help your day go smoothly!`
  }
  summary = ensureFriendlyIntro(summary, locale)
  // Strip control characters that break JSON (raw newlines, tabs, etc.)
  summary = summary.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, " ")

  // News items: prefer LLM's, fallback to raw search results
  let newsItems: JeonjuBriefingData["newsItems"]
  if (parsed.newsItems.length > 0) {
    newsItems = parsed.newsItems.slice(0, 10)
  } else if (searchResults.length > 0) {
    newsItems = searchResults.slice(0, 10).map((r) => ({
      title: r.title,
      url: r.url,
      source: r.source || extractDomain(r.url) || "링크",
      snippet: r.content.replace(/\s+/g, " ").trim().slice(0, 90),
      publishedDate: r.publishedDate,
    }))
  } else {
    newsItems = []
  }

  // Filter out non-Jeonju items when we have LLM items
  if (parsed.newsItems.length > 0) {
    // Items from LLM are already Jeonju-filtered
  } else if (searchResults.length > 0) {
    // Filter fallback items that don't reference Jeonju
    const filtered = searchResults.filter(
      (r) => r.title.includes("전주") || r.title.includes("Jeonju") || r.content.includes("전주") || r.content.includes("Jeonju")
    )
    if (filtered.length >= 2) {
      newsItems = filtered.slice(0, 10).map((r) => ({
        title: r.title,
        url: r.url,
        source: r.source || extractDomain(r.url) || "링크",
        snippet: r.content.replace(/\s+/g, " ").trim().slice(0, 90),
        publishedDate: r.publishedDate,
      }))
    }
  }

  newsItems = normalizeNewsItemsForBriefing(newsItems, dateStr)

  if (!summary) {
    summary = buildNarrativeSummary(locale, dateLabel, newsItems)
  }

  const cleanNullable = (value: string | null): string | null => {
    if (value === null || value === undefined) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  // Default AI insight if LLM didn't provide one
  const defaultInsight = buildInsightFromItems(locale, newsItems)

  // Tags
  const defaultTags = deriveKeywordTags(locale, newsItems)

  return {
    briefingDate: dateStr,
    locale,
    headline,
    summary,
    newsItems,
    aiInsight: cleanNullable(parsed.aiInsight) ?? defaultInsight,
    weatherNote: cleanNullable(parsed.weatherNote),
    festivalNote: cleanNullable(parsed.festivalNote),
    keywordTags: parsed.keywordTags.length > 0 ? parsed.keywordTags.slice(0, 6) : defaultTags,
    modelUsed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tokenUsage,
  }
}

// ------------------------------------------------------------------
// Fallbacks
// ------------------------------------------------------------------

function buildPartialBriefing(
  dateStr: string,
  locale: JeonjuBriefingLocale,
  searchResults: SearchResultItem[],
  modelUsed: string | null
): JeonjuBriefingData {
  const dateLabel = getFormattedDateLabel(dateStr, locale)
  const isKo = locale === "ko"

  return {
    briefingDate: dateStr,
    locale,
    headline: isKo ? `${dateLabel} 전주 소식` : `Jeonju News ${dateLabel}`,
    summary: isKo
      ? ensureFriendlyIntro(`오늘은 어제 기준 수집된 전주 관련 원문을 간단히 정리했어요. 확실한 정보만 쏙쏙 뽑아 담았으니, 외출하시기 전에 유용하게 활용해 보세요!`, locale)
      : ensureFriendlyIntro(`I've compiled some helpful Jeonju-related updates for you. Have a quick look to stay informed before starting your day!`, locale),
    newsItems: searchResults.length > 0
      ? searchResults.slice(0, 6).map((r) => ({
          title: r.title,
          url: r.url,
          source: r.source || extractDomain(r.url) || "링크",
          snippet: r.content.replace(/\s+/g, " ").trim().slice(0, 90),
          publishedDate: r.publishedDate,
        }))
      : [],
    aiInsight: isKo
      ? "오늘 체크포인트: 행사 방문 전 운영시간과 우천 시 동선을 먼저 확인하세요."
      : "Today's checklist: confirm operating hours and rainy-day routes before heading out.",
    weatherNote: null,
    festivalNote: null,
    keywordTags: isKo
      ? ["#전주", "#나들해", "#전주여행"]
      : ["#Jeonju", "#Nadeulhae", "#JeonjuTravel"],
    modelUsed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function createFallbackBriefing(dateStr: string, locale: JeonjuBriefingLocale): JeonjuBriefingData {
  const isKo = locale === "ko"

  return {
    briefingDate: dateStr,
    locale,
    headline: isKo ? "새로운 전주 소식을 찾아보고 있어요" : "Gathering new Jeonju updates",
    summary: isKo
      ? ensureFriendlyIntro(`어제 하루 동안 전해진 새로운 소식이 많지 않네요. 중요한 공식 공지나 일정은 전주시청 및 지역 언론 채널을 먼저 참고해 주시면 좋겠습니다. 오늘도 좋은 하루 보내세요!`, locale)
      : ensureFriendlyIntro(`There weren't many new updates yesterday. Please check Jeonju city's official notices and local media for the latest announcements. Have a wonderful day!`, locale),
    newsItems: [
      {
        title: isKo ? "전주 한옥마을 - 조선의 정취를 품은 골목" : "Jeonju Hanok Village - Alleys of Joseon Charm",
        url: "https://www.visitjeonju.net",
        source: isKo ? "전주관광공사" : "Visit Jeonju",
        snippet: isKo ? "관광 기본 정보와 운영 안내 확인" : "Check official travel info and operation guidance",
        publishedDate: null,
      },
      {
        title: isKo ? "전주시청 공지사항" : "Jeonju city official notices",
        url: "https://www.jeonju.go.kr",
        source: isKo ? "전주시청" : "Jeonju City",
        snippet: isKo ? "교통·행사·안전 관련 최신 공지 확인" : "Check latest traffic/event/safety notices",
        publishedDate: null,
      },
    ],
    aiInsight: isKo
      ? "오늘 체크포인트: 출발 전 공식 공지의 갱신 시각을 확인하면 변동 이슈를 놓치지 않을 수 있어요."
      : "Today's checklist: confirm the update timestamp on official notices before you head out.",
    weatherNote: null,
    festivalNote: null,
    keywordTags: isKo
      ? ["#전주", "#나들해", "#전주한옥마을", "#전주여행", "#남부시장"]
      : ["#Jeonju", "#Nadeulhae", "#HanokVillage", "#JeonjuTravel", "#NambuMarket"],
    modelUsed: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
