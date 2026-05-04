/**
 * Type definitions for the Code Share module.
 *
 * Defines the shapes of session summaries, full snapshots,
 * create/update payloads, and optimistic-lock update results
 * returned by the data-access layer.
 */
/** Active sessions accept edits; closed sessions are read-only. */
export type CodeShareSessionStatus = "active" | "closed"

/**
 * Lightweight summary returned by list/index endpoints.
 * Omits the full code body to keep payloads small for
 * hub/list screens.
 */
export interface CodeShareSessionSummary {
  sessionId: string
  title: string
  language: string
  status: CodeShareSessionStatus
  version: number
  createdAt: string
  updatedAt: string
  lastActivityAt: string
  closedAt: string | null
  codeSize: number
}

/**
 * Full session payload including the code body.
 * Used by the editor page and snapshot endpoints.
 */
export interface CodeShareSessionSnapshot extends CodeShareSessionSummary {
  code: string
}

/** Input payload for creating a new code-share session. */
export interface CodeShareCreateInput {
  sessionId: string
  ownerActorId: string
  ownerUserId: string | null
  title: string
  language: string
  code: string
}

/** Input payload for updating a session. Uses optimistic-lock via `expectedVersion`. */
export interface CodeShareUpdateInput {
  sessionId: string
  title: string
  language: string
  code: string
  expectedVersion: number
}

/**
 * Result of a PATCH update operation.
 * On success returns the updated snapshot; on failure returns
 * the reason (`not_found` | `closed` | `version_conflict`) and
 * the latest snapshot if one exists.
 */
export type CodeShareUpdateResult =
  | {
    ok: true
    session: CodeShareSessionSnapshot
  }
  | {
    ok: false
    reason: "not_found" | "closed" | "version_conflict"
    session: CodeShareSessionSnapshot | null
  }
