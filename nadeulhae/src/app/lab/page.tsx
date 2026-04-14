"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Check,
  FlaskConical,
  RefreshCcw,
  Sparkles,
  X,
} from "lucide-react"
import { useTheme } from "next-themes"

import { BorderBeam } from "@/components/magicui/border-beam"
import { MagicCard } from "@/components/magicui/magic-card"
import { Meteors } from "@/components/magicui/meteors"
import { Particles } from "@/components/magicui/particles"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { SectionCard, StatusMetric } from "@/components/dashboard/ui"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import { formatServerDateTime, parseServerTimestamp } from "@/lib/time/server-time"
import { cn } from "@/lib/utils"

const LAB_MIN_CARD_COUNT = 4
const LAB_MAX_CARD_COUNT = 10
const LAB_DEFAULT_CARD_COUNT = 8
const LAB_TOPIC_MAX_LENGTH = 220
const LAB_SRS_TOTAL_STAGES = 8

type LabUsageSnapshot = {
  metricDate: string
  generationCount: number
  remainingGenerations: number
  dailyGenerationLimit: number
  reviewCount: number
}

type LabDeckSnapshot = {
  id: string
  title: string
  topic: string
  cardCount: number
  createdAt: string
}

type LabCardSnapshot = {
  id: string
  deckId: string
  term: string
  meaning: string
  example: string | null
  tip: string | null
  stage: number
  nextReviewAt: string
  lastReviewedAt: string | null
}

type LabStateSnapshot = {
  usage: LabUsageSnapshot
  dueCards: LabCardSnapshot[]
  recentDecks: LabDeckSnapshot[]
}

type ApiErrorPayload = {
  error?: string
}

const LAB_COPY = {
  ko: {
    loading: "실험실을 불러오는 중...",
    loginRequired: "로그인이 필요합니다. 로그인 페이지로 이동합니다.",
    disabledTitle: "실험실 기능이 꺼져 있어요.",
    disabledDescription:
      "대시보드 프로필 설정에서 '실험실 기능 활성화'를 켜면 바로 사용할 수 있습니다.",
    goDashboard: "대시보드로 이동",
    badge: "experimental lab",
    title: "나들 실험실",
    subtitle:
      "프로필 기반으로 맞춤 학습 카드를 생성하고, SRS 복습으로 기억을 유지하는 실험 기능입니다.",
    usageRemaining: "오늘 생성 가능",
    usageCreated: "오늘 생성",
    usageReviewed: "오늘 복습",
    stateError: "실험실 상태를 불러오지 못했습니다.",
    reload: "다시 불러오기",
    topicLabel: "주제 입력",
    topicPlaceholder: "예: 주말 전주 나들이 영어 표현",
    invalidTopic: "주제를 2자 이상 입력해 주세요.",
    cardCountLabel: "생성 카드 수",
    generate: "카드 생성",
    generating: "생성 중...",
    generateHint: "모델명은 화면에 표시하지 않고 결과 카드만 저장합니다.",
    dueTitle: "지금 복습할 카드",
    reveal: "정답 보기",
    know: "알아요",
    dontKnow: "몰라요",
    reviewing: "반영 중...",
    noDue: "지금 복습할 카드가 없습니다. 새 카드를 만들거나 다음 복습 시간을 기다려 주세요.",
    queueLabel: "대기 카드",
    recentDecks: "최근 생성 덱",
    noDecks: "아직 생성된 덱이 없습니다.",
    nextReviewAt: "다음 복습",
    stage: "단계",
    cards: "카드",
    generatedAt: "생성",
  },
  en: {
    loading: "Loading lab...",
    loginRequired: "You need to log in first. Redirecting to login.",
    disabledTitle: "Lab is disabled.",
    disabledDescription:
      "Enable 'experimental lab' in dashboard profile settings to access this page.",
    goDashboard: "Go to dashboard",
    badge: "experimental lab",
    title: "Nadeul Lab",
    subtitle:
      "Generate profile-tailored learning cards and keep them with SRS-based review.",
    usageRemaining: "Remaining today",
    usageCreated: "Generated today",
    usageReviewed: "Reviewed today",
    stateError: "Failed to load lab state.",
    reload: "Reload",
    topicLabel: "Topic",
    topicPlaceholder: "Example: practical weather expressions for outings",
    invalidTopic: "Please enter a topic with at least 2 characters.",
    cardCountLabel: "Cards to generate",
    generate: "Generate cards",
    generating: "Generating...",
    generateHint: "Model names are not exposed in UI. Only card outputs are stored.",
    dueTitle: "Cards due now",
    reveal: "Reveal answer",
    know: "Know",
    dontKnow: "Don't know",
    reviewing: "Applying...",
    noDue: "No cards are due right now. Generate new cards or come back at next review time.",
    queueLabel: "Queue",
    recentDecks: "Recent decks",
    noDecks: "No decks generated yet.",
    nextReviewAt: "Next review",
    stage: "Stage",
    cards: "Cards",
    generatedAt: "Created",
  },
} as const

