/**
 * Course recommendation engine — personalized, TiDB-backed.
 *
 * Queries indexed TiDB to filter 29K+ places by weather, user interests,
 * GPS distance, and feedback exclusions. Returns structured course slots.
 */

import { queryRows } from "@/lib/db"
import type { RowDataPacket } from "mysql2"
import type { ChatWeatherContext } from "@/lib/chat/prompt"
import type { CourseSlot, PlaceSlotItem, UserProfile, CourseTheme } from "@/lib/course-types"
import { COURSE_THEME_CONFIG, INTEREST_LABEL_KO, COURSE_ENGINE_COPY } from "@/lib/course-types"
import type { CourseEngineLanguage } from "@/lib/course-types"

// Re-export types for backward compatibility
export type { CourseSlot, PlaceSlotItem, UserProfile, CourseTheme, CourseEngineLanguage }
export { COURSE_THEME_CONFIG, INTEREST_LABEL_KO, COURSE_ENGINE_COPY }

// ---------------------------------------------------------------------------
// Types (server-only)
// ---------------------------------------------------------------------------

interface PlaceRow extends RowDataPacket {
  name: string
  category: string
  place_type: string
  lat: number | null
  lon: number | null
  address: string | null
  rating: number | null
  review_count: number | null
  kakao_url: string | null
  menu_summary: string | null
  weather_tags: string | null
  reviews_text: string | null
  hours_raw: string | null
  review_summary: string | null
  review_keywords: string | null // JSON array
  review_sentiment: string | null
  review_picks: string | null // JSON array
}

export interface CourseRequest {
  timeRange?: string
  location?: string
  weatherContext?: ChatWeatherContext | null
  userProfile?: UserProfile | null
  userLat?: number | null
  userLon?: number | null
  excludeNames?: string[]
  theme?: CourseTheme
  language?: CourseEngineLanguage
}

