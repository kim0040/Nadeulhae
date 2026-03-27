"use client"

import { useLanguage } from "@/context/LanguageContext"
import { WeatherData } from "@/services/dataService"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { 
  Sparkles, CheckCircle2, AlertCircle, Wind, Thermometer, 
  Info, Clock, Database, Droplets, Cloud, CloudRain, ShieldCheck, Zap,
  Navigation, Sun
} from "lucide-react"

interface PicnicBriefingProps {
  weatherData: WeatherData
}

interface BriefingPoint {
  icon: React.ReactNode
  text: string
  type: "success" | "warning" | "info" | "neutral"
}

export function PicnicBriefing({ weatherData }: PicnicBriefingProps) {
  const { t } = useLanguage()
  const { details, score, metadata } = weatherData

  const formatBriefing = (key: string, values: Record<string, string | number>) => {
    const template = t(key)
    if (template === key) return "" // Key not found
    let text = template
    Object.entries(values).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v))
    })
    return text
  }

  // 1. 풍부한 상황별 나들이 멘트 (Enhanced Logic)
  const getBriefingQuotes = (): BriefingPoint[] => {
    const points: BriefingPoint[] = []
    
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
        points.push({ text: formatBriefing("brief_dust_excel", { dust: `${pm10}µg/m³` }), type: "success", icon: <Sparkles size={18} /> })
      } else if (pm10 <= 80) {
        points.push({ text: formatBriefing("brief_dust_mod", { dust: `${pm10}µg/m³` }), type: "info", icon: <Info size={18} /> })
      } else {
        points.push({ text: formatBriefing("brief_dust_bad", { dust: `${pm10}µg/m³` }), type: "warning", icon: <AlertCircle size={18} /> })
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
      points.push({ text: t("brief_pty_rain"), type: "warning", icon: <CloudRain size={18} /> })
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
      className="w-full max-w-5xl mx-auto rounded-[3rem] bg-white/40 dark:bg-neutral-900/40 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-2xl overflow-hidden"
    >
      {/* Header with Title and Station info */}
      <div className="p-8 sm:p-12 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-sky-blue text-white shadow-lg shadow-sky-blue/20">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-2xl sm:text-4xl font-black text-foreground dark:text-white tracking-tight leading-none">{t("brief_title")}</h3>
              <p className="text-[10px] sm:text-xs font-black text-sky-blue uppercase tracking-[0.3em] mt-2 italic opacity-70">Situational Analysis Engine</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-end">
               <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">{t("status_nearby_station")}</span>
               <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-blue/10 border border-sky-blue/20">
                 <MapPinIcon size={12} className="text-sky-blue" />
                 <span className="text-xs font-black text-sky-blue">{metadata?.station || "Dukjin-dong"}</span>
               </div>
             </div>
          </div>
        </div>

        {/* 1. Conversational Briefing Summary (Key Highlights) */}
        <div className="flex flex-wrap gap-4 mb-12">
          {quotes.map((quote, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "flex items-center gap-3 px-6 py-4 rounded-[1.5rem] border backdrop-blur-md transition-all",
                quote.type === "success" ? "bg-teal-400/5 border-teal-400/20 text-teal-600 dark:text-teal-400" :
                quote.type === "warning" ? "bg-orange-400/5 border-orange-400/20 text-orange-600 dark:text-orange-400" :
                "bg-sky-blue/5 border-sky-blue/20 text-sky-blue"
              )}
            >
              <div className="shrink-0">{quote.icon}</div>
              <span className="text-sm sm:text-base font-bold leading-tight">{quote.text}</span>
            </motion.div>
          ))}
        </div>

        {/* 2. Technical Data Grid (Full Parameters) */}
        <div className="relative p-8 rounded-[2.5rem] bg-neutral-900/[0.03] dark:bg-white/[0.03] border border-neutral-200/50 dark:border-white/5 overflow-hidden">
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-sky-blue animate-pulse" />
              <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Environment Observation Grid</h4>
            </div>
            <span className="text-[8px] sm:text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-[0.15em]">NRS V1.0 - Real-time Protocol</span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-y-10 gap-x-6 relative z-10">
            {techData.map((item, i) => (
              <div key={i} className="flex flex-col items-start group">
                <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500 mb-2 group-hover:text-sky-blue transition-colors">
                  <div className="p-1 rounded-md bg-neutral-100 dark:bg-neutral-800 transition-colors group-hover:bg-sky-blue/10">
                    {item.icon}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-foreground dark:text-neutral-100 tabular-nums tracking-tighter">
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Subtle background flair */}
          <div className="absolute -bottom-24 -right-24 size-64 bg-sky-blue/5 blur-[100px] rounded-full" />
        </div>
      </div>

      {/* Footer with Sync Status */}
      <div className="bg-sky-blue/[0.02] dark:bg-zinc-900/60 px-8 sm:px-12 py-6 border-t border-neutral-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-3">
             <Clock size={14} className="text-sky-blue opacity-50" />
             <div className="flex flex-col">
               <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">KMA Sync</span>
               <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 italic">
                 {getUpdateTime('kma')} ({metadata?.intervals.kma || "45m"})
               </span>
             </div>
          </div>
          <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 hidden sm:block" />
          <div className="flex items-center gap-3">
             <Database size={14} className="text-sky-blue opacity-50" />
             <div className="flex flex-col">
               <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Air Poll</span>
               <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 italic">
                 {getUpdateTime('air')} ({metadata?.intervals.air || "1h"})
               </span>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-400/5 border border-orange-400/20">
            <AlertCircle size={10} className="text-orange-400" />
            <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest">
              {t("status_coming_soon")}: AI Engine / DB Archive
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
