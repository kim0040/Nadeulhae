"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { LoaderCircle, Plus, SendHorizonal, Sparkles, Trash2 } from "lucide-react"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { useLanguage } from "@/context/LanguageContext"
import type { AuthUser } from "@/lib/auth/types"
import type { ChatWeatherContext } from "@/lib/chat/prompt"
import type { ChatConversationMessage, ChatStateResponse } from "@/lib/chat/types"
import { formatServerClockTime } from "@/lib/time/server-time"
import { cn } from "@/lib/utils"

type UiChatMessage = ChatConversationMessage & {
  pending?: boolean
}

const CHAT_PANEL_COPY = {
  ko: {
    title: "나들이 메이트",
    description:
      "원하는 조건을 말하면 전주 나들이 코스, 대체 일정, 준비물을 추천해요. RAG 기반 지식 연결과 고도화 추천은 추후 지원될 예정이에요.",
    canAskLabel: "이렇게 활용해보세요",
    canAsk: ["코스 추천", "우천 대체 일정", "준비물 체크"],
    pending: "열심히 계획 중이에요...",
    loadError: "메이트를 불러오지 못했어요.",
    sendError: "메시지를 보내지 못했어요. 다시 시도해 주세요.",
    sessionLoadError: "세션을 불러오지 못했어요. 다시 시도해 주세요.",
    sessionCreateError: "새 세션을 만들지 못했어요.",
    sessionDeleteError: "세션을 삭제하지 못했어요.",
    sessionDeleteConfirm: "현재 세션을 삭제할까요?",
    sessionLabel: "대화 세션",
    sessionCreate: "새 세션",
    sessionDelete: "세션 삭제",
    sessionHint: "세션을 나눠두면 일정별로 대화를 깔끔하게 관리할 수 있어요.",
    sessionPlaceholder: "세션을 선택해 주세요",
    sessionMessages: "메시지",
    limitReached: "오늘 가능한 대화는 모두 사용했어요. 내일 다시 이어서 도와드릴게요.",
    placeholder: "예: 비 오는 저녁에도 가능한 전주 데이트 코스 추천해줘",
    send: "보내기",
    suggestions: "바로 질문하기",
    loading: "메이트를 부르는 중...",
    emptyTitle: "원하는 나들이를 바로 물어보세요",
    emptyDescription: "날씨, 시간, 동행자를 함께 알려주면 더 정확한 코스를 추천해요.",
    intro: "안녕하세요! 지금 조건에 맞는 전주 나들이 계획을 함께 짜볼게요.",
  },
  en: {
    title: "Outing mate",
    description:
      "Tell me your conditions and I will suggest Jeonju routes, backup plans, and what to prepare. RAG-powered retrieval and smarter recommendation layers are planned for a future update.",
    canAskLabel: "What you can do",
    canAsk: ["Route ideas", "Rainy-day backup", "Preparation list"],
    pending: "Planning your route...",
    loadError: "Failed to load the mate.",
    sendError: "Failed to send the message. Please try again.",
    sessionLoadError: "Failed to load sessions. Please try again.",
    sessionCreateError: "Failed to create a new session.",
    sessionDeleteError: "Failed to delete the session.",
    sessionDeleteConfirm: "Delete this session now?",
    sessionLabel: "Conversation session",
    sessionCreate: "New session",
    sessionDelete: "Delete session",
    sessionHint: "Use separate sessions to keep different outing plans organized.",
    sessionPlaceholder: "Select a session",
    sessionMessages: "messages",
    limitReached: "You have reached today’s chat limit. Come back tomorrow and we can continue.",
    placeholder: "Example: Recommend a Jeonju date course for a rainy evening",
    send: "Send",
    suggestions: "Quick prompts",
    loading: "Loading your mate...",
    emptyTitle: "Ask for your outing plan",
    emptyDescription: "Share weather, timing, and who you are going with for better suggestions.",
    intro: "Hello. I can build a Jeonju outing plan around your current conditions.",
  },
} as const

const CHAT_SUGGESTIONS = {
  ko: [
    "이번 주말 전주 당일치기 코스 추천해줘",
    "비 오는 오후에 갈만한 실내 장소 알려줘",
    "아이랑 함께 가기 좋은 동선으로 짜줘",
  ],
  en: [
    "Recommend a one-day Jeonju outing route for this weekend",
    "Suggest indoor places for a rainy afternoon",
    "Build a family-friendly route for Jeonju",
  ],
} as const

