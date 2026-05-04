/**
 * Lab AI Chat — data-access layer.
 *
 * Session management: list, create, delete, resolve.
 * Messaging: insert user/assistant exchanges, retrieve visible/context messages.
 * Usage tracking: daily-rate reservation with row-level locking.
 * Web-search: quota reservation, outcome recording, cache persistence.
 * Compaction: candidate detection and memory-summary persistence.
 *
 * All sensitive text is encrypted at rest via encryptDatabaseValue / decryptDatabaseValueSafely.
 */

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise"

import {
  LAB_AI_CHAT_COMPACTION_KEEP_MESSAGE_COUNT,
  LAB_AI_CHAT_COMPACTION_TRIGGER_ESTIMATED_TOKENS,
  LAB_AI_CHAT_COMPACTION_TRIGGER_MESSAGE_COUNT,
  LAB_AI_CHAT_CONTEXT_MESSAGE_LIMIT,
  LAB_AI_CHAT_DAILY_REQUEST_LIMIT,
  LAB_AI_CHAT_INPUT_MAX_CHARACTERS,
  LAB_AI_CHAT_MEMORY_SUMMARY_MAX_CHARACTERS,
  LAB_AI_CHAT_TIME_ZONE,
  LAB_AI_CHAT_WEB_SEARCH_CACHE_MAX_CHARACTERS,
  LAB_AI_CHAT_WEB_SEARCH_FALLBACK_CALL_LIMIT,
  LAB_AI_CHAT_WEB_SEARCH_MONTHLY_CALL_LIMIT,
  LAB_AI_CHAT_WEB_SEARCH_SESSION_CALL_LIMIT,
  LAB_AI_CHAT_WEB_SEARCH_SESSION_TOTAL_CALL_LIMIT,
  LAB_AI_CHAT_VISIBLE_MESSAGE_LIMIT,
  estimateLabAiChatTokens,
} from "@/lib/lab-ai-chat/constants"
import { ensureLabAiChatSchema } from "@/lib/lab-ai-chat/schema"
import type {
  LabAiChatConversationMessage,
  LabAiChatLocale,
  LabAiChatMemorySnapshot,
  LabAiChatPolicySnapshot,
  LabAiChatRequestKind,
  LabAiChatRequestStatus,
  LabAiChatSessionSnapshot,
  LabAiChatStateCore,
  LabAiChatUsageSnapshot,
  LabAiChatWebSearchSnapshot,
  NanoGptUsage,
} from "@/lib/lab-ai-chat/types"
import { getDbPool, queryRows } from "@/lib/db"
import {
  decryptDatabaseValueSafely,
  encryptDatabaseValue,
} from "@/lib/security/data-protection"

/** Raw row shape for lab_ai_chat_messages. */
interface LabAiChatMessageRow extends RowDataPacket {
  id: number
  user_id: string
  session_id: number
  role: "user" | "assistant"
  locale: string
  content: string
  resolved_model: string | null
  included_in_memory_at: Date | string | null
  created_at: Date | string
}

/** Raw row shape for lab_ai_chat_sessions. */
interface LabAiChatSessionRow extends RowDataPacket {
  id: number
  user_id: string
  title_text: string
  locale: string
  memory_summary_text: string | null
  memory_token_estimate: number
  summarized_message_count: number
  memory_model_used: string | null
  last_compacted_at: Date | string | null
  last_message_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

/** Session row joined with a message-count subquery. */
interface LabAiChatSessionWithCountRow extends LabAiChatSessionRow {
  message_count: number
}

/** Raw row shape for lab_ai_chat_usage_daily. */
interface LabAiChatUsageRow extends RowDataPacket {
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

/** Raw row shape for lab_ai_chat_web_search_state. */
interface LabAiChatWebSearchStateRow extends RowDataPacket {
  user_id: string
  session_id: number
  session_call_count: number
  fallback_call_count: number
  cache_query_text: string | null
  cache_result_text: string | null
  cache_topic: string | null
  cache_time_range: string | null
  cache_start_date: Date | string | null
  cache_end_date: Date | string | null
  cache_result_count: number
  cache_updated_at: Date | string | null
}

/** Raw row shape for lab_ai_chat_web_search_usage_monthly. */
interface LabAiChatWebSearchMonthlyUsageRow extends RowDataPacket {
  metric_month: string
  request_count: number
  success_count: number
  failure_count: number
}

const LAB_AI_CHAT_SESSION_TITLE_MAX_LENGTH = 60

/** Normalise a Date or ISO-like string to a consistent ISO-8601 string. */
function toIsoString(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

/** Parse and validate a session-id value; returns null for invalid input. */
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

/** Today's date as YYYY-MM-DD in KST. */
function getKstMetricDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LAB_AI_CHAT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/** Current month as YYYY-MM in KST. */
function getKstMetricMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LAB_AI_CHAT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).format(new Date())
}

/** Return the locale-appropriate placeholder title for new sessions. */
function buildDefaultSessionTitle(locale: LabAiChatLocale) {
  return locale === "en" ? "New chat" : "새 대화"
}

/** Trim, collapse whitespace, and truncate a session title. Returns fallback if empty. */
function normalizeSessionTitle(value: string, fallback: string) {
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, LAB_AI_CHAT_SESSION_TITLE_MAX_LENGTH)
  return normalized || fallback
}

