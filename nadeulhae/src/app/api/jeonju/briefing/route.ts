import { NextRequest, NextResponse } from "next/server"
import { withApiAnalytics } from "@/lib/analytics/route"
import { ensureJeonjuBriefingSchema } from "@/lib/jeonju-briefing/schema"
import { generateJeonjuBriefing, purgeJeonjuBriefingCache } from "@/lib/jeonju-briefing/service"
import { getJeonjuBriefingByDateAndLocale, deleteJeonjuBriefingsForDate } from "@/lib/jeonju-briefing/repository"
import type { JeonjuBriefingLocale } from "@/lib/jeonju-briefing/service"

export const runtime = "nodejs"
const BRIEFING_PUBLIC_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=1800"

type RateLimitEntry = {
  count: number
  windowStartMs: number
}

type CooldownEntry = {
  untilMs: number
}

declare global {
  var __nadeulhaeJeonjuBriefingForceWindowMap: Map<string, RateLimitEntry> | undefined
  var __nadeulhaeJeonjuBriefingForceDailyMap: Map<string, RateLimitEntry> | undefined
  var __nadeulhaeJeonjuBriefingForceCooldownMap: Map<string, CooldownEntry> | undefined
}

const TRUST_PROXY_HEADERS = /^(1|true|yes)$/i.test(
  process.env.TRUST_PROXY_HEADERS ?? ""
)
const FORCE_WINDOW_MS = 15 * 60 * 1000
const FORCE_WINDOW_LIMIT = 2
const FORCE_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000
const FORCE_DAILY_LIMIT = 10
const WARM_ALL_WINDOW_LIMIT = 1
const WARM_ALL_DAILY_LIMIT = 4
const FORCE_REFRESH_COOLDOWN_MS = 90 * 1000
const WARM_ALL_REFRESH_COOLDOWN_MS = 3 * 60 * 1000
const RATE_LIMIT_MAX_ENTRIES = 8000
const FORCE_REFRESH_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000

function getRateWindowMap() {
  if (!globalThis.__nadeulhaeJeonjuBriefingForceWindowMap) {
    globalThis.__nadeulhaeJeonjuBriefingForceWindowMap = new Map()
  }
  return globalThis.__nadeulhaeJeonjuBriefingForceWindowMap
}

function getRateDailyMap() {
  if (!globalThis.__nadeulhaeJeonjuBriefingForceDailyMap) {
    globalThis.__nadeulhaeJeonjuBriefingForceDailyMap = new Map()
  }
  return globalThis.__nadeulhaeJeonjuBriefingForceDailyMap
}

function getCooldownMap() {
  if (!globalThis.__nadeulhaeJeonjuBriefingForceCooldownMap) {
    globalThis.__nadeulhaeJeonjuBriefingForceCooldownMap = new Map()
  }
  return globalThis.__nadeulhaeJeonjuBriefingForceCooldownMap
}

function cleanupRateLimitMap(map: Map<string, RateLimitEntry>, windowMs: number, nowMs: number) {
  for (const [key, value] of map.entries()) {
    if (nowMs - value.windowStartMs > windowMs * 2) {
      map.delete(key)
    }
  }
  if (map.size <= RATE_LIMIT_MAX_ENTRIES) return
  const overflow = map.size - RATE_LIMIT_MAX_ENTRIES
  let removed = 0
  for (const key of map.keys()) {
    map.delete(key)
    removed += 1
    if (removed >= overflow) break
  }
}

function cleanupCooldownMap(map: Map<string, CooldownEntry>, nowMs: number) {
  for (const [key, value] of map.entries()) {
    if (value.untilMs <= nowMs) {
      map.delete(key)
    }
  }
}

function getClientKey(request: NextRequest) {
  const ua = request.headers.get("user-agent")?.trim().slice(0, 120) || "unknown"
  if (!TRUST_PROXY_HEADERS) {
    return `anon:${ua}`
  }

  const ip = (
    request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "anonymous"
  ).slice(0, 64)

  if (ip === "anonymous") return `anon:${ua}`
  return `ip:${ip}`
}

