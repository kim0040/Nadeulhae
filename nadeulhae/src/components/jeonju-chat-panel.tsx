"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  LogIn,
  MessageCircle,
  Send,
  ShieldCheck,
  User,
  UserX,
  WifiOff,
} from "lucide-react"
import Link from "next/link"

import { BorderBeam } from "@/components/magicui/border-beam"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import {
  computeServerClockOffsetMs,
  formatServerRelativeTime,
  getServerNowMs,
} from "@/lib/time/server-time"
import { useWebSocket } from "@/lib/websocket/use-websocket"
import { cn } from "@/lib/utils"

interface ChatMessage {
  id: number
  userId: string | null
  nickname: string
  nicknameTag: string
  content: string
  isAnonymous: boolean
  isMine: boolean
  createdAt: string
}

const COPY = {
  ko: {
    sectionTag: "전주 소통",
    title: "전주 나들톡",
    description: "전주의 실시간 소식이나 나들이 꿀팁을 이웃들과 가볍게 나누는 공간입니다.",
    loginRequired: "대화에 참여하려면 로그인이 필요해요.",
    loginAction: "로그인하러 가기",
    placeholder: "전주에 대한 이야기를 남겨보세요...",
    send: "전송",
    anonymousToggle: "익명으로 보내기",
    empty: "아직 이야기가 없어요. 첫 번째로 대화를 시작해 보세요!",
    loading: "메시지를 불러오고 있어요...",
    error: "메시지를 불러오지 못했어요.",
    sendError: "메시지를 보내지 못했어요.",
    profanityError: "부적절한 표현이 포함되어 있어요.",
    retentionNotice: "깨끗한 소통을 위해 7일 후 대화가 사라져요.",
    onlineLabel: "실시간",
    charCount: "글자",
    anonymous: "익명",
  },
  en: {
    sectionTag: "Jeonju Talk",
    title: "Jeonju Open Chat",
    description: "Share your thoughts about Jeonju freely. Only logged-in users can send messages.",
    loginRequired: "Please log in to send messages.",
    loginAction: "Go to Login",
    placeholder: "Share something about Jeonju...",
    send: "Send",
    anonymousToggle: "Send anonymously",
    empty: "No messages yet. Be the first to start the conversation!",
    loading: "Loading messages...",
    error: "Failed to load messages.",
    sendError: "Failed to send message.",
    profanityError: "Your message contains inappropriate language.",
    retentionNotice: "Messages are kept for 7 days.",
    onlineLabel: "Live Chat",
    charCount: "chars",
    anonymous: "Anonymous",
  },
} as const

function formatChatTime(iso: string, language: string, nowMs: number) {
  return formatServerRelativeTime(iso, nowMs, language)
}

