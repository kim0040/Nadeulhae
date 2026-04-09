"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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

  const bulletinSummary = weatherData?.metadata?.bulletin?.summary?.trim() ?? ""
  const bulletinWarningStatus = weatherData?.metadata?.bulletin?.warningStatus?.trim() ?? ""
  const bulletinSegments = useMemo(() => splitBulletinSummary(bulletinSummary), [bulletinSummary])
  const bulletinUpdatedLabel = useMemo(() => {
    return formatLastUpdate(
      weatherData?.metadata?.bulletin?.updatedAt || weatherData?.metadata?.lastUpdate,
      language
    )
  }, [language, weatherData?.metadata?.bulletin?.updatedAt, weatherData?.metadata?.lastUpdate])

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
      <Particles className="absolute inset-0 z-0 opacity-70" quantity={68} ease={80} color={particleColor} refresh />
      <Meteors number={8} className="z-0" />

      <div className="relative z-10 mx-auto max-w-[90rem]">
        {/* Top Banner (Bento style) */}
        <SectionCard className="mb-6">
          <div className="grid gap-6 xl:grid-cols-[1fr_auto] xl:items-end">
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
        <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
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
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                    <div className="relative z-10">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-sky-blue/20 bg-sky-blue/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-sky-blue">
                          <ShieldAlert className="size-4" />
                          {copy.bulletin}
                        </div>
                        <span className="rounded-full border border-card-border/70 bg-card/80 px-3 py-1.5 text-xs font-bold text-muted-foreground">
                          {copy.updatedAt}: {bulletinUpdatedLabel}
                        </span>
                      </div>

                      {bulletinWarningStatus ? (
                        <div className="mt-4 rounded-[1.1rem] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold leading-6 text-danger">
                          {bulletinWarningStatus}
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {(weatherTags.length > 0 ? weatherTags : [copy.noTags]).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-card-border/70 bg-card px-3 py-1.5 text-sm font-semibold text-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {bulletinSegments.length > 0 ? (
                        <div className="mt-4 grid gap-2.5">
                          {bulletinSegments.map((segment, index) => (
                            <div
                              key={`${segment}-${index + 1}`}
                              className="flex items-start gap-3 rounded-[1.2rem] border border-card-border/70 bg-card/70 px-4 py-3"
                            >
                              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-blue/12 text-xs font-black text-sky-blue">
                                {index + 1}
                              </span>
                              <p className="text-sm leading-6 text-foreground">{segment}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 rounded-[1.2rem] border border-card-border/70 bg-card/70 px-4 py-3 text-sm leading-7 text-muted-foreground">
                          {copy.noBulletin}
                        </p>
                      )}

                      <p className="mt-3 text-xs font-semibold text-muted-foreground">
                        {copy.location}: {weatherData.metadata?.region || "-"} · {copy.station}: {weatherData.metadata?.station || "-"} · {copy.updatedAt}: {formatLastUpdate(weatherData.metadata?.lastUpdate, language)}
                      </p>
                    </div>
                  </div>
                </MagicCard>

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
