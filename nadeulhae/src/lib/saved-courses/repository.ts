/**
 * Saved Courses — persistence for user-saved outing courses + shareable links.
 *
 * Uses the project's self-migrating pattern: `ensureSavedCoursesSchema()` runs
 * `CREATE TABLE IF NOT EXISTS` (memoised via a module-level promise), so the
 * table is created on first use with no separate migration step. Every public
 * function calls it first, so callers never need to.
 */
import { randomBytes, randomUUID } from "node:crypto"

import { getDbPool, executeStatement, queryRows } from "@/lib/db"
import type { RowDataPacket } from "mysql2"

declare global {
  var __nadeulhaeSavedCoursesSchemaPromise: Promise<void> | undefined
}

const MAX_TITLE_LENGTH = 120
const MAX_SLOTS_BYTES = 60_000 // guardrail against oversized payloads
const DEFAULT_TITLE = "저장한 코스"

const createSavedCoursesTableSql = `
  CREATE TABLE IF NOT EXISTS saved_courses (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    title VARCHAR(120) NOT NULL,
    slots JSON NOT NULL,
    weather_snapshot JSON NULL,
    share_token VARCHAR(32) NOT NULL,
    is_public TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_saved_courses_share_token (share_token),
    KEY idx_saved_courses_user (user_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

/** Idempotently ensure the saved_courses table exists. Memoised per process. */
export async function ensureSavedCoursesSchema() {
  if (globalThis.__nadeulhaeSavedCoursesSchemaPromise) {
    return globalThis.__nadeulhaeSavedCoursesSchemaPromise
  }

  const bootstrap = (async () => {
    await getDbPool().query(createSavedCoursesTableSql)
  })()

  globalThis.__nadeulhaeSavedCoursesSchemaPromise = bootstrap.catch((error) => {
    globalThis.__nadeulhaeSavedCoursesSchemaPromise = undefined
    throw error
  })

  return globalThis.__nadeulhaeSavedCoursesSchemaPromise
}

interface SavedCourseRow extends RowDataPacket {
  id: string
  title: string
  slots: unknown
  weather_snapshot: unknown
  share_token: string
  is_public: number
  created_at: Date | string
}

export interface SavedCourse {
  id: string
  title: string
  slots: unknown[]
  weatherSnapshot: unknown | null
  shareToken: string
  isPublic: boolean
  createdAt: string
}

/** Strip control characters and collapse whitespace in a user-supplied title. */
function sanitizeTitle(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_TITLE
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TITLE_LENGTH)
  return cleaned.length > 0 ? cleaned : DEFAULT_TITLE
}

/** JSON columns may come back as a string or a pre-parsed value depending on driver config. */
function parseJsonColumn(value: unknown): unknown {
  if (value == null) return null
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

function toSavedCourse(row: SavedCourseRow): SavedCourse {
  const slots = parseJsonColumn(row.slots)
  return {
    id: row.id,
    title: row.title,
    slots: Array.isArray(slots) ? slots : [],
    weatherSnapshot: parseJsonColumn(row.weather_snapshot),
    shareToken: row.share_token,
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

/** Persist a course for a user. Returns the new id + share token. */
export async function saveCourse(input: {
  userId: string
  title: string
  slots: unknown[]
  weatherSnapshot?: unknown | null
  isPublic?: boolean
}): Promise<{ id: string; shareToken: string }> {
  await ensureSavedCoursesSchema()

  const title = sanitizeTitle(input.title)
  const slotsJson = JSON.stringify(Array.isArray(input.slots) ? input.slots : [])
  if (slotsJson.length > MAX_SLOTS_BYTES) {
    throw new Error("Course payload too large.")
  }
  const weatherJson = input.weatherSnapshot != null ? JSON.stringify(input.weatherSnapshot) : null
  const id = randomUUID()
  const shareToken = randomBytes(12).toString("base64url")
  const isPublic = input.isPublic === false ? 0 : 1

  if (weatherJson == null) {
    await executeStatement(
      `
        INSERT INTO saved_courses (id, user_id, title, slots, weather_snapshot, share_token, is_public)
        VALUES (?, ?, ?, CAST(? AS JSON), NULL, ?, ?)
      `,
      [id, input.userId, title, slotsJson, shareToken, isPublic]
    )
  } else {
    await executeStatement(
      `
        INSERT INTO saved_courses (id, user_id, title, slots, weather_snapshot, share_token, is_public)
        VALUES (?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?)
      `,
      [id, input.userId, title, slotsJson, weatherJson, shareToken, isPublic]
    )
  }

  return { id, shareToken }
}

/** List a user's saved courses, newest first. */
export async function listSavedCoursesForUser(userId: string, limit = 50): Promise<SavedCourse[]> {
  await ensureSavedCoursesSchema()
  const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)))
  const rows = await queryRows<SavedCourseRow[]>(
    `
      SELECT id, title, slots, weather_snapshot, share_token, is_public, created_at
      FROM saved_courses
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    `,
    [userId]
  )
  return rows.map(toSavedCourse)
}

/** Fetch a course by its public share token (only if still public). */
export async function getSavedCourseByShareToken(shareToken: string): Promise<SavedCourse | null> {
  await ensureSavedCoursesSchema()
  const rows = await queryRows<SavedCourseRow[]>(
    `
      SELECT id, title, slots, weather_snapshot, share_token, is_public, created_at
      FROM saved_courses
      WHERE share_token = ?
        AND is_public = 1
      LIMIT 1
    `,
    [shareToken]
  )
  return rows[0] ? toSavedCourse(rows[0]) : null
}

/** Toggle a saved course's public visibility (owner-only). Returns true if updated. */
export async function setSavedCourseVisibility(input: {
  userId: string
  id: string
  isPublic: boolean
}): Promise<boolean> {
  await ensureSavedCoursesSchema()
  const result = await executeStatement(
    `UPDATE saved_courses SET is_public = ? WHERE id = ? AND user_id = ?`,
    [input.isPublic ? 1 : 0, input.id, input.userId]
  )
  return result.affectedRows > 0
}

/** Delete a saved course owned by the user. Returns true if a row was removed. */
export async function deleteSavedCourse(input: { userId: string; id: string }): Promise<boolean> {
  await ensureSavedCoursesSchema()
  const result = await executeStatement(
    `DELETE FROM saved_courses WHERE id = ? AND user_id = ?`,
    [input.id, input.userId]
  )
  return result.affectedRows > 0
}
