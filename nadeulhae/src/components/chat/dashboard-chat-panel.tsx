"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import {
  BrainCircuit,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  MessageSquareHeart,
  SendHorizonal,
  Sparkles,
} from "lucide-react"

import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { useLanguage } from "@/context/LanguageContext"
import type { AuthUser } from "@/lib/auth/types"
import type { ChatConversationMessage, ChatStateResponse } from "@/lib/chat/types"
import { cn } from "@/lib/utils"

type UiChatMessage = ChatConversationMessage & {
  pending?: boolean
}

const CHAT_PANEL_COPY = {
  ko: {
    eyebrow: "llm copilot",
    title: "나들이 코파일럿",
    description:
      "사용자별로 격리된 메모리와 일일 사용량 제한을 적용한 실제 챗봇입니다. 대화가 길어지면 내부적으로 요약해서 문맥 비용을 줄입니다.",
    helper:
      "실시간 날씨 수치가 꼭 필요하면 대시보드 날씨 패널을 함께 확인하세요. 이 챗봇은 프로필과 대화 메모리를 우선 활용합니다.",
    limitLabel: "오늘 사용량",
    remainingLabel: "남은 횟수",
    tokenLabel: "오늘 토큰",
    summaryLabel: "자동 요약",
    summaryReady: "요약 메모리 활성",
    summaryEmpty: "아직 저장된 대화 메모리가 없습니다.",
    summaryUpdated: "마지막 정리",
    summaryCount: "누적 요약 횟수",
    securityLabel: "보안",
    securityValue: "사용자별 격리 저장",
    securityMeta: "다른 계정 대화와 메모리는 분리됩니다.",
    resetHint: "매일 00:00 KST 기준으로 사용량이 초기화됩니다.",
    emptyTitle: "대화를 시작해 보세요",
    emptyDescription: "전주 나들이 코스, 우천 대체 일정, 선호 시간대에 맞는 추천 등을 물어볼 수 있습니다.",
    intro: "안녕하세요. 프로필과 최근 대화를 바탕으로 나들이 계획을 돕겠습니다.",
    pending: "답변을 생성하는 중입니다.",
    loadError: "채팅 상태를 불러오지 못했습니다.",
    sendError: "메시지를 보내지 못했습니다.",
    placeholder: "예: 이번 주말 전주에서 비 와도 괜찮은 실내 나들이 코스를 추천해줘",
    send: "보내기",
    characterCount: "입력 길이",
    suggestions: "빠른 질문",
    loading: "대화 상태를 불러오는 중입니다.",
    noQuota: "오늘 채팅 가능 횟수를 모두 사용했습니다.",
    summaryOpen: "요약 메모리 보기",
  },
  en: {
    eyebrow: "llm copilot",
    title: "Outing copilot",
    description:
      "This is a live chatbot with per-user isolated memory and a daily usage limit. When the conversation grows, it compacts older context automatically to reduce prompt cost.",
    helper:
      "If you need live weather numbers, check the dashboard weather panels as well. This chatbot prioritizes your profile and saved conversation memory.",
    limitLabel: "Today usage",
    remainingLabel: "Remaining",
    tokenLabel: "Tokens today",
    summaryLabel: "Auto summary",
    summaryReady: "Memory summary active",
    summaryEmpty: "No saved conversation memory yet.",
    summaryUpdated: "Last compacted",
    summaryCount: "Summary count",
    securityLabel: "Security",
    securityValue: "Per-user isolated storage",
    securityMeta: "Messages and memory stay separated from other accounts.",
    resetHint: "Usage resets daily at 00:00 KST.",
    emptyTitle: "Start a conversation",
    emptyDescription: "Ask for Jeonju outing routes, rainy-day backup plans, or ideas matched to your preferred time of day.",
    intro: "Hello. I can help plan outings using your profile and recent conversation context.",
    pending: "Generating a response.",
    loadError: "Failed to load chat state.",
    sendError: "Failed to send the message.",
    placeholder: "Example: Recommend an indoor Jeonju outing plan for this weekend if rain is likely",
    send: "Send",
    characterCount: "Input length",
    suggestions: "Quick prompts",
    loading: "Loading chat state.",
    noQuota: "You have used all available chats for today.",
    summaryOpen: "View memory summary",
  },
} as const

