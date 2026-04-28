import { createTavilySearch } from "@/lib/tavily/client"
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
  publishedDate: string | null
  source: string
}

const TRUSTED_JEONJU_DOMAINS = [
  "jeonju.go.kr",
  "jjan.kr",
  "domin.co.kr",
  "jjn.co.kr",
  "nocutnews.co.kr",
  "yonhapnews.co.kr",
  "yna.co.kr",
]

const NOISE_DOMAINS = [
  "namu.wiki",
  "kin.naver.com",
  "blog.naver.com",
  "tistory.com",
  "brunch.co.kr",
]

function normalizePublishedDate(raw: string | null): string | null {
  if (!raw) return null
  const match = raw.match(/(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

/**
 * Execute multiple targeted Tavily searches and aggregate results.
 * Uses Promise.allSettled for resilience.
 * - topic: "news" for fresh news, "general" for broader info
 * - timeRange: "week" for balance of recency and breadth
 * - includeAnswer for AI-summarized answer
 * - Dedup by URL, sort by relevance
 */
async function executeMultiSearch(dateStr: string, locale: JeonjuBriefingLocale): Promise<{
  results: SearchResultItem[]
  answer: string | null
  totalSearches: number
  mergedQuerySummary: string
}> {
  const allResults: SearchResultItem[] = []
  const seenUrls = new Set<string>()
  let combinedAnswer: string | null = null

  const queries = buildJeonjuSearchQueries(dateStr, locale)

  const searchPromises = queries.map(async (query, idx) => {
    try {
      const isOfficialTrack = idx === 1

      const response = await createTavilySearch({
        query,
        topic: "general",
        searchDepth: "basic",
        maxResults: 5,
        includeAnswer: idx === 0 ? "basic" : false,
        startDate: dateStr,
        endDate: dateStr,
        includeDomains: isOfficialTrack
          ? ["jeonju.go.kr"]
          : TRUSTED_JEONJU_DOMAINS,
        excludeDomains: NOISE_DOMAINS,
      })

      const items = response.results
        .filter((item) => item.score >= 0.35 && item.url.length > 0)
        .map((item) => ({
          title: item.title,
          url: item.url,
          content: item.content,
          score: item.score,
          publishedDate: normalizePublishedDate(item.publishedDate),
          source: extractDomain(item.url),
        }))
        .filter((item) => (
          item.title.includes("전주")
          || item.content.includes("전주")
          || item.title.toLowerCase().includes("jeonju")
          || item.content.toLowerCase().includes("jeonju")
        ))

      return { items, answer: response.answer }
    } catch (error) {
      console.warn(`[jeonju-briefing] Tavily search failed for "${query}":`, error)
      return { items: [], answer: null }
    }
  })

  const settled = await Promise.allSettled(searchPromises)

  for (const result of settled) {
    if (result.status === "fulfilled") {
      // Collect answer from first successful query
      if (result.value.answer && !combinedAnswer) {
        combinedAnswer = result.value.answer
      }

      for (const item of result.value.items) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url)
          allResults.push(item)
        }
      }
    }
  }

  allResults.sort((a, b) => {
    const aDateBonus = a.publishedDate === dateStr ? 0.25 : 0
    const bDateBonus = b.publishedDate === dateStr ? 0.25 : 0
    const aDomainBonus = isKoreanDomain(a.url) ? 0.12 : 0
    const bDomainBonus = isKoreanDomain(b.url) ? 0.12 : 0
    return (b.score + bDateBonus + bDomainBonus) - (a.score + aDateBonus + aDomainBonus)
  })

  return {
    results: allResults.slice(0, 8),
    answer: combinedAnswer,
    totalSearches: queries.length,
    mergedQuerySummary: queries.join(" | "),
  }
}

function buildJeonjuSearchQueries(dateStr: string, locale: JeonjuBriefingLocale) {
  if (locale === "ko") {
    return [
      `전주 어제 주요 뉴스 ${dateStr}`,
      `전주시청 보도자료 ${dateStr} 전주`,
      `전주 행사 축제 공연 전시 어제 ${dateStr}`,
      `전주 교통 안전 사건사고 어제 ${dateStr}`,
    ]
  }

  return [
    `Jeonju major local news yesterday ${dateStr}`,
    `Jeonju city press release ${dateStr}`,
    `Jeonju events festival exhibition yesterday ${dateStr}`,
    `Jeonju traffic safety incident yesterday ${dateStr}`,
  ]
}

