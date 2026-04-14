import { NextRequest, NextResponse } from "next/server"

import { withApiAnalytics } from "@/lib/analytics/route"
import { createAuthJsonResponse } from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import { getLabDeckExportData } from "@/lib/lab/management"
import {
  buildLabExportCsv,
  sanitizeLabFilename,
} from "@/lib/lab/transfer"
import type { LabLocale } from "@/lib/lab/types"

export const runtime = "nodejs"

const LAB_EXPORT_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    disabled: "실험실 기능이 비활성화되어 있습니다. 대시보드 설정에서 먼저 활성화해 주세요.",
    invalidDeckId: "단어장 식별자가 올바르지 않습니다.",
    invalidFormat: "내보내기 형식은 csv 또는 json만 지원합니다.",
    notFound: "해당 단어장을 찾을 수 없습니다.",
    failed: "단어장 내보내기에 실패했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    disabled: "Lab is disabled. Enable it first from dashboard settings.",
    invalidDeckId: "Invalid deck id.",
    invalidFormat: "Only csv or json export is supported.",
    notFound: "Deck not found.",
    failed: "Failed to export deck.",
  },
} as const

function getLocale(request: NextRequest): LabLocale {
  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
  return header.startsWith("en") ? "en" : "ko"
}

function parseDeckId(value: string | null) {
  const parsed = Number(value ?? "")
  if (!Number.isFinite(parsed)) {
    return null
  }

  const integer = Math.floor(parsed)
  return integer > 0 ? integer : null
}

function parseFormat(value: string | null) {
  if (value === "json") {
    return "json" as const
  }

  if (!value || value === "csv") {
    return "csv" as const
  }

  return null
}

function toAsciiFilename(value: string) {
  const ascii = value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()

  return ascii || "lab-deck"
}

function buildContentDisposition(filenameBase: string, extension: "json" | "csv") {
  const utf8Filename = `${filenameBase}.${extension}`
  const asciiFallback = `${toAsciiFilename(filenameBase)}.${extension}`
  const encodedUtf8Filename = encodeURIComponent(utf8Filename)
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedUtf8Filename}`
}

async function handleGET(request: NextRequest) {
  const locale = getLocale(request)

  try {
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: LAB_EXPORT_ERRORS[locale].unauthorized },
          { status: 401 }
        )
      )
    }

    if (!authenticatedSession.user.labEnabled) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_EXPORT_ERRORS[locale].disabled },
          { status: 403 }
        ),
        authenticatedSession
      )
    }

    const deckId = parseDeckId(request.nextUrl.searchParams.get("deckId"))
    if (!deckId) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_EXPORT_ERRORS[locale].invalidDeckId },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const format = parseFormat(request.nextUrl.searchParams.get("format"))
    if (!format) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_EXPORT_ERRORS[locale].invalidFormat },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const data = await getLabDeckExportData({
      userId: authenticatedSession.user.id,
      deckId,
    })

    if (!data) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_EXPORT_ERRORS[locale].notFound },
          { status: 404 }
        ),
        authenticatedSession
      )
    }

    const safeName = sanitizeLabFilename(data.deck.title)

    if (format === "json") {
      const body = JSON.stringify(
        {
          deck: {
            id: data.deck.id,
            title: data.deck.title,
            topic: data.deck.topic,
            locale: data.deck.locale,
            cardCount: data.deck.cardCount,
            createdAt: data.deck.createdAt,
          },
          cards: data.cards.map((card) => ({
            term: card.term,
            meaning: card.meaning,
            partOfSpeech: card.partOfSpeech,
            example: card.example,
            exampleTranslation: card.exampleTranslation,
            learningState: card.learningState,
            stage: card.stage,
            nextReviewAt: card.nextReviewAt,
            lastReviewedAt: card.lastReviewedAt,
            totalReviews: card.totalReviews,
            lapses: card.lapses,
            difficulty: card.difficulty,
            stabilityDays: card.stabilityDays,
          })),
        },
        null,
        2
      )

      const response = new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": buildContentDisposition(safeName, "json"),
          "Cache-Control": "no-store, max-age=0",
        },
      })

      return attachRefreshedAuthCookie(response, authenticatedSession)
    }

    const csvBody = buildLabExportCsv({
      deckTitle: data.deck.title,
      deckTopic: data.deck.topic,
      cards: data.cards,
    })

    const response = new NextResponse(csvBody, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": buildContentDisposition(safeName, "csv"),
        "Cache-Control": "no-store, max-age=0",
      },
    })

    return attachRefreshedAuthCookie(response, authenticatedSession)
  } catch (error) {
    console.error("Lab export API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_EXPORT_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

export const GET = withApiAnalytics(handleGET)
