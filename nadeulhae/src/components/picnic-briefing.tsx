"use client"

import { useLanguage } from "@/context/LanguageContext"
import { WeatherData } from "@/services/dataService"
import { motion } from "framer-motion"
import { Sparkles, CheckCircle2, AlertCircle, Wind, Thermometer, Info, Clock, Database, Droplets } from "lucide-react"

interface PicnicBriefingProps {
  weatherData: WeatherData
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

  const getBriefingPoints = () => {
    const points = []
    
    // Precipitation (PTY)
    // PTY: 0(None), 1(Rain), 2(Rain/Snow), 3(Snow), 4(Shower)
    // [BACKEND_LINK]: 실제 PTY 값이 weatherData에 포함되어야 함. 현재는 임의 필드로 가정하거나 score로 유추.
    const pty = (weatherData as any).details.pty || 0
    if (pty === 1 || pty === 4) {
      points.push({ text: t("brief_pty_rain"), type: "warning", icon: <AlertCircle size={18} /> })
    } else if (pty === 2 || pty === 3) {
      points.push({ text: t("brief_pty_snow"), type: "warning", icon: <AlertCircle size={18} /> })
    }

    // Temp analysis
    const temp = details.temp
    if (temp < 5) {
      points.push({ text: formatBriefing("brief_temp_v_cold", { temp }), type: "warning", icon: <Thermometer size={18} /> })
    } else if (temp < 15) {
      points.push({ text: formatBriefing("brief_temp_cold", { temp }), type: "info", icon: <Thermometer size={18} /> })
    } else if (temp < 20) {
      points.push({ text: formatBriefing("brief_temp_mild", { temp }), type: "success", icon: <Thermometer size={18} /> })
    } else if (temp <= 25) {
      points.push({ text: formatBriefing("brief_temp_perfect", { temp }), type: "success", icon: <CheckCircle2 size={18} /> })
    } else if (temp <= 30) {
      points.push({ text: formatBriefing("brief_temp_warm", { temp }), type: "success", icon: <Thermometer size={18} /> })
    } else if (temp <= 35) {
      points.push({ text: formatBriefing("brief_temp_hot", { temp }), type: "info", icon: <Thermometer size={18} /> })
    } else {
      points.push({ text: formatBriefing("brief_temp_v_hot", { temp }), type: "warning", icon: <AlertCircle size={18} /> })
    }

    // Dust analysis
    const dustText = details.dust
    const dustValue = parseInt(dustText.match(/\d+/)?.[0] || "0")
    
    // Extract KR/WHO statuses if available in the string
    const krMatch = dustText.match(/국내:\s*([^/|)]+)/)
    const whoMatch = dustText.match(/WHO:\s*([^/|)]+)/)
    const krStatus = krMatch ? krMatch[1].trim() : ""
    const whoStatus = whoMatch ? whoMatch[1].trim() : ""

    if (dustValue < 15) {
      points.push({ 
        text: formatBriefing("brief_dust_excel", { dust: `${dustValue}µg/m³` }) + (krStatus ? ` (국내: ${krStatus} / WHO: ${whoStatus})` : ""), 
        type: "success", 
        icon: <Sparkles size={18} /> 
      })
    } else if (dustValue <= 30) {
      points.push({ 
        text: formatBriefing("brief_dust_good", { dust: `${dustValue}µg/m³` }) + (krStatus ? ` (국내: ${krStatus} / WHO: ${whoStatus})` : ""), 
        type: "success", 
        icon: <Sparkles size={18} /> 
      })
    } else if (dustValue <= 80) {
      points.push({ 
        text: formatBriefing("brief_dust_mod", { dust: `${dustValue}µg/m³` }) + (krStatus ? ` (국내: ${krStatus} / WHO: ${whoStatus})` : ""), 
        type: "info", 
        icon: <Info size={18} /> 
      })
    } else {
      points.push({ 
        text: formatBriefing("brief_dust_bad", { dust: `${dustValue}µg/m³` }) + (krStatus ? ` (국내: ${krStatus} / WHO: ${whoStatus})` : ""), 
        type: "warning", 
        icon: <AlertCircle size={18} /> 
      })
    }

    // Wind analysis
    const wind = details.wind
    if (wind < 2) {
      points.push({ text: formatBriefing("brief_wind_calm", { wind }), type: "success", icon: <Wind size={18} /> })
    } else if (wind <= 5) {
      points.push({ text: formatBriefing("brief_wind_breezy", { wind }), type: "success", icon: <Wind size={18} /> })
    } else {
      points.push({ text: formatBriefing("brief_wind_strong", { wind }), type: "info", icon: <Wind size={18} /> })
    }

    // Humidity analysis
    const humi = details.humidity
    if (humi < 30) {
      points.push({ text: formatBriefing("brief_humi_dry", { humi }), type: "info", icon: <Droplets size={18} /> })
    } else if (humi <= 60) {
      points.push({ text: formatBriefing("brief_humi_comfort", { humi }), type: "success", icon: <Droplets size={18} /> })
    } else {
      points.push({ text: formatBriefing("brief_humi_humid", { humi }), type: "info", icon: <Droplets size={18} /> })
    }

    return points
  }

  const points = getBriefingPoints()

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
              <p className="text-[10px] font-black text-sky-blue uppercase tracking-[0.3em] mt-1 italic">Real-time Weather Insight</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 px-6 py-3 rounded-2xl bg-sky-blue/5 dark:bg-white/5 border border-sky-blue/10">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-sky-blue" />
              <span className="text-xs font-bold text-neutral-500">{metadata?.lastUpdate || "--:--"}</span>
            </div>
            <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800" />
            <div className="flex items-center gap-2">
              <Database size={14} className="text-sky-blue" />
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none">Jeonju Station</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {points.map((point, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group flex items-start gap-4 p-6 rounded-[2rem] bg-white/60 dark:bg-white/5 border border-white dark:border-white/10 hover:border-sky-blue/30 hover:scale-[1.01] transition-all duration-300"
            >
              <div className={`mt-1 p-2 rounded-xl ${point.type === "success" ? "bg-teal-400/10 text-teal-500" : point.type === "warning" ? "bg-orange-400/10 text-orange-500" : "bg-sky-blue/10 text-sky-blue"}`}>
                {point.icon}
              </div>
              <p className="text-base sm:text-lg font-bold text-neutral-700 dark:text-neutral-200 leading-snug pt-1">
                {point.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Metadata Footer bar within the card */}
      <div className="bg-sky-blue/5 dark:bg-zinc-900/40 px-8 sm:px-12 py-5 border-t border-sky-blue/10 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Info size={14} className="text-sky-blue" />
          <span className="text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">
            Data Source: {metadata?.dataSource || "기상청, 한국환경공단"}
          </span>
        </div>
        <div className="flex items-center gap-6 text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-2">
             <div className="size-1.5 rounded-full bg-teal-400 animate-pulse" />
             <span className="text-[10px] font-black uppercase">Weather: {metadata?.intervals.kma || "1m"}</span>
          </div>
          <div className="flex items-center gap-2">
             <div className="size-1.5 rounded-full bg-orange-400" />
             <span className="text-[10px] font-black uppercase">Air Quality: {metadata?.intervals.air || "10m"}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
