import { NextRequest, NextResponse } from "next/server"
import { withApiAnalytics } from "@/lib/analytics/route"

function getContentType(headers: Headers) {
  return headers.get("content-type") || "image/png"
}

async function handleGET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind")
  const tm = request.nextUrl.searchParams.get("tm")

  if ((kind !== "fog" && kind !== "dust") || !tm) {
    return NextResponse.json({ error: "Invalid asset request" }, { status: 400 })
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
