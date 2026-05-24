"use client";

import { useState, useEffect } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { ko, enUS } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  History,
  Sparkles,
  X,
  Cloud,
  ThermometerIcon,
  Wind,
  Droplets,
  Sun,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DaySummary {
  day: number;
  score: number;
  status: string;
  knockout: string;
  sky: string;
  tempMin: number;
  tempMax: number;
  avgTemp: number;
  isRecommended: boolean;
}

interface ArchiveResponse {
  month: string;
  highlightedDays: number[];
  daySummaries: DaySummary[];
  metadata: {
    dataSource: string;
    lastUpdate: string;
    mode: string;
    coverage: string;
    note?: string;
  };
}

interface HistoryEntry {
  date: string;
  score: number;
  status: string;
  knockout: string;
  breakdown: {
    air: number;
    temperature: number;
    sky: number;
    wind: number;
    total: number;
  };
  weather: {
    avgTemp: number | null;
    minTemp: number | null;
    maxTemp: number | null;
    sky: string;
    avgWind: number | null;
    maxWind: number | null;
    humidity: number | null;
    rain: number | null;
    sunshine: number | null;
    fog: number | null;
    pm10: number | null;
    cloudCover: number | null;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const scoreColors = (score: number) => {
  if (score >= 86)
    return {
      primary: "#0b7d71",
      secondary: "#2f6fe4",
      bg: "bg-nature-green/10",
      text: "text-nature-green",
      border: "border-nature-green/20",
    };
  if (score >= 66)
    return {
      primary: "#2f6fe4",
      secondary: "#7db3ff",
      bg: "bg-active-blue/10",
      text: "text-active-blue",
      border: "border-active-blue/20",
    };
  if (score >= 36)
    return {
      primary: "#4d9a90",
      secondary: "#77b2f0",
      bg: "bg-yellow-500/10",
      text: "text-yellow-600",
      border: "border-yellow-500/20",
    };
  return {
    primary: "#ef4444",
    secondary: "#f87171",
    bg: "bg-red-500/10",
    text: "text-red-500",
    border: "border-red-500/20",
  };
};

const statusLabels: Record<string, Record<string, string>> = {
  ko: { excellent: "매우 좋음", good: "좋음", fair: "보통", poor: "나쁨" },
  en: { excellent: "Excellent", good: "Good", fair: "Fair", poor: "Poor" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function PicnicArchiveCalendar() {
  const { language } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [archiveData, setArchiveData] = useState<ArchiveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [detailData, setDetailData] = useState<HistoryEntry[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const locale = language === "ko" ? ko : enUS;
  const today = new Date();

  // Fetch month archive
  useEffect(() => {
    const fetchArchive = async () => {
      setLoading(true);
      try {
        const monthStr = format(currentMonth, "yyyy-MM");
        const res = await fetch(`/api/weather/archives?month=${monthStr}`);
        const data = await res.json();
        setArchiveData(data);
      } catch (e) {
        console.error("Archive fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchArchive();
  }, [currentMonth]);

  // Fetch date detail when clicked
  const handleDateClick = async (day: Date) => {
    if (!isSameMonth(day, startOfMonth(currentMonth))) return;
    setSelectedDate(day);
    setDetailLoading(true);
    try {
      const dateStr = format(day, "yyyy-MM-dd");
      const res = await fetch(`/api/weather/archives?date=${dateStr}`);
      const data = await res.json();
      setDetailData(data.entries || []);
    } catch (e) {
      console.error("Detail fetch error:", e);
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const isHighlighted = (day: Date) => {
    if (!archiveData?.highlightedDays) return false;
    return archiveData.highlightedDays.includes(day.getDate());
  };

  const getDayScore = (day: Date): number | null => {
    const summary = archiveData?.daySummaries?.find(
      (s) => s.day === day.getDate(),
    );
    return summary ? summary.score : null;
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-[var(--card)] backdrop-blur-3xl rounded-[3.5rem] border border-[var(--card-border)] p-6 sm:p-12 overflow-hidden relative group">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-16 gap-6 relative z-10">
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
          <div className="flex items-center gap-3 text-neutral-400 mb-2">
            <History size={18} />
            <span className="text-xs font-black uppercase tracking-widest">
              {language === "ko" ? "과거 나들이 기록" : "Past Outing Records"}
            </span>
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
          <div
            key={day}
            className="text-center text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.3em] pb-4"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div
        className={cn(
          "relative z-10",
          loading && "opacity-30 pointer-events-none transition-opacity",
        )}
      >
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
              const highlighted =
                isHighlighted(day) && isSameMonth(day, monthStart);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isToday = isSameDay(day, today);
              const score = getDayScore(day);
              const clr = score != null ? scoreColors(score) : null;

              return (
                <button
                  key={i}
                  onClick={() => handleDateClick(day)}
                  disabled={!isCurrentMonth}
                  className={cn(
                    "relative aspect-square sm:aspect-[4/3] flex flex-col items-center justify-center rounded-[2rem] sm:rounded-[2.5rem] text-sm sm:text-xl font-black transition-all border cursor-pointer",
                    !isCurrentMonth &&
                      "text-neutral-200 dark:text-neutral-800 border-transparent opacity-30 cursor-default",
                    isCurrentMonth &&
                      !highlighted &&
                      !isSelected &&
                      "text-foreground/70 border-transparent hover:bg-sky-blue/5 hover:border-sky-blue/10",
                    highlighted &&
                      !isSelected &&
                      "bg-gradient-to-br from-nature-green/10 to-active-blue/10 text-sky-blue border-sky-blue/20 shadow-blue shadow-sky-blue/5",
                    isSelected &&
                      "bg-sky-blue text-white border-sky-blue shadow-lg scale-105",
                    isToday &&
                      isCurrentMonth &&
                      !isSelected &&
                      "border-active-blue/40 ring-1 ring-active-blue/20",
                  )}
                >
                  <span className="relative z-10">
                    {format(day, "d")}
                    {isToday && isCurrentMonth && (
                      <span className="absolute -top-1 -right-4 text-[8px] text-active-blue">
                        오늘
                      </span>
                    )}
                  </span>
                  {score != null && isCurrentMonth && !isSelected && (
                    <span
                      className={cn("text-[9px] font-bold mt-0.5", clr?.text)}
                    >
                      {score}점
                    </span>
                  )}
                  {highlighted && !isSelected && (
                    <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
                      <Sparkles size={12} className="text-sky-blue/40" />
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
                      <Sparkles size={12} className="text-white/60" />
                    </div>
                  )}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-8 pt-8 border-t border-neutral-100 dark:border-white/10">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black tracking-tight text-foreground">
                  {format(selectedDate, "yyyy년 M월 d일", { locale })}
                  {isSameDay(selectedDate, today) && (
                    <span className="ml-3 text-sm font-bold text-sky-blue bg-sky-blue/10 px-3 py-1 rounded-full">
                      오늘
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => {
                    setSelectedDate(null);
                    setDetailData(null);
                  }}
                  className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {detailLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-24 rounded-2xl bg-neutral-100 dark:bg-neutral-800"
                    />
                  ))}
                </div>
              ) : detailData && detailData.length > 0 ? (
                <div className="space-y-4">
                  {isSameDay(selectedDate, today) && (
                    <p className="text-sm font-bold text-muted-foreground mb-4">
                      {language === "ko"
                        ? `📅 예전 이맘때는 어땠을까요? 과거 ${detailData.length}년 치 기록을 모아봤어요.`
                        : `📅 What was this day like in past years? Here's ${detailData.length} years of history.`}
                    </p>
                  )}

                  {detailData.map((entry, idx) => {
                    const clr = scoreColors(entry.score);
                    return (
                      <motion.div
                        key={entry.date}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-[var(--interactive)] border border-[var(--card-border)] rounded-2xl p-5 sm:p-6"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                          {/* Score Circle */}
                          <div className="flex shrink-0 items-center gap-4">
                            <div
                              className={cn(
                                "size-20 rounded-full flex flex-col items-center justify-center border-2",
                                clr.border,
                              )}
                            >
                              <span className="text-2xl font-black">
                                {entry.score}
                              </span>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                {statusLabels[language]?.[entry.status] ??
                                  entry.status}
                              </span>
                            </div>
                            <div className="sm:hidden">
                              <span className="text-base font-black">
                                {entry.date.slice(0, 4)}년
                              </span>
                              {entry.knockout !== "clear" && (
                                <span className="ml-2 text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                                  {entry.knockout === "rain"
                                    ? "🌧️ 비"
                                    : "⚠️ 특보"}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="hidden sm:flex items-center gap-2 mb-2">
                              <span className="text-base font-black">
                                {entry.date.slice(0, 4)}년
                              </span>
                              {entry.knockout !== "clear" && (
                                <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                                  {entry.knockout === "rain"
                                    ? "🌧️ 비"
                                    : "⚠️ 특보"}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <ThermometerIcon size={14} />
                                {entry.weather.avgTemp ?? "--"}°C
                                <span className="text-xs text-neutral-400">
                                  ({entry.weather.minTemp ?? "--"}~
                                  {entry.weather.maxTemp ?? "--"})
                                </span>
                              </span>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Cloud size={14} />
                                {entry.weather.sky}
                              </span>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Wind size={14} />
                                {entry.weather.avgWind ?? "--"}m/s
                              </span>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Droplets size={14} />
                                {entry.weather.humidity ?? "--"}%
                              </span>
                              {entry.weather.rain != null &&
                                entry.weather.rain > 0 && (
                                  <span className="flex items-center gap-1 text-active-blue">
                                    🌧️ {entry.weather.rain}mm
                                  </span>
                                )}
                              {entry.weather.sunshine != null && (
                                <span className="flex items-center gap-1 text-yellow-500">
                                  <Sun size={14} />
                                  {entry.weather.sunshine}h
                                </span>
                              )}
                            </div>
                            {/* Score breakdown mini bars */}
                            <div className="flex gap-1.5 mt-3">
                              {(
                                ["air", "temperature", "sky", "wind"] as const
                              ).map((k) => {
                                const max =
                                  k === "air"
                                    ? 40
                                    : k === "temperature"
                                      ? 30
                                      : k === "sky"
                                        ? 20
                                        : 10;
                                const pct = Math.round(
                                  (entry.breakdown[k] / max) * 100,
                                );
                                return (
                                  <div
                                    key={k}
                                    className="flex-1 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden"
                                    title={`${k}: ${entry.breakdown[k]}/${max}`}
                                  >
                                    <div
                                      className={cn(
                                        "h-full rounded-full",
                                        clr.bg
                                          .replace("bg-", "bg-")
                                          .replace("/10", ""),
                                      )}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {language === "ko"
                    ? "이 날짜의 기록이 없습니다."
                    : "No records for this date."}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Footnote */}
      <div className="mt-12 pt-8 border-t border-neutral-100 dark:border-white/5">
        <p className="text-xs sm:text-sm font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-relaxed text-center sm:text-left">
          {archiveData?.metadata?.dataSource
            ? `출처: ${archiveData.metadata.dataSource} (${archiveData.metadata.coverage})`
            : "출처: 기상청 ASOS 관측자료"}
        </p>
      </div>
    </div>
  );
}
