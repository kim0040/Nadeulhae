import { getDbPool } from "@/lib/db"
import { decryptDatabaseValueSafely, encryptDatabaseValue, isEncryptedDatabaseValue } from "@/lib/security/data-protection"
import type { RowDataPacket } from "mysql2/promise"

declare global {
  var __nadeulhaeJeonjuChatSchemaPromise: Promise<void> | undefined
}

const createJeonjuChatTableSql = `
  CREATE TABLE IF NOT EXISTS jeonju_chat_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id CHAR(36) NULL,
    nickname VARCHAR(32) NOT NULL,
    nickname_tag CHAR(4) NOT NULL DEFAULT '0000',
    content TEXT NOT NULL,
    is_anonymous TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_jeonju_chat_created (created_at),
    KEY idx_jeonju_chat_user_id (user_id)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const modifyJeonjuChatContentColumnSql = `
  ALTER TABLE jeonju_chat_messages
    MODIFY COLUMN content TEXT NOT NULL
`

const deleteOldMessagesSql = `
  DELETE FROM jeonju_chat_messages
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
`

interface JeonjuChatMigrationRow extends RowDataPacket {
  id: number
  content: string
}

const MAX_MIGRATION_BATCHES = 200

async function migrateJeonjuChatContents() {
  const pool = getDbPool()

  for (let i = 0; i < MAX_MIGRATION_BATCHES; i++) {
    const [rows] = await pool.query<JeonjuChatMigrationRow[]>(
      `
        SELECT id, content
        FROM jeonju_chat_messages
        WHERE content NOT LIKE 'enc:v1:%'
        LIMIT 200
      `
    )

    if (rows.length === 0) {
      return
    }

    for (const row of rows) {
      const plain = decryptDatabaseValueSafely(row.content, "jeonju.chat.content") ?? row.content
      await pool.execute(
        `
          UPDATE jeonju_chat_messages
          SET content = ?
          WHERE id = ?
        `,
        [
          isEncryptedDatabaseValue(row.content)
            ? row.content
            : encryptDatabaseValue(plain, "jeonju.chat.content"),
          row.id,
        ]
      )
    }
  }
}

export async function ensureJeonjuChatSchema() {
  if (globalThis.__nadeulhaeJeonjuChatSchemaPromise) {
    return globalThis.__nadeulhaeJeonjuChatSchemaPromise
  }

  const bootstrapPromise = (async () => {
    const pool = getDbPool()
    await pool.query(createJeonjuChatTableSql)
    await pool.query(modifyJeonjuChatContentColumnSql)
    await migrateJeonjuChatContents()
    // Perform 7-day retention cleanup on boot
    await pool.query(deleteOldMessagesSql)
  })()

  globalThis.__nadeulhaeJeonjuChatSchemaPromise = bootstrapPromise.catch((error) => {
    globalThis.__nadeulhaeJeonjuChatSchemaPromise = undefined
    throw error
  })

  return globalThis.__nadeulhaeJeonjuChatSchemaPromise
}
