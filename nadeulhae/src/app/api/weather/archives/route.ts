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
  availableYears: number[];
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
const monthCache = new Map<string, { expiry: number; data: ArchiveResponse }>();
const dateCache = new Map<string, { expiry: number; data: unknown }>();
const MONTH_CACHE_TTL = 30 * 60 * 1000; // 30 min
const DATE_CACHE_TTL = 60 * 60 * 1000; // 1 hour (historical data never changes)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let cachedYears: number[] | null = null;
async function getAvailableYears(): Promise<number[]> {
  if (cachedYears) return cachedYears;
  try {
    const rows = await queryRows<{ year: number }[] & RowDataPacket[]>(
      "SELECT DISTINCT YEAR(date) as year FROM daily_weather_history ORDER BY year DESC"
    );
    cachedYears = rows.map((r) => r.year);
    if (cachedYears.length === 0) {
      cachedYears = [2021, 2022, 2023, 2024, 2025]; // fallback
    }
  } catch (error) {
    console.error("[db-archives] Failed to fetch available years dynamically:", error);
    cachedYears = [2021, 2022, 2023, 2024, 2025]; // fallback
  }
  return cachedYears;
}

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
  const availableYears = await getAvailableYears();

  // ---- Single-date detail endpoint ----
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const dateCacheKey = `date:${date}`;
    const dateCached = dateCache.get(dateCacheKey);
    if (dateCached && dateCached.expiry > Date.now()) {
      return NextResponse.json(dateCached.data);
    }

    // Year-over-year: same month-day across all years dynamically
    const [, m, d] = date.split("-").map(Number);
    
    // Construct index-friendly exact lookup dates
    const targetDates: string[] = [];
    for (const year of availableYears) {
      // Validate day exists in target year (handles leap years)
      const tempDate = new Date(year, m - 1, d);
      if (
        tempDate.getFullYear() === year &&
        tempDate.getMonth() === m - 1 &&
        tempDate.getDate() === d
      ) {
        targetDates.push(
          `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
        );
      }
    }

    if (targetDates.length === 0) {
      return NextResponse.json({
        date,
        entries: [],
        message: "해당 날짜의 기록이 없습니다.",
      });
    }

    // Primary key lookup - extremely fast (Point Lookup)
    const placeholders = targetDates.map(() => "?").join(", ");
    const rows = await queryRows<HistoryRow[]>(
      `SELECT * FROM daily_weather_history
       WHERE date IN (${placeholders})
       ORDER BY date DESC`,
      targetDates
    );

    const entries = rows.map((r) => ({
      date: typeof r.date === "string" ? r.date : new Date(r.date).toISOString().slice(0, 10),
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

    const payload = { date, entries, count: entries.length, availableYears };
    dateCache.set(dateCacheKey, {
      expiry: Date.now() + DATE_CACHE_TTL,
      data: payload,
    });
    return NextResponse.json(payload);
  }

  // ---- Month archive endpoint ----
  const monthCacheKey = `archives:${month}`;
  const monthCached = monthCache.get(monthCacheKey);
  if (monthCached && monthCached.expiry > Date.now()) {
    return NextResponse.json(monthCached.data);
  }

  try {
    // Range Scan query utilizing primary key index
    const startOfTargetMonth = `${month}-01`;
    const [yNum, mNum] = month.split("-").map(Number);
    const lastDay = new Date(yNum, mNum, 0).getDate();
    const endOfTargetMonth = `${month}-${String(lastDay).padStart(2, "0")}`;

    const rows = await queryRows<HistoryRow[]>(
      `SELECT date, score, status, knockout, avg_temp, min_temp, max_temp, cloud_cover
       FROM daily_weather_history
       WHERE date >= ? AND date <= ?
       ORDER BY date`,
      [startOfTargetMonth, endOfTargetMonth]
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
      availableYears,
      metadata: {
        dataSource: "기상청 ASOS 관측자료 (지점 146 · 전주)",
        lastUpdate: new Date().toISOString(),
        mode: "historical",
        coverage: `${Math.min(...availableYears)}-01 ~ ${Math.max(...availableYears)}-12`,
        note:
          rows.length === 0
            ? "해당 월의 과거 관측 데이터가 없습니다."
            : undefined,
      },
    };

    monthCache.set(monthCacheKey, {
      expiry: Date.now() + MONTH_CACHE_TTL,
      data: payload,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Archive API error:", error);
    return NextResponse.json({
      month,
      highlightedDays: [],
      daySummaries: [],
      availableYears,
      metadata: {
        dataSource: "기상청 ASOS",
        lastUpdate: "--:--",
        mode: "historical" as const,
        coverage: `${Math.min(...availableYears)}-01 ~ ${Math.max(...availableYears)}-12`,
        note: "데이터를 불러오지 못했습니다.",
      },
    });
  }
}

export const GET = withApiAnalytics(handleGET);
