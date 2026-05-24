"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ko, enUS, zhCN, ja } from "date-fns/locale";
import {
  X,
  Sparkles,
  ThermometerIcon,
  Cloud,
  Sun,
  CalendarRange,
  CloudRain,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

interface ForecastDay {
  date: string;
  sky: string;
  tempMin: number;
  tempMax: number;
  score: number;
  precipChance: number;
  precipAmount: string;
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

interface PicnicDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  day: ForecastDay | null;
  locationLabel: string;
  adviceText: string;
}

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
  zh: { excellent: "极佳", good: "优", fair: "良", poor: "差" },
  ja: { excellent: "非常に良い", good: "良い", fair: "普通", poor: "悪い" },
};

function pickDateFnsLocale(language: string) {
  if (language === "ko") return ko;
  if (language === "zh") return zhCN;
  if (language === "ja") return ja;
  return enUS;
}

export function PicnicDetailDrawer({
  isOpen,
  onClose,
  day,
  locationLabel,
  adviceText,
}: PicnicDetailDrawerProps) {
  const { language } = useLanguage();
  const __l = (ko: string, en: string, zh?: string, ja?: string) => {
    if (language === "ko") return ko;
    if (language === "zh") return zh || en || ko;
    if (language === "ja") return ja || en || ko;
    return en || ko;
  };

  const [historyData, setHistoryData] = useState<HistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const locale = pickDateFnsLocale(language);

  useEffect(() => {
    if (!isOpen || !day) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const formattedDate = day.date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
        const res = await fetch(`/api/weather/archives?date=${formattedDate}`);
        const data = await res.json();
        setHistoryData(data.entries || []);
      } catch (e) {
        console.error("Forecast history fetch error:", e);
        setHistoryData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, day]);

  // Escape key close listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!day) return null;

  const dayDate = new Date(day.date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"));
  const clr = scoreColors(day.score);
  const isRecommended = day.score >= 80;
  const isWetDay = day.sky?.includes("비") || day.sky?.includes("눈") || day.precipChance >= 60;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-background backdrop-blur-sm"
          />

          {/* Sliding Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-card border-l border-card-border/70 p-6 sm:p-10 shadow-2xl flex flex-col justify-between overflow-y-auto custom-scrollbar bg-background/95 backdrop-blur-2xl"
          >
            <div>
              {/* Header */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                      {locationLabel}
                    </span>
                    {isRecommended && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-nature-green/25 bg-nature-green/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-nature-green">
                        <Sparkles size={10} />
                        {__l("피크닉 최적일", "Best Day", "野餐佳日", "おすすめ日")}
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground leading-none">
                    {format(dayDate, __l("M월 d일 (EEE)", "MMMM d (EEE)", "M月d日 (EEE)", "M月d日 (EEE)"), { locale })}
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full border border-card-border/70 bg-card/70 p-2 text-muted-foreground transition hover:border-sky-blue/25 hover:text-foreground active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              {/* SECTION 1: Forecast Weather & Score Details */}
              <div className="space-y-6 mb-10">
                <div className="rounded-[2rem] border border-card-border/70 bg-card/40 p-5 sm:p-6 shadow-[0_12px_36px_-20px_rgba(47,111,228,0.15)] flex flex-col sm:flex-row items-center gap-6">
                  {/* Score circle */}
                  <div
                    className={cn(
                      "size-24 rounded-full flex flex-col items-center justify-center border-3 shadow-md shrink-0",
                      clr.border,
                      clr.bg
                    )}
                  >
                    <span className="text-3xl font-black leading-none text-foreground">{day.score}</span>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                      {__l("피크닉 지수", "Picnic Pts", "野餐指数", "ピクニック指数")}
                    </span>
                  </div>

                  {/* Quick description & sky */}
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                      <div className={cn(
                        "size-10 rounded-xl flex items-center justify-center border",
                        isRecommended ? "bg-nature-green/10 border-nature-green/20 text-nature-green" : "bg-[var(--interactive)] border-[var(--interactive-border)] text-foreground/80"
                      )}>
                        {day.sky?.includes("맑음") ? (
                          <Sun size={20} strokeWidth={2.5} />
                        ) : isWetDay ? (
                          <CloudRain size={20} strokeWidth={2.5} />
                        ) : (
                          <Cloud size={20} strokeWidth={2.5} />
                        )}
                      </div>
                      <span className="text-xl font-black text-foreground">
                        {__l(day.sky, day.sky, day.sky, day.sky)}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                      {adviceText}
                    </p>
                  </div>
                </div>

                {/* Weather stats grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-card-border/70 bg-card/25 p-4 flex flex-col justify-between">
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">
                      {__l("최저 / 최고 기온", "Min / Max Temp", "最低 / 最高气温", "最低 / 最高気温")}
                    </div>
                    <div className="flex items-center justify-between font-black text-lg">
                      <span className="text-blue-500">{day.tempMin}°C</span>
                      <span className="text-red-500">{day.tempMax}°C</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-card-border/70 bg-card/25 p-4 flex flex-col justify-between">
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">
                      {__l("강수 확률", "Rain Chance", "降水概率", "降水確率")}
                    </div>
                    <div className="font-black text-lg text-foreground">
                      {day.precipChance}%
                    </div>
                  </div>

                  <div className="rounded-2xl border border-card-border/70 bg-card/25 p-4 flex flex-col justify-between">
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">
                      {__l("예상 강수량", "Expected Rain", "预计降水量", "予想降水量")}
                    </div>
                    <div className="font-black text-lg text-foreground">
                      {day.precipAmount || "--"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-card-border/70 bg-card/25 p-4 flex flex-col justify-between">
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">
                      {__l("위치 정보", "Location", "位置", "位置")}
                    </div>
                    <div className="font-black text-lg text-foreground truncate">
                      {locationLabel}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: "과거엔 이랬어요!" Link */}
              <div className="border-t border-card-border/50 pt-8">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-6 text-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarRange size={18} className="text-sky-blue" />
                    <h4 className="text-lg font-black tracking-tight">
                      {__l("과거엔 이랬어요!", "This day in the past!", "历史上的今天", "過去のこの日は！")}
                    </h4>
                  </div>
                  {/* Jeonju Area Only Badge */}
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-blue/20 bg-sky-blue/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-sky-blue">
                    {__l("전주 지역 기준", "Jeonju Area Only", "仅限全州地区", "全州地域限定")}
                  </span>
                </div>

                {loading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-24 rounded-2xl bg-card-border/20 border border-card-border/30 animate-pulse"
                      />
                    ))}
                  </div>
                ) : historyData && historyData.length > 0 ? (
                  <div className="space-y-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground leading-relaxed">
                      <CalendarRange size={14} className="text-sky-blue shrink-0" />
                      <span>
                        {__l(
                          `예전 이맘때 전주천변이나 한옥마을은 어땠을까요? 과거 ${historyData.length}년 치 날씨 실측 데이터를 모았어요.`,
                          `What was the weather in Jeonju like in past years? Here's ${historyData.length} years of historical readings on this day.`,
                          `历史上的这一天全州天气如何？整理了过去 ${historyData.length} 年的实际观测数据。`,
                          `過去 ${historyData.length} 年間のこの日における全州の实际のお出かけ・天気記録を集めました。`
                        )}
                      </span>
                    </p>

                    {historyData.slice(0, 3).map((entry) => {
                      const histClr = scoreColors(entry.score);
                      return (
                        <div
                          key={entry.date}
                          className="bg-card/30 border border-card-border/50 rounded-2xl p-4 flex items-center justify-between hover:bg-card/50 transition-colors"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            {/* Hist Score Circle */}
                            <div className={cn(
                              "size-14 rounded-full flex flex-col items-center justify-center shrink-0 border shadow-sm font-black text-sm",
                              histClr.border,
                              histClr.bg,
                              histClr.text
                            )}>
                              <span>{entry.score}</span>
                              <span className="text-[7px] uppercase font-bold tracking-tight opacity-75">
                                {statusLabels[language]?.[entry.status] ?? entry.status}
                              </span>
                            </div>

                            {/* Weather text */}
                            <div className="min-w-0">
                              <span className="text-sm font-black text-foreground block mb-0.5">
                                {entry.date.slice(0, 4)}{__l("년", "", "", "年")}
                              </span>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                <span className="flex items-center gap-0.5">
                                  <ThermometerIcon size={12} />
                                  {entry.weather.avgTemp ?? "--"}°C ({entry.weather.minTemp ?? "--"}~{entry.weather.maxTemp ?? "--"})
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <Cloud size={12} />
                                  {__l(
                                    entry.weather.sky === "맑음" ? "맑음" : entry.weather.sky === "구름많음" ? "구름많음" : "흐림",
                                    entry.weather.sky === "맑음" ? "Clear" : entry.weather.sky === "구름많음" ? "Mostly Cloudy" : "Cloudy",
                                    entry.weather.sky === "맑음" ? "晴" : entry.weather.sky === "구름많음" ? "多云" : "阴",
                                    entry.weather.sky === "맑음" ? "晴れ" : entry.weather.sky === "구름많음" ? "曇り時々晴れ" : "曇り"
                                  )}
                                </span>
                                {entry.weather.rain != null && entry.weather.rain > 0 && (
                                  <span className="flex items-center gap-1 text-active-blue font-bold">
                                    <CloudRain size={12} className="shrink-0" />
                                    <span>{entry.weather.rain}mm</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Knockout status badge */}
                          {entry.knockout !== "clear" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-500 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20 shrink-0">
                              {entry.knockout === "rain" ? (
                                <>
                                  <CloudRain size={10} className="shrink-0" />
                                  <span>{__l("비", "Rain", "雨", "雨")}</span>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle size={10} className="shrink-0 text-red-500" />
                                  <span>{__l("특보", "Warning", "预警", "特報")}</span>
                                </>
                              )}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-6 text-center">
                    {__l("과거 관측 기록 데이터가 부족합니다.", "No past records available.", "暂无历史观测数据。", "過去の観測記録データがありません。")}
                  </p>
                )}
              </div>
            </div>

            {/* Close Button / Footnote */}
            <div className="mt-12 text-center">
              <span className="text-[10px] text-muted-foreground/60 block">
                {__l(
                  "실시간 예보 데이터는 기상청 제공이며 과거 기록은 기상청 전주 ASOS 기준입니다.",
                  "Forecast by KMA. Historical data from Jeonju ASOS Station (146).",
                  "实时预报由气象厅提供，历史数据以全州 ASOS 为准。",
                  "予報データは気象庁提供、過去の記録は全州 ASOS 観測所基準です。"
                )}
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
