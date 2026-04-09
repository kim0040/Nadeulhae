import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise"

import {
  CHAT_COMPACTION_KEEP_MESSAGE_COUNT,
  CHAT_COMPACTION_TRIGGER_ESTIMATED_TOKENS,
  CHAT_COMPACTION_TRIGGER_MESSAGE_COUNT,
  CHAT_DAILY_REQUEST_LIMIT,
  CHAT_INPUT_MAX_CHARACTERS,
  CHAT_MEMORY_SUMMARY_MAX_CHARACTERS,
  CHAT_TIME_ZONE,
  CHAT_VISIBLE_MESSAGE_LIMIT,
  estimateTextTokens,
} from "@/lib/chat/constants"
import { ensureChatSchema } from "@/lib/chat/schema"
import type {
  ChatConversationMessage,
  ChatLocale,
  ChatMemorySnapshot,
  ChatPolicySnapshot,
  ChatRequestKind,
  ChatRequestStatus,
  ChatSessionSnapshot,
  ChatStateResponse,
  ChatUsageSnapshot,
  FactChatUsage,
} from "@/lib/chat/types"
import { getDbPool, queryRows } from "@/lib/db"
import {
  decryptDatabaseValue,
  encryptDatabaseValue,
} from "@/lib/security/data-protection"

interface ChatMessageRow extends RowDataPacket {
  id: number
  user_id: string
  session_id: number | null
  role: "user" | "assistant"
  locale: string
  content: string
  resolved_model: string | null
  included_in_memory_at: Date | string | null
  created_at: Date | string
}

interface ChatMemoryRow extends RowDataPacket {
  user_id: string
  summary_text: string
  assessment_text: string | null
  summary_token_estimate: number
  summarized_message_count: number
  last_profile_message_id: number | null
  model_used: string | null
  profile_model_used: string | null
  profile_refreshed_at: Date | string | null
  updated_at: Date | string
}

