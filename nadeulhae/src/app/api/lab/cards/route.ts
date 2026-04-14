import { NextRequest } from "next/server"

import { withApiAnalytics } from "@/lib/analytics/route"
import {
  createAuthJsonResponse,
  validateAuthMutationRequest,
} from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import { addLabCardsToDeck } from "@/lib/lab/management"
import { getLabState } from "@/lib/lab/repository"
import type { LabGeneratedCardInput, LabLocale } from "@/lib/lab/types"

export const runtime = "nodejs"

const LAB_CARD_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    disabled: "실험실 기능이 비활성화되어 있습니다. 대시보드 설정에서 먼저 활성화해 주세요.",
    invalidRequest: "수동 카드 추가 요청 형식이 올바르지 않습니다.",
    invalidCard: "단어와 뜻을 모두 입력해 주세요.",
    invalidDeck: "대상 단어장을 찾을 수 없습니다.",
    duplicate: "이미 같은 단어/뜻 조합이 있어 추가하지 않았습니다.",
    failed: "수동 카드 추가에 실패했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    disabled: "Lab is disabled. Enable it first from dashboard settings.",
    invalidRequest: "Invalid manual card request.",
    invalidCard: "Please provide both term and meaning.",
    invalidDeck: "Target deck was not found.",
    duplicate: "A card with the same term and meaning already exists.",
    failed: "Failed to add manual card.",
  },
} as const

function getLocale(request: NextRequest): LabLocale {
  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
  return header.startsWith("en") ? "en" : "ko"
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
}

function parseDeckId(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  const integer = Math.floor(parsed)
  return integer > 0 ? integer : null
}

function parseCard(value: unknown): LabGeneratedCardInput | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  const term = normalizeText(source.term, 80)
  const meaning = normalizeText(source.meaning, 220)
  const example = normalizeText(source.example, 280)
  const tip = normalizeText(source.tip, 200)

  if (!term || !meaning) {
    return null
  }

  return {
    term,
    meaning,
    example: example || null,
    tip: tip || null,
  }
}

async function handlePOST(request: NextRequest) {
  const locale = getLocale(request)

  try {
    const requestViolation = validateAuthMutationRequest(request, locale)
    if (requestViolation) {
      return requestViolation
    }

    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].unauthorized },
          { status: 401 }
        )
      )
    }

    if (!authenticatedSession.user.labEnabled) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].disabled },
          { status: 403 }
        ),
        authenticatedSession
      )
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].invalidRequest },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const card = parseCard(
      typeof payload === "object" && payload && "card" in payload
        ? (payload as { card?: unknown }).card
        : null
    )

    if (!card) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].invalidCard },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const deckId = parseDeckId(
      typeof payload === "object" && payload && "deckId" in payload
        ? (payload as { deckId?: unknown }).deckId
        : null
    )

    const deckTitle = normalizeText(
      typeof payload === "object" && payload && "deckTitle" in payload
        ? (payload as { deckTitle?: unknown }).deckTitle
        : "",
      120
    )
    const deckTopic = normalizeText(
      typeof payload === "object" && payload && "deckTopic" in payload
        ? (payload as { deckTopic?: unknown }).deckTopic
        : "",
      200
    )

    if (!deckId && !deckTitle) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].invalidRequest },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const saved = await addLabCardsToDeck({
      userId: authenticatedSession.user.id,
      locale,
      deckId,
      deckTitle: deckTitle || null,
      deckTopic: deckTopic || null,
      cards: [card],
    })

    if (!saved.deck) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].invalidDeck },
          { status: 404 }
        ),
        authenticatedSession
      )
    }

    if (saved.addedCount === 0) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          {
            error: LAB_CARD_ERRORS[locale].duplicate,
            deck: saved.deck,
            addedCount: 0,
            skippedCount: saved.skippedCount,
          },
          { status: 409 }
        ),
        authenticatedSession
      )
    }

    const state = await getLabState(authenticatedSession.user.id)

    return attachRefreshedAuthCookie(
      createAuthJsonResponse({
        deck: saved.deck,
        addedCount: saved.addedCount,
        skippedCount: saved.skippedCount,
        state,
      }),
      authenticatedSession
    )
  } catch (error) {
    console.error("Lab cards POST API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_CARD_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

export const POST = withApiAnalytics(handlePOST)
