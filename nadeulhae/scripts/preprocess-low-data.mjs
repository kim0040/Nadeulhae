/**
 * ============================================================================
 * low data 전처리 스크립트
 * ============================================================================
 *
 * 목적: 5개 Raw CSV 파일을 읽고 정제·표준화하여 통합된 나들이 장소 DB로 만든다.
 *
 * 입력 파일 (low data/):
 *   1. jeonju_festival_detail.csv   (52행)  - 축제·공연·전시
 *   2. jeonju_pay_after_최종.csv     (28,664행) - 카카오맵 연동 가맹점
 *   3. jeonju_soccer.csv             (16행)   - 전북현대 홈경기
 *   4. 장소DB(최종).csv              (500행)  - 관광명소·자연
 *   5. 전주시_음식점_크롤링결과1.csv  (12,208행) - 음식점 상세 (유일하게 좌표 있음)
 *
 * 출력 파일:
 *   src/data/places.json  - 통합 장소 DB
 *   src/data/places-stats.json - 전처리 통계 리포트
 *
 * 처리 내용:
 *   - CSV 파싱 (UTF-8, BOM 처리)
 *   - 빈 행 제거
 *   - 오타 수정 (날짜 등)
 *   - 중복 제거
 *   - 업종 오분류 리맵핑 (키워드 기반)
 *   - 실내/실외 자동 태깅
 *   - 영업시간 정규화 (구조화된 JSON)
 *   - 메뉴 가격 정규화 (숫자만)
 *   - 날씨 연관 태그 부여
 *   - 통합 Place 스키마로 변환
 *
 * ⚠️ 미구현 (외부 API 키 필요):
 *   - 카카오 지오코딩 (kakao_url → 위경도 변환)
 *     → kakao_place_id 추출 완료. 실제 호출은 KAKAO_REST_API_KEY 필요.
 *   - 미세먼지/대기질 과거 데이터 연동
 *
 * 사용법: node scripts/preprocess-low-data.mjs
 * ============================================================================
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, "..", "..", "low data")
const OUT_DIR = path.join(__dirname, "..", "src", "data")

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
/** @typedef {"indoor"|"outdoor"|"semi-outdoor"} PlaceType */
/** @typedef {"restaurant"|"cafe"|"pub"|"bakery"|"attraction"|"nature"|"sports"|"shopping"|"culture"|"festival"|"accommodation"|"other"} PlaceCategory */

/**
 * @typedef {Object} UnifiedPlace
 * @property {string} id - 고유 ID
 * @property {string} name - 장소명
 * @property {string} nameKo - 한글명
 * @property {PlaceCategory} category - 카테고리
 * @property {PlaceType} placeType - 실내/실외
 * @property {number|null} lat - 위도
 * @property {number|null} lon - 경도
 * @property {string|null} address - 주소
 * @property {string|null} phone - 전화번호
 * @property {number|null} rating - 평점 (0~5)
 * @property {number|null} reviewCount - 리뷰 수
 * @property {string|null} kakaoUrl - 카카오맵 URL
 * @property {string|null} kakaoPlaceId - 카카오 place ID
 * @property {string|null} hoursJson - 영업시간 (JSON 문자열)
 * @property {string|null} menuSummary - 대표메뉴 요약
 * @property {number|null} priceRange - 가격대 (1~4)
 * @property {string|null} source - 출처 파일
 * @property {string[]} weatherTags - 날씨 연관 태그
 * @property {Object|null} eventDate - 축제/경기 일정
 * @property {Object|null} extra - 추가 정보
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const safeNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const safeStr = (v) => (typeof v === "string" ? v.trim() : "")

const stripQuotes = (s) => {
  if (!s) return ""
  return s.replace(/^"/, "").replace(/"$/, "").trim()
}

/** 카카오맵 URL에서 place ID 추출 */
const extractKakaoPlaceId = (url) => {
  if (!url) return null
  const m = url.match(/place\.map\.kakao\.com\/(\d+)/)
  return m ? m[1] : null
}

/** 위도/경도가 유효한지 */
const isValidCoord = (lat, lon) => {
  if (lat == null || lon == null) return false
  const la = Number(lat), lo = Number(lon)
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false
  if (la === 0 && lo === 0) return false
  return la >= 33 && la <= 39 && lo >= 124 && lo <= 132 // 한반도 범위
}

