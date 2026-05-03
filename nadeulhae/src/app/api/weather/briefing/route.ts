/**
 * Home page AI weather briefing endpoint.
 *
 * Generates a 3-5 sentence natural-language weather summary for the picnic
 * briefing card using the NanoGPT LLM backend. Supports all four UI locales
 * (ko, en, zh, ja) with locale-specific prompt templates.
 *
 * ## Rate limiting (three-layer defence)
 * 1. **IP-level sliding window** — 30 requests per minute per client IP.
 *    Stored in `globalThis.__nadeulhaeHomeBriefingIpRateLimit` (max 2000 entries).
 * 2. **Result cache** — per-locale, per-date, per-region, per-weather-profile.
 *    Cache key includes KST date, region slug, score tier (high/mid/low),
 *    rain/alert flags, hazard signals, and bulletin snippet. 15-minute TTL,
 *    max 64 entries. Stored in `globalThis.__nadeulhaeHomeBriefingCache`.
 * 3. **Per-user daily quota** (optional) — when the request body includes a
 *    `userId`, the request counts against the `home_briefing` action quota
 *    (default 50/day). Uses the same `llm_user_action_usage_daily` DB table
 *    as other LLM features.
 *
 * ## Caching strategy
 * Cache keys are date-aware (via KST `YYYY-MM-DD`) and region-aware so that
 * two users in different regions with different weather will receive different
 * summaries. Score is bucketed into tiers (≥80 high, ≥40 mid, <40 low) to
 * increase cache hit rate within similar conditions.
 *
 * ## Error handling
 * All errors return `{ summary: null, fromCache: false }` — the client
 * falls back to the rule-based `getIntegratedGuide()` text in PicnicBriefing.
 *
 * @route POST /api/weather/briefing?locale=ko
 */
import { NextRequest, NextResponse } from "next/server"
import { createGeneralChatCompletion } from "@/lib/llm/general-llm"
import {
  reserveUserActionDailyRequest,
  recordGlobalLlmRequestOutcome,
  type DailyQuotaReservation,
} from "@/lib/llm/quota"
import { withApiAnalytics } from "@/lib/analytics/route"

export const runtime = "nodejs"

type BriefingLocale = "ko" | "en" | "zh" | "ja"

interface WeatherSnapshot {
  region: string
  score: number
  status: string
  temperatureC: number | null
  humidityPct: number | null
  windMs: number | null
  pm10: number | null
  pm25: number | null
  rainingNow: boolean
  severeAlert: boolean
  hazardSignals: string[]
  bulletin: string | null
}

interface BriefingCacheEntry {
  data: string
  expiresAtMs: number
  metricDate: string
}

declare global {
  var __nadeulhaeHomeBriefingCache: Map<string, BriefingCacheEntry> | undefined
  var __nadeulhaeHomeBriefingIpRateLimit: Map<string, { count: number; resetAt: number }> | undefined
}

// ---------------------------------------------------------------------------
// Cache & rate-limit configuration
// ---------------------------------------------------------------------------

/** Maximum number of cached briefing results. Eviction is LRU by expiry. */
const CACHE_MAX_ENTRIES = 64

/** How long a cached result is valid (15 minutes). Balances freshness vs. LLM cost. */
const CACHE_TTL_MS = 15 * 60 * 1000

/** Max briefing requests per IP per 60-second sliding window. Prevents abuse. */
const IP_RATE_LIMIT_MAX = 30

/** Sliding-window duration for IP rate limiting. */
const IP_RATE_LIMIT_WINDOW_MS = 60 * 1000

/**
 * Quota key used for per-user daily rate limiting via the LLM quota system.
 * Maximum 50 LLM calls per user per day for the home briefing feature.
 */
const USER_DAILY_QUOTA_KEY = "home_briefing"
const USER_DAILY_QUOTA_LIMIT = 50

/**
 * Returns the current date string in Asia/Seoul timezone (YYYY-MM-DD).
 * Used as a cache-key partition so cached results expire naturally at midnight KST.
 */
function getKstDateStr() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"
  return `${get("year")}-${get("month")}-${get("day")}`
}

/**
 * Lazy-initialise the in-memory briefing cache.
 * Uses `globalThis` so the cache survives hot-module reloads during development
 * and is shared across all requests within a single Node.js process.
 */
function getCache() {
  if (!globalThis.__nadeulhaeHomeBriefingCache) {
    globalThis.__nadeulhaeHomeBriefingCache = new Map()
  }
  return globalThis.__nadeulhaeHomeBriefingCache
}

