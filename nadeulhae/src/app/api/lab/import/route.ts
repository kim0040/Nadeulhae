import { NextRequest } from "next/server"

import { withApiAnalytics } from "@/lib/analytics/route"
import {
  createAuthJsonResponse,
  validateSameOriginRequest,
} from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import {
  LAB_IMPORT_MAX_BYTES,
  LAB_IMPORT_MAX_CARD_COUNT,
} from "@/lib/lab/constants"
import { addLabCardsToDeck } from "@/lib/lab/management"
import { getLabState } from "@/lib/lab/repository"
import { parseLabImportPayload } from "@/lib/lab/transfer"
import type { LabLocale } from "@/lib/lab/types"

export const runtime = "nodejs"

const LAB_IMPORT_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    disabled: "실험실 기능이 비활성화되어 있습니다. 대시보드 설정에서 먼저 활성화해 주세요.",
    invalidRequest: "가져오기 요청 형식이 올바르지 않습니다.",
    invalidDeck: "대상 단어장을 찾을 수 없습니다.",
    empty: "가져올 수 있는 단어가 없습니다. 템플릿 형식을 확인해 주세요.",
    tooLarge: "가져오기 데이터가 너무 큽니다. 파일을 나눠서 시도해 주세요.",
    invalidFormat: "지원하지 않는 형식입니다. CSV 또는 JSON만 사용할 수 있습니다.",
    failed: "단어장 가져오기에 실패했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    disabled: "Lab is disabled. Enable it first from dashboard settings.",
    invalidRequest: "Invalid import request.",
    invalidDeck: "Target deck was not found.",
    empty: "No valid cards to import. Please check the template.",
    tooLarge: "Import payload is too large. Please split the file.",
    invalidFormat: "Unsupported format. Use CSV or JSON.",
    failed: "Failed to import cards.",
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

function normalizeSource(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .replace(/\u0000/g, "")
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

function parseFormat(value: unknown) {
  if (value === "json") {
    return "json" as const
  }

  if (value === "csv") {
    return "csv" as const
  }

  return null
}

async function handlePOST(request: NextRequest) {
  const locale = getLocale(request)

  try {
    const sameOriginViolation = validateSameOriginRequest(request, locale)
    if (sameOriginViolation) {
      return sameOriginViolation
    }

    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.toLowerCase().includes("application/json")) {
      return createAuthJsonResponse(
        { error: LAB_IMPORT_ERRORS[locale].invalidRequest },
        { status: 415 }
      )
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0")
    if (contentLength > LAB_IMPORT_MAX_BYTES) {
      return createAuthJsonResponse(
        { error: LAB_IMPORT_ERRORS[locale].tooLarge },
        { status: 413 }
      )
    }

    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: LAB_IMPORT_ERRORS[locale].unauthorized },
          { status: 401 }
        )
      )
    }

    if (!authenticatedSession.user.labEnabled) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_IMPORT_ERRORS[locale].disabled },
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
          { error: LAB_IMPORT_ERRORS[locale].invalidRequest },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const format = parseFormat(
      typeof payload === "object" && payload && "format" in payload
        ? (payload as { format?: unknown }).format
        : null
    )
    if (!format) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_IMPORT_ERRORS[locale].invalidFormat },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const source = normalizeSource(
      typeof payload === "object" && payload && "source" in payload
        ? (payload as { source?: unknown }).source
        : "",
      LAB_IMPORT_MAX_BYTES
    )

    if (!source || source.length > LAB_IMPORT_MAX_BYTES) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: !source ? LAB_IMPORT_ERRORS[locale].empty : LAB_IMPORT_ERRORS[locale].tooLarge },
          { status: !source ? 400 : 413 }
        ),
        authenticatedSession
      )
    }

    let parsedImport: ReturnType<typeof parseLabImportPayload>
    try {
      parsedImport = parseLabImportPayload({
        format,
        source,
      })
    } catch {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_IMPORT_ERRORS[locale].invalidRequest },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    if (!parsedImport.parseSucceeded) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_IMPORT_ERRORS[locale].invalidRequest },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    if (parsedImport.cards.length === 0) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_IMPORT_ERRORS[locale].empty },
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
        : parsedImport.deckTitle ?? "",
      120
    )

    const deckTopic = normalizeText(
      typeof payload === "object" && payload && "deckTopic" in payload
        ? (payload as { deckTopic?: unknown }).deckTopic
        : parsedImport.deckTopic ?? "",
      200
    )

    if (!deckId && !deckTitle) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_IMPORT_ERRORS[locale].invalidRequest },
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
      cards: parsedImport.cards.slice(0, LAB_IMPORT_MAX_CARD_COUNT),
    })

    if (!saved.deck) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_IMPORT_ERRORS[locale].invalidDeck },
          { status: 404 }
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
        totalParsedRows: parsedImport.totalParsedRows,
        invalidRows: parsedImport.invalidRows,
        state,
      }),
      authenticatedSession
    )
  } catch (error) {
    console.error("Lab import API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_IMPORT_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

export const POST = withApiAnalytics(handlePOST)
