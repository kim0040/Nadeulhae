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
import { ko, enUS, zhCN, ja } from "date-fns/locale";
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
  CloudRain,
  AlertTriangle,
  CalendarRange,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { classifyForecastWeatherIcon } from "@/lib/weather-presentation";

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
  availableYears: number[];
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
      bg: "bg-nature-green/10 dark:bg-nature-green/20",
      text: "text-nature-green",
      border: "border-nature-green/25 dark:border-nature-green/45",
    };
  if (score >= 66)
    return {
      primary: "#2f6fe4",
      secondary: "#7db3ff",
      bg: "bg-active-blue/10 dark:bg-active-blue/20",
      text: "text-active-blue",
      border: "border-active-blue/25 dark:border-active-blue/45",
    };
  if (score >= 36)
    return {
      primary: "#4d9a90",
      secondary: "#77b2f0",
      bg: "bg-yellow-500/10 dark:bg-yellow-500/20",
      text: "text-yellow-600 dark:text-yellow-500",
      border: "border-yellow-500/25 dark:border-yellow-500/45",
    };
  return {
    primary: "#ef4444",
    secondary: "#f87171",
    bg: "bg-red-500/10 dark:bg-red-500/20",
    text: "text-red-500",
    border: "border-red-500/25 dark:border-red-500/45",
  };
};

const statusLabels: Record<string, Record<string, string>> = {
  ko: { excellent: "매우 좋음", good: "좋음", fair: "보통", poor: "나쁨" },
  en: { excellent: "Excellent", good: "Good", fair: "Fair", poor: "Poor" },
  zh: { excellent: "极佳", good: "优", fair: "良", poor: "差" },
  ja: { excellent: "非常に良い", good: "良い", fair: "普通", poor: "悪い" },
};