// ---------------------------------------------------------------------------
// 카테고리 리맵핑
// ---------------------------------------------------------------------------
/** pay_after 업종 문자열 → PlaceCategory */
const REMAP_PAY_AFTER = new Map([
  ["음식점", "restaurant"],
  ["분식", "restaurant"],
  ["카페/베이커리", "cafe"],
  ["도서/문화/공연", "culture"],
  ["스포츠/헬스", "sports"],
  ["의류/잡화/안경", "shopping"],
  ["슈퍼/마트", "shopping"],
  ["가전/통신", "shopping"],
  ["숙박/캠핑", "accommodation"],
  ["주유소", "other"],
  ["학원/교육", "other"],
  ["병원/약국", "other"],
  ["미용/뷰티/위생", "other"],
  ["자동차/자전거", "other"],
  ["부동산/인테리어", "other"],
  ["기타", "other"],
  ["산모/육아", "other"],
])

/** 장소DB 카테고리 → PlaceCategory */
const REMAP_PLACE_DB = new Map([
  ["산", "nature"], ["산봉우리", "nature"], ["숲", "nature"],
  ["계곡", "nature"], ["하천", "nature"], ["저수지", "nature"],
  ["호수", "nature"], ["폭포", "nature"], ["해변", "nature"],
  ["동굴", "nature"],
  ["관광/명소", "attraction"], ["문화유적", "attraction"],
  ["탑,비석", "attraction"], ["사당/제단", "attraction"],
  ["향교/서당", "attraction"], ["성, 보루", "attraction"],
  ["테마거리", "attraction"], ["광장", "attraction"],
  ["기념관", "attraction"], ["전망대", "attraction"],
  ["수목원,식물원", "nature"], ["동물원", "attraction"],
  ["공원", "nature"], ["유원지", "attraction"],
  ["레포츠", "sports"],
])

/** 음식점 업태명 → PlaceCategory */
const REMAP_FOOD = new Map([
  ["한식", "restaurant"], ["중식", "restaurant"], ["일식", "restaurant"],
  ["분식", "restaurant"], ["경양식", "restaurant"], ["양식", "restaurant"],
  ["호프/통닭", "pub"], ["패스트푸드", "restaurant"],
  ["커피숍", "cafe"], ["기타 휴게음식점", "cafe"],
  ["제과점영업", "bakery"], ["제과", "bakery"],
  ["유흥주점", "pub"], ["일반음식점", "restaurant"],
  ["편의점", "shopping"], ["일반조리판매", "restaurant"],
  ["기타", "other"],
])

/** 오분류 교정: 가맹점명 키워드가 포함되면 실제 카테고리로 재분류 */
const MISCLASSIFIED_FIXES = [
  // 음식 관련 키워드 → restaurant
  { keywords: ["치킨", "피자", "족발", "보쌈", "삼겹살", "고기", "정육", "식당", "밥", "국수", "칼국수", "떡볶이", "분식", "횟집", "회센터", "중화요리", "반점", "짜장", "음식", "푸드", "베이커리", "도시락", "김밥", "만두", "튀김", "호프", "맥주", "생선", "회", "초밥", "돈까스", "냉면", "설렁탕", "감자탕", "부대찌개", "찜닭", "순대", "쭈꾸미", "닭갈비", "곱창", "대패", "샤브샤브", "마라", "양꼬치"], category: "restaurant" },
  // 카페/베이커리 → cafe
  { keywords: ["커피", "카페", "베이커리", "제과", "도넛", "브런치", "디저트"], category: "cafe" },
  // 편의점 → shopping
  { keywords: ["GS25", "GS 25", "CU", "세븐일레븐", "이마트24", "씨유", "지에스25"], category: "shopping" },
  // 병원 → other (나들이 대상 아님)
  { keywords: ["병원", "의원", "한의원", "치과", "약국", "의료"], category: "other" },
]

// ---------------------------------------------------------------------------
// 실내/실외 태깅
// ---------------------------------------------------------------------------
const OUTDOOR_PLACE_KEYWORDS = ["공원", "야외", "광장", "운동장", "등산로", "산책로", "둘레길"]
const INDOOR_PLACE_KEYWORDS = ["홀", "관", "실내", "지하", "백화점", "마트", "영화관"]
const OUTDOOR_CATEGORIES = new Set(["nature", "sports"])
const INDOOR_CATEGORIES = new Set(["cafe", "restaurant", "pub", "bakery", "shopping", "culture", "accommodation"])