interface ChatSessionRow extends RowDataPacket {
  id: number
  user_id: string
  title: string
  locale: string
  is_auto_title: number
  memory_summary_text: string | null
  memory_token_estimate: number
  summarized_message_count: number
  memory_model_used: string | null
  last_compacted_at: Date | string | null
  last_message_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

interface ChatSessionWithCountRow extends ChatSessionRow {
  message_count: number
}

interface ChatUsageRow extends RowDataPacket {
  metric_date: Date | string
  user_id: string
  request_count: number
  success_count: number
  failure_count: number
  summary_count: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cached_prompt_tokens: number
  summary_prompt_tokens: number
  summary_completion_tokens: number
  summary_total_tokens: number
}

interface ChatMessageIdRow extends RowDataPacket {
  id: number
}

const CHAT_SESSION_TITLE_MAX_LENGTH = 120
const CHAT_PROFILE_MEMORY_MIN_NEW_MESSAGES = 4
const CHAT_PROFILE_MEMORY_INITIAL_MIN_MESSAGES = 3
const CHAT_PROFILE_MEMORY_CANDIDATE_LIMIT = 24
const CHAT_PROFILE_SUMMARY_MAX_CHARACTERS = 1400
const CHAT_PROFILE_ASSESSMENT_MAX_CHARACTERS = 900
const CHAT_STATE_CACHE_TTL_MS = 8_000
const CHAT_SESSIONS_CACHE_TTL_MS = 8_000
const CHAT_STATE_CACHE_MAX_KEYS = 1200

interface ChatStateCacheEntry {
  data: ChatStateResponse
  expiresAt: number
}

interface ChatSessionsCacheEntry {
  data: ChatSessionSnapshot[]
  expiresAt: number
}

declare global {
  var __nadeulhaeChatStateCache: Map<string, ChatStateCacheEntry> | undefined
  var __nadeulhaeChatStateInFlight: Map<string, Promise<ChatStateResponse>> | undefined
  var __nadeulhaeChatSessionsCache: Map<string, ChatSessionsCacheEntry> | undefined
}

function getChatStateCache() {
  if (!globalThis.__nadeulhaeChatStateCache) {
    globalThis.__nadeulhaeChatStateCache = new Map()
  }
  return globalThis.__nadeulhaeChatStateCache
}

function getChatStateInFlight() {
  if (!globalThis.__nadeulhaeChatStateInFlight) {
    globalThis.__nadeulhaeChatStateInFlight = new Map()
  }
  return globalThis.__nadeulhaeChatStateInFlight
}

function getChatSessionsCache() {
  if (!globalThis.__nadeulhaeChatSessionsCache) {
    globalThis.__nadeulhaeChatSessionsCache = new Map()
  }
  return globalThis.__nadeulhaeChatSessionsCache
}

function pruneChatCacheMap<T extends { expiresAt: number }>(map: Map<string, T>, maxKeys: number) {
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

function cloneChatMemorySnapshot(memory: ChatMemorySnapshot | null): ChatMemorySnapshot | null {
  if (!memory) {
    return null
  }

  return {
    summary: memory.summary,
    updatedAt: memory.updatedAt,
    summarizedMessageCount: memory.summarizedMessageCount,
    modelUsed: memory.modelUsed,
  }
}

function cloneChatStateSnapshot(state: ChatStateResponse): ChatStateResponse {
  return {
    messages: state.messages.map((message) => ({ ...message })),
    memory: cloneChatMemorySnapshot(state.memory),
    usage: { ...state.usage },
    policy: { ...state.policy },
    sessions: state.sessions.map((session) => ({ ...session })),
    activeSessionId: state.activeSessionId,
  }
}

function buildChatStateCacheKey(input: {
  userId: string
  locale: ChatLocale
  requestedSessionId?: string | null
}) {
  return `${input.userId}:${input.locale}:${input.requestedSessionId ?? "auto"}`
}

export function invalidateChatCacheForUser(userId: string) {
  const stateCache = getChatStateCache()
  for (const key of stateCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      stateCache.delete(key)
    }
  }

  const inFlight = getChatStateInFlight()
  for (const key of inFlight.keys()) {
    if (key.startsWith(`${userId}:`)) {
      inFlight.delete(key)
    }
  }

  getChatSessionsCache().delete(userId)
}

function toIsoString(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

function getKstMetricDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHAT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function createEmptyUsage(metricDate: string): ChatUsageSnapshot {
  return {
    metricDate,
    requestCount: 0,
    remainingRequests: CHAT_DAILY_REQUEST_LIMIT,
    dailyLimit: CHAT_DAILY_REQUEST_LIMIT,
    successCount: 0,
    failureCount: 0,
    summaryCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cachedPromptTokens: 0,
    summaryPromptTokens: 0,
    summaryCompletionTokens: 0,
    summaryTotalTokens: 0,
  }
}

function toUsageSnapshot(row: ChatUsageRow | null, metricDate: string) {
  if (!row) {
    return createEmptyUsage(metricDate)
  }

  const requestCount = Math.max(0, row.request_count)
  return {
    metricDate,
    requestCount,
    remainingRequests: Math.max(0, CHAT_DAILY_REQUEST_LIMIT - requestCount),
    dailyLimit: CHAT_DAILY_REQUEST_LIMIT,
    successCount: Math.max(0, row.success_count),
    failureCount: Math.max(0, row.failure_count),
    summaryCount: Math.max(0, row.summary_count),
    promptTokens: Math.max(0, row.prompt_tokens),
    completionTokens: Math.max(0, row.completion_tokens),
    totalTokens: Math.max(0, row.total_tokens),
    cachedPromptTokens: Math.max(0, row.cached_prompt_tokens),
    summaryPromptTokens: Math.max(0, row.summary_prompt_tokens),
    summaryCompletionTokens: Math.max(0, row.summary_completion_tokens),
    summaryTotalTokens: Math.max(0, row.summary_total_tokens),
  } satisfies ChatUsageSnapshot
}

function toConversationMessage(row: ChatMessageRow): ChatConversationMessage {
  return {
    id: String(row.id),
    role: row.role,
    content: decryptDatabaseValue(row.content, `chat.message.${row.role}`),
    createdAt: toIsoString(row.created_at),
    resolvedModel: row.resolved_model,
  }
}

function toSessionMemorySnapshot(row: ChatSessionRow | null): ChatMemorySnapshot | null {
  if (!row || !row.memory_summary_text) {
    return null
  }

  return {
    summary: decryptDatabaseValue(row.memory_summary_text, "chat.session.memory"),
    updatedAt: toIsoString(row.updated_at),
    summarizedMessageCount: Math.max(0, row.summarized_message_count),
    modelUsed: row.memory_model_used,
  }
}

function toProfileMemorySnapshot(row: ChatMemoryRow | null) {
  if (!row) {
    return null
  }

  return {
    summary: decryptDatabaseValue(row.summary_text, "chat.memory.summary"),
    assessment: row.assessment_text
      ? decryptDatabaseValue(row.assessment_text, "chat.profile.assessment")
      : null,
    updatedAt: toIsoString(row.updated_at),
    refreshedAt: row.profile_refreshed_at ? toIsoString(row.profile_refreshed_at) : null,
    summarizedMessageCount: Math.max(0, row.summarized_message_count),
    lastProfileMessageId: row.last_profile_message_id,
    modelUsed: row.profile_model_used ?? row.model_used,
  }
}

function toSessionSnapshot(row: ChatSessionWithCountRow): ChatSessionSnapshot {
  return {
    id: String(row.id),
    title: decryptDatabaseValue(row.title, "chat.session.title"),
    locale: row.locale === "en" ? "en" : "ko",
    isAutoTitle: Boolean(row.is_auto_title),
    messageCount: Math.max(0, row.message_count),
    lastMessageAt: row.last_message_at ? toIsoString(row.last_message_at) : null,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  }
}

function normalizeSessionTitle(value: string, fallback: string) {
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, CHAT_SESSION_TITLE_MAX_LENGTH)
  return normalized || fallback
}

function buildDefaultSessionTitle(locale: ChatLocale) {
  return locale === "ko" ? "새 대화" : "New chat"
}

async function withLockedDailyUsage<T>(
  userId: string,
  callback: (
    connection: PoolConnection,
    metricDate: string,
    row: ChatUsageRow
  ) => Promise<T>
) {
  await ensureChatSchema()

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()
    const metricDate = getKstMetricDate()

    await connection.execute(
      `
        INSERT INTO user_chat_usage_daily (
          metric_date,
          user_id,
          last_used_at
        ) VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE last_used_at = last_used_at
      `,
      [metricDate, userId]
    )

    const [rows] = await connection.query<ChatUsageRow[]>(
      `
        SELECT
          metric_date,
          user_id,
          request_count,
          success_count,
          failure_count,
          summary_count,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          cached_prompt_tokens,
          summary_prompt_tokens,
          summary_completion_tokens,
          summary_total_tokens
        FROM user_chat_usage_daily
        WHERE metric_date = ?
          AND user_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [metricDate, userId]
    )

    const row = rows[0]
    if (!row) {
      throw new Error("Failed to lock daily chat usage row.")
    }

    const result = await callback(connection, metricDate, row)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function reserveDailyChatRequest(userId: string) {
  const result = await withLockedDailyUsage(userId, async (connection, metricDate, row) => {
    if (row.request_count >= CHAT_DAILY_REQUEST_LIMIT) {
      return {
        allowed: false,
        usage: toUsageSnapshot(row, metricDate),
      } as const
    }

    await connection.execute(
      `
        UPDATE user_chat_usage_daily
        SET request_count = request_count + 1,
            last_used_at = NOW()
        WHERE metric_date = ?
          AND user_id = ?
      `,
      [metricDate, userId]
    )

    return {
      allowed: true,
      usage: toUsageSnapshot(
        {
          ...row,
          request_count: row.request_count + 1,
        } as ChatUsageRow,
        metricDate
      ),
    } as const
  })

  if (result.allowed) {
    invalidateChatCacheForUser(userId)
  }

  return result
}

export async function getChatUsageSnapshot(userId: string) {
  await ensureChatSchema()

  const metricDate = getKstMetricDate()
  const rows = await queryRows<ChatUsageRow[]>(
    `
      SELECT
        metric_date,
        user_id,
        request_count,
        success_count,
        failure_count,
        summary_count,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        cached_prompt_tokens,
        summary_prompt_tokens,
        summary_completion_tokens,
        summary_total_tokens
      FROM user_chat_usage_daily
      WHERE metric_date = ?
        AND user_id = ?
      LIMIT 1
    `,
    [metricDate, userId]
  )

  return toUsageSnapshot(rows[0] ?? null, metricDate)
}

function parseSessionId(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value)
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}

async function listChatSessionRows(userId: string) {
  await ensureChatSchema()

  const rows = await queryRows<ChatSessionWithCountRow[]>(
    `
      SELECT
        s.id,
        s.user_id,
        s.title,
        s.locale,
        s.is_auto_title,
        s.memory_summary_text,
        s.memory_token_estimate,
        s.summarized_message_count,
        s.memory_model_used,
        s.last_compacted_at,
        s.last_message_at,
        s.created_at,
        s.updated_at,
        COALESCE(m.message_count, 0) AS message_count
      FROM user_chat_sessions s
      LEFT JOIN (
        SELECT session_id, COUNT(*) AS message_count
        FROM user_chat_messages
        WHERE user_id = ?
          AND session_id IS NOT NULL
        GROUP BY session_id
      ) m
        ON m.session_id = s.id
      WHERE s.user_id = ?
      ORDER BY COALESCE(s.last_message_at, s.updated_at, s.created_at) DESC, s.id DESC
    `,
    [userId, userId]
  )

  return rows
}

async function insertChatSession(input: {
  connection: PoolConnection
  userId: string
  locale: ChatLocale
  title: string
  isAutoTitle: boolean
}) {
  const encryptedTitle = encryptDatabaseValue(input.title, "chat.session.title")
  const [result] = await input.connection.execute<ResultSetHeader>(
    `
      INSERT INTO user_chat_sessions (
        user_id,
        title,
        locale,
        is_auto_title
      ) VALUES (?, ?, ?, ?)
    `,
    [input.userId, encryptedTitle, input.locale, input.isAutoTitle ? 1 : 0]
  )

  return Number(result.insertId)
}

async function ensureLegacyMessagesAssignedToSession(userId: string) {
  const rows = await queryRows<ChatSessionRow[]>(
    `
      SELECT id
      FROM user_chat_sessions
      WHERE user_id = ?
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    `,
    [userId]
  )

  const baseSession = rows[0]
  if (!baseSession) {
    return
  }

  const [result] = await getDbPool().execute<ResultSetHeader>(
    `
      UPDATE user_chat_messages
      SET session_id = ?
      WHERE user_id = ?
        AND session_id IS NULL
    `,
    [baseSession.id, userId]
  )

  if (result.affectedRows > 0) {
    invalidateChatCacheForUser(userId)
  }
}

export async function listChatSessions(userId: string) {
  const cache = getChatSessionsCache()
  const now = Date.now()
  const cached = cache.get(userId)
  if (cached && cached.expiresAt > now) {
    return cached.data.map((session) => ({ ...session }))
  }

  if (cached) {
    cache.delete(userId)
  }

  const rows = await listChatSessionRows(userId)
  const sessions = rows.map(toSessionSnapshot)
  cache.set(userId, {
    data: sessions,
    expiresAt: now + CHAT_SESSIONS_CACHE_TTL_MS,
  })
  pruneChatCacheMap(cache, Math.max(200, Math.floor(CHAT_STATE_CACHE_MAX_KEYS / 3)))
  return sessions.map((session) => ({ ...session }))
}

export async function createChatSession(input: {
  userId: string
  locale: ChatLocale
  title?: string | null
}) {
  await ensureChatSchema()
  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()
    const title = normalizeSessionTitle(
      input.title ?? "",
      buildDefaultSessionTitle(input.locale)
    )
    const sessionId = await insertChatSession({
      connection,
      userId: input.userId,
      locale: input.locale,
      title,
      isAutoTitle: !input.title || !input.title.trim(),
    })
    await connection.commit()
    invalidateChatCacheForUser(input.userId)
    return String(sessionId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function deleteChatSession(input: {
  userId: string
  sessionId: string
}) {
  const parsedSessionId = parseSessionId(input.sessionId)
  if (!parsedSessionId) {
    return null
  }

  await ensureChatSchema()
  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()
    const [ownedRows] = await connection.query<ChatMessageIdRow[]>(
      `
        SELECT id
        FROM user_chat_sessions
        WHERE user_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [input.userId, parsedSessionId]
    )

    if (ownedRows.length === 0) {
      await connection.rollback()
      return null
    }

    const [countRows] = await connection.query<Array<RowDataPacket & { total: number }>>(
      `
        SELECT COUNT(*) AS total
        FROM user_chat_sessions
        WHERE user_id = ?
      `,
      [input.userId]
    )

    if ((countRows[0]?.total ?? 0) <= 1) {
      await connection.rollback()
      return null
    }

    await connection.execute(
      `
        DELETE FROM user_chat_request_events
        WHERE user_id = ?
          AND session_id = ?
      `,
      [input.userId, parsedSessionId]
    )

    await connection.execute(
      `
        DELETE FROM user_chat_messages
        WHERE user_id = ?
          AND session_id = ?
      `,
      [input.userId, parsedSessionId]
    )

    await connection.execute(
      `
        DELETE FROM user_chat_sessions
        WHERE user_id = ?
          AND id = ?
      `,
      [input.userId, parsedSessionId]
    )

    await connection.commit()
    invalidateChatCacheForUser(input.userId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const remaining = await listChatSessions(input.userId)
  return remaining[0]?.id ?? null
}

export async function resolveChatSession(input: {
  userId: string
  locale: ChatLocale
  requestedSessionId?: string | null
}) {
  await ensureChatSchema()

  let sessionRows = await listChatSessionRows(input.userId)
  if (sessionRows.length === 0) {
    const createdId = await createChatSession({
      userId: input.userId,
      locale: input.locale,
      title: null,
    })

    const parsedCreatedId = parseSessionId(createdId)
    if (parsedCreatedId) {
      const [result] = await getDbPool().execute<ResultSetHeader>(
        `
          UPDATE user_chat_messages
          SET session_id = ?
          WHERE user_id = ?
            AND session_id IS NULL
        `,
        [parsedCreatedId, input.userId]
      )

      if (result.affectedRows > 0) {
        invalidateChatCacheForUser(input.userId)
      }
    }
    sessionRows = await listChatSessionRows(input.userId)
  } else {
    await ensureLegacyMessagesAssignedToSession(input.userId)
    sessionRows = await listChatSessionRows(input.userId)
  }

  if (sessionRows.length === 0) {
    throw new Error("Unable to resolve a chat session.")
  }

  const requestedSessionId = parseSessionId(input.requestedSessionId)
  const active = requestedSessionId
    ? sessionRows.find((row) => row.id === requestedSessionId) ?? sessionRows[0]
    : sessionRows[0]

  return {
    activeSessionId: active.id,
    activeSession: active,
    sessions: sessionRows.map(toSessionSnapshot),
  }
}

export async function getChatMemorySnapshot(userId: string) {
  await ensureChatSchema()

  const rows = await queryRows<ChatMemoryRow[]>(
    `
      SELECT
        user_id,
        summary_text,
        assessment_text,
        summary_token_estimate,
        summarized_message_count,
        last_profile_message_id,
        model_used,
        profile_model_used,
        profile_refreshed_at,
        updated_at
      FROM user_chat_memory
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId]
  )

  return toProfileMemorySnapshot(rows[0] ?? null)
}

export async function getChatSessionMemorySnapshot(input: {
  userId: string
  sessionId: number
}) {
  await ensureChatSchema()

  const rows = await queryRows<ChatSessionRow[]>(
    `
      SELECT
        id,
        user_id,
        title,
        locale,
        is_auto_title,
        memory_summary_text,
        memory_token_estimate,
        summarized_message_count,
        memory_model_used,
        last_compacted_at,
        last_message_at,
        created_at,
        updated_at
      FROM user_chat_sessions
      WHERE user_id = ?
        AND id = ?
      LIMIT 1
    `,
    [input.userId, input.sessionId]
  )

  return toSessionMemorySnapshot(rows[0] ?? null)
}

export async function getRecentConversationMessages(
  userId: string,
  sessionId: number,
  limit = CHAT_VISIBLE_MESSAGE_LIMIT
) {
  await ensureChatSchema()

  const rows = await queryRows<ChatMessageRow[]>(
    `
      SELECT
        id,
        user_id,
        session_id,
        role,
        locale,
        content,
        resolved_model,
        included_in_memory_at,
        created_at
      FROM user_chat_messages
      WHERE user_id = ?
        AND session_id = ?
      ORDER BY id DESC
      LIMIT ?
    `,
    [userId, sessionId, limit]
  )

  return rows.reverse().map(toConversationMessage)
}

export async function getRecentContextMessages(
  userId: string,
  sessionId: number,
  limit = CHAT_COMPACTION_KEEP_MESSAGE_COUNT + 4
) {
  await ensureChatSchema()

  const rows = await queryRows<ChatMessageRow[]>(
    `
      SELECT
        id,
        user_id,
        session_id,
        role,
        locale,
        content,
        resolved_model,
        included_in_memory_at,
        created_at
      FROM user_chat_messages
      WHERE user_id = ?
        AND session_id = ?
        AND included_in_memory_at IS NULL
      ORDER BY id DESC
      LIMIT ?
    `,
    [userId, sessionId, limit]
  )

  return rows.reverse().map(toConversationMessage)
}

export async function getChatState(input: {
  userId: string
  locale: ChatLocale
  requestedSessionId?: string | null
}): Promise<ChatStateResponse> {
  const cacheKey = buildChatStateCacheKey(input)
  const now = Date.now()
  const cache = getChatStateCache()
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cloneChatStateSnapshot(cached.data)
  }

  if (cached) {
    cache.delete(cacheKey)
  }

  const inFlightMap = getChatStateInFlight()
  const inFlight = inFlightMap.get(cacheKey)
  if (inFlight) {
    return cloneChatStateSnapshot(await inFlight)
  }

  const pending = (async () => {
    const resolved = await resolveChatSession({
      userId: input.userId,
      locale: input.locale,
      requestedSessionId: input.requestedSessionId,
    })

    const [messages, memory, usage] = await Promise.all([
      getRecentConversationMessages(input.userId, resolved.activeSessionId),
      Promise.resolve(toSessionMemorySnapshot(resolved.activeSession)),
      getChatUsageSnapshot(input.userId),
    ])

    const state: ChatStateResponse = {
      messages,
      memory,
      usage,
      policy: getChatPolicySnapshot(),
      sessions: resolved.sessions,
      activeSessionId: String(resolved.activeSessionId),
    }

    cache.set(cacheKey, {
      data: state,
      expiresAt: Date.now() + CHAT_STATE_CACHE_TTL_MS,
    })
    pruneChatCacheMap(cache, CHAT_STATE_CACHE_MAX_KEYS)
    return state
  })()

  inFlightMap.set(cacheKey, pending)
  try {
    const state = await pending
    return cloneChatStateSnapshot(state)
  } finally {
    inFlightMap.delete(cacheKey)
  }
}

export function getChatPolicySnapshot(): ChatPolicySnapshot {
  return {
    dailyLimit: CHAT_DAILY_REQUEST_LIMIT,
    maxInputCharacters: CHAT_INPUT_MAX_CHARACTERS,
    resetTimeZone: CHAT_TIME_ZONE,
  }
}

export async function getCompactionCandidate(userId: string, sessionId: number) {
  await ensureChatSchema()

  const rows = await queryRows<ChatMessageRow[]>(
    `
      SELECT
        id,
        user_id,
        session_id,
        role,
        locale,
        content,
        resolved_model,
        included_in_memory_at,
        created_at
      FROM user_chat_messages
      WHERE user_id = ?
        AND session_id = ?
        AND included_in_memory_at IS NULL
      ORDER BY id ASC
    `,
    [userId, sessionId]
  )

  if (rows.length <= CHAT_COMPACTION_KEEP_MESSAGE_COUNT) {
    return null
  }

  const resolvedMessages = rows.map((row) => ({
    row,
    decryptedContent: decryptDatabaseValue(row.content, `chat.message.${row.role}`),
  }))

  const estimatedTokens = resolvedMessages.reduce(
    (total, item) => total + estimateTextTokens(item.decryptedContent),
    0
  )

  const shouldCompact = resolvedMessages.length >= CHAT_COMPACTION_TRIGGER_MESSAGE_COUNT
    || estimatedTokens >= CHAT_COMPACTION_TRIGGER_ESTIMATED_TOKENS

  if (!shouldCompact) {
    return null
  }

  const compactRows = resolvedMessages.slice(0, -CHAT_COMPACTION_KEEP_MESSAGE_COUNT)
  return {
    estimatedTokens: Math.max(0, estimatedTokens),
    messages: compactRows.map((item) => ({
      id: String(item.row.id),
      role: item.row.role,
      content: item.decryptedContent,
      createdAt: toIsoString(item.row.created_at),
      resolvedModel: item.row.resolved_model,
    })),
    messageIds: compactRows.map((item) => item.row.id),
  }
}

async function insertRequestEvent(
  connection: PoolConnection,
  input: {
    userId: string
    sessionId?: number | null
    requestKind: ChatRequestKind
    status: ChatRequestStatus
    locale: ChatLocale
    requestedModel?: string | null
    resolvedModel?: string | null
    providerRequestId?: string | null
    messageCount?: number
    inputCharacters?: number
    outputCharacters?: number
    usage?: FactChatUsage | null
    latencyMs?: number
    errorCode?: string | null
    errorMessage?: string | null
  }
) {
  await connection.execute(
    `
      INSERT INTO user_chat_request_events (
        user_id,
        session_id,
        request_kind,
        status,
        locale,
        requested_model,
        resolved_model,
        provider_request_id,
        message_count,
        input_characters,
        output_characters,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        cached_prompt_tokens,
        latency_ms,
        error_code,
        error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.userId,
      input.sessionId ?? null,
      input.requestKind,
      input.status,
      input.locale,
      input.requestedModel ?? null,
      input.resolvedModel ?? null,
      input.providerRequestId ?? null,
      Math.max(0, input.messageCount ?? 0),
      Math.max(0, input.inputCharacters ?? 0),
      Math.max(0, input.outputCharacters ?? 0),
      Math.max(0, input.usage?.promptTokens ?? 0),
      Math.max(0, input.usage?.completionTokens ?? 0),
      Math.max(0, input.usage?.totalTokens ?? 0),
      Math.max(0, input.usage?.cachedPromptTokens ?? 0),
      Math.max(0, Math.round(input.latencyMs ?? 0)),
      input.errorCode ?? null,
      input.errorMessage?.slice(0, 255) ?? null,
    ]
  )
}

export async function logChatRequestEvent(input: {
  userId: string
  sessionId?: number | null
  requestKind: ChatRequestKind
  status: ChatRequestStatus
  locale: ChatLocale
  requestedModel?: string | null
  resolvedModel?: string | null
  providerRequestId?: string | null
  messageCount?: number
  inputCharacters?: number
  outputCharacters?: number
  usage?: FactChatUsage | null
  latencyMs?: number
  errorCode?: string | null
  errorMessage?: string | null
}) {
  await ensureChatSchema()
  const connection = await getDbPool().getConnection()
  try {
    await insertRequestEvent(connection, input)
  } finally {
    connection.release()
  }
}

export async function persistChatExchange(input: {
  userId: string
  sessionId: number
  locale: ChatLocale
  userMessage: string
  assistantMessage: string
  requestedModel: string | null
  resolvedModel: string | null
  providerRequestId: string | null
  usage: FactChatUsage
  latencyMs: number
  contextMessageCount: number
}) {
  await ensureChatSchema()
  const encryptedUserMessage = encryptDatabaseValue(input.userMessage, "chat.message.user")
  const encryptedAssistantMessage = encryptDatabaseValue(input.assistantMessage, "chat.message.assistant")

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()
    const userTokenEstimate = estimateTextTokens(input.userMessage)
    const [sessionRows] = await connection.query<Array<RowDataPacket & { is_auto_title: number }>>(
      `
        SELECT is_auto_title
        FROM user_chat_sessions
        WHERE user_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [input.userId, input.sessionId]
    )

    if (sessionRows.length === 0) {
      throw new Error("Invalid chat session.")
    }

    const [existingRows] = await connection.query<Array<RowDataPacket & { total: number }>>(
      `
        SELECT COUNT(*) AS total
        FROM user_chat_messages
        WHERE user_id = ?
          AND session_id = ?
      `,
      [input.userId, input.sessionId]
    )

    await connection.execute(
      `
        INSERT INTO user_chat_messages (
          user_id,
          session_id,
          role,
          locale,
          content,
          requested_model,
          resolved_model,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          cached_prompt_tokens
        ) VALUES (?, ?, 'user', ?, ?, ?, ?, ?, 0, ?, ?)
      `,
      [
        input.userId,
        input.sessionId,
        input.locale,
        encryptedUserMessage,
        input.requestedModel,
        input.resolvedModel,
        userTokenEstimate,
        userTokenEstimate,
        0,
      ]
    )

    await connection.execute(
      `
        INSERT INTO user_chat_messages (
          user_id,
          session_id,
          role,
          locale,
          content,
          provider_message_id,
          requested_model,
          resolved_model,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          cached_prompt_tokens
        ) VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.userId,
        input.sessionId,
        input.locale,
        encryptedAssistantMessage,
        input.providerRequestId,
        input.requestedModel,
        input.resolvedModel,
        input.usage.promptTokens,
        input.usage.completionTokens,
        input.usage.totalTokens,
        input.usage.cachedPromptTokens,
      ]
    )

    if (sessionRows[0].is_auto_title === 1 && (existingRows[0]?.total ?? 0) === 0) {
      const nextTitle = normalizeSessionTitle(
        input.userMessage.slice(0, 48),
        buildDefaultSessionTitle(input.locale)
      )
      await connection.execute(
        `
          UPDATE user_chat_sessions
          SET title = ?,
              is_auto_title = 0
          WHERE user_id = ?
            AND id = ?
        `,
        [
          encryptDatabaseValue(nextTitle, "chat.session.title"),
          input.userId,
          input.sessionId,
        ]
      )
    }

    await connection.execute(
      `
        UPDATE user_chat_sessions
        SET last_message_at = NOW(),
            updated_at = NOW()
        WHERE user_id = ?
          AND id = ?
      `,
      [input.userId, input.sessionId]
    )

    await connection.execute(
      `
        UPDATE user_chat_usage_daily
        SET success_count = success_count + 1,
            prompt_tokens = prompt_tokens + ?,
            completion_tokens = completion_tokens + ?,
            total_tokens = total_tokens + ?,
            cached_prompt_tokens = cached_prompt_tokens + ?,
            last_used_at = NOW()
        WHERE metric_date = ?
          AND user_id = ?
      `,
      [
        input.usage.promptTokens,
        input.usage.completionTokens,
        input.usage.totalTokens,
        input.usage.cachedPromptTokens,
        getKstMetricDate(),
        input.userId,
      ]
    )

    await insertRequestEvent(connection, {
      userId: input.userId,
      sessionId: input.sessionId,
      requestKind: "chat",
      status: "success",
      locale: input.locale,
      requestedModel: input.requestedModel,
      resolvedModel: input.resolvedModel,
      providerRequestId: input.providerRequestId,
      messageCount: input.contextMessageCount,
      inputCharacters: input.userMessage.length,
      outputCharacters: input.assistantMessage.length,
      usage: input.usage,
      latencyMs: input.latencyMs,
    })

    await connection.commit()
    invalidateChatCacheForUser(input.userId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function markDailyChatFailure(input: {
  userId: string
  sessionId?: number | null
  locale: ChatLocale
  latencyMs: number
  inputCharacters: number
  messageCount: number
  requestedModel?: string | null
  resolvedModel?: string | null
  providerRequestId?: string | null
  errorCode?: string | null
  errorMessage?: string | null
}) {
  await ensureChatSchema()

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute(
      `
        UPDATE user_chat_usage_daily
        SET failure_count = failure_count + 1,
            last_used_at = NOW()
        WHERE metric_date = ?
          AND user_id = ?
      `,
      [getKstMetricDate(), input.userId]
    )

    await insertRequestEvent(connection, {
      userId: input.userId,
      sessionId: input.sessionId,
      requestKind: "chat",
      status: "provider_error",
      locale: input.locale,
      requestedModel: input.requestedModel,
      resolvedModel: input.resolvedModel,
      providerRequestId: input.providerRequestId,
      messageCount: input.messageCount,
      inputCharacters: input.inputCharacters,
      latencyMs: input.latencyMs,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    })

    await connection.commit()
    invalidateChatCacheForUser(input.userId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function getProfileMemoryRefreshCandidate(userId: string) {
  const profileMemory = await getChatMemorySnapshot(userId)
  const lastMessageId = profileMemory?.lastProfileMessageId ?? 0

  const rows = await queryRows<ChatMessageRow[]>(
    `
      SELECT
        id,
        user_id,
        session_id,
        role,
        locale,
        content,
        resolved_model,
        included_in_memory_at,
        created_at
      FROM user_chat_messages
      WHERE user_id = ?
        AND role = 'user'
        AND id > ?
      ORDER BY id ASC
      LIMIT ?
    `,
    [userId, lastMessageId, CHAT_PROFILE_MEMORY_CANDIDATE_LIMIT]
  )

  const minimumMessages = profileMemory?.summary
    ? CHAT_PROFILE_MEMORY_MIN_NEW_MESSAGES
    : CHAT_PROFILE_MEMORY_INITIAL_MIN_MESSAGES

  if (rows.length < minimumMessages) {
    return null
  }

  return {
    existingSummary: profileMemory?.summary ?? null,
    existingAssessment: profileMemory?.assessment ?? null,
    messages: rows.map(toConversationMessage),
    lastMessageId: rows[rows.length - 1]?.id ?? lastMessageId,
  }
}

export async function persistUserProfileMemory(input: {
  userId: string
  summary: string
  assessment: string | null
  lastMessageId: number
  modelUsed: string | null
}) {
  await ensureChatSchema()

  const normalizedSummary = input.summary.trim().slice(0, CHAT_PROFILE_SUMMARY_MAX_CHARACTERS)
  if (!normalizedSummary) {
    return
  }

  const normalizedAssessment = input.assessment?.trim()
    ? input.assessment.trim().slice(0, CHAT_PROFILE_ASSESSMENT_MAX_CHARACTERS)
    : null

  await getDbPool().execute(
    `
      INSERT INTO user_chat_memory (
        user_id,
        summary_text,
        assessment_text,
        summary_token_estimate,
        summarized_message_count,
        last_profile_message_id,
        profile_model_used,
        profile_refreshed_at
      ) VALUES (?, ?, ?, ?, 0, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        summary_text = VALUES(summary_text),
        assessment_text = VALUES(assessment_text),
        summary_token_estimate = VALUES(summary_token_estimate),
        last_profile_message_id = GREATEST(COALESCE(last_profile_message_id, 0), VALUES(last_profile_message_id)),
        profile_model_used = VALUES(profile_model_used),
        profile_refreshed_at = NOW()
    `,
    [
      input.userId,
      encryptDatabaseValue(normalizedSummary, "chat.memory.summary"),
      normalizedAssessment ? encryptDatabaseValue(normalizedAssessment, "chat.profile.assessment") : null,
      estimateTextTokens(`${normalizedSummary}\n${normalizedAssessment ?? ""}`),
      Math.max(0, input.lastMessageId),
      input.modelUsed,
    ]
  )
}

export async function persistCompactedMemory(input: {
  userId: string
  sessionId: number
  locale: ChatLocale
  summary: string
  summarizedMessageIds: number[]
  summarizedMessageCount: number
  requestedModel: string | null
  resolvedModel: string | null
  providerRequestId: string | null
  usage: FactChatUsage
  latencyMs: number
}) {
  await ensureChatSchema()

  if (input.summarizedMessageIds.length === 0) {
    return
  }

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()

    await connection.execute(
      `
        UPDATE user_chat_sessions
        SET memory_summary_text = ?,
            memory_token_estimate = ?,
            summarized_message_count = summarized_message_count + ?,
            memory_model_used = ?,
            last_compacted_at = NOW(),
            updated_at = NOW()
        WHERE user_id = ?
          AND id = ?
      `,
      [
        encryptDatabaseValue(
          input.summary.slice(0, CHAT_MEMORY_SUMMARY_MAX_CHARACTERS),
          "chat.session.memory"
        ),
        estimateTextTokens(input.summary),
        input.summarizedMessageCount,
        input.resolvedModel,
        input.userId,
        input.sessionId,
      ]
    )

    const placeholders = input.summarizedMessageIds.map(() => "?").join(", ")
    await connection.execute(
      `
        UPDATE user_chat_messages
        SET included_in_memory_at = NOW()
        WHERE user_id = ?
          AND session_id = ?
          AND id IN (${placeholders})
      `,
      [input.userId, input.sessionId, ...input.summarizedMessageIds]
    )

    await connection.execute(
      `
        UPDATE user_chat_usage_daily
        SET summary_count = summary_count + 1,
            summary_prompt_tokens = summary_prompt_tokens + ?,
            summary_completion_tokens = summary_completion_tokens + ?,
            summary_total_tokens = summary_total_tokens + ?,
            cached_prompt_tokens = cached_prompt_tokens + ?,
            last_used_at = NOW()
        WHERE metric_date = ?
          AND user_id = ?
      `,
      [
        input.usage.promptTokens,
        input.usage.completionTokens,
        input.usage.totalTokens,
        input.usage.cachedPromptTokens,
        getKstMetricDate(),
        input.userId,
      ]
    )

    await insertRequestEvent(connection, {
      userId: input.userId,
      sessionId: input.sessionId,
      requestKind: "summary",
      status: "success",
      locale: input.locale,
      requestedModel: input.requestedModel,
      resolvedModel: input.resolvedModel,
      providerRequestId: input.providerRequestId,
      messageCount: input.summarizedMessageCount,
      inputCharacters: input.summary.length,
      outputCharacters: input.summary.length,
      usage: input.usage,
      latencyMs: input.latencyMs,
    })

    await connection.commit()
    invalidateChatCacheForUser(input.userId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function deleteChatDataForUser(userId: string) {
  await ensureChatSchema()

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute("DELETE FROM user_chat_request_events WHERE user_id = ?", [userId])
    await connection.execute("DELETE FROM user_chat_messages WHERE user_id = ?", [userId])
    await connection.execute("DELETE FROM user_chat_sessions WHERE user_id = ?", [userId])
    await connection.execute("DELETE FROM user_chat_memory WHERE user_id = ?", [userId])
    await connection.execute("DELETE FROM user_chat_usage_daily WHERE user_id = ?", [userId])
    await connection.commit()
    invalidateChatCacheForUser(userId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
