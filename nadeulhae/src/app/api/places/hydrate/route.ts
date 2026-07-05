import { NextResponse } from "next/server"
import { queryRows } from "@/lib/db"
import type { RowDataPacket } from "mysql2"
import { withApiAnalytics } from "@/lib/analytics/route"

export const runtime = "nodejs"

interface PlaceRow extends RowDataPacket {
  name: string
  category: string
  lat: number | null
  lon: number | null
  address: string | null
  rating: number | null
  kakao_url: string | null
  menu_summary: string | null
  review_summary: string | null
  review_keywords: string | null
  review_picks: string | null
}

async function handlePOST(request: Request) {
  try {
    const body = await request.json()
    const { names } = body ?? {}

    if (!Array.isArray(names) || names.length === 0) {
      return NextResponse.json({ places: [] })
    }

    // Query the database for these exact place names.
    // Limit to 30 to prevent huge requests, although standard courses have 2-5 places.
    const uniqueNames = Array.from(new Set(names.filter(Boolean).map((n: unknown) => String(n)))).slice(0, 30)
    if (uniqueNames.length === 0) {
      return NextResponse.json({ places: [] })
    }

    // The LLM's place names often drift slightly from the DB (extra/missing
    // spaces, casing). Match on the exact name OR on a whitespace-stripped
    // form so near-miss names still hydrate (otherwise the card/map/route
    // silently render empty). The whitespace-stripped variants are compared
    // case-insensitively via the column collation.
    const strippedNames = Array.from(
      new Set(uniqueNames.map((n) => n.replace(/\s+/g, "")).filter(Boolean))
    )
    const exactPlaceholders = uniqueNames.map(() => "?").join(",")
    const strippedPlaceholders = strippedNames.map(() => "?").join(",")
    const sql = `
      SELECT name, category, lat, lon, address, rating, kakao_url, menu_summary, review_summary, review_keywords, review_picks
      FROM places
      WHERE name IN (${exactPlaceholders})
         OR REPLACE(name, ' ', '') IN (${strippedPlaceholders})
    `

    const rows = await queryRows<PlaceRow[]>(sql, [...uniqueNames, ...strippedNames])

    // Map database properties back to the client structure
    const hydrated = rows.map((r) => {
      let keywords: string[] = []
      let picks: string[] = []
      try {
        if (r.review_keywords) {
          keywords = JSON.parse(r.review_keywords)
        }
      } catch {}
      try {
        if (r.review_picks) {
          picks = JSON.parse(r.review_picks)
        }
      } catch {}

      return {
        name: r.name,
        category: r.category,
        lat: r.lat,
        lon: r.lon,
        address: r.address,
        rating: r.rating,
        kakaoUrl: r.kakao_url,
        menuSummary: r.menu_summary,
        reviewSummary: r.review_summary,
        reviewKeywords: keywords,
        reviewPicks: picks,
      }
    })

    return NextResponse.json({ places: hydrated }, {
      headers: { "x-nadeulhae-data-mode": "live" },
    })
  } catch (error) {
    console.error("[places-hydrate] Hydration API failed:", error)
    return NextResponse.json(
      { error: "Failed to hydrate places" },
      { status: 500 }
    )
  }
}

export const POST = withApiAnalytics(handlePOST)
