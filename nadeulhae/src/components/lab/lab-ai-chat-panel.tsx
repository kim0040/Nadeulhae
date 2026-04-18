"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Lightbulb,
  LoaderCircle,
  MessageSquarePlus,
  PanelLeft,
  PanelLeftClose,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { useLanguage } from "@/context/LanguageContext"
import type { LabAiChatConversationMessage, LabAiChatStateResponse } from "@/lib/lab-ai-chat/types"
import {
  computeServerClockOffsetMs,
  getServerNowMs,
} from "@/lib/time/server-time"
import { cn } from "@/lib/utils"

type UiChatMessage = LabAiChatConversationMessage & {
  pending?: boolean
}

type LabAiChatStateApiResponse = LabAiChatStateResponse & {
  serverNow?: unknown
  error?: string
}

const MODEL_STORAGE_KEY = "nadeulhae:lab-ai-chat:model-id"

const COPY = {
  ko: {
    assistantName: "나들 AI",
    assistantDescription: "글쓰기, 코딩, 공부, 번역, 요약까지 이어서 대화할 수 있어요.",
    modelLabel: "모델",
    modelMenuHint: "필요할 때만 모델을 바꿔 사용하세요.",
    newChat: "새 대화",
    deleteChat: "삭제",
    deleteConfirm: "현재 대화를 삭제할까요?",
    deleteError: "대화를 삭제하지 못했어요.",
    createError: "새 대화를 만들지 못했어요.",
    loadError: "대화를 불러오지 못했어요.",
    sendError: "메시지를 보내지 못했어요. 다시 시도해 주세요.",
    pending: "나들 AI가 답변을 작성하고 있어요.",
    loading: "준비 중...",
    welcomeTitle: "나들 AI에게 무엇이든 물어보세요",
    welcomeDescription: "나들이 추천 전용이 아니라 일상, 업무, 학습, 창작을 함께 다루는 다용도 AI 채팅입니다.",
    placeholder: "나들 AI에게 메시지 보내기",
    limitReached: "오늘 사용 가능 횟수를 모두 사용했어요. 내일 다시 이용해 주세요.",
    thinking: "생각",
    suggestions: [
      "오늘 할 일을 우선순위로 정리해줘",
      "메일 답장 초안을 자연스럽게 써줘",
      "이 코드의 문제점을 같이 봐줘",
      "긴 글을 핵심만 요약해줘",
    ],
    msgUnit: "메시지",
    chatHistory: "대화 기록",
    openSidebar: "대화 기록 열기",
    closeSidebar: "대화 기록 닫기",
    send: "보내기",
    scrollBottom: "최신 메시지로 이동",
    shortcutHint: "Enter로 보내고 Shift+Enter로 줄을 바꿀 수 있어요.",
    footerHint: "나들 AI는 실수를 할 수 있으니 중요한 내용은 한 번 더 확인해 주세요.",
  },
  en: {
    assistantName: "Nadeul AI",
    assistantDescription: "Keep working through writing, coding, study, translation, and summaries.",
    modelLabel: "Model",
    modelMenuHint: "Change models only when you need a different response style.",
    newChat: "New chat",
    deleteChat: "Delete",
    deleteConfirm: "Delete this conversation?",
    deleteError: "Failed to delete the conversation.",
    createError: "Failed to create a new conversation.",
    loadError: "Failed to load conversations.",
    sendError: "Failed to send message. Please try again.",
    pending: "Nadeul AI is writing a reply.",
    loading: "Preparing...",
    welcomeTitle: "Ask Nadeul AI anything",
    welcomeDescription: "This is a general-purpose AI chat for daily work, study, writing, coding, and creative tasks.",
    placeholder: "Message Nadeul AI",
    limitReached: "You've reached today's limit. Come back tomorrow.",
    thinking: "Thinking",
    suggestions: [
      "Prioritize my tasks for today",
      "Draft a natural email reply",
      "Review this code with me",
      "Summarize a long text clearly",
    ],
    msgUnit: "messages",
    chatHistory: "Chat history",
    openSidebar: "Open chat history",
    closeSidebar: "Close chat history",
    send: "Send",
    scrollBottom: "Jump to latest message",
    shortcutHint: "Enter to send, Shift+Enter for a new line.",
    footerHint: "Nadeul AI can make mistakes. Check important details before acting.",
  },
} as const

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-hidden="true">
      <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-accent" />
    </span>
  )
}

function NadeulAiMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent shadow-sm dark:border-accent/25 dark:bg-accent/15",
        className
      )}
    >
      <Sparkles className="size-4" />
    </span>
  )
}

export function LabAiChatPanel() {
  const { language } = useLanguage()
  const copy = COPY[language]
  const [isPending, startTransition] = useTransition()
  const [isSessionPending, startSessionTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [messages, setMessages] = useState<UiChatMessage[]>([])
  const [sessions, setSessions] = useState<LabAiChatStateResponse["sessions"]>([])
  const [models, setModels] = useState<LabAiChatStateResponse["models"]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [defaultModelId, setDefaultModelId] = useState<string | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [usage, setUsage] = useState<LabAiChatStateResponse["usage"] | null>(null)
  const [policy, setPolicy] = useState<LabAiChatStateResponse["policy"] | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState<number | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
  const [isNearBottom, setIsNearBottom] = useState(true)

  const messageViewportRef = useRef<HTMLDivElement | null>(null)
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null)
  const didInitScrollRef = useRef(false)
  const previousMessageCountRef = useRef(0)
  const previousContentSizeRef = useRef(0)
  const shouldStickToBottomRef = useRef(true)
  const isComposingRef = useRef(false)
  const modelMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isModelMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (modelMenuRef.current?.contains(event.target as Node)) return
      setIsModelMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsModelMenuOpen(false)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isModelMenuOpen])

  useEffect(() => {
    if (!isSidebarOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSidebarOpen(false)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isSidebarOpen])

  const applyPayload = useCallback((payload: LabAiChatStateResponse) => {
    setMessages(payload.messages)
    setUsage(payload.usage)
    setPolicy(payload.policy)
    setSessions(payload.sessions)
    setModels(payload.models)
    setDefaultModelId(payload.defaultModelId)
    setActiveSessionId(payload.activeSessionId)
  }, [])

  const syncServerClock = useCallback((serverNow: unknown) => {
    const offsetMs = computeServerClockOffsetMs(serverNow)
    if (offsetMs != null) setServerClockOffsetMs(offsetMs)
  }, [])

  const loadChatState = useCallback(async (sessionId?: string | null) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""
      const res = await fetch(`/api/lab/ai-chat${query}`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: { "Accept-Language": language },
      })
      const data = await res.json().catch(() => null)
      syncServerClock((data as { serverNow?: unknown } | null)?.serverNow)
      if (!res.ok || !data) {
        setErrorMessage(data?.error ?? copy.loadError)
        return
      }
      applyPayload(data as LabAiChatStateApiResponse)
    } catch (err) {
      console.error("Failed to load lab AI chat state:", err)
      setErrorMessage(copy.loadError)
    } finally {
      setIsLoading(false)
    }
  }, [applyPayload, copy.loadError, language, syncServerClock])

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(MODEL_STORAGE_KEY)
    if (stored) setSelectedModelId(stored)
  }, [])

  useEffect(() => {
    void loadChatState(null)
  }, [loadChatState])

  useEffect(() => {
    if (models.length === 0) return
    const matched = models.find((model) => model.id === selectedModelId || model.thinkingId === selectedModelId)
    if (matched) return

    const next = defaultModelId ?? models[0]?.id ?? null
    setSelectedModelId(next)
    if (typeof window !== "undefined" && next) {
      window.localStorage.setItem(MODEL_STORAGE_KEY, next)
    }
  }, [defaultModelId, models, selectedModelId])

  useEffect(() => {
    if (!errorMessage) return
    const timeout = window.setTimeout(() => setErrorMessage(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [errorMessage])

  useEffect(() => {
    const element = chatInputRef.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`
  }, [chatInput])

  const resolvedActiveSessionId = activeSessionId ?? sessions[0]?.id ?? null

  useEffect(() => {
    didInitScrollRef.current = false
    previousMessageCountRef.current = 0
    previousContentSizeRef.current = 0
    shouldStickToBottomRef.current = true
    setIsNearBottom(true)
  }, [resolvedActiveSessionId])

  const updateBottomState = useCallback(() => {
    const viewport = messageViewportRef.current
    if (!viewport) return
    const nextIsNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 96
    shouldStickToBottomRef.current = nextIsNearBottom
    setIsNearBottom((current) => current === nextIsNearBottom ? current : nextIsNearBottom)
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const viewport = messageViewportRef.current
    if (!viewport) return
    viewport.scrollTo({ top: viewport.scrollHeight, behavior })
    shouldStickToBottomRef.current = true
    setIsNearBottom(true)
  }, [])

  const messageContentSize = useMemo(() => {
    return messages.reduce((total, message) => total + message.content.length + (message.pending ? 1 : 0), 0)
  }, [messages])

  useEffect(() => {
    const viewport = messageViewportRef.current
    if (!viewport) return

    const hasNewMessage = messages.length > previousMessageCountRef.current
    const hasGrowingMessage = messageContentSize > previousContentSizeRef.current

    if (!didInitScrollRef.current) {
      viewport.scrollTop = viewport.scrollHeight
      didInitScrollRef.current = true
      shouldStickToBottomRef.current = true
      setIsNearBottom(true)
    } else if ((hasNewMessage || hasGrowingMessage) && shouldStickToBottomRef.current) {
      scrollToBottom("smooth")
    }

    previousMessageCountRef.current = messages.length
    previousContentSizeRef.current = messageContentSize
  }, [messageContentSize, messages.length, scrollToBottom])

  const resolvedModelId = useMemo(() => {
    const matched = models.find((model) => model.id === selectedModelId || model.thinkingId === selectedModelId)
    if (matched) return selectedModelId
    return defaultModelId ?? models[0]?.id ?? null
  }, [defaultModelId, models, selectedModelId])

  const activeModel = useMemo(() => {
    return models.find((model) => model.id === resolvedModelId || model.thinkingId === resolvedModelId)
  }, [models, resolvedModelId])

  const isThinkingMode = Boolean(resolvedModelId && resolvedModelId === activeModel?.thinkingId)
  const activeModelLabel = activeModel ? `${activeModel.label}${isThinkingMode ? ` · ${copy.thinking}` : ""}` : copy.modelLabel

  const remainingRequests = usage?.remainingRequests ?? policy?.dailyLimit ?? 0
  const isLimitReached = !isLoading && remainingRequests <= 0
  const canType = !isLoading && !isSessionPending && !isLimitReached && Boolean(resolvedActiveSessionId) && Boolean(resolvedModelId)
  const canSend = canType && !isPending
  const maxInputCharacters = policy?.maxInputCharacters ?? 4000
  const serverNowMs = getServerNowMs(serverClockOffsetMs)

  const handleModelSelect = useCallback((modelId: string) => {
    setSelectedModelId(modelId)
    if (typeof window !== "undefined") window.localStorage.setItem(MODEL_STORAGE_KEY, modelId)
  }, [])

  const handleThinkingToggle = useCallback(() => {
    if (!activeModel?.thinkingId) return
    const next = isThinkingMode ? activeModel.id : activeModel.thinkingId
    if (next && next !== resolvedModelId) handleModelSelect(next)
  }, [activeModel, handleModelSelect, isThinkingMode, resolvedModelId])

  const focusInput = useCallback(() => {
    const element = chatInputRef.current
    if (!element) return
    requestAnimationFrame(() => {
      try {
        element.focus({ preventScroll: true })
      } catch {
        element.focus()
      }
    })
  }, [])

  const handleCreateSession = useCallback(() => {
    setErrorMessage(null)
    startSessionTransition(async () => {
      try {
        const res = await fetch("/api/lab/ai-chat/sessions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", "Accept-Language": language },
          body: JSON.stringify({ locale: language }),
        })
        const data = await res.json().catch(() => null)
        syncServerClock((data as { serverNow?: unknown } | null)?.serverNow)
        if (!res.ok || !data) {
          setErrorMessage(data?.error ?? copy.createError)
          return
        }
        applyPayload(data as LabAiChatStateApiResponse)
        setChatInput("")
        setIsSidebarOpen(false)
        focusInput()
      } catch (err) {
        console.error("Failed to create session:", err)
        setErrorMessage(copy.createError)
      }
    })
  }, [applyPayload, copy.createError, focusInput, language, syncServerClock])

  const handleDeleteSession = useCallback(() => {
    if (!resolvedActiveSessionId || sessions.length <= 1 || isSessionPending) return
    if (!window.confirm(copy.deleteConfirm)) return
    setErrorMessage(null)
    startSessionTransition(async () => {
      try {
        const res = await fetch(`/api/lab/ai-chat/sessions?sessionId=${encodeURIComponent(resolvedActiveSessionId)}`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json", "Accept-Language": language },
          body: JSON.stringify({}),
        })
        const data = await res.json().catch(() => null)
        syncServerClock((data as { serverNow?: unknown } | null)?.serverNow)
        if (!res.ok || !data) {
          setErrorMessage(data?.error ?? copy.deleteError)
          return
        }
        applyPayload(data as LabAiChatStateApiResponse)
        focusInput()
      } catch (err) {
        console.error("Failed to delete session:", err)
        setErrorMessage(copy.deleteError)
      }
    })
  }, [
    applyPayload,
    copy.deleteConfirm,
    copy.deleteError,
    focusInput,
    isSessionPending,
    language,
    resolvedActiveSessionId,
    sessions.length,
    syncServerClock,
  ])

  const handleSessionSelect = useCallback((sessionId: string) => {
    if (!sessionId || sessionId === resolvedActiveSessionId || isSessionPending) return
    setActiveSessionId(sessionId)
    setMessages([])
    setIsSidebarOpen(false)
    startSessionTransition(async () => {
      await loadChatState(sessionId)
      focusInput()
    })
  }, [focusInput, isSessionPending, loadChatState, resolvedActiveSessionId])

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setChatInput(suggestion)
    focusInput()
  }, [focusInput])

  const handleSend = useCallback(() => {
    if (isComposingRef.current) return
    const rawInput = chatInput
    const nextMessage = rawInput.trim()
    if (!nextMessage) return
    if (!canSend) {
      if (isLimitReached) setErrorMessage(copy.limitReached)
      return
    }

    setErrorMessage(null)
    const now = new Date(serverNowMs).toISOString()
    const optimisticUser: UiChatMessage = {
      id: `opt-u-${Date.now()}`,
      role: "user",
      content: nextMessage,
      createdAt: now,
      resolvedModel: null,
    }
    const optimisticAssistant: UiChatMessage = {
      id: `opt-a-${Date.now()}`,
      role: "assistant",
      content: "",
      createdAt: now,
      resolvedModel: null,
      pending: true,
    }

    setMessages((current) => [...current, optimisticUser, optimisticAssistant])
    setChatInput("")
    scrollToBottom("smooth")
    focusInput()

    startTransition(async () => {
      try {
        const res = await fetch("/api/lab/ai-chat", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Accept-Language": language,
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            message: nextMessage,
            locale: language,
            sessionId: resolvedActiveSessionId,
            modelId: resolvedModelId,
          }),
        })

        if (res.headers.get("content-type")?.includes("text/event-stream")) {
          const reader = res.body?.getReader()
          if (!reader) throw new Error("No stream")
          const decoder = new TextDecoder()
          let buffer = ""
          let streamAcc = ""

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const parts = buffer.split("\n\n")
            buffer = parts.pop() ?? ""

            for (const part of parts) {
              let eventType = ""
              let eventData = ""
              for (const line of part.split("\n")) {
                if (line.startsWith("event: ")) eventType = line.slice(7)
                else if (line.startsWith("data: ")) eventData = line.slice(6)
              }
              if (!eventType || !eventData) continue

              try {
                const parsed = JSON.parse(eventData)
                if (eventType === "token" && typeof parsed.content === "string") {
                  streamAcc += parsed.content
                  const snapshot = streamAcc
                  setMessages((current) => current.map((message) => (
                    message.id === optimisticAssistant.id
                      ? { ...message, content: snapshot, pending: false }
                      : message
                  )))
                } else if (eventType === "done") {
                  syncServerClock((parsed as { serverNow?: unknown })?.serverNow)
                  applyPayload(parsed as LabAiChatStateResponse)
                } else if (eventType === "error") {
                  setMessages((current) => current.filter((message) => (
                    message.id !== optimisticUser.id && message.id !== optimisticAssistant.id
                  )))
                  setChatInput(rawInput)
                  setErrorMessage(parsed.error ?? copy.sendError)
                }
              } catch {
                // Ignore malformed stream chunks from an interrupted response.
              }
            }
          }
          return
        }

        const data = await res.json().catch(() => null)
        syncServerClock((data as { serverNow?: unknown } | null)?.serverNow)
        if (!res.ok || !data) {
          setMessages((current) => current.filter((message) => (
            message.id !== optimisticUser.id && message.id !== optimisticAssistant.id
          )))
          setChatInput(rawInput)
          setErrorMessage(data?.error ?? copy.sendError)
          if (Array.isArray(data?.messages) && Array.isArray(data?.sessions) && typeof data?.activeSessionId === "string") {
            applyPayload(data as LabAiChatStateApiResponse)
          }
          if (data?.usage) setUsage(data.usage)
          if (data?.policy) setPolicy(data.policy)
          return
        }
        applyPayload(data as LabAiChatStateResponse)
      } catch (err) {
        console.error("Failed to send:", err)
        setMessages((current) => current.filter((message) => (
          message.id !== optimisticUser.id && message.id !== optimisticAssistant.id
        )))
        setChatInput(rawInput)
        setErrorMessage(copy.sendError)
      }
    })
  }, [
    applyPayload,
    canSend,
    chatInput,
    copy.limitReached,
    copy.sendError,
    focusInput,
    isLimitReached,
    language,
    resolvedActiveSessionId,
    resolvedModelId,
    scrollToBottom,
    serverNowMs,
    syncServerClock,
  ])

  const hasMessages = messages.length > 0
  const sidebarToggleLabel = isSidebarOpen ? copy.closeSidebar : copy.openSidebar

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden bg-background text-foreground">
      {isSidebarOpen ? (
        <button
          type="button"
          className="absolute inset-0 z-30 bg-foreground/35 backdrop-blur-sm transition-opacity lg:hidden"
          aria-label={copy.closeSidebar}
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "absolute inset-y-0 left-0 z-40 flex w-[18rem] max-w-[82vw] flex-col border-r border-border bg-background/95 shadow-2xl shadow-foreground/10 backdrop-blur-xl transition-transform duration-300 ease-out lg:relative lg:z-auto lg:max-w-none lg:shadow-none",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{copy.chatHistory}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{copy.assistantName}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
            aria-label={copy.closeSidebar}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-border px-3 py-3">
          <button
            type="button"
            onClick={handleCreateSession}
            disabled={isSessionPending}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-foreground px-3 text-sm font-semibold text-background transition duration-200 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSessionPending ? <LoaderCircle className="size-4 animate-spin" /> : <MessageSquarePlus className="size-4" />}
            {copy.newChat}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
          {sessions.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{copy.loading}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {sessions.map((session) => {
                const isActive = session.id === resolvedActiveSessionId
                return (
                  <div
                    key={session.id}
                    className={cn(
                      "group flex items-center rounded-lg transition duration-200",
                      isActive ? "bg-accent/10 text-foreground dark:bg-accent/15" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleSessionSelect(session.id)}
                      className="min-w-0 flex-1 px-3 py-2 text-left"
                    >
                      <span className="block truncate text-sm font-medium">{session.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {session.messageCount} {copy.msgUnit}
                      </span>
                    </button>
                    {isActive && sessions.length > 1 ? (
                      <button
                        type="button"
                        onClick={handleDeleteSession}
                        className="mr-1 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground opacity-100 transition hover:bg-danger/10 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label={copy.deleteChat}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/85 px-3 backdrop-blur-xl transition-colors duration-300 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition duration-200 hover:bg-muted hover:text-foreground active:scale-[0.96]"
              aria-label={sidebarToggleLabel}
            >
              {isSidebarOpen ? <PanelLeftClose className="size-5" /> : <PanelLeft className="size-5" />}
            </button>
            <NadeulAiMark className="hidden sm:flex" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground sm:text-base">{copy.assistantName}</p>
              <p className="hidden truncate text-xs text-muted-foreground md:block">{copy.assistantDescription}</p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleCreateSession}
              disabled={isSessionPending}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card/75 px-2.5 text-sm font-semibold text-foreground shadow-sm transition duration-200 hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
            >
              {isSessionPending ? <LoaderCircle className="size-4 animate-spin" /> : <MessageSquarePlus className="size-4" />}
              <span className="hidden sm:inline">{copy.newChat}</span>
            </button>

            {activeModel?.thinkingId ? (
              <button
                type="button"
                onClick={handleThinkingToggle}
                className={cn(
                  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition duration-200 active:scale-[0.98]",
                  isThinkingMode
                    ? "border-accent/35 bg-accent/10 text-accent dark:bg-accent/15"
                    : "border-border bg-card/75 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Lightbulb className="size-4" />
                <span className="hidden sm:inline">{copy.thinking}</span>
              </button>
            ) : null}

            <div className="relative z-30" ref={modelMenuRef}>
              <button
                type="button"
                onClick={() => setIsModelMenuOpen((current) => !current)}
                disabled={models.length === 0 || isPending}
                className="inline-flex h-9 max-w-[10rem] items-center justify-center gap-1.5 rounded-lg border border-border bg-card/75 px-2.5 text-sm font-semibold text-foreground shadow-sm transition duration-200 hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-[14rem] sm:px-3"
                aria-expanded={isModelMenuOpen}
              >
                <Bot className="size-4 shrink-0 text-accent" />
                <span className="truncate">{activeModelLabel}</span>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", isModelMenuOpen && "rotate-180")} />
              </button>

              {isModelMenuOpen ? (
                <div className="lab-chat-popover absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-border bg-background/95 shadow-2xl shadow-foreground/10 backdrop-blur-xl">
                  <div className="border-b border-border px-3 py-2">
                    <p className="text-sm font-semibold text-foreground">{copy.modelLabel}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{copy.modelMenuHint}</p>
                  </div>
                  <div className="max-h-[22rem] overflow-y-auto p-1.5 custom-scrollbar">
                    {models.map((model) => {
                      const nextModelId = isThinkingMode && model.thinkingId ? model.thinkingId : model.id
                      const isSelected = resolvedModelId === model.id || resolvedModelId === model.thinkingId
                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            handleModelSelect(nextModelId)
                            setIsModelMenuOpen(false)
                          }}
                          className={cn(
                            "flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition duration-200 hover:bg-muted",
                            isSelected ? "bg-accent/10 text-foreground dark:bg-accent/15" : "text-foreground"
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{model.label}</span>
                            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{model.description}</span>
                          </span>
                          {isSelected ? <Check className="mt-0.5 size-4 shrink-0 text-accent" /> : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div
          ref={messageViewportRef}
          onScroll={updateBottomState}
          className="relative z-10 flex-1 overflow-y-auto scroll-smooth custom-scrollbar"
        >
          {isLoading ? (
            <div className="flex h-full items-center justify-center px-4">
              <div className="lab-chat-rise inline-flex items-center gap-2 rounded-lg border border-border bg-card/80 px-4 py-3 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur">
                <LoaderCircle className="size-4 animate-spin text-accent" />
                {copy.loading}
              </div>
            </div>
          ) : hasMessages ? (
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end px-4 py-6 sm:px-5 lg:px-6">
              <div className="flex flex-col gap-5 sm:gap-6">
                {messages.map((message) => {
                  const isUser = message.role === "user"
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "lab-chat-message flex w-full gap-3",
                        isUser ? "justify-end" : "justify-start"
                      )}
                    >
                      {!isUser ? <NadeulAiMark /> : null}
                      <div
                        className={cn(
                          "min-w-0",
                          isUser ? "max-w-[min(82%,42rem)]" : "max-w-[min(100%,48rem)] flex-1"
                        )}
                      >
                        {isUser ? (
                          <div className="rounded-lg bg-accent px-4 py-3 text-base leading-7 text-accent-foreground shadow-sm transition-colors duration-300">
                            <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          </div>
                        ) : message.pending ? (
                          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground shadow-sm transition-colors duration-300">
                            <TypingDots />
                            <span className="sr-only">{copy.pending}</span>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-transparent px-0 py-1 text-base leading-7 text-foreground transition-colors duration-300">
                            <div className="prose prose-sm max-w-none break-words text-foreground dark:prose-invert prose-p:my-2 prose-pre:my-3 prose-pre:rounded-lg prose-pre:border prose-pre:border-border prose-pre:bg-muted/70 prose-pre:text-foreground prose-code:text-foreground prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-headings:my-3 prose-strong:text-foreground dark:prose-pre:bg-black/25">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center px-4 py-8 text-center sm:px-5 lg:px-6">
              <div className="lab-chat-rise flex max-w-2xl flex-col items-center">
                <NadeulAiMark className="size-12" />
                <h1 className="mt-5 text-2xl font-semibold text-foreground sm:text-3xl">{copy.welcomeTitle}</h1>
                <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">{copy.welcomeDescription}</p>
                <div className="mt-7 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                  {copy.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSuggestionSelect(suggestion)}
                      className="lab-chat-suggestion rounded-lg border border-border bg-card/75 px-4 py-3 text-left text-sm font-medium leading-6 text-foreground shadow-sm transition duration-200 hover:border-accent/35 hover:bg-muted active:scale-[0.98]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {hasMessages && !isNearBottom ? (
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="absolute bottom-4 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-border bg-background/90 px-3 py-2 text-sm font-semibold text-foreground shadow-lg shadow-foreground/10 backdrop-blur transition duration-200 hover:bg-muted active:scale-[0.98]"
              aria-label={copy.scrollBottom}
            >
              <ArrowDown className="size-4" />
              <span className="hidden sm:inline">{copy.scrollBottom}</span>
            </button>
          ) : null}
        </div>

        <footer className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-background/90 px-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl transition-colors duration-300 sm:px-5">
          <div className="mx-auto w-full max-w-3xl">
            {isLimitReached ? (
              <div className="lab-chat-rise mb-2 rounded-lg border border-danger/20 bg-danger/10 px-4 py-2.5 text-sm font-semibold text-danger" role="status">
                {copy.limitReached}
              </div>
            ) : null}
            {errorMessage ? (
              <div className="lab-chat-rise mb-2 rounded-lg border border-danger/20 bg-danger/10 px-4 py-2.5 text-sm font-semibold text-danger" role="alert">
                {errorMessage}
              </div>
            ) : null}

            <div className="lab-chat-composer flex items-end gap-2 rounded-lg border border-border bg-card/90 px-3 py-2 shadow-lg shadow-foreground/5 backdrop-blur transition duration-200 focus-within:border-accent/45 focus-within:bg-background focus-within:shadow-accent/10 dark:bg-card/80 dark:focus-within:bg-background">
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value.slice(0, maxInputCharacters))}
                onCompositionStart={() => {
                  isComposingRef.current = true
                }}
                onCompositionEnd={() => {
                  isComposingRef.current = false
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return
                  if (isComposingRef.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
                  event.preventDefault()
                  handleSend()
                }}
                placeholder={copy.placeholder}
                disabled={!canType}
                rows={1}
                aria-label={copy.placeholder}
                className="max-h-[180px] min-h-11 flex-1 resize-none bg-transparent py-2 text-base leading-7 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={handleSend}
                onMouseDown={(event) => event.preventDefault()}
                disabled={!chatInput.trim() || !canSend}
                className={cn(
                  "mb-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition duration-200 active:scale-[0.94] disabled:cursor-not-allowed",
                  chatInput.trim() && canSend
                    ? "bg-accent text-accent-foreground shadow-sm hover:opacity-90"
                    : "bg-muted text-muted-foreground/50"
                )}
                aria-label={copy.send}
              >
                {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
              </button>
            </div>

            <div className="mt-2 flex flex-col gap-1 text-center text-xs leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:text-left">
              <span>{copy.shortcutHint}</span>
              <span>{copy.footerHint}</span>
            </div>
          </div>
        </footer>
      </section>
    </div>
  )
}
