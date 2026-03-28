export interface RegionProfile {
  key: string
  displayName: string
  englishName: string
  airSidoName: string
  stationKeywords: string[]
  forecastLandReg: string
  forecastTempReg: string
  areaNo: string
  weatherStationId: string
  warningKeywords: string[]
}

const GRID_RE = 6371.00877
const GRID_SIZE = 5.0
const SLAT1 = 30.0
const SLAT2 = 60.0
const OLON = 126.0
const OLAT = 38.0
const XO = 43
const YO = 136

export const HOME_REGION: RegionProfile = {
  key: "jeonju",
  displayName: "전주",
  englishName: "Jeonju",
  airSidoName: "전북",
  stationKeywords: ["덕진동", "금암동", "중앙동", "송천동", "서신동", "효자동", "혁신동", "전주"],
  forecastLandReg: "11F10000",
  forecastTempReg: "11F10201",
  areaNo: "4511000000",
  weatherStationId: "146",
  warningKeywords: ["전주", "전북", "완주", "익산", "군산"],
}

const REGION_PROFILES: RegionProfile[] = [
  {
    key: "seoul",
    displayName: "서울",
    englishName: "Seoul",
    airSidoName: "서울",
    stationKeywords: ["중구", "종로구", "마포구", "성동구", "용산구", "광진구"],
    forecastLandReg: "11B00000",
    forecastTempReg: "11B10101",
    areaNo: "1100000000",
    weatherStationId: "109",
    warningKeywords: ["서울", "경기", "인천"],
  },
  {
    key: "daejeon",
    displayName: "대전",
    englishName: "Daejeon",
    airSidoName: "대전",
    stationKeywords: ["유성구", "서구", "중구", "대덕구"],
    forecastLandReg: "11C20000",
    forecastTempReg: "11C20401",
    areaNo: "3011000000",
    weatherStationId: "133",
    warningKeywords: ["대전", "세종", "충남", "충북"],
  },
  {
    key: "gwangju",
    displayName: "광주",
    englishName: "Gwangju",
    airSidoName: "광주",
    stationKeywords: ["북구", "서구", "광산구", "남구", "동구"],
    forecastLandReg: "11F20000",
    forecastTempReg: "11F20501",
    areaNo: "2911000000",
    weatherStationId: "156",
    warningKeywords: ["광주", "전남", "목포", "순천", "여수"],
  },
  {
    key: "busan",
    displayName: "부산",
    englishName: "Busan",
    airSidoName: "부산",
    stationKeywords: ["기장군", "해운대구", "수영구", "남구", "동래구"],
    forecastLandReg: "11H20000",
    forecastTempReg: "11H20201",
    areaNo: "2611000000",
    weatherStationId: "159",
    warningKeywords: ["부산", "울산", "경남", "창원", "양산"],
  },
  HOME_REGION,
]

export function getRegionProfileByKey(key: string) {
  return REGION_PROFILES.find((profile) => profile.key === key) ?? HOME_REGION
}

export function dfsToGrid(lat: number, lon: number) {
  const DEG_TO_RAD = Math.PI / 180.0
  const re = GRID_RE / GRID_SIZE
  const slat1 = SLAT1 * DEG_TO_RAD
  const slat2 = SLAT2 * DEG_TO_RAD
  const olon = OLON * DEG_TO_RAD
  const olat = OLAT * DEG_TO_RAD

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)

  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn

  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = (re * sf) / Math.pow(ro, sn)

  let ra = Math.tan(Math.PI * 0.25 + lat * DEG_TO_RAD * 0.5)
  ra = (re * sf) / Math.pow(ra, sn)

  let theta = lon * DEG_TO_RAD - olon
  if (theta > Math.PI) theta -= 2.0 * Math.PI
  if (theta < -Math.PI) theta += 2.0 * Math.PI
  theta *= sn

  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  }
}

function getKstParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "00"

  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
  }
}

export function getCurrentNowcastBase(date = new Date()) {
  const parts = getKstParts(date)
  const minute = Number(parts.minute)
  const adjustedDate = minute < 45 ? new Date(date.getTime() - 60 * 60 * 1000) : date
  const adjusted = getKstParts(adjustedDate)

  return {
    baseDate: `${adjusted.year}${adjusted.month}${adjusted.day}`,
    baseTime: `${adjusted.hour}00`,
  }
}

export function getMidForecastBase(date = new Date()) {
  const parts = getKstParts(date)
  const currentHour = Number(parts.hour)
  const currentDate = `${parts.year}${parts.month}${parts.day}`

  if (currentHour < 6) {
    const previous = new Date(date.getTime() - 24 * 60 * 60 * 1000)
    const prevParts = getKstParts(previous)
    return {
      forecastDate: currentDate,
      tmFc: `${prevParts.year}${prevParts.month}${prevParts.day}1800`,
    }
  }

  return {
    forecastDate: currentDate,
    tmFc: `${currentDate}${currentHour < 18 ? "0600" : "1800"}`,
  }
}

export function formatKmaDateTime(baseDate: string, baseTime: string) {
  return `${baseDate.slice(0, 4)}.${baseDate.slice(4, 6)}.${baseDate.slice(6, 8)} ${baseTime.slice(0, 2)}:${baseTime.slice(2, 4)}`
}

export function resolveRegionProfile(lat?: number | null, lon?: number | null): RegionProfile {
  if (lat == null || lon == null) return HOME_REGION
  if (lat > 37) return REGION_PROFILES[0]
  if (lat > 36.3) return REGION_PROFILES[1]
  if (lat > 35 && lon < 127) return REGION_PROFILES[2]
  if (lat > 35 && lon > 128) return REGION_PROFILES[3]
  return HOME_REGION
}

export function pickStationByKeywords<T extends { stationName?: string }>(items: T[], keywords: string[]) {
  return (
    items.find((item) => keywords.some((keyword) => item.stationName?.includes(keyword))) ??
    items[0] ??
    null
  )
}

export function getKstDateLabel(date = new Date()) {
  const parts = getKstParts(date)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function getStableForecastSeed(dateKey: string) {
  return Array.from(dateKey).reduce((seed, char) => seed + char.charCodeAt(0), 0)
}

export function stripHtmlTags(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function getKstCompactDate(date = new Date()) {
  const parts = getKstParts(date)
  return `${parts.year}${parts.month}${parts.day}`
}
