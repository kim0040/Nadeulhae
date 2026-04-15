"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Code2, Loader2, Plus, RefreshCcw, Trash2 } from "lucide-react"

import { SectionCard } from "@/components/dashboard/ui"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

type CodeShareSessionSummary = {
  sessionId: string
  title: string
  language: string
  status: "active" | "closed"
  version: number
  updatedAt: string
}

type ViewerIdentity = {
  actorId: string
  alias: string
}

type SessionsApiPayload = {
  sessions?: CodeShareSessionSummary[]
  viewer?: ViewerIdentity
  error?: string
}

const HUB_COPY = {
  ko: {
    badge: "realtime collaboration",
    title: "코드공유 허브",
    subtitle: "새 세션은 하나의 버튼으로 만들고, 아래 목록에서 이전 세션을 다시 열거나 삭제할 수 있습니다.",
    create: "새 세션 만들기",
    creating: "생성 중...",
    listTitle: "이전 세션",
    noSessions: "이전 세션이 없습니다.",
    loading: "세션 목록 불러오는 중...",
    loadFailed: "세션 정보를 불러오지 못했습니다.",
    deleteConfirm: "이 세션을 완전히 삭제할까요?",
    deleting: "삭제 중...",
    delete: "삭제",
    refresh: "새로고침",
    mine: "내 이름",
    statusActive: "활성",
    statusClosed: "종료",
  },
  en: {
    badge: "realtime collaboration",
    title: "Code Share Hub",
    subtitle: "Create sessions with one button, then reopen or delete previous sessions from the list below.",
    create: "Create new session",
    creating: "Creating...",
    listTitle: "Previous sessions",
    noSessions: "No previous sessions.",
    loading: "Loading sessions...",
    loadFailed: "Failed to load sessions.",
    deleteConfirm: "Delete this session permanently?",
    deleting: "Deleting...",
    delete: "Delete",
    refresh: "Refresh",
    mine: "My name",
    statusActive: "Active",
    statusClosed: "Closed",
  },
} as const