interface ScoredPlace {
  name: string
  category: string
  place_type: string
  lat: number | null
  lon: number | null
  address: string | null
  rating: number | null
  kakao_url: string | null
  menu_summary: string | null
  review_summary: string | null
  review_keywords: string[] | null
  review_picks: string[] | null
  score: number
  interestBonus: number
  interestTag: string | null
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function distanceBonus(lat: number | null, lon: number | null, uLat: number, uLon: number): number {
  if (lat == null || lon == null) return 0
  const d = haversineKm(uLat, uLon, lat, lon)
  if (d <= 1) return 5
  if (d <= 3) return 3
  if (d <= 5) return 2
  if (d <= 10) return 1
  return 0
}

function getDistanceNote(lat: number | null, lon: number | null, uLat: number | null, uLon: number | null, lang: CourseEngineLanguage = "ko"): string {
  if (uLat == null || uLon == null || lat == null || lon == null) return ""
  const d = haversineKm(uLat, uLon, lat, lon)
  const copy = COURSE_ENGINE_COPY[lang].distanceNote
  if (d <= 0.5) return copy.walking5min
  if (d <= 1) return copy.about1km
  if (d <= 3) return copy.aboutKm(Math.round(d))
  if (d <= 5) return copy.aboutKm(Math.round(d))
  return ""
}

function qualityScore(r: PlaceRow, reviewKeywords: string[] | null): number {
  let s = 0
  if (r.rating != null) s += Math.min(r.rating * 2, 10)
  if (r.review_count != null && r.review_count > 0) s += Math.min(Math.log10(r.review_count + 1) * 2, 5)
  if (r.menu_summary) s += 1
  if (r.kakao_url) s += 1
  if (r.rating != null && r.rating >= 4) s += 3

  // Flat Review Presence Bonus (리뷰 보유 가산점)
  // Give a strong +8 points bonus if a place has real customer reviews.
  // This ensures that verified places with reviews are prioritized.
  let hasValidReviews = false
  if (r.reviews_text) {
    try {
      const reviews = JSON.parse(r.reviews_text)
      if (Array.isArray(reviews) && reviews.length > 0) {
        s += 8 // Flat 가산점 +8점 부여
        s += Math.min(reviews.length, 5) // +1 per review, max +5
        hasValidReviews = true
      }
    } catch {}
  }

  // Hours bonus: having business hours data is a signal of completeness
  if (r.hours_raw) s += 1
  // LLM review keyword bonus: having keywords means LLM-verified quality
  if (reviewKeywords && reviewKeywords.length > 0) s += 2
  return s
}

/**
 * Heuristic: check if a place is likely closed at the given time.
 * Parses common Korean business hour patterns.
 */
function isLikelyClosedNow(hoursRaw: string | null, kstHour: number, kstDay: number): boolean {
  if (!hoursRaw) return false // unknown → assume open
  const h = kstHour

  // Common closing patterns
  if (hoursRaw.includes("24시간") || hoursRaw.includes("연중무휴")) return false

  // Extract closing time patterns like "~ 22:00", "~ 21:00", "까지 20:00"
  const closeMatch = hoursRaw.match(/[~∼까지]\s*(\d{1,2}):?(\d{2})?/)
  if (closeMatch) {
    const closeHour = parseInt(closeMatch[1], 10)
    if (h >= closeHour) return true
  }

  // Break time: "휴게시간 ... 15:00 ~ 17:00"
  const breakMatch = hoursRaw.match(/휴게시간.*?(\d{1,2}):?\d{2}\s*[~∼]\s*(\d{1,2}):?\d{2}/)
  if (breakMatch) {
    const breakStart = parseInt(breakMatch[1], 10)
    const breakEnd = parseInt(breakMatch[2], 10)
    if (h >= breakStart && h < breakEnd) return true
  }

  // Day-of-week patterns: "월~토", "화~일", "월요일 휴무"
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"]
  const today = dayNames[kstDay]
  const closedDay = hoursRaw.match(new RegExp(`${today}(?:요일)?\\s*(?:휴무|정기휴무|휴일|쉬는날)`))
  if (closedDay) return true

  // Very early / late: most places closed
  if (h < 8 || h >= 23) {
    // Unless explicitly 24h or has late hours
    if (!hoursRaw.includes("24시간") && !hoursRaw.includes("새벽") && !hoursRaw.includes("심야")) {
      return true
    }
  }

  return false
}

// ---------------------------------------------------------------------------
// Interest → category boost
// ---------------------------------------------------------------------------

const INTEREST_CATEGORY_BOOST: Record<string, { categories: string[]; boost: number }> = {
  foodie: { categories: ["restaurant", "pub"], boost: 5 },
  cafe: { categories: ["cafe", "bakery"], boost: 5 },
  nature: { categories: ["nature"], boost: 5 },
  art_museum: { categories: ["attraction", "culture"], boost: 5 },
  festival: { categories: ["festival"], boost: 5 },
  shopping: { categories: ["shopping"], boost: 5 },
  picnic: { categories: ["nature"], boost: 4 },
  activity: { categories: ["sports"], boost: 4 },
  photography: { categories: ["attraction", "nature"], boost: 3 },
  walking: { categories: ["nature"], boost: 3 },
  drive: { categories: ["attraction", "nature"], boost: 2 },
  family: { categories: ["nature", "attraction"], boost: 3 },
  pet: { categories: ["nature"], boost: 3 },
}

function computeInterestBonus(category: string, name: string, menuSummary: string | null, profile: UserProfile | null): { bonus: number; matchedTag: string | null } {
  if (!profile?.interestTags?.length) return { bonus: 0, matchedTag: null }
  let total = 0
  let bestTag: string | null = null
  let bestBoost = 0
  for (const tag of profile.interestTags) {
    const m = INTEREST_CATEGORY_BOOST[tag]
    if (!m) continue
    if (m.categories.includes(category)) {
      total += m.boost
      if (m.boost > bestBoost) { bestBoost = m.boost; bestTag = tag }
    }
  }
  const text = `${name} ${menuSummary ?? ""}`
  for (const tag of profile.interestTags) {
    const label = INTEREST_LABEL_KO[tag]
    if (label && text.includes(label)) total += 2
  }
  return { bonus: Math.min(total, 12), matchedTag: bestTag }
}

// ---------------------------------------------------------------------------
// Sensitivity
// ---------------------------------------------------------------------------

function getSensitivity(profile: UserProfile | null) {
  const s = profile?.weatherSensitivity ?? []
  return {
    rainSkipOutdoor: s.includes("rain"),
    badAirThreshold: s.includes("fine_dust") ? 60 : 80,
    hotThreshold: s.includes("heat") ? 26 : 28,
    coldThreshold: s.includes("cold") ? 12 : 10,
    uvSkipOutdoor: s.includes("uv"),
  }
}

function categoryLabel(cat: string, lang: CourseEngineLanguage = "ko"): string {
  const copy = COURSE_ENGINE_COPY[lang].categoryLabel
  return copy[cat as keyof typeof copy] ?? COURSE_ENGINE_COPY[lang].defaultCategory
}

function timeSlotLabel(profile: UserProfile | null, idx: number, lang: CourseEngineLanguage = "ko"): string {
  const ts = profile?.preferredTimeSlot
  const time = COURSE_ENGINE_COPY[lang].timeSlot
  if (!ts || ts === "all_day" || ts === "afternoon") {
    return idx === 1 ? "13:00 - 15:30" : idx === 2 ? "16:00 - 18:00" : "18:00 - 20:00"
  }
  if (ts === "early_morning") return idx === 1 ? "07:00 - 10:00" : idx === 2 ? "10:00 - 13:00" : "13:00 - 15:00"
  if (ts === "late_morning") return idx === 1 ? "10:00 - 13:00" : idx === 2 ? "13:00 - 16:00" : "16:00 - 18:00"
  if (ts === "sunset_evening") return idx === 1 ? "16:00 - 18:00" : idx === 2 ? "18:00 - 20:00" : "20:00 - 22:00"
  return idx === 1 ? "13:00 - 15:30" : idx === 2 ? "16:00 - 18:00" : "18:00 - 20:00"
}

// ---------------------------------------------------------------------------
// SQL builder
// ---------------------------------------------------------------------------

interface QueryOpts {
  placeTypes: string[]
  categories?: string[]
  weatherTag?: string
  excludeNames: string[]
  limit: number
}

async function queryPlaces(opts: QueryOpts): Promise<PlaceRow[]> {
  const conditions: string[] = [
    `(address LIKE '%전주%' OR address LIKE '%완산구%' OR address LIKE '%덕진구%')`,
  ]
  const params: unknown[] = []

  conditions.push(`place_type IN (${opts.placeTypes.map(() => "?").join(",")})`)
  params.push(...opts.placeTypes)

  if (opts.categories?.length) {
    conditions.push(`category IN (${opts.categories.map(() => "?").join(",")})`)
    params.push(...opts.categories)
  }

  if (opts.weatherTag) {
    // Relaxed SQL Filtering: allow empty weather tags (71.7% of DB) to prevent completely excluding them,
    // but we will apply soft weather tag boosting on the JS side.
    conditions.push(`(weather_tags LIKE ? OR JSON_LENGTH(weather_tags) = 0 OR weather_tags IS NULL)`)
    params.push(`%${opts.weatherTag}%`)
  }

  if (opts.excludeNames.length) {
    conditions.push(`name NOT IN (${opts.excludeNames.map(() => "?").join(",")})`)
    params.push(...opts.excludeNames)
  }

  const where = conditions.join(" AND ")
  const sql = `SELECT name, category, place_type, lat, lon, address, rating, review_count, kakao_url, menu_summary, reviews_text, hours_raw, review_summary, review_keywords, review_sentiment, review_picks FROM places WHERE ${where} ORDER BY rating DESC, review_count DESC LIMIT ?`
  params.push(opts.limit)

  return queryRows<PlaceRow[]>(sql, params)
}

// ---------------------------------------------------------------------------
// JS-side scoring
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// JS-side scoring
// ---------------------------------------------------------------------------

function computeSeasonBonus(
  category: string,
  placeType: string,
  name: string,
  menuSummary: string | null,
  reviewSummary: string | null,
  season: "spring" | "summer" | "autumn" | "winter"
): number {
  let score = 0
  const text = `${name} ${menuSummary ?? ""} ${reviewSummary ?? ""}`

  if (season === "spring") {
    // Spring category boost: nature, festival
    if (category === "nature" || category === "festival") score += 4
    // Spring keywords
    const keywords = ["벚꽃", "봄꽃", "꽃놀이", "봄바람", "새싹", "피크닉"]
    if (keywords.some(k => text.includes(k))) score += 3
  } else if (season === "summer") {
    // Summer category boost (indoor air-conditioning preference)
    if (placeType === "indoor" && (category === "cafe" || category === "culture" || category === "shopping")) {
      score += 4
    }
    // Summer keywords
    const keywords = ["계곡", "물놀이", "빙수", "시원", "에어컨", "야경", "피서"]
    if (keywords.some(k => text.includes(k))) score += 3
  } else if (season === "autumn") {
    // Autumn category boost: nature, festival
    if (category === "nature" || category === "festival") score += 4
    // Autumn foliage keywords
    const keywords = ["단풍", "은행나무", "갈대", "가을", "억새", "산책"]
    if (keywords.some(k => text.includes(k))) score += 3
  } else if (season === "winter") {
    // Winter category boost
    if (placeType === "outdoor") {
      score -= 8 // Strong penalty for outdoor in freezing winter
    } else if (placeType === "indoor") {
      score += 4 // Preference for indoor cozy spaces
    }
    // Winter warm food/cozy keywords
    const keywords = ["따뜻", "국밥", "전골", "온천", "실내데이트", "핫초코", "코코아", "눈꽃"]
    if (keywords.some(k => text.includes(k))) score += 3
  }

  return score
}

// ---------------------------------------------------------------------------
// Probabilistic selection (softmax-based diversity)
// ---------------------------------------------------------------------------

/**
 * Softmax 기반 확률적 선택으로 추천 다양성을 보장합니다.
 * temperature가 높을수록 랜덤성이 증가하고, 낮을수록 상위 점수에 집중됩니다.
 */
function probabilisticSelect<T extends { score: number }>(items: T[], temperature: number = 0.5): T | null {
  if (items.length === 0) return null
  if (items.length === 1) return items[0]

  const scores = items.map(item => item.score)
  const maxScore = Math.max(...scores)
  const exps = scores.map(s => Math.exp((s - maxScore) / temperature))
  const sumExp = exps.reduce((a, b) => a + b, 0)
  const probs = exps.map(e => e / sumExp)

  // 룰렛 휠 선택
  const r = Math.random()
  let cumulative = 0
  for (let i = 0; i < probs.length; i++) {
    cumulative += probs[i]
    if (r < cumulative) return items[i]
  }
  return items[0]
}

/**
 * 상위 N개 중 확률적으로 1개를 선택합니다.
 * 단순 slice 대신 다양성을 보장하면서도 품질을 유지합니다.
 */
function selectDiverseTop(scored: ScoredPlace[], count: number, temperature: number = 0.3): ScoredPlace[] {
  if (scored.length <= count) return scored
  
  // 상위 count * 3개 중에서 확률적 선택 (너무 많은 후보는 노이즈)
  const candidates = scored.slice(0, count * 3)
  const selected: ScoredPlace[] = []
  const usedIndices = new Set<number>()

  for (let i = 0; i < count; i++) {
    const remaining = candidates.filter((_, idx) => !usedIndices.has(idx))
    if (remaining.length === 0) break

    const pick = probabilisticSelect(remaining, temperature)
    if (pick) {
      const originalIdx = candidates.indexOf(pick)
      usedIndices.add(originalIdx)
      selected.push(pick)
    }
  }

  return selected
}

// ---------------------------------------------------------------------------
// Hidden gem scoring
// ---------------------------------------------------------------------------

/**
 * 숨은 맛집 점수를 계산합니다.
 * 평점이 높지만 리뷰가 적은 장소에 높은 점수를 부여합니다.
 */
function hiddenGemScore(r: PlaceRow): number {
  if (!r.rating || !r.review_count) return 0
  
  // 평점이 높지만 리뷰가 적은 곳 = 숨은 gems
  const ratingWeight = r.rating * 2
  // 리뷰가 적을수록 novelty 보너스 (최대 5점)
  const reviewNovelty = Math.max(0, 5 - Math.log10(r.review_count + 1))
  // 리뷰 10개 미만이면 추가 보너스
  const freshnessBonus = r.review_count < 10 ? 3 : 0
  // 평점 4.0 이상이면 추가 보너스
  const highRatingBonus = r.rating >= 4.0 ? 2 : 0

  return ratingWeight + reviewNovelty + freshnessBonus + highRatingBonus
}

// ---------------------------------------------------------------------------
// Dynamic time slots
// ---------------------------------------------------------------------------

/**
 * 현재 시간 기반으로 동적 시간대를 생성합니다.
 * 고정된 시간대 대신 현재 시간부터 시작하는 자연스러운 코스를 구성합니다.
 */
function getDynamicTimeSlots(currentHour: number, lang: CourseEngineLanguage = "ko"): Array<{ time: string; label: string; targetHour: number }> {
  const t = COURSE_ENGINE_COPY[lang].timeSlot
  if (currentHour < 10) {
    return [
      { time: `${String(currentHour).padStart(2, '0')}:00 - 12:00`, label: t.morningOuting, targetHour: currentHour + 1 },
      { time: "12:00 - 14:00", label: t.lunchTime, targetHour: 12 },
      { time: "14:00 - 16:00", label: t.cafeTime, targetHour: 14 },
    ]
  } else if (currentHour < 12) {
    return [
      { time: `${String(currentHour).padStart(2, '0')}:00 - 13:00`, label: t.morningWalk, targetHour: currentHour + 1 },
      { time: "13:00 - 15:00", label: t.lunch, targetHour: 13 },
      { time: "15:00 - 17:00", label: t.afternoonWalk, targetHour: 15 },
    ]
  } else if (currentHour < 14) {
    return [
      { time: `${String(currentHour).padStart(2, '0')}:00 - 15:30`, label: t.lunch, targetHour: currentHour },
      { time: "15:30 - 17:30", label: t.afternoonWalk, targetHour: 15 },
      { time: "17:30 - 19:30", label: t.dinnerPrep, targetHour: 17 },
    ]
  } else if (currentHour < 16) {
    return [
      { time: `${String(currentHour).padStart(2, '0')}:00 - 17:00`, label: t.afternoon, targetHour: currentHour },
      { time: "17:00 - 19:00", label: t.dinner, targetHour: 17 },
      { time: "19:00 - 21:00", label: t.evening, targetHour: 19 },
    ]
  } else if (currentHour < 18) {
    return [
      { time: `${String(currentHour).padStart(2, '0')}:00 - 19:00`, label: t.lateAfternoon, targetHour: currentHour },
      { time: "19:00 - 21:00", label: t.dinner, targetHour: 19 },
      { time: "21:00 - 23:00", label: t.eveningWalk, targetHour: 21 },
    ]
  } else {
    return [
      { time: `${String(currentHour).padStart(2, '0')}:00 - 20:00`, label: t.dinner, targetHour: currentHour },
      { time: "20:00 - 22:00", label: t.evening, targetHour: 20 },
      { time: "22:00 - 23:59", label: t.finish, targetHour: 22 },
    ]
  }
}

function scoreAndRank(
  rows: PlaceRow[], 
  profile: UserProfile | null, 
  uLat: number | null, 
  uLon: number | null, 
  targetHour?: number, 
  kstDay?: number,
  weatherTag?: string | null,
  currentSeason?: "spring" | "summer" | "autumn" | "winter",
  preferHiddenGem?: boolean
): ScoredPlace[] {
  const scored: ScoredPlace[] = rows.map(r => {
    // Parse LLM-enriched review fields
    let reviewKeywords: string[] | null = null
    let reviewPicks: string[] | null = null
    try { if (r.review_keywords) reviewKeywords = JSON.parse(r.review_keywords) } catch {}
    try { if (r.review_picks) reviewPicks = JSON.parse(r.review_picks) } catch {}

    const { bonus, matchedTag } = computeInterestBonus(r.category, r.name, r.menu_summary, profile)
    let score = qualityScore(r, reviewKeywords)
    score += bonus
    if (uLat != null && uLon != null) score += distanceBonus(r.lat, r.lon, uLat, uLon)
    
    // Keyword-interest cross-match: if LLM keywords match user interests, extra bonus
    if (reviewKeywords && profile?.interestTags?.length) {
      const keywordBoostMap: Record<string, string[]> = {
        foodie: ["가성비", "푸짐한양", "로컬맛집", "깔끔한맛"],
        cafe: ["분위기좋은", "디저트", "브런치", "포토스팟"],
        nature: ["힐링", "포토스팟", "뷰맛집"],
        art_museum: ["전통", "포토스팟"],
        photography: ["포토스팟", "뷰맛집", "분위기좋은"],
        family: ["가족", "푸짐한양", "주차편리"],
        picnic: ["힐링", "가족", "야외"],
        activity: ["특별한날"],
        walking: ["힐링", "주차편리"],
      }
      for (const tag of profile.interestTags) {
        const keywords = keywordBoostMap[tag]
        if (keywords && reviewKeywords.some(k => keywords.includes(k))) {
          score += 3
          break
        }
      }
    }

    // Weather Tag soft boosting
    if (weatherTag && r.weather_tags) {
      try {
        const tags = typeof r.weather_tags === 'string' ? JSON.parse(r.weather_tags) : r.weather_tags
        if (Array.isArray(tags) && tags.includes(weatherTag)) {
          score += 6 // Strong soft matching weather bonus!
        }
      } catch {}
    }

    // Season category/keyword boosting
    if (currentSeason) {
      score += computeSeasonBonus(r.category, r.place_type, r.name, r.menu_summary, r.review_summary, currentSeason)
    }

    // Hidden gem bonus (숨은 맛집 알고리즘)
    if (preferHiddenGem) {
      score += hiddenGemScore(r)
    }

    // Time penalty: penalize places likely closed at the target planned hour (or current system hour fallback)
    const activeHour = targetHour ?? new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })).getHours()
    const activeDay = kstDay ?? new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })).getDay()
    if (isLikelyClosedNow(r.hours_raw, activeHour, activeDay)) {
      score -= 8
    }

    return {
      name: r.name, category: r.category, place_type: r.place_type,
      lat: r.lat, lon: r.lon, address: r.address, rating: r.rating,
      kakao_url: r.kakao_url, menu_summary: r.menu_summary,
      review_summary: r.review_summary, review_keywords: reviewKeywords, review_picks: reviewPicks,
      score, interestBonus: bonus, interestTag: matchedTag,
    }
  })
  const seen = new Set<string>()
  const deduped = scored.filter(s => { if (seen.has(s.name)) return false; seen.add(s.name); return true })
  deduped.sort((a, b) => b.score - a.score)
  return deduped
}

