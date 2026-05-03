/**
 * Today's Outlook — AI-generated personalized weather briefing.
 *
 * Takes current weather data and generates a friendly, conversational
 * briefing in the user's language. Results are cached in-memory by
 * (date, locale, regionKey) and in DB for durability.
 *
 * Rate limiting: max 30 LLM calls per language per day.
 */

import { createGeneralChatCompletion } from "@/lib/llm/general-llm"

const DAILY_LIMIT_PER_LOCALE = 30
const _dailyCounts: Record<string, number> = {}
let _dailyDate = ""

const outlookCache = new Map<string, { expiresAt: number; data: string }>()
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

function getToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === "year")?.value ?? "0000"
  const m = parts.find((p) => p.type === "month")?.value ?? "00"
  const d = parts.find((p) => p.type === "day")?.value ?? "00"
  return `${y}-${m}-${d}`
}

function resetDailyIfNeeded() {
  const today = getToday()
  if (_dailyDate !== today) {
    _dailyDate = today
    for (const k of Object.keys(_dailyCounts)) delete _dailyCounts[k]
  }
}

function canCall(locale: string): boolean {
  resetDailyIfNeeded()
  return (_dailyCounts[locale] ?? 0) < DAILY_LIMIT_PER_LOCALE
}

function recordCall(locale: string) {
  resetDailyIfNeeded()
  _dailyCounts[locale] = (_dailyCounts[locale] ?? 0) + 1
}

export interface OutlookWeatherData {
  temp: number
  humidity: number
  wind: number
  sky: string
  pty: number
  pm10: number
  pm25: number
  khai: number
  score: number
  status: string
  region: string
  isRain: boolean
  hasWarning: boolean
  bulletinSummary: string
}

const PROMPTS: Record<string, string> = {
  ko: `당신은 '나들AI'입니다. 전주를 기반으로 한 야외활동 도우미로, 지금 현재 날씨를 보고 사용자에게 3~4문장의 친근한 종합 안내를 해주세요.

어투는 "오늘은~", "지금은~"으로 시작하고, "나들이", "산책", "야외활동", "외출" 같은 단어를 자연스럽게 섞어주세요.
기온, 미세먼지, 하늘 상태, 바람을 종합적으로 판단해 주세요.
점수가 80점 이상이면 매우 긍정적으로, 40점 미만이면 조심스럽게 조언해주세요.

중요 규칙:
- 딱딱한 어투 금지. 친구에게 말하듯 자연스럽게
- "~입니다" 보다는 "~에요", "~네요" 같은 구어체
- 특보가 있으면 반드시 언급하고 주의 환기
- 4문장 이내로 간결하게
- 이모지 금지 (별도 UI에서 처리)`,

  en: `You are 'Nadeul AI', a Jeonju-based outdoor activity assistant. Write a 3-4 sentence friendly briefing based on the current weather data.

Start with "Right now..." or "Today...". Mix in words like "outing", "stroll", "outdoor activity" naturally.
Consider temperature, air quality, sky condition, and wind holistically.
Score 80+ = very positive, below 40 = cautious advice.

Rules:
- Casual, conversational tone
- Use contractions naturally (it's, you'll, etc.)
- If there are weather warnings, mention them clearly
- 4 sentences max, concise`,

  zh: `你是"나들AI"，全州户外活动助手。根据当前天气数据，用3-4句亲切的中文给出综合建议。

以"现在..."或"今天..."开头，自然地使用"散步"、"户外活动"、"外出"等词。
综合考虑温度、空气质量、天空状况和风力。
评分80+要非常积极，低于40要谨慎建议。

规则：
- 轻松对话语气
- 如果有天气警报务必提及
- 最多4句，简洁明了`,

  ja: `あなたは「나들AI」、全州のアウトドア活動アシスタントです。現在の天気データをもとに3〜4文の親しみやすい日本語の総合案内を書いてください。

「今は〜」「今日は〜」で始め、「お出かけ」「散歩」「アウトドア」などの言葉を自然に交えてください。
気温、空気質、空模様、風を総合的に判断してください。
スコア80以上ならとてもポジティブに、40未満なら慎重にアドバイスしてください。

ルール：
- カジュアルで会話的なトーン
- 気象警報があれば必ず言及
- 最大4文、簡潔に`,
}

