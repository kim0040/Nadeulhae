/**
 * Next.js middleware proxy for rate limiting, security headers, and static caching.
 *
 * ## Rate limiting (in-memory, two categories)
 * - **General API**: 60 requests per minute per client IP (sliding window)
 * - **Auth mutations**: 20 requests per minute per IP (tighter to deter brute-force)
 * Both use Maps stored in module scope and are reset on deployment.
 *
 * ## Periodic pruning
 * A `setInterval` (5-minute, `unref`-ed so it doesn't block process exit) cleans
 * stale entries older than 5× the window duration from both rate-limit maps.
 *
 * ## Security headers
 * Applied to ALL responses. Includes a Content-Security-Policy with `'self'` origin
 * and `'unsafe-eval'`/`'unsafe-inline'` for Next.js/CodeMirror compatibility.
 * `X-XSS-Protection: 0` is set because CSP's `script-src` provides stronger protection.
 *
 * ## Static asset caching
 * - **Static prefixes** (/_next/static/, /fonts/, etc.): 1-hour `stale-while-revalidate`
 * - **Immutable extensions** (.js, .css, .woff2, etc.): 1-year immutable (fingerprinted assets)
 *
 * ## IP extraction
 * Uses only the explicitly configured, proxy-overwritten trusted IP header
 * (default: `X-Real-IP`). When `TRUST_PROXY_HEADERS` is falsy, ALL requests
 * use the conservative `"anonymous"` bucket.
 */
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getTrustedClientIp } from "@/lib/request/client-ip"

/** Maximum entries in each rate-limit Map. Beyond this, LRU eviction kicks in. */
const MAX_RATE_LIMIT_ENTRIES = 10_000
const IS_PRODUCTION = process.env.NODE_ENV === "production"

const rateLimitMap = new Map<string, { count: number; lastReset: number }>()
const authRateLimitMap = new Map<string, { count: number; lastReset: number }>()

/** General API: max 60 requests per minute per IP. */
const LIMIT = 60
const WINDOW = 60 * 1000

/** Auth mutations (login, register, logout): max 20 requests per minute per IP. Tighter to deter brute-force. */
const AUTH_LIMIT = 20
const AUTH_WINDOW = 60 * 1000

const KAKAO_SCRIPT_SOURCES = [
  "https://dapi.kakao.com",
  "https://*.daumcdn.net",
  "https://*.kakaocdn.net",
  ...(!IS_PRODUCTION ? [
    "http://dapi.kakao.com",
    "http://*.daumcdn.net",
    "http://*.kakaocdn.net",
  ] : []),
]

const KAKAO_STYLE_SOURCES = [
  "https://*.daumcdn.net",
  ...(!IS_PRODUCTION ? ["http://*.daumcdn.net"] : []),
]

const KAKAO_IMAGE_SOURCES = [
  "https://*.daumcdn.net",
  "https://*.kakaocdn.net",
  "https://*.kakao.com",
  ...(!IS_PRODUCTION ? [
    "http://*.daumcdn.net",
    "http://*.kakaocdn.net",
    "http://*.kakao.com",
  ] : []),
]

const KAKAO_CONNECT_SOURCES = [
  "https://dapi.kakao.com",
  "https://*.kakaocdn.net",
  "https://*.daumcdn.net",
  ...(!IS_PRODUCTION ? [
    "http://dapi.kakao.com",
    "http://*.kakaocdn.net",
    "http://*.daumcdn.net",
    "ws://localhost:3000",
    "ws://127.0.0.1:3000",
  ] : []),
]

/**
 * Two-phase prune: first remove entries older than 5× the window, then
 * if still over max, evict oldest by insertion order.
 */
function pruneMapIfOverSize(map: Map<string, { count: number; lastReset: number }>, maxSize: number, now: number) {
  for (const [key, value] of map.entries()) {
    if (now - value.lastReset > WINDOW * 5) {
      map.delete(key)
    }
  }
  if (map.size <= maxSize) return
  const overflow = map.size - maxSize
  let removed = 0
  for (const key of map.keys()) {
    map.delete(key)
    removed++
    if (removed >= overflow) break
  }
}

/**
 * Periodic cleanup timer for both rate-limit Maps.
 * Runs every 5 minutes, removing entries that haven't been used in 5× window.
 * Timer is `.unref()`-ed so it doesn't prevent the Node.js process from exiting
 * (important for graceful shutdowns and test runners).
 */
let __rateLimitPruneTimer: ReturnType<typeof setInterval> | undefined

