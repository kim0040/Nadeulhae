"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowLeft, BookOpenCheck, ChartColumn, Flame, Gauge, RefreshCcw, Target, TrendingUp, Zap } from "lucide-react"
import { useTheme } from "next-themes"

import { Meteors } from "@/components/magicui/meteors"
import { Particles } from "@/components/magicui/particles"
import { SectionCard, StatusMetric } from "@/components/dashboard/ui"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"

type LabReportInsights = {
  reviewRatePercent: number
  masteryPercent: number
  lapseRatePercent: number
  activeStreakDays: number
  avgReviewsPerActiveDay: number
  estimatedClearDays: number | null
}

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
    totalReviews: number
    totalLapses: number
  }
  insights: LabReportInsights
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
    subtitle: "복습 흐름, 카드 상태, 난이도 신호를 한 화면에서 확인하세요.",
    periodLabel: "분석 기간",
    reload: "새로고침",
    openVocab: "암기 페이지로 이동",
    openLabHub: "실험실 허브",
    // Summary metrics
    totalDecks: "총 단어장",
    totalCards: "총 카드",
    dueCards: "복습 대기",
    masteredCards: "안정 카드",
    reviewedToday: "오늘 복습",
    generatedToday: "오늘 생성",
    totalReviews: "누적 복습 횟수",
    totalLapses: "누적 재학습",
    // Insights
    insightsTitle: "학습 인사이트",
    insightsSubtitle: "현재 학습 데이터를 바탕으로 계산된 핵심 지표입니다.",
    masteryRate: "마스터 비율",
    reviewRate: "장기복습 전환율",
    lapseRate: "재학습률",
    lapseRateHint: "낮을수록 좋음",
    activeStreak: "연속 학습일",
    activeStreakUnit: "일",
    avgPace: "일당 평균 복습",
    avgPaceUnit: "장/일",
    clearEstimate: "대기 소화 예상",
    clearEstimateUnit: "일",
    clearEstimateNone: "-",
    retrievability: "평균 회상 확률",
    avgDifficulty: "평균 난이도",
    avgStability: "평균 안정성",
    avgStabilityUnit: "일",
    // Trend
    trendTitle: "일별 복습·생성 추세",
    trendSubtitle: "분석 기간 내 일별 복습량과 카드 생성량을 함께 봅니다.",
    reviewCount: "복습",
    generationCount: "생성",
    // State & Deck
    stateTitle: "카드 상태 분포",
    stateNew: "새 카드",
    stateLearning: "학습 중",
    stateReview: "장기 복습",
    stateRelearning: "재학습",
    deckTitle: "단어장별 요약",
    deckCards: "카드",
    deckDue: "대기",
    deckReviews: "복습",
    deckDifficulty: "난이도",
    deckStability: "안정성",
    // Difficult
    difficultTitle: "우선 점검 카드",
    difficultSubtitle: "난이도와 재학습 횟수를 기준으로, 추가 반복이 필요한 카드입니다.",
    noDeckData: "보고할 단어장 데이터가 아직 없습니다.",
    noDifficult: "아직 난이도 상위 카드가 없습니다.",
    errorFallback: "학습 보고서를 불러오지 못했습니다.",
    stage: "단계",
    lapses: "재학습",
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
    totalReviews: "Lifetime reviews",
    totalLapses: "Lifetime lapses",
    insightsTitle: "Learning Insights",
    insightsSubtitle: "Key metrics computed from your current learning data.",
    masteryRate: "Mastery rate",
    reviewRate: "Review transition",
    lapseRate: "Lapse rate",
    lapseRateHint: "lower is better",
    activeStreak: "Active streak",
    activeStreakUnit: "days",
    avgPace: "Avg daily reviews",
    avgPaceUnit: "cards/day",
    clearEstimate: "Queue clear ETA",
    clearEstimateUnit: "days",
    clearEstimateNone: "-",
    retrievability: "Avg retrievability",
    avgDifficulty: "Avg difficulty",
    avgStability: "Avg stability",
    avgStabilityUnit: "days",
    trendTitle: "Daily Review & Generation Trend",
    trendSubtitle: "Daily review and generation activity for the selected period.",
    reviewCount: "Review",
    generationCount: "Generate",
    stateTitle: "State Distribution",
    stateNew: "New",
    stateLearning: "Learning",
    stateReview: "Review",
    stateRelearning: "Relearning",
    deckTitle: "Deck Summary",
    deckCards: "Cards",
    deckDue: "Due",
    deckReviews: "Reviews",
    deckDifficulty: "Difficulty",
    deckStability: "Stability",
    difficultTitle: "Priority Review Cards",
    difficultSubtitle: "Cards needing extra attention based on difficulty and lapse count.",
    noDeckData: "No deck data yet.",
    noDifficult: "No difficult cards yet.",
    errorFallback: "Failed to load learning report.",
    stage: "Stage",
    lapses: "Lapses",
  },
  zh: {
    loading: "正在加载学习报告...",
    loginRequired: "请先登录。正在跳转到登录页面。",
    disabledTitle: "实验室功能未开启。",
    disabledDescription: "请先在仪表盘个人设置中启用实验室功能。",
    goDashboard: "前往仪表盘",
    badge: "学习报告",
    title: "单词学习报告",
    subtitle: "在一屏中查看复习趋势、卡片状态和难度信号。",
    periodLabel: "分析期间",
    reload: "刷新",
    openVocab: "打开记忆页面",
    openLabHub: "实验室中心",
    totalDecks: "总词库",
    totalCards: "总卡片",
    dueCards: "待复习",
    masteredCards: "稳定卡片",
    reviewedToday: "今日复习",
    generatedToday: "今日生成",
    totalReviews: "累计复习次数",
    totalLapses: "累计重学次数",
    insightsTitle: "学习洞察",
    insightsSubtitle: "基于当前学习数据计算的核心指标。",
    masteryRate: "掌握率",
    reviewRate: "长期复习转化率",
    lapseRate: "重学率",
    lapseRateHint: "越低越好",
    activeStreak: "连续学习",
    activeStreakUnit: "天",
    avgPace: "日均复习",
    avgPaceUnit: "张/天",
    clearEstimate: "预计清空",
    clearEstimateUnit: "天",
    clearEstimateNone: "-",
    retrievability: "平均回忆概率",
    avgDifficulty: "平均难度",
    avgStability: "平均稳定性",
    avgStabilityUnit: "天",
    trendTitle: "每日复习与生成趋势",
    trendSubtitle: "分析期间内的每日复习量和生成量。",
    reviewCount: "复习",
    generationCount: "生成",
    stateTitle: "卡片状态分布",
    stateNew: "新卡片",
    stateLearning: "学习中",
    stateReview: "长期复习",
    stateRelearning: "重学中",
    deckTitle: "词库摘要",
    deckCards: "卡片",
    deckDue: "待复习",
    deckReviews: "复习",
    deckDifficulty: "难度",
    deckStability: "稳定性",
    difficultTitle: "优先检查卡片",
    difficultSubtitle: "基于难度和重学次数需要额外关注的卡片。",
    noDeckData: "暂无词库数据。",
    noDifficult: "暂无高难度卡片。",
    errorFallback: "无法加载学习报告。",
    stage: "阶段",
    lapses: "重学",
  },
  ja: {
    loading: "学習レポートを読み込み中...",
    loginRequired: "ログインが必要です。ログインページに移動します。",
    disabledTitle: "ラボ機能が無効です。",
    disabledDescription: "ダッシュボードのプロフィール設定からラボ機能を有効にしてください。",
    goDashboard: "ダッシュボードへ",
    badge: "学習レポート",
    title: "単語学習レポート",
    subtitle: "復習の流れ、カード状態、難易度のシグナルを一画面で確認できます。",
    periodLabel: "分析期間",
    reload: "リロード",
    openVocab: "暗記ページへ",
    openLabHub: "ラボハブ",
    totalDecks: "総デッキ数",
    totalCards: "総カード数",
    dueCards: "復習待ち",
    masteredCards: "安定カード",
    reviewedToday: "今日の復習",
    generatedToday: "今日の生成",
    totalReviews: "累計復習回数",
    totalLapses: "累計再学習",
    insightsTitle: "学習インサイト",
    insightsSubtitle: "現在の学習データから計算された主要指標です。",
    masteryRate: "習得率",
    reviewRate: "長期復習転換率",
    lapseRate: "再学習率",
    lapseRateHint: "低いほど良い",
    activeStreak: "連続学習日",
    activeStreakUnit: "日",
    avgPace: "1日平均復習",
    avgPaceUnit: "枚/日",
    clearEstimate: "消化予想",
    clearEstimateUnit: "日",
    clearEstimateNone: "-",
    retrievability: "平均想起確率",
    avgDifficulty: "平均難易度",
    avgStability: "平均安定性",
    avgStabilityUnit: "日",
    trendTitle: "日別復習・生成傾向",
    trendSubtitle: "分析期間内の日別復習量とカード生成量を表示します。",
    reviewCount: "復習",
    generationCount: "生成",
    stateTitle: "カード状態分布",
    stateNew: "新規",
    stateLearning: "学習中",
    stateReview: "長期復習",
    stateRelearning: "再学習",
    deckTitle: "デッキ別サマリー",
    deckCards: "カード",
    deckDue: "待機",
    deckReviews: "復習",
    deckDifficulty: "難易度",
    deckStability: "安定性",
    difficultTitle: "優先チェックカード",
    difficultSubtitle: "難易度と再学習回数に基づき、追加の反復が必要なカードです。",
    noDeckData: "報告するデッキデータがまだありません。",
    noDifficult: "高難易度のカードはまだありません。",
    errorFallback: "学習レポートの読み込みに失敗しました。",
    stage: "段階",
    lapses: "再学習",
  },
} as const

