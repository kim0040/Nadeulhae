import {
  createTavilySearch,
  type TavilySearchDepth,
  type TavilyTimeRange,
  type TavilyTopic,
} from "@/lib/tavily/client"
import { createNanoGptChatCompletion } from "@/lib/chat/nanogpt"
import { saveJeonjuBriefing, getJeonjuBriefingByDate, type JeonjuBriefingData } from "./repository"

export type JeonjuBriefingLocale = "ko" | "en"

interface GenerateBriefingOptions {
  locale?: JeonjuBriefingLocale
  forceRefresh?: boolean
}

interface BriefingGenerationResult {
  fromCache: boolean
  data: JeonjuBriefingData
}

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
]

const LOCAL_UTILITY_DOMAINS = [
  ...OFFICIAL_JEONJU_DOMAINS,
  "jjan.kr",
  "domin.co.kr",
  "jjn.co.kr",
  "nocutnews.co.kr",
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
const LOW_UTILITY_PATTERN = /(후보|경선|선거|정당|의장|군수|도지사|국회의원|찬양|연예가|가십|트럼프)/i

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
  const prioritizedTracks = ["city-hall", "events", "safety", "local-news", "fallback-news", "fallback-general"]
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
        query: `전주 생활 공지 교통 행사 업데이트 ${dateStr}`,
        topic: "news",
        searchDepth: "fast",
        timeRange: "week",
        includeDomains: LOCAL_UTILITY_DOMAINS,
        excludeDomains: NOISE_DOMAINS,
        includeAnswer: "basic",
      },
      {
        key: "city-hall",
        query: `전주시청 보도자료 시정뉴스룸 ${dateStr}`,
        topic: "general",
        searchDepth: "basic",
        timeRange: "week",
        includeDomains: OFFICIAL_JEONJU_DOMAINS,
        excludeDomains: NOISE_DOMAINS,
        country: "south korea",
      },
      {
        key: "events",
        query: `전주 축제 행사 공연 전시 일정 ${dateStr}`,
        topic: "news",
        searchDepth: "basic",
        timeRange: "month",
        includeDomains: LOCAL_UTILITY_DOMAINS,
        excludeDomains: NOISE_DOMAINS,
      },
      {
        key: "safety",
        query: `전주 교통 통제 안전 주의 사건사고 ${dateStr}`,
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
      query: `Jeonju local civic notices traffic events update ${dateStr}`,
      topic: "news",
      searchDepth: "fast",
      timeRange: "week",
      includeDomains: LOCAL_UTILITY_DOMAINS,
      excludeDomains: NOISE_DOMAINS,
      includeAnswer: "basic",
    },
    {
      key: "city-hall",
      query: `Jeonju city hall press release ${dateStr}`,
      topic: "general",
      searchDepth: "basic",
      timeRange: "week",
      includeDomains: OFFICIAL_JEONJU_DOMAINS,
      excludeDomains: NOISE_DOMAINS,
      country: "south korea",
    },
    {
      key: "events",
      query: `Jeonju events festival exhibition update ${dateStr}`,
      topic: "news",
      searchDepth: "basic",
      timeRange: "month",
      includeDomains: LOCAL_UTILITY_DOMAINS,
      excludeDomains: NOISE_DOMAINS,
    },
    {
      key: "safety",
      query: `Jeonju traffic control safety incident update ${dateStr}`,
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
  const { locale = "ko", forceRefresh = false } = options
  const yesterdayDate = getYesterdayInKst()

  // 1. Check DB cache first
  if (!forceRefresh) {
    try {
      const cached = await getJeonjuBriefingByDate(yesterdayDate)
      if (cached && cached.newsItems.length > 0) {
        console.log(`[jeonju-briefing] Serving cached briefing for ${yesterdayDate}`)
        return { fromCache: true, data: cached }
      }
    } catch {
      // ignore cache errors
    }
  }

  // 2. Generate fresh briefing
  try {
    const result = await fetchAndSummarize(yesterdayDate, locale)

    // 3. Save to DB (best-effort)
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
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      })
      console.log(`[jeonju-briefing] Saved briefing for ${yesterdayDate}`)
    } catch (saveError) {
      console.warn("[jeonju-briefing] Save to DB failed:", saveError)
    }

    return { fromCache: false, data: result }
  } catch (error) {
    console.error("[jeonju-briefing] Generation failed:", error)

    // Stale cache fallback
    try {
      const stale = await getJeonjuBriefingByDate(yesterdayDate)
      if (stale) return { fromCache: true, data: stale }
    } catch {
      // ignore
    }

    return { fromCache: false, data: createFallbackBriefing(yesterdayDate, locale) }
  }
}

