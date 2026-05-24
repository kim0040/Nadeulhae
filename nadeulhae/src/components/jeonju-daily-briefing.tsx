"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import {
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  Sun,
  PartyPopper,
  Newspaper,
  Lightbulb,
} from "lucide-react"
import { motion } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"

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

type FetchStatus = "idle" | "loading" | "success" | "error"

// ------------------------------------------------------------------
// Cache helpers (localStorage, 1 day TTL)
// ------------------------------------------------------------------

const CACHE_PREFIX = "nadeul:briefing:v5"

function getKstDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === "year")?.value ?? "0000"
  const m = parts.find((p) => p.type === "month")?.value ?? "00"
  const d = parts.find((p) => p.type === "day")?.value ?? "00"
  return `${y}-${m}-${d}`
}

function getCacheKey(lang: string) {
  return `${CACHE_PREFIX}:${lang}:${getKstDateKey()}`
}

function readCache(lang: string): BriefingData | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(getCacheKey(lang))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data: BriefingData; exp: number }
    if (parsed.exp <= Date.now()) {
      localStorage.removeItem(getCacheKey(lang))
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

function writeCache(lang: string, data: BriefingData) {
  if (typeof window === "undefined") return
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === "year")?.value ?? "0000"
  const m = parts.find((p) => p.type === "month")?.value ?? "00"
  const d = parts.find((p) => p.type === "day")?.value ?? "00"
  const todayMidnight = new Date(`${y}-${m}-${d}T00:00:00+09:00`)
  const nextMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000)
  const exp = Math.max(Date.now() + 10 * 60 * 1000, nextMidnight.getTime())
  localStorage.setItem(getCacheKey(lang), JSON.stringify({ data, exp }))
}

function formatDate(date: string, lang: string) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  const locale = lang === "ko" ? "ko-KR" : lang === "zh" ? "zh-CN" : lang === "ja" ? "ja-JP" : "en-US"
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  })
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

interface JeonjuDailyBriefingProps {
  language: string | "zh" | "ja"
}

