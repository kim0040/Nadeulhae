import { NextRequest, NextResponse } from "next/server"
import { createNanoGptChatCompletion } from "@/lib/chat/nanogpt"
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
}

declare global {
  var __nadeulhaeHomeBriefingCache: Map<string, BriefingCacheEntry> | undefined
}

const CACHE_MAX_ENTRIES = 32
const CACHE_TTL_MS = 30 * 60 * 1000

function getCache() {
  if (!globalThis.__nadeulhaeHomeBriefingCache) {
    globalThis.__nadeulhaeHomeBriefingCache = new Map()
  }
  return globalThis.__nadeulhaeHomeBriefingCache
}

function buildCacheKey(locale: BriefingLocale, snapshot: WeatherSnapshot) {
  const signals = [
    snapshot.region,
    snapshot.rainingNow ? "rain" : "dry",
    snapshot.severeAlert ? "alert" : "safe",
    ...snapshot.hazardSignals.sort(),
    snapshot.bulletin?.slice(0, 60) ?? "",
  ].join("|")
  return `${locale}:${signals}`
}

function getCached(cacheKey: string): string | null {
  const cache = getCache()
  const now = Date.now()

  for (const [key, value] of cache.entries()) {
    if (value.expiresAtMs <= now) cache.delete(key)
  }

  const entry = cache.get(cacheKey)
  if (entry && entry.expiresAtMs > now) return entry.data

  if (entry) cache.delete(cacheKey)
  return null
}

function setCache(cacheKey: string, data: string) {
  const cache = getCache()
  cache.set(cacheKey, { data, expiresAtMs: Date.now() + CACHE_TTL_MS })

  if (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAtMs - b[1].expiresAtMs)
    for (let i = 0; i < oldest.length - CACHE_MAX_ENTRIES; i++) {
      cache.delete(oldest[i][0])
    }
  }
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
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  const wd = ["일", "월", "화", "수", "목", "금", "토"][now.getDay()]
  return `${y}년 ${m}월 ${d}일 ${wd}요일`
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
    return `아래 전주 날씨 컨텍스트를 3~5문장으로 친근하게 요약하세요.
- 자연스럽고 따뜻한 톤
- 점수와 위험 신호를 우선 언급
- 특별한 위험(지진/태풍/호우 등)이 있으면 첫 문장에서 경고
- 비가 오면 우산이나 실내 팁을 짧게
- 먼지·미세먼지가 나쁘면 마스크 권고
- 특별한 위험이 없으면 "오늘은 무난한 나들이 날씨"로 시작
- 반드시 한국어로만 답변
- 마크다운/JSON 없이 순수 텍스트만

날씨 컨텍스트:
${context}`
  }

  if (locale === "zh") {
    return `请用3~5句话亲切地总结以下全州天气信息。
- 自然温暖的语气
- 优先提及评分和危险信号
- 如有特殊危险（地震/台风/暴雨等），第一句就警告
- 下雨时简短提及雨伞或室内建议
- 尘埃/雾霾严重时建议戴口罩
- 无特殊危险时以"今天是个不错的出行日子"开头
- 请仅使用中文回答
- 纯文本，不要用Markdown或JSON

天气信息：
${context}`
  }

  if (locale === "ja") {
    return `以下の全州の天気情報を3〜5文で親しみやすく要約してください。
- 自然で温かみのあるトーン
- スコアと危険信号を最初に言及
- 特別な危険（地震/台風/豪雨など）があれば最初の文で警告
- 雨の場合は傘や屋内のアドバイスを簡潔に
- 粉塵・微細粉塵が悪い場合はマスクを推奨
- 特別な危険がなければ「今日は無難なお出かけ日和」で始める
- 必ず日本語のみで回答
- マークダウン/JSONなし、純粋なテキストのみ

天気情報：
${context}`
  }

  return `Summarize the Jeonju weather context below in 3-5 friendly sentences.
- Warm, natural tone
- Mention score and hazards first
- If there's a severe hazard (earthquake/typhoon/heavy rain), warn in the first sentence
- If raining, briefly mention umbrella/indoor tips
- If dust/PM is bad, recommend a mask
- If no special hazard, start with "Today looks like a decent outing day"
- Answer in English only
- Plain text only, no markdown or JSON

Weather context:
${context}`
}

async function handlePOST(request: NextRequest) {
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

  try {
    const result = await createNanoGptChatCompletion({
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

    return NextResponse.json({ summary: summary || "", fromCache: false })
  } catch (error) {
    console.error("[home-briefing] LLM call failed:", error)
    return NextResponse.json({ summary: null, fromCache: false })
  }
}

export const POST = withApiAnalytics(handlePOST)
