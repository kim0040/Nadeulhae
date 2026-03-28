"use client"

import { useLanguage } from "@/context/LanguageContext"
import { WeatherData } from "@/services/dataService"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Sparkles, CheckCircle2, AlertCircle, Wind, Thermometer,
  Info, Clock, Database, Droplets, Cloud, CloudRain, ShieldCheck, Zap,
  Navigation, Sun, TriangleAlert
} from "lucide-react"

interface PicnicBriefingProps {
  weatherData: WeatherData
}

interface BriefingPoint {
  icon: React.ReactNode
  text: string
  type: "success" | "warning" | "info" | "neutral"
  fullWidth?: boolean
}

type BulletinSegment = {
  label: string
  text: string
}

type BulletinTagTone = "danger" | "caution" | "info" | "neutral"

type BulletinTag = {
  label: string
  tone: BulletinTagTone
}

export function PicnicBriefing({ weatherData }: PicnicBriefingProps) {
  const { t, language } = useLanguage()
  const { details, metadata, eventData, isFallback } = weatherData
  const regionLabel = language === "ko"
    ? metadata?.region || "현재 지역"
    : metadata?.regionEn || metadata?.region || "your area"

  const formatBriefing = (key: string, values: Record<string, string | number>) => {
    const template = t(key)
    if (template === key) return "" // Key not found
    let text = template
    Object.entries(values).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v))
    })
    return text
  }

  const parseBulletinSummary = (summary: string) => {
    const normalized = summary.replace(/\s+/g, " ").trim()
    const cleanedSummary = normalized.replace(/^□\s*\(([^)]+)\)\s*/, "").trim()
    const splitItems = cleanedSummary.split(/\s(?=○\s*\()/).filter(Boolean)
    const headline = splitItems[0]?.startsWith("○")
      ? (language === "ko" ? "현재 공식 통보 요약입니다." : "This is the latest official bulletin summary.")
      : splitItems.shift() || (language === "ko" ? "현재 공식 통보에 특이사항이 없습니다." : "No notable official bulletin right now.")
    const segments: BulletinSegment[] = splitItems
      .map((item) => item.replace(/^○\s*/, "").trim())
      .map((item) => {
        const match = item.match(/^\(([^)]+)\)\s*(.*)$/)
        if (!match) {
          return {
            label: language === "ko" ? "안내" : "Note",
            text: item,
          }
        }
        return {
          label: match[1],
          text: match[2],
        }
      })

    return {
      headline,
      segments: segments.slice(0, 3),
    }
  }

  const getBulletinTone = (text: string): BulletinTagTone => {
    const normalized = text.replace(/\s+/g, "")
    if (/특보|호우|대설|태풍|강풍|폭염|한파|지진|산불|화재/.test(normalized)) return "danger"
    if (/건조|비|소나기|눈|안개|황사|미세먼지|기온차|결빙/.test(normalized)) return "caution"
    if (/맑음|구름|흐림|예보|전망/.test(normalized)) return "info"
    return "neutral"
  }

  const getBulletinTags = (text: string) => {
    const entries = [
      {
        match: /건조|산불|화재/,
        ko: "건조·화재",
        en: "Dry / Fire",
        tone: "danger" as const,
      },
      {
        match: /호우|비|소나기/,
        ko: "강수",
        en: "Rain",
        tone: "caution" as const,
      },
      {
        match: /대설|눈|결빙/,
        ko: "눈·결빙",
        en: "Snow / Ice",
        tone: "caution" as const,
      },
      {
        match: /강풍|태풍/,
        ko: "강풍",
        en: "Strong Wind",
        tone: "danger" as const,
      },
      {
        match: /안개/,
        ko: "안개",
        en: "Fog",
        tone: "info" as const,
      },
      {
        match: /황사|미세먼지/,
        ko: "대기질",
        en: "Air Quality",
        tone: "caution" as const,
      },
      {
        match: /기온차|폭염|한파/,
        ko: "기온 변화",
        en: "Temperature",
        tone: "caution" as const,
      },
    ]

    return entries
      .filter((entry) => entry.match.test(text))
      .map((entry) => ({
        label: language === "ko" ? entry.ko : entry.en,
        tone: entry.tone,
      }))
  }

  const getToneClasses = (tone: BulletinTagTone) => {
    switch (tone) {
      case "danger":
        return "border-red-500/20 bg-red-500/8 text-red-600 dark:text-red-300"
      case "caution":
        return "border-orange-500/20 bg-orange-500/8 text-orange-600 dark:text-orange-300"
      case "info":
        return "border-sky-blue/20 bg-sky-blue/8 text-sky-blue"
      default:
        return "border-border bg-card text-foreground/80"
    }
  }

  const getScoreNarrative = () => {
    const breakdown = metadata?.scoreBreakdown
    if (!breakdown) return null

    if (breakdown.knockout === "warning") {
      return {
        text: language === "ko"
          ? "기상특보 또는 지진 정보가 감지되어 피크닉 지수는 즉시 0점으로 처리됩니다."
          : "An active weather warning or earthquake bulletin triggers the knock-out rule, so the picnic score is forced to 0.",
        type: "warning" as const,
        icon: <AlertCircle size={18} />,
        fullWidth: true,
      }
    }

    if (breakdown.knockout === "rain") {
      return {
        text: language === "ko"
          ? "현재 강수가 감지되어 피크닉 지수는 즉시 10점으로 고정됩니다. 다른 항목 계산은 생략합니다."
          : "Current precipitation is detected, so the picnic score is fixed at 10 and the rest of the calculation is skipped.",
        type: "warning" as const,
        icon: <CloudRain size={18} />,
        fullWidth: true,
      }
    }

    return {
      text: language === "ko"
        ? `현재 지수는 대기질 ${breakdown.air}점, 기온 ${breakdown.temperature}점, 하늘 ${breakdown.sky}점, 바람 ${breakdown.wind}점을 합산한 총 ${breakdown.total}점입니다.`
        : `Today's score is ${breakdown.total}, built from air ${breakdown.air}, temperature ${breakdown.temperature}, sky ${breakdown.sky}, and wind ${breakdown.wind}.`,
      type: "neutral" as const,
      icon: <ShieldCheck size={18} />,
      fullWidth: true,
    }
  }

  // 1. 풍부한 상황별 나들이 멘트 (Enhanced Logic)
  const getBriefingQuotes = (): BriefingPoint[] => {
    const points: BriefingPoint[] = []
    const scoreNarrative = getScoreNarrative()

    if (scoreNarrative) {
      points.push(scoreNarrative)
    }
    
    // -- Temperature --
    const temp = details.temp
    if (temp < 5) {
      points.push({ text: formatBriefing("brief_temp_v_cold", { temp }), type: "warning", icon: <AlertCircle size={18} /> })
    } else if (temp < 15) {
      points.push({ text: formatBriefing("brief_temp_cold", { temp }), type: "info", icon: <Thermometer size={18} /> })
    } else if (temp < 20) {
      points.push({ text: formatBriefing("brief_temp_mild", { temp }), type: "success", icon: <Thermometer size={18} /> })
    } else if (temp <= 25) {
      points.push({ text: formatBriefing("brief_temp_perfect", { temp }), type: "success", icon: <CheckCircle2 size={18} /> })
    } else if (temp <= 30) {
      points.push({ text: formatBriefing("brief_temp_warm", { temp }), type: "success", icon: <Sun size={18} /> })
    } else {
      points.push({ text: formatBriefing("brief_temp_v_hot", { temp }), type: "warning", icon: <AlertCircle size={18} /> })
    }

    // -- Dust & Air --
    const pm10 = details.pm10 || 0
    if (pm10 > 0) {
      if (pm10 <= 30) {
        points.push({
          text: language === "ko"
            ? `${regionLabel}의 미세먼지 농도는 ${pm10}µg/m³로 매우 낮아 공기가 맑고 깨끗합니다.`
            : `PM10 in ${regionLabel} is ${pm10}µg/m³, so the air is exceptionally clean right now.`,
          type: "success",
          icon: <Sparkles size={18} />,
        })
      } else if (pm10 <= 80) {
        points.push({
          text: language === "ko"
            ? `${regionLabel}의 미세먼지 농도는 ${pm10}µg/m³로 보통 수준입니다. 민감하다면 대기 상태를 한 번 더 확인하세요.`
            : `PM10 in ${regionLabel} is ${pm10}µg/m³, which is moderate. Sensitive visitors should double-check the air conditions.`,
          type: "info",
          icon: <Info size={18} />,
        })
      } else {
        points.push({
          text: language === "ko"
            ? `${regionLabel}의 미세먼지 농도는 ${pm10}µg/m³로 높습니다. 실외 체류 시간을 줄이고 마스크 착용을 권장합니다.`
            : `PM10 in ${regionLabel} is ${pm10}µg/m³, which is high. Shorter outdoor stays and a mask are recommended.`,
          type: "warning",
          icon: <AlertCircle size={18} />,
        })
      }
    }

    // -- Wind --
    const wind = details.wind
    if (wind < 1.5) {
      points.push({ text: formatBriefing("brief_wind_calm", { wind }), type: "success", icon: <Wind size={18} /> })
    } else if (wind <= 5) {
      points.push({ text: formatBriefing("brief_wind_breezy", { wind }), type: "success", icon: <Wind size={18} /> })
    } else {
      points.push({ text: formatBriefing("brief_wind_strong", { wind }), type: "warning", icon: <AlertCircle size={18} /> })
    }

    // -- Humidity --
    const humi = details.humidity
    if (humi < 30) {
      points.push({ text: formatBriefing("brief_humi_dry", { humi }), type: "info", icon: <Droplets size={18} /> })
    } else if (humi > 70) {
      points.push({ text: formatBriefing("brief_humi_humid", { humi }), type: "info", icon: <Droplets size={18} /> })
    }

    // -- Precipitation --
    if (details.pty && details.pty > 0) {
      points.push({
        text: details.pty === 3 ? t("brief_pty_snow") : t("brief_pty_rain"),
        type: "warning",
        icon: <CloudRain size={18} />,
      })
    }

    if (eventData?.isWeatherWarning && eventData.warningMessage) {
      points.push({
        text: eventData.warningMessage,
        type: "warning",
        icon: <AlertCircle size={18} />,
        fullWidth: true,
      })
    }

    if (isFallback) {
      points.push({
        text: t("fallback_message"),
        type: "neutral",
        icon: <Info size={18} />,
        fullWidth: true,
      })
    }

    return points.filter(p => p.text !== "")
  }

  // 2. 상세 환경 수치 (Technical Data View)
  const getTechnicalPoints = () => [
    { label: t("hero_temp"), value: `${details.temp ?? "--"}°C`, icon: <Thermometer size={14} /> },
    { label: t("hero_humidity"), value: `${details.humidity ?? "--"}%`, icon: <Droplets size={14} /> },
    { label: t("hero_wind"), value: `${details.wind ?? "--"}m/s`, icon: <Wind size={14} /> },
    { label: t("hero_vec"), value: `${details.vec ?? "--"}°`, icon: <Navigation size={14} style={{ transform: `rotate(${details.vec || 0}deg)` }} /> },
    { label: t("hero_pm10"), value: `${details.pm10 ?? "--"}µg/m³`, icon: <Cloud size={14} /> },
    { label: t("hero_pm25"), value: `${details.pm25 ?? "--"}µg/m³`, icon: <Sparkles size={14} /> },
    { label: t("hero_o3"), value: `${details.o3 ?? "--"}ppm`, icon: <Zap size={14} /> },
    { label: t("hero_no2"), value: `${details.no2 ?? "--"}ppm`, icon: <Zap size={14} /> },
    { label: t("hero_khai"), value: `${details.khai ?? "--"}`, icon: <ShieldCheck size={14} /> },
    { label: t("hero_precip"), value: `${details.rn1 ?? "--"}mm`, icon: <CloudRain size={14} /> },
  ]

  const quotes = getBriefingQuotes()
  const techData = getTechnicalPoints()
  const bulletinSummary = metadata?.bulletin?.summary || (
    language === "ko" ? "현재 공식 통보문에 특이사항이 없습니다." : "No notable official bulletin right now."
  )
  const bulletin = parseBulletinSummary(bulletinSummary)
  const bulletinTags = getBulletinTags(`${bulletin.headline} ${bulletin.segments.map((segment) => segment.text).join(" ")}`)
  const sourceLabels = (() => {
    const sourceText = String(metadata?.dataSource || "")
    const labels: string[] = []
    if (/기상청|KMA/i.test(sourceText)) labels.push(t("data_source_kma"))
    if (/한국환경공단|AirKorea/i.test(sourceText)) labels.push(t("data_source_air"))
    return labels.length > 0 ? labels : [t("data_source_combined")]
  })()
  const hazardTitle = eventData?.isEarthquake
    ? (language === "ko" ? "지진 정보 감지" : "Earthquake bulletin detected")
    : eventData?.isWeatherWarning
      ? (language === "ko" ? "기상특보 발효" : "Active weather warning")
      : (language === "ko" ? "활성 특보 없음" : "No active warning")
  const hazardDetail = metadata?.alertSummary?.warningTitle
    || metadata?.alertSummary?.earthquakeTitle
    || (language === "ko" ? "평시 모니터링 중" : "Monitoring in normal state")
  const signalCards = [
    {
      label: language === "ko" ? "지역 · 측정소" : "Region · Station",
      title: language === "ko"
        ? `${metadata?.region || "현재 지역"} · ${metadata?.station || t("station_dukjin")}`
        : `${metadata?.regionEn || metadata?.region || "Current Area"} · ${metadata?.station || t("station_dukjin")}`,
      detail: isFallback
        ? t("fallback_message")
        : language === "ko"
          ? "현재 위치와 가장 가까운 권역 기준"
          : "Matched to the nearest reporting region",
      icon: <MapPinIcon size={16} className="text-sky-blue" />,
      tone: "text-sky-blue",
    },
    {
      label: language === "ko" ? "위험 상태" : "Hazard Status",
      title: hazardTitle,
      detail: hazardDetail,
      icon: <TriangleAlert size={16} className={cn(eventData?.isEarthquake || eventData?.isWeatherWarning ? "text-red-500" : "text-nature-green")} />,
      tone: eventData?.isEarthquake || eventData?.isWeatherWarning ? "text-red-500" : "text-nature-green",
    },
  ]

  const getUpdateTime = (type: 'kma' | 'air') => {
    if (typeof metadata?.lastUpdate === 'string') return metadata.lastUpdate
    if (type === 'kma') return (metadata?.lastUpdate as any)?.kma || "--:--"
    return (metadata?.lastUpdate as any)?.air || "--:--"
  }
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="w-full max-w-5xl mx-auto rounded-[3rem] bg-[var(--card)] border border-[var(--card-border)] shadow-2xl overflow-hidden"
    >
      {/* Header with Title and Station info */}
      <div className="p-8 sm:p-12 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-nature-green to-active-blue text-white shadow-lg shadow-active-blue/20">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight leading-none">{t("brief_title")}</h3>
              <p className="text-[10px] sm:text-xs font-black text-sky-blue uppercase tracking-[0.3em] mt-2 italic opacity-70">{t("brief_station_engine")}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-end">
               <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">{t("status_nearby_station")}</span>
               <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--interactive)] border border-[var(--interactive-border)]">
                 <MapPinIcon size={12} className="text-sky-blue" />
                 <span className="text-xs font-black text-foreground">{metadata?.station || t("station_dukjin")}</span>
               </div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {signalCards.map((card) => (
            <div
              key={card.label}
              className="rounded-[1.6rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5 min-w-0"
            >
              <div className="flex items-center gap-2 mb-3">
                {card.icon}
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">{card.label}</span>
              </div>
              <div className={cn("text-sm sm:text-base font-black leading-relaxed break-words", card.tone)}>
                {card.title}
              </div>
              <div className="mt-2 text-xs font-bold leading-relaxed text-muted-foreground break-words">
                {card.detail}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[1.85rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} className="text-sky-blue" />
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              {language === "ko" ? "공식 통보" : "Official Bulletin"}
            </span>
          </div>
          <div className="rounded-[1.4rem] border border-sky-blue/15 bg-card px-4 py-4">
            <p className="text-sm sm:text-base font-bold leading-relaxed text-foreground/90 break-words">
              {bulletin.headline}
            </p>
            {bulletinTags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {bulletinTags.map((tag) => (
                  <span
                    key={`${tag.label}-${tag.tone}`}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest",
                      getToneClasses(tag.tone)
                    )}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          {bulletin.segments.length > 0 && (
            <div className="mt-4 space-y-2">
              {bulletin.segments.map((segment) => (
                <div
                  key={`${segment.label}-${segment.text}`}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border px-4 py-3",
                    getToneClasses(getBulletinTone(segment.text))
                  )}
                >
                  <span className="shrink-0 rounded-full border border-current/10 bg-background/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-current shadow-sm dark:bg-background/60">
                    {segment.label}
                  </span>
                  <span className="text-sm font-bold leading-relaxed break-words text-current">
                    {segment.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 1. Conversational Briefing Summary (Key Highlights) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {quotes.map((quote, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "min-w-0 rounded-[1.5rem] border px-5 py-4 transition-all",
                quote.fullWidth && "lg:col-span-2",
                quote.type === "success" ? "bg-teal-400/5 border-teal-400/20 text-teal-600 dark:text-teal-400" :
                quote.type === "warning" ? "bg-orange-400/5 border-orange-400/20 text-orange-600 dark:text-orange-400" :
                quote.type === "neutral" ? "bg-[var(--interactive)] border-[var(--interactive-border)] text-foreground/85" :
                "bg-active-blue/5 border-active-blue/20 text-sky-blue"
              )}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="shrink-0 mt-0.5">{quote.icon}</div>
                <span className="text-sm sm:text-base font-bold leading-relaxed break-words">
                  {quote.text}
                </span>
              </div>
            </motion.div>
          ))}
        </div>


        {/* 2. Technical Data Grid (Full Parameters) */}
        <div className="p-8 rounded-[2.5rem] bg-[var(--interactive)] border border-[var(--interactive-border)]">
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-sky-blue animate-pulse" />
              <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{t("brief_observation_grid")}</h4>
            </div>
            <span className="text-[8px] sm:text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.15em]">{t("brief_nrs_protocol")}</span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-y-8 gap-x-6 relative z-10">
            {techData.map((item, i) => (
              <div key={i} className="flex flex-col items-start group">
                <div className="flex items-center gap-2 text-muted-foreground mb-2 group-hover:text-sky-blue transition-colors">
                  <div className="p-1 rounded-md bg-[var(--interactive)] border border-[var(--interactive-border)] transition-colors group-hover:bg-sky-blue/10">
                    {item.icon}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-foreground tabular-nums tracking-tighter break-words">
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer with Sync Status */}
      <div className="bg-[var(--interactive)] px-8 sm:px-12 py-6 border-t border-[var(--card-border)] flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-3">
             <Clock size={14} className="text-sky-blue opacity-50" />
             <div className="flex flex-col">
               <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">{t("brief_kma_sync")}</span>
               <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 italic">
                 {getUpdateTime('kma')} ({t(metadata?.intervals.kma || "interval_45m")})
               </span>
             </div>
          </div>
          <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 hidden sm:block" />
          <div className="flex items-center gap-3">
             <Database size={14} className="text-sky-blue opacity-50" />
             <div className="flex flex-col">
               <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">{t("brief_air_sync")}</span>
               <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 italic">
                 {getUpdateTime('air')} ({t(metadata?.intervals.air || "interval_0m")})
               </span>
             </div>
          </div>
          <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 hidden sm:block" />
          <div className="flex items-center gap-3">
             <Info size={14} className="text-sky-blue opacity-50" />
             <div className="flex flex-col">
               <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">{t("brief_data_source")}</span>
               <div className="mt-1 flex flex-wrap items-center gap-2">
                 {sourceLabels.map((source) => (
                     <span
                       key={source}
                       className="rounded-full border border-sky-blue/15 bg-sky-blue/8 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-sky-blue"
                     >
                       {source}
                     </span>
                   ))}
               </div>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-active-blue/5 border border-active-blue/20">
            <AlertCircle size={10} className="text-active-blue" />
            <span className="text-[8px] font-black text-active-blue uppercase tracking-widest">
              {t("status_coming_soon")}: {t("brief_ai_db_archive")}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Helper for Lucide icon
function MapPinIcon({ className, size }: { className?: string, size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  )
}
