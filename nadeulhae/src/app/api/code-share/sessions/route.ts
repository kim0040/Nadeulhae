import { randomBytes } from "node:crypto"

import { NextRequest } from "next/server"

import { withApiAnalytics } from "@/lib/analytics/route"
import { createAuthJsonResponse, validateAuthMutationRequest } from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import {
  ensureCodeShareIdentityCookies,
  getOrCreateCodeShareActorId,
  getOrCreateCodeShareAlias,
} from "@/lib/code-share/actor"
import {
  CODE_SHARE_DEFAULT_LANGUAGE,
  CODE_SHARE_DEFAULT_TITLE,
  CODE_SHARE_MAX_CODE_LENGTH,
  CODE_SHARE_MAX_LANGUAGE_LENGTH,
  CODE_SHARE_MAX_TITLE_LENGTH,
} from "@/lib/code-share/constants"
import {
  closeInactiveCodeShareSessions,
  createCodeShareSession,
  listCodeShareSessionsByOwner,
} from "@/lib/code-share/repository"

export const runtime = "nodejs"

const CODE_SHARE_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    disabled: "실험실 기능을 활성화한 사용자만 코드공유 세션을 만들 수 있습니다.",
    invalidRequest: "코드공유 요청 형식이 올바르지 않습니다.",
    rateLimited: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    dailyLimit: "오늘 코드공유 세션 생성 가능 횟수를 모두 사용했습니다. 내일 다시 시도해 주세요.",
    failed: "코드공유 세션 처리 중 오류가 발생했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    disabled: "Only users with lab access enabled can create code-share sessions.",
    invalidRequest: "Invalid code-share request.",
    rateLimited: "Too many requests. Please try again shortly.",
    dailyLimit: "You have reached today's code-share session creation limit. Please try again tomorrow.",
    failed: "Failed to process code-share sessions.",
  },
  zh: {
    unauthorized: "请先登录。",
    disabled: "只有启用实验室功能的用户才能创建代码共享会话。",
    invalidRequest: "代码共享请求格式不正确。",
    rateLimited: "请求过多，请稍后再试。",
    dailyLimit: "今天的代码共享会话创建次数已用完，请明天再试。",
    failed: "代码共享会话处理失败。",
  },
  ja: {
    unauthorized: "ログインが必要です。",
    disabled: "ラボ機能を有効にしたユーザーのみコード共有セッションを作成できます。",
    invalidRequest: "コード共有リクエストの形式が正しくありません。",
    rateLimited: "リクエストが多すぎます。しばらくしてからもう一度お試しください。",
    dailyLimit: "今日のコード共有セッション作成回数の上限に達しました。明日もう一度お試しください。",
    failed: "コード共有セッションの処理中にエラーが発生しました。",
  },
} as const

type CodeShareLocale = keyof typeof CODE_SHARE_ERRORS

type RateLimitEntry = {
  count: number
  windowStartMs: number
}

declare global {
  var __codeShareCreateWindowMap: Map<string, RateLimitEntry> | undefined
  var __codeShareCreateDailyMap: Map<string, RateLimitEntry> | undefined
}

const CODE_SHARE_CREATE_WINDOW_MS = 60_000
const CODE_SHARE_CREATE_WINDOW_LIMIT = 5
const CODE_SHARE_CREATE_DAILY_LIMIT = 20
const RATE_LIMIT_MAX_ENTRIES = 4000

function getWindowMap() {
  if (!globalThis.__codeShareCreateWindowMap) {
    globalThis.__codeShareCreateWindowMap = new Map()
  }
  return globalThis.__codeShareCreateWindowMap
}

function getDailyMap() {
  if (!globalThis.__codeShareCreateDailyMap) {
    globalThis.__codeShareCreateDailyMap = new Map()
  }
  return globalThis.__codeShareCreateDailyMap
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
    return { allowed: true }
  }
  if (current.count >= limit) {
    return { allowed: false }
  }
  current.count += 1
  map.set(key, current)
  return { allowed: true }
}

function getClientKey(request: NextRequest) {
  const ua = request.headers.get("user-agent")?.trim().slice(0, 120) || "unknown"
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "anon"
  return `${ip}:${ua}`
}

function getLocale(request: NextRequest): CodeShareLocale {
  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
  if (header.startsWith("zh")) return "zh"
  if (header.startsWith("ja")) return "ja"
  return header.startsWith("en") ? "en" : "ko"
}

function createCodeShareSessionId() {
  // 12 bytes -> 16-char-ish base64url id, then validated by shared regex before use.
  return randomBytes(12).toString("base64url")
}

function normalizeTitle(value: unknown) {
  if (typeof value !== "string") {
    return CODE_SHARE_DEFAULT_TITLE
  }

  const normalized = value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CODE_SHARE_MAX_TITLE_LENGTH)

  return normalized || CODE_SHARE_DEFAULT_TITLE
}

function normalizeLanguage(value: unknown) {
  if (typeof value !== "string") {
    return CODE_SHARE_DEFAULT_LANGUAGE
  }

  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9#+._-]/g, "")
    .slice(0, CODE_SHARE_MAX_LANGUAGE_LENGTH)

  return normalized || CODE_SHARE_DEFAULT_LANGUAGE
}

