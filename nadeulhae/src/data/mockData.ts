/**
 * [BACKEND_LINK]: 이 파일의 모든 데이터는 초기 프론트엔드 개발을 위한 가짜 데이터(Mock Data)입니다.
 * 나중에 Spring Boot 또는 Node.js 백엔드 API가 완성되면, 이 구조에 맞춰 실제 DB 데이터를 반환하도록 구현해야 합니다.
 */

export const mockWeatherData = {
  score: 95,
  status: "status_excellent",
  message: "msg_excellent",
  details: {
    temp: 22,
    humidity: 45,
    wind: 2.1,
    dust: "15µg/m³",
    dust_domestic: "level_good",
    dust_who: "level_good",
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
    kr: "좋음",
    who: "보통",
  },
  metadata: {
    dataSource: "data_source_combined",
    station: "Dukjin-dong",
    lastUpdate: "14:10",
    intervals: { kma: "interval_45m", air: "interval_0m" }
  }
};


export const mockInsights = [
  {
    name: "insight_1_title",
    description: "insight_1_desc",
    icon: "CalendarIcon",
    className: "col-span-3 lg:col-span-1",
    bgText: "SAT",
    href: "/statistics/calendar",
    cta: "insight_1_cta",
  },
  {
    name: "insight_2_title",
    description: "insight_2_desc",
    icon: "ThermometerIcon",
    className: "col-span-3 lg:col-span-1",
    bgEffect: "bloom-orange",
    href: "#statistics",
    cta: "insight_2_cta",
  },
  {
    name: "insight_3_title",
    description: "insight_3_desc",
    icon: "MapPinIcon",
    className: "col-span-3 lg:col-span-1",
    bgEffect: "circle-blue",
    href: "#ai-generator",
    cta: "insight_3_cta",
  },
];



export const mockTrends = [
  "세병호",
  "덕진공원",
  "전주한옥마을",
  "객리단길",
  "전라감영",
  "아중호수",
  "오목대",
  "전주동물원",
  "완산칠봉",
  "다가공원",
  "전주수목원",
  "경기전",
  "풍남문",
  "자만벽화마을",
];


export const mockCourse = [
  {
    time: "13:00 - 15:30",
    title: "course_1_title",
    description: "course_1_desc",
    type: "야외",
  },
  {
    time: "16:00 - 18:00",
    title: "course_2_title",
    description: "course_2_desc",
    type: "실내",
  },
];

export const mockCalendarData: Record<string, number[]> = {
  "2026-03": [14, 15, 21, 22, 28, 29],
  "2026-04": [4, 5, 11, 12, 18, 19, 25, 26],
  "2026-05": [2, 3, 5, 9, 10, 16, 17, 23, 24, 30, 31],
};