/** Map a DB message row to a frontend-safe conversation message (content decrypted). */
function toConversationMessage(row: LabAiChatMessageRow): LabAiChatConversationMessage {
  return {
    id: String(row.id),
    role: row.role,
    content: decryptDatabaseValueSafely(row.content, `lab.ai.chat.message.${row.role}`) ?? "[Unavailable message]",
    createdAt: toIsoString(row.created_at),
    resolvedModel: row.resolved_model,
  }
}

/** Build a memory snapshot from the session row, or null if no summary exists. */
function toMemorySnapshot(row: LabAiChatSessionRow | null): LabAiChatMemorySnapshot | null {
  if (!row?.memory_summary_text) {
    return null
  }

  const summary = decryptDatabaseValueSafely(row.memory_summary_text, "lab.ai.chat.session.memory")
  if (!summary) {
    return null
  }

  return {
    summary,
    updatedAt: toIsoString(row.updated_at),
    summarizedMessageCount: Math.max(0, row.summarized_message_count),
    modelUsed: row.memory_model_used,
  }
}

/** Map a session row (with message count) to the public session-snapshot shape. */
function toSessionSnapshot(row: LabAiChatSessionWithCountRow): LabAiChatSessionSnapshot {
  return {
    id: String(row.id),
    title: decryptDatabaseValueSafely(row.title_text, "lab.ai.chat.session.title")
      ?? (row.locale === "en" ? "New chat" : "새 대화"),
    locale: row.locale === "en" ? "en" : "ko",
    messageCount: Math.max(0, row.message_count),
    lastMessageAt: row.last_message_at ? toIsoString(row.last_message_at) : null,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  }
}