function formatDateLabel(value: string, locale: "ko" | "en") {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString(locale === "ko" ? "ko-KR" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function CodeShareHub() {
  const router = useRouter()
  const { language } = useLanguage()
  const copy = HUB_COPY[language]

  const [sessions, setSessions] = useState<CodeShareSessionSummary[]>([])
  const [viewer, setViewer] = useState<ViewerIdentity | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/code-share/sessions", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      })

      const payload = await response.json().catch(() => null) as SessionsApiPayload | null
      if (!response.ok || !payload) {
        throw new Error(payload?.error || copy.loadFailed)
      }

      // Server already filters to owner-visible sessions for current actor identity cookie.
      setSessions(Array.isArray(payload.sessions) ? payload.sessions : [])
      setViewer(payload.viewer ?? null)
      setError(null)
    } catch (loadError) {
      console.error("Failed to load code-share sessions:", loadError)
      setError(loadError instanceof Error ? loadError.message : copy.loadFailed)
    } finally {
      setIsLoading(false)
    }
  }, [copy.loadFailed])

  const handleCreateSession = useCallback(async () => {
    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch("/api/code-share/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          title: language === "ko" ? "새 코드공유 세션" : "New code-share session",
          language: "typescript",
          code: "",
        }),
      })

      const payload = await response.json().catch(() => null) as {
        session?: CodeShareSessionSummary
        viewer?: ViewerIdentity
        error?: string
      } | null

      if (!response.ok || !payload?.session) {
        throw new Error(payload?.error || copy.loadFailed)
      }

      if (payload.viewer) {
        setViewer(payload.viewer)
      }

      // Move directly into focused editor workspace after creation.
      router.push(`/code-share/${payload.session.sessionId}`)
    } catch (createError) {
      console.error("Failed to create code-share session:", createError)
      setError(createError instanceof Error ? createError.message : copy.loadFailed)
    } finally {
      setIsCreating(false)
    }
  }, [copy.loadFailed, language, router])

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (!window.confirm(copy.deleteConfirm)) {
      return
    }

    setDeletingSessionId(sessionId)
    setError(null)

    try {
      const response = await fetch(`/api/code-share/sessions/${sessionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ reason: "owner_request" }),
      })

      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error || copy.loadFailed)
      }

      // Optimistic local removal; websocket delete event covers other open tabs.
      setSessions((previous) => previous.filter((session) => session.sessionId !== sessionId))
    } catch (deleteError) {
      console.error("Failed to delete code-share session:", deleteError)
      setError(deleteError instanceof Error ? deleteError.message : copy.loadFailed)
    } finally {
      setDeletingSessionId(null)
    }
  }, [copy.deleteConfirm, copy.loadFailed])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  return (
    <main className="min-h-screen bg-background px-4 pb-14 pt-24 sm:px-6 sm:pt-28 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <SectionCard>
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-active-blue">
              <Code2 className="size-3.5" />
              {copy.badge}
            </span>
            <div className="space-y-2">
              <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">{copy.title}</h1>
              <p className="max-w-4xl text-base leading-8 text-muted-foreground">{copy.subtitle}</p>
              {viewer?.alias ? (
                <p className="inline-flex items-center rounded-full border border-card-border/70 bg-card/70 px-3 py-1.5 text-xs font-bold text-muted-foreground">
                  {copy.mine}: {viewer.alias}
                </p>
              ) : null}
            </div>
            <ShimmerButton
              type="button"
              className="rounded-[1.05rem] px-5 py-3 text-base font-black"
              onClick={() => void handleCreateSession()}
              disabled={isCreating}
            >
              {isCreating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  {copy.creating}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Plus className="size-4" />
                  {copy.create}
                </span>
              )}
            </ShimmerButton>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">{copy.listTitle}</p>
              <button
                type="button"
                onClick={() => void loadSessions()}
                className="inline-flex items-center gap-1 rounded-full border border-card-border/70 bg-card/70 px-3 py-1.5 text-xs font-black uppercase tracking-[0.15em] text-muted-foreground transition hover:border-sky-blue/35 hover:text-foreground"
              >
                <RefreshCcw className={cn("size-3.5", isLoading ? "animate-spin" : "")} />
                {copy.refresh}
              </button>
            </div>

            {error ? (
              <p className="rounded-[1rem] border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300">
                {error}
              </p>
            ) : null}

            {isLoading ? (
              <p className="rounded-[1rem] border border-card-border/70 bg-background/70 px-3 py-4 text-sm text-muted-foreground">{copy.loading}</p>
            ) : sessions.length === 0 ? (
              <p className="rounded-[1rem] border border-card-border/70 bg-background/70 px-3 py-4 text-sm text-muted-foreground">{copy.noSessions}</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/code-share/${session.sessionId}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        router.push(`/code-share/${session.sessionId}`)
                      }
                    }}
                    className="group w-full cursor-pointer rounded-[1rem] border border-card-border/70 bg-background/70 px-3 py-3 text-left transition hover:border-sky-blue/35"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-foreground">{session.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateLabel(session.updatedAt, language)} · v{session.version} · {session.language}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.15em]",
                          session.status === "active"
                            ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-300"
                            : "border-zinc-400/35 bg-zinc-500/10 text-zinc-300"
                        )}>
                          {session.status === "active" ? copy.statusActive : copy.statusClosed}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            void handleDeleteSession(session.sessionId)
                          }}
                          disabled={deletingSessionId === session.sessionId}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-400/35 bg-rose-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-rose-300 transition hover:border-rose-300 hover:text-rose-100 disabled:opacity-70"
                        >
                          {deletingSessionId === session.sessionId ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                          {deletingSessionId === session.sessionId ? copy.deleting : copy.delete}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </main>
  )
}