function formatLabDate(value: string, language: "ko" | "en") {
  const parsed = parseServerTimestamp(value)
  if (!parsed) {
    return value
  }
  return formatServerDateTime(parsed, language)
}

async function parseApiError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as ApiErrorPayload
    if (typeof payload.error === "string" && payload.error.trim().length > 0) {
      return payload.error
    }
  } catch {
    // no-op
  }
  return fallback
}

export default function LabPage() {
  const router = useRouter()
  const { user, status } = useAuth()
  const { language } = useLanguage()
  const { resolvedTheme } = useTheme()
  const copy = LAB_COPY[language]

  const [state, setState] = useState<LabStateSnapshot | null>(null)
  const [stateError, setStateError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [topic, setTopic] = useState("")
  const [cardCount, setCardCount] = useState(LAB_DEFAULT_CARD_COUNT)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [answerVisible, setAnswerVisible] = useState(false)
  const [isCompactViewport, setIsCompactViewport] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  const particleColor = resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"
  const backgroundMotionEnabled = !prefersReducedMotion
  const particleQuantity = isCompactViewport ? 26 : 56
  const meteorCount = isCompactViewport ? 2 : 6

  const loadState = useCallback(async () => {
    if (!user?.labEnabled) {
      return
    }

    setIsLoading(true)
    setStateError(null)
    setActionError(null)

    try {
      const response = await fetch("/api/lab/state", {
        method: "GET",
        headers: {
          "Accept-Language": language,
        },
        cache: "no-store",
        credentials: "include",
      })

      if (response.status === 401) {
        router.replace("/login")
        return
      }

      if (!response.ok) {
        setStateError(await parseApiError(response, copy.stateError))
        return
      }

      const payload = (await response.json()) as { state?: LabStateSnapshot }
      setState(payload.state ?? null)
    } catch (error) {
      console.error("Failed to load lab state:", error)
      setStateError(copy.stateError)
    } finally {
      setIsLoading(false)
    }
  }, [copy.stateError, language, router, user?.labEnabled])

  useEffect(() => {
    if (status === "authenticated" && user?.labEnabled) {
      void loadState()
    }
  }, [loadState, status, user?.labEnabled])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const applyMotionPreference = () => {
      setPrefersReducedMotion(media.matches)
    }
    const applyViewportMode = () => {
      setIsCompactViewport(window.innerWidth < 768)
    }

    applyMotionPreference()
    applyViewportMode()

    window.addEventListener("resize", applyViewportMode, { passive: true })
    media.addEventListener("change", applyMotionPreference)

    return () => {
      window.removeEventListener("resize", applyViewportMode)
      media.removeEventListener("change", applyMotionPreference)
    }
  }, [])

  useEffect(() => {
    if (status === "guest") {
      const timeout = window.setTimeout(() => {
        router.replace("/login")
      }, 450)
      return () => window.clearTimeout(timeout)
    }
  }, [router, status])

  const activeCard = state?.dueCards[0] ?? null
  const queuedCards = state?.dueCards.slice(1, 6) ?? []
  const stageProgress = useMemo(() => {
    if (!activeCard) return 0
    const safeStage = Math.max(0, Math.min(LAB_SRS_TOTAL_STAGES - 1, activeCard.stage))
    return ((safeStage + 1) / LAB_SRS_TOTAL_STAGES) * 100
  }, [activeCard])

  const handleGenerate = async () => {
    const normalizedTopic = topic.replace(/\s+/g, " ").trim()
    if (normalizedTopic.length < 2) {
      setActionError(copy.invalidTopic)
      return
    }

    setIsGenerating(true)
    setActionError(null)
    setAnswerVisible(false)

    try {
      const response = await fetch("/api/lab/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": language,
        },
        credentials: "include",
        body: JSON.stringify({
          topic: normalizedTopic,
          cardCount,
        }),
      })

      if (!response.ok) {
        setActionError(await parseApiError(response, copy.stateError))
        return
      }

      const payload = (await response.json()) as { state?: LabStateSnapshot }
      setState(payload.state ?? null)
      setTopic("")
    } catch (error) {
      console.error("Lab generate failed:", error)
      setActionError(copy.stateError)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleReview = async (known: boolean) => {
    if (!activeCard) return

    setIsReviewing(true)
    setActionError(null)

    try {
      const response = await fetch("/api/lab/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": language,
        },
        credentials: "include",
        body: JSON.stringify({
          cardId: Number(activeCard.id),
          known,
        }),
      })

      if (!response.ok) {
        setActionError(await parseApiError(response, copy.stateError))
        return
      }

      const payload = (await response.json()) as { state?: LabStateSnapshot }
      setState(payload.state ?? null)
      setAnswerVisible(false)
    } catch (error) {
      console.error("Lab review failed:", error)
      setActionError(copy.stateError)
    } finally {
      setIsReviewing(false)
    }
  }

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-center text-sm font-bold text-sky-blue">
        {copy.loading}
      </main>
    )
  }

  if (status === "guest" || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-center text-sm font-bold text-sky-blue">
        {copy.loginRequired}
      </main>
    )
  }

  if (!user.labEnabled) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-background px-4 pb-14 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        {backgroundMotionEnabled ? (
          <>
            <Particles
              className="absolute inset-0 z-0 opacity-65"
              quantity={particleQuantity}
              ease={80}
              color={particleColor}
              refresh
            />
            <Meteors number={meteorCount} className="z-0" />
          </>
        ) : null}
        <div className="relative z-10 mx-auto max-w-3xl">
          <SectionCard>
            <div className="space-y-4 text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-active-blue">
                <FlaskConical className="size-3.5" />
                {copy.badge}
              </span>
              <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                {copy.disabledTitle}
              </h1>
              <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {copy.disabledDescription}
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-[1.25rem] border border-sky-blue/30 bg-sky-blue/10 px-5 py-3 text-sm font-black text-sky-blue transition hover:border-sky-blue hover:bg-sky-blue/20"
              >
                {copy.goDashboard}
              </Link>
            </div>
          </SectionCard>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 pb-14 pt-24 sm:px-6 sm:pt-28 lg:px-8">
      {backgroundMotionEnabled ? (
        <>
          <Particles
            className="absolute inset-0 z-0 opacity-70"
            quantity={particleQuantity}
            ease={80}
            color={particleColor}
            refresh
          />
          <Meteors number={meteorCount} className="z-0" />
        </>
      ) : null}

      <div className="relative z-10 mx-auto max-w-[82rem] 2xl:max-w-[86rem]">
        <SectionCard className="mb-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)] xl:items-end">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-active-blue">
                <Sparkles className="size-3.5" />
                {copy.badge}
              </span>
              <div className="space-y-2">
                <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">{copy.title}</h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{copy.subtitle}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <StatusMetric label={copy.usageRemaining} value={String(state?.usage.remainingGenerations ?? 0)} />
              <StatusMetric
                label={copy.usageCreated}
                value={`${state?.usage.generationCount ?? 0}/${state?.usage.dailyGenerationLimit ?? 0}`}
              />
              <StatusMetric label={copy.usageReviewed} value={String(state?.usage.reviewCount ?? 0)} />
            </div>
          </div>
        </SectionCard>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SectionCard className="min-w-0">
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                  {copy.topicLabel}
                </p>
                <textarea
                  value={topic}
                  onChange={(event) => setTopic(event.target.value.slice(0, LAB_TOPIC_MAX_LENGTH))}
                  placeholder={copy.topicPlaceholder}
                  className="h-28 w-full resize-none rounded-[1.2rem] border border-card-border/70 bg-background/80 px-4 py-3 text-base font-medium text-foreground shadow-inner outline-none transition focus:border-sky-blue/35 focus:ring-2 focus:ring-sky-blue/15 sm:text-sm"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {copy.cardCountLabel}: <span className="font-black text-foreground">{cardCount}</span>
                  </label>
                  <input
                    type="range"
                    min={LAB_MIN_CARD_COUNT}
                    max={LAB_MAX_CARD_COUNT}
                    value={cardCount}
                    onChange={(event) => setCardCount(Number(event.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-card-border/60 accent-sky-blue sm:w-56"
                  />
                </div>
              </div>

              <ShimmerButton
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isGenerating}
                className="w-full rounded-[1.4rem] py-4 text-base font-black"
              >
                {isGenerating ? copy.generating : copy.generate}
              </ShimmerButton>

              <p className="text-xs leading-5 text-muted-foreground">{copy.generateHint}</p>

              {actionError ? (
                <p className="rounded-[1rem] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
                  {actionError}
                </p>
              ) : null}

              {stateError ? (
                <div className="rounded-[1rem] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
                  <div className="flex items-center justify-between gap-3">
                    <span>{stateError}</span>
                    <button
                      type="button"
                      onClick={() => void loadState()}
                      className="inline-flex items-center gap-1 rounded-full border border-danger/30 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em]"
                    >
                      <RefreshCcw className={cn("size-3.5", isLoading && "animate-spin")} />
                      {copy.reload}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                  {copy.recentDecks}
                </p>
                {state?.recentDecks.length ? (
                  <ul className="space-y-2.5">
                    {state.recentDecks.map((deck) => (
                      <li key={deck.id} className="rounded-[1.2rem] border border-card-border/70 bg-background/70 px-4 py-3">
                        <p className="text-sm font-black text-foreground">{deck.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{deck.topic}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                          <span className="rounded-full border border-card-border/70 bg-card/80 px-2.5 py-1">
                            {copy.cards}: {deck.cardCount}
                          </span>
                          <span className="rounded-full border border-card-border/70 bg-card/80 px-2.5 py-1">
                            {copy.generatedAt}: {formatLabDate(deck.createdAt, language)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-[1.2rem] border border-card-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                    {copy.noDecks}
                  </p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard className="min-w-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                  {copy.dueTitle}
                </p>
                <span className="rounded-full border border-card-border/70 bg-card/80 px-3 py-1.5 text-xs font-bold text-muted-foreground">
                  {state?.dueCards.length ?? 0}
                </span>
              </div>

              {activeCard ? (
                <MagicCard className="overflow-hidden rounded-[1.8rem]" gradientSize={200} gradientOpacity={0.72}>
                  <div className="relative rounded-[1.8rem] border border-card-border/70 bg-background/80 p-5 sm:p-6">
                    <BorderBeam size={160} duration={10} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
                    <div className="relative z-10 space-y-4">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                        <span className="rounded-full border border-card-border/70 bg-card/80 px-2.5 py-1">
                          {copy.stage} {Math.min(LAB_SRS_TOTAL_STAGES, activeCard.stage + 1)}/{LAB_SRS_TOTAL_STAGES}
                        </span>
                        <span className="rounded-full border border-card-border/70 bg-card/80 px-2.5 py-1">
                          {copy.nextReviewAt}: {formatLabDate(activeCard.nextReviewAt, language)}
                        </span>
                      </div>

                      <div className="h-1.5 overflow-hidden rounded-full bg-card-border/70">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-[#0b7d71] to-[#2f6fe4]"
                          style={{ width: `${stageProgress}%` }}
                        />
                      </div>

                      <div className="rounded-[1.3rem] border border-card-border/70 bg-card/70 px-4 py-4">
                        <p className="text-xl font-black tracking-tight text-foreground sm:text-2xl">{activeCard.term}</p>
                        {answerVisible ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-sm leading-6 text-foreground">{activeCard.meaning}</p>
                            {activeCard.example ? (
                              <p className="rounded-[0.9rem] border border-card-border/70 bg-background/75 px-3 py-2 text-xs leading-5 text-muted-foreground">
                                {activeCard.example}
                              </p>
                            ) : null}
                            {activeCard.tip ? (
                              <p className="text-xs font-semibold leading-5 text-sky-blue">{activeCard.tip}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {!answerVisible ? (
                        <button
                          type="button"
                          onClick={() => setAnswerVisible(true)}
                          className="inline-flex w-full items-center justify-center rounded-[1.1rem] border border-card-border/70 bg-card/80 px-4 py-3 text-sm font-black text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue"
                        >
                          {copy.reveal}
                        </button>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            disabled={isReviewing}
                            onClick={() => void handleReview(false)}
                            className="inline-flex items-center justify-center gap-2 rounded-[1.1rem] border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-black text-danger transition hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <X className="size-4" />
                            {isReviewing ? copy.reviewing : copy.dontKnow}
                          </button>
                          <button
                            type="button"
                            disabled={isReviewing}
                            onClick={() => void handleReview(true)}
                            className="inline-flex items-center justify-center gap-2 rounded-[1.1rem] border border-success/25 bg-success/10 px-4 py-3 text-sm font-black text-success transition hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Check className="size-4" />
                            {isReviewing ? copy.reviewing : copy.know}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </MagicCard>
              ) : (
                <p className="rounded-[1.2rem] border border-card-border/70 bg-background/70 px-4 py-4 text-sm leading-7 text-muted-foreground">
                  {copy.noDue}
                </p>
              )}

              {queuedCards.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">{copy.queueLabel}</p>
                  <ul className="space-y-2">
                    {queuedCards.map((card) => (
                      <li
                        key={card.id}
                        className="flex items-center justify-between gap-3 rounded-[1rem] border border-card-border/70 bg-background/70 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{card.term}</p>
                          <p className="text-xs text-muted-foreground">
                            {copy.stage} {Math.min(LAB_SRS_TOTAL_STAGES, card.stage + 1)}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                          {formatLabDate(card.nextReviewAt, language)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  )
}
