/**
 * Data-access layer for the Code Share module.
 *
 * Provides CRUD operations for collaborative code-editing sessions,
 * including optimistic-lock updates, inactivity auto-close, and
 * owner-scoped listing/deletion. All public functions lazily
 * bootstrap the schema on first invocation.
 */
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

/** Database row shape for the `code_share_sessions` table. Snake_case columns are mapped to camelCase API types. */
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

/** Minimal row projection used for ownership checks — avoids fetching the full session body. */
interface CodeShareOwnerRow extends RowDataPacket {
  owner_actor_id: string
  owner_user_id: string | null
}

/**
 * Normalizes database timestamps (Date or string) into stable ISO-8601 strings.
 * Falls back to the current time on parse failure;
 * returns `null` for falsy inputs.
 */
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

/**
 * Strips control characters, collapses whitespace, and truncates
 * to max title length. Falls back to the default title when empty.
 * Normalizers are shared by create/update paths for consistent constraints.
 */
function normalizeTitle(value: string) {
  const normalized = value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CODE_SHARE_MAX_TITLE_LENGTH)

  return normalized || CODE_SHARE_DEFAULT_TITLE
}

/** Lowercases, strips special characters except common delimiters, truncates. Falls back to `plaintext` when empty. */
function normalizeLanguage(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9#+._-]/g, "")
    .slice(0, CODE_SHARE_MAX_LANGUAGE_LENGTH)

  return normalized || CODE_SHARE_DEFAULT_LANGUAGE
}

/** Removes null bytes and truncates to the configured max code length. */
function normalizeCode(value: string) {
  return value
    .replace(/\u0000/g, "")
    .slice(0, CODE_SHARE_MAX_CODE_LENGTH)
}

/** Coerces a raw status string to the union type; any value other than `"closed"` becomes `"active"`. */
function normalizeStatus(value: string): CodeShareSessionStatus {
  return value === "closed" ? "closed" : "active"
}

/** Maps a database row to the summary shape used by list/index endpoints. */
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

/** Maps a database row to the full snapshot shape (summary + code body). */
function toSnapshot(row: CodeShareSessionRow): CodeShareSessionSnapshot {
  return {
    ...toSummary(row),
    code: row.code_text,
  }
}

/**
 * Centralised column list used by all SELECT queries.
 * Keeps row projections aligned with `CodeShareSessionRow` and mapper helpers.
 */
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

/** Fetches a single session row by ID, or `null` when not found. Lazily bootstraps schema. */
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

/**
 * Closes all active sessions whose `last_activity_at` exceeds the inactivity threshold.
 * Returns the list of closed session IDs. Evaluated synchronously on read/write
 * entrypoints to avoid needing a separate cron-based cleanup job.
 */
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

/**
 * Creates a new code-share session with the given input.
 * Normalizes title, language, and code before persisting.
 * Returns the created snapshot, or `null` if insertion failed.
 */
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

/**
 * Lists sessions owned by a given actor (or user). When `userId` is provided,
 * matches both `owner_actor_id` and `owner_user_id` for broader scope.
 * Results are ordered by most-recently-updated, capped at 300 entries.
 */
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

/** Fetches the full session snapshot by ID. Returns `null` when the session does not exist. */
export async function getCodeShareSessionById(sessionId: string) {
  const row = await getSessionRowById(sessionId)
  return row ? toSnapshot(row) : null
}

/** Touches `last_activity_at` and `updated_at` for an active session to prevent premature inactivity auto-close. */
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

/**
 * Updates a session with an optimistic-lock check (`version = expectedVersion`).
 * On mismatch, inspects the current row to determine whether the cause is
 * a version conflict, a closed session, or a missing session.
 */
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

/** Returns `true` when the given actor/user matches the session owner. Prefers `owner_user_id` when available (authenticated owner). */
function isOwner(owner: CodeShareOwnerRow, actorId: string, userId: string | null) {
  if (owner.owner_user_id) {
    return Boolean(userId && owner.owner_user_id === userId)
  }

  return owner.owner_actor_id === actorId
}

/**
 * Deletes a session by ID, but only when the requester is the session owner.
 * Non-owners receive a `forbidden` result; missing sessions return `not_found`.
 */
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

/**
 * Checks whether the given actor (or user) is the owner of a session.
 * Returns `false` when the session does not exist.
 */
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
