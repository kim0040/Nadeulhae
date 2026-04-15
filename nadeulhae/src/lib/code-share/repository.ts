import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"

import {
  CODE_SHARE_DEFAULT_LANGUAGE,
  CODE_SHARE_DEFAULT_TITLE,
  CODE_SHARE_INACTIVITY_MS,
  CODE_SHARE_MAX_CODE_LENGTH,
  CODE_SHARE_MAX_LANGUAGE_LENGTH,
  CODE_SHARE_MAX_TITLE_LENGTH,
} from "@/lib/code-share/constants"
import { ensureCodeShareSchema } from "@/lib/code-share/schema"
import type {
  CodeShareCreateInput,
  CodeShareSessionSnapshot,
  CodeShareSessionStatus,
  CodeShareSessionSummary,
  CodeShareUpdateInput,
  CodeShareUpdateResult,
} from "@/lib/code-share/types"
import { executeStatement, queryRows } from "@/lib/db"

interface CodeShareSessionRow extends RowDataPacket {
  session_id: string
  owner_actor_id: string
  owner_user_id: string | null
  title_text: string
  language_code: string
  code_text: string
  status: string
  version: number
  created_at: Date | string
  updated_at: Date | string
  last_activity_at: Date | string
  closed_at: Date | string | null
}

interface CodeShareOwnerRow extends RowDataPacket {
  owner_actor_id: string
  owner_user_id: string | null
}

// Normalize database timestamps into stable ISO strings for API responses.
function toIsoString(value: Date | string | null) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

// Normalizers are shared by create/update paths so server-side constraints stay consistent.
function normalizeTitle(value: string) {
  const normalized = value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CODE_SHARE_MAX_TITLE_LENGTH)

  return normalized || CODE_SHARE_DEFAULT_TITLE
}

function normalizeLanguage(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9#+._-]/g, "")
    .slice(0, CODE_SHARE_MAX_LANGUAGE_LENGTH)

  return normalized || CODE_SHARE_DEFAULT_LANGUAGE
}

function normalizeCode(value: string) {
  return value
    .replace(/\u0000/g, "")
    .slice(0, CODE_SHARE_MAX_CODE_LENGTH)
}

function normalizeStatus(value: string): CodeShareSessionStatus {
  return value === "closed" ? "closed" : "active"
}

function toSummary(row: CodeShareSessionRow): CodeShareSessionSummary {
  return {
    sessionId: row.session_id,
    title: row.title_text,
    language: row.language_code,
    status: normalizeStatus(row.status),
    version: Math.max(1, Math.floor(row.version ?? 1)),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
    lastActivityAt: toIsoString(row.last_activity_at) ?? new Date().toISOString(),
    closedAt: toIsoString(row.closed_at),
    codeSize: typeof row.code_text === "string" ? row.code_text.length : 0,
  }
}

function toSnapshot(row: CodeShareSessionRow): CodeShareSessionSnapshot {
  return {
    ...toSummary(row),
    code: row.code_text,
  }
}

// Centralized column list keeps all row projections aligned with mapper helpers.
const CODE_SHARE_SELECT_COLUMNS = `
  session_id,
  owner_actor_id,
  owner_user_id,
  title_text,
  language_code,
  code_text,
  status,
  version,
  created_at,
  updated_at,
  last_activity_at,
  closed_at
`

async function getSessionRowById(sessionId: string) {
  await ensureCodeShareSchema()

  const rows = await queryRows<CodeShareSessionRow[]>(
    `SELECT ${CODE_SHARE_SELECT_COLUMNS}
      FROM code_share_sessions
      WHERE session_id = ?
      LIMIT 1`,
    [sessionId]
  )

  return rows[0] ?? null
}

export async function closeInactiveCodeShareSessions() {
  await ensureCodeShareSchema()

  // Inactivity auto-close is evaluated on read/write entrypoints to avoid a separate cron dependency.
  const cutoff = new Date(Date.now() - CODE_SHARE_INACTIVITY_MS)

  const staleRows = await queryRows<CodeShareSessionRow[]>(
    `SELECT ${CODE_SHARE_SELECT_COLUMNS}
      FROM code_share_sessions
      WHERE status = 'active'
        AND last_activity_at < ?`,
    [cutoff]
  )

  if (staleRows.length === 0) {
    return [] as string[]
  }

  await executeStatement(
    `UPDATE code_share_sessions
      SET status = 'closed',
          closed_at = COALESCE(closed_at, UTC_TIMESTAMP()),
          updated_at = UTC_TIMESTAMP()
      WHERE status = 'active'
        AND last_activity_at < ?`,
    [cutoff]
  )

  return staleRows.map((row) => row.session_id)
}

export async function createCodeShareSession(input: CodeShareCreateInput) {
  await ensureCodeShareSchema()

  await executeStatement(
    `INSERT INTO code_share_sessions (
      session_id,
      owner_actor_id,
      owner_user_id,
      title_text,
      language_code,
      code_text,
      status,
      version,
      last_activity_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', 1, UTC_TIMESTAMP())`,
    [
      input.sessionId,
      input.ownerActorId,
      input.ownerUserId,
      normalizeTitle(input.title),
      normalizeLanguage(input.language),
      normalizeCode(input.code),
    ]
  )

  const row = await getSessionRowById(input.sessionId)
  return row ? toSnapshot(row) : null
}

