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
      let year = findPart('year'), month = findPart('month'), day = findPart('day'), hour = findPart('hour');
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
        weatherData = {
          temp: parseFloat(map["T1H"]),
          humidity: parseFloat(map["REH"]),
          wind: parseFloat(map["WSD"]),
          pty: parseInt(map["PTY"])
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
        const jeonju = items.find((item: any) => item.stationName.includes("전주") || item.stationName.includes("노송"));
        if (jeonju) {
          const pm10 = parseInt(jeonju.pm10Value) || 25;
          
          // 국내 기준 (KR)
          let krStatus = "보통";
          if (pm10 <= 30) krStatus = "좋음";
          else if (pm10 <= 80) krStatus = "보통";
          else if (pm10 <= 150) krStatus = "나쁨";
          else krStatus = "매우나쁨";

          // 국제 기준 (WHO)
          let whoStatus = "보통";
          if (pm10 <= 20) whoStatus = "좋음";
          else if (pm10 <= 50) whoStatus = "보통";
          else if (pm10 <= 100) whoStatus = "나쁨";
          else whoStatus = "매우나쁨";

          airQuality = { 
            dust: `${pm10}µg/m³ (국내: ${krStatus} / WHO: ${whoStatus})`, 
            value: pm10,
            kr: krStatus,
            who: whoStatus
          };
          cachedAir = airQuality;
          lastAirTime = now;
        }
      }
    } catch (e) { console.error("AirKorea Fetch Error:", e); }
  }

  // 최종 점수 계산 (weatherData와 airQuality가 있을 때만)
  if (!weatherData || !airQuality) {
    return NextResponse.json({ error: "Failed to fetch data from sources" }, { status: 503 });
  }

  // [Picnic Score Algorithm]
  let score = 100;
  if (weatherData.temp < 18) score -= (18 - weatherData.temp) * 3;
  else if (weatherData.temp > 24) score -= (weatherData.temp - 24) * 4;
  if (airQuality.value > 30) score -= (airQuality.value - 30) * 0.6;
  if (airQuality.value > 80) score -= 20;
  if (weatherData.pty > 0) score = 35;
  if (weatherData.humidity > 65) score -= (weatherData.humidity - 65) * 0.3;
  if (weatherData.wind > 4) score -= (weatherData.wind - 4) * 5;
  score = Math.max(10, Math.min(100, Math.round(score)));

  let status = "좋음", message = "산책하기 좋은 날씨예요!";
  if (weatherData.pty > 0) { status = "나쁨"; message = "비나 눈이 와요. 실내 활동을 추천합니다."; }
  else if (score >= 90) { status = "완벽함"; message = "오늘 전주 날씨는 피크닉 가기에 완벽합니다!"; }
  else if (score >= 70) { status = "좋음"; message = "날씨가 꽤 괜찮아요. 나들이 가기 좋겠어요."; }
  else if (score >= 50) { status = "보통"; message = "야외 활동은 가능하지만, 준비물이 필요할 수 있어요."; }
  else { status = "나쁨"; message = "날씨가 야외 나들이에 적합하지 않은 것 같네요."; }

  const lastUpdateTime = new Date(Math.max(lastKmaTime, lastAirTime)).toLocaleTimeString("ko-KR", { 
    timeZone: "Asia/Seoul", 
    hour: "2-digit", 
    minute: "2-digit" 
  });

  return NextResponse.json({
    score,
    status,
    message,
    details: {
      temp: weatherData.temp,
      humidity: weatherData.humidity,
      wind: weatherData.wind,
      dust: airQuality.dust,
      uv: "보통",
    },
    metadata: {
      dataSource: "기상청, 한국환경공단",
      lastUpdate: lastUpdateTime,
      intervals: { kma: "1m", air: "10m" }
    }
  });
}
