"use client"

import { Children, isValidElement, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Check, Copy, LoaderCircle, Plus, SendHorizonal, Sparkles, Trash2 } from "lucide-react"

import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { MermaidDiagram } from "@/components/lab/mermaid-diagram"
import { useLanguage } from "@/context/LanguageContext"
import type { AuthUser } from "@/lib/auth/types"
import type { ChatWeatherContext } from "@/lib/chat/prompt"
import type { ChatConversationMessage, ChatStateResponse } from "@/lib/chat/types"
import { highlightCode, normalizeCodeLanguage, type HighlightKind } from "@/lib/markdown/code-highlighting"
import { sanitizeAssistantMarkdown } from "@/lib/markdown/sanitize-assistant-markdown"
import {
  computeServerClockOffsetMs,
  formatServerClockTime,
  getServerNowMs,
} from "@/lib/time/server-time"
import { cn } from "@/lib/utils"

type UiChatMessage = ChatConversationMessage & {
  pending?: boolean
}

type ChatStateApiResponse = ChatStateResponse & {
  serverNow?: unknown
  error?: string
}

const TOKEN_CLASS_BY_KIND: Record<HighlightKind, string> = {
  plain: "text-slate-800 dark:text-slate-200",
  comment: "text-slate-500 italic dark:text-slate-400",
  function: "text-teal-700 dark:text-teal-300",
  keyword: "text-blue-700 dark:text-blue-300",
  meta: "text-amber-700 dark:text-amber-300",
  number: "text-amber-700 dark:text-amber-300",
  operator: "text-slate-700/80 dark:text-slate-300/80",
  property: "text-violet-700 dark:text-violet-300",
  string: "text-emerald-700 dark:text-emerald-300",
  type: "text-orange-700 dark:text-orange-300",
}