export async function listCodeShareSessionsByOwner(params: {
  actorId: string
  userId?: string | null
  limit?: number
}) {
  await ensureCodeShareSchema()

  const limit = Math.max(1, Math.min(300, Math.floor(params.limit ?? 100)))
  let rows: CodeShareSessionRow[] = []

  if (params.userId) {
    rows = await queryRows<CodeShareSessionRow[]>(
      `SELECT ${CODE_SHARE_SELECT_COLUMNS}
        FROM code_share_sessions
        WHERE owner_actor_id = ? OR owner_user_id = ?
        ORDER BY updated_at DESC
        LIMIT ?`,
      [params.actorId, params.userId, limit]
    )
  } else {
    rows = await queryRows<CodeShareSessionRow[]>(
      `SELECT ${CODE_SHARE_SELECT_COLUMNS}
        FROM code_share_sessions
        WHERE owner_actor_id = ?
        ORDER BY updated_at DESC
        LIMIT ?`,
      [params.actorId, limit]
    )
  }

  return rows.map(toSummary)
}

export async function getCodeShareSessionById(sessionId: string) {
  const row = await getSessionRowById(sessionId)
  return row ? toSnapshot(row) : null
}

export async function touchCodeShareSessionActivity(sessionId: string) {
  await ensureCodeShareSchema()

  await executeStatement(
    `UPDATE code_share_sessions
      SET last_activity_at = UTC_TIMESTAMP(),
          updated_at = UTC_TIMESTAMP()
      WHERE session_id = ?
        AND status = 'active'`,
    [sessionId]
  )
}

export async function updateCodeShareSession(input: CodeShareUpdateInput): Promise<CodeShareUpdateResult> {
  await ensureCodeShareSchema()

  const result = await executeStatement(
    `UPDATE code_share_sessions
      SET title_text = ?,
          language_code = ?,
          code_text = ?,
          version = version + 1,
          last_activity_at = UTC_TIMESTAMP(),
          updated_at = UTC_TIMESTAMP()
      WHERE session_id = ?
        AND status = 'active'
        AND version = ?`,
    [
      normalizeTitle(input.title),
      normalizeLanguage(input.language),
      normalizeCode(input.code),
      input.sessionId,
      Math.max(1, Math.floor(input.expectedVersion)),
    ]
  ) as ResultSetHeader

  // Optimistic lock: no affected row means stale version or inactive/missing session.
  if (result.affectedRows <= 0) {
    const latest = await getSessionRowById(input.sessionId)
    if (!latest) {
      return { ok: false, reason: "not_found", session: null }
    }

    if (normalizeStatus(latest.status) === "closed") {
      return { ok: false, reason: "closed", session: toSnapshot(latest) }
    }

    return {
      ok: false,
      reason: "version_conflict",
      session: toSnapshot(latest),
    }
  }

  const updated = await getSessionRowById(input.sessionId)
  if (!updated) {
    return { ok: false, reason: "not_found", session: null }
  }

  return {
    ok: true,
    session: toSnapshot(updated),
  }
}

function isOwner(owner: CodeShareOwnerRow, actorId: string, userId: string | null) {
  if (owner.owner_actor_id === actorId) {
    return true
  }

  if (userId && owner.owner_user_id && owner.owner_user_id === userId) {
    return true
  }

  return false
}

export async function deleteCodeShareSessionById(params: {
  sessionId: string
  actorId: string
  userId?: string | null
}) {
  await ensureCodeShareSchema()

  const rows = await queryRows<CodeShareOwnerRow[]>(
    `SELECT owner_actor_id, owner_user_id
      FROM code_share_sessions
      WHERE session_id = ?
      LIMIT 1`,
    [params.sessionId]
  )

  const ownerRow = rows[0]
  if (!ownerRow) {
    return { ok: false as const, reason: "not_found" as const }
  }

  // Deletion is intentionally owner-only even though editing is link-based.
  if (!isOwner(ownerRow, params.actorId, params.userId ?? null)) {
    return { ok: false as const, reason: "forbidden" as const }
  }

  const result = await executeStatement(
    `DELETE FROM code_share_sessions
      WHERE session_id = ?
      LIMIT 1`,
    [params.sessionId]
  ) as ResultSetHeader

  if (result.affectedRows <= 0) {
    return { ok: false as const, reason: "not_found" as const }
  }

  return { ok: true as const }
}

export async function isCodeShareSessionOwner(params: {
  sessionId: string
  actorId: string
  userId?: string | null
}) {
  await ensureCodeShareSchema()

  const rows = await queryRows<CodeShareOwnerRow[]>(
    `SELECT owner_actor_id, owner_user_id
      FROM code_share_sessions
      WHERE session_id = ?
      LIMIT 1`,
    [params.sessionId]
  )

  const ownerRow = rows[0]
  if (!ownerRow) {
    return false
  }

  return isOwner(ownerRow, params.actorId, params.userId ?? null)
}
