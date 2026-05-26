"use client"

/**
 * Dashboard Page — authenticated user hub showing weather metrics, bulletin
 * alerts, hourly forecast, chat panel, and settings. The heavy rendering is
 * delegated to DashboardWorkspace (memoized), while DashboardPage handles
 * auth gating and workspace key derivation.
 */

import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles,
  Settings,
  MapPin,
  Cloud,
  Sun,
  CloudRain,
} from "lucide-react"
import { useTheme } from "next-themes"

import { Meteors } from "@/components/magicui/meteors"
import { Particles } from "@/components/magicui/particles"
import { getMeteorCount, getParticleCount } from "@/lib/performance"
import { DashboardChatPanel } from "@/components/chat/dashboard-chat-panel"
import { CourseRecommendation } from "@/components/course-recommendation"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import { getOptionLabel, PRIMARY_REGION_OPTIONS } from "@/lib/auth/profile-options"
import type { ChatWeatherContext } from "@/lib/chat/prompt"
import type { AuthUser } from "@/lib/auth/types"
import { dataService, type WeatherData } from "@/services/dataService"

import { DASHBOARD_COPY } from "./constants"
import { SectionCard, StatusMetric } from "@/components/dashboard/ui"
import { SettingsModal } from "@/components/dashboard/settings-modal"

// ---- Memoized workspace (re-render only when derived key changes) ----

const DashboardWorkspace = memo(function DashboardWorkspace({ user }: { user: AuthUser }) {
  const { language, t } = useLanguage()
  const { resolvedTheme } = useTheme()
  const copy = (((DASHBOARD_COPY as any)[language] ?? DASHBOARD_COPY.ko) ?? DASHBOARD_COPY.ko)

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [customCourse, setCustomCourse] = useState<any[] | null>(null)

  const particleColor = resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"
  const particleQuantity = useMemo(() => getParticleCount(30), [])
  const meteorCount = useMemo(() => getMeteorCount(4), [])

  // Fetch weather details for the given (or default) coords
  const loadWeather = useCallback(async (lat?: number, lon?: number) => {
    try {
      const detail = await dataService.getWeatherData(lat, lon)
      setWeatherData(detail)
    } catch (error) {
      console.error("Failed to load weather details:", error)
    }
  }, [])

  // Full weather refresh with geolocation attempt + fallback
  const refreshWeather = useCallback(async () => {
    const fallback = async () => {
      try {
        await loadWeather()
      } catch (error) {
        console.error("Dashboard weather refresh failed:", error)
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
        }
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
  }, [loadWeather])

  useEffect(() => {
    void refreshWeather()
  }, [refreshWeather])

  // Smooth scroll to recommendation map when custom course is generated from chat
  useEffect(() => {
    if (customCourse) {
      const timer = setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        })
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [customCourse])



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
                <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg break-words">
                  {copy.heroDescription}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
              {weatherData ? (
                <div className="relative overflow-hidden rounded-[1.3rem] border border-sky-blue/20 bg-sky-blue/5 p-4.5 flex items-center justify-between gap-4 backdrop-blur-md shadow-inner shadow-white/5 animate-in fade-in duration-300">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-sky-blue to-active-blue p-2.5 text-white shadow-md shadow-sky-blue/20 shrink-0">
                      {weatherData.status.includes("비") || weatherData.status.includes("눈") || weatherData.status.includes("소나기") ? (
                        <CloudRain className="size-5" />
                      ) : weatherData.status.includes("맑음") ? (
                        <Sun className="size-5 animate-spin" style={{ animationDuration: "35s" }} />
                      ) : (
                        <Cloud className="size-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1">
                        <MapPin className="size-3 text-sky-blue shrink-0" />
                        {weatherData.metadata?.region || getOptionLabel(PRIMARY_REGION_OPTIONS, user.primaryRegion, language)}
                      </p>
                      <h4 className="text-[17px] font-black tracking-tight text-foreground mt-0.5">
                        {weatherData.details.temp ?? "--"}°C
                        <span className="text-[11px] font-bold text-sky-blue ml-2">{t(weatherData.status, weatherData.status)}</span>
                      </h4>
                    </div>
                  </div>
                  <div className="text-right border-l border-card-border/50 pl-4 shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">나들이 지수</span>
                    <p className="text-lg font-black tracking-tight text-active-blue mt-0.5">{weatherData.score}점</p>
                  </div>
                </div>
              ) : (
                <StatusMetric
                  label={copy.location}
                  value={getOptionLabel(PRIMARY_REGION_OPTIONS, user.primaryRegion, language)}
                  meta={copy.heroMetricsLocation}
                  icon={<MapPin className="size-4" />}
                />
              )}

              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="group relative overflow-hidden rounded-[1.3rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-6 py-5 text-left transition hover:border-active-blue/40 hover:bg-active-blue/5"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-gradient-to-br from-sky-blue to-active-blue p-3 text-white group-hover:rotate-45 group-hover:scale-110 transition-all duration-300 shadow-md shadow-active-blue/20">
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

        {/* Spacious Dashboard Chat Panel (Centered & Premium) */}
        <div className="mx-auto w-full max-w-4xl animate-in fade-in slide-in-from-top-3 duration-500">
          <SectionCard className="min-w-0 border-active-blue/10 shadow-lg shadow-sky-blue/5">
            <DashboardChatPanel 
              user={user} 
              weatherContext={chatWeatherContext} 
              onCourseGenerated={setCustomCourse}
            />
          </SectionCard>
        </div>

        {/* Dynamic bottom section that spans full width, revealed only when recommended course is generated */}
        {customCourse && (
          <div className="mt-6 w-full animate-in fade-in slide-in-from-bottom-5 duration-500">
            <CourseRecommendation
              weatherContext={chatWeatherContext}
              userProfile={{
                interestTags: user.interestTags,
                preferredTimeSlot: user.preferredTimeSlot,
                weatherSensitivity: user.weatherSensitivity,
                primaryRegion: user.primaryRegion,
                ageBand: user.ageBand,
              }}
              userLat={weatherData?.metadata?.locationContext?.coordinates?.lat ?? null}
              userLon={weatherData?.metadata?.locationContext?.coordinates?.lon ?? null}
              customCourse={customCourse}
            />
          </div>
        )}
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

  // ---- Render guards ----

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

  // Derive a stable string key from user profile so the memoized workspace
  // only re-mounts when relevant profile fields change.
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
