import { NextResponse } from "next/server";

// 서버사이드 캐싱용 변수
let cachedKma: any = null;
let lastKmaTime: number = 0;
let cachedAir: any = null;
let lastAirTime: number = 0;

const KMA_CACHE_DURATION = 1 * 60 * 1000;    // 1분 (분당 1회, 일 1440회 << 5000회)
const AIR_CACHE_DURATION = 10 * 60 * 1000;   // 10분 (일 144회 << 500회)

export async function GET() {
  const now = Date.now();
  const kmaKey = process.env.KMA_API_KEY;
  const airKey = process.env.AIRKOREA_API_KEY;

  if (!kmaKey || !airKey) {
    return NextResponse.json({ error: "API Keys not configured" }, { status: 500 });
  }

  // 데이터 수집 (캐시 확인 포함)
  let weatherData = cachedKma;
  let airQuality = cachedAir;

  // 1. 기상청(KMA) 데이터 갱신
  if (!cachedKma || (now - lastKmaTime > KMA_CACHE_DURATION)) {
    try {
      const nx = 63, ny = 89;
      const currentTime = new Date();
      const formatter = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false });
      const parts = formatter.formatToParts(currentTime);
      const findPart = (type: string) => parts.find(p => p.type === type)?.value || "";
      const year = findPart('year'), month = findPart('month'), day = findPart('day');
      let hour = findPart('hour');
      if (currentTime.getMinutes() < 45) {
        const prevHour = new Date(currentTime.getTime() - 60 * 60 * 1000);
        const prevParts = formatter.formatToParts(prevHour);
        hour = prevParts.find(p => p.type === 'hour')?.value || "00";
      }
      const base_date = `${year}${month}${day}`, base_time = `${hour}00`;
      const kmaUrl = `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtNcst?authKey=${kmaKey}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${base_date}&base_time=${base_time}&nx=${nx}&ny=${ny}`;
      
      const res = await fetch(kmaUrl);
      const data = await res.json();
      if (data.response?.header?.resultCode === "00") {
        const items = data.response.body.items.item;
        const map: Record<string, string> = {};
        items.forEach((item: any) => { map[item.category] = item.obsrValue; });
        
        // 포맷팅된 시간 생성 (202603272100 -> 2026.03.27 21:00)
        const fDate = `${base_date.substring(0,4)}.${base_date.substring(4,6)}.${base_date.substring(6,8)}`;
        const fTime = `${base_time.substring(0,2)}:${base_time.substring(2,4)}`;

        weatherData = {
          temp: parseFloat(map["T1H"]),
          humidity: parseFloat(map["REH"]),
          wind: parseFloat(map["WSD"]),
          pty: parseInt(map["PTY"]),
          rn1: parseFloat(map["RN1"]) || 0,
          vec: parseInt(map["VEC"]),
          lastUpdate: `${fDate} ${fTime}`
        };
        cachedKma = weatherData;
        lastKmaTime = now;
      }
    } catch (e) { console.error("KMA Fetch Error:", e); }
  }

  // 2. 에어코리아 데이터 갱신
  if (!cachedAir || (now - lastAirTime > AIR_CACHE_DURATION)) {
    try {
      const airUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${airKey}&returnType=json&numOfRows=100&pageNo=1&sidoName=${encodeURIComponent("전북")}&ver=1.0`;
      const res = await fetch(airUrl);
      if (res.ok) {
        const data = await res.json();
        const items = data.response?.body?.items || [];
        
        // 전북대 근처 측정소 우선순위: 덕진동 -> 금암동 -> 중앙동 -> 기타 전주 주요 지역
        const jeonju = items.find((item: any) => 
          item.stationName.includes("덕진동") || 
          item.stationName.includes("금암동") ||
          item.stationName.includes("중앙동") ||
          item.stationName.includes("송천동") ||
          item.stationName.includes("서신동") ||
          item.stationName.includes("효자동") ||
          item.stationName.includes("혁신동") ||
          item.stationName.includes("노송동") ||
          item.stationName.includes("전주")
        ) || items[0]; // 검색 실패 시 첫 번째 관측소(전북 지역) 데이터라도 반환
        
        if (jeonju) {
          const pm10 = parseInt(jeonju.pm10Value) || 25;
          const pm25 = parseInt(jeonju.pm25Value) || 15;
          
          // 국내 기준 (KR)
          let krStatus = "보통";
          if (pm10 <= 30) krStatus = "좋음";
          else if (pm10 <= 80) krStatus = "보통";
          else if (pm10 <= 150) krStatus = "나쁨";
          else krStatus = "매우나쁨";

          // WHO 기준 (WHO)
          let whoStatus = "보통";
          if (pm10 <= 20) whoStatus = "좋음";
          else if (pm10 <= 50) whoStatus = "보통";
          else if (pm10 <= 100) whoStatus = "나쁨";
          else whoStatus = "매우나쁨";

          // 시간 포맷팅 (2026-03-27 22:00 -> 2026.03.27 22:00)
          const fUpdate = jeonju.dataTime ? jeonju.dataTime.replace(/-/g, '.') : "";

          airQuality = { 
            dust: `${pm10}µg/m³`, 
            pm10: pm10,
            pm25: pm25,
            o3: parseFloat(jeonju.o3Value),
            no2: parseFloat(jeonju.no2Value),
            co: parseFloat(jeonju.coValue),
            so2: parseFloat(jeonju.so2Value),
            khai: parseInt(jeonju.khaiValue),
            kr: krStatus,
            who: whoStatus,
            station: jeonju.stationName,
            lastUpdate: fUpdate
          };
          cachedAir = airQuality;
          lastAirTime = now;
        }
      }
    } catch (e) { console.error("AirKorea Fetch Error:", e); }
  }

  // 3. 자외선 지수(UV) 데이터 추가 (KMA 생활기상지수)
  let uvIndex = "보통";
  try {
    const today = new Date();
    const dateStr = today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
    const hourStr = String(today.getHours()).padStart(2, '0');
    // 자외선 지수는 매일 아침/오후 특정 시간에 발표되므로 가장 최근 시간 활용
    const uvUrl = `https://apis.data.go.kr/1360000/LivingWthrIdxServiceV4/getUVIdxV4?serviceKey=${airKey}&dataType=JSON&areaNo=4511000000&time=${dateStr}${hourStr}`;
    const uvRes = await fetch(uvUrl);
    if (uvRes.ok) {
      const uvData = await uvRes.json();
      const uvVal = parseInt(uvData.response?.body?.items?.item?.[0]?.h0);
      if (!isNaN(uvVal)) {
        if (uvVal <= 2) uvIndex = "낮음";
        else if (uvVal <= 5) uvIndex = "보통";
        else if (uvVal <= 7) uvIndex = "높음";
        else if (uvVal <= 10) uvIndex = "매우높음";
        else uvIndex = "위험";
      }
    }
  } catch (e) { console.error("UV Fetch Error:", e); }

  // 최종 결과 반환
  if (!weatherData || !airQuality) {
    return NextResponse.json({ error: "Failed to fetch data from sources" }, { status: 503 });
  }

  // 점수 계산 및 멘트 선정 (생략 - 기존 로직 유지)
  let score = 100;
  if (weatherData.temp < 18) score -= (18 - weatherData.temp) * 3;
  else if (weatherData.temp > 24) score -= (weatherData.temp - 24) * 4;
  if (airQuality.pm10 > 30) score -= (airQuality.pm10 - 30) * 0.6;
  if (airQuality.pm10 > 80) score -= 20;
  if (weatherData.pty > 0) score = 35;
  if (weatherData.humidity > 65) score -= (weatherData.humidity - 65) * 0.3;
  if (weatherData.wind > 4) score -= (weatherData.wind - 4) * 5;
  score = Math.max(10, Math.min(100, Math.round(score)));

  let statusKey = "status_good";
  let messageKey = "msg_good";
  if (score >= 86) { statusKey = "status_excellent"; messageKey = "msg_excellent"; }
  else if (score >= 66) { statusKey = "status_good"; messageKey = "msg_good"; }
  else if (score >= 36) { statusKey = "status_fair"; messageKey = "msg_fair"; }
  else { statusKey = "status_poor"; messageKey = "msg_poor"; }

  const variations = ["", "_1", "_2", "_3", "_4"];
  messageKey = messageKey + variations[Math.floor(Math.random() * variations.length)];

  return NextResponse.json({
    score,
    status: statusKey,
    message: messageKey,
    details: {
      ...weatherData,
      ...airQuality,
      uv: uvIndex,
    },
    metadata: {
      dataSource: "기상청, 한국환경공단",
      station: airQuality.station,
      lastUpdate: { kma: weatherData.lastUpdate, air: airQuality.lastUpdate },
      intervals: { kma: "매시 45분", air: "매시 정각" }
    }
  });
}