function ensurePeriodicPruning() {
  if (__rateLimitPruneTimer) return
  __rateLimitPruneTimer = setInterval(() => {
    const now = Date.now()
    const windowMs = WINDOW * 5
    for (const [key, value] of rateLimitMap.entries()) {
      if (now - value.lastReset > windowMs) rateLimitMap.delete(key)
    }
    for (const [key, value] of authRateLimitMap.entries()) {
      if (now - value.lastReset > windowMs) authRateLimitMap.delete(key)
    }
  }, 300_000) // every 5 minutes
  // Allow Node.js to exit even if the timer is still active
  if (__rateLimitPruneTimer && typeof __rateLimitPruneTimer === "object" && "unref" in __rateLimitPruneTimer) {
    __rateLimitPruneTimer.unref()
  }
}

function getClientKey(request: NextRequest) {
  return getTrustedClientIp(request.headers)
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Content-Security-Policy": [
    "default-src 'self'",
    `script-src 'self' 'unsafe-eval' 'unsafe-inline' ${KAKAO_SCRIPT_SOURCES.join(" ")}`,
    `style-src 'self' 'unsafe-inline' ${KAKAO_STYLE_SOURCES.join(" ")}`,
    `img-src 'self' data: blob: https://www.weather.go.kr https://vapi.kma.go.kr https://apihub.kma.go.kr ${KAKAO_IMAGE_SOURCES.join(" ")}`,
    `font-src 'self' ${KAKAO_STYLE_SOURCES.join(" ")}`,
    `connect-src 'self' https://www.weather.go.kr https://vapi.kma.go.kr https://apihub.kma.go.kr https://apis.data.go.kr wss://nadeulhae.space wss://www.nadeulhae.space ${KAKAO_CONNECT_SOURCES.join(" ")}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(IS_PRODUCTION ? ["upgrade-insecure-requests"] : []),
  ].join("; ") + ";",
}

const STATIC_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=600",
}

const IMMUTABLE_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "public, max-age=31536000, immutable",
}

const STATIC_PREFIXES = [
  "/_next/static/",
  "/fonts/",
  "/icons/",
  "/favicon",
  "/apple-touch-icon",
  "/android-chrome",
  "/mstile",
  "/safari-pinned-tab",
  "/manifest.json",
  "/sw.js",
  "/workbox",
]

const IMMUTABLE_EXTENSIONS = [
  ".js",
  ".css",
  ".woff2",
  ".woff",
  ".ttf",
  ".otf",
  ".eot",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
  ".ico",
]

export function proxy(request: NextRequest) {
  ensurePeriodicPruning()
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/api")) {
    const ip = getClientKey(request)
    const now = Date.now()
    const isAuthMutation = pathname.startsWith("/api/auth/") && request.method !== "GET"

    if (isAuthMutation) {
      const authRateData = authRateLimitMap.get(ip) || { count: 0, lastReset: now }

      if (now - authRateData.lastReset > AUTH_WINDOW) {
        authRateData.count = 0
        authRateData.lastReset = now
      }

      authRateData.count++
      authRateLimitMap.set(ip, authRateData)
      pruneMapIfOverSize(authRateLimitMap, MAX_RATE_LIMIT_ENTRIES, now)

      if (authRateData.count > AUTH_LIMIT) {
        return new NextResponse(
          JSON.stringify({ error: "Too many auth requests. Please try again later." }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", ...SECURITY_HEADERS },
          }
        )
      }
    }

    const rateData = rateLimitMap.get(ip) || { count: 0, lastReset: now }

    if (now - rateData.lastReset > WINDOW) {
      rateData.count = 0
      rateData.lastReset = now
    }

    rateData.count++
    rateLimitMap.set(ip, rateData)
    pruneMapIfOverSize(rateLimitMap, MAX_RATE_LIMIT_ENTRIES, now)

    if (rateData.count > LIMIT) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...SECURITY_HEADERS },
        }
      )
    }

    const response = NextResponse.next()
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(key, value)
    }

    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  }

  const response = NextResponse.next()

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }

  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (IS_PRODUCTION) {
      for (const [key, value] of Object.entries(STATIC_CACHE_HEADERS)) {
        response.headers.set(key, value)
      }
    } else {
      response.headers.set("Cache-Control", "no-store, max-age=0")
    }
    return response
  }

  if (IMMUTABLE_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
    if (IS_PRODUCTION) {
      for (const [key, value] of Object.entries(IMMUTABLE_CACHE_HEADERS)) {
        response.headers.set(key, value)
      }
    } else {
      response.headers.set("Cache-Control", "no-store, max-age=0")
    }
    return response
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/image|_next/data).*)"],
}
