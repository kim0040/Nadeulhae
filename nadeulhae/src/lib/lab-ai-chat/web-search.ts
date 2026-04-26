import {
  getLabAiChatWebSearchCache,
  recordLabAiChatWebSearchOutcome,
  reserveLabAiChatWebSearchCall,
  persistLabAiChatWebSearchCache,
} from "@/lib/lab-ai-chat/repository"
import type { LabAiChatLocale } from "@/lib/lab-ai-chat/types"
import { createNanoGptCompletion } from "@/lib/nanogpt/client"
import { createTavilySearch, TavilyError, type TavilySearchRequest, type TavilyTopic } from "@/lib/tavily/client"

type SearchPlan = {
  needSearch: boolean
  useCacheFirst: boolean
  cacheUsable: boolean
  query: string
  fallbackQuery: string | null
  topic: TavilyTopic
  timeRange: TavilySearchRequest["timeRange"]
  startDate: string | null
  endDate: string | null
  country: string | null
  includeDomains: string[]
  excludeDomains: string[]
}

type WebSearchStatusFn = (message: string) => void

export type LabAiChatWebSearchResolution = {
  context: string | null
  source: "none" | "cache" | "live"
}

function toLocaleStatus(locale: LabAiChatLocale, kind:
  | "planning"
  | "check_cache"
  | "using_cache"
  | "searching"
  | "retrying"
  | "search_limit"
  | "month_limit"
  | "search_failed"
  | "search_skipped"
) {
  if (locale === "ko") {
    switch (kind) {
      case "planning":
        return "웹 검색 필요 여부를 판단하는 중..."
      case "check_cache":
        return "이전 검색 결과를 먼저 확인하는 중..."
      case "using_cache":
        return "이전 검색 결과를 기반으로 답변을 정리하는 중..."
      case "searching":
        return "웹에서 최신 정보를 검색하는 중..."
      case "retrying":
        return "검색 결과가 부족해서 다른 키워드로 재검색 중..."
      case "search_limit":
        return "이 세션의 웹 검색 한도(5회)에 도달해 기존 맥락으로 답변합니다."
      case "month_limit":
        return "이번 달 웹 검색 한도(800회)에 도달해 기존 맥락으로 답변합니다."
      case "search_failed":
        return "웹 검색 실패로 기존 맥락을 우선 사용합니다."
      case "search_skipped":
        return "이번 질문은 웹 검색 없이 답변 가능한 것으로 판단했습니다."
      default:
        return ""
    }
  }

  switch (kind) {
    case "planning":
      return "Determining whether web search is necessary..."
    case "check_cache":
      return "Checking previously fetched search context..."
    case "using_cache":
      return "Answering from existing search context to save API calls..."
    case "searching":
      return "Searching the web for up-to-date information..."
    case "retrying":
      return "Results were weak, retrying with a refined query..."
    case "search_limit":
      return "Session web search limit (5 calls) reached. Using existing context."
    case "month_limit":
      return "Monthly web search limit (800 calls) reached. Using existing context."
    case "search_failed":
      return "Web search failed; falling back to existing context."
    case "search_skipped":
      return "This question appears answerable without web search."
    default:
      return ""
  }
}

function getTodayInKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function extractJsonObject(text: string) {
  const first = text.indexOf("{")
  const last = text.lastIndexOf("}")
  if (first < 0 || last < first) {
    return null
  }
  return text.slice(first, last + 1)
}

function safeBool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true") return true
    if (normalized === "false") return false
  }
  return fallback
}

function safeDate(value: unknown) {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null
}

function safeTopic(value: unknown): TavilyTopic {
  if (value === "news" || value === "finance") return value
  return "general"
}

function safeTimeRange(value: unknown): TavilySearchRequest["timeRange"] {
  if (
    value === "day" || value === "week" || value === "month" || value === "year"
    || value === "d" || value === "w" || value === "m" || value === "y"
  ) {
    return value
  }
  return undefined
}

function safeQuery(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback
  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) return fallback
  return normalized.slice(0, 200)
}