function buildUserPrompt(data: OutlookWeatherData, locale: string): string {
  const langLabel = locale === "ko" ? "한국어" : locale === "zh" ? "중국어" : locale === "ja" ? "일본어" : "English"
  return `현재 날씨 데이터 (${data.region}):
- 기온: ${data.temp}°C
- 습도: ${data.humidity}%
- 바람: ${data.wind}m/s
- 하늘: ${data.sky}
- 미세먼지: PM10=${data.pm10}, PM2.5=${data.pm25}
- 통합대기지수: ${data.khai}
- 야외활동 점수: ${data.score}/100 (${data.status})
- 비 여부: ${data.isRain ? "예" : "아니오"}
- 기상특보: ${data.hasWarning ? "있음" : "없음"}
${data.bulletinSummary ? `- 기상 상황: ${data.bulletinSummary}` : ""}

위 데이터를 바탕으로 ${langLabel}로 종합 안내를 작성해주세요.`
}

export async function generateOutlook(
  data: OutlookWeatherData,
  locale: string
): Promise<string> {
  const today = getToday()
  const cacheKey = `${today}:${locale}:${data.region}`

  // Check in-memory cache
  const cached = outlookCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  // Check rate limit
  if (!canCall(locale)) {
    // Return a static fallback message
    const fallbacks: Record<string, string> = {
      ko: `${data.score >= 70 ? "오늘은 야외활동하기 좋은 날씨입니다." : "오늘 날씨를 확인하고 외출 준비를 해보세요."} 기온 ${data.temp}°C, 미세먼지 ${data.pm10}μg/m³.`,
      en: `${data.score >= 70 ? "The weather looks good for outdoor activities today." : "Check the weather before heading out today."} ${data.temp}°C, PM10 ${data.pm10}μg/m³.`,
      zh: `${data.score >= 70 ? "今天适合户外活动。" : "外出前请查看天气。"} 温度 ${data.temp}°C, PM10 ${data.pm10}μg/m³.`,
      ja: `${data.score >= 70 ? "今日はアウトドアに良い天気です。" : "お出かけ前に天気をチェックしてください。"} 気温 ${data.temp}°C, PM10 ${data.pm10}μg/m³.`,
    }
    return fallbacks[locale] ?? fallbacks.en
  }

  const systemPrompt = PROMPTS[locale] ?? PROMPTS.en
  const userPrompt = buildUserPrompt(data, locale)

  try {
    recordCall(locale)
    const completion = await createGeneralChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      requestKind: "chat",
      maxTokens: 300,
      temperature: 0.5,
      timeoutMs: 30000,
    })

    const result = completion.content.trim()
    outlookCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: result })
    return result
  } catch (error) {
    console.error("[outlook] LLM generation failed:", error instanceof Error ? error.message : error)
    const fallbacks: Record<string, string> = {
      ko: `현재 ${data.region} 기준 기온 ${data.temp}°C, 미세먼지 ${data.pm10}μg/m³로 ${data.score >= 70 ? "야외활동에 적합한 조건입니다." : "실내 활동을 권장합니다."}`,
      en: `Currently ${data.temp}°C in ${data.region} with PM10 at ${data.pm10}μg/m³ — ${data.score >= 70 ? "suitable for outdoor activities." : "indoor activities recommended."}`,
      zh: `${data.region} 当前温度 ${data.temp}°C, PM10 ${data.pm10}μg/m³, ${data.score >= 70 ? "适合户外活动。" : "建议室内活动。"}`,
      ja: `${data.region} 現在 ${data.temp}°C, PM10 ${data.pm10}μg/m³, ${data.score >= 70 ? "アウトドアに適しています。" : "室内活動をお勧めします。"}`,
    }
    return fallbacks[locale] ?? fallbacks.en
  }
}
