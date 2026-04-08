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
  created_at: Date | string
}

export interface JeonjuChatMessage {
  id: number
  userId: string | null
  nickname: string
  nicknameTag: string
  content: string
  isAnonymous: boolean
  createdAt: string
}

function toPublicMessage(row: JeonjuChatMessageRow): JeonjuChatMessage {
  const createdAt = row.created_at instanceof Date
    ? row.created_at.toISOString()
    : new Date(row.created_at).toISOString()

  return {
    id: row.id,
    userId: row.is_anonymous ? null : row.user_id,
    nickname: row.is_anonymous ? (row.nickname.startsWith("익명") ? row.nickname : "익명") : row.nickname,
    nicknameTag: row.is_anonymous ? "" : row.nickname_tag,
    content: decryptDatabaseValue(row.content, "jeonju.chat.content"),
    isAnonymous: row.is_anonymous === 1,
    createdAt,
  }
}

const MESSAGE_SELECT_COLS = `
  id, user_id, nickname, nickname_tag, content, is_anonymous, created_at
`

/**
 * 최근 N개의 메시지를 가져옵니다.
 */
export async function getRecentMessages(limit: number = 50): Promise<JeonjuChatMessage[]> {
  await ensureJeonjuChatSchema()

  const rows = await queryRows<JeonjuChatMessageRow[]>(
    `SELECT ${MESSAGE_SELECT_COLS}
     FROM jeonju_chat_messages
     WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY created_at DESC
     LIMIT ?`,
    [Math.min(limit, 100)]
  )

  // Reverse so oldest messages come first
  return rows.reverse().map(toPublicMessage)
}

/**
 * 특정 ID 이후의 새 메시지들을 가져옵니다 (polling용).
 */
export async function getMessagesSince(afterId: number): Promise<JeonjuChatMessage[]> {
  await ensureJeonjuChatSchema()

  const rows = await queryRows<JeonjuChatMessageRow[]>(
    `SELECT ${MESSAGE_SELECT_COLS}
     FROM jeonju_chat_messages
     WHERE id > ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY created_at ASC
     LIMIT 50`,
    [afterId]
  )

  return rows.map(toPublicMessage)
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

  return toPublicMessage(rows[0])
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
}