function checkFixedWindow(
  map: Map<string, RateLimitEntry>,
  key: string,
  limit: number,
  windowMs: number,
  nowMs: number
) {
  const current = map.get(key)
  if (!current || nowMs - current.windowStartMs >= windowMs) {
    map.set(key, { count: 1, windowStartMs: nowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (current.count >= limit) {
    const retryAfterMs = Math.max(1000, current.windowStartMs + windowMs - nowMs)
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    }
  }

  current.count += 1
  map.set(key, current)
  return { allowed: true, retryAfterSeconds: 0 }
}

function createRateLimitResponse(locale: JeonjuBriefingLocale, retryAfterSeconds: number) {
  const message = locale === "ko"
    ? "갱신 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
    : locale === "zh"
      ? "刷新请求过多，请稍后再试。"
      : locale === "ja"
        ? "更新リクエストが多すぎます。しばらくしてからもう一度お試しください。"
        : "Too many refresh requests. Please try again shortly."

  const response = NextResponse.json(
    {
      success: false,
      error: message,
      retryAfterSeconds,
    },
    { status: 429 }
  )
  response.headers.set("Retry-After", String(retryAfterSeconds))
  response.headers.set("Cache-Control", "no-store")
  return response
}

function getYesterdayInKst(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"
  const hour = Number(get("hour"))
  // Day boundary is 07:00 KST, not midnight
  const offset = hour < 7 ? 2 : 1
  const d = new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00+09:00`)
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().slice(0, 10)
}

function isRecentlyUpdated(updatedAt: string, nowMs: number, minIntervalMs: number) {
  const updatedMs = Date.parse(updatedAt)
  if (!Number.isFinite(updatedMs)) return false
  return nowMs - updatedMs < minIntervalMs
}

export const GET = withApiAnalytics(async (request: NextRequest) => {
  try {
    await ensureJeonjuBriefingSchema()
  } catch (schemaError) {
    console.error("[api/jeonju/briefing] Schema initialization failed:", schemaError)
    // Continue anyway - generation will handle errors
  }

  const { searchParams } = new URL(request.url)
  const localeParam = searchParams.get("locale")
  const locale: JeonjuBriefingLocale =
    localeParam === "en" ? "en" : localeParam === "zh" ? "zh" : localeParam === "ja" ? "ja" : "ko"

  const forceRequested = searchParams.get("force") === "true"
  const warmAll = searchParams.get("warm_all") === "true"
  const refresh = searchParams.get("refresh") === "true"
  const purgeRequested = searchParams.get("purge") === "true"
  const nowMs = Date.now()
  const briefingDate = getYesterdayInKst()

  // Purge: clear all cached data (DB + memory + failure blocks) for fresh regeneration
  if (purgeRequested) {
    try {
      const targetLocale = warmAll ? undefined : locale
      await deleteJeonjuBriefingsForDate(briefingDate, targetLocale)
      if (warmAll) {
        purgeJeonjuBriefingCache(briefingDate, "ko")
        purgeJeonjuBriefingCache(briefingDate, "en")
        purgeJeonjuBriefingCache(briefingDate, "zh")
        purgeJeonjuBriefingCache(briefingDate, "ja")
      } else {
        purgeJeonjuBriefingCache(briefingDate, locale)
      }
      // Fall through to generate fresh briefing with force=true
    } catch (purgeError) {
      console.warn("[api/jeonju/briefing] Cache purge failed:", purgeError)
    }
  }

  if (forceRequested) {
    try {
      if (warmAll) {
        const [koCached, enCached, zhCached, jaCached] = await Promise.all([
          getJeonjuBriefingByDateAndLocale(briefingDate, "ko"),
          getJeonjuBriefingByDateAndLocale(briefingDate, "en"),
          getJeonjuBriefingByDateAndLocale(briefingDate, "zh"),
          getJeonjuBriefingByDateAndLocale(briefingDate, "ja"),
        ])
        if (
          koCached
          && enCached
          && zhCached
          && jaCached
          && isRecentlyUpdated(koCached.updatedAt, nowMs, FORCE_REFRESH_MIN_INTERVAL_MS)
          && isRecentlyUpdated(enCached.updatedAt, nowMs, FORCE_REFRESH_MIN_INTERVAL_MS)
        ) {
          const response = NextResponse.json({
            success: true,
            warmed: true,
            throttledForceRefresh: true,
            data: {
              ko: koCached,
              en: enCached,
              zh: zhCached,
              ja: jaCached,
            },
          })
          response.headers.set("Cache-Control", BRIEFING_PUBLIC_CACHE_CONTROL)
          return response
        }
      } else {
        const cached = await getJeonjuBriefingByDateAndLocale(briefingDate, locale)
        if (cached && isRecentlyUpdated(cached.updatedAt, nowMs, FORCE_REFRESH_MIN_INTERVAL_MS)) {
          const response = NextResponse.json({
            success: true,
            fromCache: true,
            throttledForceRefresh: true,
            data: cached,
          })
          response.headers.set("Cache-Control", BRIEFING_PUBLIC_CACHE_CONTROL)
          return response
        }
      }
    } catch (error) {
      console.warn("[api/jeonju/briefing] Force refresh pre-check failed:", error)
    }
  }

  const force = forceRequested || purgeRequested

  if (force || warmAll) {
    const clientKey = getClientKey(request)
    const actionKey = warmAll ? "warm-all" : "force"
    const perClientActionKey = `${clientKey}:${actionKey}`

    const cooldownMap = getCooldownMap()
    const windowMap = getRateWindowMap()
    const dailyMap = getRateDailyMap()

    cleanupCooldownMap(cooldownMap, nowMs)
    cleanupRateLimitMap(windowMap, FORCE_WINDOW_MS, nowMs)
    cleanupRateLimitMap(dailyMap, FORCE_DAILY_WINDOW_MS, nowMs)

    const cooldownEntry = cooldownMap.get(perClientActionKey)
    if (cooldownEntry && cooldownEntry.untilMs > nowMs) {
      const retryAfterSeconds = Math.ceil((cooldownEntry.untilMs - nowMs) / 1000)
      return createRateLimitResponse(locale, retryAfterSeconds)
    }

    const windowDecision = checkFixedWindow(
      windowMap,
      perClientActionKey,
      warmAll ? WARM_ALL_WINDOW_LIMIT : FORCE_WINDOW_LIMIT,
      FORCE_WINDOW_MS,
      nowMs
    )
    if (!windowDecision.allowed) {
      return createRateLimitResponse(locale, windowDecision.retryAfterSeconds)
    }

    const dailyDecision = checkFixedWindow(
      dailyMap,
      perClientActionKey,
      warmAll ? WARM_ALL_DAILY_LIMIT : FORCE_DAILY_LIMIT,
      FORCE_DAILY_WINDOW_MS,
      nowMs
    )
    if (!dailyDecision.allowed) {
      return createRateLimitResponse(locale, dailyDecision.retryAfterSeconds)
    }

    cooldownMap.set(perClientActionKey, {
      untilMs: nowMs + (warmAll ? WARM_ALL_REFRESH_COOLDOWN_MS : FORCE_REFRESH_COOLDOWN_MS),
    })
  }

  try {
    if (warmAll) {
      const [ko, en, zh, ja] = await Promise.all([
        generateJeonjuBriefing({ locale: "ko", forceRefresh: force, skipMemoryCache: refresh }),
        generateJeonjuBriefing({ locale: "en", forceRefresh: force, skipMemoryCache: refresh }),
        generateJeonjuBriefing({ locale: "zh", forceRefresh: force, skipMemoryCache: refresh }),
        generateJeonjuBriefing({ locale: "ja", forceRefresh: force, skipMemoryCache: refresh }),
      ])
      const response = NextResponse.json({
        success: true,
        warmed: true,
        data: {
          ko: ko.data,
          en: en.data,
          zh: zh.data,
          ja: ja.data,
        },
      })
      response.headers.set("Cache-Control", force ? "no-store" : BRIEFING_PUBLIC_CACHE_CONTROL)
      return response
    }

    const result = await generateJeonjuBriefing({
      locale,
      forceRefresh: force,
      skipMemoryCache: refresh,
    })

    const response = NextResponse.json({
      success: true,
      fromCache: result.fromCache,
      data: result.data,
    })
    response.headers.set("Cache-Control", force ? "no-store" : BRIEFING_PUBLIC_CACHE_CONTROL)
    return response
  } catch (error) {
    console.error("[api/jeonju/briefing] Unhandled error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate briefing",
      },
      { status: 500 }
    )
  }
})
