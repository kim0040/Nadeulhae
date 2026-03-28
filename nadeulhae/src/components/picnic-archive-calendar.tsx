"use client"

import { useState, useEffect } from "react"
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  eachDayOfInterval
} from "date-fns"
import { ko, enUS } from "date-fns/locale"
import { ChevronLeft, ChevronRight, History, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/context/LanguageContext"

export function PicnicArchiveCalendar() {
  const { language, t } = useLanguage()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [archiveData, setArchiveData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const locale = language === "ko" ? ko : enUS

  useEffect(() => {
    const fetchArchive = async () => {
      setLoading(true)
      try {
        const monthStr = format(currentMonth, "yyyy-MM")
        const res = await fetch(`/api/weather/archives?month=${monthStr}`)
        const data = await res.json()
        setArchiveData(data)
      } catch (e) {
        console.error("Archive fetch error:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchArchive()
  }, [currentMonth])

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  })

  const isHighlighted = (day: Date) => {
    if (!archiveData || !archiveData.highlightedDays) return false
    return archiveData.highlightedDays.includes(day.getDate())
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-[var(--card)] backdrop-blur-3xl rounded-[3.5rem] border border-[var(--card-border)] p-6 sm:p-12 overflow-hidden relative group">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-16 gap-6 relative z-10">
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
          <div className="flex items-center gap-3 text-neutral-400 mb-2">
            <History size={18} />
            <span className="text-xs font-black uppercase tracking-widest">{t("cal_archive_title")}</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tighter text-foreground">
            {format(currentMonth, "yyyy. MMMM", { locale })}
          </h2>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={prevMonth}
            className="p-4 rounded-2xl bg-card hover:bg-sky-blue/10 hover:text-sky-blue transition-all active:scale-95 shadow-lg border border-card-border"
          >
            <ChevronLeft size={28} />
          </button>
          <button 
            onClick={nextMonth}
            className="p-4 rounded-2xl bg-card hover:bg-sky-blue/10 hover:text-sky-blue transition-all active:scale-95 shadow-lg border border-card-border"
          >
            <ChevronRight size={28} />
          </button>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 mb-6 relative z-10">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
          <div key={day} className="text-center text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.3em] pb-4">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className={cn("relative overflow-hidden min-h-[400px] z-10", loading && "opacity-30 pointer-events-none transition-opacity")}>
        <AnimatePresence mode="wait">
          <motion.div
            key={format(currentMonth, "yyyy-MM")}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-7 gap-3 sm:gap-5"
          >
            {calendarDays.map((day, i) => {
              const highlighted = isHighlighted(day) && isSameMonth(day, monthStart)
              const isCurrentMonth = isSameMonth(day, monthStart)

              return (
                <div 
                  key={i}
                  className={cn(
                    "relative aspect-square sm:aspect-[4/3] flex flex-col items-center justify-center rounded-[2rem] sm:rounded-[2.5rem] text-sm sm:text-xl font-black transition-all border group",
                    !isCurrentMonth ? "text-neutral-200 dark:text-neutral-800 border-transparent opacity-30" : "text-foreground/80 border-transparent",
                    highlighted && "bg-gradient-to-br from-nature-green/10 to-active-blue/10 text-sky-blue border-sky-blue/20 shadow-blue shadow-sky-blue/5"
                  )}
                >
                  <span className="relative z-10">{format(day, "d")}</span>
                  {highlighted && (
                    <div className="absolute top-3 right-3 sm:top-5 sm:right-5">
                      <Sparkles size={12} className="text-sky-blue/40" />
                    </div>
                  )}
                </div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Info Footnote */}
      <div className="mt-12 pt-8 border-t border-neutral-100 dark:border-white/5">
        <p className="text-xs sm:text-sm font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-relaxed text-center sm:text-left">
          {t("cal_origin_desc")}
        </p>
        {archiveData?.metadata?.note && (
          <p className="mt-3 text-xs font-bold text-neutral-500 dark:text-neutral-400 leading-relaxed text-center sm:text-left">
            {archiveData.metadata.note}
          </p>
        )}
      </div>
    </div>
  )
}
