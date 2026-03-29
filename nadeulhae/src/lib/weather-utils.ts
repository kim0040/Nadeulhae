export interface RegionProfile {
  key: string
  displayName: string
  englishName: string
  lat: number
  lon: number
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
  lat: 35.8242,
  lon: 127.148,
  airSidoName: "전북",
  stationKeywords: ["덕진동", "금암동", "중앙동", "송천동", "서신동", "효자동", "혁신동", "전주"],
  forecastLandReg: "11F10000",
  forecastTempReg: "11F10201",
  areaNo: "4511000000",
  weatherStationId: "146",
  warningKeywords: ["전주", "전북", "완주", "익산", "군산"],
}

const HUB_REGION_PROFILES: RegionProfile[] = [
  {
    key: "seoul",
    displayName: "서울",
    englishName: "Seoul",
    lat: 37.5665,
    lon: 126.978,
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
    lat: 36.3504,
    lon: 127.3845,
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
    lat: 35.1595,
    lon: 126.8526,
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
    lat: 35.1796,
    lon: 129.0756,
    airSidoName: "부산",
    stationKeywords: ["기장군", "해운대구", "수영구", "남구", "동래구"],
    forecastLandReg: "11H20000",
    forecastTempReg: "11H20201",
    areaNo: "2611000000",
    weatherStationId: "159",
    warningKeywords: ["부산", "울산", "경남", "창원", "양산"],
  },
  {
    key: "incheon",
    displayName: "인천",
    englishName: "Incheon",
    lat: 37.4563,
    lon: 126.7052,
    airSidoName: "인천",
    stationKeywords: ["남동구", "부평구", "미추홀구", "연수구", "계양구", "중구", "동구"],
    forecastLandReg: "11B00000",
    forecastTempReg: "11B10101",
    areaNo: "2811000000",
    weatherStationId: "112",
    warningKeywords: ["인천", "강화", "옹진", "경기"],
  },
  {
    key: "ulsan",
    displayName: "울산",
    englishName: "Ulsan",
    lat: 35.5384,
    lon: 129.3114,
    airSidoName: "울산",
    stationKeywords: ["남구", "중구", "북구", "동구", "울주군"],
    forecastLandReg: "11H20000",
    forecastTempReg: "11H20101",
    areaNo: "3111000000",
    weatherStationId: "152",
    warningKeywords: ["울산", "부산", "양산", "경남"],
  },
  {
    key: "sejong",
    displayName: "세종",
    englishName: "Sejong",
    lat: 36.4801,
    lon: 127.289,
    airSidoName: "세종",
    stationKeywords: ["보람동", "조치원읍", "아름동", "신흥동", "세종"],
    forecastLandReg: "11C20000",
    forecastTempReg: "11C20401",
    areaNo: "3611000000",
    weatherStationId: "239",
    warningKeywords: ["세종", "대전", "충남", "청주"],
  },
  {
    key: "jeju",
    displayName: "제주",
    englishName: "Jeju",
    lat: 33.4996,
    lon: 126.5312,
    airSidoName: "제주",
    stationKeywords: ["이도동", "연동", "건입동", "아라동", "제주"],
    forecastLandReg: "11G00000",
    forecastTempReg: "11G00201",
    areaNo: "5011000000",
    weatherStationId: "184",
    warningKeywords: ["제주", "서귀포", "성산"],
  },
  {
    key: "gangneung",
    displayName: "강릉",
    englishName: "Gangneung",
    lat: 37.7519,
    lon: 128.8761,
    airSidoName: "강원",
    stationKeywords: ["옥천동", "강동면", "연곡면", "주문진", "강릉"],
    forecastLandReg: "11D10000",
    forecastTempReg: "11D10301",
    areaNo: "4215000000",
    weatherStationId: "105",
    warningKeywords: ["강릉", "강원", "동해", "삼척", "속초"],
  },
  {
    key: "gwangyang",
    displayName: "광양",
    englishName: "Gwangyang",
    lat: 34.9404,
    lon: 127.6957,
    airSidoName: "전남",
    stationKeywords: ["광양", "태인동", "진상면", "중동", "광양읍"],
    forecastLandReg: "11F20404",
    forecastTempReg: "11F20404",
    areaNo: "4679000000",
    weatherStationId: "266",
    warningKeywords: ["광양", "순천", "여수", "전남"],
  },
]

function createAliasProfile(baseKey: string, overrides: Omit<RegionProfile, "forecastLandReg" | "forecastTempReg" | "areaNo" | "weatherStationId">) {
  const base = (baseKey === HOME_REGION.key ? HOME_REGION : HUB_REGION_PROFILES.find((profile) => profile.key === baseKey))
  if (!base) {
    throw new Error(`Unknown base region: ${baseKey}`)
  }

  return {
    ...base,
    ...overrides,
  }
}

