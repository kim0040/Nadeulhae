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
  isValidCodeShareSessionId,
  toCodeShareRoomName,
} from "@/lib/code-share/constants"
import {
  closeInactiveCodeShareSessions,
  deleteCodeShareSessionById,
  getCodeShareSessionById,
  isCodeShareSessionOwner,
  touchCodeShareSessionActivity,
  updateCodeShareSession,
} from "@/lib/code-share/repository"
import { broadcastToRoom } from "@/lib/websocket/broadcast"

export const runtime = "nodejs"

const CODE_SHARE_DETAIL_ERRORS = {
  ko: {
    invalidSessionId: "코드공유 세션 식별자가 올바르지 않습니다.",
    invalidRequest: "코드공유 요청 형식이 올바르지 않습니다.",
    notFound: "코드공유 세션을 찾을 수 없습니다.",
    closed: "세션이 종료되어 더 이상 수정할 수 없습니다.",
    versionConflict: "다른 사용자의 변경이 먼저 반영되었습니다. 최신 상태로 동기화해 주세요.",
    unauthorized: "세션 삭제는 로그인한 생성자만 할 수 있습니다.",
    forbidden: "이 세션은 생성자만 삭제할 수 있습니다.",
    rateLimited: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    deleteDailyLimit: "오늘 세션 삭제 가능 횟수를 모두 사용했습니다. 내일 다시 시도해 주세요.",
    failed: "코드공유 세션 처리 중 오류가 발생했습니다.",
  },
  en: {
    invalidSessionId: "Invalid code-share session id.",
    invalidRequest: "Invalid code-share request.",
    notFound: "Code-share session not found.",
    closed: "This session has been closed and is read-only.",
    versionConflict: "Another participant updated first. Please sync with the latest state.",
    unauthorized: "Only the signed-in creator can delete this session.",
    forbidden: "Only the creator can delete this session.",
    rateLimited: "Too many requests. Please try again shortly.",
    deleteDailyLimit: "You have reached today's session deletion limit. Please try again tomorrow.",
    failed: "Failed to process code-share session.",
  },
  zh: {
    invalidSessionId: "代码共享会话标识符无效。",
    invalidRequest: "代码共享请求格式不正确。",
    notFound: "找不到代码共享会话。",
    closed: "该会话已关闭，无法再修改。",
    versionConflict: "其他用户的更改已先提交，请同步到最新状态。",
    unauthorized: "只有登录的创建者才能删除此会话。",
    forbidden: "只有创建者才能删除此会话。",
    rateLimited: "请求过多，请稍后再试。",
    deleteDailyLimit: "今天的会话删除次数已用完，请明天再试。",
    failed: "代码共享会话处理失败。",
  },
  ja: {
    invalidSessionId: "コード共有セッションIDが無効です。",
    invalidRequest: "コード共有リクエストの形式が正しくありません。",
    notFound: "コード共有セッションが見つかりません。",
    closed: "このセッションは終了しており、これ以上編集できません。",
    versionConflict: "他の参加者が先に更新しました。最新の状態と同期してください。",
    unauthorized: "ログインした作成者のみがこのセッションを削除できます。",
    forbidden: "作成者のみがこのセッションを削除できます。",
    rateLimited: "リクエストが多すぎます。しばらくしてからもう一度お試しください。",
    deleteDailyLimit: "今日のセッション削除回数の上限に達しました。明日もう一度お試しください。",
    failed: "コード共有セッションの処理中にエラーが発生しました。",
  },
} as const

type CodeShareLocale = keyof typeof CODE_SHARE_DETAIL_ERRORS

type RateLimitEntry = {
  count: number
  windowStartMs: number
}

declare global {
  var __codeSharePatchWindowMap: Map<string, RateLimitEntry> | undefined
  var __codeShareDeleteWindowMap: Map<string, RateLimitEntry> | undefined
  var __codeShareDeleteDailyMap: Map<string, RateLimitEntry> | undefined
}

