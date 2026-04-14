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
import {
  addLabCardsToDeck,
  deleteLabCardForUser,
  getLabDeckCardsForUser,
  updateLabCardForUser,
} from "@/lib/lab/management"
import { getLabState } from "@/lib/lab/repository"
import type { LabGeneratedCardInput, LabLocale } from "@/lib/lab/types"

export const runtime = "nodejs"

const LAB_CARD_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    disabled: "실험실 기능이 비활성화되어 있습니다. 대시보드 설정에서 먼저 활성화해 주세요.",
    invalidRequest: "카드 요청 형식이 올바르지 않습니다.",
    invalidCard: "단어와 뜻을 모두 입력해 주세요.",
    invalidDeck: "대상 단어장을 찾을 수 없습니다.",
    invalidDeckId: "단어장 식별자가 올바르지 않습니다.",
    invalidCardId: "카드 식별자가 올바르지 않습니다.",
    duplicate: "이미 같은 단어/뜻 조합이 있어 저장하지 않았습니다.",
    notFound: "해당 카드를 찾을 수 없습니다.",
    failed: "카드 작업 처리에 실패했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    disabled: "Lab is disabled. Enable it first from dashboard settings.",
    invalidRequest: "Invalid card request.",
    invalidCard: "Please provide both term and meaning.",
    invalidDeck: "Target deck was not found.",
    invalidDeckId: "Invalid deck id.",
    invalidCardId: "Invalid card id.",
    duplicate: "A card with the same term and meaning already exists.",
    notFound: "Card not found.",
    failed: "Failed to process card request.",
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

function parsePositiveInteger(value: unknown) {
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
  const partOfSpeech = normalizeText(source.partOfSpeech, 40)
  const example = normalizeText(source.example, 280)
  const exampleTranslation = normalizeText(source.exampleTranslation, 280)

  if (!term || !meaning) {
    return null
  }

  return {
    term,
    meaning,
    partOfSpeech: partOfSpeech || null,
    example: example || null,
    exampleTranslation: exampleTranslation || null,
  }
}

async function requireLabSession(request: NextRequest, locale: LabLocale) {
  const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
  if (!authenticatedSession) {
    return {
      session: null,
      response: clearAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].unauthorized },
          { status: 401 }
        )
      ),
    }
  }

  if (!authenticatedSession.user.labEnabled) {
    return {
      session: null,
      response: attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].disabled },
          { status: 403 }
        ),
        authenticatedSession
      ),
    }
  }

  return {
    session: authenticatedSession,
    response: null,
  }
}

async function handleGET(request: NextRequest) {
  const locale = getLocale(request)

  try {
    const required = await requireLabSession(request, locale)
    if (!required.session) {
      return required.response as Response
    }

    const deckId = parsePositiveInteger(request.nextUrl.searchParams.get("deckId"))
    if (!deckId) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].invalidDeckId },
          { status: 400 }
        ),
        required.session
      )
    }

    const limit = parsePositiveInteger(request.nextUrl.searchParams.get("limit")) ?? undefined
    const data = await getLabDeckCardsForUser({
      userId: required.session.user.id,
      deckId,
      limit,
    })

    if (!data) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].invalidDeck },
          { status: 404 }
        ),
        required.session
      )
    }

    return attachRefreshedAuthCookie(
      createAuthJsonResponse(data),
      required.session
    )
  } catch (error) {
    console.error("Lab cards GET API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_CARD_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

async function handlePOST(request: NextRequest) {
  const locale = getLocale(request)

  try {
    const requestViolation = validateAuthMutationRequest(request, locale)
    if (requestViolation) {
      return requestViolation
    }

    const required = await requireLabSession(request, locale)
    if (!required.session) {
      return required.response as Response
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
        required.session
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
        required.session
      )
    }

    const deckId = parsePositiveInteger(
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
        required.session
      )
    }

    const saved = await addLabCardsToDeck({
      userId: required.session.user.id,
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
        required.session
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
        required.session
      )
    }

    const state = await getLabState(required.session.user.id)

    return attachRefreshedAuthCookie(
      createAuthJsonResponse({
        deck: saved.deck,
        addedCount: saved.addedCount,
        skippedCount: saved.skippedCount,
        state,
      }),
      required.session
    )
  } catch (error) {
    console.error("Lab cards POST API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_CARD_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

async function handlePATCH(request: NextRequest) {
  const locale = getLocale(request)

  try {
    const requestViolation = validateAuthMutationRequest(request, locale)
    if (requestViolation) {
      return requestViolation
    }

    const required = await requireLabSession(request, locale)
    if (!required.session) {
      return required.response as Response
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
        required.session
      )
    }

    const cardId = parsePositiveInteger(
      typeof payload === "object" && payload && "cardId" in payload
        ? (payload as { cardId?: unknown }).cardId
        : null
    )
    if (!cardId) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].invalidCardId },
          { status: 400 }
        ),
        required.session
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
        required.session
      )
    }

    const result = await updateLabCardForUser({
      userId: required.session.user.id,
      cardId,
      term: card.term,
      meaning: card.meaning,
      partOfSpeech: card.partOfSpeech ?? null,
      example: card.example ?? null,
      exampleTranslation: card.exampleTranslation ?? null,
    })

    if (result.status === "invalid") {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].invalidCard },
          { status: 400 }
        ),
        required.session
      )
    }

    if (result.status === "not_found") {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].notFound },
          { status: 404 }
        ),
        required.session
      )
    }

    if (result.status === "duplicate") {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].duplicate },
          { status: 409 }
        ),
        required.session
      )
    }

    const state = await getLabState(required.session.user.id)

    return attachRefreshedAuthCookie(
      createAuthJsonResponse({
        deck: result.deck,
        card: result.card,
        state,
      }),
      required.session
    )
  } catch (error) {
    console.error("Lab cards PATCH API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_CARD_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

async function handleDELETE(request: NextRequest) {
  const locale = getLocale(request)

  try {
    const requestViolation = validateAuthMutationRequest(request, locale)
    if (requestViolation) {
      return requestViolation
    }

    const required = await requireLabSession(request, locale)
    if (!required.session) {
      return required.response as Response
    }

    const cardId = parsePositiveInteger(request.nextUrl.searchParams.get("cardId"))
    if (!cardId) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].invalidCardId },
          { status: 400 }
        ),
        required.session
      )
    }

    const result = await deleteLabCardForUser({
      userId: required.session.user.id,
      cardId,
    })

    if (result.status === "not_found") {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_CARD_ERRORS[locale].notFound },
          { status: 404 }
        ),
        required.session
      )
    }

    const state = await getLabState(required.session.user.id)

    return attachRefreshedAuthCookie(
      createAuthJsonResponse({
        success: true,
        deck: result.deck,
        state,
      }),
      required.session
    )
  } catch (error) {
    console.error("Lab cards DELETE API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_CARD_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

export const GET = withApiAnalytics(handleGET)
export const POST = withApiAnalytics(handlePOST)
export const PATCH = withApiAnalytics(handlePATCH)
export const DELETE = withApiAnalytics(handleDELETE)
