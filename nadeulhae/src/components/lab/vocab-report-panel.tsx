"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Flame, Gauge, RefreshCcw } from "lucide-react"

import { SectionCard, StatusMetric } from "@/components/dashboard/ui"
import { useLanguage } from "@/context/LanguageContext"
import type { LabReportSnapshot } from "@/lib/lab/types"

const REPORT_COPY = {
  ko: {
    periodLabel: "분석 기간",
    reload: "새로고침",
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
    loading: "학습 보고서를 불러오는 중...",
  },
  en: {
    periodLabel: "Period",
    reload: "Reload",
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
    loading: "Loading learning report...",
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

export function VocabReportPanel() {
  const { language } = useLanguage()
  const copy = REPORT_COPY[language]

  const [report, setReport] = useState<LabReportSnapshot | null>(null)
  const [periodDays, setPeriodDays] = useState<(typeof PERIOD_OPTIONS)[number]>(14)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadReport = useCallback(async () => {
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
  }, [copy.errorFallback, language, periodDays])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  const maxTrend = useMemo(() => {
    const maxReview = Math.max(1, ...(report?.trend.map((item) => item.reviewCount) ?? [0]))
    const maxGeneration = Math.max(1, ...(report?.trend.map((item) => item.generationCount) ?? [0]))
    return { maxReview, maxGeneration }
  }, [report?.trend])
  const trendColumnCount = report?.trend.length ?? 0
  const trendMinWidth = useMemo(() => Math.max(320, trendColumnCount * 28), [trendColumnCount])

  if (isLoading && !report && !error) {
    return (
      <SectionCard className="min-w-0">
        <p className="text-base font-bold text-sky-blue">{copy.loading}</p>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-5">
      <SectionCard className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-base font-semibold text-muted-foreground">{copy.periodLabel}</span>
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPeriodDays(option)}
                className={`rounded-full border px-3.5 py-1.5 text-base font-black transition ${
                  periodDays === option
                    ? "border-sky-blue/35 bg-sky-blue/12 text-sky-blue"
                    : "border-card-border/70 bg-card/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {option}d
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void loadReport()}
            className="inline-flex items-center gap-1.5 rounded-full border border-card-border/70 bg-card/70 px-3.5 py-2 text-base font-black text-muted-foreground transition hover:text-foreground disabled:opacity-60"
            disabled={isLoading}
          >
            <RefreshCcw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            {copy.reload}
          </button>
        </div>
      </SectionCard>

      {error ? (
        <SectionCard className="min-w-0">
          <div className="rounded-[1.2rem] border border-danger/25 bg-danger/10 px-4 py-3 text-base font-semibold text-danger">
            <div className="inline-flex items-center gap-2">
              <AlertTriangle className="size-4" />
              {error}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {report ? (
        <>
          <SectionCard className="min-w-0">
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-5">
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

          <SectionCard className="min-w-0">
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{copy.trendTitle}</h2>
                <p className="text-base leading-8 text-muted-foreground">{copy.trendSubtitle}</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.2rem] border border-card-border/70 bg-card/60 p-4">
                  <p className="text-base font-black uppercase tracking-[0.2em] text-muted-foreground">{copy.reviewCount}</p>
                  <div className="mt-3 overflow-x-auto pb-1">
                    <div
                      className="grid h-36 items-end gap-1.5"
                      style={{
                        minWidth: `${trendMinWidth}px`,
                        gridTemplateColumns: `repeat(${Math.max(1, trendColumnCount)}, minmax(0, 1fr))`,
                      }}
                    >
                      {report.trend.map((point) => {
                        const height = Math.max(6, Math.round((point.reviewCount / maxTrend.maxReview) * 100))
                        return (
                          <div key={`${point.metricDate}-review`} className="flex min-w-0 flex-col items-center gap-1">
                            <div className="w-full rounded-t bg-sky-blue/70 transition-all" style={{ height: `${height}%` }} />
                            <span className="text-[10px] text-muted-foreground">{formatMetricDate(point.metricDate, language)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.2rem] border border-card-border/70 bg-card/60 p-4">
                  <p className="text-base font-black uppercase tracking-[0.2em] text-muted-foreground">{copy.generationCount}</p>
                  <div className="mt-3 overflow-x-auto pb-1">
                    <div
                      className="grid h-36 items-end gap-1.5"
                      style={{
                        minWidth: `${trendMinWidth}px`,
                        gridTemplateColumns: `repeat(${Math.max(1, trendColumnCount)}, minmax(0, 1fr))`,
                      }}
                    >
                      {report.trend.map((point) => {
                        const height = Math.max(6, Math.round((point.generationCount / maxTrend.maxGeneration) * 100))
                        return (
                          <div key={`${point.metricDate}-generate`} className="flex min-w-0 flex-col items-center gap-1">
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

          <SectionCard className="min-w-0">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-3 rounded-[1.4rem] border border-card-border/70 bg-card/60 p-4">
                <h3 className="text-xl font-black tracking-tight text-foreground">{copy.stateTitle}</h3>
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
                      <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
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
                <h3 className="text-xl font-black tracking-tight text-foreground">{copy.deckTitle}</h3>
                {report.deckSummaries.length === 0 ? (
                  <p className="text-base text-muted-foreground">{copy.noDeckData}</p>
                ) : (
                  report.deckSummaries.map((deck) => (
                    <div key={deck.deckId} className="rounded-[1.1rem] border border-card-border/70 bg-background/70 px-3 py-2.5">
                      <p className="truncate text-lg font-black text-foreground">{deck.title}</p>
                      <p className="mt-1 text-base text-muted-foreground">
                        cards {deck.cardCount} · due {deck.dueCount} · reviews {deck.totalReviews}
                      </p>
                      <p className="mt-1 text-base text-muted-foreground">
                        difficulty {deck.avgDifficulty.toFixed(2)} · stability {deck.avgStabilityDays.toFixed(1)}d
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard className="min-w-0">
            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-xl font-black tracking-tight text-foreground">{copy.difficultTitle}</h3>
                <p className="text-base leading-8 text-muted-foreground">{copy.difficultSubtitle}</p>
              </div>
              {report.difficultCards.length === 0 ? (
                <p className="text-base text-muted-foreground">{copy.noDifficult}</p>
              ) : (
                <div className="grid gap-2.5">
                  {report.difficultCards.map((card) => (
                    <div key={card.cardId} className="rounded-[1.15rem] border border-card-border/70 bg-card/65 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-lg font-black text-foreground">{card.term}</p>
                        <span className="rounded-full border border-danger/25 bg-danger/10 px-2.5 py-1 text-[11px] font-black text-danger">
                          <span className="inline-flex items-center gap-1">
                            <Flame className="size-3" />
                            {card.difficulty.toFixed(2)}
                          </span>
                        </span>
                      </div>
                      <p className="mt-1 text-base text-muted-foreground">{card.deckTitle}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
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
  )
}
