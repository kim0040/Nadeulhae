"use client";

/**
 * Home Page — the main landing showing weather score, quick metrics, hourly
 * forecast, picnic briefing, fire insight panel, and weather imagery.
 * Uses geolocation to fetch location-based weather data, falling back to
 * mock/default data on error or when geolocation is denied.
 */

import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  CloudIcon,
  DropletsIcon,
  Info,
  SunIcon,
  ThermometerIcon,
  WindIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  getMeteorCount,
  getParticleCount,
  shouldRunRichAnimation,
} from "@/lib/performance";
import { parseServerTimestamp } from "@/lib/time/server-time";
import { useLanguage } from "@/context/LanguageContext";
import { useDerivedWeatherData, useWeatherData } from "@/hooks/use-weather";
import { Particles } from "@/components/magicui/particles";
import { Meteors } from "@/components/magicui/meteors";
import { WordPullUp } from "@/components/magicui/word-pull-up";
import { ShineBorder } from "@/components/magicui/shine-border";
import { BlurFade } from "@/components/magicui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { Skeleton } from "@/components/ui/skeleton";

const PicnicBriefing = dynamic(
  () =>
    import("@/components/picnic-briefing").then((m) => ({
      default: m.PicnicBriefing,
    })),
  { ssr: false },
);
const WeatherImagePanel = dynamic(
  () =>
    import("@/components/weather-image-panel").then((m) => ({
      default: m.WeatherImagePanel,
    })),
  { ssr: false },
);
const FireInsightPanel = dynamic(
  () =>
    import("@/components/fire-insight-panel").then((m) => ({
      default: m.FireInsightPanel,
    })),
  { ssr: false },
);
const TodayHourlyForecast = dynamic(
  () =>
    import("@/components/today-hourly-forecast").then((m) => ({
      default: m.TodayHourlyForecast,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="mt-8 mb-10">
        <Skeleton className="h-72 w-full rounded-[2.7rem]" />
      </div>
    ),
  },
);

/** Translate Korean UV level labels to English; pass through for other locales */
function localizeUvLabel(value: string | undefined, language: string) {
  if (!value) return "--";
  if (language === "ko") return value;

  // Trim leading/trailing whitespace, then normalize internal spaces for robust matching
  const normalized = value.trim().replace(/\s+/g, "");
  switch (normalized) {
    case "낮음":
      return "Low";
    case "보통":
      return "Moderate";
    case "높음":
      return "High";
    case "매우높음":
      return "Very High";
    case "위험":
      return "Extreme";
    default:
      return value;
  }
}

// ---- Component ----

export default function Home() {
  const { resolvedTheme } = useTheme();
  const { language, t } = useLanguage();

  // ---- Custom hooks: data fetching ----
  const { weatherData } = useWeatherData();
  const { hourlyForecast, weatherImages, fireSummary } =
    useDerivedWeatherData(weatherData);

  // ---- Derived values ----
  const heroMessageSeed = useMemo(() => {
    // 서버 시간을 우선 사용 (taste: 서버 시간을 표준 시간으로 사용)
    const serverTimeStr = weatherData?.metadata?.lastUpdate;
    let now: Date;
    
    if (serverTimeStr) {
      const parsed = parseServerTimestamp(
        typeof serverTimeStr === "string" ? serverTimeStr : serverTimeStr.kma
      );
      now = parsed || new Date();
    } else {
      now = new Date();
    }
    
    return (
      (now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()) %
      1_000_000
    );
  }, [weatherData?.metadata?.lastUpdate]);
  const particleColor = resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4";
  const particleQuantity = useMemo(() => getParticleCount(20), []);
  const meteorCount = useMemo(() => getMeteorCount(3), []);
  const enableAnimations = useMemo(() => shouldRunRichAnimation(), []);

  // ---- Computed values (must be before early return for hook rules) ----
  const feelsLikeValue =
    weatherData?.details.feelsLike ?? weatherData?.details.temp;

  const quickMetrics = useMemo(
    () =>
      weatherData
        ? [
            {
              icon: ThermometerIcon,
              label: t("hero_temp"),
              value: `${weatherData.details.temp ?? "--"}°C`,
              tone: "text-orange-400",
              meta: `${
                language === "ko"
                  ? "체감"
                  : language === "zh"
                    ? "体感"
                    : language === "ja"
                      ? "体感"
                      : "Feels"
              } ${feelsLikeValue ?? "--"}°C`,
            },
            {
              icon: DropletsIcon,
              label: t("hero_humidity"),
              value: `${weatherData.details.humidity ?? "--"}%`,
              tone: "text-blue-400",
            },
            {
              icon: WindIcon,
              label: t("hero_wind"),
              value: `${weatherData.details.wind ?? "--"}m/s`,
              tone: "text-teal-400",
            },
            {
              icon: CloudIcon,
              label: t("hero_dust"),
              value: weatherData.details.dust,
              tone: "text-neutral-400",
              meta:
                weatherData.details.kr && weatherData.details.who
                  ? `KR ${weatherData.details.kr} · WHO ${weatherData.details.who}`
                  : null,
            },
            {
              icon: SunIcon,
              label: t("hero_uv"),
              value: localizeUvLabel(weatherData.details.uv, language),
              tone: "text-yellow-400",
            },
          ]
        : [],
    [weatherData, language, feelsLikeValue, t],
  );

  const hasBriefingAlert = Boolean(
    weatherData?.eventData?.isEarthquake ||
    weatherData?.eventData?.isTsunami ||
    weatherData?.eventData?.isVolcano ||
    weatherData?.eventData?.isWeatherWarning ||
    weatherData?.eventData?.isRain,
  );

  // ---- Render guard ----

  if (!weatherData) {
    return (
      <div className="min-h-screen w-full bg-background px-4 pb-24 pt-24 sm:pt-32 flex flex-col items-center justify-center overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_center,rgba(47,111,228,0.1),transparent_60%)]" />
        <div className="z-10 flex max-w-6xl w-full flex-col items-center gap-8 text-center">
          <div className="space-y-3 w-full max-w-xl flex flex-col items-center">
            <Skeleton className="h-14 w-3/4 sm:w-2/3 max-w-md rounded-2xl" />
            <Skeleton className="h-7 w-1/2 rounded-xl mt-2" />
          </div>
          <div className="relative flex size-64 sm:size-80 items-center justify-center rounded-full bg-card/50 border border-card-border/60 shadow-xl backdrop-blur-md">
            <Skeleton className="size-56 sm:size-72 rounded-full flex flex-col items-center justify-center gap-2">
              <span className="text-sky-blue font-black text-xs sm:text-sm uppercase tracking-[0.3em] animate-pulse">
                {t("loading_weather")}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-foreground/45">
                Nadeulhae Outing Lab
              </span>
            </Skeleton>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 mt-12 w-full max-w-4xl mx-auto px-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-3 basis-1/3 sm:basis-auto w-[120px]"
              >
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
        <div className="container mx-auto px-4 w-full max-w-6xl mt-12 space-y-8 relative z-20">
          <Skeleton className="h-64 w-full rounded-[2.7rem]" />
          <Skeleton className="h-72 w-full rounded-[2.7rem]" />
        </div>
      </div>
    );
  }

  // ---- Computed values (safe: weatherData is non-null past this point) ----
  const scoreColors =
    weatherData.score >= 86
      ? { primary: "#0b7d71", secondary: "#2f6fe4" }
      : weatherData.score >= 66
        ? { primary: "#2f6fe4", secondary: "#7db3ff" }
        : weatherData.score >= 36
          ? { primary: "#4d9a90", secondary: "#77b2f0" }
          : { primary: "#ef4444", secondary: "#f87171" };

  // ---- Main render ----

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-background">
      {/* Hero — score circle, quick metrics, particles */}
      <section className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden py-24 sm:py-32">
        {particleQuantity > 0 && (
          <Particles
            className="absolute inset-0 z-0 opacity-70"
            quantity={particleQuantity}
            ease={80}
            color={particleColor}
          />
        )}
        {meteorCount > 0 && <Meteors number={meteorCount} className="z-0" />}

        <div className="z-10 flex max-w-6xl flex-col items-center gap-6 px-4 text-center">
          {weatherData.isFallback && (
            <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-full border border-card-border shadow-lg">
              <Info className="text-sky-blue size-4 animate-pulse" />
              <span className="text-[12px] sm:text-sm font-black text-foreground">
                {t("fallback_message")}
              </span>
            </div>
          )}

          <WordPullUp
            words={t(
              weatherData.message,
              `${weatherData.metadata?.regionKey ?? "default"}-${heroMessageSeed}-${language}`,
            )}
            className="text-4xl sm:text-5xl md:text-7xl text-sky-blue px-4 font-black tracking-tight"
          />

          <MagicCard
            className="rounded-full"
            gradientFrom={scoreColors.primary}
            gradientTo={scoreColors.secondary}
          >
            <div
              className="relative flex size-64 sm:size-80 items-center justify-center rounded-full bg-card shadow-2xl transition-all hover:scale-105 duration-500"
              style={
                !enableAnimations
                  ? {
                      boxShadow: `0 0 24px 2px ${scoreColors.primary}40, 0 0 0 3px ${scoreColors.primary}`,
                    }
                  : undefined
              }
            >
              {enableAnimations && (
                <ShineBorder
                  shineColor={[
                    scoreColors.primary,
                    scoreColors.secondary,
                    "#ffffff",
                  ]}
                  duration={10}
                  borderWidth={2}
                  className="rounded-full"
                />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center z-30">
                <span className="text-sky-blue font-black text-xs sm:text-sm uppercase tracking-[0.3em] mb-1">
                  {t("hero_score_label")}
                </span>
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.22em] text-foreground/45 mb-2">
                  {t("hero_score_subtitle")}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-6xl sm:text-8xl font-black tracking-tighter text-foreground">
                    {weatherData.score}
                  </span>
                  <span className="text-sm sm:text-xl font-black text-foreground/70">
                    {t("hero_unit")}
                  </span>
                </div>
                {weatherData.score >= 80 && (
                  <div className="mt-2 text-[10px] sm:text-xs font-black text-sky-blue bg-sky-blue/10 px-3 py-1 rounded-full border border-sky-blue/20 animate-pulse">
                    {t("hero_best_day")}
                  </div>
                )}
                {hasBriefingAlert && (
                  <div className="mt-3 rounded-full border border-orange-500/20 bg-orange-500/8 px-3 py-1 text-[10px] sm:text-xs font-black tracking-wide text-orange-600 dark:text-orange-300">
                    {language === "ko"
                      ? "세부 경고는 아래 브리핑에서 확인"
                      : language === "zh"
                        ? "请查看下方简报中的详细警告"
                        : language === "ja"
                          ? "詳細な警告は下のブリーフィングでご確認ください"
                          : "See briefing below for active alerts"}
                  </div>
                )}
              </div>
            </div>
          </MagicCard>

          <div className="flex flex-wrap items-start justify-center gap-y-12 sm:gap-10 mt-12 text-foreground w-full max-w-4xl mx-auto px-4">
            {quickMetrics.map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center basis-1/2 sm:basis-1/3 xl:basis-auto transition-transform hover:scale-105 active:scale-95 duration-300 max-w-[180px]"
              >
                <item.icon className={cn(item.tone, "mb-2 size-6 sm:size-8")} />
                <span className="text-[10px] sm:text-[12px] text-neutral-400 uppercase tracking-widest font-black leading-none mb-1 text-center">
                  {item.label}
                </span>
                <span className="font-black text-xl sm:text-3xl leading-tight text-center">
                  {item.value}
                </span>
                {"meta" in item && item.meta ? (
                  <span className="mt-1 text-[10px] sm:text-[11px] font-bold leading-relaxed text-muted-foreground text-center break-words">
                    {item.meta}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content sections — forecast, briefing, fire insights, images */}
      <div className="container mx-auto px-4 relative z-20 pb-24 sm:pb-28">
        {enableAnimations ? (
          <BlurFade delay={0.1}>
            <TodayHourlyForecast items={hourlyForecast} />
          </BlurFade>
        ) : (
          <TodayHourlyForecast items={hourlyForecast} />
        )}
        {enableAnimations ? (
          <BlurFade delay={0.15}>
            <PicnicBriefing weatherData={weatherData} />
          </BlurFade>
        ) : (
          <PicnicBriefing weatherData={weatherData} />
        )}
        {fireSummary?.overview?.showOnHome &&
          (enableAnimations ? (
            <BlurFade delay={0.2}>
              <div className="mt-6">
                <FireInsightPanel
                  data={fireSummary}
                  language={language}
                  variant="compact"
                />
              </div>
            </BlurFade>
          ) : (
            <div className="mt-6">
              <FireInsightPanel
                data={fireSummary}
                language={language}
                variant="compact"
              />
            </div>
          ))}
        {enableAnimations ? (
          <BlurFade delay={0.25}>
            <WeatherImagePanel data={weatherImages} weather={weatherData} />
          </BlurFade>
        ) : (
          <WeatherImagePanel data={weatherImages} weather={weatherData} />
        )}
      </div>

      {/* Footer — legal links and attribution */}
      <footer className="py-12 border-t border-neutral-100 dark:border-neutral-800 text-center transition-colors">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 px-4">
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {t("footer_copy")}
          </p>
          <p className="max-w-3xl text-xs leading-relaxed text-neutral-400 dark:text-neutral-500">
            {t("footer_notice")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/terms"
              className="text-xs font-medium text-sky-blue/70 hover:text-sky-blue transition-colors"
            >
              {t("footer_terms")}
            </Link>
            <span className="text-neutral-300 dark:text-neutral-600">·</span>
            <Link
              href="/about"
              className="text-xs font-medium text-sky-blue/70 hover:text-sky-blue transition-colors"
            >
              {t("footer_about")}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
