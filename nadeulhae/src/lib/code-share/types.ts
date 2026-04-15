export type CodeShareSessionStatus = "active" | "closed"

// Lightweight list payload used by hub/list screens.
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

// Full payload used by the editor page (summary + code text).
export interface CodeShareSessionSnapshot extends CodeShareSessionSummary {
  code: string
}

export interface CodeShareCreateInput {
  sessionId: string
  ownerActorId: string
  ownerUserId: string | null
  title: string
  language: string
  code: string
}

export interface CodeShareUpdateInput {
  sessionId: string
  title: string
  language: string
  code: string
  expectedVersion: number
}

// PATCH uses optimistic version checks; conflict/closed/not-found share the latest snapshot when available.
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