const CHAT_SUGGESTIONS = {
  ko: [
    "이번 주말 전주 당일치기 코스 추천해줘",
    "비 오는 오후에 갈만한 실내 장소 알려줘",
    "미세먼지 많은 날에도 괜찮은 산책 동선이 있을까?",
  ],
  en: [
    "Recommend a one-day Jeonju outing route for this weekend",
    "Suggest indoor places for a rainy afternoon",
    "Is there a walking plan that still works on a high fine-dust day?",
  ],
} as const

function formatTimestamp(value: string, language: "ko" | "en") {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return date.toLocaleTimeString(language === "ko" ? "ko-KR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function MetricPill({
  label,
  value,
  meta,
  icon: Icon,
}: {
  label: string
  value: string
  meta: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-[1.35rem] border border-card-border/70 bg-background/80 p-4">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">
        <Icon className="size-4 text-sky-blue" />
        {label}
      </div>
      <p className="mt-3 text-xl font-black tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{meta}</p>
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
        "max-w-[92%] rounded-[1.4rem] border px-4 py-3 shadow-sm sm:max-w-[85%]",
        message.role === "assistant"
          ? "border-card-border/70 bg-background/80 text-foreground"
          : "ml-auto border-sky-blue/10 bg-sky-blue text-white"
      )}
    >
      <p className={cn("whitespace-pre-wrap text-sm leading-6", message.pending && "animate-pulse")}>
        {message.content}
      </p>
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

