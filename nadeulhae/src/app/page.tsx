"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import {
  CloudIcon,
  DropletsIcon,
  Info,
  SunIcon,
  ThermometerIcon,
  WindIcon,
} from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { getMeteorCount, getParticleCount, shouldRunRichAnimation } from "@/lib/performance"
import { mockWeatherData } from "@/data/mockData"
import { dataService, type FireSummaryData, type WeatherData } from "@/services/dataService"
import { useLanguage } from "@/context/LanguageContext"
import { Particles } from "@/components/magicui/particles"
import { Meteors } from "@/components/magicui/meteors"
import { WordPullUp } from "@/components/magicui/word-pull-up"
import { ShineBorder } from "@/components/magicui/shine-border"
import { MagicCard } from "@/components/ui/magic-card"
import type { HourlyForecastItem } from "@/components/today-hourly-forecast"
import Link from "next/link"
import type { WeatherImageData } from "@/components/weather-image-panel"

const PicnicBriefing = dynamic(() => import("@/components/picnic-briefing").then(m => ({ default: m.PicnicBriefing })), { ssr: false })
const WeatherImagePanel = dynamic(() => import("@/components/weather-image-panel").then(m => ({ default: m.WeatherImagePanel })), { ssr: false })
const FireInsightPanel = dynamic(() => import("@/components/fire-insight-panel").then(m => ({ default: m.FireInsightPanel })), { ssr: false })
const TodayHourlyForecast = dynamic(() => import("@/components/today-hourly-forecast").then(m => ({ default: m.TodayHourlyForecast })), {
  ssr: false,
  loading: () => <div className="h-48 animate-pulse rounded-3xl bg-card" />,
})

function localizeUvLabel(value: string | undefined, language: string) {
  if (!value) return "--"
  if (language === "ko") return value

  switch (value.replace(/\s+/g, "")) {
    case "낮음":
      return "Low"
    case "보통":
      return "Moderate"
    case "높음":
      return "High"
    case "매우높음":
      return "Very High"
    case "위험":
      return "Extreme"
    default:
      return value
  }
}