// ------------------------------------------------------------------
// Core: Fetch + Summarize
// ------------------------------------------------------------------

async function fetchAndSummarize(
  dateStr: string,
  locale: JeonjuBriefingLocale
): Promise<JeonjuBriefingData> {
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
  try {
    const completion = await createNanoGptChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: searchContext },
      ],
      requestKind: "chat",
    })
    completionContent = completion.content
    modelUsed = completion.resolvedModel
    console.log(`[jeonju-briefing] LLM response: ${completionContent.slice(0, 100)}...`)
  } catch (llmError) {
    console.error("[jeonju-briefing] LLM failed, using partial fallback:", llmError)
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
      console.error("[jeonju-briefing] JSON parse failed:", parseError)
    }
  }

  // 6. Normalize & build final result
  return buildFinalBriefing(dateStr, locale, allResults, parsed, modelUsed)
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
  const trackName: Record<string, { ko: string; en: string }> = {
    "local-news": { ko: "지역 주요뉴스", en: "Local headlines" },
    "city-hall": { ko: "전주시 공식 보도", en: "City official release" },
    "events": { ko: "행사/축제", en: "Events/Festival" },
    "safety": { ko: "교통/안전", en: "Traffic/Safety" },
    "fallback-news": { ko: "보강 뉴스", en: "Fallback news" },
    "fallback-general": { ko: "보강 일반", en: "Fallback general" },
  }

  lines.push(locale === "ko"
    ? "[브리핑 목표] 어제 전주 소식 핵심 + 오늘 바로 필요한 체크포인트를 제공한다."
    : "[Goal] Provide yesterday's Jeonju highlights plus practical check points for today."
  )
  lines.push(locale === "ko"
    ? "[편집 원칙] 오래된 정보·관광 홍보성 일반 문구보다 생활 영향이 큰 공지/교통/행사 업데이트를 우선한다."
    : "[Editorial policy] Prioritize impactful updates (notices/traffic/events) over generic promotional text."
  )
  lines.push("")

  if (searchAnswer) {
    lines.push(locale === "ko"
      ? `[Tavily 검색 요약 답변]\n${searchAnswer}`
      : `[Tavily Search Summary]\n${searchAnswer}`
    )
    lines.push("")
  }

  if (results.length > 0) {
    lines.push(locale === "ko"
      ? `[검색 결과 (${results.length}개)]`
      : `[Search Results (${results.length} items)]`
    )

    results.slice(0, 10).forEach((r, i) => {
      const dateLine = r.publishedDate
        ? (locale === "ko" ? `발행일: ${r.publishedDate}` : `Published: ${r.publishedDate}`)
        : ""
      const trackLabel = trackName[r.trackKey]?.[locale] ?? r.trackKey
      lines.push(
        `[${i + 1}] ${r.title}` +
        `\nURL: ${r.url}` +
        `\n출처: ${r.source}` +
        `\n분류: ${trackLabel}` +
        `\n정렬점수: ${r.weightedScore.toFixed(2)} (원점수 ${r.score.toFixed(2)})` +
        (dateLine ? `\n${dateLine}` : "") +
        `\n내용: ${r.content.slice(0, 420)}`
      )
    })
  } else {
    lines.push(locale === "ko"
      ? "[검색 결과가 거의 없습니다. 사실 확인 가능한 정보만 최소한으로 작성하고, 확인 필요하다고 명시하세요.]"
      : "[Search results are sparse. Keep only verifiable facts and explicitly note verification gaps.]"
    )
  }

  lines.push("")
  lines.push(locale === "ko"
    ? `참고: 기준일은 ${dateLabel}입니다.`
    : `Note: The reference date is ${dateLabel}.`
  )

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
    return `당신은 전주시 생활 브리핑 에디터 '나들AI'입니다.

## 역할
- ${dateLabel} (${relativeLabel}) 기준으로 '어제 확인된 사실'을 우선 정리합니다.
- 오늘(지금) 바로 도움이 되는 생활 영향 포인트를 짧게 덧붙입니다.

## 출력 규칙
- 반드시 **순수 JSON만** 반환하세요. 마크다운 블록(\`\`\`)이나 설명 텍스트 없이 순수 JSON만 반환해야 합니다.
- 모든 문자열은 큰따옴표를 사용하세요.

## JSON 스키마
{
  "headline": "어제 핵심을 담은 한 줄 (30자 이내, 전주 관련)",
  "summary": "핵심상황 2문장 + 오늘영향 1문장",
  "newsItems": [
    {"title": "소식 제목", "url": "https://...", "source": "출처명", "snippet": "핵심 내용 한줄(60자 이내)", "publishedDate": "YYYY-MM-DD"}
  ],
  "aiInsight": "오늘 체크포인트 2~4개 (각 항목은 '•'로 시작, 실행 가능한 조언)",
  "weatherNote": "날씨 관련 정보 (검색 결과에 있으면, 없으면 null)",
  "festivalNote": "축제/행사 정보 (검색 결과에 있으면, 없으면 null)",
  "keywordTags": ["#태그1", "#태그2"]
}

## 상세 규칙
1. **headline**: 30자 이내, 구체적인 전주 관련 내용 (추상 표현 금지)
2. **summary**: "핵심상황:"으로 시작하는 문장 2개 + "오늘영향:" 문장 1개. 과장/추측 금지
3. **newsItems**: 최대 5개. 실제 전주 관련 내용만 포함. 없으면 빈 배열 []
4. **snippet**: 60자 이내, 핵심만 간결하게
5. **aiInsight**: 오늘 바로 쓸 수 있는 체크포인트 2~4개를 "•" 목록 형태로 작성
6. **weatherNote / festivalNote**: 검색 결과 기반으로, 없으면 null
7. **keywordTags**: 3-5개 전주 관련 해시태그
8. 없는 정보는 반드시 **null** (빈 문자열 금지)
9. 검색 근거가 약하거나 오래된 정보면 지어내지 말고, summary에 "어제 확인 가능한 신규 보도가 제한적"이라고 명시
10. **JSON 외의 어떤 텍스트도 출력하지 마세요**`
  }

  return `You are 'NadeulAI', a Jeonju daily briefing editor.

## Role
- Prioritize verified facts from ${dateLabel} (${relativeLabel}).
- Add practical "what to watch today" guidance in a compact form.

## Output Rule
- Return **ONLY pure JSON**. No markdown blocks (\`\`\`), no explanatory text.

## JSON Schema
{
  "headline": "One-line core update (under 40 chars, Jeonju-related)",
  "summary": "2 core factual lines + 1 practical impact line",
  "newsItems": [
    {"title": "News title", "url": "https://...", "source": "Source", "snippet": "Key point (under 80 chars)", "publishedDate": "YYYY-MM-DD"}
  ],
  "aiInsight": "2-4 bullet checklist items, each prefixed with '•'",
  "weatherNote": "Weather info if available, otherwise null",
  "festivalNote": "Festival/event info if available, otherwise null",
  "keywordTags": ["#tag1", "#tag2"]
}

## Rules
1. **headline**: Under 40 chars, specific and concrete
2. **summary**: start with "Core:" for 2 facts, and add one "Today impact:" sentence
3. **newsItems**: Max 5. Include only real Jeonju content from searches. Empty array if none.
4. **snippet**: Under 80 chars
5. **aiInsight**: 2-4 actionable checklist bullets, each starting with "•"
6. **weatherNote / festivalNote**: Based on search results, null if unavailable
7. **keywordTags**: 3-5 Jeonju-related hashtags
8. Use **null** for missing info (not empty strings)
9. If evidence is limited, explicitly state that yesterday's verified updates were limited
10. **Do NOT output any text besides valid JSON**`
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