const REGION_ALIASES: RegionProfile[] = [
  createAliasProfile("seoul", {
    key: "suwon",
    displayName: "수원",
    englishName: "Suwon",
    lat: 37.2636,
    lon: 127.0286,
    airSidoName: "경기",
    stationKeywords: ["수원", "영통", "장안", "권선", "팔달"],
    warningKeywords: ["수원", "경기남부", "경기"],
  }),
  createAliasProfile("seoul", {
    key: "seongnam",
    displayName: "성남",
    englishName: "Seongnam",
    lat: 37.4201,
    lon: 127.1262,
    airSidoName: "경기",
    stationKeywords: ["성남", "분당", "중원", "수정", "판교"],
    warningKeywords: ["성남", "경기남부", "경기"],
  }),
  createAliasProfile("seoul", {
    key: "yongin",
    displayName: "용인",
    englishName: "Yongin",
    lat: 37.2411,
    lon: 127.1776,
    airSidoName: "경기",
    stationKeywords: ["용인", "수지", "기흥", "처인", "동백"],
    warningKeywords: ["용인", "경기남부", "경기"],
  }),
  createAliasProfile("daejeon", {
    key: "cheongju",
    displayName: "청주",
    englishName: "Cheongju",
    lat: 36.6424,
    lon: 127.489,
    airSidoName: "충북",
    stationKeywords: ["청주", "흥덕", "서원", "청원", "상당"],
    warningKeywords: ["청주", "충북"],
  }),
  createAliasProfile("daejeon", {
    key: "cheonan",
    displayName: "천안",
    englishName: "Cheonan",
    lat: 36.8151,
    lon: 127.1139,
    airSidoName: "충남",
    stationKeywords: ["천안", "서북구", "동남구", "불당", "성성"],
    warningKeywords: ["천안", "충남"],
  }),
  createAliasProfile("gangneung", {
    key: "chuncheon",
    displayName: "춘천",
    englishName: "Chuncheon",
    lat: 37.8813,
    lon: 127.7298,
    airSidoName: "강원",
    stationKeywords: ["춘천", "석사동", "후평동", "효자동"],
    warningKeywords: ["춘천", "강원북부", "강원"],
  }),
  createAliasProfile("gangneung", {
    key: "wonju",
    displayName: "원주",
    englishName: "Wonju",
    lat: 37.3422,
    lon: 127.9202,
    airSidoName: "강원",
    stationKeywords: ["원주", "명륜동", "무실동", "단계동"],
    warningKeywords: ["원주", "강원영서", "강원"],
  }),
  createAliasProfile("busan", {
    key: "changwon",
    displayName: "창원",
    englishName: "Changwon",
    lat: 35.2272,
    lon: 128.6811,
    airSidoName: "경남",
    stationKeywords: ["창원", "의창", "성산", "마산", "진해"],
    warningKeywords: ["창원", "경남", "마산", "진해"],
  }),
  createAliasProfile("ulsan", {
    key: "pohang",
    displayName: "포항",
    englishName: "Pohang",
    lat: 36.019,
    lon: 129.3435,
    airSidoName: "경북",
    stationKeywords: ["포항", "북구", "남구", "장흥동"],
    warningKeywords: ["포항", "경북동해안", "경북"],
  }),
  createAliasProfile("ulsan", {
    key: "daegu",
    displayName: "대구",
    englishName: "Daegu",
    lat: 35.8714,
    lon: 128.6014,
    airSidoName: "대구",
    stationKeywords: ["중구", "수성구", "달서구", "북구", "대구"],
    warningKeywords: ["대구", "경북", "달성", "칠곡"],
  }),
  createAliasProfile("gwangju", {
    key: "mokpo",
    displayName: "목포",
    englishName: "Mokpo",
    lat: 34.8118,
    lon: 126.3922,
    airSidoName: "전남",
    stationKeywords: ["목포", "용당동", "부흥동", "연산동"],
    warningKeywords: ["목포", "전남서해안", "전남"],
  }),
  createAliasProfile("gwangju", {
    key: "suncheon",
    displayName: "순천",
    englishName: "Suncheon",
    lat: 34.9506,
    lon: 127.4872,
    airSidoName: "전남",
    stationKeywords: ["순천", "장천동", "해룡면", "연향동"],
    warningKeywords: ["순천", "전남동부", "전남"],
  }),
  createAliasProfile("gwangyang", {
    key: "yeosu",
    displayName: "여수",
    englishName: "Yeosu",
    lat: 34.7604,
    lon: 127.6622,
    airSidoName: "전남",
    stationKeywords: ["여수", "둔덕동", "문수동", "여천동"],
    warningKeywords: ["여수", "전남동부", "전남"],
  }),
  createAliasProfile("jeonju", {
    key: "gunsan",
    displayName: "군산",
    englishName: "Gunsan",
    lat: 35.9677,
    lon: 126.7369,
    airSidoName: "전북",
    stationKeywords: ["군산", "소룡동", "나운동", "조촌동"],
    warningKeywords: ["군산", "전북서부", "전북"],
  }),
  createAliasProfile("jeju", {
    key: "seogwipo",
    displayName: "서귀포",
    englishName: "Seogwipo",
    lat: 33.2541,
    lon: 126.5601,
    airSidoName: "제주",
    stationKeywords: ["서귀포", "동홍동", "중문동", "강정동"],
    warningKeywords: ["서귀포", "제주남부", "제주"],
  }),
]