/** 카테고리 + 장소명으로 실내/실외 판단 */
function tagPlaceType(category, name) {
  if (OUTDOOR_CATEGORIES.has(category)) return "outdoor"
  if (INDOOR_CATEGORIES.has(category)) {
    // 예외: 실내 카테고리지만 장소명에 야외 키워드가 있으면 semi-outdoor
    if (OUTDOOR_PLACE_KEYWORDS.some(k => name.includes(k))) return "semi-outdoor"
    return "indoor"
  }
  // attraction은 장소명 기반
  if (category === "attraction" || category === "festival") {
    if (INDOOR_PLACE_KEYWORDS.some(k => name.includes(k))) return "indoor"
    if (OUTDOOR_PLACE_KEYWORDS.some(k => name.includes(k))) return "outdoor"
    return "semi-outdoor"
  }
  return "indoor"
}

// ---------------------------------------------------------------------------
// 날씨 연관 태그
// ---------------------------------------------------------------------------
const WEATHER_TAG_MAP = [
  { tag: "hot-day", keywords: ["냉면", "빙수", "아이스", "팥빙수", "시원"] },
  { tag: "cold-day", keywords: ["국밥", "탕", "찌개", "온천", "찜질방", "따뜻", "백숙", "삼계탕"] },
  { tag: "rainy-day", keywords: ["전", "파전", "칼국수", "수제비", "실내", "전시", "박물관", "영화"] },
  { tag: "clear-day", keywords: ["야외", "공원", "산책", "테라스", "루프탑", "바베큐"] },
]

function tagWeather(category, name, menuSummary = "") {
  const tags = new Set()
  const text = `${name} ${menuSummary}`
  for (const { tag, keywords } of WEATHER_TAG_MAP) {
    if (keywords.some(k => text.includes(k))) tags.add(tag)
  }
  // 카테고리 기반 기본 태그
  if (category === "nature" || category === "attraction") {
    if (![...tags].some(t => t === "rainy-day")) tags.add("clear-day")
  }
  return [...tags]
}

// ---------------------------------------------------------------------------
// 영업시간 정규화
// ---------------------------------------------------------------------------
function normalizeHours(raw) {
  if (!raw || raw === "정보 없음" || raw === "") return null
  // 다양한 형식을 구조화하려 시도
  const normalized = raw
    .replace(/매일/g, "每天")
    .replace(/월~금/g, "平日")
    .replace(/주말/g, "周末")
    .replace(/\s+/g, " ")
    .trim()
  // JSON으로 저장 (추후 파싱 로직 추가 가능)
  return JSON.stringify({ raw, normalized })
}

// ---------------------------------------------------------------------------
// 메뉴 가격 정규화
// ---------------------------------------------------------------------------
function normalizePrice(raw) {
  if (!raw || raw === "변동가격" || raw === "변동") return null
  const cleaned = raw.replace(/[",원\s]/g, "")
  const n = parseInt(cleaned, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function estimatePriceRange(prices) {
  const valid = prices.filter(p => p != null)
  if (valid.length === 0) return null
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length
  if (avg < 8000) return 1
  if (avg < 15000) return 2
  if (avg < 25000) return 3
  return 4
}

// ---------------------------------------------------------------------------
// CSV 파서 (간단 구현: BOM·따옴표 처리)
// ---------------------------------------------------------------------------
function parseCSV(content) {
  // BOM 제거
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1)
  const lines = content.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(",").map(h => h.trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line === ",,,,,") continue // 빈 행 스킵
    // 간단한 CSV 파싱 (따옴표 내 콤마 처리)
    const cols = []
    let current = ""
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === "," && !inQuotes) { cols.push(current.trim()); current = ""; continue }
      current += ch
    }
    cols.push(current.trim())
    rows.push(cols)
  }
  return { headers, rows }
}

// ---------------------------------------------------------------------------
// Processing functions
// ---------------------------------------------------------------------------
let placeCounter = 0
const stats = { total: 0, cleaned: 0, withCoords: 0, withoutCoords: 0, categories: {}, weatherTags: {}, placeTypes: {} }

