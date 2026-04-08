"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import type { AuthUser } from "@/lib/auth/types"

type AuthStatus = "loading" | "authenticated" | "guest"

interface AuthContextValue {
  user: AuthUser | null
  status: AuthStatus
  refreshSession: () => Promise<void>
  setAuthenticatedUser: (user: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

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

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
