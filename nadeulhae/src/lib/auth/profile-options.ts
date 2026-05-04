/**
 * Predefined profile field options (age bands, interests, regions, etc.)
 * with multi-language labels and optional descriptions.
 */

export interface LocalizedOption {
  value: string
  label: {
    ko: string
    en: string
    zh?: string
    ja?: string
  }
  description?: {
    ko: string
    en: string
    zh?: string
    ja?: string
  }
}

/** Minimum required password length. */
export const MIN_PASSWORD_LENGTH = 10
/** Maximum number of interest tags a user can select. */
export const MAX_INTEREST_SELECTIONS = 5

export const AGE_BAND_OPTIONS: LocalizedOption[] = [
  { value: "14_19", label: { ko: "14-19세", en: "14-19", zh: "14-19岁", ja: "14-19歳" } },
  { value: "20_29", label: { ko: "20대", en: "20s", zh: "20多岁", ja: "20代" } },
  { value: "30_39", label: { ko: "30대", en: "30s", zh: "30多岁", ja: "30代" } },
  { value: "40_49", label: { ko: "40대", en: "40s", zh: "40多岁", ja: "40代" } },
  { value: "50_plus", label: { ko: "50대 이상", en: "50+", zh: "50岁以上", ja: "50代以上" } },
]

export const INTEREST_OPTIONS: LocalizedOption[] = [
  { value: "picnic", label: { ko: "피크닉", en: "Picnic", zh: "野餐", ja: "ピクニック" } },
  { value: "walking", label: { ko: "산책 및 걷기", en: "Walking", zh: "散步", ja: "散歩" } },
  { value: "cafe", label: { ko: "감성 카페 탐방", en: "Cafe hopping", zh: "咖啡馆探店", ja: "カフェ巡り" } },
  { value: "foodie", label: { ko: "로컬 맛집 탐방", en: "Local foodie", zh: "美食探店", ja: "グルメ巡り" } },
  { value: "photography", label: { ko: "사진 스팟 탐색", en: "Photo spots", zh: "拍照打卡", ja: "撮影スポット" } },
  { value: "festival", label: { ko: "지역 축제·행사", en: "Festivals & Events", zh: "节庆活动", ja: "祭り・イベント" } },
  { value: "nature", label: { ko: "자연 속 힐링", en: "Nature healing", zh: "自然疗愈", ja: "自然で癒し" } },
  { value: "art_museum", label: { ko: "유적지 및 문화/전시", en: "Culture & Museum", zh: "文化展览", ja: "文化・展示" } },
  { value: "activity", label: { ko: "야외 액티비티", en: "Outdoor activity", zh: "户外活动", ja: "アウトドア" } },
  { value: "shopping", label: { ko: "쇼핑 및 팝업 탐방", en: "Shopping & Pop-up", zh: "购物探店", ja: "ショッピング" } },
  { value: "drive", label: { ko: "근교 드라이브", en: "Driving", zh: "近郊自驾", ja: "ドライブ" } },
  { value: "family", label: { ko: "가족 나들이", en: "Family trips", zh: "家庭出游", ja: "家族でお出かけ" } },
  { value: "pet", label: { ko: "반려동물 동행", en: "With pets", zh: "携带宠物", ja: "ペット同伴" } },
  { value: "other", label: { ko: "기타", en: "Other", zh: "其他", ja: "その他" } },
]

export const PRIMARY_REGION_OPTIONS: LocalizedOption[] = [
  {
    value: "jeonju",
    label: { ko: "전주 중심", en: "Jeonju first", zh: "全州中心", ja: "全州中心" },
    description: {
      ko: "전주 지역 브리핑과 나들이 판단을 우선 제공합니다.",
      en: "Prioritize Jeonju-specific briefings.",
      zh: "优先提供全州地区的简报和出行判断。",
      ja: "全州地域のブリーフィングとお出かけ判断を優先提供します。",
    },
  },
  {
    value: "jeonbuk",
    label: { ko: "전북권", en: "Jeonbuk area", zh: "全北地区", ja: "全北圏" },
    description: {
      ko: "전북권 이동이 잦은 사용자를 위한 설정입니다.",
      en: "For users moving often across Jeonbuk.",
      zh: "适用于经常在全北地区移动的用户。",
      ja: "全北圏を頻繁に移動するユーザー向けの設定です。",
    },
  },
  {
    value: "current_location",
    label: { ko: "현재 위치 우선", en: "Current location", zh: "当前位置优先", ja: "現在地基準" },
    description: {
      ko: "접속 위치 기반 판단을 기본값으로 사용합니다.",
      en: "Prefer device location-based insights.",
      zh: "基于当前位置进行判断作为默认设置。",
      ja: "接続位置ベースの判断をデフォルトで使用します。",
    },
  },
  {
    value: "travel_mode",
    label: { ko: "여행 모드", en: "Travel mode", zh: "旅行模式", ja: "旅行モード" },
    description: {
      ko: "이동 중인 지역에 맞춰 유연하게 추천합니다.",
      en: "Flexible recommendations while traveling.",
      zh: "根据旅行的区域灵活推荐。",
      ja: "移動中の地域に合わせて柔軟におすすめします。",
    },
  },
]

export const TIME_SLOT_OPTIONS: LocalizedOption[] = [
  { value: "early_morning", label: { ko: "이른 아침", en: "Early morning", zh: "清晨", ja: "早朝" } },
  { value: "late_morning", label: { ko: "오전", en: "Late morning", zh: "上午", ja: "午前" } },
  { value: "afternoon", label: { ko: "오후", en: "Afternoon", zh: "下午", ja: "午後" } },
  { value: "sunset_evening", label: { ko: "해질녘·저녁", en: "Sunset evening", zh: "黄昏·傍晚", ja: "夕方・夜" } },
  { value: "all_day", label: { ko: "하루 종일", en: "All day", zh: "全天", ja: "一日中" } },
]

export const WEATHER_SENSITIVITY_OPTIONS: LocalizedOption[] = [
  { value: "heat", label: { ko: "더위", en: "Heat", zh: "炎热", ja: "暑さ" } },
  { value: "cold", label: { ko: "추위", en: "Cold", zh: "寒冷", ja: "寒さ" } },
  { value: "rain", label: { ko: "비", en: "Rain", zh: "下雨", ja: "雨" } },
  { value: "fine_dust", label: { ko: "미세먼지", en: "Fine dust", zh: "雾霾", ja: "微細粉塵" } },
  { value: "uv", label: { ko: "강한 햇빛", en: "Strong UV", zh: "强紫外线", ja: "強い日差し" } },
]

/** Returns the localized label for a given option value, falling back to Korean. */
export function getOptionLabel(
  options: LocalizedOption[],
  value: string,
  language: string
) {
  const option = options.find((option) => option.value === value)
  if (!option) return value
  const label = option.label as Record<string, string | undefined>
  return label[language] ?? label["ko"] ?? value
}

/** Filters an input array to only include values present in the allowed options set, deduplicating. */
export function filterAllowedValues(
  values: string[],
  options: LocalizedOption[]
) {
  const allowed = new Set(options.map((option) => option.value))
  return Array.from(
    new Set(values.filter((value) => typeof value === "string" && allowed.has(value)))
  )
}

/** Checks whether a single value is among the allowed options. */
export function isAllowedValue(value: string, options: LocalizedOption[]) {
  return options.some((option) => option.value === value)
}
