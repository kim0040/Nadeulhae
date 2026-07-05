import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { queryRows } from "@/lib/db";
import { mockTrends } from "@/data/mockData";
import { withApiAnalytics } from "@/lib/analytics/route";

// This GET takes no request argument; without an explicit dynamic signal Next
// could statically evaluate/cache it once. force-dynamic keeps it request-time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TrendRow extends RowDataPacket {
  name: string;
}

// In-process cache — the ranking is stable, so we don't need to hit the DB on
// every request. Trends places change rarely (data is a batch import).
let trendsCache: { data: string[]; expiry: number } | null = null;
const TRENDS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function fetchTrendingPlaces(): Promise<string[]> {
  // Rank by a popularity score that balances rating (up to 10) against review
  // volume (up to ~6), so a single 5.0 review can't outrank a genuinely popular
  // spot. Only well-rated places with real review signal are considered.
  const rows = await queryRows<TrendRow[]>(
    `
      SELECT name
      FROM places
      WHERE name IS NOT NULL
        AND name <> ''
        AND rating IS NOT NULL
        AND rating >= 3.8
        AND review_count IS NOT NULL
        AND review_count >= 20
      ORDER BY (rating * 2 + LEAST(LOG10(review_count + 1) * 2, 6)) DESC, review_count DESC
      LIMIT 15
    `
  );
  return rows
    .map((r) => (typeof r.name === "string" ? r.name.trim() : ""))
    .filter((name) => name.length > 0);
}

async function handleGET() {
  const now = Date.now();
  if (trendsCache && trendsCache.expiry > now) {
    return NextResponse.json(trendsCache.data, {
      headers: { "x-nadeulhae-data-mode": "live" },
    });
  }

  try {
    const places = await fetchTrendingPlaces();
    // Guard against a thin/empty result (e.g. before the places table is
    // populated) by falling back to the curated list.
    if (places.length >= 6) {
      trendsCache = { data: places, expiry: now + TRENDS_CACHE_TTL_MS };
      return NextResponse.json(places, {
        headers: { "x-nadeulhae-data-mode": "live" },
      });
    }
  } catch (error) {
    console.error("[weather-trends] Failed to load trending places:", error);
  }

  return NextResponse.json(mockTrends, {
    headers: { "x-nadeulhae-data-mode": "fallback" },
  });
}

export const GET = withApiAnalytics(handleGET);