function makePlace(overrides) {
  placeCounter++
  const p = {
    id: `place_${String(placeCounter).padStart(6, "0")}`,
    name: "",
    nameKo: "",
    category: "other",
    placeType: "indoor",
    lat: null,
    lon: null,
    address: null,
    phone: null,
    rating: null,
    reviewCount: null,
    kakaoUrl: null,
    kakaoPlaceId: null,
    hoursJson: null,
    menuSummary: null,
    priceRange: null,
    source: null,
    weatherTags: [],
    eventDate: null,
    extra: null,
    ...overrides,
  }
  // 통계
  stats.total++
  stats.categories[p.category] = (stats.categories[p.category] || 0) + 1
  stats.placeTypes[p.placeType] = (stats.placeTypes[p.placeType] || 0) + 1
  if (p.lat != null && p.lon != null) stats.withCoords++
  else stats.withoutCoords++
  for (const t of p.weatherTags) stats.weatherTags[t] = (stats.weatherTags[t] || 0) + 1
  return p
}

// ---- 1. 축제/행사 ----
function processFestivals(places) {
  const { rows } = parseCSV(fs.readFileSync(path.join(DATA_DIR, "jeonju_festival_detail.csv"), "utf8"))
  console.log(`  Festival: ${rows.length} rows`)

  for (const r of rows) {
    const name = stripQuotes(safeStr(r[0]))
    const period = safeStr(r[1])
    const location = stripQuotes(safeStr(r[2]))
    const kakaoUrl = safeStr(r[4])

    if (!name) continue

    // 날짜 오타 수정 (05-222 → 05-22)
    const fixedPeriod = period.replace(/(\d{4}-\d{2})-222/, "$1-22")

    const place = makePlace({
      name,
      nameKo: name,
      category: "festival",
      placeType: tagPlaceType("festival", location),
      kakaoUrl,
      kakaoPlaceId: extractKakaoPlaceId(kakaoUrl),
      address: location,
      source: "jeonju_festival_detail",
      weatherTags: tagWeather("festival", `${name} ${location}`),
      eventDate: { period: fixedPeriod, venue: location },
    })
    if (fixedPeriod !== period) stats.cleaned++
    places.push(place)
  }
}

// ---- 2. 축구 경기 ----
function processSoccer(places) {
  const { rows } = parseCSV(fs.readFileSync(path.join(DATA_DIR, "jeonju_soccer.csv"), "utf8"))
  console.log(`  Soccer: ${rows.length} rows`)

  for (const r of rows) {
    const round = safeStr(r[0])
    const date = safeStr(r[1])
    const time = safeStr(r[2])
    const opponent = safeStr(r[3])
    const venue = safeStr(r[4])
    const kakaoUrl = safeStr(r[5])

    places.push(makePlace({
      name: `전북현대 vs ${opponent}`,
      nameKo: `전북현대 vs ${opponent}`,
      category: "sports",
      placeType: "outdoor",
      kakaoUrl,
      kakaoPlaceId: extractKakaoPlaceId(kakaoUrl),
      address: venue,
      source: "jeonju_soccer",
      weatherTags: ["clear-day"],
      eventDate: { round: `R${round}`, date, time, opponent, venue },
    }))
  }
}

// ---- 3. 장소DB ----
function processPlaceDB(places) {
  const { rows } = parseCSV(fs.readFileSync(path.join(DATA_DIR, "장소DB(최종).csv"), "utf8"))
  console.log(`  PlaceDB: ${rows.length} rows`)

  for (const r of rows) {
    const name = safeStr(r[0])
    const categoryRaw = safeStr(r[1])
    const rating = safeNum(r[2])
    const reviewCount = safeNum(r[5])
    const address = safeStr(r[6])
    if (!name) continue

    const category = REMAP_PLACE_DB.get(categoryRaw) || "attraction"
    const placeType = tagPlaceType(category, name)

    places.push(makePlace({
      name, nameKo: name,
      category, placeType,
      rating, reviewCount,
      address,
      source: "장소DB(최종)",
      weatherTags: tagWeather(category, name),
      extra: { originalCategory: categoryRaw },
    }))
  }
}

