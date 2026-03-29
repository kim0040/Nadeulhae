"use client"

import { Cloud, CloudMoon, CloudRain, Droplets, Sun } from "lucide-react"

import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

export interface HourlyForecastItem {
  date: string
  time: string
  temp: number
  sky: string
  precipChance: number
  precipAmount: string
}

interface TodayHourlyForecastProps {
  items: HourlyForecastItem[]
}

function parseHour(time: string) {
  return Number(time.slice(0, 2))
}

function parseMinute(time: string) {
  return Number(time.slice(2, 4))
}

function getMinutesFromStart(baseTime: string, targetTime: string) {
  const baseHour = parseHour(baseTime)
  const targetHour = parseHour(targetTime)
  const baseMinute = parseMinute(baseTime)
  const targetMinute = parseMinute(targetTime)
  return (targetHour * 60 + targetMinute) - (baseHour * 60 + baseMinute)
}

function formatTime(time: string, language: "ko" | "en") {
  if (!time || time.length !== 4) return "--:--"
  const hour = parseHour(time)
  const minute = time.slice(2, 4)
  if (language === "ko") {
    return `${hour}시${minute === "00" ? "" : ` ${minute}분`}`
  }
  const period = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 || 12
  return `${hour12}:${minute} ${period}`
}

function localizeSky(sky: string, language: "ko" | "en") {
  if (language === "ko") return sky
  if (sky.includes("맑음")) return "Sunny"
  if (sky.includes("구름")) return "Partly Cloudy"
  if (sky.includes("흐림")) return "Cloudy"
  if (sky.includes("비")) return "Rain"
  if (sky.includes("눈")) return "Snow"
  if (sky.includes("소나기")) return "Shower"
  return sky
}

function getSlotLabel(item: HourlyForecastItem, index: number, startTime: string, baseDate: string, language: "ko" | "en") {
  const hour = parseHour(item.time)
  const diffMinutes = getMinutesFromStart(startTime, item.time)
  const isNextDay = item.date !== baseDate

  if (index === 0) return language === "ko" ? "지금" : "Now"
  if (isNextDay && hour < 12) return language === "ko" ? "내일 아침" : "Tomorrow AM"
  if (isNextDay) return language === "ko" ? "내일" : "Tomorrow"
  if (hour >= 21) return language === "ko" ? "늦은 밤" : "Late night"
  if (hour >= 18) return language === "ko" ? "저녁" : "Evening"
  if (hour >= 12) return language === "ko" ? "오후" : "Afternoon"
  if (diffMinutes >= 180) {
    const diffHour = Math.round(diffMinutes / 60)
    return language === "ko" ? `${diffHour}시간 뒤` : `In ${diffHour}h`
  }
  return language === "ko" ? "곧" : "Soon"
}

function WeatherIcon({ sky, night }: { sky: string; night: boolean }) {
  if (sky.includes("비") || sky.includes("눈") || sky.includes("소나기")) {
    return <CloudRain size={18} className="text-active-blue" />
  }
  if (sky.includes("맑음")) {
    return night
      ? <CloudMoon size={18} className="text-foreground/70 dark:text-foreground/75" />
      : <Sun size={18} className="text-yellow-500" />
  }
  return <Cloud size={18} className={night ? "text-foreground/65 dark:text-foreground/70" : "text-muted-foreground"} />
}

