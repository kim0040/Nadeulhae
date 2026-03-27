"use client"

import { useLanguage } from "@/context/LanguageContext"
import { WeatherData } from "@/services/dataService"
import { motion } from "framer-motion"
import { 
  Sparkles, CheckCircle2, AlertCircle, Wind, Thermometer, 
  Info, Clock, Database, Droplets, Cloud, CloudRain, ShieldCheck, Zap
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
    let text = t(key)
    Object.entries(values).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v))
    })
    return text
  }

  // 1. 상황별 나들이 멘트 (Conversational Logic)
  const getBriefingQuotes = (): BriefingPoint[] => {
    const points: BriefingPoint[] = []
    
    // Temp analysis
    const temp = details.temp
    if (temp < 10) {
      points.push({ text: formatBriefing("brief_temp_v_cold", { temp }), type: "warning", icon: <AlertCircle size={18} /> })
    } else if (temp < 18) {
      points.push({ text: formatBriefing("brief_temp_cold", { temp }), type: "info", icon: <Thermometer size={18} /> })
    } else if (temp <= 25) {
      points.push({ text: formatBriefing("brief_temp_perfect", { temp }), type: "success", icon: <CheckCircle2 size={18} /> })
    } else if (temp > 30) {
      points.push({ text: formatBriefing("brief_temp_v_hot", { temp }), type: "warning", icon: <AlertCircle size={18} /> })
    }

    // Dust analysis
    const dustText = details.dust
    const dustValue = details.pm10 || parseInt(dustText.match(/\d+/)?.[0] || "0")
    if (dustValue <= 30) {
      points.push({ text: formatBriefing("brief_dust_excel", { dust: `${dustValue}µg/m³` }), type: "success", icon: <Sparkles size={18} /> })
    } else if (dustValue > 80) {
      points.push({ text: formatBriefing("brief_dust_bad", { dust: `${dustValue}µg/m³` }), type: "warning", icon: <AlertCircle size={18} /> })
    }

    // Precipitation
    if (details.pty && details.pty > 0) {
      points.push({ text: t("brief_pty_rain"), type: "warning", icon: <CloudRain size={18} /> })
    }

    // Wind
    if (details.wind > 5) {
      points.push({ text: formatBriefing("brief_wind_strong", { wind: details.wind }), type: "info", icon: <Wind size={18} /> })
    }

    return points
  }

  // 2. 상세 환경 수치 (Technical Data View)
  const getTechnicalPoints = () => [
    { label: t("hero_temp"), value: `${details.temp}°C`, icon: <Thermometer size={14} /> },
    { label: t("hero_humidity"), value: `${details.humidity}%`, icon: <Droplets size={14} /> },
    { label: t("hero_wind"), value: `${details.wind}m/s`, icon: <Wind size={14} /> },
    { label: t("hero_vec"), value: `${details.vec}°`, icon: <Wind size={14} className="rotate-45" /> },
    { label: t("hero_pm10"), value: `${details.pm10}µg/m³`, icon: <Cloud size={14} /> },
    { label: t("hero_pm25"), value: `${details.pm25}µg/m³`, icon: <Sparkles size={14} /> },
    { label: t("hero_o3"), value: `${details.o3}ppm`, icon: <Zap size={14} /> },
    { label: t("hero_no2"), value: `${details.no2}ppm`, icon: <Zap size={14} /> },
    { label: t("hero_khai"), value: `${details.khai}`, icon: <ShieldCheck size={14} /> },
    { label: t("hero_precip"), value: `${details.rn1 || 0}mm`, icon: <CloudRain size={14} /> },
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
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="w-full max-w-5xl mx-auto rounded-[2.5rem] bg-white/40 dark:bg-neutral-900/40 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-2xl overflow-hidden"
    >
      <div className="p-8 sm:p-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-sky-blue text-white shadow-lg shadow-sky-blue/20">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-foreground dark:text-white tracking-tight">{t("brief_title")}</h3>
              <p className="text-[10px] font-black text-sky-blue uppercase tracking-[0.3em] mt-1 italic">Situational Advice & Raw Data</p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-blue/10 border border-sky-blue/20">
              <Database size={14} className="text-sky-blue" />
              <span className="text-[10px] font-black text-sky-blue uppercase">
                {t("status_nearby_station")}: {metadata?.station || "덕진동"}
              </span>
            </div>
          </div>
        </div>

        {/* 1. Conversational Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-12">
          {quotes.map((quote, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-4 p-6 rounded-[2rem] bg-white/60 dark:bg-white/5 border border-white dark:border-white/10"
            >
              <div className={`p-2 rounded-xl ${quote.type === "success" ? "bg-teal-400/10 text-teal-500" : "bg-orange-400/10 text-orange-500"}`}>
                {quote.icon}
              </div>
              <p className="text-base sm:text-lg font-bold text-neutral-700 dark:text-neutral-200 leading-snug pt-1">
                {quote.text}
              </p>
            </motion.div>
          ))}
        </div>

        {/* 2. Technical Data Grid */}
        <div className="p-8 pb-4 rounded-[2.5rem] bg-sky-blue/5 dark:bg-white/5 border border-sky-blue/10 dark:border-white/10">
          <div className="flex items-center justify-between mb-8">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400 flex items-center gap-2">
              <ShieldCheck size={14} className="text-sky-blue" />
              Environment Full Parameters
            </h4>
            <span className="text-[10px] font-black text-sky-blue/60 uppercase animate-pulse">Live from Sources</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-y-8 gap-x-4">
            {techData.map((item, i) => (
              <div key={i} className="flex flex-col items-start px-2">
                <div className="flex items-center gap-2 text-neutral-400 mb-2">
                  {item.icon}
                  <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
                </div>
                <span className="text-lg font-black text-neutral-800 dark:text-neutral-200 tabular-nums">
                  {item.value || "--"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer with Metadata */}
      <div className="bg-sky-blue/5 dark:bg-zinc-900/40 px-8 sm:px-12 py-5 border-t border-sky-blue/10 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
             <Clock size={12} className="text-neutral-400" />
             <span className="text-[10px] font-black text-neutral-500 uppercase">
               W: {getUpdateTime('kma')} ({metadata?.intervals.kma || "매시 45분"})
             </span>
          </div>
          <div className="flex items-center gap-2">
             <Database size={12} className="text-neutral-400" />
             <span className="text-[10px] font-black text-neutral-500 uppercase">
               A: {getUpdateTime('air')} ({metadata?.intervals.air || "매시 정각"})
             </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-1 px-3 rounded-full bg-orange-400/10 text-orange-500 text-[8px] font-black uppercase border border-orange-400/20">
            {t("status_coming_soon")}: AI Course / DB Archives
          </div>
        </div>
      </div>
    </motion.div>
  )
}
