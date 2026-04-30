"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import {
  Sparkles,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Sun,
  PartyPopper,
  Newspaper,
  Lightbulb,
} from "lucide-react"

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
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kstNow.toISOString().slice(0, 10)
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
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const nextMidnight = new Date(kstNow)
  nextMidnight.setHours(24, 0, 0, 0)
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
      <div className="rounded-[2.5rem] border border-[var(--interactive-border)] bg-[var(--interactive)] p-8 sm:p-12">
        <div className="flex items-center justify-center gap-3 py-16">
          <Loader2 className="h-5 w-5 animate-spin text-sky-blue" />
          <span className="text-sm font-black text-muted-foreground">{t.loading}</span>
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
    <div className="rounded-[2.5rem] border border-[var(--interactive-border)] bg-[var(--interactive)] p-8 sm:p-12 pb-6">
      {/* ── Card Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-sky-blue to-active-blue text-white shadow-lg shadow-active-blue/20">
            <Newspaper size={24} />
          </div>
          <div>
            <h3 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight leading-none break-words">
              {briefing.headline}
            </h3>
            <p className="text-[10px] sm:text-xs font-black text-sky-blue uppercase tracking-[0.3em] mt-2 italic opacity-70">
              {t.badge}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">
              {t.dateLabel}
            </span>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--interactive)] border border-[var(--interactive-border)]">
              <Sparkles size={12} className="text-sky-blue" />
              <span className="text-xs font-black text-foreground">{dateLabel}</span>
            </div>
          </div>
          <button
            onClick={() => fetchBriefing(false)}
            className="p-2.5 rounded-xl border border-[var(--interactive-border)] bg-[var(--interactive)] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
            aria-label={t.retry}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── AI Summary ── */}
      <div className="rounded-[1.85rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={15} className="text-sky-blue" />
          <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
            {t.summaryLabel}
          </span>
        </div>
        <div className="rounded-[1.4rem] border border-sky-blue/15 bg-card px-4 py-4">
          <p className="text-sm sm:text-base font-bold leading-relaxed text-foreground/90 break-keep break-words whitespace-pre-line">
            {briefing.summary}
          </p>
        </div>
      </div>

      {/* ── AI Insight / Tips ── */}
      {briefing.aiInsight && (
        <div className="rounded-[1.85rem] border border-nature-green/20 bg-nature-green/5 px-5 py-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={15} className="text-nature-green" />
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              {t.tipsLabel}
            </span>
          </div>
          <div className="space-y-2">
            {briefing.aiInsight.split(/\n+/).filter(Boolean).map((line, idx) => {
              const cleaned = line.replace(/^•\s*/, "").trim()
              if (!cleaned) return null
              return (
                <div key={idx} className="flex items-start gap-3 rounded-[1.4rem] border border-nature-green/15 bg-card px-4 py-3 min-w-0">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-nature-green" />
                  <span className="text-sm sm:text-base font-bold leading-relaxed text-foreground break-keep break-words">{cleaned}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Weather / Events ── */}
      {(briefing.weatherNote || briefing.festivalNote) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {briefing.weatherNote && (
            <div className="rounded-[1.45rem] border border-orange-400/20 bg-orange-400/5 px-4 py-4 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <Sun size={15} className="text-orange-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                  {t.weather}
                </span>
              </div>
              <div className="text-base sm:text-lg font-black leading-snug text-foreground break-keep break-words">
                {briefing.weatherNote}
              </div>
            </div>
          )}
          {briefing.festivalNote && (
            <div className="rounded-[1.45rem] border border-pink-400/20 bg-pink-400/5 px-4 py-4 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <PartyPopper size={15} className="text-pink-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                  {t.events}
                </span>
              </div>
              <div className="text-base sm:text-lg font-black leading-snug text-foreground break-keep break-words">
                {briefing.festivalNote}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── News Links ── */}
      {briefing.newsItems.length > 0 && (
        <div className="rounded-[1.85rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowUpRight size={15} className="text-sky-blue" />
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              {t.sources}
            </span>
            {sourceCount > 0 && (
              <span className="text-[10px] font-bold text-muted-foreground/60">
                {language === "ko" ? `${sourceCount}개 출처` : language === "zh" ? `${sourceCount}个来源` : language === "ja" ? `${sourceCount}件のソース` : `${sourceCount} sources`}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {briefing.newsItems.map((item, i) => (
              <a
                key={`${item.url}-${i}`}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 rounded-[1.4rem] border border-[var(--interactive-border)] bg-card px-4 py-3 hover:border-sky-blue/25 hover:bg-sky-blue/5 transition-colors min-w-0"
              >
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--interactive-border)] text-[10px] font-black text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm sm:text-base font-black text-foreground break-keep break-words group-hover:text-sky-blue transition-colors">
                    {item.title}
                  </p>
                  {item.snippet && (
                    <p className="mt-1 text-xs sm:text-sm font-bold leading-relaxed text-muted-foreground break-keep break-words">
                      {item.snippet}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-muted-foreground/60">
                    <span>{item.source}</span>
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
        <div className="flex flex-wrap gap-2 pt-2">
          {briefing.keywordTags.map((tag, i) => (
            <span
              key={i}
              className="rounded-full border border-[var(--interactive-border)] bg-[var(--interactive)] px-3 py-1.5 text-[11px] font-black text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
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
