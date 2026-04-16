import { NextRequest, NextResponse } from "next/server"
import { withApiAnalytics } from "@/lib/analytics/route"

type HazardType = "typhoon" | "tsunami" | "volcano"

function getContentType(headers: Headers) {
  return headers.get("content-type") || "image/png"
}

function parseCoordinate(value: string | null, min: number, max: number) {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed < min || parsed > max) return null
  return parsed
}

function parseMagnitude(value: string | null) {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed < 0 || parsed > 10) return null
  return parsed
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatEarthquakeTime(value: string | null) {
  if (!value) return "time unknown"
  const compact = value.replace(/\D/g, "")
  if (compact.length < 12) return "time unknown"
  const yyyy = compact.slice(0, 4)
  const mm = compact.slice(4, 6)
  const dd = compact.slice(6, 8)
  const hh = compact.slice(8, 10)
  const mi = compact.slice(10, 12)
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`
}

function parseHazardType(value: string | null): HazardType | null {
  if (value === "typhoon" || value === "tsunami" || value === "volcano") {
    return value
  }
  return null
}

function toCompactTimestamp(value: string | null) {
  if (!value) return ""
  return value.replace(/\D/g, "").slice(0, 14)
}

function buildHazardSvg(input: {
  type: HazardType
  title: string
  note: string
  timeLabel: string
}) {
  const width = 1200
  const height = 675
  const configByType: Record<HazardType, {
    heading: string
    bgStart: string
    bgEnd: string
    accent: string
    glow: string
    subtitle: string
    badge: string
  }> = {
    typhoon: {
      heading: "Typhoon Monitoring",
      bgStart: "#071a3a",
      bgEnd: "#0d2d63",
      accent: "#6fc6ff",
      glow: "#7fd3ff",
      subtitle: "Tropical cyclone bulletin based snapshot",
      badge: "TYPHOON",
    },
    tsunami: {
      heading: "Tsunami Monitoring",
      bgStart: "#052235",
      bgEnd: "#045a79",
      accent: "#7fe6ff",
      glow: "#9ff0ff",
      subtitle: "Tsunami warning bulletin based snapshot",
      badge: "TSUNAMI",
    },
    volcano: {
      heading: "Volcano Monitoring",
      bgStart: "#2b110b",
      bgEnd: "#5f1a0f",
      accent: "#ffb77e",
      glow: "#ffd8b1",
      subtitle: "Volcanic ash advisory bulletin based snapshot",
      badge: "VOLCANO",
    },
  }
  const config = configByType[input.type]
  const safeTitle = escapeSvgText(input.title || `${config.badge} alert`)
  const safeNote = escapeSvgText(input.note || "latest official bulletin captured")

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${config.heading}">
  <defs>
    <linearGradient id="hazardBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${config.bgStart}"/>
      <stop offset="100%" stop-color="${config.bgEnd}"/>
    </linearGradient>
    <radialGradient id="hazardGlow" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="${config.glow}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${config.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#hazardBg)"/>
  <rect x="60" y="70" width="1080" height="520" rx="34" fill="#06101d" fill-opacity="0.32" stroke="${config.accent}" stroke-opacity="0.38"/>
  <ellipse cx="930" cy="340" rx="250" ry="210" fill="url(#hazardGlow)"/>

  <g>
    <rect x="92" y="102" width="190" height="40" rx="20" fill="${config.accent}" fill-opacity="0.2" stroke="${config.accent}" stroke-opacity="0.75"/>
    <text x="188" y="128" text-anchor="middle" fill="${config.glow}" font-size="16" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif" font-weight="700">${config.badge}</text>
  </g>

  <text x="92" y="188" fill="#f5faff" font-size="46" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif" font-weight="800">${config.heading}</text>
  <text x="92" y="222" fill="${config.accent}" font-size="20" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif">${config.subtitle}</text>

  <g>
    <rect x="92" y="266" width="1016" height="214" rx="22" fill="#02060f" fill-opacity="0.34" stroke="${config.accent}" stroke-opacity="0.25"/>
    <text x="120" y="322" fill="#ffffff" font-size="34" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif" font-weight="700">${safeTitle}</text>
    <text x="120" y="372" fill="#deedff" font-size="23" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif">${safeNote}</text>
  </g>

  <g>
    <rect x="92" y="515" width="1016" height="58" rx="14" fill="#02060f" fill-opacity="0.34" stroke="${config.accent}" stroke-opacity="0.25"/>
    <text x="120" y="550" fill="#cde4ff" font-size="20" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif">Issued: ${escapeSvgText(input.timeLabel)}</text>
    <text x="1080" y="550" text-anchor="end" fill="${config.accent}" font-size="18" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif" font-weight="700">Nadeulhae Hazard Snapshot</text>
  </g>
</svg>`
}

