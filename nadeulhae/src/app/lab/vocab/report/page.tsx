"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowLeft, BarChart3, BookOpenCheck, Flame, Gauge, RefreshCcw } from "lucide-react"
import { useTheme } from "next-themes"

import { Meteors } from "@/components/magicui/meteors"
import { Particles } from "@/components/magicui/particles"
import { SectionCard, StatusMetric } from "@/components/dashboard/ui"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"

type LabReportSnapshot = {
  generatedAt: string
  periodDays: number
  totals: {
    deckCount: number
    cardCount: number
    dueCount: number
    masteredCount: number
    generatedToday: number
    reviewedToday: number
    avgDifficulty: number
    avgStabilityDays: number
    avgRetrievability: number | null
  }
  trend: Array<{
    metricDate: string
    generationCount: number
    reviewCount: number
  }>
  stateBreakdown: Array<{
    state: "new" | "learning" | "review" | "relearning"
    count: number
  }>
  deckSummaries: Array<{
    deckId: string
    title: string
    cardCount: number
    dueCount: number
    totalReviews: number
    avgDifficulty: number
    avgStabilityDays: number
  }>
  difficultCards: Array<{
    cardId: string
    deckId: string
    deckTitle: string
    term: string
    difficulty: number
    lapses: number
    stage: number
    nextReviewAt: string
  }>
}

const REPORT_COPY = {
  ko: {
    loading: "학습 보고서를 불러오는 중...",
    loginRequired: "로그인이 필요합니다. 로그인 페이지로 이동합니다.",
    disabledTitle: "실험실 기능이 꺼져 있어요.",
    disabledDescription: "대시보드 프로필 설정에서 실험실 기능을 먼저 켜 주세요.",
    goDashboard: "대시보드로 이동",
    badge: "learning report",
    title: "단어 암기 학습 보고서",
    subtitle: "복습 흐름, 카드 상태, 난이도 신호를 한 화면에서 확인할 수 있습니다.",
    periodLabel: "분석 기간",
    reload: "새로고침",
    openVocab: "암기 페이지로 이동",
    openLabHub: "실험실 허브",
    totalDecks: "총 단어장",
    totalCards: "총 카드",
    dueCards: "지금 복습 필요",
    masteredCards: "안정 단계 카드",
    reviewedToday: "오늘 복습",
    generatedToday: "오늘 생성",
    avgDifficulty: "평균 난이도",
    avgStability: "평균 안정성(일)",
    avgRetrievability: "평균 회상 확률",
    trendTitle: "복습/생성 추세",
    trendSubtitle: "일별 복습량과 생성량을 함께 봅니다.",
    reviewCount: "복습",
    generationCount: "생성",
    stateTitle: "카드 상태 분포",
    stateNew: "새 카드",
    stateLearning: "학습 중",
    stateReview: "장기 복습",
    stateRelearning: "재학습",
    deckTitle: "단어장별 요약",
    difficultTitle: "난이도 높은 카드",
    difficultSubtitle: "난이도와 재학습 횟수를 기준으로 우선 점검 카드입니다.",
    noDeckData: "보고할 단어장 데이터가 아직 없습니다.",
    noDifficult: "아직 난이도 상위 카드가 없습니다.",
    errorFallback: "학습 보고서를 불러오지 못했습니다.",
  },
  en: {
    loading: "Loading learning report...",
    loginRequired: "You need to log in first. Redirecting to login.",
    disabledTitle: "Lab is disabled.",
    disabledDescription: "Enable lab mode first from dashboard profile settings.",
    goDashboard: "Go to dashboard",
    badge: "learning report",
    title: "Vocabulary Learning Report",
    subtitle: "Review flow, card states, and difficulty signals in one view.",
    periodLabel: "Period",
    reload: "Reload",
    openVocab: "Open vocab page",
    openLabHub: "Lab hub",
    totalDecks: "Total decks",
    totalCards: "Total cards",
    dueCards: "Due now",
    masteredCards: "Stable cards",
    reviewedToday: "Reviewed today",
    generatedToday: "Generated today",
    avgDifficulty: "Avg difficulty",
    avgStability: "Avg stability (days)",
    avgRetrievability: "Avg retrievability",
    trendTitle: "Review/Generate Trend",
    trendSubtitle: "Daily review and generation volume over time.",
    reviewCount: "Review",
    generationCount: "Generate",
    stateTitle: "State Distribution",
    stateNew: "New",
    stateLearning: "Learning",
    stateReview: "Review",
    stateRelearning: "Relearning",
    deckTitle: "Deck Summary",
    difficultTitle: "High-Difficulty Cards",
    difficultSubtitle: "Priority cards by difficulty and lapse count.",
    noDeckData: "No deck data yet.",
    noDifficult: "No difficult cards yet.",
    errorFallback: "Failed to load learning report.",
  },
} as const

