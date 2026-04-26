export type TavilyTopic = "general" | "news" | "finance"
export type TavilySearchDepth = "basic" | "advanced" | "fast" | "ultra-fast"
export type TavilyTimeRange = "day" | "week" | "month" | "year" | "d" | "w" | "m" | "y"
export type TavilyAnswerMode = boolean | "basic" | "advanced"

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
  chunksPerSource?: number
  includeAnswer?: TavilyAnswerMode
  includeRawContent?: boolean | "markdown" | "text"
  autoParameters?: boolean
  exactMatch?: boolean
  includeUsage?: boolean
  includeFavicon?: boolean
  includeDomains?: string[]
  excludeDomains?: string[]
  country?: string // Tavily expects full country names such as "South Korea"
}

interface TavilyErrorPayload {
  error?: string | Record<string, unknown>
  detail?: string | Record<string, unknown>
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

function normalizeChunksPerSource(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  return Math.min(3, Math.max(1, Math.floor(value)))
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
        chunks_per_source: normalizeChunksPerSource(input.chunksPerSource),
        max_results: normalizeMaxResults(input.maxResults),
        include_answer: input.includeAnswer ?? false,
        include_raw_content: input.includeRawContent ?? false,
        include_usage: input.includeUsage ?? false,
        include_favicon: input.includeFavicon ?? false,
        auto_parameters: input.autoParameters ?? false,
        exact_match: input.exactMatch ?? false,
        time_range: input.timeRange,
        start_date: normalizeDate(input.startDate),
        end_date: normalizeDate(input.endDate),
        days: input.days,
        include_domains: input.includeDomains,
        exclude_domains: input.excludeDomains,
        // NOTE: send country only when it looks like a full name, not ISO code.
        country: input.country && input.country.length > 3 ? input.country : undefined,
      }),
      signal: controller.signal,
      cache: "no-store",
    })

    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      const payload = json as TavilyErrorPayload
      const extractMsg = (v: unknown): string | undefined => {
        if (typeof v === "string") return v
        if (v && typeof v === "object" && "error" in v && typeof (v as Record<string, unknown>).error === "string") {
          return (v as Record<string, string>).error
        }
        if (v && typeof v === "object" && "message" in v && typeof (v as Record<string, unknown>).message === "string") {
          return (v as Record<string, string>).message
        }
        return undefined
      }
      throw new TavilyError(
        extractMsg(payload.detail) || extractMsg(payload.error) || payload.message || "Tavily search request failed.",
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
