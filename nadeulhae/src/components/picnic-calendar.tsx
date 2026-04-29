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

  const translateWeatherText = (text?: string) => {
    if (!text) return "--"
    if (language === "ko") return text

    return text
      .replace(/구름많음/g, "Mostly Cloudy")
      .replace(/흐림/g, "Cloudy")
      .replace(/맑음/g, "Clear")
      .replace(/비\/눈/g, "Rain / Snow")
      .replace(/비와 눈/g, "Rain / Snow")
      .replace(/소나기/g, "Showers")
      .replace(/비/g, "Rain")
      .replace(/눈/g, "Snow")
  }

  const translatePrecipAmount = (value?: string) => {
    const base = value || "0mm"
    if (language === "ko") return base
    return base
      .replace(/강수없음/g, "No precipitation")
      .replace(/없음/g, "None")
      .replace(/1mm 미만/g, "<1mm")
      .replace(/미만/g, "under")
  }

  const translateLocation = (value?: string) => {
    if (!value) return "Loading..."
    if (language === "ko") return value
    return value
      .replace(/전주/g, "Jeonju")
      .replace(/서울/g, "Seoul")
      .replace(/광주/g, "Gwangju")
      .replace(/부산/g, "Busan")
      .replace(/대전/g, "Daejeon")
      .replace(/울산/g, "Ulsan")
      .replace(/인천/g, "Incheon")
      .replace(/대구/g, "Daegu")
      .replace(/세종/g, "Sejong")
      .replace(/광양/g, "Gwangyang")
      .replace(/제주/g, "Jeju")
  }

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
            {translateLocation(forecast?.location)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-nature-green bg-nature-green/10 px-4 py-1.5 rounded-full border border-nature-green/20">
          <Sparkles size={16} className="animate-pulse" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em]">{t("cal_legend")}</span>
        </div>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="relative w-full">
        <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 sm:gap-6 py-6 relative z-10">
          <AnimatePresence>
            {isLoading ? (
               <div className="w-full flex justify-center py-20 text-nature-green animate-pulse font-bold tracking-widest uppercase">{language === "ko" ? "예보 불러오는 중..." : "Loading Forecast..."}</div>
            ) : forecast?.daily?.map((dayForecast: any, i: number) => {
              const dayDate = new Date(dayForecast.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
              const isToday = isSameDay(dayDate, today)
              const isRecommended = dayForecast.score >= 80
              const localizedSky = translateWeatherText(dayForecast.sky)
              const localizedPrecipAmount = translatePrecipAmount(dayForecast.precipAmount)
              const isWetDay = dayForecast.sky?.includes("비") || dayForecast.sky?.includes("눈") || dayForecast.precipChance >= 60
              let advice = ""
              // Deterministic variety: same day always same tip, different days vary
              const tipSeed = (dayForecast.date?.length || 0) + (dayForecast.score || 0) + (dayForecast.tempMax || 0)
              const pick = (arr: string[]) => arr[Math.abs(tipSeed) % arr.length]

              if (isWetDay) {
                advice = pick(language === "ko" ? [
                  "우산은 필수! 비 오는 창밖 풍경을 즐길 수 있는 카페를 추천해요.",
                  "비 오는 날엔 전주 한옥마을 실내 체험이 제격이에요.",
                  "우산 챙기고 전주천변 카페에서 여유를 즐겨보세요.",
                  "비 소리 들으며 전주 전통차 한잔 어떠세요?",
                ] : [
                  "Stay dry! How about a cafe with a nice rain view?",
                  "Rainy day? Try indoor activities in Jeonju Hanok Village.",
                  "Grab an umbrella and enjoy a cafe by Jeonjucheon Stream.",
                  "Listen to the rain with a warm cup of Korean tea.",
                ])
              } else if (dayForecast.tempMax > 30) {
                advice = pick(language === "ko" ? [
                  "한낮 더위가 심해요. 시원한 실내 전시회나 쇼핑몰 나들이는 어떨까요?",
                  "무더위엔 전주 박물관 투어가 딱이에요. 에어컨 아래서 문화 탐방!",
                  "폭염 수준이니 야외 활동은 아침이나 저녁으로 미루는 게 좋겠어요.",
                  "더운 날엔 실내에서 즐기는 전주 전통 공예 체험을 추천해요.",
                ] : [
                  "Very hot today. How about a cool museum or shopping mall?",
                  "Perfect day for Jeonju museum tours — culture in air conditioning!",
                  "Heat advisory level — save outdoor plans for morning or evening.",
                  "Try indoor Jeonju craft workshops to beat the heat.",
                ])
              } else if (dayForecast.tempMax > 26) {
                advice = pick(language === "ko" ? [
                  "날씨가 꽤 더워요. 그늘 많은 덕진공원 산책로를 추천해요.",
                  "더위를 피해 전주 실내 명소를 돌아보는 건 어떨까요?",
                  "따뜻한 날엔 가벼운 나들이 후 시원한 팥빙수 한 그릇!",
                ] : [
                  "Quite warm. Try the shaded trails at Deokjin Park.",
                  "Beat the heat with Jeonju's indoor attractions.",
                  "A light outing followed by some cold patbingsu sounds perfect.",
                ])
              } else if (dayForecast.tempMax < 8) {
                advice = pick(language === "ko" ? [
                  "찬바람이 불어요. 따뜻한 차 한 잔과 함께 실내에서 여유를 즐겨보세요.",
                  "추운 날엔 전주 전통 찻집에서 몸을 녹이는 건 어떨까요?",
                  "한파 수준이니 야외는 짧게, 실내 위주로 계획하세요.",
                ] : [
                  "Cold winds expected. Enjoy warm tea and indoor relaxation.",
                  "Chilly day — warm up at a traditional Jeonju tea house.",
                  "Bundle up! Keep outdoor time short and cozy up indoors.",
                ])
              } else if (dayForecast.tempMax < 14) {
                advice = pick(language === "ko" ? [
                  "선선한 날씨예요. 가벼운 외투 챙겨서 전주 골목 산책 떠나볼까요?",
                  "쌀쌀하지만 산책하기 좋은 날이에요. 전주 한옥마을 골목 투어 추천!",
                  "초봄·초가을 느낌의 날씨. 가볍게 야외에서 시간 보내기 좋아요.",
                ] : [
                  "Crisp weather. Grab a light jacket for a Jeonju alley walk.",
                  "A bit chilly but perfect for a Hanok Village stroll.",
                  "Early spring/fall vibes — great for casual outdoor time.",
                ])
              } else if (dayForecast.score >= 90) {
                advice = pick(language === "ko" ? [
                  "피크닉 가기 최적의 날! 돗자리를 챙겨 공원으로 지금 바로 떠나보세요.",
                  "오늘은 진짜 나들이 데이! 전주 세병호에서 자전거 타기 딱 좋아요.",
                  "맑은 하늘 아래 전주천변을 따라 걸으면 하루가 행복해질 거예요.",
                ] : [
                  "Ideal for a picnic! Head to the park with a picnic mat right now.",
                  "Perfect outing day! Great for biking around Sebyeong Lake.",
                  "Walk along Jeonjucheon under clear skies — pure happiness.",
                ])
              } else if (dayForecast.score >= 80) {
                advice = pick(language === "ko" ? [
                  "산책이나 가벼운 야외 활동을 하기에 딱 좋은 날씨입니다.",
                  "덕진공원 연꽃길을 따라 여유롭게 걸어보세요. 기분 좋은 하루!",
                  "전주 동네 카페 투어하기 좋은 날이에요. 걸어서 즐겨보세요.",
                ] : [
                  "Great weather for a stroll or light outdoor activities.",
                  "Take a relaxing walk along Deokjin Park's lotus path.",
                  "Perfect day for a Jeonju neighborhood cafe walking tour.",
                ])
              } else if (dayForecast.score >= 60) {
                advice = pick(language === "ko" ? [
                  "무난한 나들이 날씨. 짧은 외출로 기분 전환하기 좋아요.",
                  "야외도 괜찮지만 실내 대안도 준비해두면 더 좋은 하루예요.",
                  "전주 근교 짧은 드라이브 코스를 추천해요.",
                ] : [
                  "Decent outing weather. A short trip outdoors would be refreshing.",
                  "Outdoor plans work, but keep an indoor backup just in case.",
                  "A short drive around Jeonju outskirts sounds nice today.",
                ])
              } else {
                advice = pick(language === "ko" ? [
                  "가벼운 외출을 즐기기에 적합한 날씨입니다. 즐거운 하루 되세요!",
                  "실내 위주로 계획하고 짧은 산책 정도면 괜찮은 날이에요.",
                  "전주 실내 명소(전주공예품전시관, 전주역사박물관 등)를 추천해요.",
                  "컨디션에 따라 유연하게 동선을 바꾸는 게 좋은 날입니다.",
                ] : [
                  "Suitable for a quick outing. Have a great day!",
                  "Stick to indoor plans with an optional short walk outside.",
                  "Check out Jeonju indoor spots — craft museum, history museum, etc.",
                  "A flexible day — adjust plans based on how you feel.",
                ])
              }

              const cardContent = (
                <div className={cn(
                  "h-full flex flex-col justify-between p-6 bg-card border rounded-[2.5rem] shadow-[0_22px_55px_-32px_rgba(47,111,228,0.22)] overflow-hidden transition-colors",
                  isToday
                    ? "border-active-blue/35 bg-gradient-to-b from-active-blue/8 via-card to-card shadow-[0_24px_60px_-34px_rgba(47,111,228,0.35)]"
                    : isRecommended
                      ? "border-nature-green/30"
                      : "border-card-border"
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
                          <span className="px-2.5 py-1 rounded-full bg-active-blue/12 text-active-blue text-[9px] font-black uppercase tracking-widest border border-active-blue/25 shadow-sm">
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
                      {localizedSky}
                    </span>

                  </div>

                  {/* Bottom: Temp and Details */}
                  <div className="w-full flex flex-col gap-3 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-[1.35rem] border border-border bg-[var(--interactive)] px-4 py-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Min / Max</div>
                        <div className="flex items-center justify-between text-base sm:text-lg font-black">
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
                      <div className="text-base font-black text-foreground break-words">{localizedPrecipAmount}</div>
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
          {language === "ko" ? "출처" : "Source"}: {language === "ko" ? (forecast?.metadata?.dataSource || "기상청") : "KMA"} ({language === "ko" ? "업데이트" : "Updated"}: {forecast?.metadata?.lastUpdate || "--:--"})
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