function pickDateFnsLocale(language: string) {
  if (language === "ko") return ko;
  if (language === "zh") return zhCN;
  if (language === "ja") return ja;
  return enUS;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function PicnicArchiveCalendar() {
  const { language } = useLanguage();
  const __l = (ko: string, en: string, zh?: string, ja?: string) => {
    if (language === "ko") return ko;
    if (language === "zh") return zh || en || ko;
    if (language === "ja") return ja || en || ko;
    return en || ko;
  };

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    // Default to the same month in 2025 if current year exceeds database coverage
    if (now.getFullYear() > 2025) {
      return new Date(2025, now.getMonth(), 1);
    }
    return now;
  });

  const [archiveData, setArchiveData] = useState<ArchiveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [detailData, setDetailData] = useState<HistoryEntry[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const locale = pickDateFnsLocale(language);
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

  const availableYears = archiveData?.availableYears || [2021, 2022, 2023, 2024, 2025];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="w-full max-w-4xl mx-auto bg-[var(--card)] backdrop-blur-3xl rounded-[3.5rem] border border-[var(--card-border)] p-6 sm:p-12 overflow-hidden relative group">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-12 gap-6 relative z-10">
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-muted-foreground mb-2">
            <div className="flex items-center gap-2">
              <History size={18} />
              <span className="text-xs font-black uppercase tracking-widest">
                {__l("과거 나들이 기록", "Past Outing Records", "历史出行记录", "過去のお出かけ記録")}
              </span>
            </div>
            {/* Jeonju Area Only Badge */}
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-blue/20 bg-sky-blue/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-sky-blue">
              {__l("전주 지역 한정", "Jeonju Area Only", "仅限全州地区", "全州地域限定")}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-1">
            {/* Year Selector */}
            <div className="relative group">
              <select
                value={currentMonth.getFullYear()}
                onChange={(e) => setCurrentMonth(new Date(Number(e.target.value), currentMonth.getMonth(), 1))}
                className="appearance-none rounded-2xl border border-card-border bg-card/85 px-4 py-2 sm:px-5 sm:py-2.5 pr-10 text-xl sm:text-2xl font-black text-foreground shadow-md outline-none transition duration-200 hover:border-sky-blue/35 focus:border-sky-blue/35 cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23888888' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 0.85rem center',
                  backgroundSize: '0.85rem',
                  backgroundRepeat: 'no-repeat'
                }}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y} className="bg-background text-foreground text-sm font-semibold">
                    {y}{__l("년", "", "", "")}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Selector */}
            <div className="relative group">
              <select
                value={currentMonth.getMonth() + 1}
                onChange={(e) => setCurrentMonth(new Date(currentMonth.getFullYear(), Number(e.target.value) - 1, 1))}
                className="appearance-none rounded-2xl border border-card-border bg-card/85 px-4 py-2 sm:px-5 sm:py-2.5 pr-10 text-xl sm:text-2xl font-black text-foreground shadow-md outline-none transition duration-200 hover:border-sky-blue/35 focus:border-sky-blue/35 cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23888888' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 0.85rem center',
                  backgroundSize: '0.85rem',
                  backgroundRepeat: 'no-repeat'
                }}
              >
                {months.map((m) => (
                  <option key={m} value={m} className="bg-background text-foreground text-sm font-semibold">
                    {m}{__l("월", "", "", "")}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={prevMonth}
            className="rounded-2xl border border-card-border bg-card p-4 shadow-lg transition-[background-color,color,scale] hover:bg-sky-blue/10 hover:text-sky-blue active:scale-[0.96]"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            onClick={nextMonth}
            className="rounded-2xl border border-card-border bg-card p-4 shadow-lg transition-[background-color,color,scale] hover:bg-sky-blue/10 hover:text-sky-blue active:scale-[0.96]"
          >
            <ChevronRight size={28} />
          </button>
        </div>
      </div>

      {/* Heatmap Legend */}
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 mb-8 text-[10px] font-black text-muted-foreground uppercase tracking-widest relative z-10">
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-nature-green/20 border border-nature-green/45 shadow-sm" />
          <span>{statusLabels[language]?.excellent ?? "Excellent"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-active-blue/20 border border-active-blue/45 shadow-sm" />
          <span>{statusLabels[language]?.good ?? "Good"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/45 shadow-sm" />
          <span>{statusLabels[language]?.fair ?? "Fair"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-red-500/20 border border-red-500/45 shadow-sm" />
          <span>{statusLabels[language]?.poor ?? "Poor"}</span>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 mb-6 relative z-10">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
          <div
            key={day}
            className="text-center text-[9px] sm:text-[10px] font-black text-muted-foreground tracking-[0.1em] sm:tracking-[0.3em] pb-2 sm:pb-4"
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
            className="grid grid-cols-7 gap-1.5 sm:gap-5"
          >
            {calendarDays.map((day, i) => {
              const highlighted =
                isHighlighted(day) && isSameMonth(day, monthStart);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isToday = isSameDay(day, today);
              
              const summary = archiveData?.daySummaries?.find(
                (s) => s.day === day.getDate(),
              );
              const score = summary ? summary.score : null;
              const clr = score != null ? scoreColors(score) : null;

              const skyIcon = classifyForecastWeatherIcon({
                sky: summary?.sky,
                knockout: summary?.knockout,
              });

              return (
                <button
                  key={i}
                  onClick={() => handleDateClick(day)}
                  disabled={!isCurrentMonth}
                  className={cn(
                    "relative flex aspect-square cursor-pointer flex-col items-center justify-between rounded-xl border p-1.5 text-sm font-black transition-[background-color,border-color,color,box-shadow,scale] sm:aspect-[4/3] sm:rounded-[2rem] sm:p-3",
                    !isCurrentMonth &&
                      "text-muted/40 border-transparent opacity-30 cursor-default",
                    isCurrentMonth &&
                      !isSelected &&
                      (score != null
                        ? cn(clr?.bg, clr?.border, clr?.text, "hover:scale-[1.04] shadow-sm hover:shadow-md")
                        : "text-foreground/70 border-transparent hover:bg-sky-blue/5 hover:border-sky-blue/10"),
                    isSelected &&
                      "bg-sky-blue text-white border-sky-blue shadow-lg scale-105",
                    isToday &&
                      isCurrentMonth &&
                      !isSelected &&
                      "ring-2 ring-active-blue/50 ring-offset-2 ring-offset-background",
                  )}
                >
                  {/* Top Row: Date Number */}
                  <div className="w-full flex justify-between items-start">
                    <span className="text-[10px] sm:text-base font-black relative z-10 leading-none">
                      {format(day, "d")}
                      {isToday && isCurrentMonth && (
                        <span className="absolute -top-1 -right-3 text-[7px] font-black text-active-blue animate-pulse">
                          ●
                        </span>
                      )}
                    </span>
                    {highlighted && !isSelected && (
                      <Sparkles className="size-2 sm:size-3 text-sky-blue/45 shrink-0" />
                    )}
                  </div>

                  {/* Bottom Row: Premium Weather Icon & Score Badge */}
                  {score != null && isCurrentMonth && (
                    <div className={cn(
                      "flex items-center gap-0.5 sm:gap-1 text-[8px] sm:text-xs font-black px-1 sm:px-1.5 py-0.5 rounded-full shadow-inner w-full sm:w-auto justify-center",
                      isSelected ? "bg-white/20 text-white" : "bg-background/40"
                    )}>
                      {skyIcon === "rain" ? (
                        <CloudRain className="size-2 sm:size-3 shrink-0" />
                      ) : skyIcon === "sun" ? (
                        <Sun className="size-2 sm:size-3 shrink-0 animate-spin-slow" />
                      ) : (
                        <Cloud className="size-2 sm:size-3 shrink-0" />
                      )}
                      <span className="leading-none">{score}</span>
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
            <div className="mt-8 pt-8 border-t border-border/30">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black tracking-tight text-foreground">
                  {format(selectedDate, __l("yyyy년 M월 d일", "MMMM d, yyyy", "yyyy年M月d日", "yyyy年M月d日"), { locale })}
                  {__l("의 역대 나들이 기록", " Weather History", "的历史出行记录", "の過去のお出かけ記録")}
                  {isSameDay(selectedDate, today) && (
                    <span className="ml-3 text-sm font-bold text-sky-blue bg-sky-blue/10 px-3 py-1 rounded-full">
                      {__l("오늘", "Today", "今天", "今日")}
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => {
                    setSelectedDate(null);
                    setDetailData(null);
                  }}
                  className="p-2 rounded-xl hover:bg-muted transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {detailLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-24 rounded-2xl bg-muted/60"
                    />
                  ))}
                </div>
              ) : detailData && detailData.length > 0 ? (
                <div className="space-y-4">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground mb-4">
                    <CalendarRange size={16} className="text-sky-blue shrink-0" />
                    <span>
                      {__l(
                        `역대 이 날의 전주 피크닉 점수와 날씨 기록(${detailData.length}년 치)을 한눈에 비교해 보세요.`,
                        `Compare picnic scores and weather in Jeonju on this day over the last ${detailData.length} years.`,
                        `对比过去 ${detailData.length} 年中这一天全州的野餐指数与天气记录。`,
                        `過去 ${detailData.length} 年間のこの日における全州의 피크닉(行楽)スコアと天気を比較します。`
                      )}
                    </span>
                  </p>

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
                                "size-20 rounded-full flex flex-col items-center justify-center border-2 shadow-sm transition-transform hover:scale-105",
                                clr.border,
                                clr.bg
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
                                {entry.date.slice(0, 4)}{__l("년", " ", "", "年")}
                              </span>
                              {entry.knockout !== "clear" && (
                                <span className="inline-flex items-center gap-1 ml-2 text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                  {entry.knockout === "rain" ? (
                                    <>
                                      <CloudRain size={12} className="shrink-0" />
                                      <span>{__l("비", "Rain", "雨", "雨")}</span>
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle size={12} className="shrink-0 text-red-500" />
                                      <span>{__l("특보", "Warning", "预警", "特報")}</span>
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="hidden sm:flex items-center gap-2 mb-2">
                              <span className="text-base font-black">
                                {entry.date.slice(0, 4)}{__l("년", "", "", "年")}
                              </span>
                              {entry.knockout !== "clear" && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                  {entry.knockout === "rain" ? (
                                    <>
                                      <CloudRain size={12} className="shrink-0" />
                                      <span>{__l("비", "Rain", "雨", "雨")}</span>
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle size={12} className="shrink-0 text-red-500" />
                                      <span>{__l("특보", "Warning", "预警", "特報")}</span>
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <ThermometerIcon size={14} />
                                {entry.weather.avgTemp ?? "--"}°C
                                <span className="text-xs text-muted-foreground/60">
                                  ({entry.weather.minTemp ?? "--"}~
                                  {entry.weather.maxTemp ?? "--"})
                                </span>
                              </span>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Cloud size={14} />
                                {__l(
                                  entry.weather.sky === "맑음" ? "맑음" : entry.weather.sky === "구름많음" ? "구름많음" : "흐림",
                                  entry.weather.sky === "맑음" ? "Clear" : entry.weather.sky === "구름많음" ? "Mostly Cloudy" : "Cloudy",
                                  entry.weather.sky === "맑음" ? "晴" : entry.weather.sky === "구름많음" ? "多云" : "阴",
                                  entry.weather.sky === "맑음" ? "晴れ" : entry.weather.sky === "구름많음" ? "曇り時々晴れ" : "曇り"
                                )}
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
                                  <span className="flex items-center gap-1 text-active-blue font-semibold">
                                    <CloudRain size={14} className="shrink-0" />
                                    {entry.weather.rain}mm
                                  </span>
                                )}
                              {entry.weather.sunshine != null && (
                                <span className="flex items-center gap-1 text-yellow-500 font-semibold">
                                  <Sun size={14} />
                                  {entry.weather.sunshine}h
                                </span>
                              )}
                            </div>

                            {/* Labeled Score Breakdown Grid */}
                            <div className="mt-4 pt-4 border-t border-border/30">
                              <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">
                                {__l("세부 점수 분석", "Score Breakdown", "评分明细", "スコア内訳")}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {((["air", "temperature", "sky", "wind"] as const)).map((k) => {
                                  const label = {
                                    air: __l("대기질", "Air Quality", "空气质量", "大気질"),
                                    temperature: __l("기온", "Temp", "气温", "気温"),
                                    sky: __l("하늘상태", "Sky", "天空", "空の状態"),
                                    wind: __l("바람", "Wind", "风速", "風"),
                                  }[k];
                                  const max = k === "air" ? 40 : k === "temperature" ? 30 : k === "sky" ? 20 : 10;
                                  const val = entry.breakdown[k];
                                  const pct = Math.round((val / max) * 100);

                                  return (
                                    <div key={k} className="bg-background/40 rounded-xl p-2.5 border border-card-border/50">
                                      <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
                                        <span className="text-xs font-black text-foreground">
                                          {val}
                                          <span className="text-[9px] font-normal text-muted-foreground">/{max}</span>
                                        </span>
                                      </div>
                                      <div className="w-full h-1.5 rounded-full bg-muted/60 overflow-hidden">
                                        <div
                                          className={cn(
                                            "h-full rounded-full",
                                            clr.bg.replace("bg-", "bg-").replace("/10", "")
                                          )}
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {__l("이 날짜의 기록이 없습니다.", "No records for this date.", "该日期没有记录。", "この日付の記録はありません。")}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Footnote */}
      <div className="mt-12 pt-8 border-t border-border/30">
        <p className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest leading-relaxed text-center sm:text-left">
          {__l("출처", "Source", "来源", "ソース")}:{" "}
          {archiveData?.metadata?.dataSource || __l("기상청 ASOS 관측자료", "KMA ASOS Observation Data", "气象厅 ASOS 观测数据", "気象庁 ASOS 観測データ")}{" "}
          {archiveData?.metadata?.coverage ? `(${archiveData.metadata.coverage})` : ""}
        </p>
      </div>

      {/* Tailwind & Custom style overrides */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `,
        }}
      />
    </div>
  );
}
