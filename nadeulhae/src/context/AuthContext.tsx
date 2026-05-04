"use client"

/**
 * @fileoverview React context and provider for authentication session state.
 *
 * Manages the current user, authentication status (`loading`, `authenticated`,
 * `guest`), and exposes `refreshSession` to re-validate the session
 * (typically called on mount). A `useAuth` hook provides typed access;
 * throws if used outside `AuthProvider`.
 *
 * @module AuthContext
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import type { AuthUser } from "@/lib/auth/types"

/** Current session lifecycle phase — used to gate UI rendering. */
type AuthStatus = "loading" | "authenticated" | "guest"

/** Shape of the context value exposed to consumers. */
interface AuthContextValue {
  user: AuthUser | null
  status: AuthStatus
  refreshSession: () => Promise<void>
  setAuthenticatedUser: (user: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Provides auth state to the component tree. Fetches the current session
 * on mount via `GET /api/auth/me`.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>("loading")

  const setAuthenticatedUser = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser)
    setStatus(nextUser ? "authenticated" : "guest")
  }, [])

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      })

      if (!response.ok) {
        setAuthenticatedUser(null)
        return
      }

      const data = await response.json()
      setAuthenticatedUser(data.user ?? null)
    } catch (error) {
      console.error("Failed to refresh auth session:", error)
      setAuthenticatedUser(null)
    }
  }, [setAuthenticatedUser])

  // Defer session check to avoid blocking the initial paint; setTimeout(0)
  // pushes the fetch to the end of the microtask queue.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshSession()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [refreshSession])

  const value = useMemo(
    () => ({
      user,
      status,
      refreshSession,
      setAuthenticatedUser,
    }),
    [refreshSession, setAuthenticatedUser, status, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Returns the current auth context. Must be called within an `AuthProvider`.
 * Throws if no provider is found in the tree.
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
