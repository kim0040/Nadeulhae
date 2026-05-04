/**
 * Auth guardrail constants and helpers.
 * Defines rate-limit thresholds, body-size limits,
 * and utility functions for scoping rate-limit keys.
 */
import { createBlindIndex } from "@/lib/security/data-protection"

/** Maximum request body size (16 KB) for auth endpoints. */
export const AUTH_BODY_LIMIT_BYTES = 16 * 1024
/** Artificial delay injected on auth failures to slow brute-force attacks (450 ms). */
export const AUTH_FAILURE_DELAY_MS = 450
function parsePositiveIntEnv(raw: string | undefined, fallback: number) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.max(1, Math.floor(parsed))
}

/** Maximum concurrent sessions allowed per user (env: AUTH_MAX_SESSIONS_PER_USER, default 5). */
export const MAX_ACTIVE_SESSIONS_PER_USER = parsePositiveIntEnv(
  process.env.AUTH_MAX_SESSIONS_PER_USER,
  5
)

/** Per-IP rate limit for login: 10 attempts per 15-minute window, then 15-min block. */
export const LOGIN_IP_LIMIT = {
  action: "login",
  limit: 10,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
} as const

/** Per-email rate limit for login: 5 attempts per 15-minute window, then 15-min block. */
export const LOGIN_EMAIL_LIMIT = {
  action: "login",
  limit: 5,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
} as const

/** Per-IP rate limit for registration: 6 attempts per 1-hour window, then 1-hour block. */
export const REGISTER_IP_LIMIT = {
  action: "register",
  limit: 6,
  windowMs: 60 * 60 * 1000,
  blockMs: 60 * 60 * 1000,
} as const

/** Per-email rate limit for registration: 3 attempts per 1-hour window, then 1-hour block. */
export const REGISTER_EMAIL_LIMIT = {
  action: "register",
  limit: 3,
  windowMs: 60 * 60 * 1000,
  blockMs: 60 * 60 * 1000,
} as const

/** Builds a rate-limit scope key combining type (ip/email) with a blind index of the value. */
export function getAuthScopeKey(type: "ip" | "email", value: string) {
  const normalized = value.trim().toLowerCase()
  return `${type}:${createBlindIndex(normalized, `auth.scope.${type}`)}`
}

/** Promise-based delay helper for introducing artificial wait times. */
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