const PERIOD_OPTIONS = [7, 14, 30] as const

function formatMetricDate(value: string, language: string) {
  const parsed = new Date(`${value}T00:00:00+09:00`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  const localeMap: Record<string, string> = { ko: "ko-KR", en: "en-US", zh: "zh-CN", ja: "ja-JP" }
  return new Intl.DateTimeFormat(localeMap[language] ?? "en-US", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(parsed)
}

function InsightCard({
  icon,
  label,
  value,
  unit,
  accent = false,
  warn = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit?: string
  accent?: boolean
  warn?: boolean
}) {
  return (
    <div className="flex items-start gap-3 rounded-[1.2rem] border border-card-border/70 bg-card/50 p-3.5">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
        warn
          ? "border border-amber-400/30 bg-amber-500/10 text-amber-400"
          : accent
            ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-400"
            : "border border-sky-blue/25 bg-sky-blue/10 text-sky-blue"
      }`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xl font-black tracking-tight text-foreground">
          {value}
          {unit ? <span className="ml-1 text-xs font-bold text-muted-foreground">{unit}</span> : null}
        </p>
      </div>
    </div>
  )
}

export default function LabVocabReportPage() {
  const router = useRouter()
  const { user, status } = useAuth()
  const { language } = useLanguage()
  const { resolvedTheme } = useTheme()
  const copy = ((REPORT_COPY as any)[language] ?? REPORT_COPY.ko)

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
        {/* Header */}
        <SectionCard>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-active-blue">
                <ChartColumn className="size-3.5" />
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
            {/* Summary KPIs */}
            <SectionCard>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatusMetric label={copy.totalDecks} value={String(report.totals.deckCount)} compact />
                <StatusMetric label={copy.totalCards} value={String(report.totals.cardCount)} compact />
                <StatusMetric label={copy.dueCards} value={String(report.totals.dueCount)} compact />
                <StatusMetric label={copy.masteredCards} value={String(report.totals.masteredCount)} compact />
                <StatusMetric label={copy.reviewedToday} value={String(report.totals.reviewedToday)} compact />
                <StatusMetric label={copy.generatedToday} value={String(report.totals.generatedToday)} compact />
                <StatusMetric label={copy.totalReviews} value={String(report.totals.totalReviews)} compact />
                <StatusMetric label={copy.totalLapses} value={String(report.totals.totalLapses)} compact />
              </div>
            </SectionCard>

            {/* Learning Insights */}
            <SectionCard>
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-black tracking-tight text-foreground">{copy.insightsTitle}</h2>
                  <p className="text-xs leading-6 text-muted-foreground">{copy.insightsSubtitle}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <InsightCard
                    icon={<Target className="size-4" />}
                    label={copy.masteryRate}
                    value={`${report.insights.masteryPercent}%`}
                    accent={report.insights.masteryPercent >= 50}
                  />
                  <InsightCard
                    icon={<TrendingUp className="size-4" />}
                    label={copy.reviewRate}
                    value={`${report.insights.reviewRatePercent}%`}
                  />
                  <InsightCard
                    icon={<AlertTriangle className="size-3.5" />}
                    label={`${copy.lapseRate} (${copy.lapseRateHint})`}
                    value={`${report.insights.lapseRatePercent}%`}
                    warn={report.insights.lapseRatePercent > 20}
                  />
                  <InsightCard
                    icon={<Flame className="size-4" />}
                    label={copy.activeStreak}
                    value={String(report.insights.activeStreakDays)}
                    unit={copy.activeStreakUnit}
                    accent={report.insights.activeStreakDays >= 3}
                  />
                  <InsightCard
                    icon={<Zap className="size-4" />}
                    label={copy.avgPace}
                    value={String(report.insights.avgReviewsPerActiveDay)}
                    unit={copy.avgPaceUnit}
                  />
                  <InsightCard
                    icon={<Gauge className="size-4" />}
                    label={copy.clearEstimate}
                    value={report.insights.estimatedClearDays != null ? String(report.insights.estimatedClearDays) : copy.clearEstimateNone}
                    unit={report.insights.estimatedClearDays != null ? copy.clearEstimateUnit : undefined}
                  />
                </div>
                {/* Additional raw metrics */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatusMetric
                    label={copy.retrievability}
                    value={report.totals.avgRetrievability == null ? "-" : `${Math.round(report.totals.avgRetrievability * 100)}%`}
                    compact
                  />
                  <StatusMetric label={copy.avgDifficulty} value={report.totals.avgDifficulty.toFixed(1)} meta="/10" compact />
                  <StatusMetric label={copy.avgStability} value={report.totals.avgStabilityDays.toFixed(1)} meta={copy.avgStabilityUnit} compact />
                </div>
              </div>
            </SectionCard>

            {/* Trend Charts */}
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
                            <div key={`${point.metricDate}-review`} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${point.reviewCount}`}>
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
                            <div key={`${point.metricDate}-generate`} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${point.generationCount}`}>
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

            {/* State Distribution + Deck Summary */}
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

                    const barColor = item.state === "new"
                      ? "from-slate-400 to-slate-500"
                      : item.state === "learning"
                        ? "from-amber-400 to-amber-500"
                        : item.state === "review"
                          ? "from-[#0b7d71] to-[#2f6fe4]"
                          : "from-rose-400 to-rose-500"
                    return (
                      <div key={item.state} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                          <span>{label}</span>
                          <span>{item.count} ({ratio}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-card-border/60">
                          <div className={`h-full rounded-full bg-linear-to-r ${barColor}`} style={{ width: `${ratio}%` }} />
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
                    report.deckSummaries.map((deck) => {
                      const deckMasteryPercent = deck.cardCount > 0
                        ? Math.round(((deck.cardCount - deck.dueCount) / deck.cardCount) * 100)
                        : 0
                      return (
                        <div key={deck.deckId} className="rounded-[1.1rem] border border-card-border/70 bg-background/70 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-black text-foreground">{deck.title}</p>
                            <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-400">
                              {deckMasteryPercent}%
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span>{copy.deckCards} {deck.cardCount}</span>
                            <span>{copy.deckDue} {deck.dueCount}</span>
                            <span>{copy.deckReviews} {deck.totalReviews}</span>
                            <span>{copy.deckDifficulty} {deck.avgDifficulty.toFixed(1)}</span>
                            <span>{copy.deckStability} {deck.avgStabilityDays.toFixed(1)}d</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Difficult Cards */}
            <SectionCard>
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-base font-black tracking-tight text-foreground">{copy.difficultTitle}</h3>
                  <p className="text-xs leading-6 text-muted-foreground">{copy.difficultSubtitle}</p>
                </div>
                {report.difficultCards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{copy.noDifficult}</p>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {report.difficultCards.map((card) => (
                      <div key={card.cardId} className="rounded-[1.15rem] border border-card-border/70 bg-card/65 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-black text-foreground">{card.term}</p>
                          <span className="rounded-full border border-danger/25 bg-danger/10 px-2.5 py-1 text-[11px] font-black text-danger">
                            <span className="inline-flex items-center gap-1">
                              <Flame className="size-3" />
                              {card.difficulty.toFixed(1)}
                            </span>
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{card.deckTitle}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-full border border-card-border/70 bg-background/70 px-2 py-1">
                            <Gauge className="size-3" />
                            {copy.stage} {card.stage + 1}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-card-border/70 bg-background/70 px-2 py-1">
                            {copy.lapses} {card.lapses}
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
