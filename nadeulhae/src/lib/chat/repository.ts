import type { PoolConnection, RowDataPacket } from "mysql2/promise"

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
  summary_token_estimate: number
  summarized_message_count: number
  model_used: string | null
  updated_at: Date | string
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

function toMemorySnapshot(row: ChatMemoryRow | null): ChatMemorySnapshot | null {
  if (!row) {
    return null
  }

  return {
    summary: decryptDatabaseValue(row.summary_text, "chat.memory.summary"),
    updatedAt: toIsoString(row.updated_at),
    summarizedMessageCount: Math.max(0, row.summarized_message_count),
    modelUsed: row.model_used,
  }
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
  return withLockedDailyUsage(userId, async (connection, metricDate, row) => {
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

export async function getChatMemorySnapshot(userId: string) {
  await ensureChatSchema()

  const rows = await queryRows<ChatMemoryRow[]>(
    `
      SELECT
        user_id,
        summary_text,
        summary_token_estimate,
        summarized_message_count,
        model_used,
        updated_at
      FROM user_chat_memory
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId]
  )

  return toMemorySnapshot(rows[0] ?? null)
}

export async function getRecentConversationMessages(userId: string, limit = CHAT_VISIBLE_MESSAGE_LIMIT) {
  await ensureChatSchema()

  const rows = await queryRows<ChatMessageRow[]>(
    `
      SELECT
        id,
        user_id,
        role,
        locale,
        content,
        resolved_model,
        included_in_memory_at,
        created_at
      FROM user_chat_messages
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT ?
    `,
    [userId, limit]
  )

  return rows.reverse().map(toConversationMessage)
}

export async function getRecentContextMessages(userId: string, limit = CHAT_COMPACTION_KEEP_MESSAGE_COUNT + 4) {
  await ensureChatSchema()

  const rows = await queryRows<ChatMessageRow[]>(
    `
      SELECT
        id,
        user_id,
        role,
        locale,
        content,
        resolved_model,
        included_in_memory_at,
        created_at
      FROM user_chat_messages
      WHERE user_id = ?
        AND included_in_memory_at IS NULL
      ORDER BY id DESC
      LIMIT ?
    `,
    [userId, limit]
  )

  return rows.reverse().map(toConversationMessage)
}

export async function getChatState(userId: string): Promise<ChatStateResponse> {
  const [messages, memory, usage] = await Promise.all([
    getRecentConversationMessages(userId),
    getChatMemorySnapshot(userId),
    getChatUsageSnapshot(userId),
  ])

  return {
    messages,
    memory,
    usage,
    policy: getChatPolicySnapshot(),
  }
}

export function getChatPolicySnapshot(): ChatPolicySnapshot {
  return {
    dailyLimit: CHAT_DAILY_REQUEST_LIMIT,
    maxInputCharacters: CHAT_INPUT_MAX_CHARACTERS,
    resetTimeZone: CHAT_TIME_ZONE,
  }
}

export async function getCompactionCandidate(userId: string) {
  await ensureChatSchema()

  const rows = await queryRows<ChatMessageRow[]>(
    `
      SELECT
        id,
        user_id,
        role,
        locale,
        content,
        resolved_model,
        included_in_memory_at,
        created_at
      FROM user_chat_messages
      WHERE user_id = ?
        AND included_in_memory_at IS NULL
      ORDER BY id ASC
    `,
    [userId]
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.userId,
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

    await connection.execute(
      `
        INSERT INTO user_chat_messages (
          user_id,
          role,
          locale,
          content,
          requested_model,
          resolved_model,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          cached_prompt_tokens
        ) VALUES (?, 'user', ?, ?, ?, ?, ?, 0, ?, ?)
      `,
      [
        input.userId,
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
        ) VALUES (?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.userId,
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

export async function markDailyChatFailure(input: {
  userId: string
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

export async function persistCompactedMemory(input: {
  userId: string
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
        INSERT INTO user_chat_memory (
          user_id,
          summary_text,
          summary_token_estimate,
          summarized_message_count,
          model_used,
          last_compacted_at
        ) VALUES (?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          summary_text = VALUES(summary_text),
          summary_token_estimate = VALUES(summary_token_estimate),
          summarized_message_count = summarized_message_count + VALUES(summarized_message_count),
          model_used = VALUES(model_used),
          last_compacted_at = NOW()
      `,
      [
        input.userId,
        encryptDatabaseValue(
          input.summary.slice(0, CHAT_MEMORY_SUMMARY_MAX_CHARACTERS),
          "chat.memory.summary"
        ),
        estimateTextTokens(input.summary),
        input.summarizedMessageCount,
        input.resolvedModel,
      ]
    )

    const placeholders = input.summarizedMessageIds.map(() => "?").join(", ")
    await connection.execute(
      `
        UPDATE user_chat_messages
        SET included_in_memory_at = NOW()
        WHERE user_id = ?
          AND id IN (${placeholders})
      `,
      [input.userId, ...input.summarizedMessageIds]
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

export async function deleteChatDataForUser(userId: string) {
  await ensureChatSchema()

  const connection = await getDbPool().getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute("DELETE FROM user_chat_request_events WHERE user_id = ?", [userId])
    await connection.execute("DELETE FROM user_chat_messages WHERE user_id = ?", [userId])
    await connection.execute("DELETE FROM user_chat_memory WHERE user_id = ?", [userId])
    await connection.execute("DELETE FROM user_chat_usage_daily WHERE user_id = ?", [userId])
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