const PERIOD_OPTIONS = [7, 14, 30] as const

function formatMetricDate(value: string, language: "ko" | "en") {
  const parsed = new Date(`${value}T00:00:00+09:00`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(parsed)
}

export default function LabVocabReportPage() {
  const router = useRouter()
  const { user, status } = useAuth()
  const { language } = useLanguage()
  const { resolvedTheme } = useTheme()
  const copy = REPORT_COPY[language]

  const [report, setReport] = useState<LabReportSnapshot | null>(null)
  const [periodDays, setPeriodDays] = useState<(typeof PERIOD_OPTIONS)[number]>(14)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "guest") {
      const timeout = window.setTimeout(() => router.replace("/login"), 450)
      return () => window.clearTimeout(timeout)
    }
  }, [router, status])

  const loadReport = useCallback(async () => {
    if (!user?.labEnabled) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/lab/report?days=${periodDays}`, {
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
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setError(payload?.error || copy.errorFallback)
        return
      }

      const payload = (await response.json()) as { report?: LabReportSnapshot }
      setReport(payload.report ?? null)
    } catch (loadError) {
      console.error("Failed to load lab report:", loadError)
      setError(copy.errorFallback)
    } finally {
      setIsLoading(false)
    }
  }, [copy.errorFallback, language, periodDays, router, user?.labEnabled])

  useEffect(() => {
    if (status === "authenticated" && user?.labEnabled) {
      void loadReport()
    }
  }, [loadReport, status, user?.labEnabled])

  const maxTrend = useMemo(() => {
    const trend = report?.trend ?? []
    const maxReview = Math.max(1, ...trend.map((item) => item.reviewCount))
    const maxGeneration = Math.max(1, ...trend.map((item) => item.generationCount))
    return { maxReview, maxGeneration }
  }, [report?.trend])

  const particleColor = resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"

  if (status === "loading" || (status === "authenticated" && isLoading && !report)) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-center text-base font-bold text-sky-blue">
        {copy.loading}
      </main>
    )
  }

  if (status === "guest" || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-center text-base font-bold text-sky-blue">
        {copy.loginRequired}
      </main>
    )
  }

  if (!user.labEnabled) {
    return (
      <main className="min-h-screen bg-background px-4 pb-14 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <SectionCard>
            <div className="space-y-4 text-center">
              <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{copy.disabledTitle}</h1>
              <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{copy.disabledDescription}</p>
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
      <Particles className="absolute inset-0 z-0 opacity-65" quantity={42} ease={80} color={particleColor} refresh />
      <Meteors number={4} className="z-0" />

      <div className="relative z-10 mx-auto max-w-[84rem] space-y-6">
        <SectionCard>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-active-blue">
                <BarChart3 className="size-3.5" />
                {copy.badge}
              </span>
              <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">{copy.title}</h1>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{copy.subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/lab"
                className="inline-flex items-center gap-1.5 rounded-full border border-card-border/70 bg-card/70 px-3 py-2 text-xs font-black text-muted-foreground transition hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                {copy.openLabHub}
              </Link>
              <Link
                href="/lab/vocab"
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-blue/30 bg-sky-blue/10 px-3 py-2 text-xs font-black text-sky-blue transition hover:bg-sky-blue/20"
              >
                <BookOpenCheck className="size-3.5" />
                {copy.openVocab}
              </Link>
              <button
                type="button"
                onClick={() => void loadReport()}
                className="inline-flex items-center gap-1.5 rounded-full border border-card-border/70 bg-card/70 px-3 py-2 text-xs font-black text-muted-foreground transition hover:text-foreground disabled:opacity-60"
                disabled={isLoading}
              >
                <RefreshCcw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
                {copy.reload}
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{copy.periodLabel}</span>
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPeriodDays(option)}
                className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${
                  periodDays === option
                    ? "border-sky-blue/35 bg-sky-blue/12 text-sky-blue"
                    : "border-card-border/70 bg-card/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {option}d
              </button>
            ))}
          </div>
        </SectionCard>

        {error ? (
          <SectionCard>
            <div className="rounded-[1.2rem] border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              <div className="inline-flex items-center gap-2">
                <AlertTriangle className="size-4" />
                {error}
              </div>
            </div>
          </SectionCard>
        ) : null}

        {report ? (
          <>
            <SectionCard>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <StatusMetric label={copy.totalDecks} value={String(report.totals.deckCount)} compact />
                <StatusMetric label={copy.totalCards} value={String(report.totals.cardCount)} compact />
                <StatusMetric label={copy.dueCards} value={String(report.totals.dueCount)} compact />
                <StatusMetric label={copy.masteredCards} value={String(report.totals.masteredCount)} compact />
                <StatusMetric label={copy.reviewedToday} value={String(report.totals.reviewedToday)} compact />
                <StatusMetric label={copy.generatedToday} value={String(report.totals.generatedToday)} compact />
                <StatusMetric label={copy.avgDifficulty} value={report.totals.avgDifficulty.toFixed(2)} compact />
                <StatusMetric label={copy.avgStability} value={report.totals.avgStabilityDays.toFixed(1)} compact />
                <StatusMetric
                  label={copy.avgRetrievability}
                  value={report.totals.avgRetrievability == null ? "-" : `${Math.round(report.totals.avgRetrievability * 100)}%`}
                  compact
                />
              </div>
            </SectionCard>

            <SectionCard>
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-black tracking-tight text-foreground">{copy.trendTitle}</h2>
                  <p className="text-xs leading-6 text-muted-foreground">{copy.trendSubtitle}</p>
                </div>
                <div className="overflow-x-auto">
                  <div className="grid min-w-[42rem] grid-cols-2 gap-4">
                    <div className="rounded-[1.2rem] border border-card-border/70 bg-card/60 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{copy.reviewCount}</p>
                      <div className="mt-3 flex h-32 items-end gap-1.5">
                        {report.trend.map((point) => {
                          const height = Math.max(6, Math.round((point.reviewCount / maxTrend.maxReview) * 100))
                          return (
                            <div key={`${point.metricDate}-review`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                              <div className="w-full rounded-t bg-sky-blue/70 transition-all" style={{ height: `${height}%` }} />
                              <span className="text-[10px] text-muted-foreground">{formatMetricDate(point.metricDate, language)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <div className="rounded-[1.2rem] border border-card-border/70 bg-card/60 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{copy.generationCount}</p>
                      <div className="mt-3 flex h-32 items-end gap-1.5">
                        {report.trend.map((point) => {
                          const height = Math.max(6, Math.round((point.generationCount / maxTrend.maxGeneration) * 100))
                          return (
                            <div key={`${point.metricDate}-generate`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                              <div className="w-full rounded-t bg-emerald-500/65 transition-all" style={{ height: `${height}%` }} />
                              <span className="text-[10px] text-muted-foreground">{formatMetricDate(point.metricDate, language)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-3 rounded-[1.4rem] border border-card-border/70 bg-card/60 p-4">
                  <h3 className="text-base font-black tracking-tight text-foreground">{copy.stateTitle}</h3>
                  {report.stateBreakdown.map((item) => {
                    const total = Math.max(1, report.totals.cardCount)
                    const ratio = Math.round((item.count / total) * 100)
                    const label = item.state === "new"
                      ? copy.stateNew
                      : item.state === "learning"
                        ? copy.stateLearning
                        : item.state === "review"
                          ? copy.stateReview
                          : copy.stateRelearning
                    return (
                      <div key={item.state} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                          <span>{label}</span>
                          <span>{item.count} ({ratio}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-card-border/60">
                          <div className="h-full rounded-full bg-linear-to-r from-[#0b7d71] to-[#2f6fe4]" style={{ width: `${ratio}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="space-y-3 rounded-[1.4rem] border border-card-border/70 bg-card/60 p-4">
                  <h3 className="text-base font-black tracking-tight text-foreground">{copy.deckTitle}</h3>
                  {report.deckSummaries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{copy.noDeckData}</p>
                  ) : (
                    report.deckSummaries.map((deck) => (
                      <div key={deck.deckId} className="rounded-[1.1rem] border border-card-border/70 bg-background/70 px-3 py-2.5">
                        <p className="truncate text-sm font-black text-foreground">{deck.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          cards {deck.cardCount} · due {deck.dueCount} · reviews {deck.totalReviews}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          difficulty {deck.avgDifficulty.toFixed(2)} · stability {deck.avgStabilityDays.toFixed(1)}d
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-base font-black tracking-tight text-foreground">{copy.difficultTitle}</h3>
                  <p className="text-xs leading-6 text-muted-foreground">{copy.difficultSubtitle}</p>
                </div>
                {report.difficultCards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{copy.noDifficult}</p>
                ) : (
                  <div className="grid gap-2.5">
                    {report.difficultCards.map((card) => (
                      <div key={card.cardId} className="rounded-[1.15rem] border border-card-border/70 bg-card/65 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-black text-foreground">{card.term}</p>
                          <span className="rounded-full border border-danger/25 bg-danger/10 px-2.5 py-1 text-[11px] font-black text-danger">
                            <span className="inline-flex items-center gap-1">
                              <Flame className="size-3" />
                              {card.difficulty.toFixed(2)}
                            </span>
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{card.deckTitle}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-full border border-card-border/70 bg-background/70 px-2 py-1">
                            <Gauge className="size-3" />
                            stage {card.stage + 1}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-card-border/70 bg-background/70 px-2 py-1">
                            lapses {card.lapses}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-card-border/70 bg-background/70 px-2 py-1">
                            {formatMetricDate(card.nextReviewAt.slice(0, 10), language)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          </>
        ) : null}
      </div>
    </main>
  )
}
