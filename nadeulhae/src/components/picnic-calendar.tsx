"use client"

import { useState, useEffect } from "react"
import { format, isSameDay } from "date-fns"
import { ko, enUS } from "date-fns/locale"
import { Sparkles, Cloud, Sun, CloudRain } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/context/LanguageContext"

interface PicnicCalendarProps {
  useGeolocation?: boolean
}

export function PicnicCalendar({ useGeolocation = true }: PicnicCalendarProps) {
  const { language, t } = useLanguage()
  const [forecast, setForecast] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const locale = language === "ko" ? ko : enUS
  const todayLabel = language === "ko" ? "오늘" : "Today"
  const forecastTitle = language === "ko" ? "10일 예보" : "10-Day Forecast"
  const rainChanceLabel = language === "ko" ? "강수확률" : "Rain Chance"
  const rainAmountLabel = language === "ko" ? "예상 강수" : "Expected Rain"
  const outdoorTipLabel = language === "ko" ? "야외 팁" : "Outdoor Tip"
  const pointLabel = language === "ko" ? "점" : "Pts"

  useEffect(() => {
    const fetchForecast = async (lat?: number, lon?: number) => {
      try {
        setIsLoading(true)
        const query = (lat && lon) ? `?lat=${lat}&lon=${lon}` : '';
        const res = await fetch(`/api/weather/forecast${query}`);
        const data = await res.json();
        setForecast(data);
      } catch (e) {
        console.error("Forecast fetch error:", e);
      } finally {
        setIsLoading(false)
      }
    };

    if (!useGeolocation) {
      fetchForecast()
      return
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchForecast(pos.coords.latitude, pos.coords.longitude),
        () => fetchForecast() // 거부 시 기본 전주 예보
      );
    } else {
      fetchForecast(); // 미지원 시 기본 전주 예보
    }
  }, [useGeolocation]);

  const today = new Date()

  return (
    <div className="w-full max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-baseline justify-between mb-8 gap-4 px-2">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-2">
            {forecastTitle}
          </h2>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            {forecast?.location || "Loading..."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-nature-green bg-nature-green/10 px-4 py-1.5 rounded-full border border-nature-green/20">
          <Sparkles size={16} className="animate-pulse" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em]">{t("cal_legend")}</span>
        </div>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="relative w-full overflow-hidden rounded-[2.5rem]">
        {/* Magic gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-nature-green/8 via-transparent to-active-blue/8 pointer-events-none" />

        <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 sm:gap-6 px-4 py-8 relative z-10">
          <AnimatePresence>
            {isLoading ? (
               <div className="w-full flex justify-center py-20 text-nature-green animate-pulse font-bold tracking-widest uppercase">{language === "ko" ? "예보 불러오는 중..." : "Loading Forecast..."}</div>
            ) : forecast?.daily?.map((dayForecast: any, i: number) => {
              const dayDate = new Date(dayForecast.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
              const isToday = isSameDay(dayDate, today)
              const isRecommended = dayForecast.score >= 80
              const isWetDay = dayForecast.sky?.includes("비") || dayForecast.sky?.includes("눈") || dayForecast.precipChance >= 60
              let advice = ""
              if (isWetDay) {
                advice = language === "ko"
                  ? "우산은 필수! 비 오는 창밖 풍경을 즐길 수 있는 카페를 추천해요."
                  : "Stay dry! How about a cafe with a nice rain view?"
              } else if (dayForecast.tempMax > 28) {
                advice = language === "ko"
                  ? "날씨가 꽤 더워요. 시원한 실내 전시회나 쇼핑몰 나들이는 어떨까요?"
                  : "It's quite hot. Consider visiting a cool exhibition or a shopping mall."
              } else if (dayForecast.tempMax < 12) {
                advice = language === "ko"
                  ? "찬바람이 불어요. 따뜻한 차 한 잔과 함께 실내에서 여유를 즐겨보세요."
                  : "Cold winds expected. Enjoy some warm tea or indoor relaxation."
              } else if (dayForecast.score >= 85) {
                advice = language === "ko"
                  ? "피크닉 가기 최적의 날! 돗자리를 챙겨 공원으로 지금 바로 떠나보세요."
                  : "Ideal for a picnic! Head to the park with a picnic mat right now."
              } else if (dayForecast.score >= 70) {
                advice = language === "ko"
                  ? "산책이나 가벼운 야외 활동을 하기에 딱 좋은 날씨입니다."
                  : "Great weather for a stroll or light outdoor activities."
              } else {
                advice = language === "ko"
                  ? "가벼운 외출을 즐기기에 적합한 날씨입니다. 즐거운 하루 되세요!"
                  : "Suitable for a quick outing. Have a great day!"
              }

              const cardContent = (
                <div className={cn(
                  "h-full flex flex-col justify-between p-6 bg-card border rounded-[2.5rem] shadow-[0_22px_55px_-32px_rgba(47,111,228,0.22)] overflow-hidden",
                  isRecommended ? "border-nature-green/30" : "border-card-border"
                )}>
                  {/* Top: Date & Today Badge */}
                  <div className="w-full flex justify-between items-start mb-5 gap-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">
                        {format(dayDate, "EEE", { locale })}
                      </span>
                      <span className="text-3xl font-black text-foreground leading-none">
                        {format(dayDate, "d")}
                      </span>
                    </div>
                    {(isToday || isRecommended) && (
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {isToday && (
                          <span className="px-2.5 py-1 rounded-full bg-nature-green/20 text-nature-green text-[9px] font-black uppercase tracking-widest border border-nature-green/30">
                            {todayLabel}
                          </span>
                        )}
                        {isRecommended && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-nature-green/25 bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-nature-green shadow-md dark:bg-card">
                            <Sparkles size={12} />
                            {language === "ko" ? "추천" : "Best"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Middle: Icon & Sky */}
                  <div className="flex flex-col items-center my-4 min-h-[138px]">
                    <div className={cn(
                      "size-20 rounded-[1.75rem] flex items-center justify-center border transition-transform group-hover:scale-105",
                      isRecommended
                        ? "bg-nature-green/10 border-nature-green/20"
                        : isWetDay
                          ? "bg-active-blue/10 border-active-blue/20"
                          : "bg-[var(--interactive)] border-[var(--interactive-border)]"
                    )}>
                      <div className={cn(
                      "transition-transform",
                      isRecommended ? "text-nature-green" : dayForecast.sky?.includes("비") ? "text-active-blue" : "text-nature-green/80"
                    )}>
                        {dayForecast.sky?.includes("맑음") ? <Sun size={36} strokeWidth={2.5} /> : dayForecast.sky?.includes("비") || dayForecast.sky?.includes("눈") ? <CloudRain size={36} strokeWidth={2.5} /> : <Cloud size={36} strokeWidth={2.5} />}
                      </div>
                    </div>
                    <span className="text-2xl sm:text-3xl font-black mt-4 text-foreground text-center break-words line-clamp-2 min-h-[4rem]">
                      {dayForecast.sky}
                    </span>
                    <span className="text-sm font-bold mt-1 text-muted-foreground text-center break-words min-h-[3.25rem]">
                      {advice}
                    </span>
                  </div>

                  {/* Bottom: Temp and Details */}
                  <div className="w-full flex flex-col gap-3 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-[1.35rem] border border-border bg-[var(--interactive)] px-4 py-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Min / Max</div>
                        <div className="flex items-center justify-between text-sm font-black">
                          <span className="text-blue-500 dark:text-blue-400">{dayForecast.tempMin}°</span>
                          <span className="text-red-500 dark:text-red-400">{dayForecast.tempMax}°</span>
                        </div>
                      </div>
                      <div className="rounded-[1.35rem] border border-border bg-[var(--interactive)] px-4 py-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{rainChanceLabel}</div>
                        <div className="text-xl font-black text-foreground">{dayForecast.precipChance ?? 0}%</div>
                      </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-border bg-[var(--interactive)] px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{rainAmountLabel}</div>
                      <div className="text-base font-black text-foreground break-words">{dayForecast.precipAmount || "0mm"}</div>
                    </div>

                    <div className="rounded-[1.35rem] border border-border bg-[var(--interactive)] px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{outdoorTipLabel}</div>
                      <div className="text-xs sm:text-sm font-bold text-foreground/80 break-words">
                        {advice}
                      </div>
                    </div>

                    <div className={cn(
                      "w-full text-center py-3 rounded-[1.1rem] text-sm font-black uppercase tracking-wider transition-colors border",
                      isRecommended ? "bg-gradient-to-r from-nature-green to-active-blue text-white border-transparent shadow-[0_10px_24px_-12px_rgba(47,111,228,0.45)]" : "bg-transparent text-muted-foreground border-border hover:bg-muted"
                    )}>
                      {dayForecast.score} {pointLabel}
                    </div>
                  </div>
                </div>
              )

              return (
                <motion.div
                  key={dayForecast.date}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="snap-center sm:snap-start shrink-0 w-[260px] min-h-[420px] group cursor-pointer relative"
                >
                  {cardContent}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Attribution */}
      <div className="mt-8 flex justify-end items-center gap-2 px-4 opacity-50">
        <div className="size-2 rounded-full bg-nature-green animate-pulse" />
        <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground">
          Source: {forecast?.metadata?.dataSource || "기상청"} (Updated: {forecast?.metadata?.lastUpdate || "--:--"})
        </span>
      </div>

      {/* Tailwind Hide Scrollbar override */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  )
}
