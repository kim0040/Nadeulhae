import { NextRequest, NextResponse } from "next/server"
import { withApiAnalytics } from "@/lib/analytics/route"

export const runtime = "nodejs"

// Haversine distance in KM
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Heuristic fallback calculation
function calculateFallbackRoute(lat1: number, lon1: number, lat2: number, lon2: number) {
  const distanceKm = haversineKm(lat1, lon1, lat2, lon2)
  const distanceMeters = Math.round(distanceKm * 1000)
  
  let durationSeconds = 0
  if (distanceKm < 1.0) {
    // Walk: ~5km/h => 12 minutes per km => 720 seconds per km
    durationSeconds = Math.round(distanceKm * 720)
  } else {
    // Car: average 25km/h in city including signals => 144 seconds per km + 120s buffer
    durationSeconds = Math.round(distanceKm * 144) + 120
  }
  
  return {
    distanceMeters,
    durationSeconds,
    source: "fallback" as const
  }
}

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lat1, lon1, lat2, lon2 } = body ?? {}

    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
      return NextResponse.json({ error: "Missing coordinates" }, { status: 400 })
    }

    const nLat1 = Number(lat1)
    const nLon1 = Number(lon1)
    const nLat2 = Number(lat2)
    const nLon2 = Number(lon2)

    // 1. Get Kakao Key: prefer REST API Key for server-side REST calls, fallback to JS key
    const restKey = process.env.KAKAO_REST_KEY
    const jsKey = process.env.KAKAO_JS_KEY || "4643b10dc75bdd9048a7c9ef415ec074"
    const key = restKey || jsKey
    
    let origin = "http://localhost:3000"
    const host = request.headers.get("host") || ""
    const referer = request.headers.get("referer") || ""
    if (host.includes("127.0.0.1") || referer.includes("127.0.0.1")) {
      origin = "http://127.0.0.1:3000"
    }
    
    // 2. Prepare headers (satisfying origin requirements of JS key if fallback is used)
    const headers = {
      "Authorization": `KakaoAK ${key}`,
      "KA": `sdk/1.0.0 os/javascript lang/ko device/web origin/${origin}`,
      "Content-Type": "application/json"
    }

    // 3. Attempt to fetch real-time routes from Kakao Mobility Directions API
    // Note: Kakao Navi expects (longitude, latitude)
    const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${nLon1},${nLat1}&destination=${nLon2},${nLat2}&priority=RECOMMEND`

    try {
      const res = await fetch(url, {
        method: "GET",
        headers,
        next: { revalidate: 600 } // Cache results for 10 minutes to protect quota
      })

      if (res.ok) {
        const data = await res.json()
        
        if (Array.isArray(data?.routes) && data.routes.length > 0) {
          const route = data.routes[0]
          const summary = route.summary
          
          if (summary && typeof summary.distance === "number" && typeof summary.duration === "number") {
            console.log(`[kakao-directions] Live traffic route: ${summary.distance}m, ${summary.duration}s`)
            return NextResponse.json({
              distanceMeters: summary.distance,
              durationSeconds: summary.duration,
              source: "kakao"
            })
          }
        }
        
        // Handle explicit error code (like App disabled Map & Local)
        if (data?.code) {
          console.warn(`[kakao-directions] Kakao API error code ${data.code}: ${data.msg}. Falling back to heuristic.`)
        }
      } else {
        console.warn(`[kakao-directions] Kakao API response status ${res.status}. Falling back to heuristic.`)
      }
    } catch (apiErr) {
      console.warn("[kakao-directions] Network/API call failed. Falling back to heuristic:", apiErr)
    }

    // 4. Fallback gracefully if API fails or settings are disabled
    const fallback = calculateFallbackRoute(nLat1, nLon1, nLat2, nLon2)
    return NextResponse.json(fallback)
  } catch (error) {
    console.error("[kakao-directions] Fatal routing proxy error:", error)
    return NextResponse.json(
      { error: "Internal routing failure" },
      { status: 500 }
    )
  }
}

export const POST = withApiAnalytics(handlePOST)
