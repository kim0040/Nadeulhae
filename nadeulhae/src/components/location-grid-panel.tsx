"use client"

import { Grid3X3, MapPinned, Radar, SatelliteDish } from "lucide-react"

import { MagicCard } from "@/components/magicui/magic-card"
import { useLanguage } from "@/context/LanguageContext"
import type { WeatherData } from "@/services/dataService"
import { cn } from "@/lib/utils"

interface LocationGridPanelProps {
  weatherData: WeatherData
}

function formatOptionalNumber(value: number | null | undefined, digits = 4) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--"
  return value.toFixed(digits)
}

function getStationSourceLabel(source: string | undefined, language: string) {
  if (source === "live_api") {
    return language === "ko" ? "실시간 인근 관측소 매핑" : "Live nearby-station mapping"
  }
  if (source === "cache") {
    return language === "ko" ? "관측소 캐시 매핑" : "Cached station mapping"
  }
  return language === "ko" ? "권역 기본 매핑" : "Regional default mapping"
}

export function LocationGridPanel({ weatherData }: LocationGridPanelProps) {
  const { language } = useLanguage()
  const ctx = weatherData.metadata?.locationContext
  const candidates = ctx?.stationMap?.candidates ?? []
  const sourceLabel = getStationSourceLabel(ctx?.stationMap?.source, language)

  const labels = language === "ko"
    ? {
        title: "지도 · 격자 매핑",
        subtitle: "현재 좌표를 기상 격자와 관측 체계로 변환한 결과입니다.",
        coord: "현재 좌표 (WGS84)",
        grid: "기상 격자 (DFS)",
        tm: "TM 좌표 (AirKorea)",
        station: "선택 관측소",
        candidates: "인근 관측소 후보",
        none: "표시 가능한 후보가 없습니다.",
        profile: "지역 프로파일",
        weatherStation: "기상 통보소",
      }
    : {
        title: "Map · Grid Mapping",
        subtitle: "Current coordinates converted into weather-grid and observation mapping.",
        coord: "Current Coordinates (WGS84)",
        grid: "Weather Grid (DFS)",
        tm: "TM Coordinates (AirKorea)",
        station: "Selected Station",
        candidates: "Nearby Station Candidates",
        none: "No candidate stations are available.",
        profile: "Regional Profile",
        weatherStation: "Weather Station ID",
      }

  return (
    <section className="mt-8 w-full max-w-5xl mx-auto">
      <MagicCard
        className="rounded-[2.5rem] border border-card-border p-6 sm:p-8"
        gradientSize={260}
        gradientFrom="#0b7d71"
        gradientTo="#2f6fe4"
      >
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{labels.title}</h3>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground font-medium">{labels.subtitle}</p>
          </div>
          <span className="inline-flex items-center rounded-full border border-sky-blue/20 bg-sky-blue/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-sky-blue">
            {sourceLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--interactive-border)] bg-[var(--interactive)] p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPinned size={14} className="text-sky-blue" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{labels.coord}</span>
            </div>
            <p className="mt-3 text-lg font-black text-foreground tabular-nums">
              {formatOptionalNumber(ctx?.coordinates?.lat)} / {formatOptionalNumber(ctx?.coordinates?.lon)}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--interactive-border)] bg-[var(--interactive)] p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Grid3X3 size={14} className="text-nature-green" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{labels.grid}</span>
            </div>
            <p className="mt-3 text-lg font-black text-foreground tabular-nums">
              NX {ctx?.grid?.nx ?? "--"} · NY {ctx?.grid?.ny ?? "--"}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--interactive-border)] bg-[var(--interactive)] p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Radar size={14} className="text-active-blue" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{labels.tm}</span>
            </div>
            <p className="mt-3 text-lg font-black text-foreground tabular-nums">
              X {ctx?.tm?.x ?? "--"} · Y {ctx?.tm?.y ?? "--"}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--interactive-border)] bg-[var(--interactive)] p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <SatelliteDish size={14} className="text-orange-500" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{labels.station}</span>
            </div>
            <p className="mt-3 text-lg font-black text-foreground">
              {ctx?.stationMap?.selected || weatherData.metadata?.station || "--"}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--interactive-border)] bg-[var(--interactive)] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              {labels.candidates}
            </span>
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-black text-muted-foreground">
              {labels.profile}: {ctx?.profile?.key || weatherData.metadata?.regionKey || "--"}
            </span>
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-black text-muted-foreground">
              {labels.weatherStation}: {ctx?.profile?.weatherStationId || "--"}
            </span>
          </div>
          {candidates.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {candidates.map((station) => (
                <span
                  key={`${station.name}-${station.distanceKm ?? "na"}`}
                  className={cn(
                    "rounded-full border border-sky-blue/15 bg-card px-3 py-1.5 text-xs font-bold text-foreground"
                  )}
                >
                  {station.name}
                  {typeof station.distanceKm === "number" ? ` · ${station.distanceKm}km` : ""}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">{labels.none}</p>
          )}
        </div>
      </MagicCard>
    </section>
  )
}
