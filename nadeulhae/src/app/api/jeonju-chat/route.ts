import { NextRequest, NextResponse } from "next/server"

import { validateAuthMutationRequest } from "@/lib/auth/request-security"
import { getAuthenticatedSessionFromRequest } from "@/lib/auth/session"
import { containsProfanity, maskProfanity } from "@/lib/jeonju-chat/profanity-filter"
import {
  createChatMessage,
  getMessagesSince,
  getRecentMessages,
} from "@/lib/jeonju-chat/repository"

export const runtime = "nodejs"

const RATE_LIMIT_WINDOW_MS = 5_000
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_MAP_MAX_KEYS = 6_000

function sanitizeHtmlEntities(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

const JEONJU_CHAT_ERRORS = {
  ko: {
    loadFailed: "채팅 메시지를 불러오지 못했습니다.",
    authRequired: "로그인이 필요합니다.",
    rateLimited: "메시지를 너무 자주 보내고 있습니다. 잠시 후 다시 시도해 주세요.",
    invalidRequest: "잘못된 요청입니다.",
    invalidLength: "메시지는 1자 이상 500자 이하로 입력해 주세요.",
    profanity: "부적절한 표현이 포함되어 있습니다. 다시 작성해 주세요.",
    sendFailed: "메시지 전송에 실패했습니다.",
  },
  en: {
    loadFailed: "Failed to load chat messages.",
    authRequired: "You need to log in first.",
    rateLimited: "You are sending messages too quickly. Please try again shortly.",
    invalidRequest: "Invalid request.",
    invalidLength: "Message must be between 1 and 500 characters.",
    profanity: "Your message contains inappropriate language. Please revise it.",
    sendFailed: "Failed to send the message.",
  },
} as const

type JeonjuChatLocale = keyof typeof JEONJU_CHAT_ERRORS

function resolveLocale(request: Request): JeonjuChatLocale {
  const acceptLanguage = request.headers.get("accept-language")?.toLowerCase() ?? ""
  return acceptLanguage.startsWith("en") ? "en" : "ko"
}

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const lastSent = rateLimitMap.get(userId)
  if (lastSent && now - lastSent < RATE_LIMIT_WINDOW_MS) {
    return true
  }
  rateLimitMap.set(userId, now)
  pruneRateLimitMap(rateLimitMap)
  return false
}

function pruneRateLimitMap(map: Map<string, number>) {
  if (map.size <= RATE_LIMIT_MAP_MAX_KEYS) {
    return
  }

  const overflow = map.size - RATE_LIMIT_MAP_MAX_KEYS
  let removed = 0
  for (const key of map.keys()) {
    map.delete(key)
    removed += 1
    if (removed >= overflow) {
      break
    }
  }
}

export async function GET(request: NextRequest) {
  const locale = resolveLocale(request)
  try {
    const session = await getAuthenticatedSessionFromRequest(request)
    const viewerUserId = session?.user.id ?? null
    const afterIdParam = request.nextUrl.searchParams.get("after_id")
    const afterId = afterIdParam ? parseInt(afterIdParam, 10) : null

    if (afterId && afterId > 0) {
      const messages = await getMessagesSince(afterId, viewerUserId)
      return NextResponse.json({
        messages,
        serverNow: new Date().toISOString(),
      })
    }

    const messages = await getRecentMessages(50, viewerUserId)
    return NextResponse.json({
      messages,
      serverNow: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Jeonju chat GET failed:", error)
    return NextResponse.json(
      { error: JEONJU_CHAT_ERRORS[locale].loadFailed },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const locale = resolveLocale(request)
  try {
    const requestViolation = validateAuthMutationRequest(request, locale)
    if (requestViolation) {
      return requestViolation
    }

    const session = await getAuthenticatedSessionFromRequest(request)
    if (!session) {
      return NextResponse.json(
        { error: JEONJU_CHAT_ERRORS[locale].authRequired },
        { status: 401 }
      )
    }

    const user = session.user

    if (isRateLimited(user.id)) {
      return NextResponse.json(
        { error: JEONJU_CHAT_ERRORS[locale].rateLimited },
        { status: 429 }
      )
    }

    let payload: { message?: string; anonymous?: boolean }
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json(
        { error: JEONJU_CHAT_ERRORS[locale].invalidRequest },
        { status: 400 }
      )
    }

    const message = typeof payload.message === "string"
      ? payload.message.trim()
      : ""

    if (!message || message.length > 500) {
      return NextResponse.json(
        { error: JEONJU_CHAT_ERRORS[locale].invalidLength },
        { status: 400 }
      )
    }

    // Profanity check
    if (containsProfanity(message)) {
      return NextResponse.json(
        { error: JEONJU_CHAT_ERRORS[locale].profanity },
        { status: 400 }
      )
    }

    const isAnonymous = payload.anonymous === true

    const created = await createChatMessage({
      userId: user.id,
      nickname: sanitizeHtmlEntities(user.nickname || user.displayName),
      nicknameTag: user.nicknameTag || "0000",
      content: sanitizeHtmlEntities(maskProfanity(message)),
      isAnonymous,
    })

    return NextResponse.json(
      {
        message: { ...created, isMine: true },
        serverNow: new Date().toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Jeonju chat POST failed:", error)
    return NextResponse.json(
      { error: JEONJU_CHAT_ERRORS[locale].sendFailed },
      { status: 500 }
    )
  }
}