/** Return a zeroed usage snapshot (e.g. when no row exists for today yet). */
function createEmptyUsage(metricDate: string): LabAiChatUsageSnapshot {
  return {
    metricDate,
    requestCount: 0,
    remainingRequests: LAB_AI_CHAT_DAILY_REQUEST_LIMIT,
    dailyLimit: LAB_AI_CHAT_DAILY_REQUEST_LIMIT,
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

/** Map a DB usage row (or null) to the public usage-snapshot shape. */
function toUsageSnapshot(row: LabAiChatUsageRow | null, metricDate: string) {
  if (!row) {
    return createEmptyUsage(metricDate)
  }

  const requestCount = Math.max(0, row.request_count)
  return {
    metricDate,
    requestCount,
    remainingRequests: Math.max(0, LAB_AI_CHAT_DAILY_REQUEST_LIMIT - requestCount),
    dailyLimit: LAB_AI_CHAT_DAILY_REQUEST_LIMIT,
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
  } satisfies LabAiChatUsageSnapshot
}

/** Map web-search state + monthly rows into a single quota/cache snapshot. */
function toWebSearchSnapshot(input: {
  stateRow: LabAiChatWebSearchStateRow | null
  monthRow: LabAiChatWebSearchMonthlyUsageRow | null
}): LabAiChatWebSearchSnapshot {
  // Derive primary vs. fallback: fallback calls are a subset of total session calls.
  const sessionUsed = Math.max(0, input.stateRow?.session_call_count ?? 0)
  const fallbackUsed = Math.min(
    sessionUsed,
    Math.max(0, input.stateRow?.fallback_call_count ?? 0)
  )
  const primaryUsed = Math.max(0, sessionUsed - fallbackUsed)
  const monthUsed = Math.max(0, input.monthRow?.request_count ?? 0)
  const cacheQuery = input.stateRow?.cache_query_text
    ? decryptDatabaseValueSafely(input.stateRow.cache_query_text, "lab.ai.chat.web.cache.query")
    : null
  const cacheResult = input.stateRow?.cache_result_text
    ? decryptDatabaseValueSafely(input.stateRow.cache_result_text, "lab.ai.chat.web.cache.result")
    : null

  return {
    sessionLimit: LAB_AI_CHAT_WEB_SEARCH_SESSION_TOTAL_CALL_LIMIT,
    sessionUsed,
    sessionRemaining: Math.max(0, LAB_AI_CHAT_WEB_SEARCH_SESSION_TOTAL_CALL_LIMIT - sessionUsed),
    primaryLimit: LAB_AI_CHAT_WEB_SEARCH_SESSION_CALL_LIMIT,
    primaryUsed,
    primaryRemaining: Math.max(0, LAB_AI_CHAT_WEB_SEARCH_SESSION_CALL_LIMIT - primaryUsed),
    fallbackLimit: LAB_AI_CHAT_WEB_SEARCH_FALLBACK_CALL_LIMIT,
    fallbackUsed,
    fallbackRemaining: Math.max(0, LAB_AI_CHAT_WEB_SEARCH_FALLBACK_CALL_LIMIT - fallbackUsed),
    monthLimit: LAB_AI_CHAT_WEB_SEARCH_MONTHLY_CALL_LIMIT,
    monthUsed,
    monthRemaining: Math.max(0, LAB_AI_CHAT_WEB_SEARCH_MONTHLY_CALL_LIMIT - monthUsed),
    cacheAvailable: Boolean(cacheResult),
    cacheQuery: cacheQuery || null,
    cacheUpdatedAt: input.stateRow?.cache_updated_at ? toIsoString(input.stateRow.cache_updated_at) : null,
  }
}

/** Ensure a web-search state row exists for the given user + session. */
async function upsertLabAiChatWebSearchStateRow(connection: PoolConnection, userId: string, sessionId: number) {
  await connection.execute(
    `
      INSERT INTO lab_ai_chat_web_search_state (
        user_id,
        session_id
      ) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE user_id = user_id
    `,
    [userId, sessionId]
  )
}

/** Ensure a web-search monthly usage row exists for the given month. */
async function upsertLabAiChatWebSearchMonthlyRow(connection: PoolConnection, metricMonth: string) {
  await connection.execute(
    `
      INSERT INTO lab_ai_chat_web_search_usage_monthly (
        metric_month
      ) VALUES (?)
      ON DUPLICATE KEY UPDATE metric_month = metric_month
    `,
    [metricMonth]
  )
}

/** Fetch all sessions for a user, each with its message count via a LEFT JOIN. */
async function listLabAiChatSessionRows(userId: string) {
  await ensureLabAiChatSchema()

  return queryRows<LabAiChatSessionWithCountRow[]>(
    `
      SELECT
        s.id,
        s.user_id,
        s.title_text,
        s.locale,
        s.memory_summary_text,
        s.memory_token_estimate,
        s.summarized_message_count,
        s.memory_model_used,
        s.last_compacted_at,
        s.last_message_at,
        s.created_at,
        s.updated_at,
        COALESCE(m.message_count, 0) AS message_count
      FROM lab_ai_chat_sessions s
      LEFT JOIN (
        SELECT session_id, COUNT(*) AS message_count
        FROM lab_ai_chat_messages
        WHERE user_id = ?
        GROUP BY session_id
      ) m
        ON m.session_id = s.id
      WHERE s.user_id = ?
      ORDER BY COALESCE(s.last_message_at, s.updated_at, s.created_at) DESC, s.id DESC
    `,
    [userId, userId]
  )
}

/** Insert a new session row on the given connection. Returns the auto-generated id. */
async function insertLabAiChatSession(input: {
  connection: PoolConnection
  userId: string
  locale: LabAiChatLocale
  title: string
}) {
  const [result] = await input.connection.execute<ResultSetHeader>(
    `
      INSERT INTO lab_ai_chat_sessions (
        user_id,
        title_text,
        locale
      ) VALUES (?, ?, ?)
    `,
    [
      input.userId,
      encryptDatabaseValue(input.title, "lab.ai.chat.session.title"),
      input.locale,
    ]
  )

  return Number(result.insertId)
}

/**
 * Acquire a row-level lock on today's usage row, run the callback,
 * then commit. The callback receives the locked row and can safely mutate it.
 */
async function withLockedDailyUsage<T>(
  userId: string,
  callback: (
    connection: PoolConnection,
    metricDate: string,
    row: LabAiChatUsageRow
  ) => Promise<T>
) {
  await ensureLabAiChatSchema()

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()
    const metricDate = getKstMetricDate()

    // Ensure a row exists for today, then lock it with FOR UPDATE.
    await connection.execute(
      `
        INSERT INTO lab_ai_chat_usage_daily (
          metric_date,
          user_id,
          last_used_at
        ) VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE last_used_at = last_used_at
      `,
      [metricDate, userId]
    )

    const [rows] = await connection.query<LabAiChatUsageRow[]>(
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
        FROM lab_ai_chat_usage_daily
        WHERE metric_date = ?
          AND user_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [metricDate, userId]
    )

    const row = rows[0]
    if (!row) {
      throw new Error("Failed to lock lab AI chat daily usage row.")
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

/** Insert an audit event row on the given connection. */
async function insertRequestEvent(
  connection: PoolConnection,
  input: {
    userId: string
    sessionId?: number | null
    requestKind: LabAiChatRequestKind
    status: LabAiChatRequestStatus
    locale: LabAiChatLocale
    requestedModel?: string | null
    resolvedModel?: string | null
    providerRequestId?: string | null
    messageCount?: number
    inputCharacters?: number
    outputCharacters?: number
    usage?: NanoGptUsage | null
    latencyMs?: number
    errorCode?: string | null
    errorMessage?: string | null
  }
) {
  await connection.execute(
    `
      INSERT INTO lab_ai_chat_request_events (
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

/** List all chat sessions for the user, most-recently-updated first. */
export async function listLabAiChatSessions(userId: string) {
  const rows = await listLabAiChatSessionRows(userId)
  return rows.map(toSessionSnapshot)
}

/** Create a new empty session. Returns the session id as a string. */
export async function createLabAiChatSession(input: {
  userId: string
  locale: LabAiChatLocale
  title?: string | null
}) {
  await ensureLabAiChatSchema()
  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()
    const sessionId = await insertLabAiChatSession({
      connection,
      userId: input.userId,
      locale: input.locale,
      title: normalizeSessionTitle(input.title ?? "", buildDefaultSessionTitle(input.locale)),
    })
    await connection.commit()
    return String(sessionId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/**
 * Delete a session and all its related data (messages, events, web-search state).
 * Refuses to delete the user's last remaining session. Returns the next session id, or null.
 */
export async function deleteLabAiChatSession(input: {
  userId: string
  sessionId: string
}) {
  const parsedSessionId = parseSessionId(input.sessionId)
  if (!parsedSessionId) {
    return null
  }

  await ensureLabAiChatSchema()
  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()
    // Lock the session row to verify ownership before deleting.
    const [ownedRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
      `
        SELECT id
        FROM lab_ai_chat_sessions
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

    // Prevent deleting the last session.
    const [countRows] = await connection.query<Array<RowDataPacket & { total: number }>>(
      `
        SELECT COUNT(*) AS total
        FROM lab_ai_chat_sessions
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
        DELETE FROM lab_ai_chat_request_events
        WHERE user_id = ?
          AND session_id = ?
      `,
      [input.userId, parsedSessionId]
    )

    await connection.execute(
      `
        DELETE FROM lab_ai_chat_web_search_state
        WHERE user_id = ?
          AND session_id = ?
      `,
      [input.userId, parsedSessionId]
    )

    await connection.execute(
      `
        DELETE FROM lab_ai_chat_messages
        WHERE user_id = ?
          AND session_id = ?
      `,
      [input.userId, parsedSessionId]
    )

    await connection.execute(
      `
        DELETE FROM lab_ai_chat_sessions
        WHERE user_id = ?
          AND id = ?
      `,
      [input.userId, parsedSessionId]
    )

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const remaining = await listLabAiChatSessions(input.userId)
  return remaining[0]?.id ?? null
}

/**
 * Resolve the active session for the user.
 * If no sessions exist, auto-create one. Optionally targets a requested session id.
 * Returns the active session + full session list.
 */
export async function resolveLabAiChatSession(input: {
  userId: string
  locale: LabAiChatLocale
  requestedSessionId?: string | null
}) {
  await ensureLabAiChatSchema()

  let sessionRows = await listLabAiChatSessionRows(input.userId)
  if (sessionRows.length === 0) {
    await createLabAiChatSession({
      userId: input.userId,
      locale: input.locale,
      title: null,
    })
    sessionRows = await listLabAiChatSessionRows(input.userId)
  }

  if (sessionRows.length === 0) {
    throw new Error("Unable to resolve a lab AI chat session.")
  }

  const requestedSessionId = parseSessionId(input.requestedSessionId)
  // Pick the requested session if valid and owned by the user, otherwise fall back to the most recent.
  const active = requestedSessionId
    ? sessionRows.find((row) => row.id === requestedSessionId) ?? sessionRows[0]
    : sessionRows[0]

  return {
    activeSessionId: active.id,
    activeSession: active,
    sessions: sessionRows.map(toSessionSnapshot),
  }
}

/** Get today's usage snapshot for the user (no row lock — read-only). */
export async function getLabAiChatUsageSnapshot(userId: string) {
  await ensureLabAiChatSchema()

  const metricDate = getKstMetricDate()
  const rows = await queryRows<LabAiChatUsageRow[]>(
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
      FROM lab_ai_chat_usage_daily
      WHERE metric_date = ?
        AND user_id = ?
      LIMIT 1
    `,
    [metricDate, userId]
  )

  return toUsageSnapshot(rows[0] ?? null, metricDate)
}

/** Get the web-search quota + cache snapshot for a session (read-only, no lock). */
export async function getLabAiChatWebSearchSnapshot(input: {
  userId: string
  sessionId: number
}) {
  await ensureLabAiChatSchema()

  const connection = await getDbPool().getConnection()
  try {
    const metricMonth = getKstMetricMonth()
    await upsertLabAiChatWebSearchStateRow(connection, input.userId, input.sessionId)
    await upsertLabAiChatWebSearchMonthlyRow(connection, metricMonth)

    const [stateRows] = await connection.query<LabAiChatWebSearchStateRow[]>(
      `
        SELECT
          user_id,
          session_id,
          session_call_count,
          fallback_call_count,
          cache_query_text,
          cache_result_text,
          cache_topic,
          cache_time_range,
          cache_start_date,
          cache_end_date,
          cache_result_count,
          cache_updated_at
        FROM lab_ai_chat_web_search_state
        WHERE user_id = ?
          AND session_id = ?
        LIMIT 1
      `,
      [input.userId, input.sessionId]
    )

    const [monthRows] = await connection.query<LabAiChatWebSearchMonthlyUsageRow[]>(
      `
        SELECT
          metric_month,
          request_count,
          success_count,
          failure_count
        FROM lab_ai_chat_web_search_usage_monthly
        WHERE metric_month = ?
        LIMIT 1
      `,
      [metricMonth]
    )

    return toWebSearchSnapshot({
      stateRow: stateRows[0] ?? null,
      monthRow: monthRows[0] ?? null,
    })
  } finally {
    connection.release()
  }
}

/** Retrieve the cached web-search result for a session, or null if no cache exists. */
export async function getLabAiChatWebSearchCache(input: {
  userId: string
  sessionId: number
}) {
  await ensureLabAiChatSchema()

  const rows = await queryRows<LabAiChatWebSearchStateRow[]>(
    `
      SELECT
        user_id,
        session_id,
        session_call_count,
        fallback_call_count,
        cache_query_text,
        cache_result_text,
        cache_topic,
        cache_time_range,
        cache_start_date,
        cache_end_date,
        cache_result_count,
        cache_updated_at
      FROM lab_ai_chat_web_search_state
      WHERE user_id = ?
        AND session_id = ?
      LIMIT 1
    `,
    [input.userId, input.sessionId]
  )

  const row = rows[0]
  if (!row) {
    return null
  }

  const query = row.cache_query_text
    ? decryptDatabaseValueSafely(row.cache_query_text, "lab.ai.chat.web.cache.query")
    : null
  const result = row.cache_result_text
    ? decryptDatabaseValueSafely(row.cache_result_text, "lab.ai.chat.web.cache.result")
    : null

  return {
    query: query || null,
    result: result || null,
    topic: row.cache_topic,
    timeRange: row.cache_time_range,
    startDate: row.cache_start_date ? toIsoString(row.cache_start_date).slice(0, 10) : null,
    endDate: row.cache_end_date ? toIsoString(row.cache_end_date).slice(0, 10) : null,
    resultCount: Math.max(0, row.cache_result_count ?? 0),
    updatedAt: row.cache_updated_at ? toIsoString(row.cache_updated_at) : null,
  }
}

/**
 * Reserve a web-search API call for the session+month.
 * Returns whether the call is allowed and the current snapshot.
 * Uses row-level locking so concurrent requests are serialised.
 */
export async function reserveLabAiChatWebSearchCall(input: {
  userId: string
  sessionId: number
  isFallback?: boolean
}) {
  await ensureLabAiChatSchema()

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()
    const metricMonth = getKstMetricMonth()

    await upsertLabAiChatWebSearchStateRow(connection, input.userId, input.sessionId)
    await upsertLabAiChatWebSearchMonthlyRow(connection, metricMonth)

    const [stateRows] = await connection.query<LabAiChatWebSearchStateRow[]>(
      `
        SELECT
          user_id,
          session_id,
          session_call_count,
          fallback_call_count,
          cache_query_text,
          cache_result_text,
          cache_topic,
          cache_time_range,
          cache_start_date,
          cache_end_date,
          cache_result_count,
          cache_updated_at
        FROM lab_ai_chat_web_search_state
        WHERE user_id = ?
          AND session_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [input.userId, input.sessionId]
    )

    const [monthRows] = await connection.query<LabAiChatWebSearchMonthlyUsageRow[]>(
      `
        SELECT
          metric_month,
          request_count,
          success_count,
          failure_count
        FROM lab_ai_chat_web_search_usage_monthly
        WHERE metric_month = ?
        LIMIT 1
        FOR UPDATE
      `,
      [metricMonth]
    )

    const stateRow = stateRows[0] ?? null
    const monthRow = monthRows[0] ?? null

    const sessionUsed = Math.max(0, stateRow?.session_call_count ?? 0)
    const fallbackUsed = Math.min(sessionUsed, Math.max(0, stateRow?.fallback_call_count ?? 0))
    const primaryUsed = Math.max(0, sessionUsed - fallbackUsed)
    const monthUsed = Math.max(0, monthRow?.request_count ?? 0)
    const isFallback = Boolean(input.isFallback)

    // Check each limit in order: primary session, fallback session, monthly.
    if (!isFallback && primaryUsed >= LAB_AI_CHAT_WEB_SEARCH_SESSION_CALL_LIMIT) {
      await connection.commit()
      return {
        allowed: false,
        reason: "session_limit_reached" as const,
        snapshot: toWebSearchSnapshot({ stateRow, monthRow }),
        metricMonth,
      }
    }

    if (isFallback && fallbackUsed >= LAB_AI_CHAT_WEB_SEARCH_FALLBACK_CALL_LIMIT) {
      await connection.commit()
      return {
        allowed: false,
        reason: "fallback_limit_reached" as const,
        snapshot: toWebSearchSnapshot({ stateRow, monthRow }),
        metricMonth,
      }
    }

    if (monthUsed >= LAB_AI_CHAT_WEB_SEARCH_MONTHLY_CALL_LIMIT) {
      await connection.commit()
      return {
        allowed: false,
        reason: "monthly_limit_reached" as const,
        snapshot: toWebSearchSnapshot({ stateRow, monthRow }),
        metricMonth,
      }
    }

    // Atomically increment counters.
    await connection.execute(
      `
        UPDATE lab_ai_chat_web_search_state
        SET session_call_count = session_call_count + 1,
            fallback_call_count = fallback_call_count + ?,
            updated_at = NOW()
        WHERE user_id = ?
          AND session_id = ?
      `,
      [isFallback ? 1 : 0, input.userId, input.sessionId]
    )

    await connection.execute(
      `
        UPDATE lab_ai_chat_web_search_usage_monthly
        SET request_count = request_count + 1,
            last_used_at = NOW()
        WHERE metric_month = ?
      `,
      [metricMonth]
    )

    // Build a post-increment snapshot mirroring what the DB will reflect.
    const nextSnapshot = toWebSearchSnapshot({
      stateRow: stateRow
        ? {
          ...stateRow,
          session_call_count: sessionUsed + 1,
          fallback_call_count: fallbackUsed + (isFallback ? 1 : 0),
        }
        : null,
      monthRow: monthRow ? { ...monthRow, request_count: monthUsed + 1 } : null,
    })

    await connection.commit()
    return {
      allowed: true,
      reason: null,
      snapshot: nextSnapshot,
      metricMonth,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/** Record a web-search call as success or failure in the monthly rollup. */
export async function recordLabAiChatWebSearchOutcome(input: {
  metricMonth: string
  success: boolean
}) {
  await ensureLabAiChatSchema()

  const targetColumn = input.success ? "success_count" : "failure_count"
  await getDbPool().execute(
    `
      UPDATE lab_ai_chat_web_search_usage_monthly
      SET ${targetColumn} = ${targetColumn} + 1,
          last_used_at = NOW()
      WHERE metric_month = ?
    `,
    [input.metricMonth]
  )
}

/** Save or update the web-search cache for a session. */
export async function persistLabAiChatWebSearchCache(input: {
  userId: string
  sessionId: number
  query: string
  resultText: string
  resultCount: number
  topic?: string | null
  timeRange?: string | null
  startDate?: string | null
  endDate?: string | null
}) {
  await ensureLabAiChatSchema()

  // Validate date format before persisting.
  const startDate = input.startDate && /^\d{4}-\d{2}-\d{2}$/.test(input.startDate) ? input.startDate : null
  const endDate = input.endDate && /^\d{4}-\d{2}-\d{2}$/.test(input.endDate) ? input.endDate : null

  await getDbPool().execute(
    `
      INSERT INTO lab_ai_chat_web_search_state (
        user_id,
        session_id,
        cache_query_text,
        cache_result_text,
        cache_topic,
        cache_time_range,
        cache_start_date,
        cache_end_date,
        cache_result_count,
        cache_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        cache_query_text = VALUES(cache_query_text),
        cache_result_text = VALUES(cache_result_text),
        cache_topic = VALUES(cache_topic),
        cache_time_range = VALUES(cache_time_range),
        cache_start_date = VALUES(cache_start_date),
        cache_end_date = VALUES(cache_end_date),
        cache_result_count = VALUES(cache_result_count),
        cache_updated_at = NOW(),
        updated_at = NOW()
    `,
    [
      input.userId,
      input.sessionId,
      encryptDatabaseValue(input.query.slice(0, 500), "lab.ai.chat.web.cache.query"),
      encryptDatabaseValue(
        input.resultText.slice(0, LAB_AI_CHAT_WEB_SEARCH_CACHE_MAX_CHARACTERS),
        "lab.ai.chat.web.cache.result"
      ),
      input.topic?.slice(0, 16) ?? null,
      input.timeRange?.slice(0, 16) ?? null,
      startDate,
      endDate,
      Math.max(0, Math.floor(input.resultCount)),
    ]
  )
}

/** Reserve a daily chat request — checks the limit and increments the counter atomically. */
export async function reserveDailyLabAiChatRequest(userId: string) {
  return withLockedDailyUsage(userId, async (connection, metricDate, row) => {
    if (row.request_count >= LAB_AI_CHAT_DAILY_REQUEST_LIMIT) {
      return {
        allowed: false,
        usage: toUsageSnapshot(row, metricDate),
      } as const
    }

    await connection.execute(
      `
        UPDATE lab_ai_chat_usage_daily
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
        } as LabAiChatUsageRow,
        metricDate
      ),
    } as const
  })
}

/** Return the static policy limits as a snapshot (no DB call). */
export function getLabAiChatPolicySnapshot(): LabAiChatPolicySnapshot {
  return {
    dailyLimit: LAB_AI_CHAT_DAILY_REQUEST_LIMIT,
    maxInputCharacters: LAB_AI_CHAT_INPUT_MAX_CHARACTERS,
    resetTimeZone: LAB_AI_CHAT_TIME_ZONE,
  }
}

/** Get the memory summary for a session (used to hydrate the system prompt). */
export async function getLabAiChatSessionMemorySnapshot(input: {
  userId: string
  sessionId: number
}) {
  await ensureLabAiChatSchema()

  const rows = await queryRows<LabAiChatSessionRow[]>(
    `
      SELECT
        id,
        user_id,
        title_text,
        locale,
        memory_summary_text,
        memory_token_estimate,
        summarized_message_count,
        memory_model_used,
        last_compacted_at,
        last_message_at,
        created_at,
        updated_at
      FROM lab_ai_chat_sessions
      WHERE user_id = ?
        AND id = ?
      LIMIT 1
    `,
    [input.userId, input.sessionId]
  )

  return toMemorySnapshot(rows[0] ?? null)
}

/** Fetch the most recent messages for display in the UI (includes both compacted and un-compacted). */
export async function getRecentLabAiChatConversationMessages(
  userId: string,
  sessionId: number,
  limit = LAB_AI_CHAT_VISIBLE_MESSAGE_LIMIT
) {
  await ensureLabAiChatSchema()

  const rows = await queryRows<LabAiChatMessageRow[]>(
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
      FROM lab_ai_chat_messages
      WHERE user_id = ?
        AND session_id = ?
      ORDER BY id DESC
      LIMIT ?
    `,
    [userId, sessionId, limit]
  )

  // Reverse to chronological order.
  return rows.reverse().map(toConversationMessage)
}

/** Fetch the most recent un-compacted messages to include in the LLM context window. */
export async function getRecentLabAiChatContextMessages(
  userId: string,
  sessionId: number,
  limit = LAB_AI_CHAT_CONTEXT_MESSAGE_LIMIT
) {
  await ensureLabAiChatSchema()

  const rows = await queryRows<LabAiChatMessageRow[]>(
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
      FROM lab_ai_chat_messages
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

/** Assemble the full core state: resolved session, messages, usage, web-search, policy, memory, all session list. */
export async function getLabAiChatStateCore(input: {
  userId: string
  locale: LabAiChatLocale
  requestedSessionId?: string | null
}): Promise<LabAiChatStateCore> {
  const resolved = await resolveLabAiChatSession({
    userId: input.userId,
    locale: input.locale,
    requestedSessionId: input.requestedSessionId,
  })

  // Fetch all independent data sources in parallel.
  const [messages, usage, webSearch] = await Promise.all([
    getRecentLabAiChatConversationMessages(input.userId, resolved.activeSessionId),
    getLabAiChatUsageSnapshot(input.userId),
    getLabAiChatWebSearchSnapshot({
      userId: input.userId,
      sessionId: resolved.activeSessionId,
    }),
  ])

  return {
    messages,
    memory: toMemorySnapshot(resolved.activeSession),
    usage,
    policy: getLabAiChatPolicySnapshot(),
    webSearch,
    sessions: resolved.sessions,
    activeSessionId: String(resolved.activeSessionId),
  }
}

/** Find messages eligible for compaction. Returns null if thresholds are not met. */
export async function getLabAiChatCompactionCandidate(userId: string, sessionId: number) {
  await ensureLabAiChatSchema()

  const rows = await queryRows<LabAiChatMessageRow[]>(
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
      FROM lab_ai_chat_messages
      WHERE user_id = ?
        AND session_id = ?
        AND included_in_memory_at IS NULL
      ORDER BY id ASC
    `,
    [userId, sessionId]
  )

  // Not enough messages to justify compaction.
  if (rows.length <= LAB_AI_CHAT_COMPACTION_KEEP_MESSAGE_COUNT) {
    return null
  }

  // Decrypt content for token estimation.
  const resolvedMessages = rows.map((row) => ({
    row,
    decryptedContent: decryptDatabaseValueSafely(row.content, `lab.ai.chat.message.${row.role}`) ?? "[Unavailable history]",
  }))

  const estimatedTokens = resolvedMessages.reduce(
    (total, item) => total + estimateLabAiChatTokens(item.decryptedContent),
    0
  )

  // Trigger compaction if message count or estimated token budget is exceeded.
  const shouldCompact = resolvedMessages.length >= LAB_AI_CHAT_COMPACTION_TRIGGER_MESSAGE_COUNT
    || estimatedTokens >= LAB_AI_CHAT_COMPACTION_TRIGGER_ESTIMATED_TOKENS

  if (!shouldCompact) {
    return null
  }

  // Messages to compact = everything except the N most recent.
  const compactRows = resolvedMessages.slice(0, -LAB_AI_CHAT_COMPACTION_KEEP_MESSAGE_COUNT)
  return {
    estimatedTokens,
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

/** Log a request event without modifying usage counters (e.g. for rate-limit errors). */
export async function logLabAiChatRequestEvent(input: {
  userId: string
  sessionId?: number | null
  requestKind: LabAiChatRequestKind
  status: LabAiChatRequestStatus
  locale: LabAiChatLocale
  requestedModel?: string | null
  resolvedModel?: string | null
  providerRequestId?: string | null
  messageCount?: number
  inputCharacters?: number
  outputCharacters?: number
  usage?: NanoGptUsage | null
  latencyMs?: number
  errorCode?: string | null
  errorMessage?: string | null
}) {
  await ensureLabAiChatSchema()

  const connection = await getDbPool().getConnection()
  try {
    await insertRequestEvent(connection, input)
  } finally {
    connection.release()
  }
}

/** Persist a complete user↔assistant exchange: messages, title (if first), usage rollup, and audit event. */
export async function persistLabAiChatExchange(input: {
  userId: string
  sessionId: number
  locale: LabAiChatLocale
  userMessage: string
  assistantMessage: string
  requestedModel: string | null
  resolvedModel: string | null
  providerRequestId: string | null
  usage: NanoGptUsage
  latencyMs: number
  contextMessageCount: number
}) {
  await ensureLabAiChatSchema()

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()
    // Estimate user token count since the actual usage from the provider only covers the assistant turn.
    const userTokenEstimate = estimateLabAiChatTokens(input.userMessage)

    // Count existing messages to decide if this is the first exchange (→ set session title).
    const [existingRows] = await connection.query<Array<RowDataPacket & { total: number }>>(
      `
        SELECT COUNT(*) AS total
        FROM lab_ai_chat_messages
        WHERE user_id = ?
          AND session_id = ?
      `,
      [input.userId, input.sessionId]
    )

    await connection.execute(
      `
        INSERT INTO lab_ai_chat_messages (
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
        encryptDatabaseValue(input.userMessage, "lab.ai.chat.message.user"),
        input.requestedModel,
        input.resolvedModel,
        userTokenEstimate,
        userTokenEstimate,
        0,
      ]
    )

    await connection.execute(
      `
        INSERT INTO lab_ai_chat_messages (
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
        encryptDatabaseValue(input.assistantMessage, "lab.ai.chat.message.assistant"),
        input.providerRequestId,
        input.requestedModel,
        input.resolvedModel,
        input.usage.promptTokens,
        input.usage.completionTokens,
        input.usage.totalTokens,
        input.usage.cachedPromptTokens,
      ]
    )

    // First message in session → derive the session title from the user's first message.
    if ((existingRows[0]?.total ?? 0) === 0) {
      const nextTitle = normalizeSessionTitle(
        input.userMessage.slice(0, 48),
        buildDefaultSessionTitle(input.locale)
      )

      await connection.execute(
        `
          UPDATE lab_ai_chat_sessions
          SET title_text = ?
          WHERE user_id = ?
            AND id = ?
        `,
        [
          encryptDatabaseValue(nextTitle, "lab.ai.chat.session.title"),
          input.userId,
          input.sessionId,
        ]
      )
    }

    // Touch session timestamps.
    await connection.execute(
      `
        UPDATE lab_ai_chat_sessions
        SET last_message_at = NOW(),
            updated_at = NOW()
        WHERE user_id = ?
          AND id = ?
      `,
      [input.userId, input.sessionId]
    )

    // Roll up usage into the daily counter.
    await connection.execute(
      `
        UPDATE lab_ai_chat_usage_daily
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

    // Log the audit event.
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
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/** Record a failed chat request: increment failure count and log an audit event. */
export async function markDailyLabAiChatFailure(input: {
  userId: string
  sessionId?: number | null
  locale: LabAiChatLocale
  latencyMs: number
  inputCharacters: number
  messageCount: number
  requestedModel?: string | null
  resolvedModel?: string | null
  providerRequestId?: string | null
  errorCode?: string | null
  errorMessage?: string | null
}) {
  await ensureLabAiChatSchema()

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()
    // Increment failure counter in the daily usage row.
    await connection.execute(
      `
        UPDATE lab_ai_chat_usage_daily
        SET failure_count = failure_count + 1,
            last_used_at = NOW()
        WHERE metric_date = ?
          AND user_id = ?
      `,
      [getKstMetricDate(), input.userId]
    )

    // Log the provider_error event.
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
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/** Persist a compaction result: update session memory, mark messages as compacted, roll up summary usage. */
export async function persistLabAiChatCompactedMemory(input: {
  userId: string
  sessionId: number
  locale: LabAiChatLocale
  summary: string
  summarizedMessageIds: number[]
  summarizedMessageCount: number
  requestedModel: string | null
  resolvedModel: string | null
  providerRequestId: string | null
  usage: NanoGptUsage
  latencyMs: number
}) {
  await ensureLabAiChatSchema()

  // Nothing to compact.
  if (input.summarizedMessageIds.length === 0) {
    return
  }

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()

    await connection.execute(
      `
        UPDATE lab_ai_chat_sessions
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
          input.summary.slice(0, LAB_AI_CHAT_MEMORY_SUMMARY_MAX_CHARACTERS),
          "lab.ai.chat.session.memory"
        ),
        estimateLabAiChatTokens(input.summary),
        input.summarizedMessageCount,
        input.resolvedModel,
        input.userId,
        input.sessionId,
      ]
    )

    // Mark the compacted messages as having been included_in_memory_at.
    const placeholders = input.summarizedMessageIds.map(() => "?").join(", ")
    await connection.execute(
      `
        UPDATE lab_ai_chat_messages
        SET included_in_memory_at = NOW()
        WHERE user_id = ?
          AND session_id = ?
          AND id IN (${placeholders})
      `,
      [input.userId, input.sessionId, ...input.summarizedMessageIds]
    )

    // Roll up summary usage into the daily counter (separate from chat usage).
    await connection.execute(
      `
        UPDATE lab_ai_chat_usage_daily
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

    // Log the summary audit event.
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
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
