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

const SCHEDULE_HOUR_KST = 7
const CHECK_INTERVAL_MS = 5 * 60 * 1000 // Check every 5 minutes
const RETRY_COOLDOWN_MS = 30 * 60 * 1000 // 30 minutes between retries
const MAX_RETRIES = 3
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

let _lastGeneratedDate = ""
let _retryCount = 0
let _retryAfterMs = 0
let _schedulerStarted = false

function getKstDate(): string {
  const kst = new Date(Date.now() + KST_OFFSET_MS)
  return kst.toISOString().slice(0, 10)
}

function getKstHour(): number {
  const kst = new Date(Date.now() + KST_OFFSET_MS)
  return kst.getHours()
}

async function generateForToday(): Promise<void> {
  const todayDate = getKstDate()
  const yesterdayDate = new Date(Date.now() + KST_OFFSET_MS)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const dateStr = yesterdayDate.toISOString().slice(0, 10)

  try {
    console.log(`[jeonju-scheduler] Starting auto-generation for ${dateStr}...`)

    const [ko, en] = await Promise.all([
      generateJeonjuBriefing({ locale: "ko", forceRefresh: true, skipMemoryCache: true }),
      generateJeonjuBriefing({ locale: "en", forceRefresh: true, skipMemoryCache: true }),
    ])

    console.log(
      `[jeonju-scheduler] Auto-generation complete for ${dateStr}. ` +
      `ko: ${ko.data.newsItems.length} items, en: ${en.data.newsItems.length} items`
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

  // Generate
  await generateForToday()
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

  setInterval(() => {
    checkAndGenerate().catch((err) =>
      console.error("[jeonju-scheduler] Periodic check failed:", err?.message ?? err)
    )
  }, CHECK_INTERVAL_MS)
}

// For admin/debug: force immediate generation
export async function forceJeonjuBriefingGeneration(): Promise<void> {
  _lastGeneratedDate = ""
  _retryCount = 0
  _retryAfterMs = 0
  await generateForToday()
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
