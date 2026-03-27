/**
 * [BACKEND_LINK]: 이 파일의 모든 데이터는 초기 프론트엔드 개발을 위한 가짜 데이터(Mock Data)입니다.
 * 나중에 Spring Boot 또는 Node.js 백엔드 API가 완성되면, 이 구조에 맞춰 실제 DB 데이터를 반환하도록 구현해야 합니다.
 */

export const mockWeatherData = {
  score: 95,
  status: "완벽함",
  message: "오늘은 피크닉 가기 완벽한 날이에요!",
  details: {
    temp: 22,
    humidity: 45,
    wind: 2.1,
    dust: "15µg/m³ (국내: 좋음 / WHO: 좋음)",
    pm10: 15,
    pm25: 8,
    o3: 0.032,
    no2: 0.012,
    co: 0.4,
    so2: 0.003,
    khai: 45,
    pty: 0,
    rn1: 0,
    vec: 280,
    uv: "보통",
  },
  metadata: {
    dataSource: "기상청, 한국환경공단",
    station: "덕진동",
    lastUpdate: "14:10",
    intervals: { kma: "매시 45분", air: "매시 정각" }
  }
};


export const mockInsights = [
  {
    name: "최적의 요일",
    description: "지난 3년 통계 분석 결과, 이번 달 가장 쾌적한 피크닉 요일은 '토요일'입니다.",
    icon: "CalendarIcon",
    className: "col-span-3 lg:col-span-1",
    bgText: "SAT",
    href: "/statistics/calendar",
    cta: "통계 달력 보기",
  },
  {
    name: "기후 에너지",
    description: "오늘 전주의 기상 에너지는 92%로, 외부 활동에 매우 긍정적인 수치입니다.",
    icon: "ThermometerIcon",
    className: "col-span-3 lg:col-span-1",
    bgEffect: "bloom-orange",
    href: "#statistics",
    cta: "에너지 리포트",
  },
  {
    name: "실시간 혼잡도",
    description: "덕진공원 인근은 현재 '여유' 로우며, 쾌적한 자리 선점이 가능합니다.",
    icon: "MapPinIcon",
    className: "col-span-3 lg:col-span-1",
    bgEffect: "circle-blue",
    href: "#ai-generator",
    cta: "장소 예약 문의",
  },
];



export const mockTrends = [
  "지금 전주 시민들이 많이 찾는 스팟: #세병호",
  "#덕진공원",
  "#전주한옥마을",
  "#객리단길",
  "#전라감영",
  "#아중호수",
  "#오목대",
  "#전주동물원",
  "#완산칠봉",
  "#다가공원",
  "#전주수목원",
  "#경기전",
  "#풍남문",
  "#자만벽화마을",
];


export const mockCourse = [
  {
    time: "13:00 - 15:30",
    title: "따뜻한 야외 타임 - 덕진공원",
    description: "햇살이 가장 따뜻하고 미세먼지가 없는 시간대예요. 덕진공원에서 돗자리를 펴고 샌드위치를 드시는 걸 추천해요!",
    type: "야외",
  },
  {
    time: "16:00 - 18:00",
    title: "바람 피하기 타임 - A 카페",
    description: "4시부터는 서풍이 불면서 체감 온도가 떨어질 예정이에요. 카페로 이동해서 따뜻한 차를 마시며 여유를 즐겨보세요.",
    type: "실내",
  },
];

export const mockCalendarData: Record<string, number[]> = {
  "2026-03": [14, 15, 21, 22, 28, 29],
  "2026-04": [4, 5, 11, 12, 18, 19, 25, 26],
  "2026-05": [2, 3, 5, 9, 10, 16, 17, 23, 24, 30, 31],
};