function buildEarthquakeSvg(input: {
  lat: number | null
  lon: number | null
  magnitude: number | null
  location: string
  timeLabel: string
}) {
  const width = 1200
  const height = 675
  const panelX = 74
  const panelY = 92
  const panelWidth = width - panelX * 2
  const panelHeight = height - 240
  const hasCoordinates = input.lat != null && input.lon != null
  const minLat = 32.0
  const maxLat = 39.5
  const minLon = 124.0
  const maxLon = 132.5
  const normalizedX = hasCoordinates
    ? ((input.lon! - minLon) / (maxLon - minLon))
    : 0.5
  const normalizedY = hasCoordinates
    ? (1 - (input.lat! - minLat) / (maxLat - minLat))
    : 0.52
  const markerX = panelX + Math.max(0.02, Math.min(0.98, normalizedX)) * panelWidth
  const markerY = panelY + Math.max(0.04, Math.min(0.96, normalizedY)) * panelHeight
  const locationLabel = input.location ? escapeSvgText(input.location.slice(0, 80)) : "location unavailable"
  const magnitudeLabel = input.magnitude != null ? `M ${input.magnitude.toFixed(1)}` : "M -.-"
  const coordinateLabel = hasCoordinates
    ? `${input.lat!.toFixed(3)}N, ${input.lon!.toFixed(3)}E`
    : "coordinates unavailable"

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Earthquake epicenter">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1220"/>
      <stop offset="100%" stop-color="#172a46"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#11243c"/>
      <stop offset="100%" stop-color="#0f1d33"/>
    </linearGradient>
    <radialGradient id="pulse" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ff6b35" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#ff6b35" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="${panelX}" y="${panelY}" width="${panelWidth}" height="${panelHeight}" rx="28" fill="url(#panel)" stroke="#4f74a4" stroke-opacity="0.35"/>

  <g stroke="#7ea5d6" stroke-opacity="0.22" stroke-width="1">
    <line x1="${panelX}" y1="${panelY + panelHeight * 0.25}" x2="${panelX + panelWidth}" y2="${panelY + panelHeight * 0.25}"/>
    <line x1="${panelX}" y1="${panelY + panelHeight * 0.5}" x2="${panelX + panelWidth}" y2="${panelY + panelHeight * 0.5}"/>
    <line x1="${panelX}" y1="${panelY + panelHeight * 0.75}" x2="${panelX + panelWidth}" y2="${panelY + panelHeight * 0.75}"/>
    <line x1="${panelX + panelWidth * 0.25}" y1="${panelY}" x2="${panelX + panelWidth * 0.25}" y2="${panelY + panelHeight}"/>
    <line x1="${panelX + panelWidth * 0.5}" y1="${panelY}" x2="${panelX + panelWidth * 0.5}" y2="${panelY + panelHeight}"/>
    <line x1="${panelX + panelWidth * 0.75}" y1="${panelY}" x2="${panelX + panelWidth * 0.75}" y2="${panelY + panelHeight}"/>
  </g>

  <circle cx="${markerX}" cy="${markerY}" r="62" fill="url(#pulse)"/>
  <circle cx="${markerX}" cy="${markerY}" r="14" fill="#ff6b35" stroke="#ffe6d8" stroke-width="4"/>
  <line x1="${markerX - 34}" y1="${markerY}" x2="${markerX + 34}" y2="${markerY}" stroke="#ffd2bf" stroke-width="2"/>
  <line x1="${markerX}" y1="${markerY - 34}" x2="${markerX}" y2="${markerY + 34}" stroke="#ffd2bf" stroke-width="2"/>

  <text x="${panelX}" y="54" fill="#d8ecff" font-size="30" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif" font-weight="700">Earthquake Epicenter</text>
  <text x="${panelX}" y="80" fill="#9fb7d8" font-size="18" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif">Auto-rendered monitoring image from latest bulletin</text>

  <g>
    <rect x="${panelX}" y="${height - 112}" width="${panelWidth}" height="72" rx="14" fill="#0d1a2b" stroke="#5b7aa2" stroke-opacity="0.32"/>
    <text x="${panelX + 22}" y="${height - 80}" fill="#f8fbff" font-size="22" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif" font-weight="700">${escapeSvgText(magnitudeLabel)}</text>
    <text x="${panelX + 164}" y="${height - 80}" fill="#d5e6ff" font-size="20" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif">${locationLabel}</text>
    <text x="${panelX + 22}" y="${height - 54}" fill="#9bb4d6" font-size="16" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif">${escapeSvgText(coordinateLabel)} • ${escapeSvgText(input.timeLabel)}</text>
  </g>
</svg>`
}

async function handleGET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind")
  const tm = request.nextUrl.searchParams.get("tm")

  if (kind === "earthquake") {
    const lat = parseCoordinate(request.nextUrl.searchParams.get("lat"), -90, 90)
    const lon = parseCoordinate(request.nextUrl.searchParams.get("lon"), -180, 180)
    const magnitude = parseMagnitude(request.nextUrl.searchParams.get("mag"))
    const location = (request.nextUrl.searchParams.get("loc") || "").slice(0, 80)
    const timeLabel = formatEarthquakeTime(request.nextUrl.searchParams.get("tm"))
    const svg = buildEarthquakeSvg({
      lat,
      lon,
      magnitude,
      location,
      timeLabel,
    })

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=120",
      },
    })
  }

  if (kind === "hazard") {
    const type = parseHazardType(request.nextUrl.searchParams.get("type"))
    if (!type) {
      return NextResponse.json({ error: "Invalid hazard type" }, { status: 400 })
    }

    const title = (request.nextUrl.searchParams.get("title") || "").trim().slice(0, 120)
    const note = (request.nextUrl.searchParams.get("note") || "").trim().slice(0, 180)
    const compactTime = toCompactTimestamp(request.nextUrl.searchParams.get("tm"))
    const timeLabel = formatEarthquakeTime(compactTime || null)
    const svg = buildHazardSvg({
      type,
      title: title || `${type} alert`,
      note,
      timeLabel,
    })

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=120",
      },
    })
  }

  if ((kind !== "fog" && kind !== "dust") || !tm) {
    return NextResponse.json({ error: "Invalid asset request" }, { status: 400 })
  }

  if (!/^\d{12,14}$/.test(tm)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
  }

  const authKey = process.env.APIHUB_KEY || process.env.KMA_API_KEY
  if (!authKey) {
    return NextResponse.json({ error: "KMA auth key missing" }, { status: 500 })
  }

  const product = kind === "fog" ? "FOG" : "ADPS"
  const source = new URL(`https://apihub.kma.go.kr/api/typ05/api/GK2A/LE2/${product}/KO/image`)
  source.searchParams.set("date", tm)
  source.searchParams.set("authKey", authKey)

  try {
    const upstream = await fetch(source.toString(), {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Nadeulhae/1.0)",
      },
    })

    if (!upstream.ok) {
      return NextResponse.json({ error: "Failed to fetch remote image" }, { status: upstream.status })
    }

    const contentType = getContentType(upstream.headers)
    const bytes = await upstream.arrayBuffer()

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=300",
      },
    })
  } catch {
    return NextResponse.json({ error: "Asset proxy failed" }, { status: 502 })
  }
}

export const GET = withApiAnalytics(handleGET)