export default function Home() {
  const { resolvedTheme } = useTheme()
  const { language, t } = useLanguage()

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [weatherImages, setWeatherImages] = useState<WeatherImageData>(null)
  const [fireSummary, setFireSummary] = useState<FireSummaryData | null>(null)
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecastItem[]>([])
  const [heroMessageSeed] = useState(() => {
    const now = new Date()
    return (now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()) % 1_000_000
  })
  const particleColor = resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"
  const particleQuantity = useMemo(() => getParticleCount(20), [])
  const meteorCount = useMemo(() => getMeteorCount(3), [])
  const enableAnimations = useMemo(() => shouldRunRichAnimation(), [])

  useEffect(() => {
    const loadInitialData = async () => {
      const loadFallback = async () => {
        try {
          const data = await dataService.getWeatherData()
          setWeatherData(data)
        } catch (error) {
          console.error("Initial data load failed:", error)
          setWeatherData(mockWeatherData)
        }
      }

      if (!navigator.geolocation) {
        await loadFallback()
        return
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const data = await dataService.getWeatherData(position.coords.latitude, position.coords.longitude)
            setWeatherData(data)
          } catch (error) {
            console.error("Initial location-based load failed:", error)
            await loadFallback()
          }
        },
        async () => {
          await loadFallback()
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        }
      )
    }
    loadInitialData()
  }, [])

  useEffect(() => {
    if (!weatherData) return

    const loadHourlyForecast = async () => {
      try {
        const lat = weatherData.metadata?.locationContext?.coordinates?.lat
        const lon = weatherData.metadata?.locationContext?.coordinates?.lon
        const query = lat != null && lon != null ? `?lat=${lat}&lon=${lon}` : ""
        const response = await fetch(`/api/weather/forecast${query}`, { cache: "no-store" })
        if (!response.ok) return
        const data = await response.json()
        setHourlyForecast(Array.isArray(data?.todayHourly) ? data.todayHourly : [])
      } catch (error) {
        console.error("Failed to load hourly forecast:", error)
      }
    }

    const loadWeatherImages = async () => {
      try {
        const extras = new Set<string>()
        const bulletinSummary = String(weatherData.metadata?.bulletin?.summary || "")
        const hasDustIssue = Boolean(
          (weatherData.details.pm10 ?? 0) >= 51
          || (weatherData.details.pm25 ?? 0) >= 26
          || /나쁨|매우|bad|very/i.test(String(weatherData.details.dust || ""))
          || /황사|dust/i.test(bulletinSummary)
        )
        const hasFogSignal = Boolean(
          (weatherData.details.humidity ?? 0) >= 90
          || /안개|fog/i.test(bulletinSummary)
        )
        const hasSevereSignal = Boolean(
          weatherData.eventData?.isWeatherWarning
          || weatherData.eventData?.isTyphoon
          || weatherData.eventData?.isTsunami
        )
        const hasTyphoonSignal = Boolean(weatherData.eventData?.isTyphoon)
        const hasTsunamiSignal = Boolean(weatherData.eventData?.isTsunami)
        const hasVolcanoSignal = Boolean(weatherData.eventData?.isVolcano)

        if (hasDustIssue) extras.add("dust")
        if (hasFogSignal) extras.add("fog")
        if (hasSevereSignal) extras.add("lgt")
        if (hasTyphoonSignal) extras.add("typhoon")
        if (hasTsunamiSignal) extras.add("tsunami")
        if (hasVolcanoSignal) extras.add("volcano")

        const params = new URLSearchParams()
        if (extras.size > 0) {
          params.set("extras", Array.from(extras).join(","))
        }
        if (hasTyphoonSignal) {
          params.set("typhoonTitle", weatherData.metadata?.alertSummary?.warningTitle || weatherData.eventData?.warningMessage || "태풍 감시")
          params.set("typhoonTm", weatherData.metadata?.alertSummary?.warningUpdatedAt || "")
          params.set("typhoonNote", weatherData.eventData?.warningMessage || "")
        }
        if (hasTsunamiSignal) {
          params.set("tsunamiTitle", weatherData.metadata?.alertSummary?.tsunamiTitle || "지진해일 감시")
          params.set("tsunamiTm", weatherData.metadata?.alertSummary?.tsunamiUpdatedAt || "")
          params.set("tsunamiNote", weatherData.eventData?.warningMessage || "")
        }
        if (hasVolcanoSignal) {
          params.set("volcanoTitle", weatherData.metadata?.alertSummary?.volcanoTitle || "화산 감시")
          params.set("volcanoTm", weatherData.metadata?.alertSummary?.volcanoUpdatedAt || "")
          params.set("volcanoNote", weatherData.eventData?.warningMessage || "")
        }

        const query = params.toString()
        const response = await fetch(`/api/weather/images${query ? `?${query}` : ""}`, { cache: "no-store" })
        if (!response.ok) return
        const data = await response.json()
        setWeatherImages(data)
      } catch (error) {
        console.error("Failed to load weather images:", error)
      }
    }

    loadHourlyForecast()
    loadWeatherImages()
  }, [weatherData])

  useEffect(() => {
    if (!weatherData?.metadata?.regionKey) return

    const loadFireSummary = async () => {
      const summary = await dataService.getFireSummary({
        regionKey: weatherData.metadata?.regionKey,
      })
      setFireSummary(summary)
    }

    loadFireSummary()
  }, [weatherData?.metadata?.regionKey])

  if (!weatherData) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background text-sky-blue animate-pulse font-bold">
        {t("loading_weather")}
      </div>
    )
  }

  const scoreColors = weatherData.score >= 86
    ? { primary: "#0b7d71", secondary: "#2f6fe4" }
    : weatherData.score >= 66
      ? { primary: "#2f6fe4", secondary: "#7db3ff" }
      : weatherData.score >= 36
        ? { primary: "#4d9a90", secondary: "#77b2f0" }
      : { primary: "#ef4444", secondary: "#f87171" }

  const feelsLikeValue = weatherData.details.feelsLike ?? weatherData.details.temp

  const quickMetrics = [
    {
      icon: ThermometerIcon,
      label: t("hero_temp"),
      value: `${weatherData.details.temp ?? "--"}°C`,
      tone: "text-orange-400",
      meta: `${language === "ko" ? "체감" : "Feels"} ${feelsLikeValue ?? "--"}°C`,
    },
    { icon: DropletsIcon, label: t("hero_humidity"), value: `${weatherData.details.humidity ?? "--"}%`, tone: "text-blue-400" },
    { icon: WindIcon, label: t("hero_wind"), value: `${weatherData.details.wind ?? "--"}m/s`, tone: "text-teal-400" },
    {
      icon: CloudIcon,
      label: t("hero_dust"),
      value: weatherData.details.dust,
      tone: "text-neutral-400",
      meta: weatherData.details.kr && weatherData.details.who
        ? `KR ${weatherData.details.kr} · WHO ${weatherData.details.who}`
        : null,
    },
    { icon: SunIcon, label: t("hero_uv"), value: localizeUvLabel(weatherData.details.uv, language), tone: "text-yellow-400" },
  ]

  const hasBriefingAlert = Boolean(
    weatherData.eventData?.isEarthquake
    || weatherData.eventData?.isTsunami
    || weatherData.eventData?.isVolcano
    || weatherData.eventData?.isWeatherWarning
    || weatherData.eventData?.isRain
  )

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-background">
      <section className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden py-24 sm:py-32">
        {particleQuantity > 0 && <Particles className="absolute inset-0 z-0 opacity-70" quantity={particleQuantity} ease={80} color={particleColor} />}
        {meteorCount > 0 && <Meteors number={meteorCount} className="z-0" />}

        <div className="z-10 flex max-w-6xl flex-col items-center gap-6 px-4 text-center">
          {weatherData.isFallback && (
            <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-full border border-card-border shadow-lg">
              <Info className="text-sky-blue size-4 animate-pulse" />
              <span className="text-[12px] sm:text-sm font-black text-foreground">{t("fallback_message")}</span>
            </div>
          )}

          <WordPullUp
            words={t(
              weatherData.message,
              `${weatherData.metadata?.regionKey ?? "default"}-${heroMessageSeed}-${language}`
            )}
            className="text-4xl sm:text-5xl md:text-7xl text-sky-blue px-4 font-black tracking-tight"
          />

          <MagicCard className="rounded-full" gradientFrom={scoreColors.primary} gradientTo={scoreColors.secondary}>
          <div className="relative flex size-64 sm:size-80 items-center justify-center rounded-full bg-card shadow-2xl transition-all hover:scale-105 duration-500" style={!enableAnimations ? { boxShadow: `0 0 24px 2px ${scoreColors.primary}40, 0 0 0 3px ${scoreColors.primary}` } : undefined}>
            {enableAnimations && <ShineBorder shineColor={[scoreColors.primary, scoreColors.secondary, "#ffffff"]} duration={10} borderWidth={2} className="rounded-full" />}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-30">
              <span className="text-sky-blue font-black text-xs sm:text-sm uppercase tracking-[0.3em] mb-1">{t("hero_score_label")}</span>
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.22em] text-foreground/45 mb-2">{t("hero_score_subtitle")}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-6xl sm:text-8xl font-black tracking-tighter text-foreground">{weatherData.score}</span>
                <span className="text-sm sm:text-xl font-black text-foreground/70">{t("hero_unit")}</span>
              </div>
              {weatherData.score >= 80 && (
                <div className="mt-2 text-[10px] sm:text-xs font-black text-sky-blue bg-sky-blue/10 px-3 py-1 rounded-full border border-sky-blue/20 animate-pulse">
                  {t("hero_best_day")}
                </div>
              )}
              {hasBriefingAlert && (
                <div className="mt-3 rounded-full border border-orange-500/20 bg-orange-500/8 px-3 py-1 text-[10px] sm:text-xs font-black tracking-wide text-orange-600 dark:text-orange-300">
                  {language === "ko" ? "세부 경고는 아래 브리핑에서 확인" : "See briefing below for active alerts"}
                </div>
              )}
            </div>
          </div>
          </MagicCard>

          <div className="flex flex-wrap items-start justify-center gap-y-12 sm:gap-10 mt-12 text-foreground w-full max-w-4xl mx-auto px-4">
            {quickMetrics.map((item) => (
              <div key={item.label} className="flex flex-col items-center basis-1/2 sm:basis-1/3 xl:basis-auto transition-transform hover:scale-105 duration-300 max-w-[180px]">
                <item.icon className={cn(item.tone, "mb-2 size-6 sm:size-8")} />
                <span className="text-[10px] sm:text-[12px] text-neutral-400 uppercase tracking-widest font-black leading-none mb-1 text-center">{item.label}</span>
                <span className="font-black text-xl sm:text-3xl leading-tight text-center">{item.value}</span>
                {"meta" in item && item.meta ? (
                  <span className="mt-1 text-[10px] sm:text-[11px] font-bold leading-relaxed text-muted-foreground text-center break-keep">
                    {item.meta}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 relative z-20 pb-24 sm:pb-28">
        <TodayHourlyForecast items={hourlyForecast} />
        <PicnicBriefing weatherData={weatherData} />
        {fireSummary?.overview?.showOnHome && (
          <div className="mt-6">
            <FireInsightPanel data={fireSummary} language={language} variant="compact" />
          </div>
        )}
        <WeatherImagePanel data={weatherImages} weather={weatherData} />
      </div>

      <footer className="py-12 border-t border-neutral-100 dark:border-neutral-800 text-center transition-colors">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 px-4">
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {t("footer_copy")}
          </p>
          <p className="max-w-3xl text-xs leading-relaxed text-neutral-400 dark:text-neutral-500">
            {t("footer_notice")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/terms" className="text-xs font-medium text-sky-blue/70 hover:text-sky-blue transition-colors">
              {t("footer_terms")}
            </Link>
            <span className="text-neutral-300 dark:text-neutral-600">·</span>
            <Link href="/about" className="text-xs font-medium text-sky-blue/70 hover:text-sky-blue transition-colors">
              {t("footer_about")}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
