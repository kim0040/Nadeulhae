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
  CalendarDays,
  ListChecks,
  ShieldCheck,
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
type IssueCategory = "safety" | "governance" | "culture" | "economy" | "lifestyle"

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const RETRY_MAX = 3
const RETRY_DELAY_MS = 1000
const LOCAL_BRIEFING_CACHE_PREFIX = "nadeul:jeonju:briefing:v3"

type LocalBriefingCacheEntry = {
  data: BriefingData
  expiresAtMs: number
}

function getKstDateKey() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kstNow.toISOString().slice(0, 10)
}

function getLocalBriefingCacheKey(language: "ko" | "en") {
  return `${LOCAL_BRIEFING_CACHE_PREFIX}:${language}:${getKstDateKey()}`
}

function readLocalBriefingCache(language: "ko" | "en"): BriefingData | null {
  if (typeof window === "undefined") return null
  const key = getLocalBriefingCacheKey(language)
  const raw = window.localStorage.getItem(key)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as LocalBriefingCacheEntry
    if (!parsed || typeof parsed !== "object" || !parsed.data || typeof parsed.expiresAtMs !== "number") {
      window.localStorage.removeItem(key)
      return null
    }
    if (parsed.expiresAtMs <= Date.now()) {
      window.localStorage.removeItem(key)
      return null
    }
    return parsed.data
  } catch {
    window.localStorage.removeItem(key)
    return null
  }
}

function writeLocalBriefingCache(language: "ko" | "en", data: BriefingData) {
  if (typeof window === "undefined") return
  const key = getLocalBriefingCacheKey(language)
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const nextKstMidnight = new Date(kstNow)
  nextKstMidnight.setHours(24, 0, 0, 0)
  const expiresAtMs = Math.max(Date.now() + 5 * 60 * 1000, nextKstMidnight.getTime())
  const payload: LocalBriefingCacheEntry = {
    data,
    expiresAtMs,
  }
  window.localStorage.setItem(key, JSON.stringify(payload))
}

function splitChecklist(text: string | null): string[] {
  if (!text) return []
  const normalized = text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?=•)/g))
    .map((line) => line.replace(/^•\s*/, "").trim())
    .filter((line) => line.length > 0)

  if (normalized.length >= 2) return normalized.slice(0, 4)
  return text
    .split(/[.!?]\s+/)
    .map((line) => line.replace(/^•\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 4)
}

function formatPublishedDate(date: string | null, language: "ko" | "en") {
  if (!date) return null
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(language === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
  })
}

