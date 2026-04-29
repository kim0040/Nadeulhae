// KMA API daily call counter.
// KMA public data portal 개발계정 limit: 10,000 calls/day.
// Soft cap at 80% to leave headroom for other features.

const KMA_DAILY_LIMIT = 8000

let _kmaDailyCount = 0
let _kmaDailyDate = ""

function resetKmaDailyIfNeeded() {
  const today = new Date().toISOString().slice(0, 10)
  if (_kmaDailyDate !== today) {
    _kmaDailyDate = today
    _kmaDailyCount = 0
  }
}

export function canCallKmaApi(): boolean {
  resetKmaDailyIfNeeded()
  return _kmaDailyCount < KMA_DAILY_LIMIT
}

export function recordKmaApiCall(): void {
  resetKmaDailyIfNeeded()
  _kmaDailyCount += 1
  if (_kmaDailyCount === KMA_DAILY_LIMIT) {
    console.warn(`[kma-quota] Daily limit reached: ${_kmaDailyCount}/${KMA_DAILY_LIMIT}`)
  }
}

export function getKmaDailyUsage(): { count: number; limit: number } {
  resetKmaDailyIfNeeded()
  return { count: _kmaDailyCount, limit: KMA_DAILY_LIMIT }
}
