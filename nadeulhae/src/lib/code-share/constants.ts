// Shared limits used across API validation, persistence, and client drafts.
export const CODE_SHARE_INACTIVITY_MS = 60 * 60 * 1000
export const CODE_SHARE_MAX_CODE_LENGTH = 220_000
export const CODE_SHARE_MAX_TITLE_LENGTH = 120
export const CODE_SHARE_MAX_LANGUAGE_LENGTH = 40

export const CODE_SHARE_DEFAULT_TITLE = "Untitled session"
export const CODE_SHARE_DEFAULT_LANGUAGE = "plaintext"

export const CODE_SHARE_ROOM_PREFIX = "code_share:"

// Base64url id generated on create (randomBytes -> base64url) and validated across API + WS.
const CODE_SHARE_SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{10,40}$/

export function isValidCodeShareSessionId(value: string) {
  return CODE_SHARE_SESSION_ID_PATTERN.test(value)
}

export function toCodeShareRoomName(sessionId: string) {
  return `${CODE_SHARE_ROOM_PREFIX}${sessionId}`
}