export function TodayHourlyForecast({ items }: TodayHourlyForecastProps) {
  const { language } = useLanguage()

  if (!items.length) return null

  const startTime = items[0]?.time || "0000"
  const baseDate = items[0]?.date || ""
  const rainStart = items.find((item) => item.precipChance >= 50 || /비|눈|소나기/.test(item.sky))

  return (
    <section className="mt-8 mb-10">
      <div className="rounded-[2.7rem] border border-card-border bg-card px-5 py-5 shadow-[0_22px_55px_-36px_rgba(47,111,228,0.18)] ring-1 ring-active-blue/8 transition-colors sm:px-6 sm:py-6">
        <div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h3 className="text-[1.7rem] sm:text-[2.05rem] font-black tracking-tight text-foreground">
                {language === "ko" ? "시간대별 날씨" : "Hourly Forecast"}
              </h3>
            </div>

            {rainStart ? (
              <div className="inline-flex items-center gap-2 self-start rounded-full border border-active-blue/25 bg-active-blue/8 px-3 py-1.5 text-xs sm:text-sm font-black tracking-wide text-active-blue shadow-[0_10px_24px_-18px_rgba(47,111,228,0.28)]">
                <Droplets size={13} />
                {language === "ko"
                  ? `비 시작 예상 ${formatTime(rainStart.time, language)}`
                  : `Rain likely ${formatTime(rainStart.time, language)}`}
              </div>
            ) : null}
          </div>

          <div className="mt-5 overflow-hidden rounded-[2rem] border border-border/80 bg-[var(--interactive)] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] transition-colors dark:border-white/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="relative">
              <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar sm:gap-0">
                {items.map((item, index) => {
                  const night = parseHour(item.time) >= 18 || parseHour(item.time) <= 5
                  const hasRain = item.precipChance >= 50 || /비|눈|소나기/.test(item.sky)
                  const isLead = index === 0

                  return (
                    <div
                      key={`${item.date}-${item.time}`}
                      className={cn(
                        "relative min-w-[128px] shrink-0 px-3 sm:min-w-[140px]",
                        index !== items.length - 1 && "after:absolute after:right-0 after:top-4 after:hidden after:h-[70%] after:w-px after:bg-border after:opacity-80 sm:after:block dark:after:bg-white/12"
                      )}
                    >
                      <div className={cn(
                        "rounded-[1.6rem] border px-3 py-3 transition-colors",
                        isLead
                          ? "border-active-blue/22 bg-card shadow-[0_18px_44px_-34px_rgba(47,111,228,0.24)]"
                          : night
                            ? "border-border/85 bg-foreground/[0.03] dark:border-white/10 dark:bg-white/[0.04]"
                            : "border-border/85 bg-card/70 dark:border-white/10"
                      )}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn(
                            "text-[11px] font-black uppercase tracking-[0.18em]",
                            hasRain
                              ? "text-active-blue"
                              : night
                                ? "text-foreground/55 dark:text-foreground/60"
                                : "text-muted-foreground"
                          )}>
                            {getSlotLabel(item, index, startTime, baseDate, language)}
                          </span>
                          <span className={cn(
                            "size-2.5 rounded-full",
                            hasRain
                              ? "bg-active-blue shadow-[0_0_18px_rgba(47,111,228,0.45)]"
                              : night
                                ? "bg-foreground/35 dark:bg-foreground/45"
                                : "bg-nature-green/80"
                          )} />
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-base sm:text-lg font-black text-foreground">
                              {formatTime(item.time, language)}
                            </div>
                            <div className="mt-1 text-xs sm:text-sm font-bold text-muted-foreground">
                              {localizeSky(item.sky, language)}
                            </div>
                          </div>
                          <div className={cn(
                            "flex size-10 items-center justify-center rounded-[1rem] border",
                            hasRain
                              ? "border-active-blue/20 bg-active-blue/10"
                              : night
                                ? "border-border bg-card/80 dark:bg-white/[0.04]"
                                : "border-border bg-card/80"
                          )}>
                            <WeatherIcon sky={item.sky} night={night} />
                          </div>
                        </div>

                        <div className="mt-4 text-[1.8rem] sm:text-[2.1rem] font-black tracking-tight text-foreground">
                          {item.temp}°
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="text-xs sm:text-sm font-bold text-muted-foreground">
                            {language === "ko" ? `강수 ${item.precipChance}%` : `Rain ${item.precipChance}%`}
                          </div>
                          <div className={cn(
                            "text-xs sm:text-sm font-black",
                            hasRain ? "text-active-blue" : "text-muted-foreground"
                          )}>
                            {item.precipAmount}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      ` }} />
    </section>
  )
}