function buildFinalBriefing(
  dateStr: string,
  locale: JeonjuBriefingLocale,
  searchResults: SearchResultItem[],
  parsed: ParsedBriefing,
  modelUsed: string | null
): JeonjuBriefingData {
  const dateLabel = getFormattedDateLabel(dateStr, locale)
  const isKo = locale === "ko"

  // Headline: use LLM's or generate
  const headline = parsed.headline || `${dateLabel} ${isKo ? "전주 브리핑" : "Jeonju Briefing"}`

  // Summary: use LLM's or fallback
  let summary = parsed.summary
  if (!summary) {
    summary = isKo
      ? `${dateLabel} 기준으로 확인 가능한 전주 관련 업데이트를 정리했습니다. 오늘 일정 전에는 링크된 원문 기준으로 행사·교통 공지를 한 번 더 확인해 주세요.`
      : `This summarizes verifiable Jeonju updates as of ${dateLabel}. Before today's plans, double-check event and traffic notices from the linked sources.`
  }

  // News items: prefer LLM's, fallback to raw search results
  let newsItems: JeonjuBriefingData["newsItems"]
  if (parsed.newsItems.length > 0) {
    newsItems = parsed.newsItems.slice(0, 5)
  } else if (searchResults.length > 0) {
    newsItems = searchResults.slice(0, 5).map((r) => ({
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
      newsItems = filtered.slice(0, 5).map((r) => ({
        title: r.title,
        url: r.url,
        source: r.source || extractDomain(r.url) || "링크",
        snippet: r.content.replace(/\s+/g, " ").trim().slice(0, 90),
        publishedDate: r.publishedDate,
      }))
    }
  }

  const cleanNullable = (value: string | null): string | null => {
    if (value === null || value === undefined) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  // Default AI insight if LLM didn't provide one
  const defaultInsight = isKo
    ? "오늘 체크포인트: 이동 전 교통 공지·행사 시간·혼잡 예상 구간을 먼저 확인하면 일정 차질을 줄일 수 있어요."
    : "Today's checklist: verify traffic notices, event times, and likely crowd zones before moving."

  // Tags
  const defaultTags = isKo
    ? ["#전주", "#나들해", "#전주여행", "#전주한옥마을", "#전주국제영화제"]
    : ["#Jeonju", "#Nadeulhae", "#JeonjuTravel", "#HanokVillage", "#JIFF"]

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
      ? `${dateLabel} 기준 수집된 전주 관련 원문을 정리했습니다. 오늘 일정 전에는 링크된 공지/기사의 최신 갱신 시간을 확인해 주세요.`
      : `This compiles Jeonju-related sources for ${dateLabel}. Check each linked notice/article for latest updates before making plans today.`,
    newsItems: searchResults.length > 0
      ? searchResults.slice(0, 5).map((r) => ({
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
  const dateLabel = getFormattedDateLabel(dateStr, locale)
  const isKo = locale === "ko"

  return {
    briefingDate: dateStr,
    locale,
    headline: isKo ? "어제 전주 소식 요약 준비중" : "Yesterday's Jeonju digest is being prepared",
    summary: isKo
      ? `${dateLabel} 기준으로 자동 수집을 시도했지만 확인 가능한 신규 소식이 제한적이었습니다. 전주시청 공지와 지역 언론의 당일 업데이트를 우선 확인해 주세요.`
      : `Automatic collection for ${dateLabel} found limited verifiable updates. Please check Jeonju city notices and local media updates first today.`,
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
