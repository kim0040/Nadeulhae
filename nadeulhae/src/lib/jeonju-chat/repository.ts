import type { RowDataPacket } from "mysql2/promise"

import { executeStatement, queryRows } from "@/lib/db"
import { ensureJeonjuChatSchema } from "@/lib/jeonju-chat/schema"
import { decryptDatabaseValue, encryptDatabaseValue } from "@/lib/security/data-protection"

export interface JeonjuChatMessageRow extends RowDataPacket {
  id: number
  user_id: string | null
  nickname: string
  nickname_tag: string
  content: string
  is_anonymous: number
  is_mine?: number
  created_at: Date | string
  created_at_unix?: number | string | null
}

export interface JeonjuChatMessage {
  id: number
  userId: string | null
  nickname: string
  nicknameTag: string
  content: string
  isAnonymous: boolean
  isMine: boolean
  createdAt: string
}

interface JeonjuChatCacheEntry {
  data: JeonjuChatMessage[]
  expiresAt: number
}

const JEONJU_RECENT_CACHE_TTL_MS = 3_000
const JEONJU_DELTA_CACHE_TTL_MS = 1_500
const JEONJU_CHAT_CACHE_MAX_KEYS = 600

declare global {
  var __nadeulhaeJeonjuRecentMessagesCache: Map<string, JeonjuChatCacheEntry> | undefined
  var __nadeulhaeJeonjuDeltaMessagesCache: Map<string, JeonjuChatCacheEntry> | undefined
  var __nadeulhaeJeonjuRecentMessagesInFlight: Map<string, Promise<JeonjuChatMessage[]>> | undefined
  var __nadeulhaeJeonjuDeltaMessagesInFlight: Map<string, Promise<JeonjuChatMessage[]>> | undefined
}

function getRecentMessagesCache() {
  if (!globalThis.__nadeulhaeJeonjuRecentMessagesCache) {
    globalThis.__nadeulhaeJeonjuRecentMessagesCache = new Map()
  }
  return globalThis.__nadeulhaeJeonjuRecentMessagesCache
}

function getDeltaMessagesCache() {
  if (!globalThis.__nadeulhaeJeonjuDeltaMessagesCache) {
    globalThis.__nadeulhaeJeonjuDeltaMessagesCache = new Map()
  }
  return globalThis.__nadeulhaeJeonjuDeltaMessagesCache
}

function getRecentMessagesInFlight() {
  if (!globalThis.__nadeulhaeJeonjuRecentMessagesInFlight) {
    globalThis.__nadeulhaeJeonjuRecentMessagesInFlight = new Map()
  }
  return globalThis.__nadeulhaeJeonjuRecentMessagesInFlight
}

function getDeltaMessagesInFlight() {
  if (!globalThis.__nadeulhaeJeonjuDeltaMessagesInFlight) {
    globalThis.__nadeulhaeJeonjuDeltaMessagesInFlight = new Map()
  }
  return globalThis.__nadeulhaeJeonjuDeltaMessagesInFlight
}

function cloneMessages(messages: JeonjuChatMessage[]) {
  return messages.map((message) => ({ ...message }))
}

function pruneCache<T extends { expiresAt: number }>(map: Map<string, T>, maxKeys: number) {
  const now = Date.now()
  for (const [key, entry] of map.entries()) {
    if (entry.expiresAt <= now) {
      map.delete(key)
    }
  }

  if (map.size <= maxKeys) {
    return
  }

  const overflow = map.size - maxKeys
  let removed = 0
  for (const key of map.keys()) {
    map.delete(key)
    removed += 1
    if (removed >= overflow) {
      break
    }
  }
}

function invalidateMessageCaches() {
  getRecentMessagesCache().clear()
  getDeltaMessagesCache().clear()
  getRecentMessagesInFlight().clear()
  getDeltaMessagesInFlight().clear()
}

function toIsoFromRowTimestamp(value: Date | string, unixTimestamp: number | string | null | undefined) {
  const normalizedUnix = Number(unixTimestamp)
  if (Number.isFinite(normalizedUnix) && normalizedUnix > 0) {
    return new Date(normalizedUnix * 1000).toISOString()
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed) {
      const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T")
      const parsed = new Date(/(?:z|[+-]\d{2}:\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString()
      }
    }
  }

  return new Date().toISOString()
}

function decryptChatContentSafely(value: string) {
  try {
    return decryptDatabaseValue(value, "jeonju.chat.content")
  } catch (error) {
    console.error("Failed to decrypt Jeonju chat content:", error)
    return ""
  }
}

function toPublicMessage(row: JeonjuChatMessageRow): JeonjuChatMessage {
  const createdAt = toIsoFromRowTimestamp(row.created_at, row.created_at_unix)

  return {
    id: row.id,
    userId: row.is_anonymous ? null : row.user_id,
    nickname: row.is_anonymous ? (row.nickname.startsWith("익명") ? row.nickname : "익명") : row.nickname,
    nicknameTag: row.is_anonymous ? "" : row.nickname_tag,
    content: decryptChatContentSafely(row.content),
    isAnonymous: row.is_anonymous === 1,
    isMine: row.is_mine === 1,
    createdAt,
  }
}

const MESSAGE_SELECT_COLS = `
  id, user_id, nickname, nickname_tag, content, is_anonymous, created_at, UNIX_TIMESTAMP(created_at) AS created_at_unix
`

/**
 * 최근 N개의 메시지를 가져옵니다.
 */
