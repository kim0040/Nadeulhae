"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  FlaskConical,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Settings,
} from "lucide-react"
import { useTheme } from "next-themes"

import { BorderBeam } from "@/components/magicui/border-beam"
import { MagicCard } from "@/components/magicui/magic-card"
import { Meteors } from "@/components/magicui/meteors"
import { Particles } from "@/components/magicui/particles"
import { getMeteorCount, getParticleCount, shouldRunRichAnimation } from "@/lib/performance"
import { DashboardChatPanel } from "@/components/chat/dashboard-chat-panel"
import { TodayHourlyForecast, type HourlyForecastItem } from "@/components/today-hourly-forecast"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import { getOptionLabel, PRIMARY_REGION_OPTIONS } from "@/lib/auth/profile-options"
import type { ChatWeatherContext } from "@/lib/chat/prompt"
import type { AuthUser } from "@/lib/auth/types"
import { formatServerDateTime, parseServerTimestamp } from "@/lib/time/server-time"
import { cn } from "@/lib/utils"
import { dataService, type WeatherData } from "@/services/dataService"

import { DASHBOARD_COPY } from "./constants"
import { SectionCard, StatusMetric } from "@/components/dashboard/ui"
import { SettingsModal } from "@/components/dashboard/settings-modal"

function formatLastUpdate(
  value: WeatherData["metadata"] extends { lastUpdate: infer T } ? T : unknown,
  language: "ko" | "en"
) {
  const formatValue = (raw: string) => {
    const parsed = parseServerTimestamp(raw)
    if (!parsed) {
      return raw
    }

    return formatServerDateTime(parsed, language)
  }

  if (!value) return "-"
  if (typeof value === "string") return formatValue(value)
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, string>
    return Object.values(record).filter(Boolean).map(formatValue).join(" / ")
  }
  return "-"
}

function splitBulletinSummary(summary: string) {
  const cleaned = summary
    .replace(/\r/g, "\n")
    .split("\n")
    .map((segment) => segment.replace(/^[•·\-*\s]+/, "").trim())
    .filter(Boolean)
    .flatMap((line) =>
      line.split(/(?<=[.!?])\s+|(?<=다\.)\s+|(?<=요\.)\s+/).map((segment) => segment.trim()).filter(Boolean)
    )

  const uniqueSegments: string[] = []
  for (const segment of cleaned) {
    if (!uniqueSegments.includes(segment)) {
      uniqueSegments.push(segment)
    }
    if (uniqueSegments.length >= 4) {
      break
    }
  }

  return uniqueSegments
}

const NON_ALERT_BULLETIN_PATTERN = /^(?:[oO○◯●□■▪︎ㆍ·\-\*\s]*)?(?:없음|없\s*음|특보없음|해당없음|none|no\s*alerts?|n\/a)(?:[\s.)\]]*)$/i
const BULLETIN_HIGHLIGHT_MAX_LENGTH = 96
const BULLETIN_MAX_SEGMENTS = 6
const NON_BULLETIN_SOURCE_PATTERN = /(전주 기준 대기질 데이터를 표시 중입니다|showing fallback air quality data)/i
const BULLETIN_CATEGORY_SET = new Set([
  "종합",
  "요약",
  "긴급",
  "오늘",
  "내일",
  "모레",
  "글피",
  "그글피",
  "summary",
  "today",
  "tomorrow",
])

type BulletinSeverity = "critical" | "warning" | "advisory" | "info"

type BulletinBodyItem = {
  label: string | null
  content: string
}

type BulletinKeywordTag = {
  id: string
  label: string
  tone: BulletinSeverity
}