const PATCH_WINDOW_MS = 5_000
const PATCH_WINDOW_LIMIT = 10
const DELETE_WINDOW_MS = 60_000
const DELETE_WINDOW_LIMIT = 3
const DELETE_DAILY_LIMIT = 20
const RATE_LIMIT_MAX_ENTRIES = 4000

function getPatchWindowMap() {
  if (!globalThis.__codeSharePatchWindowMap) globalThis.__codeSharePatchWindowMap = new Map()
  return globalThis.__codeSharePatchWindowMap
}

function getDeleteWindowMap() {
  if (!globalThis.__codeShareDeleteWindowMap) globalThis.__codeShareDeleteWindowMap = new Map()
  return globalThis.__codeShareDeleteWindowMap
}

function getDeleteDailyMap() {
  if (!globalThis.__codeShareDeleteDailyMap) globalThis.__codeShareDeleteDailyMap = new Map()
  return globalThis.__codeShareDeleteDailyMap
}

function cleanupRateLimitMap(map: Map<string, RateLimitEntry>, windowMs: number, nowMs: number) {
  for (const [key, value] of map.entries()) {
    if (nowMs - value.windowStartMs > windowMs * 2) map.delete(key)
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

function checkFixedWindow(map: Map<string, RateLimitEntry>, key: string, limit: number, windowMs: number, nowMs: number) {
  const current = map.get(key)
  if (!current || nowMs - current.windowStartMs >= windowMs) {
    map.set(key, { count: 1, windowStartMs: nowMs })
    return { allowed: true }
  }
  if (current.count >= limit) return { allowed: false }
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

function normalizeSessionId(value: string) {
  const normalized = value.trim()
  if (!isValidCodeShareSessionId(normalized)) {
    return null
  }

  return normalized
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

function normalizeExpectedVersion(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  const integer = Math.floor(parsed)
  return integer >= 1 ? integer : null
}

// UI permissions are materialized server-side so every client gets the same policy.
function withSessionPermissions<T extends {
  sessionId: string
  status: string
}>(
  session: T,
  isOwner: boolean
) {
  return {
    ...session,
    isOwner,
    canDelete: isOwner,
    canEdit: session.status === "active",
  }
}

async function handleGET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const locale = getLocale(request)

  try {
    const { sessionId: rawSessionId } = await context.params
    const sessionId = normalizeSessionId(rawSessionId)
    if (!sessionId) {
      return createAuthJsonResponse(
        { error: CODE_SHARE_DETAIL_ERRORS[locale].invalidSessionId },
        { status: 400 }
      )
    }

    await closeInactiveCodeShareSessions()

    const session = await getCodeShareSessionById(sessionId)
    if (!session) {
      return createAuthJsonResponse(
        { error: CODE_SHARE_DETAIL_ERRORS[locale].notFound },
        { status: 404 }
      )
    }

    const identity = {
      actorId: getOrCreateCodeShareActorId(request),
      alias: getOrCreateCodeShareAlias(request),
    }
    const actorId = identity.actorId
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    const isOwner = await isCodeShareSessionOwner({
      sessionId,
      actorId,
      userId: authenticatedSession?.user.id ?? null,
    })

    // Reads from active sessions count as activity so collaborative sessions remain open while viewed.
    if (session.status === "active") {
      await touchCodeShareSessionActivity(sessionId)
    }

    const refreshed = await getCodeShareSessionById(sessionId)
    if (!refreshed) {
      return createAuthJsonResponse(
        { error: CODE_SHARE_DETAIL_ERRORS[locale].notFound },
        { status: 404 }
      )
    }

    const response = createAuthJsonResponse({
      session: withSessionPermissions(refreshed, isOwner),
      viewer: {
        actorId: identity.actorId,
        alias: identity.alias,
      },
      serverNow: new Date().toISOString(),
    })
    ensureCodeShareIdentityCookies(request, response, identity)
    return attachRefreshedAuthCookie(response, authenticatedSession)
  } catch (error) {
    console.error("Code-share session GET API failed:", error)
    return createAuthJsonResponse(
      { error: CODE_SHARE_DETAIL_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

async function handlePATCH(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const locale = getLocale(request)

  try {
    const authLocale = locale === "zh" || locale === "ja" ? "en" : locale
    const violation = validateAuthMutationRequest(request, authLocale)
    if (violation) {
      return violation
    }

    const { sessionId: rawSessionId } = await context.params
    const sessionId = normalizeSessionId(rawSessionId)
    if (!sessionId) {
      return createAuthJsonResponse(
        { error: CODE_SHARE_DETAIL_ERRORS[locale].invalidSessionId },
        { status: 400 }
      )
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return createAuthJsonResponse(
        { error: CODE_SHARE_DETAIL_ERRORS[locale].invalidRequest },
        { status: 400 }
      )
    }

    const expectedVersion = normalizeExpectedVersion(
      typeof payload === "object" && payload && "version" in payload
        ? (payload as { version?: unknown }).version
        : null
    )

    if (!expectedVersion) {
      return createAuthJsonResponse(
        { error: CODE_SHARE_DETAIL_ERRORS[locale].invalidRequest },
        { status: 400 }
      )
    }

    await closeInactiveCodeShareSessions()

    const nowMs = Date.now()
    const patchWindowMap = getPatchWindowMap()
    cleanupRateLimitMap(patchWindowMap, PATCH_WINDOW_MS, nowMs)
    if (!checkFixedWindow(patchWindowMap, getClientKey(request), PATCH_WINDOW_LIMIT, PATCH_WINDOW_MS, nowMs).allowed) {
      return createAuthJsonResponse(
        { error: CODE_SHARE_DETAIL_ERRORS[locale].rateLimited },
        { status: 429 }
      )
    }

    const updateResult = await updateCodeShareSession({
      sessionId,
      title: normalizeTitle(
        typeof payload === "object" && payload && "title" in payload
          ? (payload as { title?: unknown }).title
          : undefined
      ),
      language: normalizeLanguage(
        typeof payload === "object" && payload && "language" in payload
          ? (payload as { language?: unknown }).language
          : undefined
      ),
      code: normalizeCode(
        typeof payload === "object" && payload && "code" in payload
          ? (payload as { code?: unknown }).code
          : undefined
      ),
      expectedVersion,
    })

    const identity = {
      actorId: getOrCreateCodeShareActorId(request),
      alias: getOrCreateCodeShareAlias(request),
    }
    const actorId = identity.actorId
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)

    if (!updateResult.ok) {
      const isOwner = updateResult.session
        ? await isCodeShareSessionOwner({
          sessionId,
          actorId,
          userId: authenticatedSession?.user.id ?? null,
        })
        : false

      if (updateResult.reason === "not_found") {
        return createAuthJsonResponse(
          { error: CODE_SHARE_DETAIL_ERRORS[locale].notFound },
          { status: 404 }
        )
      }

      if (updateResult.reason === "closed") {
        const response = createAuthJsonResponse(
          {
            error: CODE_SHARE_DETAIL_ERRORS[locale].closed,
            session: updateResult.session
              ? withSessionPermissions(updateResult.session, isOwner)
              : null,
          },
          { status: 409 }
        )
        ensureCodeShareIdentityCookies(request, response, identity)
        return attachRefreshedAuthCookie(response, authenticatedSession)
      }

      // For conflict responses we include latest server snapshot so clients can recover without extra request.
      const response = createAuthJsonResponse(
        {
          error: CODE_SHARE_DETAIL_ERRORS[locale].versionConflict,
          session: updateResult.session
            ? withSessionPermissions(updateResult.session, isOwner)
            : null,
        },
        { status: 409 }
      )
      ensureCodeShareIdentityCookies(request, response, identity)
      return attachRefreshedAuthCookie(response, authenticatedSession)
    }

    const isOwner = await isCodeShareSessionOwner({
      sessionId,
      actorId,
      userId: authenticatedSession?.user.id ?? null,
    })

    // Broadcast full snapshot so connected peers can update immediately.
    broadcastToRoom(
      toCodeShareRoomName(sessionId),
      "code_share_patch",
      {
        session: withSessionPermissions(updateResult.session, false),
        actor: {
          actorId: identity.actorId,
          alias: identity.alias,
        },
      }
    )

    const response = createAuthJsonResponse({
      session: withSessionPermissions(updateResult.session, isOwner),
      viewer: {
        actorId: identity.actorId,
        alias: identity.alias,
      },
      serverNow: new Date().toISOString(),
    })
    ensureCodeShareIdentityCookies(request, response, identity)
    return attachRefreshedAuthCookie(response, authenticatedSession)
  } catch (error) {
    console.error("Code-share session PATCH API failed:", error)
    return createAuthJsonResponse(
      { error: CODE_SHARE_DETAIL_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

async function handleDELETE(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const locale = getLocale(request)

  try {
    const authLocale = locale === "zh" || locale === "ja" ? "en" : locale
    const violation = validateAuthMutationRequest(request, authLocale)
    if (violation) {
      return violation
    }

    const { sessionId: rawSessionId } = await context.params
    const sessionId = normalizeSessionId(rawSessionId)
    if (!sessionId) {
      return createAuthJsonResponse(
        { error: CODE_SHARE_DETAIL_ERRORS[locale].invalidSessionId },
        { status: 400 }
      )
    }

    const identity = {
      actorId: getOrCreateCodeShareActorId(request),
      alias: getOrCreateCodeShareAlias(request),
    }
    const actorId = identity.actorId
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: CODE_SHARE_DETAIL_ERRORS[locale].unauthorized },
          { status: 401 }
        )
      )
    }

    const nowMs = Date.now()
    const deleteClientKey = getClientKey(request)
    const deleteWindowMap = getDeleteWindowMap()
    const deleteDailyMap = getDeleteDailyMap()
    cleanupRateLimitMap(deleteWindowMap, DELETE_WINDOW_MS, nowMs)
    cleanupRateLimitMap(deleteDailyMap, DELETE_WINDOW_MS, nowMs)

    if (!checkFixedWindow(deleteWindowMap, deleteClientKey, DELETE_WINDOW_LIMIT, DELETE_WINDOW_MS, nowMs).allowed) {
      return createAuthJsonResponse(
        { error: CODE_SHARE_DETAIL_ERRORS[locale].rateLimited },
        { status: 429 }
      )
    }

    if (!checkFixedWindow(deleteDailyMap, `${deleteClientKey}:daily`, DELETE_DAILY_LIMIT, 24 * 60 * 60 * 1000, nowMs).allowed) {
      return createAuthJsonResponse(
        { error: CODE_SHARE_DETAIL_ERRORS[locale].deleteDailyLimit },
        { status: 429 }
      )
    }

    const deleteResult = await deleteCodeShareSessionById({
      sessionId,
      actorId,
      userId: authenticatedSession.user.id,
    })

    if (!deleteResult.ok) {
      if (deleteResult.reason === "not_found") {
        return createAuthJsonResponse(
          { error: CODE_SHARE_DETAIL_ERRORS[locale].notFound },
          { status: 404 }
        )
      }

      return createAuthJsonResponse(
        { error: CODE_SHARE_DETAIL_ERRORS[locale].forbidden },
        { status: 403 }
      )
    }

    // Notify active collaborators that the session no longer exists.
    broadcastToRoom(
      toCodeShareRoomName(sessionId),
      "code_share_deleted",
      {
        sessionId,
        actor: {
          actorId: identity.actorId,
          alias: identity.alias,
        },
      }
    )

    const response = createAuthJsonResponse({
      deleted: true,
      sessionId,
      viewer: {
        actorId: identity.actorId,
        alias: identity.alias,
      },
      serverNow: new Date().toISOString(),
    })
    ensureCodeShareIdentityCookies(request, response, identity)
    return attachRefreshedAuthCookie(response, authenticatedSession)
  } catch (error) {
    console.error("Code-share session DELETE API failed:", error)
    return createAuthJsonResponse(
      { error: CODE_SHARE_DETAIL_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

export const GET = withApiAnalytics(handleGET)
export const PATCH = withApiAnalytics(handlePATCH)
export const DELETE = withApiAnalytics(handleDELETE)
