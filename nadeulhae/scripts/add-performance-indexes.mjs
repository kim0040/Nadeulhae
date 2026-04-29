// Add performance-optimized composite indexes for hot query paths.
// Idempotent — skips indexes that already exist.

import { createPool } from "mysql2/promise"
import dotenv from "dotenv"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local") })

const INDEXES = [
  {
    name: "idx_chat_msgs_user_session",
    table: "user_chat_messages",
    columns: "(user_id, session_id, id)",
    purpose: "session message listing, compaction queries",
  },
  {
    name: "idx_chat_msgs_user_role",
    table: "user_chat_messages",
    columns: "(user_id, role, id)",
    purpose: "profile memory refresh queries",
  },
  {
    name: "idx_chat_msgs_compaction",
    table: "user_chat_messages",
    columns: "(user_id, session_id, included_in_memory_at, id)",
    purpose: "compaction candidate lookup",
  },
  {
    name: "idx_lab_cards_user_due",
    table: "lab_cards",
    columns: "(user_id, next_review_at, id)",
    purpose: "due card fetching for spaced repetition",
  },
  {
    name: "idx_lab_cards_deck_user",
    table: "lab_cards",
    columns: "(deck_id, user_id)",
    purpose: "deck summary JOIN performance",
  },
  {
    name: "idx_code_share_status_activity",
    table: "code_share_sessions",
    columns: "(status, last_activity_at)",
    purpose: "inactive session cleanup queries",
  },
  {
    name: "idx_jeonju_chat_created",
    table: "jeonju_chat_messages",
    columns: "(created_at)",
    purpose: "7-day retention purge queries",
  },
  {
    name: "idx_auth_attempts_action_scope",
    table: "auth_attempt_buckets",
    columns: "(action, scope_key)",
    purpose: "rate limit bucket lookups",
  },
]

async function main() {
  const pool = createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_CA_PATH ? { ca: process.env.DB_CA_PATH } : undefined,
    waitForConnections: true,
    connectionLimit: 2,
  })

  let created = 0
  let skipped = 0
  let failed = 0

  for (const idx of INDEXES) {
    try {
      await pool.execute(
        `CREATE INDEX ${idx.name} ON ${idx.table} ${idx.columns}`
      )
      console.log(`[OK] ${idx.name} on ${idx.table}${idx.columns} — ${idx.purpose}`)
      created += 1
    } catch (error) {
      if (error.code === "ER_DUP_KEYNAME" || error.message?.includes("Duplicate key name")) {
        console.log(`[SKIP] ${idx.name} already exists`)
        skipped += 1
      } else {
        console.error(`[FAIL] ${idx.name}: ${error.message}`)
        failed += 1
      }
    }
  }

  console.log(`\n${created} created, ${skipped} skipped, ${failed} failed`)

  await pool.end()

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message)
  process.exit(1)
})