/** Lazy-initialise the IP rate-limit map (same globalThis pattern as cache). */
function getIpRateLimitMap() {
  if (!globalThis.__nadeulhaeHomeBriefingIpRateLimit) {
    globalThis.__nadeulhaeHomeBriefingIpRateLimit = new Map()
  }
  return globalThis.__nadeulhaeHomeBriefingIpRateLimit
}

/**
 * Build a deterministic cache key from locale + weather snapshot.
 *
 * Key strategy:
 * - KST date partitions results by calendar day (natural TTL at midnight)
 * - Region slug normalised to lowercase alphanumeric (first 20 chars)
 * - Score bucketed into tiers: ≥80 "high", ≥40 "mid", <40 "low"
 *   (increases cache hit rate for similar conditions)
 * - Rain/alert flags + sorted hazard signals provide fine-grained distinction
 *   for safety-critical conditions
 * - Bulletin snippet (first 40 non-whitespace chars) catches content changes
 */
function buildCacheKey(locale: BriefingLocale, snapshot: WeatherSnapshot) {
  const datePart = getKstDateStr()
  const regionPart = snapshot.region.replace(/[^a-z0-9가-힣]/gi, "").toLowerCase()
  const signals = [
    datePart,
    regionPart.slice(0, 20),
    snapshot.score >= 80 ? "high" : snapshot.score >= 40 ? "mid" : "low",
    snapshot.rainingNow ? "rain" : "dry",
    snapshot.severeAlert ? "alert" : "safe",
    ...snapshot.hazardSignals.sort(),
    snapshot.bulletin?.slice(0, 40)?.replace(/\s+/g, "") ?? "",
  ].join("|")
  return `${locale}:${signals}`
}

/**
 * Check cache for an existing briefing result.
 * Opportunistically evicts expired entries during lookup to avoid separate
 * cleanup passes.
 */
function getCached(cacheKey: string): string | null {
  const cache = getCache()
  const now = Date.now()
  for (const [key, value] of cache.entries()) {
    if (value.expiresAtMs <= now) cache.delete(key)
  }
  const entry = cache.get(cacheKey)
  if (entry?.expiresAtMs && entry.expiresAtMs > now) return entry.data
  if (entry) cache.delete(cacheKey)
  return null
}

/**
 * Store a briefing result in the cache.
 * If cache exceeds max size, evicts the oldest-by-expiry entries first.
 */
function setCache(cacheKey: string, data: string) {
  const cache = getCache()
  cache.set(cacheKey, {
    data,
    expiresAtMs: Date.now() + CACHE_TTL_MS,
    metricDate: getKstDateStr(),
  })
  if (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAtMs - b[1].expiresAtMs)
    for (let i = 0; i < oldest.length - CACHE_MAX_ENTRIES; i++) {
      cache.delete(oldest[i][0])
    }
  }
}

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "anon"
  ).slice(0, 48)
}

function checkIpRateLimit(ip: string): boolean {
  const map = getIpRateLimitMap()
  const now = Date.now()
  const entry = map.get(ip)
  if (entry && entry.resetAt > now && entry.count >= IP_RATE_LIMIT_MAX) return false
  if (!entry || entry.resetAt <= now) {
    map.set(ip, { count: 1, resetAt: now + IP_RATE_LIMIT_WINDOW_MS })
  } else {
    entry.count++
  }
  if (map.size > 2000) {
    for (const [key, val] of map.entries()) {
      if (val.resetAt <= now) map.delete(key)
    }
  }
  return true
}

function sanitizeSnapshot(raw: unknown): WeatherSnapshot | null {
  if (!raw || typeof raw !== "object") return null
  const s = raw as Record<string, unknown>

  const region = typeof s.region === "string" ? s.region.trim().slice(0, 64) : "Jeonju"
  const score = typeof s.score === "number" && Number.isFinite(s.score) ? s.score : 0
  const status = typeof s.status === "string" ? s.status.trim().slice(0, 32) : ""
  const temperatureC = typeof s.temperatureC === "number" ? s.temperatureC : null
  const humidityPct = typeof s.humidityPct === "number" ? s.humidityPct : null
  const windMs = typeof s.windMs === "number" ? s.windMs : null
  const pm10 = typeof s.pm10 === "number" ? s.pm10 : null
  const pm25 = typeof s.pm25 === "number" ? s.pm25 : null
  const rainingNow = s.rainingNow === true
  const severeAlert = s.severeAlert === true
  const hazardSignals = Array.isArray(s.hazardSignals)
    ? s.hazardSignals.filter((h): h is string => typeof h === "string").slice(0, 8)
    : []
  const bulletin = typeof s.bulletin === "string" ? s.bulletin.trim().slice(0, 400) || null : null

  return { region, score, status, temperatureC, humidityPct, windMs, pm10, pm25, rainingNow, severeAlert, hazardSignals, bulletin }
}

