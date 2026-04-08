import { createBlindIndex } from "@/lib/security/data-protection"

export const AUTH_BODY_LIMIT_BYTES = 16 * 1024
export const AUTH_FAILURE_DELAY_MS = 450
export const MAX_ACTIVE_SESSIONS_PER_USER = Number(
  process.env.AUTH_MAX_SESSIONS_PER_USER ?? "5"
)

export const LOGIN_IP_LIMIT = {
  action: "login",
  limit: 10,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
} as const

export const LOGIN_EMAIL_LIMIT = {
  action: "login",
  limit: 5,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
} as const

export const REGISTER_IP_LIMIT = {
  action: "register",
  limit: 6,
  windowMs: 60 * 60 * 1000,
  blockMs: 60 * 60 * 1000,
} as const

export const REGISTER_EMAIL_LIMIT = {
  action: "register",
  limit: 3,
  windowMs: 60 * 60 * 1000,
  blockMs: 60 * 60 * 1000,
} as const

export function getAuthScopeKey(type: "ip" | "email", value: string) {
  const normalized = value.trim().toLowerCase()
  return `${type}:${createBlindIndex(normalized, `auth.scope.${type}`)}`
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