function ChatBubble({
  message,
  isMine,
  language,
  showProfile = true,
  nowMs,
}: {
  message: ChatMessage
  isMine: boolean
  language: string
  showProfile?: boolean
  nowMs: number
}) {
  const displayName = message.isAnonymous
    ? (language === "ko" ? "익명" : "Anonymous")
    : `${message.nickname}#${message.nicknameTag}`

  const showTimestamp = showProfile

  return (
    <div
      className={cn(
        "group flex gap-2.5",
        isMine ? "flex-row-reverse" : "flex-row",
        !showProfile && (isMine ? "pr-10" : "pl-10")
      )}
    >
      {/* Avatar */}
      {showProfile && (
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-black",
            message.isAnonymous
              ? "bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"
              : isMine
                ? "bg-sky-blue/20 text-sky-blue"
                : "bg-active-blue/15 text-active-blue"
          )}
        >
          {message.isAnonymous ? (
            <UserX className="size-3.5" />
          ) : (
            <User className="size-3.5" />
          )}
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          "max-w-[75%] space-y-1 sm:max-w-[70%]",
          isMine ? "items-end text-right" : "items-start",
          !showProfile && "mt-[-0.5rem]"
        )}
      >
        {showProfile && (
          <p
            className={cn(
              "text-[11px] font-bold",
              message.isAnonymous
                ? "text-neutral-400 dark:text-neutral-500"
                : "text-muted-foreground"
            )}
          >
            {displayName}
          </p>
        )}
        <div className="flex items-end gap-1.5">
          {isMine && showTimestamp && (
             <p className="text-[10px] font-semibold text-muted-foreground/50 shrink-0 mb-0.5">
               {formatChatTime(message.createdAt, language, nowMs)}
             </p>
          )}
          <div
            className={cn(
              "break-words rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed",
              isMine
                ? "rounded-tr-md bg-sky-blue text-white shadow-sm"
                : "rounded-tl-md border border-card-border/70 bg-card/90 text-foreground"
            )}
          >
            {message.content}
          </div>
          {!isMine && showTimestamp && (
             <p className="text-[10px] font-semibold text-muted-foreground/50 shrink-0 mb-0.5">
               {formatChatTime(message.createdAt, language, nowMs)}
             </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function JeonjuChatPanel() {
  const { language } = useLanguage()
  const { user } = useAuth()
  const copy = ((COPY as any)[language] ?? COPY.ko)
  const { subscribe, connected: wsConnected } = useWebSocket()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const didInitScrollRef = useRef(false)
  const previousMessageCountRef = useRef(0)
  const shouldStickToBottomRef = useRef(true)
  const isComposingRef = useRef(false)

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/jeonju-chat", {
        cache: "no-store",
        credentials: "include",
        headers: {
          "Accept-Language": language,
        },
      })
      const data = (await res.json().catch(() => null)) as {
        messages?: ChatMessage[]
        error?: unknown
        serverNow?: unknown
      } | null

      const offsetMs = computeServerClockOffsetMs(data?.serverNow)
      if (offsetMs != null) {
        setServerClockOffsetMs(offsetMs)
      }

      if (!res.ok || !Array.isArray(data?.messages)) {
        setError(
          typeof data?.error === "string" && data.error.trim().length > 0
            ? data.error
            : copy.error
        )
        return
      }

      setMessages(data.messages)
      setError(null)
    } catch {
      setError(copy.error)
    } finally {
      setIsLoading(false)
    }
  }, [copy.error, language])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    const unsubscribe = subscribe("jeonju_chat_message", (payload: unknown) => {
      const msg = payload as ChatMessage | null
      if (!msg || typeof msg !== "object" || !("id" in msg)) return
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })
    return unsubscribe
  }, [subscribe])

  useEffect(() => {
    if (wsConnected) return
    let cancelled = false
    const timer = setInterval(() => {
      if (cancelled || wsConnected) return
      void loadMessages()
    }, 30_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [wsConnected, loadMessages])

  const handleScroll = useCallback(() => {
    const viewport = scrollRef.current
    if (!viewport) {
      return
    }

    const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    shouldStickToBottomRef.current = distanceToBottom <= 96
  }, [])

  useEffect(() => {
    const viewport = scrollRef.current
    if (!viewport) {
      return
    }

    const hasNewMessages = messages.length > previousMessageCountRef.current

    if (!didInitScrollRef.current) {
      viewport.scrollTop = viewport.scrollHeight
      didInitScrollRef.current = true
      shouldStickToBottomRef.current = true
    } else if (hasNewMessages && shouldStickToBottomRef.current) {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: "auto",
      })
    }

    previousMessageCountRef.current = messages.length
  }, [messages])

  const focusInputWithoutScroll = useCallback(() => {
    const element = inputRef.current
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

  const serverNowMs = getServerNowMs(serverClockOffsetMs)

  const handleSend = async () => {
    if (isSending || !user || isComposingRef.current) return

    const rawInput = input
    const msgText = rawInput.trim()
    if (!msgText) return

    setSendError(null)
    setIsSending(true)
    setInput("")
    focusInputWithoutScroll()

    try {
      const res = await fetch("/api/jeonju-chat", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": language,
        },
        body: JSON.stringify({
          message: msgText,
          anonymous: isAnonymous,
        }),
      })

      const data = (await res.json().catch(() => null)) as {
        message?: ChatMessage
        error?: unknown
        serverNow?: unknown
      } | null
      const offsetMs = computeServerClockOffsetMs(data?.serverNow)
      if (offsetMs != null) {
        setServerClockOffsetMs(offsetMs)
      }
      if (!res.ok) {
        setInput(msgText)
        setSendError(
          typeof data?.error === "string" && data.error.trim().length > 0
            ? data.error
            : copy.sendError
        )
        return
      }

      if (data?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message!.id)) return prev
          return [...prev, data.message!]
        })
      }
    } catch {
      setInput(msgText)
      setSendError(copy.sendError)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[3rem] border border-card-border bg-card p-8 shadow-[0_24px_80px_-50px_rgba(47,111,228,0.34)] sm:p-12">
      <BorderBeam
        size={280}
        duration={14}
        colorFrom="var(--color-sky-blue)"
        colorTo="var(--color-active-blue)"
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-blue/20 bg-sky-blue/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-sky-blue">
                <MessageCircle className="size-3" />
                {copy.sectionTag}
              </span>
              {wsConnected ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                  {copy.onlineLabel}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                  <WifiOff className="size-3" />
                  {copy.onlineLabel}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              {copy.title}
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              {copy.description}
            </p>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/70">
            <ShieldCheck className="size-3.5" />
            {copy.retentionNotice}
          </div>
        </div>

        {/* Chat body */}
        <div className="mt-6 overflow-hidden rounded-[1.8rem] border border-card-border/70 bg-card/70 shadow-sm">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="max-h-[42rem] min-h-[26rem] space-y-3 overflow-y-auto overscroll-contain p-4 custom-scrollbar [overflow-anchor:none] sm:max-h-[48rem] sm:min-h-[30rem] sm:p-5"
            >
              {isLoading ? (
                <div className="flex h-32 items-center justify-center text-sm font-semibold text-muted-foreground">
                  <span className="animate-pulse">{copy.loading}</span>
                </div>
              ) : error ? (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="flex h-32 items-center justify-center text-sm font-semibold text-danger"
                >
                  {error}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-sky-blue/10">
                    <MessageCircle className="size-6 text-sky-blue" />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    {copy.empty}
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const prev = messages[index - 1]
                  const prevIsMine = prev?.isMine ?? (user?.id === prev?.userId)
                  const currentIsMine = msg.isMine ?? (user?.id === msg.userId)
                  const isSameUser =
                    prev &&
                    !prev.isAnonymous &&
                    !msg.isAnonymous &&
                    prev.userId === msg.userId &&
                    prev.isAnonymous === msg.isAnonymous &&
                    prev.nickname === msg.nickname &&
                    prevIsMine === currentIsMine
                  const timeA = prev ? new Date(prev.createdAt.endsWith("Z") ? prev.createdAt : `${prev.createdAt}Z`).getTime() : 0
                  const timeB = new Date(msg.createdAt.endsWith("Z") ? msg.createdAt : `${msg.createdAt}Z`).getTime()
                  const timeDiff = timeB - timeA

                  const showProfile = !(isSameUser && timeDiff < 60_000)

                  return (
                    <ChatBubble
                      key={msg.id}
                      message={msg}
                      isMine={currentIsMine}
                      language={language}
                      showProfile={showProfile}
                      nowMs={serverNowMs}
                    />
                  )
                })
              )}
            </div>

            {/* Input area */}
            <div className="border-t border-card-border/50 bg-background/60 p-3 backdrop-blur-sm sm:p-4">
              {!user ? (
                <div className="flex flex-col items-center gap-3 py-3 text-center sm:flex-row sm:justify-center sm:text-left">
                  <LogIn className="size-5 text-sky-blue" />
                  <p className="text-sm font-semibold text-muted-foreground">
                    {copy.loginRequired}
                  </p>
                  <Link
                    href="/login"
                    className="rounded-full bg-sky-blue/10 px-4 py-1.5 text-xs font-black text-sky-blue transition hover:bg-sky-blue/20"
                  >
                    {copy.loginAction}
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {sendError && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger"
                    >
                      {sendError}
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => {
                          setInput(e.target.value.slice(0, 500))
                          // Auto-resize textarea to fit content (max 4 lines)
                          const el = e.target
                          el.style.height = "auto"
                          el.style.height = `${Math.min(el.scrollHeight, 120)}px`
                        }}
                        onCompositionStart={() => {
                          isComposingRef.current = true
                        }}
                        onCompositionEnd={() => {
                          isComposingRef.current = false
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" || e.shiftKey) return

                          const isImeComposing =
                            isComposingRef.current || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229

                          if (isImeComposing) return

                          e.preventDefault()
                          void handleSend()
                        }}
                        placeholder={copy.placeholder}
                        rows={1}
                        className="w-full resize-none rounded-xl border border-card-border/60 bg-background/80 px-3.5 py-2.5 text-[15px] leading-relaxed text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-sky-blue/30 sm:text-sm"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-muted-foreground transition hover:text-foreground">
                          <input
                            type="checkbox"
                            checked={isAnonymous}
                            onChange={(e) => setIsAnonymous(e.target.checked)}
                            className="size-3.5 rounded accent-sky-blue"
                          />
                          <UserX className="size-3" />
                          {copy.anonymousToggle}
                        </label>
                        <span className="text-[10px] font-bold text-muted-foreground/50">
                          {input.length}/500 {copy.charCount}
                        </span>
                      </div>
                    </div>

                    <ShimmerButton
                      type="button"
                      onClick={() => void handleSend()}
                      onMouseDown={(event) => event.preventDefault()}
                      disabled={!input.trim() || isSending}
                      className="shrink-0 self-end rounded-xl px-4 py-2.5 text-sm font-black"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Send className="size-3.5" />
                        {copy.send}
                      </span>
                    </ShimmerButton>
                  </div>
                </div>
              )}
            </div>
        </div>
      </div>
    </section>
  )
}
