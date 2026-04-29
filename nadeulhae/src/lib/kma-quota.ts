/**
 * KMA (기상청) API daily call counter.
 *
 * KMA public data portal provides up to 10,000 API calls per day for
 * development accounts. This module tracks cumulative daily API calls
 * across all weather endpoints and provides a soft cap at 80% to leave
 * headroom for burst traffic and image endpoints.
 *
 * The counter is module-level (per-process). In a multi-instance deployment,
 * each instance tracks its own usage independently.
 *
 * @module kma-quota
 */

const KMA_DAILY_LIMIT = 8000

let _kmaDailyCount = 0
let _kmaDailyDate = ""

/**
 * Reset the counter if the date has changed (KST midnight rollover).
 */
function resetKmaDailyIfNeeded() {
  const today = new Date().toISOString().slice(0, 10)
  if (_kmaDailyDate !== today) {
    _kmaDailyDate = today
    _kmaDailyCount = 0
  }
}

/**
 * Check whether a new KMA API call can be made within the daily quota.
 * Returns `false` when the soft cap (8,000 calls) is reached.
 * Callers should fall back to cached data or return a degraded response.
 */
export function canCallKmaApi(): boolean {
  resetKmaDailyIfNeeded()
  return _kmaDailyCount < KMA_DAILY_LIMIT
}

/**
 * Record a completed KMA API call. Call this AFTER each successful
 * or attempted KMA API request to keep the counter accurate.
 * Logs a warning when the soft cap is first reached.
 */
export function recordKmaApiCall(): void {
  resetKmaDailyIfNeeded()
  _kmaDailyCount += 1
  if (_kmaDailyCount === KMA_DAILY_LIMIT) {
    console.warn(
      `[kma-quota] Daily soft cap reached: ${_kmaDailyCount}/${KMA_DAILY_LIMIT}`
    )
  }
}

/**
 * Return the current daily usage statistics for monitoring/debugging.
 */
export function getKmaDailyUsage(): { count: number; limit: number } {
  resetKmaDailyIfNeeded()
  return { count: _kmaDailyCount, limit: KMA_DAILY_LIMIT }
}