const BULLETIN_SEVERITY_RULES: Array<{ severity: BulletinSeverity; regex: RegExp }> = [
  {
    severity: "critical",
    regex: /(경보|긴급|재난|지진|해일|산사태|태풍\s*경보|호우\s*경보|대설\s*경보|폭염\s*경보|한파\s*경보|storm warning|emergency|tsunami warning)/i,
  },
  {
    severity: "warning",
    regex: /(주의보|특보|강풍|풍랑|호우|대설|폭염|한파|황사|안개|빙판|낙뢰|advisory|heavy rain|strong wind|typhoon)/i,
  },
  {
    severity: "advisory",
    regex: /(비|눈|소나기|천둥|번개|바람|rain|snow|shower|thunder|wind)/i,
  },
]

const BULLETIN_TAG_RULES: Array<{
  id: string
  regex: RegExp
  tone: BulletinSeverity
  label: Record<"ko" | "en", string>
}> = [
  { id: "typhoon", regex: /(태풍|typhoon)/i, tone: "critical", label: { ko: "태풍", en: "Typhoon" } },
  { id: "heavy-rain", regex: /(호우|집중호우|heavy rain)/i, tone: "warning", label: { ko: "호우", en: "Heavy Rain" } },
  { id: "strong-wind", regex: /(강풍|돌풍|strong wind|gust)/i, tone: "warning", label: { ko: "강풍", en: "Strong Wind" } },
  { id: "snow", regex: /(대설|폭설|snow|blizzard)/i, tone: "warning", label: { ko: "대설", en: "Heavy Snow" } },
  { id: "thunder", regex: /(천둥|번개|낙뢰|thunder|lightning)/i, tone: "warning", label: { ko: "낙뢰", en: "Thunder" } },
  { id: "heatwave", regex: /(폭염|heat wave|heatwave)/i, tone: "warning", label: { ko: "폭염", en: "Heatwave" } },
  { id: "cold-wave", regex: /(한파|cold wave)/i, tone: "warning", label: { ko: "한파", en: "Cold Wave" } },
  { id: "dust", regex: /(황사|미세먼지|초미세먼지|dust|pm10|pm2\.?5)/i, tone: "advisory", label: { ko: "대기질", en: "Air Quality" } },
  { id: "fog", regex: /(안개|가시거리|fog|visibility)/i, tone: "advisory", label: { ko: "안개", en: "Fog" } },
  { id: "rain", regex: /(비|강수|rain|drizzle)/i, tone: "advisory", label: { ko: "비", en: "Rain" } },
]

function splitBulletinSymbols(value: string) {
  return value
    .replace(/[□■]/g, "\n")
    .replace(/[○◯●]/g, "\n")
}

function normalizeBulletinText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return ""
  }

  const withoutPrefix = normalized.replace(/^[oO○◯●□■▪︎ㆍ·\-\*\s]+/, "").trim()

  if (NON_ALERT_BULLETIN_PATTERN.test(normalized) || NON_ALERT_BULLETIN_PATTERN.test(withoutPrefix)) {
    return ""
  }

  return withoutPrefix || normalized
}

function buildBulletinSegments(sources: string[]) {
  const merged = sources
    .map((source) => splitBulletinSymbols(source))
    .join("\n")
    .split("\n")
    .map((line) => normalizeBulletinText(line))
    .filter(Boolean)

  if (merged.length === 0) {
    return []
  }

  return splitBulletinSummary(merged.join("\n"))
    .map((segment) => normalizeBulletinText(segment))
    .filter(Boolean)
    .slice(0, BULLETIN_MAX_SEGMENTS)
}

