export type TavilyTopic = "general" | "news" | "finance"
export type TavilySearchDepth = "basic" | "advanced"
export type TavilyTimeRange = "day" | "week" | "month" | "year" | "d" | "w" | "m" | "y"

export interface TavilySearchResultItem {
  title: string
  url: string
  content: string
  score: number
  publishedDate: string | null
}

export interface TavilySearchResponse {
  query: string
  answer: string | null
  results: TavilySearchResultItem[]
}

export interface TavilySearchRequest {
  query: string
  topic?: TavilyTopic
  searchDepth?: TavilySearchDepth
  maxResults?: number
  timeRange?: TavilyTimeRange
  startDate?: string
  endDate?: string
  days?: number
  includeDomains?: string[]
  excludeDomains?: string[]
  country?: string
}

interface TavilyErrorPayload {
  error?: string
  detail?: string
  message?: string
}

interface TavilySearchPayload {
  query?: string
  answer?: string
  results?: Array<{
    title?: string
    url?: string
    content?: string
    score?: number
    published_date?: string
  }>
}

export class TavilyError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = "TavilyError"
    this.statusCode = statusCode
  }
}

function requireTavilyApiKey() {
  const key = process.env.TAVILY_API_KEY?.trim()
  if (!key) {
    throw new TavilyError("Missing TAVILY_API_KEY environment variable.", 500)
  }
  return key
}

function getTavilyBaseUrl() {
  return (process.env.TAVILY_BASE_URL || "https://api.tavily.com").replace(/\/$/, "")
}

function normalizeMaxResults(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 5
  return Math.min(20, Math.max(0, Math.floor(value)))
}

function normalizeDate(value?: string) {
  if (!value) return undefined
  const normalized = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : undefined
}

export async function createTavilySearch(input: TavilySearchRequest): Promise<TavilySearchResponse> {
  const apiKey = requireTavilyApiKey()
  const timeoutMs = 20_000
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${getTavilyBaseUrl()}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: input.query,
        topic: input.topic ?? "general",
        search_depth: input.searchDepth ?? "basic",
        max_results: normalizeMaxResults(input.maxResults),
        include_answer: false,
        include_raw_content: false,
        include_usage: false,
        time_range: input.timeRange,
        start_date: normalizeDate(input.startDate),
        end_date: normalizeDate(input.endDate),
        days: input.days,
        include_domains: input.includeDomains,
        exclude_domains: input.excludeDomains,
        country: input.country,
      }),
      signal: controller.signal,
      cache: "no-store",
    })

    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      const payload = json as TavilyErrorPayload
      throw new TavilyError(
        payload.detail || payload.error || payload.message || "Tavily search request failed.",
        response.status
      )
    }

    const payload = json as TavilySearchPayload
    return {
      query: payload.query?.trim() || input.query,
      answer: payload.answer?.trim() || null,
      results: (payload.results ?? [])
        .map((item) => ({
          title: item.title?.trim() || "Untitled",
          url: item.url?.trim() || "",
          content: item.content?.trim() || "",
          score: typeof item.score === "number" && Number.isFinite(item.score) ? item.score : 0,
          publishedDate: item.published_date?.trim() || null,
        }))
        .filter((item) => item.url.length > 0),
    }
  } catch (error) {
    if (error instanceof TavilyError) {
      throw error
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new TavilyError("Tavily search timed out.", 504)
    }

    throw new TavilyError(error instanceof Error ? error.message : "Unknown Tavily error.")
  } finally {
    clearTimeout(timeout)
  }
}
