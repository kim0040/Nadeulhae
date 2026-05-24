import { NextResponse } from "next/server";

import { withApiAnalytics } from "@/lib/analytics/route";
import { queryRows } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DaySummary {
  day: number;
  score: number;
  status: string;
  knockout: string;
  sky: string;
  tempMin: number;
  tempMax: number;
  avgTemp: number;
  isRecommended: boolean;
}

interface ArchiveResponse {
  month: string;
  highlightedDays: number[];
  daySummaries: DaySummary[];
  metadata: {
    dataSource: string;
    lastUpdate: string;
    mode: "historical";
    coverage: string;
    note?: string;
  };
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------
const cache = new Map<string, { expiry: number; data: ArchiveResponse }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 min (historical data never changes)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function normalizeMonth(input?: string | null) {
  if (typeof input === "string" && /^\d{4}-\d{2}$/.test(input)) return input;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function skyCodeToLabel(sky: number | null, cloudCover: number | null): string {
  if (sky != null) {
    if (sky === 1) return "맑음";
    if (sky === 3) return "구름많음";
    return "흐림";
  }
  if (cloudCover != null) {
    if (cloudCover <= 2) return "맑음";
    if (cloudCover <= 7) return "구름많음";
    return "흐림";
  }
  return "정보없음";
}

interface HistoryRow extends RowDataPacket {
  date: string;
  score: number;
  status: string;
  knockout: string;
  air_score: number;
  temp_score: number;
  sky_score: number;
  wind_score: number;
  avg_temp: number | null;
  min_temp: number | null;
  max_temp: number | null;
  avg_wind: number | null;
  max_wind: number | null;
  cloud_cover: number | null;
  daily_rain: number | null;
  sunshine_hours: number | null;
  avg_humidity: number | null;
  fog_hours: number | null;
  avg_pm10: number | null;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
async function handleGET(request: Request) {
  const url = new URL(request.url);
  const month = normalizeMonth(url.searchParams.get("month"));
  const date = url.searchParams.get("date");

  // ---- Single-date detail endpoint ----
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Year-over-year: same month-day across all years
    const [, m, d] = date.split("-").map(Number);
    const rows = await queryRows<HistoryRow[]>(
      `SELECT * FROM daily_weather_history
       WHERE MONTH(date) = ? AND DAY(date) = ?
       ORDER BY date DESC`,
      [m, d],
    );

    if (rows.length === 0) {
      return NextResponse.json({
        date,
        entries: [],
        message: "해당 날짜의 기록이 없습니다.",
      });
    }

    const entries = rows.map((r) => ({
      date: r.date,
      score: r.score,
      status: r.status,
      knockout: r.knockout,
      breakdown: {
        air: r.air_score,
        temperature: r.temp_score,
        sky: r.sky_score,
        wind: r.wind_score,
        total: r.score,
      },
      weather: {
        avgTemp: r.avg_temp,
        minTemp: r.min_temp,
        maxTemp: r.max_temp,
        sky: skyCodeToLabel(null, r.cloud_cover),
        avgWind: r.avg_wind,
        maxWind: r.max_wind,
        humidity: r.avg_humidity,
        rain: r.daily_rain,
        sunshine: r.sunshine_hours,
        fog: r.fog_hours,
        pm10: r.avg_pm10,
        cloudCover: r.cloud_cover,
      },
    }));

    return NextResponse.json({ date, entries, count: entries.length });
  }

  // ---- Month archive endpoint ----
  const cacheKey = `archives:${month}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const rows = await queryRows<HistoryRow[]>(
      `SELECT date, score, status, knockout, avg_temp, min_temp, max_temp, cloud_cover
       FROM daily_weather_history
       WHERE DATE_FORMAT(date, '%Y-%m') = ?
       ORDER BY date`,
      [month],
    );

    const highlightedDays: number[] = [];
    const daySummaries: DaySummary[] = [];

    for (const r of rows) {
      const day = new Date(r.date).getDate();
      const score = Number(r.score);
      const isRecommended = score >= 80;
      if (isRecommended) highlightedDays.push(day);

      daySummaries.push({
        day,
        score,
        status: r.status,
        knockout: r.knockout,
        sky: skyCodeToLabel(null, r.cloud_cover),
        tempMin: Number(r.min_temp ?? 0),
        tempMax: Number(r.max_temp ?? 0),
        avgTemp: Number(r.avg_temp ?? 0),
        isRecommended,
      });
    }

    const payload: ArchiveResponse = {
      month,
      highlightedDays,
      daySummaries,
      metadata: {
        dataSource: "기상청 ASOS 관측자료 (지점 146 · 전주)",
        lastUpdate: new Date().toISOString(),
        mode: "historical",
        coverage: "2021-01 ~ 2025-12",
        note:
          rows.length === 0
            ? "해당 월의 과거 관측 데이터가 없습니다."
            : undefined,
      },
    };

    cache.set(cacheKey, { expiry: Date.now() + CACHE_TTL, data: payload });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Archive API error:", error);
    return NextResponse.json({
      month,
      highlightedDays: [],
      daySummaries: [],
      metadata: {
        dataSource: "기상청 ASOS",
        lastUpdate: "--:--",
        mode: "historical" as const,
        coverage: "2021-01 ~ 2025-12",
        note: "데이터를 불러오지 못했습니다.",
      },
    });
  }
}

export const GET = withApiAnalytics(handleGET);
