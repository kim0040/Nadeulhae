"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Newspaper,
  Sparkles,
  Sun,
  PartyPopper,
  ArrowUpRight,
  Loader2,
  Tag,
  RefreshCw,
  AlertTriangle,
  Info,
} from "lucide-react"

import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text"

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface NewsItem {
  title: string
  url: string
  source: string
  snippet: string
  publishedDate: string | null
}

interface BriefingData {
  briefingDate: string
  headline: string
  summary: string
  newsItems: NewsItem[]
  aiInsight: string | null
  weatherNote: string | null
  festivalNote: string | null
  keywordTags: string[]
  fromCache: boolean
  modelUsed: string | null
}

type FetchStatus = "idle" | "loading" | "success" | "error" | "empty"

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const RETRY_MAX = 3
const RETRY_DELAY_MS = 1000

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

interface JeonjuDailyBriefingProps {
  language: "ko" | "en"
}

export function JeonjuDailyBriefing({ language }: JeonjuDailyBriefingProps) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [status, setStatus] = useState<FetchStatus>("idle")
  const [retryCount, setRetryCount] = useState(0)

  // --- i18n ---
  const t = useI18n(language)

  // --- Fetch logic ---
  const fetchBriefing = useCallback(
    async (force = false) => {
      setStatus("loading")

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 25000)

        const res = await fetch(
          `/api/jeonju/briefing?locale=${language}${force ? "&force=true" : ""}`,
          { signal: controller.signal }
        )
        clearTimeout(timeout)

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const json = await res.json()

        if (!json.success || !json.data) {
          throw new Error(json.error || "Invalid response")
        }

        const data: BriefingData = {
          ...json.data,
          fromCache: json.fromCache ?? false,
        }

        setBriefing(data)
        setRetryCount(0)

        // If data looks like a fallback (empty news items + no AI insight), mark as "empty"
        const isEmptyFallback =
          data.newsItems.length === 0 &&
          !data.aiInsight &&
          !data.weatherNote &&
          !data.festivalNote

        setStatus(isEmptyFallback ? "empty" : "success")
      } catch (err) {
        console.error("[JeonjuDailyBriefing] Fetch failed:", err)

        if (retryCount < RETRY_MAX) {
          setRetryCount((c) => c + 1)
          setTimeout(() => fetchBriefing(force), RETRY_DELAY_MS * (retryCount + 1))
          return
        }

        setStatus("error")
      }
    },
    [language, retryCount]
  )

  useEffect(() => {
    fetchBriefing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  const handleRefresh = useCallback(() => {
    setRetryCount(0)
    fetchBriefing(true)
  }, [fetchBriefing])

  // --- Renders ---

  if (status === "idle" || status === "loading") {
    return (
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-card-border bg-card p-8 sm:p-12">
          <div className="flex items-center justify-center gap-3 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-sky-blue" />
            <span className="text-base font-black text-muted-foreground">{t.loading}</span>
          </div>
        </div>
      </section>
    )
  }

  if (status === "error" && !briefing) {
    return (
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-card-border bg-card p-8 sm:p-12">
          <div className="text-center py-12">
            <AlertTriangle className="mx-auto h-12 w-12 text-orange-400 mb-4" />
            <p className="text-lg font-black text-muted-foreground">{t.error}</p>
            <p className="mt-2 text-sm font-bold text-muted-foreground/70">{t.errorSub}</p>
            <button
              onClick={handleRefresh}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-sky-blue/20 bg-sky-blue/10 px-5 py-2.5 text-sm font-black text-sky-blue hover:bg-sky-blue/20 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              {t.retry}
            </button>
          </div>
        </div>
      </section>
    )
  }

  // Safety: should not happen, but guard anyway
  if (!briefing) return null

  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      {/* Header */}
      <div className="mb-8 max-w-4xl">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="inline-flex rounded-full border border-nature-green/20 bg-nature-green/10 px-5 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-nature-green">
            <Sparkles size={12} className="mr-1.5" />
            {t.aiLabel}
          </div>
          {briefing.fromCache && (
            <div className="inline-flex rounded-full border border-card-border/60 bg-card/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
              {t.fromCache}
            </div>
          )}
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 rounded-full border border-card-border/60 bg-card/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
            aria-label={t.retry}
          >
            <RefreshCw className="h-3 w-3" />
            {t.refresh}
          </button>
        </div>
        <AnimatedGradientText
          className="text-3xl sm:text-5xl font-black tracking-tight"
          colorFrom="#0b7d71"
          colorTo="#2f6fe4"
          speed={1.2}
        >
          {t.sectionTitle}
        </AnimatedGradientText>
        <p className="mt-4 text-base sm:text-lg font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400">
          {t.sectionDesc}
        </p>
      </div>

      {/* Main Briefing Card */}
      <div className="rounded-[2rem] border border-[var(--interactive-border)] bg-[var(--interactive)] overflow-hidden">
        {/* Headline Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-nature-green/10 to-sky-blue/10 px-6 py-8 sm:px-10 sm:py-10">
          <div className="absolute top-0 right-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none select-none">
            <span className="text-[8rem] font-black tracking-tighter leading-none">
              {language === "ko" ? "전" : "J"}
            </span>
          </div>
          <div className="relative z-10">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground mb-3">
              {briefing.briefingDate}
            </div>
            <h3 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground break-keep">
              {briefing.headline}
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-10">
          {/* Summary */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground mb-3">
              <Newspaper size={14} className="text-sky-blue" />
              {t.summaryLabel}
            </div>
            <p className="text-base sm:text-lg font-bold leading-relaxed text-foreground break-keep">
              {briefing.summary}
            </p>
          </div>

          {/* Quick Notes Row */}
          {(briefing.weatherNote || briefing.festivalNote) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {briefing.weatherNote && (
                <div className="rounded-[1.4rem] border border-card-border bg-card px-5 py-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-muted-foreground mb-2">
                    <Sun size={12} className="text-orange-400" />
                    {t.weatherLabel}
                  </div>
                  <p className="text-sm sm:text-base font-bold text-foreground break-keep">
                    {briefing.weatherNote}
                  </p>
                </div>
              )}
              {briefing.festivalNote && (
                <div className="rounded-[1.4rem] border border-card-border bg-card px-5 py-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-muted-foreground mb-2">
                    <PartyPopper size={12} className="text-pink-400" />
                    {t.festivalLabel}
                  </div>
                  <p className="text-sm sm:text-base font-bold text-foreground break-keep">
                    {briefing.festivalNote}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* AI Insight */}
          {briefing.aiInsight && (
            <div className="mb-8 rounded-[1.4rem] border border-nature-green/20 bg-nature-green/5 px-5 py-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-nature-green mb-2">
                <Sparkles size={12} />
                {t.insightLabel}
              </div>
              <p className="text-sm sm:text-base font-bold text-foreground italic break-keep">
                &ldquo;{briefing.aiInsight}&rdquo;
              </p>
            </div>
          )}

          {/* Empty-state hint when no news items */}
          {briefing.newsItems.length === 0 && status === "empty" && (
            <div className="mb-8 rounded-[1.4rem] border border-orange-500/20 bg-orange-500/5 px-5 py-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-orange-600 dark:text-orange-300 mb-2">
                <Info size={12} />
                {t.noNewsInfo}
              </div>
              <p className="text-sm sm:text-base font-bold text-foreground break-keep">
                {t.noNewsDesc}
              </p>
            </div>
          )}

          {/* News Items */}
          {briefing.newsItems.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground mb-4">
                <Newspaper size={14} className="text-active-blue" />
                {t.newsLabel}
              </div>
              <div className="grid grid-cols-1 gap-3">
                {briefing.newsItems.map((item, index) => (
                  <a
                    key={`${item.url}-${index}`}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-4 rounded-[1.2rem] border border-card-border bg-card px-5 py-4 hover:border-sky-blue/30 hover:bg-sky-blue/5 transition-all duration-300"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-card-border bg-background text-xs font-black text-muted-foreground group-hover:border-sky-blue/30 group-hover:text-sky-blue transition-colors">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground px-2 py-0.5 rounded-full bg-background border border-card-border">
                          {item.source || t.link}
                        </span>
                        {item.publishedDate && (
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {item.publishedDate}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm sm:text-base font-black text-foreground group-hover:text-sky-blue transition-colors break-keep leading-snug">
                        {item.title}
                      </h4>
                      {item.snippet && (
                        <p className="mt-1 text-xs sm:text-sm font-bold text-muted-foreground break-keep">
                          {item.snippet}
                        </p>
                      )}
                    </div>
                    <ArrowUpRight
                      size={16}
                      className="shrink-0 mt-1 text-muted-foreground group-hover:text-sky-blue transition-colors opacity-0 group-hover:opacity-100"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {briefing.keywordTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Tag size={12} className="text-muted-foreground mr-1" />
              {briefing.keywordTags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex rounded-full border border-card-border/60 bg-card/60 px-3 py-1.5 text-[11px] font-black tracking-wide text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors cursor-default"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------
// i18n
// ------------------------------------------------------------------

function useI18n(language: "ko" | "en") {
  if (language === "ko") {
    return {
      sectionTitle: "어제의 전주 소식",
      sectionDesc: "매일 1회 수집한 어제 소식을 요약하고, 오늘 바로 필요한 체크포인트까지 함께 안내해요.",
      aiLabel: "나들AI 브리핑",
      summaryLabel: "요약",
      newsLabel: "관련 소식",
      insightLabel: "나들AI의 한마디",
      weatherLabel: "날씨",
      festivalLabel: "행사",
      loading: "브리핑 준비 중...",
      error: "일시적으로 불러올 수 없어요",
      errorSub: "잠시 후 다시 시도해 주세요.",
      retry: "다시 시도",
      refresh: "갱신",
      fromCache: "캐시된 데이터",
      link: "링크",
      noNewsInfo: "새로운 소식을 모으는 중이에요",
      noNewsDesc: "전주의 아름다운 소식이 곧 전해질 예정이에요. 그동안 한옥마을 산책 어떠세요?",
    }
  }

  return {
    sectionTitle: "Yesterday's Jeonju News",
    sectionDesc: "Collected once per day: yesterday's verified updates plus practical check points for today.",
    aiLabel: "NadeulAI Briefing",
    summaryLabel: "Summary",
    newsLabel: "Related News",
    insightLabel: "NadeulAI's Tip",
    weatherLabel: "Weather",
    festivalLabel: "Events",
    loading: "Preparing briefing...",
    error: "Temporarily unavailable",
    errorSub: "Please try again in a moment.",
    retry: "Retry",
    refresh: "Refresh",
    fromCache: "Cached data",
    link: "Link",
    noNewsInfo: "Gathering fresh news",
    noNewsDesc: "Beautiful news about Jeonju will be delivered soon. In the meantime, how about a walk in Hanok Village?",
  }
}