const REGION_PROFILES: RegionProfile[] = [...HUB_REGION_PROFILES, ...REGION_ALIASES, HOME_REGION]

export function getRegionProfiles() {
  return REGION_PROFILES
}

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

export function getVillageForecastBase(date = new Date()) {
  const parts = getKstParts(date)
  const currentHour = Number(parts.hour)
  const currentMinute = Number(parts.minute)
  
  // KMA Village Forecast (단기예보) update hours: 02, 05, 08, 11, 14, 17, 20, 23
  // Data is pushed after about 10-15 minutes of the hour.
  const updateHours = [2, 5, 8, 11, 14, 17, 20, 23]
  let targetHour = 23
  let usePrevDay = false

  // Find the most recent update hour
  if (currentHour < 2 || (currentHour === 2 && currentMinute < 15)) {
    usePrevDay = true
    targetHour = 23
  } else {
    for (let i = updateHours.length - 1; i >= 0; i--) {
      if (currentHour > updateHours[i] || (currentHour === updateHours[i] && currentMinute >= 15)) {
        targetHour = updateHours[i]
        break
      }
    }
  }

  const baseDateSource = usePrevDay ? new Date(date.getTime() - 24 * 60 * 60 * 1000) : date
  const baseParts = getKstParts(baseDateSource)

  return {
    baseDate: `${baseParts.year}${baseParts.month}${baseParts.day}`,
    baseTime: `${String(targetHour).padStart(2, "0")}00`,
  }
}

/**
 * Calculates the next expected update timestamp for various weather services.
 * This is used for smart caching to minimize redundant API calls.
 */
export function getNextUpdateTimestamp(type: 'village' | 'mid' | 'air', now = new Date()): number {
  const kst = getKstParts(now)
  const hour = Number(kst.hour)
  const min = Number(kst.minute)
  
  const nextTarget = new Date(now)
  nextTarget.setSeconds(0, 0)

  if (type === 'village') {
    // 3-hour cycle: 02:15, 05:15...
    const updateHours = [2, 5, 8, 11, 14, 17, 20, 23]
    let nextHour = 2
    
    for (const h of updateHours) {
      if (hour < h || (hour === h && min < 15)) {
        nextHour = h
        break
      }
      if (h === 23) {
        nextHour = 2 // Next day
        nextTarget.setDate(nextTarget.getDate() + 1)
      }
    }
    nextTarget.setHours(nextHour, 15)
  } else if (type === 'mid') {
    // 12-hour cycle: 06:05, 18:05
    if (hour < 6 || (hour === 6 && min < 5)) {
      nextTarget.setHours(6, 5)
    } else if (hour < 18 || (hour === 18 && min < 5)) {
      nextTarget.setHours(18, 5)
    } else {
      nextTarget.setDate(nextTarget.getDate() + 1)
      nextTarget.setHours(6, 5)
    }
  } else if (type === 'air') {
    // Hourly: XX:15 (usually data is updated around 15-20 min past the hour)
    if (min < 20) {
      nextTarget.setHours(hour, 20)
    } else {
      nextTarget.setHours(hour + 1, 20)
    }
  }

  return nextTarget.getTime()
}

export function formatKmaDateTime(baseDate: string, baseTime: string) {
  return `${baseDate.slice(0, 4)}.${baseDate.slice(4, 6)}.${baseDate.slice(6, 8)} ${baseTime.slice(0, 2)}:${baseTime.slice(2, 4)}`
}

export function resolveRegionProfile(lat?: number | null, lon?: number | null): RegionProfile {
  if (lat == null || lon == null) return HOME_REGION

  let minDistanceSq = Infinity
  let nearestProfile = HOME_REGION

  for (const profile of REGION_PROFILES) {
    const dLat = lat - profile.lat
    const dLon = lon - profile.lon
    const distanceSq = dLat * dLat + dLon * dLon
    
    if (distanceSq < minDistanceSq) {
      minDistanceSq = distanceSq
      nearestProfile = profile
    }
  }

  return nearestProfile
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
