/**
 * Course recommendation engine — personalized, TiDB-backed.
 *
 * Queries indexed TiDB to filter 29K+ places by weather, user interests,
 * GPS distance, and feedback exclusions. Returns structured course slots.
 */

import { queryRows } from "@/lib/db"
import type { RowDataPacket } from "mysql2"
import type { ChatWeatherContext } from "@/lib/chat/prompt"

// ---------------------------------------------------------------------------
// Types (public interface unchanged)
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

export interface CourseSlot {
  time: string
  title: string
  description: string
  type: "야외" | "실내" | "반실외"
  places: PlaceSlotItem[]
}

export interface PlaceSlotItem {
  name: string
  category: string
  rating: number | null
  address: string | null
  menuSummary: string | null
  kakaoUrl: string | null
  interestMatch?: string
  reviewSummary: string | null
  reviewKeywords: string[]
  reviewPicks: string[]
}

export interface UserProfile {
  interestTags: string[]
  preferredTimeSlot: string
  weatherSensitivity: string[]
  primaryRegion: string
  ageBand?: string
}

export interface CourseRequest {
  timeRange?: string
  location?: string
  weatherContext?: ChatWeatherContext | null
  userProfile?: UserProfile | null
  userLat?: number | null
  userLon?: number | null
  excludeNames?: string[]
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

function getDistanceNote(lat: number | null, lon: number | null, uLat: number | null, uLon: number | null): string {
  if (uLat == null || uLon == null || lat == null || lon == null) return ""
  const d = haversineKm(uLat, uLon, lat, lon)
  if (d <= 0.5) return " (현재 위치에서 도보 5분 거리)"
  if (d <= 1) return " (현재 위치에서 약 1km)"
  if (d <= 3) return ` (약 ${Math.round(d)}km 거리)`
  if (d <= 5) return ` (약 ${Math.round(d)}km 거리)`
  return ""
}

function qualityScore(r: PlaceRow, reviewKeywords: string[] | null): number {
  let s = 0
  if (r.rating != null) s += Math.min(r.rating * 2, 10)
  if (r.review_count != null && r.review_count > 0) s += Math.min(Math.log10(r.review_count + 1) * 2, 5)
  if (r.menu_summary) s += 1
  if (r.kakao_url) s += 1
  if (r.rating != null && r.rating >= 4) s += 3
  // Review bonus: having real customer reviews is a strong quality signal
  if (r.reviews_text) {
    try {
      const reviews = JSON.parse(r.reviews_text)
      if (Array.isArray(reviews) && reviews.length > 0) {
        s += Math.min(reviews.length, 5) // +1 per review, max +5
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

export const INTEREST_LABEL_KO: Record<string, string> = {
  foodie: "맛집 탐방", cafe: "카페", nature: "자연 속 힐링",
  art_museum: "문화·전시", festival: "축제·행사", shopping: "쇼핑",
  picnic: "피크닉", activity: "야외 액티비티", photography: "사진 스팟",
  walking: "산책", drive: "드라이브", family: "가족 나들이", pet: "반려동물",
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

function categoryLabel(cat: string): string {
  const m: Record<string, string> = {
    nature: "자연 명소", attraction: "관광 명소", cafe: "카페", bakery: "베이커리",
    restaurant: "맛집", pub: "펍", culture: "문화 공간", shopping: "쇼핑 장소",
    sports: "스포츠 시설", festival: "축제·행사",
  }
  return m[cat] ?? "추천 장소"
}

function timeSlotLabel(profile: UserProfile | null, idx: number): string {
  const ts = profile?.preferredTimeSlot
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
    conditions.push(`weather_tags LIKE ?`)
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

function scoreAndRank(rows: PlaceRow[], profile: UserProfile | null, uLat: number | null, uLon: number | null, kstHour?: number, kstDay?: number): ScoredPlace[] {
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
    // Time penalty: penalize places likely closed now
    if (kstHour != null && kstDay != null && isLikelyClosedNow(r.hours_raw, kstHour, kstDay)) {
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
  }
}

function getReviewNote(reviewSummary: string | null): string {
  if (!reviewSummary || reviewSummary.length < 10) return ""
  // Trim to 60 chars max for description injection
  const trimmed = reviewSummary.length > 60 ? reviewSummary.slice(0, 57) + "..." : reviewSummary
  return `\n→ 리뷰: "${trimmed}"`
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
  const sens = getSensitivity(profile)

  const isRaining = wx?.rainingNow ?? false
  const isCold = wx?.temperatureC != null && wx.temperatureC < sens.coldThreshold
  const isHot = wx?.temperatureC != null && wx.temperatureC > sens.hotThreshold
  const isWindy = wx?.windMs != null && wx.windMs > 6
  const isBadAir = wx?.pm10 != null && wx.pm10 > sens.badAirThreshold
  const canGoOutdoor = !isRaining && !isBadAir && !(sens.uvSkipOutdoor && wx?.uvLabel === "매우높음")
  const weatherMood = isRaining ? "rain" : isCold ? "cold" : isHot ? "hot" : "clear"

  // KST current time for business hours check
  const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
  const kstHour = kstNow.getHours()
  const kstDay = kstNow.getDay() // 0=Sun, 6=Sat

  const usedNames = new Set(exclude)
  const slots: CourseSlot[] = []

  // ---- Slot 1: outdoor ----
  if (canGoOutdoor) {
    const rows = await queryPlaces({
      placeTypes: ["outdoor", "semi-outdoor"],
      weatherTag: "clear-day",
      excludeNames: [...usedNames],
      limit: 30,
    })
    const scored = scoreAndRank(rows, profile, uLat, uLon, kstHour, kstDay)
    const top = scored.slice(0, 2)
    if (top.length > 0) {
      const m = top[0]
      const weatherNote = isHot ? "더위를 피해 그늘에서 즐기기 좋은"
        : isWindy ? "바람이 다소 있지만 즐길 수 있는"
        : "햇살 좋은 시간에 방문하기 좋은"
      slots.push({
        time: timeSlotLabel(profile, 1),
        title: m.name,
        description: `${weatherNote} ${categoryLabel(m.category)}입니다.${top[1] ? ` 근처 ${top[1].name}도 함께 둘러보세요.` : ""}${getDistanceNote(m.lat, m.lon, uLat, uLon)}${getReviewNote(m.review_summary)}${m.interestBonus > 4 ? `\n→ ${INTEREST_LABEL_KO[m.interestTag ?? ""] ?? ""} 관심사에 딱 맞는 곳이에요.` : ""}`,
        type: "야외",
        places: top.map(p => toSlotItem(p, profile)),
      })
      top.forEach(p => usedNames.add(p.name))
    }
  }

  // ---- Slot 2: indoor ----
  const weatherTag = weatherMood === "rain" ? "rainy-day" : weatherMood === "cold" ? "cold-day" : weatherMood === "hot" ? "hot-day" : "clear-day"
  const indoorRows = await queryPlaces({
    placeTypes: ["indoor"],
    categories: ["cafe", "restaurant", "bakery", "culture", "shopping"],
    weatherTag,
    excludeNames: [...usedNames],
    limit: 50,
  })
  const scoredIndoor = scoreAndRank(indoorRows, profile, uLat, uLon, kstHour, kstDay)
  const topIndoor = scoredIndoor.slice(0, 3)
  if (topIndoor.length > 0) {
    const m = topIndoor[0]
    const moodNote = isRaining ? "비 오는 날 분위기 좋은" : isCold ? "따뜻하게 머물기 좋은" : isHot ? "시원하게 쉬기 좋은" : "여유롭게 즐기기 좋은"
    const hasOutdoor = slots.length > 0
    slots.push({
      time: hasOutdoor ? timeSlotLabel(profile, 2) : timeSlotLabel(profile, 1),
      title: m.name,
      description: `${moodNote} ${categoryLabel(m.category)}입니다.${m.menu_summary ? ` 대표 메뉴: ${m.menu_summary}` : ""}${topIndoor[1] ? ` 근처 ${topIndoor[1].name}도 추천해요.` : ""}${getDistanceNote(m.lat, m.lon, uLat, uLon)}${getReviewNote(m.review_summary)}${m.interestBonus > 4 ? `\n→ ${INTEREST_LABEL_KO[m.interestTag ?? ""] ?? ""} 취향에 맞춰 골랐어요.` : ""}`,
      type: "실내",
      places: topIndoor.map(p => toSlotItem(p, profile)),
    })
    topIndoor.forEach(p => usedNames.add(p.name))
  }

  // ---- Slot 3: dinner ----
  if (isRaining || slots.length < 2) {
    const dinnerRows = await queryPlaces({
      placeTypes: ["indoor"],
      categories: ["restaurant"],
      weatherTag: isRaining ? "rainy-day" : undefined,
      excludeNames: [...usedNames],
      limit: 20,
    })
    const scoredDinner = scoreAndRank(dinnerRows, profile, uLat, uLon, kstHour, kstDay)
    const topDinner = scoredDinner.slice(0, 2)
    if (topDinner.length > 0) {
      const m = topDinner[0]
      slots.push({
        time: timeSlotLabel(profile, 3),
        title: m.name,
        description: `${isRaining ? "비 오는 저녁 따뜻한" : "하루 마무리로 즐기기 좋은"} 맛집입니다.${m.menu_summary ? ` 대표 메뉴: ${m.menu_summary}` : ""}${getDistanceNote(m.lat, m.lon, uLat, uLon)}${getReviewNote(m.review_summary)}${m.interestBonus > 4 && profile?.interestTags?.includes("foodie") ? "\n→ 맛집 탐방 취향에 딱인 저녁이에요." : ""}`,
        type: "실내",
        places: topDinner.map(p => toSlotItem(p, profile)),
      })
      topDinner.forEach(p => usedNames.add(p.name))
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
    { time: "13:00 - 15:30", title: "덕진공원", description: "햇살이 가장 따뜻한 시간대예요.", type: "야외", places: [{ name: "덕진공원", category: "nature", rating: 4.5, address: "전주시 덕진구", menuSummary: null, kakaoUrl: "https://place.map.kakao.com/8124058", reviewSummary: null, reviewKeywords: [], reviewPicks: [] }] },
    { time: "16:00 - 18:00", title: "전주한옥마을 카페", description: "늦은 오후엔 카페에서 여유를.", type: "실내", places: [{ name: "전주한옥마을 카페거리", category: "cafe", rating: 4.3, address: "전주시 완산구", menuSummary: null, kakaoUrl: "https://place.map.kakao.com/12751100", reviewSummary: null, reviewKeywords: [], reviewPicks: [] }] },
  ]
}