function parseSummarySections(summary: string, language: "ko" | "en") {
  const normalized = summary.replace(/\s+/g, " ").trim()
  const lines = normalized
    .replace(/핵심상황:/g, "\n[CORE] ")
    .replace(/오늘영향:/g, "\n[IMPACT] ")
    .replace(/Core:/g, "\n[CORE] ")
    .replace(/Today impact:/g, "\n[IMPACT] ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  let intro = ""
  const core: string[] = []
  const impact: string[] = []

  for (const line of lines) {
    if (line.startsWith("[CORE]")) {
      core.push(line.replace("[CORE]", "").trim())
      continue
    }
    if (line.startsWith("[IMPACT]")) {
      impact.push(line.replace("[IMPACT]", "").trim())
      continue
    }
    if (!intro) {
      intro = line
      continue
    }
    if (core.length < 2) {
      core.push(line)
    } else {
      impact.push(line)
    }
  }

  if (!intro) {
    intro = language === "ko"
      ? "안녕하세요! 나들AI입니다. 어제의 전주 소식을 알려드릴게요."
      : "Hello! I'm NadeulAI. Here's yesterday's Jeonju briefing."
  }

  return {
    intro,
    core: core.slice(0, 3),
    impact: impact.slice(0, 2),
  }
}

function classifyIssueCategory(item: NewsItem): IssueCategory {
  const text = `${item.title} ${item.snippet}`.toLowerCase()
  if (/(교통|통제|안전|사고|재난|도로|우회|단속)/i.test(text)) return "safety"
  if (/(의회|시정|정책|예산|선거|후보|브리핑|공고|행정)/i.test(text)) return "governance"
  if (/(축제|행사|공연|전시|문화|관광|박물관)/i.test(text)) return "culture"
  if (/(경제|일자리|상권|기업|투자|산업|재정)/i.test(text)) return "economy"
  return "lifestyle"
}

function summarizeCategory(
  category: IssueCategory,
  items: Array<NewsItem & { category: IssueCategory }>,
  language: "ko" | "en"
) {
  const top = items[0]
  const second = items[1]
  const sources = new Set(items.map((item) => item.source).filter(Boolean))

  if (language === "ko") {
    const base = top
      ? `${top.title} 이슈를 중심으로 ${items.length}건을 확인했습니다.`
      : `${items.length}건의 관련 이슈를 확인했습니다.`
    const sourceLine = `출처 ${sources.size}곳 기준으로 어제 업데이트를 통합했습니다.`
    const secondLine = second ? `추가로 ${second.title} 관련 내용까지 함께 반영했습니다.` : ""
    const action = (() => {
      if (category === "safety") return "이동 전 통제·혼잡 여부를 먼저 확인하세요."
      if (category === "culture") return "행사 참여 전 운영시간·입장 조건을 확인하세요."
      if (category === "governance") return "공식 공고/보도자료의 최신 갱신 시각을 확인하세요."
      if (category === "economy") return "생활·상권 관련 변동 사항은 원문 공지 기준으로 확인하세요."
      return "오늘 일정과 직접 관련된 공지를 우선 확인하세요."
    })()
    return `${base} ${sourceLine}${secondLine ? ` ${secondLine}` : ""} ${action}`
  }

  const base = top
    ? `Key update: ${top.title}.`
    : `We verified ${items.length} related updates.`
  const sourceLine = `Combined from ${sources.size} sources for yesterday's context.`
  const secondLine = second ? `Also includes ${second.title}.` : ""
  const action = (() => {
    if (category === "safety") return "Check traffic controls and congestion before moving."
    if (category === "culture") return "Verify event hours and entry conditions first."
    if (category === "governance") return "Check the latest timestamp on official notices."
    if (category === "economy") return "Validate local business/economy updates via source links."
    return "Prioritize notices directly tied to your plan today."
  })()
  return `${base} ${sourceLine}${secondLine ? ` ${secondLine}` : ""} ${action}`
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

interface JeonjuDailyBriefingProps {
  language: "ko" | "en"
}

export function JeonjuDailyBriefing({ language }: JeonjuDailyBriefingProps) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [status, setStatus] = useState<FetchStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // --- i18n ---
  const t = useI18n(language)

  // --- Fetch logic ---
  const fetchBriefing = useCallback(
    async (force = false, attempt = 0, refresh = false) => {
      if (!force || !briefing) {
        setStatus("loading")
      }
      setErrorMessage(null)

      try {
        const controller = new AbortController()
        const timeout = window.setTimeout(
          () => controller.abort("jeonju_briefing_request_timeout"),
          25000
        )
        let res: Response
        try {
          const queryParams = new URLSearchParams({ locale: language })
          if (force) queryParams.set("force", "true")
          if (refresh && !force) queryParams.set("refresh", "true")
          res = await fetch(
            `/api/jeonju/briefing?${queryParams.toString()}`,
            { signal: controller.signal }
          )
        } finally {
          window.clearTimeout(timeout)
        }

        if (!res.ok) {
          let serverError = `HTTP ${res.status}`
          let retryAfterSeconds: number | null = null
          try {
            const payload = await res.json() as { error?: string; retryAfterSeconds?: number }
            if (typeof payload.error === "string" && payload.error.trim()) {
              serverError = payload.error
            }
            if (typeof payload.retryAfterSeconds === "number" && Number.isFinite(payload.retryAfterSeconds)) {
              retryAfterSeconds = payload.retryAfterSeconds
            }
          } catch {
            // ignore json parsing errors
          }

          const error = new Error(serverError) as Error & { status?: number; retryAfterSeconds?: number | null }
          error.status = res.status
          error.retryAfterSeconds = retryAfterSeconds
          throw error
        }

        const json = await res.json()

        if (!json.success || !json.data) {
          throw new Error(json.error || "Invalid response")
        }

        const data: BriefingData = {
          ...json.data,
          fromCache: json.fromCache ?? false,
        }

        writeLocalBriefingCache(language, data)
        setBriefing(data)
        setErrorMessage(null)

        // If data looks like a fallback (empty news items + no AI insight), mark as "empty"
        const isEmptyFallback =
          data.newsItems.length === 0 &&
          !data.aiInsight &&
          !data.weatherNote &&
          !data.festivalNote

        setStatus(isEmptyFallback ? "empty" : "success")
      } catch (err) {
        const abortReason = "jeonju_briefing_request_timeout"
        const errName = (err as { name?: string } | null)?.name
        const errMessage = typeof err === "string"
          ? err
          : (err instanceof Error ? err.message : "")
        const isAbortError =
          errName === "AbortError"
          || err === abortReason
          || errMessage === abortReason
        if (!isAbortError) {
          console.error("[JeonjuDailyBriefing] Fetch failed:", err)
        }

        const statusCode = (err as { status?: number })?.status
        const retryAfterSeconds = (err as { retryAfterSeconds?: number | null })?.retryAfterSeconds ?? null
        const isRateLimited = statusCode === 429
        const message = isAbortError
          ? t.timeoutSub
          : (err instanceof Error ? err.message : t.errorSub)

        if (!isRateLimited && attempt < RETRY_MAX) {
          setTimeout(() => fetchBriefing(force, attempt + 1, refresh), RETRY_DELAY_MS * (attempt + 1))
          return
        }

        if (isRateLimited) {
          setErrorMessage(
            retryAfterSeconds && retryAfterSeconds > 0
              ? `${message} (${retryAfterSeconds}s)`
              : message
          )
        } else {
          setErrorMessage(message)
        }

        setStatus("error")
      }
    },
    [briefing, language, t.errorSub, t.timeoutSub]
  )

  useEffect(() => {
    const cached = readLocalBriefingCache(language)
    if (cached) {
      setBriefing(cached)
      const isEmptyFallback =
        cached.newsItems.length === 0 &&
        !cached.aiInsight &&
        !cached.weatherNote &&
        !cached.festivalNote
      setStatus(isEmptyFallback ? "empty" : "success")
      return
    }
    fetchBriefing(false, 0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  const handleRefresh = useCallback(() => {
    fetchBriefing(false, 0, true)
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
            <p className="mt-2 text-sm font-bold text-muted-foreground/70">{errorMessage || t.errorSub}</p>
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
  const checklistItems = splitChecklist(briefing.aiInsight)
  const sourceCount = new Set(briefing.newsItems.map((item) => item.source).filter(Boolean)).size
  const summarySections = parseSummarySections(briefing.summary, language)
  const categorizedNews = briefing.newsItems.map((item) => ({
    ...item,
    category: classifyIssueCategory(item),
  }))
  const categoryBriefings = (Object.keys(t.issueLabels) as IssueCategory[])
    .map((category) => {
      const items = categorizedNews.filter((item) => item.category === category)
      if (items.length === 0) return null
      return {
        category,
        summary: summarizeCategory(category, items, language),
        items: items.slice(0, 3),
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
  const issueCounts = categorizedNews.reduce<Record<IssueCategory, number>>((acc, item) => {
    acc[item.category] += 1
    return acc
  }, { safety: 0, governance: 0, culture: 0, economy: 0, lifestyle: 0 })

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
          <div className="inline-flex items-center gap-1.5 rounded-full border border-card-border/60 bg-card/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            {briefing.briefingDate}
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-card-border/60 bg-card/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            {language === "ko" ? `출처 ${sourceCount}개` : `${sourceCount} sources`}
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-card-border/60 bg-card/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            <Newspaper className="h-3 w-3" />
            {language === "ko" ? `기사 ${briefing.newsItems.length}건` : `${briefing.newsItems.length} stories`}
          </div>
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
        {errorMessage && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-orange-400/35 bg-orange-400/10 px-3 py-1.5 text-xs font-black text-orange-600 dark:text-orange-300">
            <Info className="h-3 w-3" />
            {errorMessage}
          </div>
        )}
      </div>

      {/* Main Briefing Card */}
      <div className="overflow-hidden rounded-[2rem] border border-[var(--interactive-border)] bg-[var(--interactive)] shadow-[0_20px_65px_-36px_rgba(17,24,39,0.5)]">
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
          <div className="mb-8 rounded-[1.2rem] border border-card-border/60 bg-card/60 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground mb-3">
              <Newspaper size={14} className="text-sky-blue" />
              {t.summaryLabel}
            </div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-sky-blue/25 bg-sky-blue/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-blue">
              <Sparkles className="h-3 w-3" />
              {t.aiVoiceLabel}
            </div>
            <p className="rounded-xl bg-background/70 px-3 py-3 text-sm sm:text-base font-black leading-relaxed text-foreground break-keep">
              {summarySections.intro}
            </p>
            {summarySections.core.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t.corePointsLabel}</p>
                <ul className="space-y-2">
                  {summarySections.core.map((line, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm sm:text-base font-bold text-foreground break-keep">
                      <span className="mt-[2px] h-2 w-2 shrink-0 rounded-full bg-sky-blue" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summarySections.impact.length > 0 && (
              <div className="mt-4 rounded-xl border border-sky-blue/25 bg-sky-blue/5 px-3 py-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-sky-blue">{t.todayImpactLabel}</p>
                <ul className="space-y-2">
                  {summarySections.impact.map((line, idx) => (
                    <li key={idx} className="text-sm sm:text-base font-bold leading-relaxed text-foreground break-keep">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Issue Spectrum */}
          {briefing.newsItems.length > 0 && (
            <div className="mb-8 rounded-[1.2rem] border border-card-border/60 bg-card/60 p-4 sm:p-5">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                {t.issueSpectrumLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(t.issueLabels) as IssueCategory[])
                  .filter((key) => issueCounts[key] > 0)
                  .map((key) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-background px-3 py-1.5 text-xs font-black text-foreground"
                    >
                      <span>{t.issueLabels[key]}</span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{issueCounts[key]}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}

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
            <div className="mb-8 rounded-[1.4rem] border border-nature-green/20 bg-gradient-to-br from-nature-green/10 via-nature-green/5 to-sky-blue/5 px-5 py-4">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-nature-green">
                <ListChecks size={12} />
                {t.insightLabel}
              </div>
              {checklistItems.length > 1 ? (
                <ul className="space-y-2">
                  {checklistItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm sm:text-base font-bold text-foreground break-keep">
                      <span className="mt-[2px] h-2 w-2 shrink-0 rounded-full bg-nature-green" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm sm:text-base font-bold text-foreground italic break-keep">
                  &ldquo;{briefing.aiInsight}&rdquo;
                </p>
              )}
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

          {/* Sector Briefings */}
          {categoryBriefings.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground mb-4">
                <Newspaper size={14} className="text-active-blue" />
                {t.categoryBriefingLabel}
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {categoryBriefings.map((entry) => (
                  <div
                    key={entry.category}
                    className="rounded-[1.2rem] border border-card-border bg-card px-5 py-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wide text-foreground px-2 py-0.5 rounded-full bg-sky-blue/10 border border-sky-blue/25">
                        {t.issueLabels[entry.category]}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {language === "ko" ? `${entry.items.length}건 요약` : `${entry.items.length} highlights`}
                      </span>
                    </div>
                    <p className="text-sm sm:text-base font-bold leading-relaxed text-foreground break-keep">
                      {entry.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* References */}
          {briefing.newsItems.length > 0 && (
            <div className="mb-8 rounded-[1.2rem] border border-card-border/60 bg-card/60 p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                <ArrowUpRight size={14} className="text-active-blue" />
                {t.referencesLabel}
              </div>
              <p className="mb-3 text-xs sm:text-sm font-bold text-muted-foreground break-keep">
                {t.referencesDesc}
              </p>
              <div className="space-y-2">
                {categorizedNews.map((item, index) => (
                  <a
                    key={`${item.url}-${index}`}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3 rounded-xl border border-card-border bg-background/70 px-3 py-2 hover:border-sky-blue/25 hover:bg-sky-blue/5 transition-colors"
                  >
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-card-border text-[10px] font-black text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-black text-foreground break-keep group-hover:text-sky-blue transition-colors">
                        {item.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] font-bold text-muted-foreground">
                        <span>{t.issueLabels[item.category]}</span>
                        <span>{item.source || t.link}</span>
                        {item.publishedDate && (
                          <span>{formatPublishedDate(item.publishedDate, language)}</span>
                        )}
                      </div>
                    </div>
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
      sectionDesc: "나들AI가 어제 기준 전주 핵심 이슈를 직접 브리핑하고, 오늘 바로 쓸 수 있는 체크포인트까지 안내합니다.",
      aiLabel: "나들AI 브리핑",
      aiVoiceLabel: "나들AI 브리핑 멘트",
      summaryLabel: "요약",
      corePointsLabel: "핵심 포인트",
      todayImpactLabel: "오늘 영향",
      issueSpectrumLabel: "이슈 분포",
      issueLabels: {
        safety: "교통/안전",
        governance: "시정/정책",
        culture: "문화/행사",
        economy: "경제/일자리",
        lifestyle: "생활 일반",
      } as Record<IssueCategory, string>,
      categoryBriefingLabel: "분야별 통합 브리핑",
      referencesLabel: "참고 링크",
      referencesDesc: "아래 링크는 분야별 브리핑의 근거 원문입니다.",
      insightLabel: "오늘 체크리스트",
      weatherLabel: "날씨",
      festivalLabel: "행사",
      loading: "브리핑 준비 중...",
      error: "일시적으로 불러올 수 없어요",
      errorSub: "잠시 후 다시 시도해 주세요.",
      timeoutSub: "응답 시간이 길어져 요청을 새로 시도하고 있어요.",
      retry: "다시 시도",
      refresh: "갱신",
      fromCache: "캐시된 데이터",
      link: "링크",
      noNewsInfo: "새로운 소식을 모으는 중이에요",
      noNewsDesc: "어제 기준 확인 가능한 신규 보도가 제한적입니다. 전주시청 공지와 교통 안내를 먼저 확인해 주세요.",
    }
  }

  return {
    sectionTitle: "Yesterday's Jeonju News",
    sectionDesc: "NadeulAI briefs yesterday's key Jeonju updates and highlights practical points you can use today.",
    aiLabel: "NadeulAI Briefing",
    aiVoiceLabel: "NadeulAI Voice Brief",
    summaryLabel: "Summary",
    corePointsLabel: "Core Points",
    todayImpactLabel: "Today's Impact",
    issueSpectrumLabel: "Issue Spectrum",
    issueLabels: {
      safety: "Safety/Traffic",
      governance: "Governance/Policy",
      culture: "Culture/Events",
      economy: "Economy/Jobs",
      lifestyle: "General",
    } as Record<IssueCategory, string>,
    categoryBriefingLabel: "Integrated Briefing by Sector",
    referencesLabel: "Reference Links",
    referencesDesc: "These links are the source evidence behind each sector summary.",
    insightLabel: "Today's Checklist",
    weatherLabel: "Weather",
    festivalLabel: "Events",
    loading: "Preparing briefing...",
    error: "Temporarily unavailable",
    errorSub: "Please try again in a moment.",
    timeoutSub: "The response took too long, retrying the request.",
    retry: "Retry",
    refresh: "Refresh",
    fromCache: "Cached data",
    link: "Link",
    noNewsInfo: "Gathering fresh news",
    noNewsDesc: "Verified fresh updates were limited for yesterday. Please check Jeonju city notices and traffic updates first.",
  }
}
