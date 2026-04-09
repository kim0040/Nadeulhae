"use client"

import { Flame, ShieldAlert, TrendingUp, Trees, Warehouse } from "lucide-react"

import { BorderBeam } from "@/components/magicui/border-beam"
import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text"
import { type FireSummaryData } from "@/services/dataService"
import { cn } from "@/lib/utils"

interface FireInsightPanelProps {
  data: FireSummaryData
  language: "ko" | "en"
  variant?: "full" | "compact"
}

function formatDateLabel(date: string) {
  if (!date || date.length !== 8) return date
  return `${date.slice(0, 4)}.${date.slice(4, 6)}.${date.slice(6, 8)}`
}

export function FireInsightPanel({
  data,
  language,
  variant = "full",
}: FireInsightPanelProps) {
  const isCompact = variant === "compact"
  const cautionTone = data.overview.cautionLevel === "high"
    ? "text-red-500 border-red-500/20 bg-red-500/8"
    : data.overview.cautionLevel === "moderate"
      ? "text-orange-500 border-orange-500/20 bg-orange-500/8"
      : "text-nature-green border-nature-green/20 bg-nature-green/8"

  const topPlace = data.topPlaces[0]

  if (isCompact) {
    return (
      <div className="relative overflow-hidden rounded-[2rem] border border-card-border bg-card px-5 py-4 shadow-[0_18px_45px_-35px_rgba(47,111,228,0.32)]">
        <BorderBeam size={200} duration={8} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
        <div className="relative z-10 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
          <div className="min-w-0 sm:pr-2">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              <Flame size={14} className="text-orange-500" />
              {language === "ko" ? "지역 화재 흐름" : "Regional fire flow"}
            </div>
            <p className="mt-2 text-base sm:text-lg font-bold leading-relaxed text-foreground break-keep">
              {language === "ko" ? data.overview.shortMessageKo : data.overview.shortMessageEn}
            </p>
          </div>
          <div className={cn("inline-flex w-fit shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide sm:justify-self-end", cautionTone)}>
            {language === "ko" ? `최근 기준 ${formatDateLabel(data.metadata.latestDate)}` : `Latest ${formatDateLabel(data.metadata.latestDate)}`}
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className="rounded-[3rem] border border-card-border bg-card p-8 sm:p-12 shadow-[0_24px_80px_-50px_rgba(47,111,228,0.34)] relative overflow-hidden">
      <BorderBeam size={280} duration={10} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
      <div className="relative z-10">
        <div className="max-w-3xl">
          <AnimatedGradientText className="text-3xl sm:text-5xl font-black tracking-tight">
            {language === "ko" ? "전북 화재 흐름 한눈에 보기" : "A quick look at Jeonbuk fire flow"}
          </AnimatedGradientText>
          <p className="mt-4 text-base sm:text-lg font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400">
            {language === "ko"
              ? "전북에서 최근 어떤 곳의 화재가 많았는지, 요즘 흐름이 어떤지 가볍게 훑어보는 참고 구역입니다."
              : "This section gives a quick read on where recent fires have been concentrated in Jeonbuk and how the latest flow looks."}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <span className={cn("inline-flex rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide", cautionTone)}>
            {language === "ko"
              ? `최근 기준 ${formatDateLabel(data.metadata.latestDate)}`
              : `Latest ${formatDateLabel(data.metadata.latestDate)}`}
          </span>
          <span className="inline-flex rounded-full border border-active-blue/20 bg-active-blue/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-active-blue">
            {language === "ko"
              ? `${data.metadata.coverageDays}일 집계`
              : `${data.metadata.coverageDays}-day window`}
          </span>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-[1.9rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              <ShieldAlert size={14} className="text-orange-500" />
              {language === "ko" ? "최근 접수" : "Latest reports"}
            </div>
            <div className="mt-3 text-4xl font-black tracking-tight text-foreground">{data.overview.latestFireReceipt}</div>
            <p className="mt-2 text-base sm:text-lg font-bold text-muted-foreground">
              {language === "ko"
                ? `진행 ${data.overview.latestInProgress}건 · 종료 ${data.overview.latestSituationEnd}건`
                : `${data.overview.latestInProgress} in progress · ${data.overview.latestSituationEnd} closed`}
            </p>
          </div>

          <div className="rounded-[1.9rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              <TrendingUp size={14} className="text-sky-blue" />
              {language === "ko" ? "최근 평균" : "Recent average"}
            </div>
            <div className="mt-3 text-4xl font-black tracking-tight text-foreground">{data.overview.sevenDayAverage}</div>
            <p className="mt-2 text-base sm:text-lg font-bold text-muted-foreground">
              {language === "ko"
                ? `최근 ${data.metadata.coverageDays}일 총 ${data.overview.sevenDayTotal}건`
                : `${data.overview.sevenDayTotal} total over ${data.metadata.coverageDays} days`}
            </p>
          </div>

          <div className="rounded-[1.9rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              {topPlace?.outdoor ? (
                <Trees size={14} className="text-nature-green" />
              ) : (
                <Warehouse size={14} className="text-active-blue" />
              )}
              {language === "ko" ? "눈에 띈 장소" : "Standout place"}
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-foreground break-keep">
              {topPlace?.name || (language === "ko" ? "데이터 없음" : "No data")}
            </div>
            <p className="mt-2 text-base sm:text-lg font-bold text-muted-foreground">
              {topPlace
                ? (language === "ko"
                  ? `${topPlace.count}건 · 재산피해 ${topPlace.propertyDamage.toLocaleString()}천원`
                  : `${topPlace.count} cases · property loss ${topPlace.propertyDamage.toLocaleString()}k KRW`)
                : (language === "ko" ? "장소별 데이터 없음" : "No place breakdown available")}
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-card-border bg-[var(--interactive)] px-5 py-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              {language === "ko" ? "이 기능은" : "What this shows"}
            </div>
            <p className="mt-3 text-base sm:text-lg font-bold leading-relaxed text-foreground break-keep">
              {language === "ko" ? data.overview.shortMessageKo : data.overview.shortMessageEn}
            </p>
            <p className="mt-4 text-base font-bold text-muted-foreground break-keep">
              {language === "ko"
                ? `${formatDateLabel(data.overview.peakDate)}에 ${data.overview.peakFireReceipt}건으로 가장 높았습니다.`
                : `The local peak was ${formatDateLabel(data.overview.peakDate)} with ${data.overview.peakFireReceipt} reported fires.`}
            </p>
          </div>

          <div className="rounded-[2rem] border border-card-border bg-[var(--interactive)] px-5 py-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              {language === "ko" ? "자주 보인 장소" : "Frequently seen places"}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.topPlaces.map((place) => (
                <span
                  key={place.name}
                  className={cn(
                    "inline-flex rounded-full border px-3 py-2 text-sm font-black tracking-wide",
                    place.outdoor
                      ? "border-nature-green/20 bg-nature-green/10 text-nature-green"
                      : "border-active-blue/20 bg-active-blue/10 text-active-blue"
                  )}
                >
                  {place.name} · {place.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
