import { NextRequest, NextResponse } from "next/server"

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

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const lastSent = rateLimitMap.get(userId)
  if (lastSent && now - lastSent < RATE_LIMIT_WINDOW_MS) {
    return true
  }
  rateLimitMap.set(userId, now)
  return false
}

export async function GET(request: NextRequest) {
  try {
    const afterIdParam = request.nextUrl.searchParams.get("after_id")
    const afterId = afterIdParam ? parseInt(afterIdParam, 10) : null

    if (afterId && afterId > 0) {
      const messages = await getMessagesSince(afterId)
      return NextResponse.json({ messages })
    }

    const messages = await getRecentMessages(50)
    return NextResponse.json({ messages })
  } catch (error) {
    console.error("Jeonju chat GET failed:", error)
    return NextResponse.json(
      { error: "채팅 메시지를 불러오지 못했습니다." },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedSessionFromRequest(request)
    if (!session) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      )
    }

    const user = session.user

    if (isRateLimited(user.id)) {
      return NextResponse.json(
        { error: "메시지를 너무 자주 보내고 있습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 }
      )
    }

    let payload: { message?: string; anonymous?: boolean }
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json(
        { error: "잘못된 요청입니다." },
        { status: 400 }
      )
    }

    const message = typeof payload.message === "string"
      ? payload.message.trim()
      : ""

    if (!message || message.length > 500) {
      return NextResponse.json(
        { error: "메시지는 1자 이상 500자 이하로 입력해 주세요." },
        { status: 400 }
      )
    }

    // Profanity check
    if (containsProfanity(message)) {
      return NextResponse.json(
        { error: "부적절한 표현이 포함되어 있습니다. 다시 작성해 주세요." },
        { status: 400 }
      )
    }

    const isAnonymous = payload.anonymous === true

    const created = await createChatMessage({
      userId: user.id,
      nickname: user.nickname || user.displayName,
      nicknameTag: user.nicknameTag || "0000",
      content: maskProfanity(message),
      isAnonymous,
    })

    return NextResponse.json({ message: created }, { status: 201 })
  } catch (error) {
    console.error("Jeonju chat POST failed:", error)
    return NextResponse.json(
      { error: "메시지 전송에 실패했습니다." },
      { status: 500 }
    )
  }
}
