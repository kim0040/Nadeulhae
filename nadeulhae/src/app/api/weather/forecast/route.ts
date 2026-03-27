import { NextResponse } from "next/server";

// 서버사이드 캐싱 (1시간 기준)
let cachedForecast: any = null;
let lastForecastTime: number = 0;
const CACHE_DURATION = 60 * 1000 * 60; // 1시간

export async function GET() {
  const now = Date.now();
  if (cachedForecast && (now - lastForecastTime < CACHE_DURATION)) {
    return NextResponse.json(cachedForecast);
  }

  const kmaKey = process.env.KMA_API_KEY;
  if (!kmaKey) return NextResponse.json({ error: "KMA Key Missing" }, { status: 500 });

  try {
    const today = new Date();
    const formatter = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false });
    const parts = formatter.formatToParts(today);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    const h = parseInt(parts.find(p => p.type === 'hour')?.value || "00");

    const baseDate = `${y}${m}${d}`;
    const baseTime = "0500"; // 05:00 예보가 가장 안정적
    
    // 중기예보 기준 시각 (06시, 18시)
    const tmFc = h >= 18 ? `${baseDate}1800` : `${baseDate}0600`;

    // 1. 단기예보 (3일치)
    const vUrl = `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst?authKey=${kmaKey}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=63&ny=89`;
    
    // 2. 중기육상예보 (3~10일) - 전북 지역(11F00000)
    const mlUrl = `https://apihub.kma.go.kr/api/typ02/openApi/MidFcstInfoService/getMidLandFcst?authKey=${kmaKey}&pageNo=1&numOfRows=10&dataType=JSON&regId=11F00000&tmFc=${tmFc}`;
    
    // 3. 중기기온예보 (3~10일) - 전주(11G00201)
    const mtUrl = `https://apihub.kma.go.kr/api/typ02/openApi/MidFcstInfoService/getMidTa?authKey=${kmaKey}&pageNo=1&numOfRows=10&dataType=JSON&regId=11G00201&tmFc=${tmFc}`;

    const [vRes, mlRes, mtRes] = await Promise.all([
      fetch(vUrl).then(r => r.json()),
      fetch(mlUrl).then(r => r.json()),
      fetch(mtUrl).then(r => r.json())
    ]);

    const dailyMap: Record<string, any> = {};

    // --- 단기예보 파싱 (0~2일) ---
    if (vRes.response?.body?.items?.item) {
      vRes.response.body.items.item.forEach((item: any) => {
        const date = item.fcstDate;
        if (!dailyMap[date]) dailyMap[date] = { temps: [], skies: [], ptys: [] };
        
        if (item.category === "TMP") dailyMap[date].temps.push(parseFloat(item.fcstValue));
        if (item.category === "SKY") dailyMap[date].skies.push(parseInt(item.fcstValue));
        if (item.category === "PTY") dailyMap[date].ptys.push(parseInt(item.fcstValue));
      });
    }

    const dailyForecasts = Object.keys(dailyMap).sort().map(date => {
      const data = dailyMap[date];
      const maxT = Math.max(...data.temps);
      const minT = Math.min(...data.temps);
      const pty = Math.max(...data.ptys); // 비 소식이 하나라도 있으면 체크
      
      let skyText = "맑음";
      const avgSky = data.skies.reduce((a:number, b:number) => a + b, 0) / data.skies.length;
      if (pty > 0) skyText = pty === 3 ? "눈" : "비";
      else if (avgSky <= 1.5) skyText = "맑음";
      else if (avgSky <= 3.5) skyText = "구름많음";
      else skyText = "흐림";

      return { date, tempMin: minT, tempMax: maxT, sky: skyText, score: calculateScore(maxT, skyText) };
    });

    // --- 중기예보 파싱 (3~10일) ---
    if (mlRes.response?.body?.items?.item && mtRes.response?.body?.items?.item) {
      const ml = mlRes.response.body.items.item[0];
      const mt = mtRes.response.body.items.item[0];

      for (let i = 3; i <= 10; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0].replace(/-/g, '');
        
        const sky = (ml[`wf${i}Am`] || ml[`wf${i}`] || "맑음");
        const minT = mt[`taMin${i}`];
        const maxT = mt[`taMax${i}`];

        if (minT !== undefined) {
           dailyForecasts.push({
             date: dateStr,
             tempMin: minT,
             tempMax: maxT,
             sky,
             score: calculateScore(maxT, sky)
           });
        }
      }
    }

    const finalResult = {
      location: "전주",
      daily: dailyForecasts.slice(0, 10),
      metadata: {
        dataSource: "기상청",
        lastUpdate: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
      }
    };

    cachedForecast = finalResult;
    lastForecastTime = now;
    return NextResponse.json(finalResult);

  } catch (e: any) {
    console.error("Forecast Error:", e);
    return NextResponse.json({ error: "Failed to parse KMA forecast" }, { status: 500 });
  }
}

function calculateScore(temp: number, sky: string) {
  let score = 80;
  if (temp < 15) score -= (15 - temp) * 3;
  if (temp > 28) score -= (temp - 28) * 4;
  if (sky.includes("비") || sky.includes("흐림")) score -= 30;
  if (sky.includes("눈")) score -= 40;
  if (sky === "맑음") score += 15;
  return Math.max(10, Math.min(100, score));
}