function getKstDateLabel() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"
  const wdMap: Record<string, string> = { Sun: "일", Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토" }
  const wd = wdMap[get("weekday")] ?? get("weekday")
  return `${get("year")}년 ${get("month")}월 ${get("day")}일 ${wd}요일`
}

function toLocaleTemp(c: number | null, locale: BriefingLocale) {
  if (c == null) return "--"
  if (locale === "en") return `${c}°C`
  return `${c}°C`
}

function buildWeatherContext(snapshot: WeatherSnapshot, locale: BriefingLocale) {
  const dateLabel = getKstDateLabel()
  const temp = toLocaleTemp(snapshot.temperatureC, locale)
  const lines = [
    `[Date/KST] ${dateLabel}`,
    `[Region] ${snapshot.region}`,
    `[Score] ${snapshot.score}/100 · ${snapshot.status}`,
    `[Temp] ${temp} · Humidity ${snapshot.humidityPct ?? "--"}% · Wind ${snapshot.windMs ?? "--"}m/s`,
    `[Air] PM10 ${snapshot.pm10 ?? "--"} · PM2.5 ${snapshot.pm25 ?? "--"}`,
    `[Rain] ${snapshot.rainingNow ? "YES" : "no"}`,
    `[SevereAlert] ${snapshot.severeAlert ? "ACTIVE" : "none"}`,
  ]
  if (snapshot.hazardSignals.length > 0) {
    lines.push(`[Hazards] ${snapshot.hazardSignals.join(", ")}`)
  }
  if (snapshot.bulletin) {
    lines.push(`[Bulletin] ${snapshot.bulletin.slice(0, 300)}`)
  }
  return lines.join("\n")
}

function buildBriefingPrompt(locale: BriefingLocale, context: string) {
  if (locale === "ko") {
    return `아래 전주 날씨 컨텍스트를 4~6문장으로 친근하게 요약하세요.
- 자연스럽고 따뜻한 톤
- 첫 문장은 점수와 위험 신호를 우선 언급 (예: "⚠️ 지진 경보가 발효 중이니 안전에 각별히 주의하세요! 오늘 전주는 날씨 점수 90점으로...")
- 특별한 위험(지진/태풍/호우 등)이 있으면 위험 종류를 정확히 명시하고, 가능하면 어느 지역인지 언급 (예: "덕진동 쪽은 비 소식이 없지만 전북 동부 지역은 오후부터 비가 올 수 있어요")
- 태풍이면 태풍명, 지진이면 규모/위치, 호우면 강수량 등 구체적 수치를 포함
- 비가 오면 우산이나 실내 팁을 짧게
- 먼지·미세먼지가 나쁘면 마스크 권고와 함께 현재 수치(PM10/PM2.5)를 언급
- 기온, 습도, 풍속 등 기본 날씨를 간략히 덧붙이기 (수치 포함)
- 특별한 위험이 없으면 "오늘은 무난한 나들이 날씨"로 시작
- 반드시 한국어로만 답변
- 마크다운/JSON 없이 순수 텍스트만

날씨 컨텍스트:
${context}`
  }

  if (locale === "zh") {
    return `请用4~6句话亲切地总结以下全州天气信息。
- 自然温暖的语气
- 第一句优先提及评分和危险信号（例如："⚠️ 当前有地震警报，请注意安全！今天全州天气评分90分..."）
- 如有特殊危险（地震/台风/暴雨等），准确说明危险类型，尽量提及影响区域（例如："德津洞无雨，但全北东部地区下午起可能有雨"）
- 台风请说明台风名称，地震请说明震级/位置，暴雨请说明降水量等具体数值
- 下雨时简短提及雨伞或室内建议
- 尘埃/雾霾严重时建议戴口罩并说明当前PM10/PM2.5数值
- 简略补充气温、湿度、风速等基本天气数据（含数值）
- 无特殊危险时以"今天是个不错的出行日子"开头
- 请仅使用中文回答
- 纯文本，不要用Markdown或JSON

天气信息：
${context}`
  }

  if (locale === "ja") {
    return `以下の全州の天気情報を4〜6文で親しみやすく要約してください。
- 自然で温かみのあるトーン
- 最初の文でスコアと危険信号を優先して言及（例：「⚠️ 地震警報が発令中ですので安全に十分注意してください！今日の全州は天気スコア90点で...」）
- 特別な危険（地震/台風/豪雨など）があれば危険の種類を正確に明示し、可能であれば影響地域も言及（例：「徳津洞付近は雨の心配がありませんが、全北東部地域は午後から雨の可能性があります」）
- 台風なら台風名、地震なら規模/位置、豪雨なら降水量など具体的な数値を含める
- 雨の場合は傘や屋内のアドバイスを簡潔に
- 粉塵・微細粉塵が悪い場合はマスクを推奨し現在のPM10/PM2.5数値を言及
- 気温、湿度、風速などの基本天気を簡潔に補足（数値を含む）
- 特別な危険がなければ「今日は無難なお出かけ日和」で始める
- 必ず日本語のみで回答
- マークダウン/JSONなし、純粋なテキストのみ

天気情報：
${context}`
  }

  return `Summarize the Jeonju weather context below in 4-6 friendly sentences.
- Warm, natural tone
- First sentence: mention score and hazards with urgency (e.g., "⚠️ An earthquake alert is active — stay safe! Today's Jeonju score is 90...")
- If there's a severe hazard (earthquake/typhoon/heavy rain), name the specific hazard type and, if available, the affected area (e.g., "Deokjin-dong should stay dry, but eastern Jeonbuk may see rain in the afternoon")
- For typhoons name the typhoon, for earthquakes mention magnitude/location, for heavy rain mention rainfall amounts with specific numbers
- If raining, briefly mention umbrella/indoor tips
- If dust/PM is bad, recommend a mask and mention current PM10/PM2.5 values
- Briefly include temperature, humidity, wind speed with actual numbers
- If no special hazard, start with "Today looks like a decent outing day"
- Answer in English only
- Plain text only, no markdown or JSON

Weather context:
${context}`
}