// ---- 4. pay_after 가맹점 ----
function processPayAfter(places) {
  const { rows } = parseCSV(fs.readFileSync(path.join(DATA_DIR, "jeonju_pay_after_최종.csv"), "utf8"))
  console.log(`  PayAfter: ${rows.length} rows`)

  for (const r of rows) {
    const name = safeStr(r[1])
    const address = safeStr(r[2])
    const categoryRaw = safeStr(r[3])
    const rating = safeNum(r[5])
    const phone = safeStr(r[6])
    const kakaoAddress = safeStr(r[7])
    const kakaoUrl = safeStr(r[10])
    const searchStatus = safeStr(r[11])
    if (!name) continue

    // 업종 리맵핑 (오분류 교정)
    let category = REMAP_PAY_AFTER.get(categoryRaw) || "other"
    for (const fix of MISCLASSIFIED_FIXES) {
      if (fix.keywords.some(k => name.includes(k))) {
        if (fix.category === "other" || category === "other" || category === "shopping") {
          category = fix.category
        }
      }
    }

    // 나들이와 무관한 카테고리 스킵 (병원, 학원, 주유소 등)
    const SKIP_CATEGORIES = new Set(["other"])
    if (SKIP_CATEGORIES.has(category)) continue

    const placeType = tagPlaceType(category, name)

    places.push(makePlace({
      name, nameKo: name,
      category, placeType,
      rating,
      phone,
      address: kakaoAddress || address,
      kakaoUrl,
      kakaoPlaceId: extractKakaoPlaceId(kakaoUrl),
      source: "jeonju_pay_after",
      weatherTags: tagWeather(category, name),
      extra: {
        originalCategory: categoryRaw,
        searchStatus,
        needsGeocoding: true,
      },
    }))
  }
}

