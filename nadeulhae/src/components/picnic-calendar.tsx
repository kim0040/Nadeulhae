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
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO
} from "date-fns"
import { ko, enUS } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Sparkles, Cloud, Sun, CloudRain } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/context/LanguageContext"

export function PicnicCalendar() {
  const { language, t } = useLanguage()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [forecast, setForecast] = useState<any>(null)
  const locale = language === "ko" ? ko : enUS

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const res = await fetch("/api/weather/forecast");
        const data = await res.json();
        setForecast(data);
      } catch (e) {
        console.error("Forecast fetch error:", e);
      }
    };
    fetchForecast();
  }, []);

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

  const getDayForecast = (day: Date) => {
    if (!forecast || !forecast.daily) return null;
    const dateStr = format(day, "yyyyMMdd");
    return forecast.daily.find((d: any) => d.date === dateStr);
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-[var(--card)] backdrop-blur-3xl rounded-[3.5rem] border border-[var(--card-border)] shadow-[0_50px_100px_-20px_rgba(135,206,235,0.2)] p-6 sm:p-12 overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-blue/5 to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-16 gap-6 relative z-10">
        <div className="flex flex-col items-center sm:items-start">
          <h2 className="text-4xl sm:text-5xl font-black tracking-tighter text-foreground mb-2">
            {format(currentMonth, "yyyy. MMMM", { locale })}
          </h2>
          <div className="flex items-center gap-2 text-sky-blue bg-sky-blue/10 px-4 py-1.5 rounded-full border border-sky-blue/20">
            <Sparkles size={16} className="animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em]">{t("cal_legend")}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={prevMonth}
            className="p-4 rounded-2xl bg-[var(--interactive)] hover:bg-sky-blue/15 hover:text-sky-blue transition-all active:scale-95 shadow-lg border border-transparent hover:border-sky-blue/20"
          >
            <ChevronLeft size={28} />
          </button>
          <button 
            onClick={nextMonth}
            className="p-4 rounded-2xl bg-[var(--interactive)] hover:bg-sky-blue/15 hover:text-sky-blue transition-all active:scale-95 shadow-lg border border-transparent hover:border-sky-blue/20"
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
      <div className="relative overflow-hidden min-h-[450px] z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={format(currentMonth, "yyyy-MM")}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="grid grid-cols-7 gap-3 sm:gap-5"
          >
            {calendarDays.map((day, i) => {
              const dayForecast = getDayForecast(day)
              const isToday = isSameDay(day, new Date())
              const isCurrentMonth = isSameMonth(day, monthStart)
              const isRecommended = dayForecast && dayForecast.score >= 80

              return (
                <div 
                  key={i}
                  className={cn(
                    "relative aspect-square sm:aspect-[4/3] flex flex-col items-center justify-center rounded-[2rem] sm:rounded-[2.5rem] text-sm sm:text-xl font-black transition-all border group cursor-pointer",
                    !isCurrentMonth ? "text-neutral-300 dark:text-neutral-800 border-transparent opacity-50" : "text-foreground border-transparent hover:border-sky-blue/30 hover:bg-white/50 dark:hover:bg-black/20",
                    isRecommended && "bg-gradient-to-br from-sky-blue to-blue-500 text-white shadow-[0_20px_40px_-10px_rgba(135,206,235,0.4)] border-transparent hover:scale-110 z-20",
                    isToday && !isRecommended && "bg-[var(--interactive)] border-sky-blue/40 text-sky-blue ring-4 ring-sky-blue/10"
                  )}
                >
                  <span className="relative z-10">{format(day, "d")}</span>
                  
                  {dayForecast && isCurrentMonth && (
                    <div className={cn(
                      "mt-1 sm:mt-2 text-[10px] sm:text-xs flex flex-col items-center gap-1",
                      isRecommended ? "text-white/80" : "text-sky-blue/60"
                    )}>
                      {dayForecast.sky === "맑음" ? <Sun size={14} /> : dayForecast.sky.includes("비") ? <CloudRain size={14} /> : <Cloud size={14} />}
                      <span className="hidden sm:inline font-bold">{dayForecast.tempMax}°</span>
                    </div>
                  )}

                  {isRecommended && (
                    <motion.div 
                      className="absolute -top-2 -right-2 text-white bg-orange-400 rounded-full p-2 shadow-xl border-2 border-white dark:border-background"
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      <Sparkles size={14} className="fill-current" />
                    </motion.div>
                  )}
                </div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Legend & Attribution */}
      <div className="mt-16 pt-10 border-t border-sky-blue/10 flex flex-col sm:flex-row gap-8 items-center justify-between relative z-10">
        <div className="flex flex-wrap gap-8 items-center justify-center">
          <div className="flex items-center gap-3 group">
            <div className="size-6 rounded-xl bg-gradient-to-br from-sky-blue to-blue-500 shadow-lg group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">{t("cal_legend")}</span>
          </div>
          <div className="flex items-center gap-3 group">
            <div className="size-6 rounded-xl bg-[var(--interactive)] border border-sky-blue/30 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">Today</span>
          </div>
        </div>
        
        <div className="flex flex-col items-center sm:items-end gap-1.5">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.25em]">
            Source: {forecast?.metadata?.dataSource || "기상청"}
          </p>
          <div className="flex items-center gap-2 px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full">
             <div className="size-1.5 rounded-full bg-teal-400 animate-pulse" />
             <span className="text-[9px] font-bold text-neutral-500">Updated: {forecast?.metadata?.lastUpdate || "--:--"}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
