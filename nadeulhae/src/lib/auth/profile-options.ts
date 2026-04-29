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

export const MIN_PASSWORD_LENGTH = 10
export const MAX_INTEREST_SELECTIONS = 5

export const AGE_BAND_OPTIONS: LocalizedOption[] = [
  { value: "14_19", label: { ko: "14-19세", en: "14-19" } },
  { value: "20_29", label: { ko: "20대", en: "20s" } },
  { value: "30_39", label: { ko: "30대", en: "30s" } },
  { value: "40_49", label: { ko: "40대", en: "40s" } },
  { value: "50_plus", label: { ko: "50대 이상", en: "50+" } },
]

export const INTEREST_OPTIONS: LocalizedOption[] = [
  { value: "picnic", label: { ko: "피크닉", en: "Picnic" } },
  { value: "walking", label: { ko: "산책 및 걷기", en: "Walking" } },
  { value: "cafe", label: { ko: "감성 카페 탐방", en: "Cafe hopping" } },
  { value: "foodie", label: { ko: "로컬 맛집 탐방", en: "Local foodie" } },
  { value: "photography", label: { ko: "사진 스팟 탐색", en: "Photo spots" } },
  { value: "festival", label: { ko: "지역 축제·행사", en: "Festivals & Events" } },
  { value: "nature", label: { ko: "자연 속 힐링", en: "Nature healing" } },
  { value: "art_museum", label: { ko: "유적지 및 문화/전시", en: "Culture & Museum" } },
  { value: "activity", label: { ko: "야외 액티비티", en: "Outdoor activity" } },
  { value: "shopping", label: { ko: "쇼핑 및 팝업 탐방", en: "Shopping & Pop-up" } },
  { value: "drive", label: { ko: "근교 드라이브", en: "Driving" } },
  { value: "family", label: { ko: "가족 나들이", en: "Family trips" } },
  { value: "pet", label: { ko: "반려동물 동행", en: "With pets" } },
  { value: "other", label: { ko: "기타", en: "Other" } },
]

export const PRIMARY_REGION_OPTIONS: LocalizedOption[] = [
  {
    value: "jeonju",
    label: { ko: "전주 중심", en: "Jeonju first" },
    description: {
      ko: "전주 지역 브리핑과 나들이 판단을 우선 제공합니다.",
      en: "Prioritize Jeonju-specific briefings.",
    },
  },
  {
    value: "jeonbuk",
    label: { ko: "전북권", en: "Jeonbuk area" },
    description: {
      ko: "전북권 이동이 잦은 사용자를 위한 설정입니다.",
      en: "For users moving often across Jeonbuk.",
    },
  },
  {
    value: "current_location",
    label: { ko: "현재 위치 우선", en: "Current location" },
    description: {
      ko: "접속 위치 기반 판단을 기본값으로 사용합니다.",
      en: "Prefer device location-based insights.",
    },
  },
  {
    value: "travel_mode",
    label: { ko: "여행 모드", en: "Travel mode" },
    description: {
      ko: "이동 중인 지역에 맞춰 유연하게 추천합니다.",
      en: "Flexible recommendations while traveling.",
    },
  },
]

export const TIME_SLOT_OPTIONS: LocalizedOption[] = [
  { value: "early_morning", label: { ko: "이른 아침", en: "Early morning" } },
  { value: "late_morning", label: { ko: "오전", en: "Late morning" } },
  { value: "afternoon", label: { ko: "오후", en: "Afternoon" } },
  { value: "sunset_evening", label: { ko: "해질녘·저녁", en: "Sunset evening" } },
  { value: "all_day", label: { ko: "하루 종일", en: "All day" } },
]

export const WEATHER_SENSITIVITY_OPTIONS: LocalizedOption[] = [
  { value: "heat", label: { ko: "더위", en: "Heat" } },
  { value: "cold", label: { ko: "추위", en: "Cold" } },
  { value: "rain", label: { ko: "비", en: "Rain" } },
  { value: "fine_dust", label: { ko: "미세먼지", en: "Fine dust" } },
  { value: "uv", label: { ko: "강한 햇빛", en: "Strong UV" } },
]

export function getOptionLabel(
  options: LocalizedOption[],
  value: string,
  language: string
) {
  return options.find((option) => option.value === value)?.label[language as "ko" | "en"] ?? value
}

export function filterAllowedValues(
  values: string[],
  options: LocalizedOption[]
) {
  const allowed = new Set(options.map((option) => option.value))
  return Array.from(
    new Set(values.filter((value) => typeof value === "string" && allowed.has(value)))
  )
}

export function isAllowedValue(value: string, options: LocalizedOption[]) {
  return options.some((option) => option.value === value)
}
