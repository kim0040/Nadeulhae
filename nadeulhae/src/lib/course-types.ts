/**
 * Course recommendation types and constants (client-safe).
 *
 * This file contains only types and constants that can be safely used
 * on the client side without importing server-only modules like mysql2.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  lat?: number | null
  lon?: number | null
}

export interface UserProfile {
  interestTags: string[]
  preferredTimeSlot: string
  weatherSensitivity: string[]
  primaryRegion: string
  ageBand?: string
}

// ---------------------------------------------------------------------------
// Course themes
// ---------------------------------------------------------------------------

export type CourseTheme =
  | "balanced"      // 균형잡힌 코스 (기본)
  | "foodie_focus"  // 맛집 집중
  | "nature_heal"   // 자연 힐링
  | "date_night"    // 데이트 코스
  | "family_fun"    // 가족 나들이
  | "hidden_gem"    // 숨은 명소
  | "rainy_day"     // 비 오는 날 특화

export const COURSE_THEME_CONFIG: Record<CourseTheme, {
  label: string
  labelKo: string
  description: string
  slotStructure: Array<{
    placeTypes: string[]
    categories: string[]
    preferHiddenGem?: boolean
  }>
}> = {
  balanced: {
    label: "Balanced",
    labelKo: "균형잡힌 코스",
    description: "야외, 실내, 맛집을 골고루 즐기는 기본 코스",
    slotStructure: [
      { placeTypes: ["outdoor", "semi-outdoor"], categories: ["nature", "attraction", "culture"] },
      { placeTypes: ["indoor"], categories: ["cafe", "restaurant", "bakery", "culture", "shopping"] },
      { placeTypes: ["indoor"], categories: ["restaurant"] },
    ],
  },
  foodie_focus: {
    label: "Foodie Focus",
    labelKo: "맛집 탐방",
    description: "전주 맛집을 집중적으로 탐방하는 코스",
    slotStructure: [
      { placeTypes: ["indoor", "semi-outdoor"], categories: ["restaurant", "bakery"] },
      { placeTypes: ["indoor"], categories: ["cafe", "bakery"] },
      { placeTypes: ["indoor"], categories: ["restaurant", "pub"] },
    ],
  },
  nature_heal: {
    label: "Nature Healing",
    labelKo: "자연 힐링",
    description: "자연 속에서 힐링하는 코스",
    slotStructure: [
      { placeTypes: ["outdoor", "semi-outdoor"], categories: ["nature"] },
      { placeTypes: ["outdoor", "semi-outdoor"], categories: ["nature", "attraction"] },
      { placeTypes: ["indoor"], categories: ["cafe"] },
    ],
  },
  date_night: {
    label: "Date Night",
    labelKo: "데이트 코스",
    description: "분위기 있는 데이트 코스",
    slotStructure: [
      { placeTypes: ["indoor", "semi-outdoor"], categories: ["cafe", "culture"] },
      { placeTypes: ["indoor"], categories: ["restaurant"] },
      { placeTypes: ["indoor", "semi-outdoor"], categories: ["pub", "cafe"] },
    ],
  },
  family_fun: {
    label: "Family Fun",
    labelKo: "가족 나들이",
    description: "아이와 함께 즐기는 가족 코스",
    slotStructure: [
      { placeTypes: ["outdoor", "semi-outdoor"], categories: ["nature", "attraction"] },
      { placeTypes: ["indoor"], categories: ["restaurant"] },
      { placeTypes: ["indoor"], categories: ["cafe", "bakery"] },
    ],
  },
  hidden_gem: {
    label: "Hidden Gem",
    labelKo: "숨은 명소",
    description: "리뷰는 적지만 평점 높은 숨은 보석 같은 장소",
    slotStructure: [
      { placeTypes: ["outdoor", "semi-outdoor"], categories: ["nature", "attraction"], preferHiddenGem: true },
      { placeTypes: ["indoor"], categories: ["cafe", "restaurant"], preferHiddenGem: true },
      { placeTypes: ["indoor"], categories: ["restaurant"], preferHiddenGem: true },
    ],
  },
  rainy_day: {
    label: "Rainy Day",
    labelKo: "비 오는 날",
    description: "비 오는 날 실내에서 즐기는 코스",
    slotStructure: [
      { placeTypes: ["indoor"], categories: ["culture", "shopping"] },
      { placeTypes: ["indoor"], categories: ["cafe", "restaurant"] },
      { placeTypes: ["indoor"], categories: ["restaurant"] },
    ],
  },
}

// ---------------------------------------------------------------------------
// Interest labels
// ---------------------------------------------------------------------------

export const INTEREST_LABEL_KO: Record<string, string> = {
  foodie: "맛집 탐방", cafe: "카페", nature: "자연 속 힐링",
  art_museum: "문화·전시", festival: "축제·행사", shopping: "쇼핑",
  picnic: "피크닉", activity: "야외 액티비티", photography: "사진 스팟",
  walking: "산책", drive: "드라이브", family: "가족 나들이", pet: "반려동물",
}
