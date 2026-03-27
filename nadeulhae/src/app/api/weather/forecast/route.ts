import { NextResponse } from "next/server";

// 서버사이드 캐싱 (1시간 기준)
let cachedForecast: any = null;
let lastForecastTime: number = 0;
const CACHE_DURATION = 60 * 1000 * 30; // 30분으로 단축

export async function GET() {
  const now = Date.now();
  if (cachedForecast && (now - lastForecastTime < CACHE_DURATION)) {
    return NextResponse.json(cachedForecast);
  }

  const kmaKey = process.env.KMA_API_KEY;
  const airKey = process.env.AIRKOREA_API_KEY; // Public Data Portal key
  
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
    
    // 중기예보 기준 시각 (06시, 18시)
    let tmFc = `${baseDate}1800`;
    if (h < 6) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(yesterday);
      tmFc = `${yStr.find(p => p.type === 'year')?.value}${yStr.find(p => p.type === 'month')?.value}${yStr.find(p => p.type === 'day')?.value}1800`;
    } else if (h < 18) {
      tmFc = `${baseDate}0600`;
    }

    // URL 정의 (최대한 안정적인 apihub 우선 사용)
    const vUrl = `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst?authKey=${kmaKey}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${baseDate}&base_time=0500&nx=63&ny=89`;
    const mlUrl = `https://apihub.kma.go.kr/api/typ02/openApi/MidFcstInfoService/getMidLandFcst?authKey=${kmaKey}&pageNo=1&numOfRows=10&dataType=JSON&regId=11F00000&tmFc=${tmFc}`;
    const mtUrl = `https://apihub.kma.go.kr/api/typ02/openApi/MidFcstInfoService/getMidTa?authKey=${kmaKey}&pageNo=1&numOfRows=10&dataType=JSON&regId=11G00201&tmFc=${tmFc}`;

    const safeFetch = async (url: string) => {
      try {
        const res = await fetch(url);
        const text = await res.text();
        if (text.trim().startsWith("<")) return null;
        return JSON.parse(text);
      } catch (e) { return null; }
    };

    const [vRes, mlRes, mtRes] = await Promise.all([
      safeFetch(vUrl),
      safeFetch(mlUrl),
      safeFetch(mtUrl)
    ]);

    const dailyForecasts: any[] = [];
    const dailyMap: Record<string, any> = {};

    // 1. 단기예보 파싱 (0~2일)
    if (vRes?.response?.body?.items?.item) {
      const items = vRes.response.body.items.item;
      const itemList = Array.isArray(items) ? items : [items];
      itemList.forEach((item: any) => {
        const date = item.fcstDate;
        if (!dailyMap[date]) dailyMap[date] = { temps: [], skies: [], ptys: [] };
        if (item.category === "TMP") dailyMap[date].temps.push(parseFloat(item.fcstValue));
        if (item.category === "SKY") dailyMap[date].skies.push(parseInt(item.fcstValue));
        if (item.category === "PTY") dailyMap[date].ptys.push(parseInt(item.fcstValue));
      });

      Object.keys(dailyMap).sort().forEach(date => {
        const data = dailyMap[date];
        if (data.temps.length > 0) {
          const maxT = Math.max(...data.temps);
          const minT = Math.min(...data.temps);
          const pty = Math.max(...data.ptys);
          let skyText = pty > 0 ? (pty === 3 ? "눈" : "비") : 
                       (data.skies.reduce((a:number, b:number) => a+b, 0)/data.skies.length <= 1.5 ? "맑음" : "흐림");
          dailyForecasts.push({ date, tempMin: minT, tempMax: maxT, sky: skyText, score: calculateScore(maxT, skyText) });
        }
      });
    }

    // 2. 중기예보 파싱 (3~10일)
    if (mlRes && mtRes) {
      const mlItems = mlRes.response?.body?.items?.item;
      const mtItems = mtRes.response?.body?.items?.item;
      const ml = Array.isArray(mlItems) ? mlItems[0] : mlItems;
      const mt = Array.isArray(mtItems) ? mtItems[0] : mtItems;

      if (ml && mt) {
        for (let i = 3; i <= 10; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().split('T')[0].replace(/-/g, '');
          if (dailyForecasts.some(df => df.date === dateStr)) continue;

          const sky = ml[`wf${i}Am`] || ml[`wf${i}`] || ml[`wf${i}Pm`] || "맑음";
          const minT = mt[`taMin${i}`];
          const maxT = mt[`taMax${i}`];

          if (minT !== undefined && maxT !== undefined) {
             dailyForecasts.push({
               date: dateStr,
               tempMin: parseFloat(String(minT)),
               tempMax: parseFloat(String(maxT)),
               sky: String(sky),
               score: calculateScore(parseFloat(String(maxT)), String(sky))
             });
          }
        }
      }
    }

    // 3. 데이터가 부족할 경우 더미 데이터로 11일 채우기 (사용자 경험 보장)
    if (dailyForecasts.length < 11) {
      const startDay = dailyForecasts.length > 0 ? 
                       new Date(dailyForecasts[dailyForecasts.length-1].date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')) :
                       new Date(today);
      if (dailyForecasts.length > 0) startDay.setDate(startDay.getDate() + 1);

      while (dailyForecasts.length < 11) {
        const dateStr = startDay.toISOString().split('T')[0].replace(/-/g, '');
        const tempBase = 15 + Math.floor(Math.random() * 5);
        dailyForecasts.push({
          date: dateStr,
          tempMin: tempBase - 5,
          tempMax: tempBase + 5,
          sky: ["맑음", "구름많음", "맑음", "흐림", "맑음"][Math.floor(Math.random() * 5)],
          score: 70 + Math.floor(Math.random() * 20),
          isMock: true
        });
        startDay.setDate(startDay.getDate() + 1);
      }
    }

    const finalResult = {
      location: "전주",
      daily: dailyForecasts.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 11),
      metadata: {
        dataSource: "기상청",
        lastUpdate: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
        info: dailyForecasts.some(d => d.isMock) ? "Partial data generated" : "Real-time sync"
      }
    };

    cachedForecast = finalResult;
    lastForecastTime = now;
    return NextResponse.json(finalResult);

  } catch (error) {
    console.error("Forecast Error:", error);
    return NextResponse.json({ error: "External Data Timeout" }, { status: 504 });
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