/** Prefer .kr / .or.kr / .go.kr domains for Korean content */
function isKoreanDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return /\.(kr|or\.kr|go\.kr|ac\.kr)$/i.test(hostname)
  } catch {
    return false
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
      const plannedQueries = buildJeonjuSearchQueries(yesterdayDate, locale).join(" | ")
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

    results.slice(0, 8).forEach((r, i) => {
      const dateLine = r.publishedDate
        ? (locale === "ko" ? `발행일: ${r.publishedDate}` : `Published: ${r.publishedDate}`)
        : ""
      lines.push(
        `[${i + 1}] ${r.title}` +
        `\nURL: ${r.url}` +
        `\n출처: ${r.source}` +
        (dateLine ? `\n${dateLine}` : "") +
        `\n내용: ${r.content.slice(0, 400)}`
      )
    })
  } else {
    lines.push(locale === "ko"
      ? "[검색 결과가 없습니다. 전주의 전반적인 관광 정보, 문화, 음식 등에 대해 알려주세요.]"
      : "[No search results available. Please provide general information about Jeonju's tourism, culture, and food.]"
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
  "summary": "어제 기준 확인된 핵심 2-3문장 + 오늘 체감 영향 1문장",
  "newsItems": [
    {"title": "소식 제목", "url": "https://...", "source": "출처명", "snippet": "핵심 내용 한줄(60자 이내)", "publishedDate": "YYYY-MM-DD"}
  ],
  "aiInsight": "오늘 체크포인트 1-2문장 (실행 가능한 조언)",
  "weatherNote": "날씨 관련 정보 (검색 결과에 있으면, 없으면 null)",
  "festivalNote": "축제/행사 정보 (검색 결과에 있으면, 없으면 null)",
  "keywordTags": ["#태그1", "#태그2"]
}

## 상세 규칙
1. **headline**: 30자 이내, 구체적인 전주 관련 내용 (추상 표현 금지)
2. **summary**: 사실 중심 2-3문장 + 오늘 영향 1문장. 과장/추측 금지
3. **newsItems**: 최대 4개. 실제 전주 관련 내용만 포함. 없으면 빈 배열 []
4. **snippet**: 60자 이내, 핵심만 간결하게
5. **aiInsight**: 오늘 바로 쓸 수 있는 체크포인트(교통/행사/혼잡/준비물 등)
6. **weatherNote / festivalNote**: 검색 결과 기반으로, 없으면 null
7. **keywordTags**: 3-5개 전주 관련 해시태그
8. 없는 정보는 반드시 **null** (빈 문자열 금지)
9. 검색 근거가 없으면 지어내지 말고, summary에 "어제 확인 가능한 신규 보도가 제한적"이라고 명시
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
  "summary": "2-3 factual sentences from yesterday + 1 sentence on practical impact today",
  "newsItems": [
    {"title": "News title", "url": "https://...", "source": "Source", "snippet": "Key point (under 80 chars)", "publishedDate": "YYYY-MM-DD"}
  ],
  "aiInsight": "1-2 sentence actionable checklist for today",
  "weatherNote": "Weather info if available, otherwise null",
  "festivalNote": "Festival/event info if available, otherwise null",
  "keywordTags": ["#tag1", "#tag2"]
}

## Rules
1. **headline**: Under 40 chars, specific and concrete
2. **summary**: factual 2-3 sentences + practical today-impact sentence
3. **newsItems**: Max 4. Include only real Jeonju content from searches. Empty array if none.
4. **snippet**: Under 80 chars
5. **aiInsight**: Actionable, practical guidance (traffic/events/crowd/prep)
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
    newsItems = parsed.newsItems.slice(0, 4)
  } else if (searchResults.length > 0) {
    newsItems = searchResults.slice(0, 4).map((r) => ({
      title: r.title,
      url: r.url,
      source: r.source || extractDomain(r.url) || "링크",
      snippet: r.content.replace(/\s+/g, " ").trim().slice(0, 60),
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
      newsItems = filtered.slice(0, 4).map((r) => ({
        title: r.title,
        url: r.url,
        source: r.source || extractDomain(r.url) || "링크",
        snippet: r.content.replace(/\s+/g, " ").trim().slice(0, 60),
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
      ? searchResults.slice(0, 4).map((r) => ({
          title: r.title,
          url: r.url,
          source: r.source || extractDomain(r.url) || "링크",
          snippet: r.content.replace(/\s+/g, " ").trim().slice(0, 60),
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