function toSlotItem(p: ScoredPlace, profile: UserProfile | null): PlaceSlotItem {
  const { matchedTag } = computeInterestBonus(p.category, p.name, p.menu_summary, profile)
  return {
    name: p.name, category: p.category, rating: p.rating,
    address: p.address, menuSummary: p.menu_summary, kakaoUrl: p.kakao_url,
    interestMatch: matchedTag ?? undefined,
    reviewSummary: p.review_summary ?? null,
    reviewKeywords: p.review_keywords ?? [],
    reviewPicks: p.review_picks ?? [],
    lat: p.lat,
    lon: p.lon,
  }
}

function getReviewNote(reviewSummary: string | null, lang: CourseEngineLanguage = "ko"): string {
  if (!reviewSummary || reviewSummary.length < 10) return ""
  // Trim to 60 chars max for description injection
  const trimmed = reviewSummary.length > 60 ? reviewSummary.slice(0, 57) + "..." : reviewSummary
  const copy = COURSE_ENGINE_COPY[lang]
  return `\n${copy.reviewPrefix}${trimmed}${copy.reviewSuffix}`
}

// ---------------------------------------------------------------------------
// Main (async)
// ---------------------------------------------------------------------------

export async function generateCourse(request: CourseRequest = {}): Promise<CourseSlot[]> {
  const wx = request.weatherContext
  const profile = request.userProfile ?? null
  const uLat = request.userLat ?? null
  const uLon = request.userLon ?? null
  const exclude = request.excludeNames ?? []
  const theme = request.theme ?? "balanced"
  const lang = request.language ?? "ko"
  const sens = getSensitivity(profile)

  const isRaining = wx?.rainingNow ?? false
  const isCold = wx?.temperatureC != null && wx.temperatureC < sens.coldThreshold
  const isHot = wx?.temperatureC != null && wx.temperatureC > sens.hotThreshold
  const isWindy = wx?.windMs != null && wx.windMs > 6
  const isBadAir = wx?.pm10 != null && wx.pm10 > sens.badAirThreshold
  const canGoOutdoor = !isRaining && !isBadAir && !(sens.uvSkipOutdoor && wx?.uvLabel === "매우높음")
  const weatherMood = isRaining ? "rain" : isCold ? "cold" : isHot ? "hot" : "clear"

  // KST current time for business hours and season check
  const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
  const kstDay = kstNow.getDay() // 0=Sun, 6=Sat
  const kstMonth = kstNow.getMonth() + 1 // 1 to 12
  const kstHour = kstNow.getHours()

  // Determine current season
  let currentSeason: "spring" | "summer" | "autumn" | "winter" = "spring"
  if (kstMonth >= 3 && kstMonth <= 5) currentSeason = "spring"
  else if (kstMonth >= 6 && kstMonth <= 8) currentSeason = "summer"
  else if (kstMonth >= 9 && kstMonth <= 11) currentSeason = "autumn"
  else currentSeason = "winter"

  // 동적 시간대 계산
  const dynamicTimeSlots = getDynamicTimeSlots(kstHour, lang)

  // 테마 설정 가져오기
  const themeConfig = COURSE_THEME_CONFIG[theme]
  const usedNames = new Set(exclude)
  const slots: CourseSlot[] = []

  // 테마 기반 코스 생성
  for (let i = 0; i < themeConfig.slotStructure.length; i++) {
    const slotConfig = themeConfig.slotStructure[i]
    const timeSlot = dynamicTimeSlots[i]

    // 비 오는 날 테마가 아닌 경우, 야외 장소는 비 올 때 제외
    if (!canGoOutdoor && slotConfig.placeTypes.some(t => t === "outdoor" || t === "semi-outdoor")) {
      continue
    }

    const weatherTag = weatherMood === "rain" ? "rainy-day" 
      : weatherMood === "cold" ? "cold-day" 
      : weatherMood === "hot" ? "hot-day" 
      : "clear-day"

    const rows = await queryPlaces({
      placeTypes: slotConfig.placeTypes,
      categories: slotConfig.categories,
      weatherTag: slotConfig.placeTypes.includes("indoor") ? weatherTag : undefined,
      excludeNames: [...usedNames],
      limit: 40,
    })

    const scored = scoreAndRank(
      rows, profile, uLat, uLon, 
      timeSlot?.targetHour ?? 14, 
      kstDay, 
      weatherTag, 
      currentSeason,
      slotConfig.preferHiddenGem
    )

    // 다양성을 보장하는 상위 선택
    const top = selectDiverseTop(scored, 2, 0.3)
    
    if (top.length > 0) {
      const m = top[0]
      const placeType = m.place_type as "야외" | "실내" | "반실외"
      
      // 날씨/시간 기반 설명 생성
      const wx = COURSE_ENGINE_COPY[lang].weatherNote
      let weatherNote = ""
      if (i === 0) {
        weatherNote = isHot ? wx.hot
          : isWindy ? wx.windy
          : isRaining ? wx.rainy
          : wx.good
      } else if (i === 1) {
        weatherNote = isRaining ? wx.rainyIndoor
          : isCold ? wx.cold
          : isHot ? wx.cool
          : wx.leisurely
      } else {
        weatherNote = isRaining ? wx.rainyEvening
          : wx.closing
      }

      const copy = COURSE_ENGINE_COPY[lang]
      slots.push({
        time: timeSlot?.time ?? timeSlotLabel(profile, i + 1, lang),
        title: m.name,
        description: `${weatherNote} ${categoryLabel(m.category, lang)}입니다.${m.menu_summary ? `${copy.menuPrefix}${m.menu_summary}` : ""}${top[1] ? copy.nearbyRecommend(top[1].name) : ""}${getDistanceNote(m.lat, m.lon, uLat, uLon, lang)}${getReviewNote(m.review_summary, lang)}${m.interestBonus > 4 ? copy.interestMatch(INTEREST_LABEL_KO[m.interestTag ?? ""] ?? "") : ""}`,
        type: placeType,
        places: top.map(p => toSlotItem(p, profile)),
      })
      top.forEach(p => usedNames.add(p.name))
    }
  }

  // 빈 슬롯 채우기 (기존 로직 유지)
  if (slots.length < 2 && canGoOutdoor) {
    const rows = await queryPlaces({
      placeTypes: ["outdoor", "semi-outdoor"],
      weatherTag: "clear-day",
      excludeNames: [...usedNames],
      limit: 30,
    })
    const scored = scoreAndRank(rows, profile, uLat, uLon, 14, kstDay, "clear-day", currentSeason)
    const top = selectDiverseTop(scored, 2, 0.3)
    if (top.length > 0) {
      const m = top[0]
      const copy = COURSE_ENGINE_COPY[lang]
      const wx = copy.weatherNote
      slots.push({
        time: timeSlotLabel(profile, 1, lang),
        title: m.name,
        description: `${wx.good} ${categoryLabel(m.category, lang)}입니다.${top[1] ? copy.nearbyVisit(top[1].name) : ""}${getDistanceNote(m.lat, m.lon, uLat, uLon, lang)}${getReviewNote(m.review_summary, lang)}`,
        type: "야외",
        places: top.map(p => toSlotItem(p, profile)),
      })
      top.forEach(p => usedNames.add(p.name))
    }
  }

  if (slots.length === 0) return getFallbackCourse()
  return slots.slice(0, 3)
}