export function JeonjuDailyBriefing({ language }: JeonjuDailyBriefingProps) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [status, setStatus] = useState<FetchStatus>("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fetchingRef = useRef(false)

  const t = language === "ko" ? KO : language === "zh" ? ZH : language === "ja" ? JA : EN

  const fetchBriefing = useCallback(
    async (force = false, attempt = 0) => {
      if (fetchingRef.current) return
      fetchingRef.current = true

      if (!briefing) setStatus("loading")
      setErrorMsg(null)

      try {
        const controller = new AbortController()
        const timer = window.setTimeout(() => controller.abort(), 90000)

        const params = new URLSearchParams({ locale: language })
        if (force) params.set("force", "true")

        const res = await fetch(`/api/jeonju/briefing?${params}`, {
          signal: controller.signal,
        })
        window.clearTimeout(timer)

        if (!res.ok) {
          let msg = `HTTP ${res.status}`
          try {
            const body = (await res.json()) as { error?: string }
            if (body.error) msg = body.error
          } catch { /* ignore */ }
          throw new Error(msg)
        }

        const json = await res.json()
        if (!json.success || !json.data) throw new Error(json.error || "Invalid response")

        const data: BriefingData = { ...json.data, fromCache: json.fromCache ?? false }
        writeCache(language, data)
        setBriefing(data)
        setStatus("success")
      } catch (err) {
        // Aborted requests are expected when the component unmounts or timeout fires
        if (err instanceof DOMException && err.name === "AbortError") {
          if (attempt < 2) {
            fetchingRef.current = false
            setTimeout(() => fetchBriefing(force, attempt + 1), 2000)
            return
          }
          setErrorMsg(t.errorSub)
          setStatus("error")
          fetchingRef.current = false
          return
        }
        console.error("[JeonjuBriefing] fetch failed:", err)
        if (attempt < 2) {
          fetchingRef.current = false
          setTimeout(() => fetchBriefing(force, attempt + 1), 1500 * (attempt + 1))
          return
        }
        setErrorMsg(err instanceof Error ? err.message : t.errorSub)
        setStatus("error")
      } finally {
        fetchingRef.current = false
      }
    },
    [briefing, language, t.errorSub],
  )

  useEffect(() => {
    const cached = readCache(language)
    if (cached) {
      setBriefing(cached)
      setStatus("success")
      return
    }
    fetchBriefing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  // ---- Loading ----
  if (status === "idle" || status === "loading") {
    return (
      <div className="rounded-[2.5rem] border border-[var(--interactive-border)] bg-[var(--interactive)] p-8 sm:p-12 space-y-8">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 w-full">
            <Skeleton className="size-12 rounded-2xl shrink-0" />
            <div className="space-y-2 w-full max-w-md">
              <Skeleton className="h-8 w-3/4 rounded-xl" />
              <Skeleton className="h-4 w-1/3 rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-10 w-28 rounded-xl shrink-0" />
        </div>

        {/* AI Summary Box Skeleton */}
        <div className="rounded-[1.85rem] border border-[var(--interactive-border)] bg-[var(--interactive)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-3 w-24 rounded-md" />
          </div>
          <Skeleton className="h-24 w-full rounded-[1.4rem]" />
        </div>

        {/* AI Tips Skeleton */}
        <div className="rounded-[1.85rem] border border-nature-green/20 bg-nature-green/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-md" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded-[1.4rem]" />
            <Skeleton className="h-12 w-full rounded-[1.4rem]" />
          </div>
        </div>

        {/* Weather / Events Grid Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton className="h-28 rounded-[1.45rem]" />
          <Skeleton className="h-28 rounded-[1.45rem]" />
        </div>

        {/* News Sources Skeleton */}
        <div className="rounded-[1.85rem] border border-[var(--interactive-border)] bg-[var(--interactive)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-3 w-24 rounded-md" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-[1.4rem]" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ---- Error (no data at all) ----
  if (status === "error" && !briefing) {
    return (
      <div className="rounded-[2.5rem] border border-[var(--interactive-border)] bg-[var(--interactive)] p-8 sm:p-12 text-center">
        <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-orange-400" />
        <p className="text-base font-black text-muted-foreground break-words">{t.error}</p>
        <p className="mt-2 text-sm font-bold text-muted-foreground/70 break-words">{errorMsg || t.errorSub}</p>
        <button
          onClick={() => fetchBriefing(false)}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-sky-blue/20 bg-sky-blue/10 px-5 py-2.5 text-sm font-black text-sky-blue hover:bg-sky-blue/20 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          {t.retry}
        </button>
      </div>
    )
  }

  if (!briefing) return null

  const dateLabel = formatDate(briefing.briefingDate, language)
  const sourceCount = new Set(briefing.newsItems.map((n) => n.source).filter(Boolean)).size

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="group relative rounded-[2.5rem] border border-sky-blue/15 bg-gradient-to-b from-white/10 to-white/5 dark:from-neutral-900/40 dark:to-neutral-950/60 p-8 sm:p-12 pb-6 shadow-[0_24px_80px_rgba(0,0,0,0.06)] hover:shadow-[0_24px_80px_rgba(14,165,233,0.08)] backdrop-blur-xl transition-all duration-500"
    >
      {/* Background radial highlight */}
      <div className="absolute top-0 right-0 -z-10 h-72 w-72 rounded-full bg-sky-blue/5 blur-[120px] transition-all group-hover:bg-sky-blue/8 pointer-events-none" />

      {/* ── Card Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 border-b border-sky-blue/10 pb-8">
        <div className="flex items-center gap-5">
          <div className="relative flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-sky-blue via-sky-500 to-active-blue text-white shadow-[0_8px_30px_rgba(14,165,233,0.3)] transition-transform duration-300 group-hover:scale-105">
            <Newspaper size={24} />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-blue opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-blue"></span>
            </span>
          </div>
          <div>
            <h3 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight leading-tight break-words bg-gradient-to-r from-foreground via-foreground to-foreground/80">
              {briefing.headline}
            </h3>
            <div className="inline-flex items-center gap-1.5 mt-2">
              <Sparkles size={12} className="text-sky-blue animate-pulse" />
              <p className="text-[10px] sm:text-xs font-black text-sky-blue uppercase tracking-[0.25em] italic opacity-85">
                {t.badge}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest leading-none mb-1.5">
              {t.dateLabel}
            </span>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-sky-blue/10 shadow-inner">
              <span className="text-xs font-bold text-foreground/90">{dateLabel}</span>
            </div>
          </div>
          <button
            onClick={() => fetchBriefing(true)}
            className="group/btn p-3 rounded-xl border border-sky-blue/10 bg-white/5 hover:bg-sky-blue/10 text-muted-foreground hover:text-sky-blue hover:border-sky-blue/30 shadow-inner active:scale-95 transition-all duration-300"
            title={t.retry}
            aria-label={t.retry}
          >
            <RefreshCw size={14} className="transition-transform duration-500 group-hover/btn:rotate-180" />
          </button>
        </div>
      </div>

      {/* ── AI Summary ── */}
      <div className="rounded-[2rem] border border-sky-blue/10 bg-white/5 dark:bg-neutral-900/10 p-6 sm:p-8 mb-6 shadow-inner relative overflow-hidden">
        <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-sky-blue via-sky-500 to-active-blue" />
        <div className="flex items-center gap-2.5 mb-4">
          <Sparkles size={14} className="text-sky-blue animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
            {t.summaryLabel}
          </span>
        </div>
        <p className="text-base sm:text-lg font-bold leading-relaxed text-foreground/90 break-words whitespace-pre-line">
          {briefing.summary}
        </p>
      </div>

      {/* ── AI Insight / Tips ── */}
      {briefing.aiInsight && (
        <div className="rounded-[2rem] border border-nature-green/15 bg-nature-green/5 p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="p-1 rounded-lg bg-nature-green/10 text-nature-green">
              <Lightbulb size={16} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              {t.tipsLabel}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {briefing.aiInsight.split(/\n+/).filter(Boolean).map((line, idx) => {
              const cleaned = line.replace(/^•\s*/, "").trim()
              if (!cleaned) return null
              return (
                <div key={idx} className="group/tip flex items-start gap-4 rounded-2xl border border-nature-green/10 bg-white/5 dark:bg-neutral-950/20 p-4 hover:border-nature-green/30 hover:bg-nature-green/10 transition-all duration-300">
                  <div className="flex items-center justify-center size-8 shrink-0 rounded-xl bg-nature-green/10 text-nature-green shadow-inner">
                    <Lightbulb size={14} className="transition-transform group-hover/tip:scale-110" />
                  </div>
                  <span className="text-sm sm:text-base font-bold leading-relaxed text-foreground break-words">{cleaned}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Weather / Events Bento ── */}
      {(briefing.weatherNote || briefing.festivalNote) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {briefing.weatherNote && (
            <div className="group/weather rounded-2xl border border-orange-400/15 bg-gradient-to-br from-orange-500/5 to-amber-500/5 p-5 hover:border-orange-400/30 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-16 w-16 rounded-full bg-orange-500/10 blur-xl group-hover/weather:bg-orange-500/20 transition-all pointer-events-none" />
              <div className="flex items-center gap-2 mb-3">
                <Sun size={15} className="text-orange-400 animate-spin-slow" />
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                  {t.weather}
                </span>
              </div>
              <div className="text-base sm:text-lg font-black leading-snug text-foreground break-words">
                {briefing.weatherNote}
              </div>
            </div>
          )}
          {briefing.festivalNote && (
            <div className="group/event rounded-2xl border border-pink-400/15 bg-gradient-to-br from-pink-500/5 to-purple-500/5 p-5 hover:border-pink-400/30 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-16 w-16 rounded-full bg-pink-500/10 blur-xl group-hover/event:bg-pink-500/20 transition-all pointer-events-none" />
              <div className="flex items-center gap-2 mb-3">
                <PartyPopper size={15} className="text-pink-400 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                  {t.events}
                </span>
              </div>
              <div className="text-base sm:text-lg font-black leading-snug text-foreground break-words">
                {briefing.festivalNote}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── News Links ── */}
      {briefing.newsItems.length > 0 && (
        <div className="rounded-[2rem] border border-sky-blue/10 bg-white/5 dark:bg-neutral-900/5 p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <ArrowUpRight size={16} className="text-sky-blue animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              {t.sources}
            </span>
            {sourceCount > 0 && (
              <span className="rounded-full px-2.5 py-0.5 bg-sky-blue/10 text-sky-blue text-[10px] font-bold">
                {language === "ko" ? `${sourceCount}개 출처` : language === "zh" ? `${sourceCount}个来源` : language === "ja" ? `${sourceCount}件のソース` : `${sourceCount} sources`}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {briefing.newsItems.map((item, i) => (
              <a
                key={`${item.url}-${i}`}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group/item flex items-start gap-4 rounded-2xl border border-sky-blue/5 bg-white/5 dark:bg-neutral-950/20 p-4 hover:border-sky-blue/25 hover:bg-sky-blue/5 hover:translate-x-1 hover:shadow-md transition-all duration-300 min-w-0"
              >
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-sky-blue/20 bg-sky-blue/10 text-[10px] font-black text-sky-blue shadow-inner group-hover/item:bg-sky-blue group-hover/item:text-white transition-all">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm sm:text-base font-black text-foreground break-words group-hover/item:text-sky-blue transition-colors">
                    {item.title}
                  </p>
                  {item.snippet && (
                    <p className="mt-1.5 text-xs sm:text-sm font-bold leading-relaxed text-muted-foreground/80 break-words line-clamp-2">
                      {item.snippet}
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px] font-bold text-muted-foreground/60">
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-sky-blue/5">{item.source}</span>
                    {item.publishedDate && <span>· {item.publishedDate}</span>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Tags ── */}
      {briefing.keywordTags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-4 border-t border-sky-blue/10">
          {briefing.keywordTags.map((tag, i) => (
            <span
              key={i}
              className="rounded-full border border-sky-blue/10 dark:border-sky-blue/20 bg-sky-blue/5 px-3.5 py-1.5 text-xs font-black text-sky-blue hover:scale-105 hover:bg-sky-blue/10 hover:border-sky-blue/30 transition-all duration-200 cursor-default shadow-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}


// ------------------------------------------------------------------
// i18n
// ------------------------------------------------------------------

const KO = {
  badge: "나들AI 어제 아침 브리핑",
  dateLabel: "기준일",
  summaryLabel: "나들AI 브리핑",
  tipsLabel: "오늘의 팁",
  loading: "어제의 소식을 준비하고 있어요…",
  error: "소식을 불러오지 못했어요",
  errorSub: "잠시 후 다시 시도해 주세요.",
  retry: "다시 시도",
  refresh: "새로고침",
  weather: "날씨",
  events: "행사",
  sources: "관련 기사",
}

const EN = {
  badge: "NadeulAI Yesterday Briefing",
  dateLabel: "Reference date",
  summaryLabel: "NadeulAI Briefing",
  tipsLabel: "Today's Tips",
  loading: "Preparing yesterday's news…",
  error: "Couldn't load the briefing",
  errorSub: "Please try again in a moment.",
  retry: "Retry",
  refresh: "Refresh",
  weather: "Weather",
  events: "Events",
  sources: "Related Articles",
}

const ZH = {
  badge: "NadeulAI 昨日晨间简报",
  dateLabel: "基准日期",
  summaryLabel: "NadeulAI 简报",
  tipsLabel: "今日小贴士",
  loading: "正在准备昨日的新聞…",
  error: "无法加载简报",
  errorSub: "请稍后再试。",
  retry: "重试",
  refresh: "刷新",
  weather: "天气",
  events: "活动",
  sources: "相关文章",
}

const JA = {
  badge: "NadeulAI 昨日の朝ブリーフィング",
  dateLabel: "基準日",
  summaryLabel: "NadeulAI ブリーフィング",
  tipsLabel: "今日のヒント",
  loading: "昨日のニュースを準備中…",
  error: "ブリーフィングを読み込めませんでした",
  errorSub: "しばらくしてからもう一度お試しください。",
  retry: "再試行",
  refresh: "更新",
  weather: "天気",
  events: "イベント",
  sources: "関連記事",
}