async function handlePOST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!checkIpRateLimit(ip)) {
    return NextResponse.json({ error: "Too many briefing requests" }, { status: 429 })
  }

  const searchParams = request.nextUrl.searchParams
  const locale = (searchParams.get("locale") ?? "ko") as BriefingLocale
  if (!["ko", "en", "zh", "ja"].includes(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const snapshot = sanitizeSnapshot(body)
  if (!snapshot) {
    return NextResponse.json({ error: "Invalid weather snapshot" }, { status: 400 })
  }

  const cacheKey = buildCacheKey(locale, snapshot)
  const cached = getCached(cacheKey)
  if (cached) {
    return NextResponse.json({ summary: cached, fromCache: true })
  }

  const weatherContext = buildWeatherContext(snapshot, locale)
  const systemPrompt = buildBriefingPrompt(locale, weatherContext)

  // Quota check (optional — userId not required; silently skipped if absent)
  // This consumes one slot from the user's daily `home_briefing` quota.
  // If the user is over the limit, we return 429 without calling the LLM.
  let reservation: DailyQuotaReservation | null = null
  if (body && typeof body === "object" && "userId" in body) {
    const uid = (body as Record<string, unknown>).userId
    if (typeof uid === "string" && uid.length > 0 && uid.length <= 64) {
      try {
        reservation = await reserveUserActionDailyRequest({
          userId: uid,
          quotaKey: USER_DAILY_QUOTA_KEY,
          limit: USER_DAILY_QUOTA_LIMIT,
        })
        if (!reservation.allowed) {
          return NextResponse.json(
            { error: "Daily briefing quota reached", summary: null, fromCache: false },
            { status: 429 }
          )
        }
      } catch {}
    }
  }

  try {
    const result = await createGeneralChatCompletion({
      requestKind: "chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: weatherContext },
      ],
      maxTokens: 280,
      temperature: 0.4,
      timeoutMs: 15000,
    })

    const summary = result.content.replace(/[\x00-\x1f]/g, " ").trim().slice(0, 600)
    if (summary) {
      setCache(cacheKey, summary)
    }

    if (reservation) {
      recordGlobalLlmRequestOutcome({
        metricDate: reservation.usage.metricDate,
        success: true,
      }).catch(() => {})
    }

    return NextResponse.json({ summary: summary || "", fromCache: false })
  } catch (error) {
    console.error("[home-briefing] LLM call failed:", error)
    if (reservation) {
      recordGlobalLlmRequestOutcome({
        metricDate: reservation.usage.metricDate,
        success: false,
      }).catch(() => {})
    }
    return NextResponse.json({ summary: null, fromCache: false })
  }
}

export const POST = withApiAnalytics(handlePOST)
