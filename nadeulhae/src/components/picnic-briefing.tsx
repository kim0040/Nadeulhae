"use client"

import { useLanguage } from "@/context/LanguageContext"
import { WeatherData } from "@/services/dataService"
import { motion } from "framer-motion"
import { 
  Sparkles, CheckCircle2, AlertCircle, Wind, Thermometer, 
  Info, Clock, Database, Droplets, Cloud, CloudRain 
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

  // 상황별 요약 및 수치 결합
  const getBriefingPoints = (): BriefingPoint[] => {
    const points: BriefingPoint[] = []
    
    // 1. 핵심 수치들 (항상 노출)
    points.push({
      icon: <Thermometer size={18} />,
      text: `${t("hero_temp")}: ${details.temp}°C`,
      type: details.temp >= 18 && details.temp <= 25 ? "success" : "neutral"
    })
    
    points.push({
      icon: <Wind size={18} />,
      text: `${t("hero_wind")}: ${details.wind}m/s`,
      type: details.wind > 5 ? "warning" : "success"
    })
    
    points.push({
      icon: <Droplets size={18} />,
      text: `${t("hero_humidity")}: ${details.humidity}%`,
      type: details.humidity > 70 ? "warning" : "success"
    })
    
    points.push({
      icon: <Cloud size={18} />,
      text: `${t("hero_dust")}: ${details.dust}`,
      type: details.dust.includes("나쁨") ? "warning" : "success"
    })

    if (details.pm25) {
      points.push({
        icon: <Sparkles size={18} />,
        text: `${t("hero_pm25")}: ${details.pm25}µg/m³`,
        type: details.pm25 > 35 ? "warning" : "success"
      })
    }

    if (details.pty && details.pty > 0) {
      points.push({
        icon: <CloudRain size={18} />,
        text: `${t("hero_precip")}: ${details.rn1 || 0}mm`,
        type: "warning"
      })
    }

    // 2. 상황별 추천/경고 멘트 (기존 로직 유지)
    if (details.temp < 10) {
      points.push({ text: formatBriefing("brief_temp_v_cold", { temp: details.temp }), type: "warning", icon: <AlertCircle size={18} /> })
    } else if (details.temp > 30) {
      points.push({ text: formatBriefing("brief_temp_v_hot", { temp: details.temp }), type: "warning", icon: <AlertCircle size={18} /> })
    }

    return points
  }

  const briefingPoints = getBriefingPoints()

  // 안전한 시간 표시
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
              <p className="text-[10px] font-black text-sky-blue uppercase tracking-[0.3em] mt-1 italic">Source-driven Intelligence</p>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-6 px-6 py-3 rounded-2xl bg-sky-blue/5 dark:bg-white/5 border border-sky-blue/10">
            <div className="flex flex-col items-start">
               <div className="flex items-center gap-2">
                 <Clock size={12} className="text-sky-blue" />
                 <span className="text-[10px] font-black text-neutral-400">WEATHER</span>
               </div>
               <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300 ml-5">{getUpdateTime('kma')}</span>
            </div>
            <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800" />
            <div className="flex flex-col items-start">
               <div className="flex items-center gap-2">
                 <Database size={12} className="text-sky-blue" />
                 <span className="text-[10px] font-black text-neutral-400">AIR QUALITY</span>
               </div>
               <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300 ml-5">{getUpdateTime('air')}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {briefingPoints.map((point, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="group flex items-start gap-4 p-5 rounded-[2rem] bg-white/60 dark:bg-white/5 border border-white dark:border-white/10 hover:border-sky-blue/30 hover:scale-[1.01] transition-all duration-300"
            >
              <div className={`mt-1 p-2 rounded-xl ${
                point.type === "success" ? "bg-teal-400/10 text-teal-500" : 
                point.type === "warning" ? "bg-orange-400/10 text-orange-500" : 
                point.type === "info" ? "bg-sky-blue/10 text-sky-blue" :
                "bg-neutral-400/10 text-neutral-500"
              }`}>
                {point.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="text-base font-bold text-neutral-700 dark:text-neutral-200 leading-snug">
                    {point.text.split('(')[0].trim()}
                  </p>
                  {point.text.includes("국내:") && (
                    <div className="flex gap-1.5 mt-1 sm:mt-0">
                      <span className="px-1.5 py-0.5 rounded-md bg-sky-blue/10 text-sky-blue text-[8px] font-black border border-sky-blue/20">
                        {point.text.match(/국내:\s*([^/|)]+)/)?.[1].trim()}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-500 text-[8px] font-black border border-purple-500/20">
                        {point.text.match(/WHO:\s*([^/|)]+)/)?.[1].trim()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="bg-sky-blue/5 dark:bg-zinc-900/40 px-8 sm:px-12 py-5 border-t border-sky-blue/10 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Info size={14} className="text-sky-blue" />
          <span className="text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">
            Data Source: {metadata?.dataSource || "KMA, Air Korea"}
          </span>
        </div>
        <div className="flex items-center gap-6 text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-2">
             <div className="size-1.5 rounded-full bg-teal-400 animate-pulse" />
             <span className="text-[10px] font-black uppercase">Sync: {metadata?.intervals.kma || "45m"}</span>
          </div>
          <div className="flex items-center gap-2">
             <div className="size-1.5 rounded-full bg-sky-blue" />
             <span className="text-[10px] font-black uppercase">Poll: {metadata?.intervals.air || "1h"}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
