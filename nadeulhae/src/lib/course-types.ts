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

// ---------------------------------------------------------------------------
// Course engine i18n strings
// ---------------------------------------------------------------------------

export const COURSE_ENGINE_COPY = {
  ko: {
    descSuffix: "입니다.",
    interestLabel: {
      foodie: "맛집 탐방", cafe: "카페", nature: "자연 속 힐링",
      art_museum: "문화·전시", festival: "축제·행사", shopping: "쇼핑",
      picnic: "피크닉", activity: "야외 액티비티", photography: "사진 스팟",
      walking: "산책", drive: "드라이브", family: "가족 나들이", pet: "반려동물",
    },
    distanceNote: {
      walking5min: " (현재 위치에서 도보 5분 거리)",
      about1km: " (현재 위치에서 약 1km)",
      aboutKm: (km: number) => ` (약 ${km}km 거리)`,
    },
    reviewPrefix: "→ 리뷰: \"",
    reviewSuffix: "\"",
    categoryLabel: {
      nature: "자연 명소", attraction: "관광 명소", cafe: "카페", bakery: "베이커리",
      restaurant: "맛집", pub: "펍", culture: "문화 공간", shopping: "쇼핑 장소",
      sports: "스포츠 시설", festival: "축제·행사",
    },
    defaultCategory: "추천 장소",
    timeSlot: {
      morningOuting: "아침 나들이",
      lunchTime: "점심 맛집",
      cafeTime: "카페 타임",
      morningWalk: "오전 나들이",
      lunch: "점심 시간",
      afternoonWalk: "오후 산책",
      afternoon: "오후 시간",
      dinnerPrep: "저녁 준비",
      lateAfternoon: "늦은 오후",
      dinner: "저녁 시간",
      eveningWalk: "야간 산책",
      evening: "야경 즐기기",
      finish: "마무리",
    },
    weatherNote: {
      hot: "더위를 피해 그늘에서 즐기기 좋은",
      windy: "바람이 다소 있지만 즐길 수 있는",
      rainy: "비 오는 날 분위기 좋은",
      good: "방문하기 좋은",
      rainyIndoor: "비 오는 날 실내에서 즐기기 좋은",
      cold: "따뜻하게 머물기 좋은",
      cool: "시원하게 쉬기 좋은",
      leisurely: "여유롭게 즐기기 좋은",
      rainyEvening: "비 오는 저녁 따뜻한",
      closing: "하루 마무리로 즐기기 좋은",
    },
    interestMatch: (tag: string) => `→ ${tag} 관심사에 딱 맞는 곳이에요.`,
    nearbyRecommend: (name: string) => ` 근처 ${name}도 추천해요.`,
    nearbyVisit: (name: string) => ` 근처 ${name}도 함께 둘러보세요.`,
    menuPrefix: " 대표 메뉴: ",
  },
  en: {
    descSuffix: ".",
    interestLabel: {
      foodie: "Foodie", cafe: "Cafe", nature: "Nature Healing",
      art_museum: "Art & Museum", festival: "Festival & Event", shopping: "Shopping",
      picnic: "Picnic", activity: "Outdoor Activity", photography: "Photography",
      walking: "Walking", drive: "Driving", family: "Family Outing", pet: "Pet Friendly",
    },
    distanceNote: {
      walking5min: " (5 min walk from current location)",
      about1km: " (about 1km from current location)",
      aboutKm: (km: number) => ` (about ${km}km away)`,
    },
    reviewPrefix: "→ Review: \"",
    reviewSuffix: "\"",
    categoryLabel: {
      nature: "Nature spot", attraction: "Tourist attraction", cafe: "Cafe", bakery: "Bakery",
      restaurant: "Restaurant", pub: "Pub", culture: "Cultural space", shopping: "Shopping",
      sports: "Sports facility", festival: "Festival/Event",
    },
    defaultCategory: "Recommended spot",
    timeSlot: {
      morningOuting: "Morning outing",
      lunchTime: "Lunch spot",
      cafeTime: "Cafe time",
      morningWalk: "Morning walk",
      lunch: "Lunch time",
      afternoonWalk: "Afternoon walk",
      afternoon: "Afternoon",
      dinnerPrep: "Dinner prep",
      lateAfternoon: "Late afternoon",
      dinner: "Dinner time",
      eveningWalk: "Evening stroll",
      evening: "Night view",
      finish: "Wrap up",
    },
    weatherNote: {
      hot: "Great for enjoying in the shade to beat the heat",
      windy: "A bit windy but still enjoyable",
      rainy: "Perfect for a rainy day atmosphere",
      good: "Great to visit",
      rainyIndoor: "Great for indoor enjoyment on a rainy day",
      cold: "Cozy and warm",
      cool: "Cool and refreshing",
      leisurely: "Perfect for a leisurely visit",
      rainyEvening: "Warm spot on a rainy evening",
      closing: "Perfect to end the day",
    },
    interestMatch: (tag: string) => `→ Perfect match for your interest in ${tag}.`,
    nearbyRecommend: (name: string) => ` Also recommend nearby ${name}.`,
    nearbyVisit: (name: string) => ` Also check out nearby ${name}.`,
    menuPrefix: " Signature menu: ",
  },
  zh: {
    descSuffix: "。",
    interestLabel: {
      foodie: "美食探店", cafe: "咖啡馆", nature: "亲近自然",
      art_museum: "文化展览", festival: "节日庆典", shopping: "逛街购物",
      picnic: "户外野餐", activity: "户外活动", photography: "拍照打卡",
      walking: "散步休闲", drive: "户外自驾", family: "亲子家庭", pet: "宠物友好",
    },
    distanceNote: {
      walking5min: " (距离当前位置步行5分钟)",
      about1km: " (距离当前位置约1公里)",
      aboutKm: (km: number) => ` (约${km}公里距离)`,
    },
    reviewPrefix: "→ 评价: \"",
    reviewSuffix: "\"",
    categoryLabel: {
      nature: "自然景点", attraction: "旅游景点", cafe: "咖啡厅", bakery: "面包店",
      restaurant: "餐厅", pub: "酒吧", culture: "文化空间", shopping: "购物场所",
      sports: "体育设施", festival: "节日活动",
    },
    defaultCategory: "推荐地点",
    timeSlot: {
      morningOuting: "早晨出游",
      lunchTime: "午餐时间",
      cafeTime: "咖啡时间",
      morningWalk: "上午散步",
      lunch: "午餐时间",
      afternoonWalk: "午后散步",
      afternoon: "下午时光",
      dinnerPrep: "晚餐准备",
      lateAfternoon: "傍晚时分",
      dinner: "晚餐时间",
      eveningWalk: "夜间散步",
      evening: "夜景观赏",
      finish: "结束行程",
    },
    weatherNote: {
      hot: "适合在阴凉处避暑",
      windy: "虽有微风但仍可享受",
      rainy: "雨天氛围绝佳",
      good: "适合前往",
      rainyIndoor: "雨天室内好去处",
      cold: "温暖舒适的好去处",
      cool: "清凉消暑好去处",
      leisurely: "适合悠闲享受",
      rainyEvening: "雨夜温暖去处",
      closing: "完美收尾的一天",
    },
    interestMatch: (tag: string) => `→ 完全符合您对${tag}的兴趣。`,
    nearbyRecommend: (name: string) => ` 也推荐附近的${name}。`,
    nearbyVisit: (name: string) => ` 也可以逛逛附近的${name}。`,
    menuPrefix: " 招牌菜单: ",
  },
  ja: {
    descSuffix: "です。",
    interestLabel: {
      foodie: "グルメ巡り", cafe: "カフェ", nature: "自然で癒やし",
      art_museum: "文化・展示", festival: "祭り・イベント", shopping: "ショッピング",
      picnic: "ピクニック", activity: "アウトドア", photography: "フォトスポット",
      walking: "散策", drive: "ドライブ", family: "家族でお出かけ", pet: "ペット同伴",
    },
    distanceNote: {
      walking5min: " (現在地から徒歩5分)",
      about1km: " (現在地から約1km)",
      aboutKm: (km: number) => ` (約${km}km離れた場所)`,
    },
    reviewPrefix: "→ レビュー: \"",
    reviewSuffix: "\"",
    categoryLabel: {
      nature: "自然スポット", attraction: "観光スポット", cafe: "カフェ", bakery: "ベーカリー",
      restaurant: "レストラン", pub: "パブ", culture: "文化空間", shopping: "ショッピング",
      sports: "スポーツ施設", festival: "フェスティバル",
    },
    defaultCategory: "おすすめスポット",
    timeSlot: {
      morningOuting: "朝のお出かけ",
      lunchTime: "ランチタイム",
      cafeTime: "カフェタイム",
      morningWalk: "午前の散歩",
      lunch: "ランチタイム",
      afternoonWalk: "午後の散歩",
      afternoon: "午後",
      dinnerPrep: "ディナー準備",
      lateAfternoon: "夕暮れ時",
      dinner: "ディナータイム",
      eveningWalk: "夜の散歩",
      evening: "夜景鑑賞",
      finish: "まとめ",
    },
    weatherNote: {
      hot: "暑さをしのげる日陰で楽しむのに最適",
      windy: "風はありますが楽しめます",
      rainy: "雨の日の雰囲気が最高",
      good: "訪れるのに最適",
      rainyIndoor: "雨の日に室内で楽しむのに最適",
      cold: "暖かく過ごせる",
      cool: "涼しく過ごせる",
      leisurely: "ゆったり楽しむのに最適",
      rainyEvening: "雨の夜の温かい場所",
      closing: "一日の締めくくりに最適",
    },
    interestMatch: (tag: string) => `→ ${tag}の興味にぴったりの場所です。`,
    nearbyRecommend: (name: string) => ` 近くの${name}もおすすめです。`,
    nearbyVisit: (name: string) => ` 近くの${name}もぜひお立ち寄りください。`,
    menuPrefix: " おすすめメニュー: ",
  },
} as const

export type CourseEngineLanguage = keyof typeof COURSE_ENGINE_COPY
