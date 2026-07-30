/**
 * Jeonju daily briefing auto-generation scheduler.
 *
 * Every day at 07:00 KST, automatically generates Korean and English
 * briefings for the previous day's news. Results are cached in memory
 * and persisted to the database so that the first visitor of the day
 * gets an instant cached response.
 *
 * Safety guards:
 * - Runs once per day (tracks completion by date stamp)
 * - Retries up to 3 times on failure (30-minute cooldown between attempts)
 * - Does NOT block server startup (fire-and-forget)
 * - Rate limits itself to prevent API abuse
 *
 * @module jeonju-scheduler
 */

import { generateJeonjuBriefing } from "@/lib/jeonju-briefing/service"
import { getJeonjuBriefingByDateAndLocale } from "@/lib/jeonju-briefing/repository"

const SCHEDULE_HOUR_KST = 7
const CHECK_INTERVAL_MS = 5 * 60 * 1000 // Check every 5 minutes
const RETRY_COOLDOWN_MS = 30 * 60 * 1000 // 30 minutes between retries
const MAX_RETRIES = 3

let _lastGeneratedDate = ""
let _retryCount = 0
let _retryAfterMs = 0
let _schedulerStarted = false
let _generationInFlight: Promise<void> | null = null

function parseKstParts(tsMs = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(tsMs))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: Number(get("hour")),
  }
}

function getKstDate(): string {
  const p = parseKstParts()
  return `${p.year}-${p.month}-${p.day}`
}

function getKstHour(): number {
  return parseKstParts().hour
}

async function generateForToday(): Promise<void> {
  const todayDate = getKstDate()
  const p = parseKstParts()
  // Day boundary is 07:00 KST, not midnight
  const offset = p.hour < 7 ? 2 : 1
  const d = new Date(`${p.year}-${p.month}-${p.day}T00:00:00+09:00`)
  d.setDate(d.getDate() - offset)
  const dateStr = d.toISOString().slice(0, 10)

  // Restart-safety: the "already generated today" guard lives in memory, so a
  // process restart after 07:00 KST would otherwise re-run the full (expensive)
  // Tavily + 4× LLM generation. If today's briefing is already persisted, skip.
  try {
    const existing = await getJeonjuBriefingByDateAndLocale(dateStr, "ko")
    if (existing) {
      console.log(`[jeonju-scheduler] Briefing for ${dateStr} already persisted — skipping regeneration.`)
      _lastGeneratedDate = todayDate
      _retryCount = 0
      _retryAfterMs = 0
      return
    }
  } catch (err) {
    // If the existence check fails (e.g. DB hiccup), fall through and generate.
    console.warn("[jeonju-scheduler] Existing-briefing check failed; proceeding to generate:", err instanceof Error ? err.message : err)
  }

  try {
    console.log(`[jeonju-scheduler] Starting auto-generation for ${dateStr}...`)

    // 1. Generate Korean first (Tavily search + LLM)
    const ko = await generateJeonjuBriefing({ locale: "ko", forceRefresh: true, skipMemoryCache: true })

    // 2. Translate to other languages sequentially with delays
    const translations: Array<{ locale: "en" | "zh" | "ja"; delayMs: number }> = [
      { locale: "en", delayMs: 3000 },
      { locale: "zh", delayMs: 8000 },
      { locale: "ja", delayMs: 8000 },
    ]

    let enItems = 0, zhItems = 0, jaItems = 0
    for (const { locale, delayMs } of translations) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
      try {
        const result = await generateJeonjuBriefing({
          locale,
          forceRefresh: true,
          skipMemoryCache: true,
          koreanBriefing: ko.data,
        })
        if (locale === "en") enItems = result.data.newsItems.length
        if (locale === "zh") zhItems = result.data.newsItems.length
        if (locale === "ja") jaItems = result.data.newsItems.length
        console.log(`[jeonju-scheduler] ${locale} translation done: ${result.data.newsItems.length} items`)
      } catch (err) {
        console.warn(`[jeonju-scheduler] ${locale} translation failed:`, err instanceof Error ? err.message : err)
      }
    }

    console.log(
      `[jeonju-scheduler] Auto-generation complete for ${dateStr}. ` +
      `ko:${ko.data.newsItems.length} en:${enItems} zh:${zhItems} ja:${jaItems}`
    )

    _lastGeneratedDate = todayDate
    _retryCount = 0
    _retryAfterMs = 0
  } catch (error) {
    _retryCount += 1
    const msg = error instanceof Error ? error.message : String(error)
    console.error(
      `[jeonju-scheduler] Auto-generation failed for ${dateStr} ` +
      `(attempt ${_retryCount}/${MAX_RETRIES}): ${msg.slice(0, 120)}`
    )

    if (_retryCount >= MAX_RETRIES) {
      _lastGeneratedDate = todayDate // Mark as "tried" to prevent further attempts
      console.warn(
        `[jeonju-scheduler] Max retries reached for ${dateStr}. ` +
        `Will try again tomorrow.`
      )
    } else {
      _retryAfterMs = Date.now() + RETRY_COOLDOWN_MS
    }
  }
}

async function checkAndGenerate(): Promise<void> {
  const nowDate = getKstDate()
  const nowHour = getKstHour()

  // Already generated for today
  if (_lastGeneratedDate === nowDate) return

  // Still in cooldown after a failed attempt
  if (_retryAfterMs > 0 && Date.now() < _retryAfterMs) return

  // Not yet 7 AM KST
  if (nowHour < SCHEDULE_HOUR_KST) return

  // Generate. A run may take longer than the five-minute polling interval,
  // so all callers share one promise instead of starting duplicate LLM work.
  await generateOnce()
}

async function generateOnce() {
  if (_generationInFlight) {
    return _generationInFlight
  }

  const generation = generateForToday()
  _generationInFlight = generation

  try {
    await generation
  } finally {
    if (_generationInFlight === generation) {
      _generationInFlight = null
    }
  }
}

/**
 * Start the daily briefing scheduler. Safe to call multiple times.
 * Runs a lightweight check every CHECK_INTERVAL_MS.
 */
export function startJeonjuBriefingScheduler(): void {
  if (_schedulerStarted) return
  _schedulerStarted = true

  console.log(
    `[jeonju-scheduler] Daily briefing scheduler started. ` +
    `Will generate at ${SCHEDULE_HOUR_KST}:00 KST every day.`
  )

  // Run an immediate check in case we missed the 7 AM window during startup
  checkAndGenerate().catch((err) =>
    console.error("[jeonju-scheduler] Initial check failed:", err?.message ?? err)
  )

  const interval = setInterval(() => {
    checkAndGenerate().catch((err) =>
      console.error("[jeonju-scheduler] Periodic check failed:", err?.message ?? err)
    )
  }, CHECK_INTERVAL_MS)

  if (typeof interval.unref === "function") {
    interval.unref()
  }
}

// For admin/debug: force immediate generation
export async function forceJeonjuBriefingGeneration(): Promise<void> {
  _lastGeneratedDate = ""
  _retryCount = 0
  _retryAfterMs = 0
  await generateOnce()
}

// For monitoring
export function getJeonjuSchedulerStatus() {
  return {
    started: _schedulerStarted,
    lastGeneratedDate: _lastGeneratedDate,
    retryCount: _retryCount,
    retryAfterMs: _retryAfterMs,
    kstNow: getKstDate(),
    kstHour: getKstHour(),
  }
}