function clampText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength).trimEnd()}…`
}

function normalizeBulletinHeadline(value: string) {
  return value
    .replace(/^\((?:종합|요약|긴급)\)\s*/i, "")
    .replace(/^\[(?:종합|요약|긴급)\]\s*/i, "")
    .trim()
}

function sanitizeBulletinSource(value: string) {
  const normalized = normalizeBulletinText(value)
  if (!normalized) {
    return ""
  }

  if (NON_BULLETIN_SOURCE_PATTERN.test(normalized)) {
    return ""
  }

  return normalized
}

function buildBulletinSourceCandidates(primarySources: string[], fallbackSources: string[]) {
  const selected: string[] = []
  const seen = new Set<string>()

  const push = (source: string) => {
    const normalized = sanitizeBulletinSource(source)
    if (!normalized || seen.has(normalized)) {
      return
    }

    seen.add(normalized)
    selected.push(normalized)
  }

  primarySources.forEach(push)
  if (selected.length === 0) {
    fallbackSources.forEach(push)
  }

  return selected
}

function buildBulletinHighlight(sources: string[]) {
  const segments = buildBulletinSegments(sources)
  if (segments.length === 0) {
    return ""
  }

  const headline = normalizeBulletinHeadline(segments[0])
  return clampText(headline || segments[0], BULLETIN_HIGHLIGHT_MAX_LENGTH)
}

function getBulletinSeverity(value: string): BulletinSeverity {
  const normalized = normalizeBulletinText(value)
  if (!normalized) {
    return "info"
  }

  for (const rule of BULLETIN_SEVERITY_RULES) {
    if (rule.regex.test(normalized)) {
      return rule.severity
    }
  }

  return "info"
}

function getBulletinTone(severity: BulletinSeverity) {
  switch (severity) {
    case "critical":
      return {
        container: "border-danger/25 bg-danger/10",
        iconWrapper: "border-danger/30 bg-danger/15 text-danger",
        icon: "text-danger",
        kicker: "text-danger/85",
        text: "text-danger",
        itemContainer: "border-danger/20 bg-danger/6",
        itemLabel: "border-danger/25 bg-danger/10 text-danger",
      }
    case "warning":
      return {
        container: "border-orange-500/30 bg-orange-500/10",
        iconWrapper: "border-orange-500/35 bg-orange-500/12 text-orange-600 dark:text-orange-300",
        icon: "text-orange-600 dark:text-orange-300",
        kicker: "text-orange-600/90 dark:text-orange-300",
        text: "text-foreground",
        itemContainer: "border-orange-500/20 bg-orange-500/6",
        itemLabel: "border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-300",
      }
    case "advisory":
      return {
        container: "border-sky-blue/25 bg-sky-blue/8",
        iconWrapper: "border-sky-blue/25 bg-sky-blue/12 text-sky-blue",
        icon: "text-sky-blue",
        kicker: "text-sky-blue/90",
        text: "text-foreground",
        itemContainer: "border-sky-blue/18 bg-sky-blue/5",
        itemLabel: "border-sky-blue/25 bg-sky-blue/10 text-sky-blue",
      }
    default:
      return {
        container: "border-card-border/70 bg-card/70",
        iconWrapper: "border-card-border/70 bg-card/90 text-muted-foreground",
        icon: "text-muted-foreground",
        kicker: "text-muted-foreground",
        text: "text-foreground",
        itemContainer: "border-card-border/70 bg-card/70",
        itemLabel: "border-card-border/70 bg-background/70 text-muted-foreground",
      }
  }
}

function getBulletinTagToneClass(tone: BulletinSeverity) {
  switch (tone) {
    case "critical":
      return "border-danger/25 bg-danger/10 text-danger"
    case "warning":
      return "border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-300"
    case "advisory":
      return "border-sky-blue/25 bg-sky-blue/10 text-sky-blue"
    default:
      return "border-card-border/70 bg-card/85 text-foreground"
  }
}

function normalizeTagKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").trim()
}

function extractBulletinKeywordTags(sources: string[], language: "ko" | "en"): BulletinKeywordTag[] {
  const merged = sources
    .map((source) => normalizeBulletinText(source))
    .filter(Boolean)
    .join(" ")

  if (!merged) {
    return []
  }

  return BULLETIN_TAG_RULES
    .filter((rule) => rule.regex.test(merged))
    .map((rule) => ({
      id: rule.id,
      label: rule.label[language],
      tone: rule.tone,
    }))
}

function extractBulletinCategoryToken(segment: string) {
  const normalized = segment.replace(/^[\s\-:·•]+/, "").trim()

  const wrappedMatch = normalized.match(/^[\[(]([^\])]+)[\])]\s*(.*)$/)
  if (wrappedMatch) {
    const token = wrappedMatch[1].split(/[,\s/·:]+/).filter(Boolean)[0] ?? ""
    return {
      token: token.toLowerCase(),
      content: wrappedMatch[2]?.trim() ?? "",
    }
  }

  const plainMatch = normalized.match(/^([A-Za-z가-힣]+)\s*[:\-]?\s*(.*)$/)
  if (plainMatch) {
    return {
      token: plainMatch[1].toLowerCase(),
      content: plainMatch[2]?.trim() ?? "",
    }
  }

  return { token: "", content: normalized }
}

function formatBulletinCategoryLabel(token: string, language: "ko" | "en") {
  if (language === "ko") {
    switch (token) {
      case "summary":
        return "종합"
      case "today":
        return "오늘"
      case "tomorrow":
        return "내일"
      default:
        return token
    }
  }

  switch (token) {
    case "종합":
    case "요약":
      return "Summary"
    case "긴급":
      return "Urgent"
    case "오늘":
      return "Today"
    case "내일":
      return "Tomorrow"
    case "모레":
      return "Day After Tomorrow"
    case "글피":
      return "In 3 Days"
    case "그글피":
      return "In 4 Days"
    default:
      return token.charAt(0).toUpperCase() + token.slice(1)
  }
}

function toBulletinBodyItem(segment: string, language: "ko" | "en"): BulletinBodyItem {
  const normalized = normalizeBulletinText(segment)
  if (!normalized) {
    return { label: null, content: "" }
  }

  const { token, content } = extractBulletinCategoryToken(normalized)
  if (BULLETIN_CATEGORY_SET.has(token)) {
    return {
      label: formatBulletinCategoryLabel(token, language),
      content: content || normalized,
    }
  }

  return {
    label: null,
    content: normalized,
  }
}

function DashboardWorkspace({ user }: { user: AuthUser }) {
  const { language, t } = useLanguage()
  const { resolvedTheme } = useTheme()
  const copy = DASHBOARD_COPY[language]

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecastItem[]>([])
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const [isWeatherRefreshing, setIsWeatherRefreshing] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const particleColor = resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"
  const particleQuantity = useMemo(() => getParticleCount(30), [])
  const meteorCount = useMemo(() => getMeteorCount(4), [])
  const enableAnimations = useMemo(() => shouldRunRichAnimation(), [])

  const loadWeather = useCallback(async (lat?: number, lon?: number) => {
    const query = lat != null && lon != null ? `?lat=${lat}&lon=${lon}` : ""
    const [detail, response] = await Promise.all([
      dataService.getWeatherData(lat, lon),
      fetch(`/api/weather/forecast${query}`, {
        cache: "no-store",
        credentials: "include",
      }),
    ])

    setWeatherData(detail)
    if (!response.ok) {
      setHourlyForecast([])
      return
    }

    const data = await response.json()
    setHourlyForecast(Array.isArray(data?.todayHourly) ? data.todayHourly : [])
  }, [])

  const refreshWeather = useCallback(async () => {
    setIsWeatherRefreshing(true)
    setWeatherError(null)

    const fallback = async () => {
      try {
        await loadWeather()
      } catch (error) {
        console.error("Dashboard weather refresh failed:", error)
        setWeatherError(copy.weatherError)
      } finally {
        setIsWeatherRefreshing(false)
      }
    }

    if (!navigator.geolocation) {
      await fallback()
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await loadWeather(position.coords.latitude, position.coords.longitude)
        } catch (error) {
          console.error("Location weather refresh failed:", error)
          await fallback()
          return
        }
        setIsWeatherRefreshing(false)
      },
      async () => {
        await fallback()
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 0,
      }
    )
  }, [copy.weatherError, loadWeather])

  useEffect(() => {
    void refreshWeather()
  }, [refreshWeather])

  const weatherPrimaryMetrics = useMemo(() => {
    if (!weatherData) return []
    const localizedStatus = t(weatherData.status, weatherData.status)
    return [
      { label: copy.score, value: String(weatherData.score), meta: localizedStatus },
      { label: copy.temp, value: `${weatherData.details.temp ?? "--"}°C` },
      { label: copy.feelsLike, value: `${weatherData.details.feelsLike ?? weatherData.details.temp ?? "--"}°C` },
      { label: copy.humidity, value: `${weatherData.details.humidity ?? "--"}%` },
      { label: copy.wind, value: `${weatherData.details.wind ?? "--"}m/s` },
      { label: copy.pm10, value: weatherData.details.pm10 != null ? `${weatherData.details.pm10}` : weatherData.details.dust || "--" },
    ]
  }, [copy, t, weatherData])

  const weatherTags = useMemo(() => {
    return weatherData?.metadata?.alertSummary?.hazardTags?.filter(Boolean) ?? []
  }, [weatherData])

  const rawBulletinSummary = weatherData?.metadata?.bulletin?.summary?.trim() ?? ""
  const rawBulletinWarningStatus = weatherData?.metadata?.bulletin?.warningStatus?.trim() ?? ""
  const rawWarningTitle = weatherData?.metadata?.alertSummary?.warningTitle?.trim() ?? ""
  const rawEventWarningMessage = weatherData?.eventData?.warningMessage?.trim() ?? ""
  const bulletinSourceCandidates = useMemo(
    () =>
      buildBulletinSourceCandidates(
        [rawBulletinWarningStatus, rawWarningTitle, rawBulletinSummary],
        [rawEventWarningMessage]
      ),
    [rawBulletinWarningStatus, rawWarningTitle, rawBulletinSummary, rawEventWarningMessage]
  )
  const bulletinHighlight = useMemo(
    () => buildBulletinHighlight(bulletinSourceCandidates),
    [bulletinSourceCandidates]
  )
  const bulletinSegments = useMemo(
    () => buildBulletinSegments(bulletinSourceCandidates),
    [bulletinSourceCandidates]
  )
  const bulletinBodySegments = useMemo(() => {
    if (!bulletinHighlight) {
      return bulletinSegments
    }

    const normalizedHighlight = normalizeBulletinText(bulletinHighlight)
    return bulletinSegments.filter((segment, index) => {
      if (index !== 0) {
        return true
      }

      return normalizeBulletinText(segment) !== normalizedHighlight
    })
  }, [bulletinHighlight, bulletinSegments])
  const bulletinBodyItems = useMemo(
    () =>
      bulletinBodySegments
        .map((segment) => toBulletinBodyItem(segment, language))
        .filter((item) => item.content.length > 0),
    [bulletinBodySegments, language]
  )
  const bulletinKeywordTags = useMemo(
    () =>
      extractBulletinKeywordTags(
        [
          ...bulletinSourceCandidates,
          ...bulletinBodyItems.map((item) => item.content),
        ],
        language
      ),
    [bulletinSourceCandidates, bulletinBodyItems, language]
  )
  const bulletinTags = useMemo(() => {
    const merged: BulletinKeywordTag[] = []
    const seen = new Set<string>()

    const push = (tag: BulletinKeywordTag) => {
      const key = normalizeTagKey(tag.label)
      if (!key || seen.has(key)) {
        return
      }

      seen.add(key)
      merged.push(tag)
    }

    for (const tag of bulletinKeywordTags) {
      push(tag)
    }

    for (const tag of weatherTags) {
      const normalized = tag.trim()
      if (!normalized) {
        continue
      }

      push({
        id: `meta-${normalized}`,
        label: normalized,
        tone: "info",
      })
    }

    return merged.slice(0, 8)
  }, [bulletinKeywordTags, weatherTags])
  const bulletinHighlightTone = useMemo(() => {
    if (!bulletinHighlight) {
      return null
    }

    return getBulletinTone(getBulletinSeverity(bulletinHighlight))
  }, [bulletinHighlight])
  const bulletinUpdatedLabel = useMemo(() => {
    return formatLastUpdate(
      weatherData?.metadata?.bulletin?.updatedAt || weatherData?.metadata?.lastUpdate,
      language
    )
  }, [language, weatherData?.metadata?.bulletin?.updatedAt, weatherData?.metadata?.lastUpdate])
  const bulletinContent = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-blue/20 bg-sky-blue/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-sky-blue">
          <ShieldAlert className="size-4" />
          {copy.bulletin}
        </div>
        <span className="rounded-full border border-card-border/70 bg-card/80 px-3 py-1.5 text-xs font-bold text-muted-foreground">
          {copy.updatedAt}: {bulletinUpdatedLabel}
        </span>
      </div>

      {bulletinHighlight && bulletinHighlightTone ? (
        <div className={cn("mt-4 rounded-[1.3rem] border px-4 py-4 sm:px-5", bulletinHighlightTone.container)}>
          <div className="flex items-start gap-3">
            <span className={cn(
              "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border",
              bulletinHighlightTone.iconWrapper
            )}>
              <ShieldAlert className={cn("size-4", bulletinHighlightTone.icon)} />
            </span>
            <div className="min-w-0">
              <p className={cn("text-[10px] font-black uppercase tracking-[0.18em]", bulletinHighlightTone.kicker)}>
                {language === "ko" ? "핵심 공지" : "Key Notice"}
              </p>
              <p className={cn("mt-1 text-sm font-semibold leading-6 sm:text-[15px]", bulletinHighlightTone.text)}>
                {bulletinHighlight}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {bulletinTags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {bulletinTags.map((tag) => (
            <span
              key={tag.id}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                getBulletinTagToneClass(tag.tone)
              )}
            >
              {tag.label}
            </span>
          ))}
        </div>
      ) : null}

      {bulletinBodyItems.length > 0 ? (
        <div className="mt-4 space-y-2.5">
          {bulletinBodyItems.map((item, index) => {
            const itemTone = getBulletinTone(getBulletinSeverity(item.content))
            return (
              <article
                key={`${item.label ?? "notice"}-${item.content}-${index + 1}`}
                className={cn("rounded-[1.15rem] border px-4 py-3.5", itemTone.itemContainer)}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
                        item.label
                          ? itemTone.itemLabel
                          : "border border-card-border/70 bg-background/70 text-muted-foreground"
                      )}
                    >
                      {item.label ?? (language === "ko" ? `공지 ${index + 1}` : `Notice ${index + 1}`)}
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      #{String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-foreground/95">{item.content}</p>
                </div>
              </article>
            )
          })}
        </div>
      ) : !bulletinHighlight ? (
        <p className="mt-4 rounded-[1.2rem] border border-card-border/70 bg-card/70 px-4 py-3 text-sm leading-7 text-muted-foreground">
          {copy.noBulletin}
        </p>
      ) : null}

      <p className="mt-3 text-xs font-semibold text-muted-foreground">
        {copy.location}: {weatherData?.metadata?.region || "-"} · {copy.station}: {weatherData?.metadata?.station || "-"} · {copy.updatedAt}: {formatLastUpdate(weatherData?.metadata?.lastUpdate, language)}
      </p>
    </>
  )

  const chatWeatherContext = useMemo<ChatWeatherContext | null>(() => {
    if (!weatherData) {
      return null
    }

    const details = weatherData.details
    const eventData = weatherData.eventData

    return {
      region: weatherData.metadata?.region || null,
      score: Number.isFinite(weatherData.score) ? weatherData.score : null,
      status: weatherData.status || null,
      temperatureC: typeof details.temp === "number" ? details.temp : null,
      feelsLikeC: typeof details.feelsLike === "number" ? details.feelsLike : null,
      humidityPct: typeof details.humidity === "number" ? details.humidity : null,
      windMs: typeof details.wind === "number" ? details.wind : null,
      uvLabel: details.uv || null,
      pm10: typeof details.pm10 === "number" ? details.pm10 : null,
      pm25: typeof details.pm25 === "number" ? details.pm25 : null,
      rainingNow: Boolean(
        eventData?.isRain
          || (typeof details.rn1 === "number" && details.rn1 > 0)
          || (typeof details.pty === "number" && details.pty > 0)
      ),
      severeAlert: Boolean(
        eventData?.isWeatherWarning
          || eventData?.isEarthquake
          || eventData?.isTyphoon
          || eventData?.isTsunami
          || eventData?.isVolcano
      ),
      hazardTags: weatherData.metadata?.alertSummary?.hazardTags?.filter(Boolean) ?? [],
      bulletin: weatherData.metadata?.bulletin?.summary || null,
      observedAt: new Date().toISOString(),
    }
  }, [weatherData])

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 pb-16 pt-24 sm:px-6 sm:pt-28 lg:px-8">
      {particleQuantity > 0 && <Particles className="absolute inset-0 z-0 opacity-70" quantity={particleQuantity} ease={80} color={particleColor} refresh />}
      {meteorCount > 0 && <Meteors number={meteorCount} className="z-0" />}

      <div className="relative z-10 mx-auto max-w-[82rem] 2xl:max-w-[86rem]">
        {/* Top Banner (Bento style) */}
        <SectionCard className="mb-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(17rem,0.85fr)] xl:items-end">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/20 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-active-blue">
                <Sparkles className="size-3.5" />
                {copy.badge}
              </span>
              <div className="space-y-2">
                <p className="text-sm font-black uppercase tracking-[0.32em] text-muted-foreground">{copy.heroLead}</p>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                    {user.displayName} · {copy.title}
                  </h1>
                </div>
                <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                  {copy.heroDescription}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
              <StatusMetric
                label={copy.location}
                value={getOptionLabel(PRIMARY_REGION_OPTIONS, user.primaryRegion, language)}
                meta={copy.heroMetricsLocation}
              />
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="group relative overflow-hidden rounded-[1.3rem] border border-sky-blue/30 bg-sky-blue/10 px-6 py-5 text-left transition hover:border-sky-blue hover:bg-sky-blue/20"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-sky-blue/20 p-3 text-sky-blue group-hover:scale-110 transition-transform">
                    <Settings className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-widest text-sky-blue uppercase">{copy.profileTitle}</h3>
                    <p className="mt-1 text-xs font-semibold text-sky-blue/80">{copy.profileActionHint}</p>
                  </div>
                </div>
              </button>
              {user.labEnabled ? (
                <Link
                  href="/lab"
                  className="group relative overflow-hidden rounded-[1.3rem] border border-active-blue/30 bg-active-blue/10 px-6 py-5 text-left transition hover:border-active-blue hover:bg-active-blue/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-active-blue/20 p-3 text-active-blue transition-transform group-hover:scale-110">
                      <FlaskConical className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-widest text-active-blue uppercase">{copy.labNav}</h3>
                      <p className="mt-1 text-xs font-semibold text-active-blue/80">
                        {language === "ko" ? "맞춤 카드 생성/복습" : "Generate and review cards"}
                      </p>
                    </div>
                  </div>
                </Link>
              ) : null}
            </div>
          </div>
        </SectionCard>

        {/* Responsive 2-Column Layout */}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]">
          {/* Weather & Briefing Module */}
          <SectionCard className="min-w-0">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                  {copy.weatherTitle}
                </p>
                <h2 className="text-3xl font-black tracking-tight text-foreground">
                  {weatherData?.metadata?.region || weatherData?.metadata?.regionEn || copy.weatherTitle}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">{copy.weatherDescription}</p>
              </div>

              <button
                type="button"
                onClick={() => void refreshWeather()}
                className="inline-flex items-center gap-2 self-start rounded-full border border-card-border/70 bg-background/75 px-4 py-2 text-sm font-black text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue disabled:opacity-50"
                disabled={isWeatherRefreshing}
              >
                <RefreshCcw className={cn("size-4", isWeatherRefreshing && "animate-spin")} />
                {copy.weatherRefresh}
              </button>
            </div>

            {weatherError && (
              <div className="mt-5 rounded-[1.4rem] border border-danger/20 bg-danger/10 px-4 py-4 text-sm font-semibold text-danger">
                <div className="flex items-center justify-between gap-3">
                  <span>{weatherError}</span>
                  <button
                    type="button"
                    onClick={() => void refreshWeather()}
                    className="rounded-full border border-danger/20 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em]"
                  >
                    {copy.weatherRetry}
                  </button>
                </div>
              </div>
            )}

            {!weatherData && !weatherError && (
              <div className="mt-5 rounded-[1.4rem] border border-card-border/70 bg-background/75 px-4 py-5 text-sm font-semibold text-muted-foreground">
                {copy.weatherLoading}
              </div>
            )}

            {weatherData && (
              <>
                <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-3">
                  {weatherPrimaryMetrics.map((metric) => (
                    <StatusMetric
                      key={metric.label}
                      label={metric.label}
                      value={metric.value}
                      meta={metric.meta}
                      compact
                    />
                  ))}
                </div>

                {enableAnimations ? (
                  <MagicCard
                    className="mt-6 overflow-hidden rounded-[1.7rem]"
                    gradientSize={220}
                    gradientOpacity={0.68}
                  >
                    <div className="relative rounded-[1.7rem] border border-card-border/70 bg-background/80 p-5 sm:p-6">
                      <BorderBeam
                        size={170}
                        duration={11}
                        colorFrom="var(--beam-from)"
                        colorTo="var(--beam-to)"
                      />
                      <div className="relative z-10">{bulletinContent}</div>
                    </div>
                  </MagicCard>
                ) : (
                  <div className="mt-6 overflow-hidden rounded-[1.7rem]">
                    <div className="relative rounded-[1.7rem] border border-card-border/70 bg-background/80 p-5 sm:p-6">
                      <div className="relative z-10">
                        {bulletinContent}
                      </div>
                    </div>
                  </div>
                )}

                <TodayHourlyForecast items={hourlyForecast} />
              </>
            )}
          </SectionCard>

          <SectionCard className="min-w-0">
            <DashboardChatPanel user={user} weatherContext={chatWeatherContext} />
          </SectionCard>
        </div>
      </div>

      <SettingsModal 
         isOpen={isSettingsOpen} 
         onClose={() => setIsSettingsOpen(false)} 
         user={user} 
      />
    </main>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const { user, status } = useAuth()
  const copy = DASHBOARD_COPY[language]

  useEffect(() => {
    if (status === "guest") {
      const timeout = window.setTimeout(() => {
        router.replace("/login")
      }, 500)
      return () => window.clearTimeout(timeout)
    }
  }, [router, status])

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm font-bold text-sky-blue">
        {copy.loading}
      </div>
    )
  }

  if (!user) {
    return <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm font-semibold text-muted-foreground">{copy.redirecting}</div>
  }

  const workspaceKey = JSON.stringify([
    language,
    user.id,
    user.displayName,
    user.ageBand,
    user.primaryRegion,
    user.preferredTimeSlot,
    user.marketingAccepted,
    user.interestTags.join(","),
    user.weatherSensitivity.join(","),
    user.interestOther ?? "",
  ])

  return <DashboardWorkspace key={workspaceKey} user={user} />
}
