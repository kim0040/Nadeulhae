import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory rate limiter for demonstration/small scale
// For production with multiple instances, use Redis or similar.
const rateLimitMap = new Map<string, { count: number, lastReset: number }>()

const LIMIT = 60 // 60 requests
const WINDOW = 60 * 1000 // 1 minute

export default function proxy(request: NextRequest) {
  // Only rate limit API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous'
    const now = Date.now()
    
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
