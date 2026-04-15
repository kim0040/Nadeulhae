import { randomBytes } from "node:crypto"

import { NextRequest } from "next/server"

import { withApiAnalytics } from "@/lib/analytics/route"
import { createAuthJsonResponse, validateAuthMutationRequest } from "@/lib/auth/request-security"
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
    invalidRequest: "코드공유 요청 형식이 올바르지 않습니다.",
    failed: "코드공유 세션 처리 중 오류가 발생했습니다.",
  },
  en: {
    invalidRequest: "Invalid code-share request.",
    failed: "Failed to process code-share sessions.",
  },
} as const

type CodeShareLocale = "ko" | "en"

function getLocale(request: NextRequest): CodeShareLocale {
  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
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

    const identity = {
      actorId: getOrCreateCodeShareActorId(request),
      alias: getOrCreateCodeShareAlias(request),
    }
    const sessions = await listCodeShareSessionsByOwner({ actorId: identity.actorId })

    const finalResponse = createAuthJsonResponse({
      sessions,
      viewer: {
        actorId: identity.actorId,
        alias: identity.alias,
      },
      serverNow: new Date().toISOString(),
    })
    ensureCodeShareIdentityCookies(request, finalResponse, identity)
    return finalResponse
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
    const violation = validateAuthMutationRequest(request, locale)
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
          ownerUserId: null,
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
    return finalResponse
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