export function DashboardChatPanel({ user }: { user: AuthUser }) {
  const { language } = useLanguage()
  const copy = CHAT_PANEL_COPY[language]
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [messages, setMessages] = useState<UiChatMessage[]>([])
  const [memory, setMemory] = useState<ChatStateResponse["memory"]>(null)
  const [usage, setUsage] = useState<ChatStateResponse["usage"] | null>(null)
  const [policy, setPolicy] = useState<ChatStateResponse["policy"] | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null)

  const loadChatState = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await fetch("/api/chat", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Accept-Language": language,
        },
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data) {
        setErrorMessage(data?.error ?? copy.loadError)
        return
      }

      const payload = data as ChatStateResponse
      setMessages(payload.messages)
      setMemory(payload.memory)
      setUsage(payload.usage)
      setPolicy(payload.policy)
    } catch (error) {
      console.error("Failed to load dashboard chat state:", error)
      setErrorMessage(copy.loadError)
    } finally {
      setIsLoading(false)
    }
  }, [copy.loadError, language])

  useEffect(() => {
    void loadChatState()
  }, [loadChatState, user.id])

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, isPending])

  const remainingRequests = usage?.remainingRequests ?? policy?.dailyLimit ?? 0
  const canSend = !isLoading && !isPending && remainingRequests > 0
  const maxInputCharacters = policy?.maxInputCharacters ?? 1600

  const handleSend = () => {
    const nextMessage = chatInput.trim()
    if (!nextMessage || !canSend) {
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
          }),
        })

        const data = await response.json().catch(() => null)
        if (!response.ok || !data) {
          setMessages((current) => current.filter((item) =>
            item.id !== optimisticUserMessage.id && item.id !== optimisticAssistantMessage.id
          ))
          setChatInput(nextMessage)
          setErrorMessage(data?.error ?? copy.sendError)
          if (data?.usage) {
            setUsage(data.usage)
          }
          if (data?.policy) {
            setPolicy(data.policy)
          }
          return
        }

        const payload = data as ChatStateResponse
        setMessages(payload.messages)
        setMemory(payload.memory)
        setUsage(payload.usage)
        setPolicy(payload.policy)
      } catch (error) {
        console.error("Failed to send dashboard chat message:", error)
        setMessages((current) => current.filter((item) =>
          item.id !== optimisticUserMessage.id && item.id !== optimisticAssistantMessage.id
        ))
        setChatInput(nextMessage)
        setErrorMessage(copy.sendError)
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
            {copy.eyebrow}
          </p>
          <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {copy.title}
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {copy.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-sky-blue/20 bg-sky-blue/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-sky-blue">
            {copy.remainingLabel} {remainingRequests}
          </span>
          <span className="rounded-full border border-active-blue/20 bg-active-blue/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-active-blue">
            {usage?.requestCount ?? 0}/{usage?.dailyLimit ?? policy?.dailyLimit ?? 60}
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricPill
          label={copy.limitLabel}
          value={`${usage?.requestCount ?? 0}/${usage?.dailyLimit ?? policy?.dailyLimit ?? 60}`}
          meta={copy.resetHint}
          icon={Clock3}
        />
        <MetricPill
          label={copy.remainingLabel}
          value={`${remainingRequests}`}
          meta={remainingRequests > 0 ? copy.helper : copy.noQuota}
          icon={MessageSquareHeart}
        />
        <MetricPill
          label={copy.tokenLabel}
          value={`${usage?.totalTokens ?? 0}`}
          meta={`Prompt ${usage?.promptTokens ?? 0} · Completion ${usage?.completionTokens ?? 0}`}
          icon={Sparkles}
        />
        <MetricPill
          label={copy.securityLabel}
          value={copy.securityValue}
          meta={copy.securityMeta}
          icon={LockKeyhole}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.7rem] border border-card-border/70 bg-background/80 p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
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

          <div className="mt-4 rounded-[1.5rem] border border-card-border/70 bg-card/70 p-4">
            <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1 sm:max-h-[30rem]">
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
                  <div className="flex items-center gap-2 text-sm font-black text-foreground">
                    <BrainCircuit className="size-4 text-sky-blue" />
                    {copy.emptyTitle}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.emptyDescription}</p>
                  <p className="mt-4 rounded-[1.1rem] bg-sky-blue/8 px-4 py-3 text-sm leading-6 text-foreground">
                    {copy.intro}
                  </p>
                </div>
              )}
              <div ref={scrollAnchorRef} />
            </div>

            <div className="mt-4 space-y-3">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value.slice(0, maxInputCharacters))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={copy.placeholder}
                disabled={!canSend && remainingRequests <= 0}
                className="min-h-[132px] w-full rounded-[1.45rem] border border-card-border/70 bg-background/90 px-4 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-sky-blue/30 disabled:cursor-not-allowed disabled:opacity-70"
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">{copy.helper}</p>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    {copy.characterCount} {chatInput.length}/{maxInputCharacters}
                  </p>
                </div>

                <ShimmerButton
                  type="button"
                  onClick={handleSend}
                  disabled={!chatInput.trim() || !canSend}
                  className="min-w-[11rem] rounded-[1.25rem] px-5 py-3 text-sm font-black"
                >
                  <span className="inline-flex items-center gap-2">
                    {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />}
                    {copy.send}
                  </span>
                </ShimmerButton>
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-[1.3rem] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.7rem] border border-card-border/70 bg-background/80 p-5">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
              <BrainCircuit className="size-4 text-sky-blue" />
              {copy.summaryLabel}
            </div>
            <p className="mt-3 text-lg font-black tracking-tight text-foreground">
              {memory ? copy.summaryReady : copy.summaryEmpty}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MetricPill
                label={copy.summaryCount}
                value={`${usage?.summaryCount ?? 0}`}
                meta={`Summary tokens ${usage?.summaryTotalTokens ?? 0}`}
                icon={Sparkles}
              />
              <MetricPill
                label={copy.summaryUpdated}
                value={memory ? formatTimestamp(memory.updatedAt, language) : "-"}
                meta={memory?.modelUsed ?? copy.summaryEmpty}
                icon={Clock3}
              />
            </div>

            <details className="mt-4 rounded-[1.25rem] border border-card-border/70 bg-card/70 p-4">
              <summary className="cursor-pointer text-sm font-black text-foreground">
                {copy.summaryOpen}
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {memory?.summary ?? copy.summaryEmpty}
              </p>
            </details>
          </div>

          <div className="rounded-[1.7rem] border border-card-border/70 bg-background/80 p-5">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
              <Sparkles className="size-4 text-sky-blue" />
              {copy.suggestions}
            </div>
            <div className="mt-4 space-y-3">
              {CHAT_SUGGESTIONS[language].map((suggestion) => (
                <button
                  key={`${suggestion}-aside`}
                  type="button"
                  onClick={() => setChatInput(suggestion)}
                  className="flex w-full items-start rounded-[1.2rem] border border-card-border/70 bg-card/70 px-4 py-3 text-left text-sm font-semibold text-foreground transition hover:border-sky-blue/25 hover:text-sky-blue"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