function formatTimestamp(value: string, language: "ko" | "en") {
  return formatServerClockTime(value, language)
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      <span className="size-1.5 animate-bounce rounded-full bg-foreground/60 [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-foreground/60 [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-foreground/60" />
    </div>
  )
}

function ChatBubble({
  message,
  language,
}: {
  message: UiChatMessage
  language: "ko" | "en"
}) {
  return (
    <div
      className={cn(
        "max-w-[92%] break-words rounded-[1.4rem] border px-4 py-3 shadow-sm sm:max-w-[85%]",
        message.role === "assistant"
          ? "border-card-border/70 bg-background/80 text-foreground"
          : "ml-auto border-sky-blue/10 bg-sky-blue text-white"
      )}
    >
      {message.pending ? (
        <TypingIndicator />
      ) : message.role === "assistant" ? (
        <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-6 prose-p:my-1 prose-pre:my-2 prose-ul:my-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
      )}

      <p
        className={cn(
          "mt-2 text-[11px] font-semibold",
          message.role === "assistant" ? "text-muted-foreground" : "text-white/75"
        )}
      >
        {formatTimestamp(message.createdAt, language)}
      </p>
    </div>
  )
}

export function DashboardChatPanel({
  user,
  weatherContext,
}: {
  user: AuthUser
  weatherContext: ChatWeatherContext | null
}) {
  const { language } = useLanguage()
  const copy = CHAT_PANEL_COPY[language]
  const [isPending, startTransition] = useTransition()
  const [isSessionPending, startSessionTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [messages, setMessages] = useState<UiChatMessage[]>([])
  const [sessions, setSessions] = useState<ChatStateResponse["sessions"]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [usage, setUsage] = useState<ChatStateResponse["usage"] | null>(null)
  const [policy, setPolicy] = useState<ChatStateResponse["policy"] | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const messageViewportRef = useRef<HTMLDivElement | null>(null)
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null)
  const didInitScrollRef = useRef(false)
  const previousMessageCountRef = useRef(0)
  const shouldStickToBottomRef = useRef(true)
  const isComposingRef = useRef(false)

  const applyPayload = useCallback((payload: ChatStateResponse) => {
    setMessages(payload.messages)
    setUsage(payload.usage)
    setPolicy(payload.policy)
    setSessions(payload.sessions)
    setActiveSessionId(payload.activeSessionId)
  }, [])

  const loadChatState = useCallback(async (sessionId?: string | null) => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""
      const response = await fetch(`/api/chat${query}`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Accept-Language": language,
        },
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data) {
        setErrorMessage(data?.error ?? copy.sessionLoadError)
        return
      }

      const payload = data as ChatStateResponse
      applyPayload(payload)
    } catch (error) {
      console.error("Failed to load dashboard chat state:", error)
      setErrorMessage(copy.loadError)
    } finally {
      setIsLoading(false)
    }
  }, [applyPayload, copy.loadError, copy.sessionLoadError, language])

  useEffect(() => {
    void loadChatState(null)
  }, [loadChatState, user.id])

  const resolvedActiveSessionId = activeSessionId ?? sessions[0]?.id ?? null

  useEffect(() => {
    didInitScrollRef.current = false
    previousMessageCountRef.current = 0
    shouldStickToBottomRef.current = true
  }, [resolvedActiveSessionId])

  const handleViewportScroll = useCallback(() => {
    const viewport = messageViewportRef.current
    if (!viewport) {
      return
    }

    const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    shouldStickToBottomRef.current = distanceToBottom <= 88
  }, [])

  useEffect(() => {
    const viewport = messageViewportRef.current
    if (!viewport) {
      return
    }

    const hasNewMessages = messages.length > previousMessageCountRef.current

    if (!didInitScrollRef.current) {
      viewport.scrollTop = viewport.scrollHeight
      didInitScrollRef.current = true
      shouldStickToBottomRef.current = true
    } else if (hasNewMessages && shouldStickToBottomRef.current) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "auto" })
    }

    previousMessageCountRef.current = messages.length
  }, [messages])

  const remainingRequests = usage?.remainingRequests ?? policy?.dailyLimit ?? 0
  const isLimitReached = !isLoading && remainingRequests <= 0
  const canSend = !isLoading && !isPending && !isSessionPending && !isLimitReached && Boolean(resolvedActiveSessionId)
  const maxInputCharacters = policy?.maxInputCharacters ?? 1600

  const focusInputWithoutScroll = useCallback(() => {
    const element = chatInputRef.current
    if (!element) {
      return
    }

    requestAnimationFrame(() => {
      try {
        element.focus({ preventScroll: true })
      } catch {
        element.focus()
      }
    })
  }, [])

  const handleCreateSession = () => {
    setErrorMessage(null)
    startSessionTransition(async () => {
      try {
        const response = await fetch("/api/chat/sessions", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Accept-Language": language,
          },
          body: JSON.stringify({ locale: language }),
        })

        const data = await response.json().catch(() => null)
        if (!response.ok || !data) {
          setErrorMessage(data?.error ?? copy.sessionCreateError)
          return
        }

        applyPayload(data as ChatStateResponse)
        setChatInput("")
      } catch (error) {
        console.error("Failed to create dashboard chat session:", error)
        setErrorMessage(copy.sessionCreateError)
      }
    })
  }

  const handleDeleteSession = () => {
    if (!resolvedActiveSessionId || sessions.length <= 1 || isSessionPending) {
      return
    }

    if (!window.confirm(copy.sessionDeleteConfirm)) {
      return
    }

    setErrorMessage(null)
    startSessionTransition(async () => {
      try {
        const response = await fetch(`/api/chat/sessions?sessionId=${encodeURIComponent(resolvedActiveSessionId)}`, {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Accept-Language": language,
          },
        })

        const data = await response.json().catch(() => null)
        if (!response.ok || !data) {
          setErrorMessage(data?.error ?? copy.sessionDeleteError)
          return
        }

        applyPayload(data as ChatStateResponse)
      } catch (error) {
        console.error("Failed to delete dashboard chat session:", error)
        setErrorMessage(copy.sessionDeleteError)
      }
    })
  }

  const handleSessionSelect = (sessionId: string) => {
    if (!sessionId || sessionId === resolvedActiveSessionId || isSessionPending) {
      return
    }

    setActiveSessionId(sessionId)
    setMessages([])
    startSessionTransition(async () => {
      await loadChatState(sessionId)
    })
  }

  const handleSend = () => {
    if (isComposingRef.current) {
      return
    }

    const rawInput = chatInput
    const nextMessage = rawInput.trim()
    if (!nextMessage) {
      return
    }

    if (!canSend) {
      if (isLimitReached) {
        setErrorMessage(copy.limitReached)
      }
      return
    }

    setErrorMessage(null)
    const now = new Date().toISOString()
    const optimisticUserMessage: UiChatMessage = {
      id: `optimistic-user-${Date.now()}`,
      role: "user",
      content: nextMessage,
      createdAt: now,
      resolvedModel: null,
    }
    const optimisticAssistantMessage: UiChatMessage = {
      id: `optimistic-assistant-${Date.now()}`,
      role: "assistant",
      content: copy.pending,
      createdAt: now,
      resolvedModel: null,
      pending: true,
    }

    setMessages((current) => [...current, optimisticUserMessage, optimisticAssistantMessage])
    setChatInput("")
    focusInputWithoutScroll()

    startTransition(async () => {
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Accept-Language": language,
          },
          body: JSON.stringify({
            message: nextMessage,
            locale: language,
            weatherContext,
            sessionId: resolvedActiveSessionId,
          }),
        })

        const data = await response.json().catch(() => null)
        if (!response.ok || !data) {
          setMessages((current) => current.filter((item) =>
            item.id !== optimisticUserMessage.id && item.id !== optimisticAssistantMessage.id
          ))
          setChatInput(rawInput)
          setErrorMessage(data?.error ?? copy.sendError)
          if (
            Array.isArray(data?.messages)
            && Array.isArray(data?.sessions)
            && typeof data?.activeSessionId === "string"
          ) {
            applyPayload(data as ChatStateResponse)
          }
          if (data?.usage) {
            setUsage(data.usage)
          }
          if (data?.policy) {
            setPolicy(data.policy)
          }
          return
        }

        const payload = data as ChatStateResponse
        applyPayload(payload)
      } catch (error) {
        console.error("Failed to send dashboard chat message:", error)
        setMessages((current) => current.filter((item) =>
          item.id !== optimisticUserMessage.id && item.id !== optimisticAssistantMessage.id
        ))
        setChatInput(rawInput)
        setErrorMessage(copy.sendError)
      }
    })
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-[1.7rem] border border-card-border/70 bg-background/80 p-5 sm:p-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-blue/20 bg-sky-blue/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-sky-blue">
          <Sparkles className="size-3.5" />
          {copy.suggestions}
        </div>
        <h2 className="mt-4 text-2xl font-black tracking-tight text-foreground sm:text-3xl">{copy.title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">{copy.description}</p>

        <div className="mt-4">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">{copy.canAskLabel}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {copy.canAsk.map((item) => (
              <span
                key={item}
                className="rounded-full border border-card-border/70 bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {CHAT_SUGGESTIONS[language].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setChatInput(suggestion)}
              className="rounded-full border border-card-border/70 bg-card/80 px-3 py-2 text-left text-sm font-semibold text-foreground transition hover:border-sky-blue/25 hover:text-sky-blue"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-[1.3rem] border border-card-border/70 bg-card/70 p-3 sm:p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">{copy.sessionLabel}</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleCreateSession}
              disabled={isSessionPending}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-card-border/70 bg-background/75 px-3 py-2 text-xs font-black text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue disabled:opacity-60"
            >
              {isSessionPending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              {copy.sessionCreate}
            </button>

            <select
              value={resolvedActiveSessionId ?? ""}
              onChange={(event) => handleSessionSelect(event.target.value)}
              disabled={isSessionPending || isLoading || sessions.length === 0}
              className="min-w-0 flex-1 rounded-full border border-card-border/70 bg-background/75 px-3 py-2 text-sm font-semibold text-foreground outline-none transition focus:border-sky-blue/30 disabled:opacity-60"
            >
              {sessions.length === 0 ? (
                <option value="">{copy.sessionPlaceholder}</option>
              ) : (
                sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title} · {session.messageCount} {copy.sessionMessages}
                  </option>
                ))
              )}
            </select>

            <button
              type="button"
              onClick={handleDeleteSession}
              disabled={isSessionPending || !resolvedActiveSessionId || sessions.length <= 1}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-danger/25 bg-danger/10 px-3 py-2 text-xs font-black text-danger transition hover:bg-danger/15 disabled:opacity-50"
            >
              {isSessionPending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              {copy.sessionDelete}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{copy.sessionHint}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.8rem] border border-card-border/70 bg-card/70 shadow-sm">
        <div
          ref={messageViewportRef}
          onScroll={handleViewportScroll}
          className="max-h-[62vh] min-h-[24rem] space-y-4 overflow-y-auto overscroll-contain p-4 custom-scrollbar [overflow-anchor:none] sm:max-h-[68vh] sm:min-h-[28rem] sm:p-5"
        >
          {isLoading ? (
            <div className="flex items-center gap-3 rounded-[1.4rem] border border-card-border/70 bg-background/80 px-4 py-4 text-sm font-semibold text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin text-sky-blue" />
              {copy.loading}
            </div>
          ) : messages.length > 0 ? (
            messages.map((message) => (
              <ChatBubble key={message.id} message={message} language={language} />
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-card-border/80 bg-background/75 p-5">
              <div className="text-sm font-black text-foreground">{copy.emptyTitle}</div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.emptyDescription}</p>
              <p className="mt-4 rounded-[1.1rem] bg-sky-blue/8 px-4 py-3 text-sm leading-6 text-foreground">
                {copy.intro}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-card-border/50 bg-background/60 p-3 backdrop-blur-sm sm:p-4">
          <div className="relative flex items-end gap-2 rounded-[1.6rem] border border-sky-blue/30 bg-background/95 p-2 shadow-inner transition-colors focus-within:border-sky-blue">
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

                const isImeComposing =
                  isComposingRef.current
                  || event.nativeEvent.isComposing
                  || event.nativeEvent.keyCode === 229

                if (isImeComposing) return

                event.preventDefault()
                handleSend()
              }}
              placeholder={copy.placeholder}
              disabled={!canSend}
              className="max-h-48 min-h-[52px] flex-1 resize-none bg-transparent px-4 py-3.5 text-base leading-6 text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-70 sm:text-sm"
            />

            <ShimmerButton
              type="button"
              onClick={handleSend}
              onMouseDown={(event) => event.preventDefault()}
              disabled={!chatInput.trim() || !canSend}
              className="mb-1 mr-1 shrink-0 rounded-full px-5 py-3 text-sm font-black"
            >
              <span className="inline-flex items-center gap-1.5">
                {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />}
                <span className="hidden sm:inline">{copy.send}</span>
              </span>
            </ShimmerButton>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-[1.3rem] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger"
        >
          {errorMessage}
        </div>
      ) : null}
    </div>
  )
}