function normalizeCode(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .replace(/\u0000/g, "")
    .slice(0, CODE_SHARE_MAX_CODE_LENGTH)
}

async function handleGET(request: NextRequest) {
  const locale = getLocale(request)

  try {
    // Keep list responses truthful by closing stale sessions before querying.
    await closeInactiveCodeShareSessions()

    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: CODE_SHARE_ERRORS[locale].unauthorized },
          { status: 401 }
        )
      )
    }

    if (!authenticatedSession.user.labEnabled) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: CODE_SHARE_ERRORS[locale].disabled },
          { status: 403 }
        ),
        authenticatedSession
      )
    }

    const identity = {
      actorId: getOrCreateCodeShareActorId(request),
      alias: getOrCreateCodeShareAlias(request),
    }
    const sessions = await listCodeShareSessionsByOwner({
      actorId: identity.actorId,
      userId: authenticatedSession.user.id,
    })

    const finalResponse = createAuthJsonResponse({
      sessions,
      viewer: {
        actorId: identity.actorId,
        alias: identity.alias,
      },
      serverNow: new Date().toISOString(),
    })
    ensureCodeShareIdentityCookies(request, finalResponse, identity)
    return attachRefreshedAuthCookie(finalResponse, authenticatedSession)
  } catch (error) {
    console.error("Code-share sessions GET API failed:", error)
    return createAuthJsonResponse(
      { error: CODE_SHARE_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

async function handlePOST(request: NextRequest) {
  const locale = getLocale(request)

  try {
    const violation = validateAuthMutationRequest(request, locale === "zh" || locale === "ja" ? "en" : locale)
    if (violation) {
      return violation
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return createAuthJsonResponse(
        { error: CODE_SHARE_ERRORS[locale].invalidRequest },
        { status: 400 }
      )
    }

    await closeInactiveCodeShareSessions()

    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: CODE_SHARE_ERRORS[locale].unauthorized },
          { status: 401 }
        )
      )
    }

    if (!authenticatedSession.user.labEnabled) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: CODE_SHARE_ERRORS[locale].disabled },
          { status: 403 }
        ),
        authenticatedSession
      )
    }

    const nowMs = Date.now()
    const clientKey = getClientKey(request)
    const windowMap = getWindowMap()
    const dailyMap = getDailyMap()
    cleanupRateLimitMap(windowMap, CODE_SHARE_CREATE_WINDOW_MS, nowMs)
    cleanupRateLimitMap(dailyMap, CODE_SHARE_CREATE_WINDOW_MS, nowMs)

    if (!checkFixedWindow(windowMap, clientKey, CODE_SHARE_CREATE_WINDOW_LIMIT, CODE_SHARE_CREATE_WINDOW_MS, nowMs).allowed) {
      return createAuthJsonResponse(
        { error: CODE_SHARE_ERRORS[locale].rateLimited },
        { status: 429 }
      )
    }

    if (!checkFixedWindow(dailyMap, `${clientKey}:daily`, CODE_SHARE_CREATE_DAILY_LIMIT, 24 * 60 * 60 * 1000, nowMs).allowed) {
      return createAuthJsonResponse(
        { error: CODE_SHARE_ERRORS[locale].dailyLimit },
        { status: 429 }
      )
    }

    const identity = {
      actorId: getOrCreateCodeShareActorId(request),
      alias: getOrCreateCodeShareAlias(request),
    }

    const title = normalizeTitle(
      typeof payload === "object" && payload && "title" in payload
        ? (payload as { title?: unknown }).title
        : undefined
    )
    const language = normalizeLanguage(
      typeof payload === "object" && payload && "language" in payload
        ? (payload as { language?: unknown }).language
        : undefined
    )
    const code = normalizeCode(
      typeof payload === "object" && payload && "code" in payload
        ? (payload as { code?: unknown }).code
        : undefined
    )

    let createdSession = null
    // Collision is unlikely but retried defensively to avoid leaking DB unique-key failures.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sessionId = createCodeShareSessionId()
      try {
        createdSession = await createCodeShareSession({
          sessionId,
          ownerActorId: identity.actorId,
          ownerUserId: authenticatedSession.user.id,
          title,
          language,
          code,
        })
        if (createdSession) {
          break
        }
      } catch (error) {
        const maybeDuplicate = typeof error === "object"
          && error
          && "code" in error
          && (error as { code?: string }).code === "ER_DUP_ENTRY"

        if (!maybeDuplicate) {
          throw error
        }
      }
    }

    if (!createdSession) {
      return createAuthJsonResponse(
        { error: CODE_SHARE_ERRORS[locale].failed },
        { status: 500 }
      )
    }

    const finalResponse = createAuthJsonResponse(
      {
        session: createdSession,
        viewer: {
          actorId: identity.actorId,
          alias: identity.alias,
        },
        serverNow: new Date().toISOString(),
      },
      { status: 201 }
    )
    ensureCodeShareIdentityCookies(request, finalResponse, identity)
    return attachRefreshedAuthCookie(finalResponse, authenticatedSession)
  } catch (error) {
    console.error("Code-share sessions POST API failed:", error)
    return createAuthJsonResponse(
      { error: CODE_SHARE_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

export const GET = withApiAnalytics(handleGET)
export const POST = withApiAnalytics(handlePOST)