const CHAT_PANEL_COPY = {
  ko: {
    title: "나들AI",
    description:
      "원하는 조건을 말하면 전주 나들이 코스, 대체 일정, 준비물을 추천해요.",
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
    sessionDelete: "삭제",
    sessionHint: "세션을 나눠두면 일정별로 대화를 관리할 수 있어요.",
    sessionPlaceholder: "세션 선택",
    sessionMessages: "메시지",
    limitReached: "오늘 가능한 대화는 모두 사용했어요. 내일 다시 이어서 도와드릴게요.",
    placeholder: "예: 비 오는 저녁에도 가능한 전주 데이트 코스 추천해줘",
    send: "보내기",
    suggestions: "바로 질문하기",
    loading: "메이트를 부르는 중...",
    emptyTitle: "원하는 나들이를 바로 물어보세요",
    emptyDescription: "날씨, 시간, 동행자를 함께 알려주면 더 정확한 코스를 추천해요.",
    intro: "안녕하세요! 지금 조건에 맞는 전주 나들이 계획을 함께 짜볼게요.",
    copyCode: "복사",
    copiedCode: "복사됨",
  },
  en: {
    title: "Outing mate",
    description:
      "Tell me your conditions and I will suggest Jeonju routes, backup plans, and what to prepare.",
    canAskLabel: "What you can do",
    canAsk: ["Route ideas", "Rainy-day backup", "Preparation list"],
    pending: "Planning your route...",
    loadError: "Failed to load the mate.",
    sendError: "Failed to send the message. Please try again.",
    sessionLoadError: "Failed to load sessions. Please try again.",
    sessionCreateError: "Failed to create a new session.",
    sessionDeleteError: "Failed to delete the session.",
    sessionDeleteConfirm: "Delete this session now?",
    sessionLabel: "Session",
    sessionCreate: "New session",
    sessionDelete: "Delete",
    sessionHint: "Use separate sessions to keep different outing plans organized.",
    sessionPlaceholder: "Select a session",
    sessionMessages: "messages",
    limitReached: "You have reached today's chat limit. Come back tomorrow and we can continue.",
    placeholder: "Example: Recommend a Jeonju date course for a rainy evening",
    send: "Send",
    suggestions: "Quick prompts",
    loading: "Loading your mate...",
    emptyTitle: "Ask for your outing plan",
    emptyDescription: "Share weather, timing, and who you are going with for better suggestions.",
    intro: "Hello! I can build a Jeonju outing plan around your current conditions.",
    copyCode: "Copy",
    copiedCode: "Copied",
  },
  zh: {
    title: "出行助手",
    description: "告诉我您的条件，我为您推荐全州出行路线、备选方案和准备物品。",
    canAskLabel: "可以这样用",
    canAsk: ["路线推荐", "雨天备选", "准备物品"],
    pending: "正在努力规划中...",
    loadError: "无法加载助手。",
    sendError: "消息发送失败，请重试。",
    sessionLoadError: "无法加载会话，请重试。",
    sessionCreateError: "创建新会话失败。",
    sessionDeleteError: "删除会话失败。",
    sessionDeleteConfirm: "确定删除当前会话？",
    sessionLabel: "会话",
    sessionCreate: "新建会话",
    sessionDelete: "删除",
    sessionHint: "使用不同会话管理不同的出行计划。",
    sessionPlaceholder: "选择会话",
    sessionMessages: "条消息",
    limitReached: "今日可用次数已用完，明天继续为您服务。",
    placeholder: "例如：推荐雨天晚上的全州约会路线",
    send: "发送",
    suggestions: "快捷提问",
    loading: "正在加载助手...",
    emptyTitle: "直接询问您的出行计划",
    emptyDescription: "告诉天气、时间、同伴等信息，我会为您推荐更准确的路线。",
    intro: "您好！让我根据当前条件为您制定全州出行计划。",
    copyCode: "复制",
    copiedCode: "已复制",
  },
  ja: {
    title: "お出かけメイト",
    description: "条件を教えていただければ、全州のお出かけコース、代替案、持ち物をおすすめします。",
    canAskLabel: "こんな風に使えます",
    canAsk: ["コース推薦", "雨天時の代替案", "持ち物チェック"],
    pending: "計画を練っています...",
    loadError: "メイトを読み込めませんでした。",
    sendError: "メッセージの送信に失敗しました。もう一度お試しください。",
    sessionLoadError: "セッションの読み込みに失敗しました。もう一度お試しください。",
    sessionCreateError: "新しいセッションを作成できませんでした。",
    sessionDeleteError: "セッションを削除できませんでした。",
    sessionDeleteConfirm: "このセッションを削除しますか？",
    sessionLabel: "セッション",
    sessionCreate: "新規セッション",
    sessionDelete: "削除",
    sessionHint: "セッションごとに異なるお出かけ計画を管理できます。",
    sessionPlaceholder: "セッションを選択",
    sessionMessages: "件のメッセージ",
    limitReached: "本日の利用可能回数を使い切りました。明日また続けましょう。",
    placeholder: "例：雨の夜でも楽しめる全州デートコースを教えて",
    send: "送信",
    suggestions: "クイック質問",
    loading: "メイトを呼び出し中...",
    emptyTitle: "お出かけ計画を直接質問してください",
    emptyDescription: "天気、時間、同行者を教えていただくと、より正確なコースをおすすめします。",
    intro: "こんにちは！現在の条件に合わせた全州のお出かけ計画を一緒に立てましょう。",
    copyCode: "コピー",
    copiedCode: "コピー済み",
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
  zh: [
    "推荐一个全州周末一日游路线",
    "推荐下雨天下午可以去的室内场所",
    "帮我规划带孩子的全州出行路线",
  ],
  ja: [
    "今週末の全州日帰りコースを教えて",
    "雨の午後に行ける室内スポットを教えて",
    "子供と一緒に行きやすいルートを組んで",
  ],
} as const

function formatTimestamp(value: string, language: string) {
  return formatServerClockTime(value, language)
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-2">
      <span className="size-[6px] animate-bounce rounded-full bg-foreground/50 [animation-delay:-0.3s]" />
      <span className="size-[6px] animate-bounce rounded-full bg-foreground/50 [animation-delay:-0.15s]" />
      <span className="size-[6px] animate-bounce rounded-full bg-foreground/50" />
    </div>
  )
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "true")
  textarea.style.position = "fixed"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  document.body.removeChild(textarea)
}