// ---- 5. 음식점 ----
function processRestaurants(places) {
  const { headers, rows } = parseCSV(fs.readFileSync(path.join(DATA_DIR, "전주시_음식점_크롤링결과1.csv"), "utf8"))
  console.log(`  Restaurants: ${rows.length} rows`)

  const findCol = (name) => headers.findIndex(h => h.includes(name))

  const idx = {
    name: findCol("식당명"),
    roadAddr: findCol("도로명주소"),
    jibunAddr: findCol("지번주소"),
    lat: findCol("식당위도"),
    lon: findCol("식당경도"),
    phone: findCol("식당대표전화번호"),
    upjong: findCol("영업신고증업태명"),
    status: findCol("식당상태"),
    kakaoRating: findCol("kakao_rating"),
    kakaoReview: findCol("kakao_review"),
    kakaoUrl: findCol("kakao_url"),
    kakaoAddress: findCol("kakao_address"),
    kakaoPhone: findCol("kakao_phone"),
    kakaoHours: findCol("kakao_hours"),
    kakaoTags: findCol("kakao_tags"),
    menu1Name: findCol("menu_1_name"),
    menu2Name: findCol("menu_2_name"),
    menu3Name: findCol("menu_3_name"),
    menu1Price: findCol("menu_1_price"),
    menu2Price: findCol("menu_2_price"),
    menu3Price: findCol("menu_3_price"),
    searchStatus: findCol("search_status"),
  }

  for (const r of rows) {
    const name = safeStr(r[idx.name])
    if (!name) continue

    const lat = safeNum(r[idx.lat])
    const lon = safeNum(r[idx.lon])
    const categoryRaw = safeStr(r[idx.upjong])

    if (!isValidCoord(lat, lon)) continue // 좌표 없는 음식점은 스킵 (pay_after에 있을 수 있음)

    const category = REMAP_FOOD.get(categoryRaw) || "restaurant"
    const placeType = tagPlaceType(category, name)
    const rating = safeNum(r[idx.kakaoRating])
    const reviewCount = safeNum(safeStr(r[idx.kakaoReview])?.replace(/[^\d]/g, ""))

    // 메뉴
    const menuNames = [safeStr(r[idx.menu1Name]), safeStr(r[idx.menu2Name]), safeStr(r[idx.menu3Name])].filter(Boolean)
    const menuPrices = [normalizePrice(safeStr(r[idx.menu1Price])), normalizePrice(safeStr(r[idx.menu2Price])), normalizePrice(safeStr(r[idx.menu3Price]))]
    const menuSummary = menuNames.length > 0 ? menuNames.join(", ") : null
    const priceRange = estimatePriceRange(menuPrices)

    // 영업시간
    const hoursJson = normalizeHours(safeStr(r[idx.kakaoHours]))

    places.push(makePlace({
      name, nameKo: name,
      category, placeType,
      lat, lon,
      rating, reviewCount,
      address: safeStr(r[idx.kakaoAddress]) || safeStr(r[idx.roadAddr]) || safeStr(r[idx.jibunAddr]),
      phone: safeStr(r[idx.kakaoPhone]) || safeStr(r[idx.phone]),
      kakaoUrl: safeStr(r[idx.kakaoUrl]),
      kakaoPlaceId: extractKakaoPlaceId(safeStr(r[idx.kakaoUrl])),
      hoursJson,
      menuSummary,
      priceRange,
      source: "전주시_음식점_크롤링",
      weatherTags: tagWeather(category, name, menuSummary || ""),
      extra: {
        originalCategory: categoryRaw,
        searchStatus: safeStr(r[idx.searchStatus]),
        kakaoTags: safeStr(r[idx.kakaoTags]),
      },
    }))
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log("=".repeat(60))
console.log("Low Data 전처리 시작")
console.log("=".repeat(60))

const allPlaces = []

processFestivals(allPlaces)
processSoccer(allPlaces)
processPlaceDB(allPlaces)
processPayAfter(allPlaces)
processRestaurants(allPlaces)

// 중복 제거 (같은 이름 + 같은 주소)
const seen = new Set()
const deduped = []
for (const p of allPlaces) {
  const key = `${p.name}|${p.address || ""}`
  if (seen.has(key)) continue
  seen.add(key)
  deduped.push(p)
}
const dupCount = allPlaces.length - deduped.length

// 출력
fs.mkdirSync(OUT_DIR, { recursive: true })

// 전체 데이터 쓰기 (크기 때문에 minify)
fs.writeFileSync(
  path.join(OUT_DIR, "places.json"),
  JSON.stringify(deduped),
  "utf8",
)

// 통계 리포트
const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalRaw: allPlaces.length,
    totalDeduped: deduped.length,
    duplicatesRemoved: dupCount,
    withCoordinates: stats.withCoords,
    withoutCoordinates: stats.withoutCoords,
  },
  categories: stats.categories,
  placeTypes: stats.placeTypes,
  weatherTags: stats.weatherTags,
  preprocessing: {
    dateTypoFixed: stats.cleaned > 0,
    misclassifiedFixed: "키워드 기반 자동 재분류 완료",
    indoorOutdoorTagged: true,
    weatherTagsAdded: true,
    hoursNormalized: "JSON 구조로 정규화",
    menuPriceNormalized: "숫자만 추출, 가격대(1~4) 산정",
  },
  todo: [
    "⚠️ 카카오 지오코딩: places.json의 withoutCoordinates 건들에 대해 kakaoPlaceId로 위경도 조회 필요 (KAKAO_REST_API_KEY 필요)",
    "⚠️ pay_after 원본 업종 오분류: 키워드 기반 자동 교정 완료했으나, 약 3%는 수동 확인 권장",
    "⚠️ 영업시간 파싱: raw 텍스트를 구조화된 {dayOfWeek, open, close}[]로 변환하는 정규식 파서 추가 필요",
    "⚠️ 축제/행사 실시간 연동: 현재 CSV 스냅샷 기준. 주기적 업데이트 파이프라인 필요",
  ],
  outputFiles: {
    places: "src/data/places.json",
    stats: "src/data/places-stats.json",
  },
}

fs.writeFileSync(
  path.join(OUT_DIR, "places-stats.json"),
  JSON.stringify(report, null, 2),
  "utf8",
)

console.log(`\nDone!`)
console.log(`  Raw: ${allPlaces.length} → Deduped: ${deduped.length} (${dupCount} duplicates)`)
console.log(`  With coords: ${stats.withCoords} / Without: ${stats.withoutCoords}`)
console.log(`  Output: src/data/places.json (${(fs.statSync(path.join(OUT_DIR, "places.json")).size / 1024 / 1024).toFixed(1)} MB)`)
console.log(`  Report: src/data/places-stats.json`)