// ---------------------------------------------------------------------------
// Chat prompt helper
// ---------------------------------------------------------------------------

export async function getTopPlacesForChat(opts: {
  profile?: UserProfile | null
  weatherMood?: "rain" | "cold" | "hot" | "clear"
  limit?: number
}): Promise<PlaceSlotItem[]> {
  const mood = opts.weatherMood ?? "clear"
  const weatherTag = mood === "rain" ? "rainy-day" : mood === "cold" ? "cold-day" : mood === "hot" ? "hot-day" : "clear-day"

  const rows = await queryPlaces({
    placeTypes: ["indoor", "outdoor", "semi-outdoor"],
    categories: ["cafe", "restaurant", "bakery", "attraction", "nature", "culture", "festival"],
    weatherTag,
    excludeNames: [],
    limit: opts.limit ?? 15,
  })
  const scored = scoreAndRank(rows, opts.profile ?? null, null, null)
  return scored.slice(0, opts.limit ?? 15).map(p => toSlotItem(p, opts.profile ?? null))
}

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

function getFallbackCourse(): CourseSlot[] {
  return [
    { time: "13:00 - 15:30", title: "덕진공원", description: "햇살이 가장 따뜻한 시간대예요.", type: "야외", places: [{ name: "덕진공원", category: "nature", rating: 4.5, address: "전주시 덕진구", menuSummary: null, kakaoUrl: "https://place.map.kakao.com/8124058", reviewSummary: null, reviewKeywords: [], reviewPicks: [], lat: 35.8441, lon: 127.1224 }] },
    { time: "16:00 - 18:00", title: "전주한옥마을 카페", description: "늦은 오후엔 카페에서 여유를.", type: "실내", places: [{ name: "전주한옥마을 카페거리", category: "cafe", rating: 4.3, address: "전주시 완산구", menuSummary: null, kakaoUrl: "https://place.map.kakao.com/12751100", reviewSummary: null, reviewKeywords: [], reviewPicks: [], lat: 35.8146, lon: 127.1526 }] },
  ]
}
