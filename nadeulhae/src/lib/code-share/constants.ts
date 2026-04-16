/**
 * ── CodeShare 부하 최적화 메모 (2026-04-16) ──
 *
 * 현재 규모에서는 문제없으나, 동시 사용자 증가 시 아래 순서로 적용 고려:
 *
 * 1. closeInactiveCodeShareSessions()가 GET/PATCH 매 요청마다 호출됨.
 *    → 5~10분 주기 setInterval 기반 정리로 변경하면 요청당 DB 호출 2개 감소.
 *
 * 2. 클라이언트 autosave debounce가 520ms로 짧음 (code-share-workspace.tsx).
 *    → 1500~2000ms로 확대하면 PATCH 빈도 60-70% 감소.
 *
 * 3. PATCH마다 코드 전문(최대 220KB)을 전송·저장함.
 *    → 대규모 파일 편집 시 diff 기반 전송으로 전환 검토.
 *
 * 4. GET /sessions/:id 에서 touchActivity + 재조회로 4 queries 발생.
 *    → RETURNING 패턴 또는 단일 UPDATE ... SELECT 조합으로 축소 가능.
 *
 * 참고 수치: 동시 5명 편집 시 ~40 queries/초 (MySQL 기준 여유).
 */

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
