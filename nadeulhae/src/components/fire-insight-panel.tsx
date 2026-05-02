"use client"

import { Flame, ShieldAlert, TrendingUp, Trees, Warehouse } from "lucide-react"

import { BorderBeam } from "@/components/magicui/border-beam"
import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text"
import { type FireSummaryData } from "@/services/dataService"
import { cn } from "@/lib/utils"

interface FireInsightPanelProps {
  data: FireSummaryData
  language: string
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
              {language === "ko" ? "지역 화재 흐름" : language === "zh" ? "区域火灾趋势" : language === "ja" ? "地域の火災状況" : "Regional fire flow"}
            </div>
            <p className="mt-2 text-base sm:text-lg font-bold leading-relaxed text-foreground break-words">
              {language === "ko" ? data.overview.shortMessageKo : language === "zh" ? data.overview.shortMessageZh : language === "ja" ? data.overview.shortMessageJa : data.overview.shortMessageEn}
            </p>
          </div>
          <div className={cn("inline-flex w-fit shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide sm:justify-self-end", cautionTone)}>
            {language === "ko" ? `최근 기준 ${formatDateLabel(data.metadata.latestDate)}` : language === "zh" ? `最近基准 ${formatDateLabel(data.metadata.latestDate)}` : language === "ja" ? `最新 ${formatDateLabel(data.metadata.latestDate)} 基準` : `Latest ${formatDateLabel(data.metadata.latestDate)}`}
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
            {language === "ko" ? "전북 화재 흐름 한눈에 보기" : language === "zh" ? "全北火灾趋势一览" : language === "ja" ? "全北の火災状況一覧" : "A quick look at Jeonbuk fire flow"}
          </AnimatedGradientText>
          <p className="mt-4 text-base sm:text-lg font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400 break-words">
            {language === "ko"
              ? "전북에서 최근 어떤 곳의 화재가 많았는지, 요즘 흐름이 어떤지 가볍게 훑어보는 참고 구역입니다."
              : language === "zh"
                ? "此区域可快速了解全北近期哪些地区火灾频发，以及最新的火灾趋势。"
                : language === "ja"
                  ? "このセクションでは、全北で最近どこで火災が多かったか、最新の状況を簡単に確認できます。"
                  : "This section gives a quick read on where recent fires have been concentrated in Jeonbuk and how the latest flow looks."}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <span className={cn("inline-flex rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide", cautionTone)}>
            {language === "ko"
              ? `최근 기준 ${formatDateLabel(data.metadata.latestDate)}`
              : language === "zh"
                ? `最近基准 ${formatDateLabel(data.metadata.latestDate)}`
                : language === "ja"
                  ? `最新 ${formatDateLabel(data.metadata.latestDate)} 基準`
                  : `Latest ${formatDateLabel(data.metadata.latestDate)}`}
          </span>
          <span className="inline-flex rounded-full border border-active-blue/20 bg-active-blue/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-active-blue">
            {language === "ko"
              ? `${data.metadata.coverageDays}일 집계`
              : language === "zh"
                ? `${data.metadata.coverageDays}天统计`
                : language === "ja"
                  ? `${data.metadata.coverageDays}日集計`
                  : `${data.metadata.coverageDays}-day window`}
          </span>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-[1.9rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              <ShieldAlert size={14} className="text-orange-500" />
              {language === "ko" ? "최근 접수" : language === "zh" ? "最近接收" : language === "ja" ? "最近の受理" : "Latest reports"}
            </div>
            <div className="mt-3 text-4xl font-black tracking-tight text-foreground">{data.overview.latestFireReceipt}</div>
            <p className="mt-2 text-base sm:text-lg font-bold text-muted-foreground">
              {language === "ko"
                ? `진행 ${data.overview.latestInProgress}건 · 종료 ${data.overview.latestSituationEnd}건`
                : language === "zh"
                  ? `进行中 ${data.overview.latestInProgress}件 · 已结束 ${data.overview.latestSituationEnd}件`
                  : language === "ja"
                    ? `進行中 ${data.overview.latestInProgress}件 · 終了 ${data.overview.latestSituationEnd}件`
                    : `${data.overview.latestInProgress} in progress · ${data.overview.latestSituationEnd} closed`}
            </p>
          </div>

          <div className="rounded-[1.9rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              <TrendingUp size={14} className="text-sky-blue" />
              {language === "ko" ? "최근 평균" : language === "zh" ? "最近平均" : language === "ja" ? "最近の平均" : "Recent average"}
            </div>
            <div className="mt-3 text-4xl font-black tracking-tight text-foreground">{data.overview.sevenDayAverage}</div>
            <p className="mt-2 text-base sm:text-lg font-bold text-muted-foreground">
              {language === "ko"
                ? `최근 ${data.metadata.coverageDays}일 총 ${data.overview.sevenDayTotal}건`
                : language === "zh"
                  ? `最近${data.metadata.coverageDays}天共${data.overview.sevenDayTotal}件`
                  : language === "ja"
                    ? `最近${data.metadata.coverageDays}日合計${data.overview.sevenDayTotal}件`
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
              {language === "ko" ? "눈에 띈 장소" : language === "zh" ? "突出地点" : language === "ja" ? "目立った場所" : "Standout place"}
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-foreground break-words">
              {topPlace?.name || (language === "ko" ? "데이터 없음" : language === "zh" ? "暂无数据" : language === "ja" ? "データなし" : "No data")}
            </div>
            <p className="mt-2 text-base sm:text-lg font-bold text-muted-foreground">
              {topPlace
                ? (language === "ko"
                  ? `${topPlace.count}건 · 재산피해 ${topPlace.propertyDamage.toLocaleString()}천원`
                  : language === "zh"
                    ? `${topPlace.count}件 · 财产损失 ${topPlace.propertyDamage.toLocaleString()}千韩元`
                    : language === "ja"
                      ? `${topPlace.count}件 · 財産被害 ${topPlace.propertyDamage.toLocaleString()}千ウォン`
                      : `${topPlace.count} cases · property loss ${topPlace.propertyDamage.toLocaleString()}k KRW`)
                : (language === "ko" ? "장소별 데이터 없음" : language === "zh" ? "暂无地点数据" : language === "ja" ? "場所別データなし" : "No place breakdown available")}
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-card-border bg-[var(--interactive)] px-5 py-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              {language === "ko" ? "이 기능은" : language === "zh" ? "功能介绍" : language === "ja" ? "この機能について" : "What this shows"}
            </div>
            <p className="mt-3 text-base sm:text-lg font-bold leading-relaxed text-foreground break-words">
              {language === "ko" ? data.overview.shortMessageKo : language === "zh" ? (data.overview as any).shortMessageZh ?? data.overview.shortMessageEn : language === "ja" ? (data.overview as any).shortMessageJa ?? data.overview.shortMessageEn : data.overview.shortMessageEn}
            </p>
            <p className="mt-4 text-base font-bold text-muted-foreground break-words">
              {language === "ko"
                ? `${formatDateLabel(data.overview.peakDate)}에 ${data.overview.peakFireReceipt}건으로 가장 높았습니다.`
                : language === "zh"
                  ? `${formatDateLabel(data.overview.peakDate)}日达到${data.overview.peakFireReceipt}件，为最高值。`
                  : language === "ja"
                    ? `${formatDateLabel(data.overview.peakDate)}に${data.overview.peakFireReceipt}件と最も高くなりました。`
                    : `The local peak was ${formatDateLabel(data.overview.peakDate)} with ${data.overview.peakFireReceipt} reported fires.`}
            </p>
          </div>

          <div className="rounded-[2rem] border border-card-border bg-[var(--interactive)] px-5 py-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              {language === "ko" ? "자주 보인 장소" : language === "zh" ? "常见地点" : language === "ja" ? "よく見られる場所" : "Frequently seen places"}
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
