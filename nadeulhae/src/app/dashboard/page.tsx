"use client"

import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
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
import { formatServerDateTime, parseServerTimestamp, type SupportedLocale } from "@/lib/time/server-time"
import { cn } from "@/lib/utils"
import {
  normalizeBulletinText,
  buildBulletinSourceCandidates,
  buildBulletinHighlight,
  buildBulletinSegments,
  toBulletinBodyItem,
  getBulletinSeverity,
  getBulletinSeverityTone,
  getBulletinTagToneClass,
  normalizeTagKey,
  extractBulletinKeywordTags,
  type BulletinKeywordTag,
} from "@/lib/bulletin"
import { dataService, type WeatherData } from "@/services/dataService"

import { DASHBOARD_COPY } from "./constants"
import { SectionCard, StatusMetric } from "@/components/dashboard/ui"
import { SettingsModal } from "@/components/dashboard/settings-modal"

function formatLastUpdate(
  value: WeatherData["metadata"] extends { lastUpdate: infer T } ? T : unknown,
  language: SupportedLocale
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

const DashboardWorkspace = memo(function DashboardWorkspace({ user }: { user: AuthUser }) {
  const { language, t } = useLanguage()
  const { resolvedTheme } = useTheme()
  const copy = (((DASHBOARD_COPY as any)[language] ?? DASHBOARD_COPY.ko) ?? DASHBOARD_COPY.ko)

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
        .map((segment) => toBulletinBodyItem(segment, language as any))
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

    return getBulletinSeverityTone(getBulletinSeverity(bulletinHighlight))
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
                {language === "ko" ? "핵심 공지" : language === "zh" ? "重要公告" : language === "ja" ? "重要なお知らせ" : "Key Notice"}
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
            const itemTone = getBulletinSeverityTone(getBulletinSeverity(item.content))
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
})

export default function DashboardPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const { user, status } = useAuth()
  const copy = (((DASHBOARD_COPY as any)[language] ?? DASHBOARD_COPY.ko) ?? DASHBOARD_COPY.ko)

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