export async function getRecentMessages(limit: number = 50, viewerUserId?: string | null): Promise<JeonjuChatMessage[]> {
  await ensureJeonjuChatSchema()
  const normalizedLimit = Math.min(limit, 100)
  const normalizedViewer = viewerUserId?.trim() || "anon"
  const cacheKey = `${normalizedLimit}:${normalizedViewer}`
  const now = Date.now()
  const cache = getRecentMessagesCache()
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cloneMessages(cached.data)
  }

  if (cached) {
    cache.delete(cacheKey)
  }

  const inFlight = getRecentMessagesInFlight().get(cacheKey)
  if (inFlight) {
    return cloneMessages(await inFlight)
  }

  const pending = (async () => {
    const withMineExpr = viewerUserId
      ? "CASE WHEN user_id = ? THEN 1 ELSE 0 END AS is_mine"
      : "0 AS is_mine"

    const params: unknown[] = viewerUserId
      ? [viewerUserId, normalizedLimit]
      : [normalizedLimit]

    const rows = await queryRows<JeonjuChatMessageRow[]>(
      `SELECT ${MESSAGE_SELECT_COLS}, ${withMineExpr}
       FROM jeonju_chat_messages
       WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY created_at DESC
       LIMIT ?`,
      params
    )

    const messages = rows
      .reverse()
      .map(toPublicMessage)
      .filter((message) => message.content.trim().length > 0)
    cache.set(cacheKey, {
      data: messages,
      expiresAt: Date.now() + JEONJU_RECENT_CACHE_TTL_MS,
    })
    pruneCache(cache, JEONJU_CHAT_CACHE_MAX_KEYS)
    return messages
  })()

  const inFlightMap = getRecentMessagesInFlight()
  inFlightMap.set(cacheKey, pending)
  try {
    return cloneMessages(await pending)
  } finally {
    inFlightMap.delete(cacheKey)
  }
}

/**
 * 특정 ID 이후의 새 메시지들을 가져옵니다 (polling용).
 */
export async function getMessagesSince(afterId: number, viewerUserId?: string | null): Promise<JeonjuChatMessage[]> {
  await ensureJeonjuChatSchema()
  const normalizedAfterId = Math.max(0, Math.floor(afterId))
  const normalizedViewer = viewerUserId?.trim() || "anon"
  const cacheKey = `${normalizedAfterId}:${normalizedViewer}`
  const now = Date.now()
  const cache = getDeltaMessagesCache()
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cloneMessages(cached.data)
  }

  if (cached) {
    cache.delete(cacheKey)
  }

  const inFlight = getDeltaMessagesInFlight().get(cacheKey)
  if (inFlight) {
    return cloneMessages(await inFlight)
  }

  const pending = (async () => {
    const withMineExpr = viewerUserId
      ? "CASE WHEN user_id = ? THEN 1 ELSE 0 END AS is_mine"
      : "0 AS is_mine"

    const params: unknown[] = viewerUserId
      ? [viewerUserId, normalizedAfterId]
      : [normalizedAfterId]

    const rows = await queryRows<JeonjuChatMessageRow[]>(
      `SELECT ${MESSAGE_SELECT_COLS}, ${withMineExpr}
       FROM jeonju_chat_messages
       WHERE id > ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY created_at ASC
       LIMIT 50`,
      params
    )

    const messages = rows
      .map(toPublicMessage)
      .filter((message) => message.content.trim().length > 0)
    cache.set(cacheKey, {
      data: messages,
      expiresAt: Date.now() + JEONJU_DELTA_CACHE_TTL_MS,
    })
    pruneCache(cache, JEONJU_CHAT_CACHE_MAX_KEYS)
    return messages
  })()

  const inFlightMap = getDeltaMessagesInFlight()
  inFlightMap.set(cacheKey, pending)
  try {
    return cloneMessages(await pending)
  } finally {
    inFlightMap.delete(cacheKey)
  }
}

/**
 * 새 메시지를 저장합니다.
 */
export async function createChatMessage(input: {
  userId: string
  nickname: string
  nicknameTag: string
  content: string
  isAnonymous: boolean
}): Promise<JeonjuChatMessage> {
  await ensureJeonjuChatSchema()

  const result = await executeStatement(
    `INSERT INTO jeonju_chat_messages
       (user_id, nickname, nickname_tag, content, is_anonymous)
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.userId,
      input.isAnonymous ? "익명" : input.nickname,
      input.isAnonymous ? "0000" : input.nicknameTag,
      encryptDatabaseValue(input.content, "jeonju.chat.content"),
      input.isAnonymous ? 1 : 0,
    ]
  )

  const insertId = (result as { insertId?: number }).insertId
  if (!insertId) {
    throw new Error("Failed to insert chat message")
  }

  const rows = await queryRows<JeonjuChatMessageRow[]>(
    `SELECT ${MESSAGE_SELECT_COLS}
     FROM jeonju_chat_messages
     WHERE id = ?`,
    [insertId]
  )

  if (!rows[0]) {
    throw new Error("Could not reload inserted message")
  }
  const created = toPublicMessage(rows[0])
  invalidateMessageCaches()
  return created
}

/**
 * 7일 지난 메시지를 정리합니다.
 */
export async function cleanupOldMessages(): Promise<void> {
  await ensureJeonjuChatSchema()

  await executeStatement(
    `DELETE FROM jeonju_chat_messages
     WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    []
  )
  invalidateMessageCaches()
}