function safeDomainList(value: unknown, max: number) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0 && item.length <= 200)
    .slice(0, max)
}

function isExplicitSearchRequest(question: string) {
  return /(검색|찾아|찾아줘|알려줘|알려 줘|search|look ?up|find|현재|최신|속보|실시간|뉴스)/i.test(question)
}

function isGreeting(question: string) {
  const normalized = question.trim()
  if (normalized.length > 30) return false
  return /^(안녕|안녕하세요|반가워|하이|ㅎㅇ|hi|hello|hey|thanks|감사|고마워|ㄱㅅ)[\s!.?~]*$/i.test(normalized)
}

function buildConversationHint(
  recentMessages: Array<{ role: string; content: string }> | undefined
) {
  if (!recentMessages || recentMessages.length === 0) return null
  return recentMessages
    .slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.replace(/\s+/g, " ").trim().slice(0, 150)}`)
    .join("\n")
}

function buildFallbackPlan(question: string, conversationHint?: string | null): SearchPlan {
  const asksLatest = /(latest|today|current|now|news|breaking|최신|오늘|현재|실시간|속보)/i.test(question)
  const asksFinance = /(stock|shares|market|price|forex|crypto|주가|증시|환율|코인|금리)/i.test(question)
  const asksHistory = /(history|historical|century|조선|고대|역사|과거)/i.test(question)
  const needSearch = !isGreeting(question)

  // For vague follow-ups, try to extract a better query from conversation context
  let query = question.trim().slice(0, 200)
  if (conversationHint && query.length < 15 && isExplicitSearchRequest(question)) {
    // Extract last substantive user message as query basis
    const contextLines = conversationHint.split("\n")
    for (let i = contextLines.length - 1; i >= 0; i--) {
      const line = contextLines[i]
      if (line.startsWith("User: ") && line.length > 20) {
        const extracted = line.slice(6).trim().slice(0, 200)
        if (!isExplicitSearchRequest(extracted) || extracted.length > 20) {
          query = extracted
          break
        }
      }
    }
  }

  return {
    needSearch,
    useCacheFirst: true,
    cacheUsable: true,
    query,
    fallbackQuery: null,
    topic: asksFinance ? "finance" : asksLatest ? "news" : "general",
    timeRange: asksHistory ? undefined : asksLatest ? "week" : undefined,
    startDate: null,
    endDate: null,
    country: null,
    includeDomains: [],
    excludeDomains: [],
  }
}

async function buildSearchPlan(input: {
  locale: LabAiChatLocale
  modelId: string
  question: string
  cacheQuery: string | null
  cacheUpdatedAt: string | null
  cachePreview: string | null
  conversationHint: string | null
}) {
  // Fast-path: greetings never need search
  if (isGreeting(input.question)) {
    return {
      needSearch: false,
      useCacheFirst: true,
      cacheUsable: true,
      query: input.question.trim().slice(0, 200),
      fallbackQuery: null,
      topic: "general" as TavilyTopic,
      timeRange: undefined as TavilySearchRequest["timeRange"],
      startDate: null,
      endDate: null,
      country: null,
      includeDomains: [] as string[],
      excludeDomains: [] as string[],
    } satisfies SearchPlan
  }

  const localeName = input.locale === "ko" ? "Korean" : "English"
  const plannerPrompt = [
    "You are a web search planner for a chat assistant.",
    "Return STRICT JSON only. No markdown, no prose.",
    `Today (KST): ${getTodayInKst()}`,
    "",
    "JSON schema:",
    "{",
    '  "need_search": boolean,',
    '  "use_cache_first": boolean,',
    '  "cache_usable": boolean,',
    '  "query": string,',
    '  "fallback_query": string | null,',
    '  "topic": "general" | "news" | "finance",',
    '  "time_range": "day" | "week" | "month" | "year" | null,',
    '  "start_date": "YYYY-MM-DD" | null,',
    '  "end_date": "YYYY-MM-DD" | null,',
    '  "country": string | null,',
    '  "include_domains": string[],',
    '  "exclude_domains": string[]',
    "}",
    "",
    "Rules:",
    "- Keep search_depth basic and max_results=5 in downstream caller.",
    "- Use news topic for current events. Use finance topic for markets/finance.",
    "- For timeless or historical questions, prefer no time filters.",
    "- Use cache ONLY when the cache topic clearly matches the user's current question.",
    `- Language for search query should match user language (${localeName}) when useful.`,
    "- CRITICAL: Set need_search to true for ANY question asking for facts, specific entities, events, coding help, or general knowledge. Even if you think you know the answer, set it to true to get up-to-date sources.",
    "- Set need_search to false ONLY for casual greetings (e.g., hi, thanks) or purely creative/subjective writing that requires no facts.",
    "- IMPORTANT: If the user asks you to 'search', 'find', 'look up', '검색', '찾아', '알려줘', etc., ALWAYS set need_search to true.",
    "- IMPORTANT: If the user question is a vague follow-up (e.g., '다시 검색해줘', 'search again'), use the Conversation context and Cached query to determine the actual search topic and generate a proper query.",
  ].join("\n")

  const plannerInput = [
    `User question: ${input.question}`,
    `Cached query: ${input.cacheQuery ?? "none"}`,
    `Cached at: ${input.cacheUpdatedAt ?? "none"}`,
    `Cached preview: ${input.cachePreview ?? "none"}`,
    input.conversationHint
      ? `Conversation context (recent messages):\n${input.conversationHint}`
      : "Conversation context: none",
  ].join("\n")

  try {
    const completion = await createNanoGptCompletion({
      model: input.modelId,
      requestKind: "summary",
      messages: [
        { role: "system", content: plannerPrompt },
        { role: "user", content: plannerInput },
      ],
    })

    const raw = completion.content.trim()
    const jsonText = extractJsonObject(raw)
    if (!jsonText) {
      return buildFallbackPlan(input.question, input.conversationHint)
    }
    const parsed = JSON.parse(jsonText) as Record<string, unknown>

    let needSearch = safeBool(parsed.need_search, false)

    // Override: if planner says no but the user explicitly asked for search, force it
    if (!needSearch && isExplicitSearchRequest(input.question)) {
      needSearch = true
    }

    return {
      needSearch,
      useCacheFirst: safeBool(parsed.use_cache_first, true),
      cacheUsable: safeBool(parsed.cache_usable, true),
      query: safeQuery(parsed.query, input.question.trim().slice(0, 200)),
      fallbackQuery: parsed.fallback_query ? safeQuery(parsed.fallback_query, "") : null,
      topic: safeTopic(parsed.topic),
      timeRange: safeTimeRange(parsed.time_range),
      startDate: safeDate(parsed.start_date),
      endDate: safeDate(parsed.end_date),
      country: typeof parsed.country === "string" && parsed.country.trim() ? parsed.country.trim().slice(0, 8) : null,
      includeDomains: safeDomainList(parsed.include_domains, 20),
      excludeDomains: safeDomainList(parsed.exclude_domains, 20),
    } satisfies SearchPlan
  } catch {
    return buildFallbackPlan(input.question, input.conversationHint)
  }
}

function buildSearchContextText(input: {
  locale: LabAiChatLocale
  query: string
  topic: TavilyTopic
  timeRange?: string
  startDate?: string | null
  endDate?: string | null
  resultCount: number
  answer?: string | null
  results: Array<{
    title: string
    url: string
    content: string
    score: number
    publishedDate: string | null
  }>
}) {
  const header = input.locale === "ko"
    ? [
      `[웹 검색 컨텍스트]`,
      `질의: ${input.query}`,
      `토픽: ${input.topic}${input.timeRange ? ` / 기간: ${input.timeRange}` : ""}`,
      `${input.startDate ? `시작일: ${input.startDate}` : ""}${input.endDate ? ` / 종료일: ${input.endDate}` : ""}`.trim(),
      `결과 수: ${input.resultCount}`,
    ]
    : [
      "[Web Search Context]",
      `Query: ${input.query}`,
      `Topic: ${input.topic}${input.timeRange ? ` / Range: ${input.timeRange}` : ""}`,
      `${input.startDate ? `Start: ${input.startDate}` : ""}${input.endDate ? ` / End: ${input.endDate}` : ""}`.trim(),
      `Result count: ${input.resultCount}`,
    ]

  const compactHeader = header.filter((line) => line.length > 0).join("\n")
  const answerLine = input.answer?.trim()
    ? (input.locale === "ko" ? `요약 답변: ${input.answer.trim()}` : `Summary answer: ${input.answer.trim()}`)
    : null

  const sources = input.results.slice(0, 5).map((item, index) => {
    const snippet = item.content.replace(/\s+/g, " ").trim().slice(0, 600)
    const dateLine = item.publishedDate
      ? (input.locale === "ko" ? `발행일: ${item.publishedDate}` : `Published: ${item.publishedDate}`)
      : null

    return [
      `${index + 1}. ${item.title}`,
      `URL: ${item.url}`,
      dateLine,
      `${input.locale === "ko" ? "요약" : "Snippet"}: ${snippet || "-"}`,
    ].filter(Boolean).join("\n")
  })

  return [
    compactHeader,
    answerLine,
    sources.length > 0
      ? (input.locale === "ko" ? "[출처 후보]" : "[Candidate Sources]")
      : null,
    ...sources,
  ].filter(Boolean).join("\n\n")
}

function buildCachedContextText(input: {
  locale: LabAiChatLocale
  cachedQuery: string
  cachedResult: string
  cachedAt: string | null
}) {
  const label = input.locale === "ko" ? "[캐시된 웹 검색 컨텍스트]" : "[Cached Web Search Context]"
  const timeLine = input.cachedAt
    ? (input.locale === "ko" ? `캐시 시각: ${input.cachedAt}` : `Cached at: ${input.cachedAt}`)
    : null

  return [
    label,
    input.locale === "ko" ? `이전 질의: ${input.cachedQuery}` : `Previous query: ${input.cachedQuery}`,
    timeLine,
    input.cachedResult,
  ].filter(Boolean).join("\n\n")
}

export async function resolveLabAiChatWebSearchContext(input: {
  userId: string
  sessionId: number
  locale: LabAiChatLocale
  modelId: string
  question: string
  webSearchEnabled: boolean
  recentMessages?: Array<{ role: string; content: string }>
  onStatus?: WebSearchStatusFn
}): Promise<LabAiChatWebSearchResolution> {
  console.log(`[web-search] START | webSearchEnabled=${input.webSearchEnabled} | question="${input.question.slice(0, 80)}" | sessionId=${input.sessionId}`)

  if (!input.webSearchEnabled) {
    console.log("[web-search] SKIP: webSearchEnabled is false")
    return { context: null, source: "none" }
  }

  const conversationHint = buildConversationHint(input.recentMessages)
  console.log(`[web-search] conversationHint length=${conversationHint?.length ?? 0} | recentMessages count=${input.recentMessages?.length ?? 0}`)

  input.onStatus?.(toLocaleStatus(input.locale, "check_cache"))
  const cached = await getLabAiChatWebSearchCache({
    userId: input.userId,
    sessionId: input.sessionId,
  })
  console.log(`[web-search] cache check: query=${cached?.query?.slice(0, 40) ?? "null"} | result=${cached?.result ? "yes" : "null"}`)

  input.onStatus?.(toLocaleStatus(input.locale, "planning"))
  const plan = await buildSearchPlan({
    locale: input.locale,
    modelId: input.modelId,
    question: input.question,
    cacheQuery: cached?.query ?? null,
    cacheUpdatedAt: cached?.updatedAt ?? null,
    cachePreview: cached?.result?.slice(0, 1200) ?? null,
    conversationHint,
  })
  console.log(`[web-search] plan result: needSearch=${plan.needSearch} | useCacheFirst=${plan.useCacheFirst} | cacheUsable=${plan.cacheUsable} | query="${plan.query?.slice(0, 60)}" | topic=${plan.topic}`)

  if (cached?.result && cached.query && plan.useCacheFirst && plan.cacheUsable) {
    console.log("[web-search] USING CACHE (plan says cache is usable)")
    input.onStatus?.(toLocaleStatus(input.locale, "using_cache"))
    return {
      context: buildCachedContextText({
        locale: input.locale,
        cachedQuery: cached.query,
        cachedResult: cached.result,
        cachedAt: cached.updatedAt ?? null,
      }),
      source: "cache",
    }
  }

  if (!plan.needSearch) {
    console.log("[web-search] SKIP: planner says needSearch=false")
    input.onStatus?.(toLocaleStatus(input.locale, "search_skipped"))
    return { context: null, source: "none" }
  }

  console.log(`[web-search] PROCEEDING to live search with query="${plan.query?.slice(0, 60)}"`)


  const runSearch = async (query: string) => {
    const reservation = await reserveLabAiChatWebSearchCall({
      userId: input.userId,
      sessionId: input.sessionId,
    })

    if (!reservation.allowed) {
      if (reservation.reason === "session_limit_reached") {
        input.onStatus?.(toLocaleStatus(input.locale, "search_limit"))
      } else {
        input.onStatus?.(toLocaleStatus(input.locale, "month_limit"))
      }
      return { blocked: true as const, context: null }
    }

    try {
      input.onStatus?.(toLocaleStatus(input.locale, "searching"))
      const response = await createTavilySearch({
        query,
        topic: plan.topic,
        searchDepth: "basic",
        maxResults: 5,
        timeRange: plan.timeRange,
        startDate: plan.startDate ?? undefined,
        endDate: plan.endDate ?? undefined,
        includeDomains: plan.includeDomains.length > 0 ? plan.includeDomains : undefined,
        excludeDomains: plan.excludeDomains.length > 0 ? plan.excludeDomains : undefined,
        country: plan.country ?? undefined,
      })

      await recordLabAiChatWebSearchOutcome({
        metricMonth: reservation.metricMonth,
        success: true,
      })

      if (response.results.length === 0) {
        return { blocked: false as const, context: null }
      }

      const context = buildSearchContextText({
        locale: input.locale,
        query: response.query,
        topic: plan.topic,
        timeRange: plan.timeRange,
        startDate: plan.startDate,
        endDate: plan.endDate,
        resultCount: response.results.length,
        answer: response.answer,
        results: response.results,
      })

      await persistLabAiChatWebSearchCache({
        userId: input.userId,
        sessionId: input.sessionId,
        query: response.query,
        resultText: context,
        resultCount: response.results.length,
        topic: plan.topic,
        timeRange: plan.timeRange ?? null,
        startDate: plan.startDate,
        endDate: plan.endDate,
      })

      return { blocked: false as const, context }
    } catch (error) {
      await recordLabAiChatWebSearchOutcome({
        metricMonth: reservation.metricMonth,
        success: false,
      }).catch(() => {})

      if (!(error instanceof TavilyError)) {
        input.onStatus?.(toLocaleStatus(input.locale, "search_failed"))
      } else {
        input.onStatus?.(`${toLocaleStatus(input.locale, "search_failed")} (${error.statusCode})`)
      }
      return { blocked: false as const, context: null }
    }
  }

  const first = await runSearch(plan.query)
  if (first.context) {
    return { context: first.context, source: "live" }
  }

  if (!first.blocked && plan.fallbackQuery && plan.fallbackQuery !== plan.query) {
    input.onStatus?.(toLocaleStatus(input.locale, "retrying"))
    const second = await runSearch(plan.fallbackQuery)
    if (second.context) {
      return { context: second.context, source: "live" }
    }
  }

  if (cached?.result && cached.query) {
    input.onStatus?.(toLocaleStatus(input.locale, "using_cache"))
    return {
      context: buildCachedContextText({
        locale: input.locale,
        cachedQuery: cached.query,
        cachedResult: cached.result,
        cachedAt: cached.updatedAt ?? null,
      }),
      source: "cache",
    }
  }

  return { context: null, source: "none" }
}
