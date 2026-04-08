import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory rate limiter for demonstration/small scale
// For production with multiple instances, use Redis or similar.
const rateLimitMap = new Map<string, { count: number, lastReset: number }>()
const authRateLimitMap = new Map<string, { count: number, lastReset: number }>()
const TRUST_PROXY_HEADERS = /^(1|true|yes)$/i.test(
  process.env.TRUST_PROXY_HEADERS ?? ''
)

const LIMIT = 60 // 60 requests
const WINDOW = 60 * 1000 // 1 minute
const AUTH_LIMIT = 20 // 20 auth requests
const AUTH_WINDOW = 60 * 1000 // 1 minute

function getClientKey(request: NextRequest) {
  if (!TRUST_PROXY_HEADERS) {
    return 'anonymous'
  }

  return (
    request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'anonymous'
  ).slice(0, 64)
}

export default function proxy(request: NextRequest) {
  // Only rate limit API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    const ip = getClientKey(request)
    const now = Date.now()
    const isAuthMutation = request.nextUrl.pathname.startsWith('/api/auth/')
      && request.method !== 'GET'

    if (isAuthMutation) {
      const authRateData = authRateLimitMap.get(ip) || { count: 0, lastReset: now }

      if (now - authRateData.lastReset > AUTH_WINDOW) {
        authRateData.count = 0
        authRateData.lastReset = now
      }

      authRateData.count++
      authRateLimitMap.set(ip, authRateData)

      if (authRateData.count > AUTH_LIMIT) {
        return new NextResponse(
          JSON.stringify({ error: 'Too many auth requests. Please try again later.' }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
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
    
    if (rateData.count > LIMIT) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { 
          status: 429, 
          headers: { 'Content-Type': 'application/json' } 
        }
      )
    }
  }

  return NextResponse.next()
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: '/api/:path*',
}