function DashboardMarkdownCodeBlock({
  code,
  language,
  copyLabel,
  copiedLabel,
}: {
  code: string
  language: string | null
  copyLabel: string
  copiedLabel: string
}) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<number | null>(null)
  const normalizedLanguage = useMemo(() => normalizeCodeLanguage(language), [language])
  const tokens = useMemo(() => highlightCode(code, normalizedLanguage.id), [code, normalizedLanguage.id])

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    await copyTextToClipboard(code)
    setCopied(true)
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setCopied(false), 1600)
  }, [code])

  return (
    <div className="not-prose my-3 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-colors">
      <div className="flex items-center justify-between border-b border-border bg-muted/55 px-3 py-2">
        <span className="truncate text-xs font-semibold text-foreground/80">{normalizedLanguage.label}</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background/70 px-2.5 text-xs font-semibold text-foreground/85 transition hover:bg-muted active:scale-[0.98]"
          aria-label={copied ? copiedLabel : copyLabel}
        >
          {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <pre className="m-0 max-h-[28rem] overflow-auto bg-card p-4 text-left custom-scrollbar">
        <code className="block min-w-full whitespace-pre font-mono text-[13px] leading-6">
          {tokens.map((token, index) => (
            <span key={`${index}-${token.kind}`} className={TOKEN_CLASS_BY_KIND[token.kind]}>
              {token.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

type MessageGroup = {
  role: "user" | "assistant"
  messages: UiChatMessage[]
}

function groupMessages(messages: UiChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  for (const message of messages) {
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup.role === message.role && !message.pending) {
      lastGroup.messages.push(message)
    } else {
      groups.push({ role: message.role, messages: [message] })
    }
  }
  return groups
}

function ChatBubble({
  message,
  language,
  isLastAssistant,
  groupPosition,
}: {
  message: UiChatMessage
  language: string
  isLastAssistant: boolean
  groupPosition: "first" | "middle" | "last" | "only"
}) {
  const isUser = message.role === "user"
  const showAvatar = !isUser && (groupPosition === "first" || groupPosition === "only")
  const showTimestamp = groupPosition === "last" || groupPosition === "only"

  const copy = (((CHAT_PANEL_COPY as any)[language] ?? CHAT_PANEL_COPY.ko) ?? CHAT_PANEL_COPY.ko)
  const messageContent = !isUser
    ? sanitizeAssistantMarkdown({ content: message.content, language })
    : message.content

  const markdownComponents = useMemo<Components>(() => ({
    pre({ children, node, ...props }) {
      void node
      const childArray = Children.toArray(children).filter(
        (child) => !(typeof child === "string" && child.trim() === "")
      )
      if (
        childArray.length === 1 &&
        isValidElement(childArray[0]) &&
        (childArray[0].type === MermaidDiagram || childArray[0].type === DashboardMarkdownCodeBlock)
      ) {
        return <>{childArray[0]}</>
      }
      return <pre {...props}>{children}</pre>
    },
    code({ children, className, node, ...props }) {
      void node
      const codeText = Children.toArray(children).join("").replace(/\n$/, "")
      const lang = /language-([A-Za-z0-9_+#.-]+)/.exec(className ?? "")?.[1] ?? null
      const isBlock = Boolean(lang) || codeText.includes("\n")
      if (lang?.toLowerCase() === "mermaid") {
        return <MermaidDiagram code={codeText} copyLabel={copy.copyCode} copiedLabel={copy.copiedCode} />
      }
      if (isBlock) {
        return (
          <DashboardMarkdownCodeBlock
            code={codeText}
            language={lang}
            copyLabel={copy.copyCode}
            copiedLabel={copy.copiedCode}
          />
        )
      }
      return (
        <code
          {...props}
          className={cn("rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em] text-foreground", className)}
        >
          {children}
        </code>
      )
    },
  }), [copy.copyCode, copy.copiedCode])

  const roundedClass = isUser
    ? groupPosition === "only"
      ? "rounded-2xl rounded-tr-sm"
      : groupPosition === "first"
        ? "rounded-2xl rounded-tr-sm rounded-br-sm rounded-bl-sm"
        : groupPosition === "last"
          ? "rounded-2xl rounded-tr-sm rounded-tl-sm rounded-bl-sm"
          : "rounded-xl rounded-tr-sm"
    : groupPosition === "only"
      ? "rounded-2xl rounded-tl-sm"
      : groupPosition === "first"
        ? "rounded-2xl rounded-tl-sm rounded-br-sm rounded-bl-sm"
        : groupPosition === "last"
          ? "rounded-2xl rounded-tl-sm rounded-tr-sm rounded-br-sm"
          : "rounded-xl rounded-tl-sm"

  return (
    <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      {showAvatar ? (
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Sparkles className="size-3.5" />
        </div>
      ) : !isUser ? (
        <div className="w-7 shrink-0" />
      ) : null}
      <div className={cn("max-w-[78%] min-w-0", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "px-3.5 py-2.5 text-[15px] leading-[1.65]",
            roundedClass,
            isUser
              ? "bg-sky-blue text-white"
              : cn(
                  "border border-card-border/50 bg-card/90 text-foreground",
                  isLastAssistant && "shadow-[0_2px_12px_-4px_rgba(47,111,228,0.08)]"
                )
          )}
        >
          {message.pending ? (
            <TypingIndicator />
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{messageContent}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none break-words prose-p:my-1.5 prose-pre:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:my-2 prose-strong:text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {messageContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {showTimestamp && (
          <p
            className={cn(
              "mt-1 px-1 text-[11px] text-muted-foreground/70",
              isUser ? "text-right" : "text-left"
            )}
          >
            {formatTimestamp(message.createdAt, language)}
          </p>
        )}
      </div>
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
  const copy = (((CHAT_PANEL_COPY as any)[language] ?? CHAT_PANEL_COPY.ko) ?? CHAT_PANEL_COPY.ko)
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
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState<number | null>(null)
  const messageViewportRef = useRef<HTMLDivElement | null>(null)
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null)
  const didInitScrollRef = useRef(false)
  const previousMessageCountRef = useRef(0)
  const shouldStickToBottomRef = useRef(true)
  const isComposingRef = useRef(false)

  const applyPayload = useCallback((payload: ChatStateResponse) => {
    // Keep all state slices sourced from one server payload to avoid partial-session mismatches.
    setMessages(payload.messages)
    setUsage(payload.usage)
    setPolicy(payload.policy)
    setSessions(payload.sessions)
    setActiveSessionId(payload.activeSessionId)
  }, [])

  const syncServerClock = useCallback((serverNow: unknown) => {
    const offsetMs = computeServerClockOffsetMs(serverNow)
    if (offsetMs != null) {
      setServerClockOffsetMs(offsetMs)
    }
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
      syncServerClock((data as { serverNow?: unknown } | null)?.serverNow)
      if (!response.ok || !data) {
        setErrorMessage(data?.error ?? copy.sessionLoadError)
        return
      }

      const payload = data as ChatStateApiResponse
      applyPayload(payload)
    } catch (error) {
      console.error("Failed to load dashboard chat state:", error)
      setErrorMessage(copy.loadError)
    } finally {
      setIsLoading(false)
    }
  }, [applyPayload, copy.loadError, copy.sessionLoadError, language, syncServerClock])

  useEffect(() => {
    void loadChatState(null)
  }, [loadChatState, user.id])

  // Auto-dismiss error messages after 5 seconds.
  useEffect(() => {
    if (!errorMessage) return
    const timer = window.setTimeout(() => setErrorMessage(null), 5_000)
    return () => window.clearTimeout(timer)
  }, [errorMessage])

  const resolvedActiveSessionId = activeSessionId ?? sessions[0]?.id ?? null

  useEffect(() => {
    // Reset viewport tracking when switching session so first render starts from latest message.
    didInitScrollRef.current = false
    previousMessageCountRef.current = 0
    shouldStickToBottomRef.current = true
  }, [resolvedActiveSessionId])

  const handleViewportScroll = useCallback(() => {
    const viewport = messageViewportRef.current
    if (!viewport) {
      return
    }

    // Sticky autoscroll only while user remains near bottom; preserve manual scroll-up reading.
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
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" })
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

  const handleCreateSession = useCallback(() => {
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
        syncServerClock((data as { serverNow?: unknown } | null)?.serverNow)
        if (!response.ok || !data) {
          setErrorMessage(data?.error ?? copy.sessionCreateError)
          return
        }

        applyPayload(data as ChatStateApiResponse)
        setChatInput("")
      } catch (error) {
        console.error("Failed to create dashboard chat session:", error)
        setErrorMessage(copy.sessionCreateError)
      }
    })
  }, [applyPayload, copy.sessionCreateError, language, syncServerClock])

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
            // Backend mutation guard expects JSON requests for non-GET routes.
            "Content-Type": "application/json",
            "Accept-Language": language,
          },
          body: JSON.stringify({}),
        })

        const data = await response.json().catch(() => null)
        syncServerClock((data as { serverNow?: unknown } | null)?.serverNow)
        if (!response.ok || !data) {
          setErrorMessage(data?.error ?? copy.sessionDeleteError)
          return
        }

        applyPayload(data as ChatStateApiResponse)
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

  const serverNowMs = getServerNowMs(serverClockOffsetMs)

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
    const now = new Date(serverNowMs).toISOString()
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
            "Accept": "text/event-stream",
          },
          body: JSON.stringify({
            message: nextMessage,
            locale: language,
            weatherContext,
            sessionId: resolvedActiveSessionId,
          }),
        })

        if (response.headers.get("content-type")?.includes("text/event-stream")) {
          const reader = response.body?.getReader()
          if (!reader) throw new Error("No stream body")

          const decoder = new TextDecoder()
          let buffer = ""
          let streamAccumulated = ""

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
                  streamAccumulated += parsed.content
                  const accumulatedSoFar = streamAccumulated
                  setMessages((current) =>
                    current.map((item) =>
                      item.id === optimisticAssistantMessage.id
                        ? { ...item, content: accumulatedSoFar, pending: false }
                        : item
                    )
                  )
                } else if (eventType === "done") {
                  syncServerClock((parsed as { serverNow?: unknown })?.serverNow)
                  applyPayload(parsed as ChatStateResponse)
                } else if (eventType === "error") {
                  setMessages((current) =>
                    current.filter((item) =>
                      item.id !== optimisticUserMessage.id && item.id !== optimisticAssistantMessage.id
                    )
                  )
                  setChatInput(rawInput)
                  setErrorMessage(parsed.error ?? copy.sendError)
                }
              } catch {}
            }
          }
          return
        }

        const data = await response.json().catch(() => null)
        syncServerClock((data as { serverNow?: unknown } | null)?.serverNow)
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
            applyPayload(data as ChatStateApiResponse)
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

  const messageGroups = groupMessages(messages)
  const lastAssistantIndex = messages.findLastIndex((m) => m.role === "assistant")

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* Session Bar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCreateSession}
          disabled={isSessionPending}
          className="inline-flex items-center gap-1.5 rounded-full border border-card-border/70 bg-background/75 px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-accent/30 hover:text-accent disabled:opacity-50"
        >
          {isSessionPending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          {copy.sessionCreate}
        </button>

        <select
          value={resolvedActiveSessionId ?? ""}
          onChange={(event) => handleSessionSelect(event.target.value)}
          disabled={isSessionPending || isLoading || sessions.length === 0}
          className="min-w-0 flex-1 rounded-full border border-card-border/70 bg-background/75 px-3 py-1.5 text-sm font-medium text-foreground outline-none transition focus:border-accent/30 disabled:opacity-50"
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
          className="inline-flex items-center justify-center rounded-full border border-danger/20 bg-danger/5 p-1.5 text-danger transition hover:bg-danger/10 disabled:opacity-40"
          title={copy.sessionDelete}
        >
          {isSessionPending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        </button>
      </div>

      {/* Chat Container */}
      <div className="relative flex max-h-[36rem] min-h-[24rem] flex-col overflow-hidden rounded-[1.4rem] border border-card-border/60 bg-background sm:max-h-[42rem] sm:min-h-[28rem]">
        {/* Messages Area */}
        <div
          ref={messageViewportRef}
          onScroll={handleViewportScroll}
          className="flex-1 overflow-y-auto overscroll-contain p-4 custom-scrollbar sm:px-5 sm:py-4"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin text-accent" />
              <span>{copy.loading}</span>
            </div>
          ) : messages.length > 0 ? (
            <div className="flex flex-col gap-3">
              {messageGroups.map((group, groupIndex) => (
                <div key={`group-${groupIndex}`} className="flex flex-col gap-0.5">
                  {group.messages.map((message, msgIndex) => {
                    const groupLength = group.messages.length
                    const groupPosition = groupLength === 1
                      ? "only"
                      : msgIndex === 0
                        ? "first"
                        : msgIndex === groupLength - 1
                          ? "last"
                          : "middle"

                    return (
                      <ChatBubble
                        key={message.id}
                        message={message}
                        language={language}
                        isLastAssistant={message.role === "assistant" && messages.indexOf(message) === lastAssistantIndex}
                        groupPosition={groupPosition}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Sparkles className="size-5" />
              </div>
              <div className="text-sm font-bold text-foreground">{copy.emptyTitle}</div>
              <p className="max-w-xs text-sm leading-6 text-muted-foreground">{copy.emptyDescription}</p>
              <div className="max-w-sm rounded-[1.1rem] bg-accent/5 px-4 py-3 text-sm leading-6 text-foreground">
                {copy.intro}
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {CHAT_SUGGESTIONS[language].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setChatInput(suggestion)}
                    className="rounded-full border border-card-border/60 bg-card/80 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-accent/30 hover:text-accent"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-card-border/40 bg-background/80 px-3 py-3 backdrop-blur-sm sm:px-4">
          {isLimitReached && (
            <div className="mb-2 rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger">
              {copy.limitReached}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-card-border/70 bg-card/80 px-3 py-2 transition-colors focus-within:border-accent/40 focus-within:shadow-[0_0_0_2px_rgba(11,125,113,0.08)]">
            <textarea
              ref={chatInputRef}
              value={chatInput}
              onChange={(event) => {
                setChatInput(event.target.value.slice(0, maxInputCharacters))
                // Auto-resize to fit content (max 6 lines)
                const el = event.target
                el.style.height = "auto"
                el.style.height = `${Math.min(el.scrollHeight, 144)}px`
              }}
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
              rows={1}
              className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-[1.5] text-foreground outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-70"
            />
            <ShimmerButton
              type="button"
              onClick={handleSend}
              onMouseDown={(event) => event.preventDefault()}
              disabled={!chatInput.trim() || !canSend}
              className="mb-0.5 shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold"
            >
              {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />}
            </ShimmerButton>
          </div>
        </div>
      </div>

      {/* Error */}
      {errorMessage ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-[1.1rem] border border-danger/20 bg-danger/8 px-4 py-3 text-sm font-semibold text-danger"
        >
          {errorMessage}
        </div>
      ) : null}
    </div>
  )
}
