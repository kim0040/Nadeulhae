"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  CloudIcon,
  DropletsIcon,
  Info,
  SunIcon,
  ThermometerIcon,
  WindIcon,
} from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { mockWeatherData } from "@/data/mockData"
import { dataService, type WeatherData } from "@/services/dataService"
import { useLanguage } from "@/context/LanguageContext"
import { Particles } from "@/components/magicui/particles"
import { Meteors } from "@/components/magicui/meteors"
import { WordPullUp } from "@/components/magicui/word-pull-up"
import { ShineBorder } from "@/components/magicui/shine-border"
import { BorderBeam } from "@/components/magicui/border-beam"
import { PicnicBriefing } from "@/components/picnic-briefing"
import { WeatherImagePanel, type WeatherImageData } from "@/components/weather-image-panel"

export default function Home() {
  const { resolvedTheme } = useTheme()
  const { language, t } = useLanguage()

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [weatherImages, setWeatherImages] = useState<WeatherImageData>(null)
  const [heroMessageSeed] = useState(() => Math.floor(Math.random() * 1_000_000))
  const particleColor = resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"

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
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      )
    }
    loadInitialData()
  }, [])

  useEffect(() => {
    if (!weatherData) return

    const loadWeatherImages = async () => {
      try {
        const extras = new Set<string>()
        const hasDustIssue = Boolean(
          (weatherData.details.pm10 ?? 0) >= 81
          || (weatherData.details.pm25 ?? 0) >= 36
          || /나쁨|매우|bad|very/i.test(String(weatherData.details.dust || ""))
        )
        const hasSevereSignal = Boolean(
          weatherData.eventData?.isWeatherWarning
          || weatherData.eventData?.isTyphoon
          || weatherData.eventData?.isTsunami
        )

        if (hasDustIssue) extras.add("dust")
        if (hasSevereSignal) extras.add("lgt")

        const query = extras.size > 0 ? `?extras=${encodeURIComponent(Array.from(extras).join(","))}` : ""
        const response = await fetch(`/api/weather/images${query}`, { cache: "no-store" })
        if (!response.ok) return
        const data = await response.json()
        setWeatherImages(data)
      } catch (error) {
        console.error("Failed to load weather images:", error)
      }
    }

    loadWeatherImages()
  }, [weatherData])

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
    { icon: SunIcon, label: t("hero_uv"), value: weatherData.details.uv || "--", tone: "text-yellow-400" },
  ]

  const homeTexts = {
    scorePaused: language === "ko" ? "피크닉 지수 산출 보류" : "Picnic score paused",
  }

  const emergencyType = weatherData.eventData?.isEarthquake
    ? "earthquake"
    : weatherData.eventData?.isTsunami
      ? "tsunami"
      : weatherData.eventData?.isVolcano
        ? "volcano"
        : weatherData.eventData?.isWeatherWarning
          ? "warning"
          : weatherData.eventData?.isRain
            ? "rain"
            : "none"

  const emergencyTitle = emergencyType === "earthquake"
    ? t("alert_earthquake_title")
    : emergencyType === "tsunami"
      ? (language === "ko" ? "🚨 지진해일 경보 감시" : "🚨 Tsunami Alert")
      : emergencyType === "volcano"
        ? (language === "ko" ? "🚨 화산 정보 감시" : "🚨 Volcanic Activity Alert")
        : emergencyType === "warning"
          ? t("alert_weather_wrn_title")
          : emergencyType === "rain"
            ? t("alert_heavy_rain_title")
            : ""

  const emergencyDesc = emergencyType === "earthquake"
    ? t("alert_earthquake_desc")
    : emergencyType === "tsunami"
      ? (language === "ko" ? "지진해일 관련 통보가 감지되었습니다. 해안가 접근을 피하고 최신 안내를 확인하세요." : "A tsunami-related bulletin was detected. Avoid coastal areas and follow official updates.")
      : emergencyType === "volcano"
        ? (language === "ko" ? "화산 관련 통보가 감지되었습니다. 항공/외부 활동 전 최신 통보를 확인하세요." : "A volcanic bulletin was detected. Check the latest official advisory before travel or outdoor activity.")
        : emergencyType === "warning"
          ? t("alert_weather_wrn_desc")
          : emergencyType === "rain"
            ? t("alert_heavy_rain_desc")
            : ""

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-background">
      <section className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden py-24 sm:py-32">
        <Particles className="absolute inset-0 z-0 opacity-70" quantity={72} ease={80} color={particleColor} refresh />
        <Meteors number={10} className="z-0" />

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

          {(weatherData.eventData?.isEarthquake || weatherData.eventData?.isTsunami || weatherData.eventData?.isVolcano || weatherData.eventData?.isWeatherWarning || weatherData.eventData?.isRain) ? (
            <div className="relative w-full max-w-md flex flex-col items-center justify-center p-8 rounded-3xl bg-red-500/10 border border-red-500/40 shadow-2xl mt-4 overflow-hidden">
              <BorderBeam duration={8} borderWidth={3} colorFrom="#ef4444" colorTo="#b91c1c" />
              <AlertTriangle className="size-16 sm:size-20 text-red-500 mb-4 animate-bounce" />
              <h3 className="text-xl sm:text-2xl font-black text-red-500 mb-2">
                {emergencyTitle}
              </h3>
              <p className="text-sm font-bold text-red-400">
                {emergencyDesc}
              </p>
              {weatherData.eventData?.warningMessage && (
                <p className="mt-4 text-xs sm:text-sm font-bold text-red-200 max-w-xs leading-relaxed">
                  {weatherData.eventData.warningMessage}
                </p>
              )}
              <div className="mt-4 px-3 py-1 bg-red-500/20 rounded-full border border-red-500/30 text-[10px] font-black uppercase text-red-300">
                {homeTexts.scorePaused}
              </div>
            </div>
          ) : (
            <div className="relative flex size-64 sm:size-80 items-center justify-center rounded-full bg-card border border-card-border shadow-2xl transition-all hover:scale-105 duration-500">
              <ShineBorder shineColor={[scoreColors.primary, scoreColors.secondary, "#ffffff"]} duration={10} borderWidth={2} className="rounded-full" />
              <div className="absolute inset-0 flex flex-col items-center justify-center z-30">
                <span className="text-sky-blue font-black text-xs sm:text-sm uppercase tracking-[0.3em] mb-1">{t("hero_score_label")}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-6xl sm:text-8xl font-black tracking-tighter text-foreground">{weatherData.score}</span>
                  <span className="text-sm sm:text-xl font-black text-foreground/70">{t("hero_unit")}</span>
                </div>
                {weatherData.score >= 80 && (
                  <div className="mt-2 text-[10px] sm:text-xs font-black text-sky-blue bg-sky-blue/10 px-3 py-1 rounded-full border border-sky-blue/20 animate-pulse">
                    {t("hero_best_day")}
                  </div>
                )}
              </div>
            </div>
          )}

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
        <PicnicBriefing weatherData={weatherData} />
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
        </div>
      </footer>
    </main>
  )
}
