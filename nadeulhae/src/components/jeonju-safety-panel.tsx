"use client"

import {
  CloudRain,
  Flame,
  MapPinned,
  ShieldCheck,
  Siren,
  Thermometer,
  Waves,
  Wind,
} from "lucide-react"

import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text"
import { BorderBeam } from "@/components/magicui/border-beam"
import { type FireSummaryData, type WeatherData } from "@/services/dataService"
import { cn } from "@/lib/utils"

interface JeonjuSafetyPanelProps {
  weatherData: WeatherData
  fireSummary: FireSummaryData | null
  language: string
}

type Tone = "safe" | "info" | "caution" | "danger"

const NON_BULLETIN_MESSAGE_PATTERN = /(전주 기준 대기질 데이터를 표시 중입니다|showing fallback air quality data)/i
const EMPTY_BULLETIN_PATTERN = /^(?:[oO○◯●□■▪︎ㆍ·\-\*\s]*)?(?:없음|없\s*음|none|no\s*alerts?|n\/a)(?:[\s.)\]]*)$/i

function formatDateLabel(date: string) {
  if (!date || date.length !== 8) return date
  return `${date.slice(0, 4)}.${date.slice(4, 6)}.${date.slice(6, 8)}`
}

function formatShortDateLabel(date: string, language: string) {
  if (!date || date.length !== 8) return date
  const month = Number(date.slice(4, 6))
  const day = Number(date.slice(6, 8))
  return language === "ko" ? `${month}.${day}` : `${month}/${day}`
}

function formatUpdateLabel(value?: string) {
  if (!value) return ""
  return value.replace("T", " ").slice(0, 16).replace(/-/g, ".")
}

function toneClasses(tone: Tone) {
  switch (tone) {
    case "danger":
      return "border-red-500/20 bg-red-500/8 text-red-600 dark:text-red-300"
    case "caution":
      return "border-orange-500/20 bg-orange-500/8 text-orange-600 dark:text-orange-300"
    case "info":
      return "border-sky-blue/20 bg-sky-blue/10 text-sky-blue"
    default:
      return "border-nature-green/20 bg-nature-green/10 text-nature-green"
  }
}

function selectOfficialAlertText(weatherData: WeatherData) {
  const { metadata, eventData } = weatherData

  return [
    metadata?.alertSummary?.warningTitle,
    metadata?.alertSummary?.earthquakeTitle,
    metadata?.alertSummary?.tsunamiTitle,
    metadata?.alertSummary?.volcanoTitle,
    metadata?.bulletin?.warningStatus,
    metadata?.bulletin?.summary,
    eventData?.warningMessage,
  ]
    .map((value) => String(value ?? "").trim())
    .find((value) => value.length > 0
      && !NON_BULLETIN_MESSAGE_PATTERN.test(value)
      && !EMPTY_BULLETIN_PATTERN.test(value)) || ""
}

function getHazardChips(weatherData: WeatherData, language: string) {
  const chips: Array<{ label: string; tone: Tone }> = []
  const { eventData, metadata } = weatherData

  if (eventData?.isWeatherWarning) {
    chips.push({ label: language === "ko" ? "특보" : "Warning", tone: "danger" })
  }
  if (eventData?.isRain) {
    chips.push({ label: language === "ko" ? "강수" : "Rain", tone: "caution" })
  }
  if (eventData?.isEarthquake) {
    chips.push({ label: language === "ko" ? "지진" : "Earthquake", tone: "danger" })
  }
  if (eventData?.isTsunami) {
    chips.push({ label: language === "ko" ? "지진해일" : "Tsunami", tone: "danger" })
  }
  if (eventData?.isVolcano) {
    chips.push({ label: language === "ko" ? "화산" : "Volcano", tone: "danger" })
  }
  if (eventData?.isTyphoon) {
    chips.push({ label: language === "ko" ? "태풍" : "Typhoon", tone: "danger" })
  }

  if (!chips.length) {
    const warningStatus = metadata?.bulletin?.warningStatus?.replace(/\s+/g, "")
    if (warningStatus && !/없음|none|o없음/i.test(warningStatus)) {
      chips.push({ label: language === "ko" ? "기상통보" : "Bulletin", tone: "info" })
    }
  }

  if (!chips.length) {
    chips.push({ label: language === "ko" ? "안정" : "Stable", tone: "safe" })
  }

  return chips
}

function getHazardSummary(weatherData: WeatherData, language: string) {
  const { eventData } = weatherData
  const detail = selectOfficialAlertText(weatherData)

  if (eventData?.isEarthquake || eventData?.isTsunami || eventData?.isVolcano || eventData?.isWeatherWarning) {
    return {
      tone: "danger" as const,
      count: [
        eventData?.isEarthquake,
        eventData?.isTsunami,
        eventData?.isVolcano,
        eventData?.isWeatherWarning,
      ].filter(Boolean).length,
      title: language === "ko" ? "활성 안전 신호" : "Active safety signal",
      text: detail || (language === "ko" ? "전주 기준 재난 또는 특보 신호가 감지되었습니다." : "A disaster or warning signal is active for Jeonju."),
    }
  }

  if (eventData?.isRain) {
    return {
      tone: "caution" as const,
      count: 1,
      title: language === "ko" ? "현재 강수" : "Current precipitation",
      text: language === "ko"
        ? "비 또는 약한 강수가 감지되어 바깥 일정 전 노면과 우산 여부를 함께 확인하는 편이 좋습니다."
        : "Rain or light precipitation is currently detected, so it is worth checking road conditions before heading out.",
    }
  }

  return {
    tone: "safe" as const,
    count: 0,
    title: language === "ko" ? "활성 특보 없음" : "No active warning",
    text: language === "ko"
      ? "전주 기준 현재 특보·지진·지진해일·화산 경보는 감지되지 않았습니다."
      : "No active warning, earthquake, tsunami, or volcano signal is currently detected for Jeonju.",
  }
}

function getMobilitySummary(weatherData: WeatherData, language: string) {
  const { details, eventData, metadata } = weatherData
  const bulletin = metadata?.bulletin?.summary || ""

  if (eventData?.isWeatherWarning || eventData?.isEarthquake || eventData?.isTsunami || eventData?.isVolcano) {
    return {
      tone: "danger" as const,
      label: language === "ko" ? "이동 재검토" : "Recheck travel",
      text: language === "ko"
        ? "위험 신호가 감지된 날에는 전주 내 이동 일정을 줄이거나 실내 위주로 바꾸는 편이 안전합니다."
        : "When a hazard signal is active, it is safer to reduce movement and lean toward indoor plans in Jeonju.",
    }
  }

  if (eventData?.isRain || (details.rn1 || 0) > 0) {
    return {
      tone: "caution" as const,
      label: language === "ko" ? "젖은 노면 주의" : "Wet roads",
      text: language === "ko"
        ? "비가 내리면 전주천·덕진공원 주변 보행 구간과 차량 이동 모두 미끄럼에 주의하는 편이 좋습니다."
        : "Rain makes walking paths and local roads around Jeonju more slippery, so slower movement is advised.",
    }
  }

  if ((details.wind || 0) >= 7) {
    return {
      tone: "caution" as const,
      label: language === "ko" ? "강풍 구간 주의" : "Windy spots",
      text: language === "ko"
        ? "순간 바람이 강한 날에는 한옥마을 골목이나 개방된 공원 구간에서 체감이 크게 달라질 수 있습니다."
        : "When winds pick up, open park areas and narrow alleys in Jeonju can feel rougher than the raw number suggests.",
    }
  }

  if ((details.feelsLike ?? details.temp) <= 1) {
    return {
      tone: "caution" as const,
      label: language === "ko" ? "찬 공기 주의" : "Cold air",
      text: language === "ko"
        ? "체감 온도가 낮아 이른 시간대 이동은 다소 차갑게 느껴질 수 있습니다. 얇은 겉옷 하나 더 챙기는 편이 좋습니다."
        : "The air feels cold enough that early movement may be uncomfortable, so an extra layer is a good idea.",
    }
  }

  if ((details.humidity || 0) >= 90 && /안개/.test(bulletin)) {
    return {
      tone: "info" as const,
      label: language === "ko" ? "시야 확인" : "Check visibility",
      text: language === "ko"
        ? "안개 언급이 있어 하천변이나 외곽 이동 구간은 시야를 한 번 더 확인하는 편이 좋습니다."
        : "Fog is mentioned in the bulletin, so riverside and outer-road visibility is worth checking.",
    }
  }

  return {
    tone: "safe" as const,
    label: language === "ko" ? "이동 무난" : "Steady movement",
    text: language === "ko"
      ? "전주 시내 이동과 가벼운 산책을 하기에는 비교적 무난한 흐름입니다."
      : "Conditions look fairly steady for city movement and a light walk around Jeonju.",
  }
}

function getFireFlowBadge(fireSummary: FireSummaryData | null, language: string) {
  if (!fireSummary) {
    return {
      tone: "info" as const,
      label: language === "ko" ? "집계 대기" : "Loading",
      detail: language === "ko" ? "화재 집계 확인 중" : "Checking fire flow",
    }
  }

  const latest = fireSummary.overview.latestFireReceipt
  const avg = fireSummary.overview.sevenDayAverage

  if (latest >= Math.max(12, avg * 1.4)) {
    return {
      tone: "danger" as const,
      label: language === "ko" ? "평소보다 높음" : "Above usual",
      detail: language === "ko" ? "최근 접수 흐름이 빠르게 올라간 날" : "Recent reports are running high",
    }
  }

  if (latest >= Math.max(6, avg * 1.1)) {
    return {
      tone: "caution" as const,
      label: language === "ko" ? "조금 많음" : "Slightly elevated",
      detail: language === "ko" ? "최근 평균보다 약간 많은 흐름" : "A bit above the recent average",
    }
  }

  return {
    tone: "safe" as const,
    label: language === "ko" ? "비교적 무난" : "Relatively steady",
    detail: language === "ko" ? "최근 평균 안쪽 흐름" : "Within the recent baseline",
  }
}

function getFirePlaceNarrative(fireSummary: FireSummaryData | null, language: string) {
  if (!fireSummary?.topPlaces?.length) {
    return {
      title: language === "ko" ? "장소 패턴 집계 중" : "Reading place patterns",
      text: language === "ko"
        ? "장소별 화재 흐름은 데이터가 모이면 이곳에 정리됩니다."
        : "Place-based fire patterns will appear here once the data is available.",
      chips: [] as Array<{ label: string; tone: Tone }>,
    }
  }

  const outdoorCount = fireSummary.topPlaces.filter((place) => place.outdoor).length
  const indoorCount = fireSummary.topPlaces.length - outdoorCount
  const totalCases = fireSummary.topPlaces.reduce((sum, place) => sum + place.count, 0)
  const topPlace = fireSummary.topPlaces[0]
  const chips: Array<{ label: string; tone: Tone }> = []

  if (outdoorCount > 0) {
    chips.push({
      label: language === "ko" ? `야외성 장소 ${outdoorCount}` : `Outdoor-like ${outdoorCount}`,
      tone: "caution",
    })
  }

  if (indoorCount > 0) {
    chips.push({
      label: language === "ko" ? `시설·생활권 ${indoorCount}` : `Facility / urban ${indoorCount}`,
      tone: "info",
    })
  }

  if (topPlace?.propertyDamage > 0) {
    chips.push({
      label: language === "ko"
        ? `재산피해 ${topPlace.propertyDamage.toLocaleString()}천원`
        : `Loss ${topPlace.propertyDamage.toLocaleString()}k KRW`,
      tone: "danger",
    })
  }

  if (topPlace?.outdoor) {
    return {
      title: language === "ko" ? "야외성 장소 비중이 보입니다" : "Outdoor-type places stand out",
      text: language === "ko"
        ? `최근 집계된 상위 장소 ${fireSummary.topPlaces.length}개 중 ${outdoorCount}개가 야외성 장소로 잡혔습니다. 특히 '${topPlace.name}' 유형이 ${topPlace.count}건으로 가장 많이 보였습니다.`
        : `Among the top ${fireSummary.topPlaces.length} place groups, ${outdoorCount} are outdoor-like. '${topPlace.name}' stands out most with ${topPlace.count} cases.`,
      chips,
    }
  }

  return {
    title: language === "ko" ? "생활권 시설 중심 흐름입니다" : "The flow leans toward daily facilities",
    text: language === "ko"
      ? `최근 상위 장소 ${fireSummary.topPlaces.length}개는 생활권·시설물 비중이 더 큽니다. 대표 유형은 '${topPlace.name}'이며, 집계된 상위 장소 합은 ${totalCases}건입니다.`
      : `The recent top place groups lean more toward everyday facilities. '${topPlace.name}' is the main type, and the top grouped places account for ${totalCases} cases in total.`,
    chips,
  }
}

function getOverallSafetyGuide(weatherData: WeatherData, fireSummary: FireSummaryData | null, language: string) {
  const alertDetail = selectOfficialAlertText(weatherData)

  if (weatherData.eventData?.isEarthquake || weatherData.eventData?.isTsunami || weatherData.eventData?.isVolcano) {
    return {
      tone: "danger" as const,
      title: language === "ko" ? "오늘은 전주 안전 안내를 먼저 확인하는 편이 좋습니다" : "Today is a day to check Jeonju safety notices first",
      text: alertDetail || (language === "ko"
        ? "재난 신호가 감지된 날에는 외부 일정 확대보다 공식 안내와 이동 안전을 우선으로 보는 편이 좋습니다."
        : "With a hazard signal active, official guidance and movement safety should come before expanding outdoor plans."),
      chips: [
        language === "ko" ? "공식 통보 우선" : "Official bulletin first",
        language === "ko" ? "이동 재검토" : "Recheck movement",
      ],
    }
  }

  if (weatherData.eventData?.isWeatherWarning) {
    return {
      tone: "danger" as const,
      title: language === "ko" ? "오늘은 특보 내용까지 보고 움직이는 편이 안전합니다" : "Today is safer if you move with the warning details in mind",
      text: alertDetail || (language === "ko"
        ? "전주 기준 특보가 감지된 상태라 실시간 점수보다 통보 내용과 바람·강수 흐름을 함께 보는 편이 좋습니다."
        : "A warning is active for Jeonju, so the bulletin plus wind and rain signals matter more than the score alone."),
      chips: [
        language === "ko" ? "기상특보" : "Weather warning",
        language === "ko" ? "야외 일정 축소" : "Scale back plans",
      ],
    }
  }

  if (weatherData.eventData?.isRain) {
    return {
      tone: "caution" as const,
      title: language === "ko" ? "비가 이어져 오늘 전주 일정은 보수적으로 보는 편이 좋습니다" : "Rain is active, so it is better to read today's Jeonju plans conservatively",
      text: language === "ko"
        ? "현재 강수 또는 가까운 시간대 비 신호가 있어 이동 속도와 야외 체류 시간을 줄이는 쪽이 무난합니다."
        : "Current or near-term rain is active, so slower movement and shorter outdoor stays are the safer call.",
      chips: [
        language === "ko" ? "우산 준비" : "Umbrella ready",
        language === "ko" ? "젖은 노면 주의" : "Wet roads",
      ],
    }
  }

  if (fireSummary?.overview.cautionLevel === "high") {
    return {
      tone: "caution" as const,
      title: language === "ko" ? "날씨는 무난하지만 최근 화재 흐름은 한 번 더 볼 만합니다" : "Weather looks steady, but recent fire flow is worth a second look",
      text: language === "ko"
        ? "전북 화재 접수가 평균보다 올라간 흐름이라 야외 화기 사용이나 건조한 장소에서는 조금 더 조심하는 편이 좋습니다."
        : "Recent fire reports in Jeonbuk are above baseline, so extra care around dry outdoor spots and open flames makes sense.",
      chips: [
        language === "ko" ? "전북 화재 흐름 높음" : "Fire flow elevated",
      ],
    }
  }

  return {
    tone: "safe" as const,
    title: language === "ko" ? "오늘은 전주 흐름을 비교적 편하게 읽어볼 수 있습니다" : "Today looks fairly easy to read for Jeonju plans",
    text: language === "ko"
      ? "실시간 위험 신호가 크지 않아 체감 기온, 바람, 전북 화재 흐름 정도를 함께 보며 일정을 정하기 좋습니다."
      : "No major active signal is standing out, so temperature feel, wind, and fire flow should be enough to shape today's plans.",
    chips: [
      language === "ko" ? "실시간 신호 안정" : "Signals steady",
    ],
  }
}

export function JeonjuSafetyPanel({
  weatherData,
  fireSummary,
  language,
}: JeonjuSafetyPanelProps) {
  const hazardSummary = getHazardSummary(weatherData, language)
  const hazardChips = getHazardChips(weatherData, language)
  const mobilitySummary = getMobilitySummary(weatherData, language)
  const cachePolicy = weatherData.metadata?.cachePolicy
  const weatherUpdatedAt = typeof weatherData.metadata?.lastUpdate === "object"
    ? weatherData.metadata?.lastUpdate.kma
    : weatherData.metadata?.lastUpdate
  const airUpdatedAt = typeof weatherData.metadata?.lastUpdate === "object"
    ? weatherData.metadata?.lastUpdate.air
    : weatherData.metadata?.lastUpdate
  const fireTone = fireSummary?.overview.cautionLevel === "high"
    ? "danger"
    : fireSummary?.overview.cautionLevel === "moderate"
      ? "caution"
      : "safe"
  const topFirePlace = fireSummary?.topPlaces?.[0]
  const fireFlowBadge = getFireFlowBadge(fireSummary, language)
  const firePlaceNarrative = getFirePlaceNarrative(fireSummary, language)
  const overallGuide = getOverallSafetyGuide(weatherData, fireSummary, language)

  return (
    <section className="relative overflow-hidden rounded-[3rem] border border-card-border bg-card p-8 sm:p-12 shadow-[0_24px_80px_-50px_rgba(47,111,228,0.34)]">
      <BorderBeam size={280} duration={10} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
      <div className="relative z-10">
        <div className="max-w-4xl">
          <AnimatedGradientText className="text-3xl sm:text-5xl font-black tracking-tight">
            {language === "ko" ? "오늘의 전주안전" : "Today's Jeonju Safety"}
          </AnimatedGradientText>
          <p className="mt-4 text-base sm:text-lg font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400">
            {language === "ko"
              ? "전주 기준으로 오늘 바로 확인할 안전 신호를 한곳에 모았습니다. 실시간 특보·재난, 전북 화재 흐름, 이동 주의 포인트를 좌표·관측소·광역 집계 기준에 맞춰 읽을 수 있습니다."
              : "This panel brings together Jeonju's key safety signals for today, including live warnings, Jeonbuk fire flow, and movement notes with their own location and cache rules."}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <span className="inline-flex rounded-full border border-active-blue/20 bg-active-blue/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-active-blue">
            <MapPinned size={14} className="mr-1.5" />
            {language === "ko" ? "전주 고정 좌표" : "Fixed Jeonju coordinates"}
          </span>
          <span className="inline-flex rounded-full border border-nature-green/20 bg-nature-green/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-nature-green">
            <Waves size={14} className="mr-1.5" />
            {language === "ko" ? "실시간 + 집계 혼합" : "Live + aggregated mix"}
          </span>
          {fireSummary && (
            <span className="inline-flex rounded-full border border-orange-500/20 bg-orange-500/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-orange-600 dark:text-orange-300">
              <Flame size={14} className="mr-1.5" />
              {language === "ko" ? "전북 광역 화재 흐름" : "Jeonbuk fire flow"}
            </span>
          )}
        </div>

        <div className={cn("mt-6 rounded-[2rem] border px-5 py-5 sm:px-6", toneClasses(overallGuide.tone))}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-current/80">
                {language === "ko" ? "오늘의 종합 안내" : "Today's guidance"}
              </div>
              <div className="mt-3 text-xl sm:text-2xl font-black leading-tight text-foreground dark:text-current break-keep">
                {overallGuide.title}
              </div>
              <p className="mt-3 text-sm sm:text-base font-bold leading-relaxed text-foreground/80 dark:text-current break-words">
                {overallGuide.text}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-[280px] lg:justify-end">
              {overallGuide.chips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex rounded-full border border-current/15 bg-background/90 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-current dark:bg-background/20"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-[2.2rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                <Siren size={14} className={cn(hazardSummary.tone === "danger" ? "text-red-500" : hazardSummary.tone === "caution" ? "text-orange-500" : "text-nature-green")} />
                {language === "ko" ? "실시간 위험 신호" : "Live risk signals"}
              </div>
              <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">{hazardSummary.count}</div>
                  <p className="mt-2 text-lg sm:text-2xl font-black text-foreground break-keep">{hazardSummary.title}</p>
                  <p className="mt-3 max-w-2xl text-sm sm:text-base font-bold leading-relaxed text-muted-foreground break-keep">
                    {hazardSummary.text}
                  </p>
                </div>
                <div className="grid shrink-0 grid-cols-3 gap-2 sm:w-auto sm:min-w-[240px]">
                  <div className="rounded-[1.2rem] border border-card-border bg-card px-3 py-3">
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                      <Thermometer size={12} />
                      {language === "ko" ? "체감" : "Feels"}
                    </div>
                    <div className="mt-2 text-base sm:text-lg font-black text-foreground">{Math.round(weatherData.details.feelsLike ?? weatherData.details.temp)}°C</div>
                  </div>
                  <div className="rounded-[1.2rem] border border-card-border bg-card px-3 py-3">
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                      <Wind size={12} />
                      {language === "ko" ? "바람" : "Wind"}
                    </div>
                    <div className="mt-2 text-base sm:text-lg font-black text-foreground">{weatherData.details.wind}m/s</div>
                  </div>
                  <div className="rounded-[1.2rem] border border-card-border bg-card px-3 py-3">
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                      <CloudRain size={12} />
                      {language === "ko" ? "강수" : "Rain"}
                    </div>
                    <div className="mt-2 text-base sm:text-lg font-black text-foreground">{weatherData.details.rn1 ?? 0}mm</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {hazardChips.map((chip) => (
                  <span
                    key={chip.label}
                    className={cn("inline-flex rounded-full border px-3 py-1.5 text-[11px] sm:text-sm font-black tracking-wide", toneClasses(chip.tone))}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                <ShieldCheck size={14} className={cn(mobilitySummary.tone === "danger" ? "text-red-500" : mobilitySummary.tone === "caution" ? "text-orange-500" : mobilitySummary.tone === "info" ? "text-sky-blue" : "text-nature-green")} />
                {language === "ko" ? "이동 주의 포인트" : "Movement note"}
              </div>
              <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-lg sm:text-2xl font-black tracking-tight text-foreground">{mobilitySummary.label}</div>
                  <p className="mt-2 max-w-2xl text-sm sm:text-base font-bold leading-relaxed text-muted-foreground break-keep">
                    {mobilitySummary.text}
                  </p>
                </div>
                <div className={cn("inline-flex self-start rounded-full border px-3 py-1.5 text-[11px] sm:text-sm font-black tracking-wide", toneClasses(mobilitySummary.tone))}>
                  {language === "ko" ? "전주 현장 감각 중심" : "Jeonju field note"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2.2rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              <Flame size={14} className={cn(fireTone === "danger" ? "text-red-500" : fireTone === "caution" ? "text-orange-500" : "text-nature-green")} />
              {language === "ko" ? "전북 화재 흐름" : "Jeonbuk fire flow"}
            </div>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
                  {fireSummary?.overview.latestFireReceipt ?? "-"}
                </div>
                <p className="mt-2 text-sm sm:text-base font-bold text-foreground break-keep">
                  {fireSummary
                    ? (language === "ko"
                      ? `최근 평균 ${fireSummary.overview.sevenDayAverage}건 · ${formatDateLabel(fireSummary.metadata.latestDate)} 기준`
                      : `Avg ${fireSummary.overview.sevenDayAverage} · latest ${formatDateLabel(fireSummary.metadata.latestDate)}`)
                    : (language === "ko" ? "전북 화재 집계를 불러오는 중입니다." : "Loading Jeonbuk fire flow.")}
                </p>
              </div>
              <span className={cn("inline-flex shrink-0 rounded-full border px-3 py-1.5 text-[11px] sm:text-sm font-black tracking-wide", toneClasses(fireFlowBadge.tone))}>
                {fireFlowBadge.label}
              </span>
            </div>
            <p className="mt-3 text-sm sm:text-base font-bold leading-relaxed text-muted-foreground break-keep">
              {fireSummary
                ? (language === "ko" ? fireSummary.overview.shortMessageKo : fireSummary.overview.shortMessageEn)
                : (language === "ko" ? "최근 화재 접수 흐름과 장소 패턴을 곧 반영합니다." : "Recent fire flow and place patterns will appear here once loaded.")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[1.2rem] border border-card-border bg-card px-3 py-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                  {language === "ko" ? "피크일" : "Peak day"}
                </div>
                <div className="mt-2 text-base sm:text-lg font-black text-foreground">
                  {fireSummary ? formatShortDateLabel(fireSummary.overview.peakDate, language) : "-"}
                </div>
                <div className="mt-1 text-xs sm:text-sm font-bold text-muted-foreground">
                  {fireSummary
                    ? (language === "ko"
                      ? `${fireSummary.overview.peakFireReceipt}건 접수`
                      : `${fireSummary.overview.peakFireReceipt} reports`)
                    : ""}
                </div>
              </div>
              <div className="rounded-[1.2rem] border border-card-border bg-card px-3 py-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                  {language === "ko" ? "가장 많이 보인 장소" : "Top place"}
                </div>
                <div className="mt-2 text-base sm:text-lg font-black text-foreground break-keep">
                  {topFirePlace?.name || (language === "ko" ? "집계 없음" : "No data")}
                </div>
                <div className="mt-1 text-xs sm:text-sm font-bold text-muted-foreground">
                  {topFirePlace
                    ? (language === "ko" ? `${topFirePlace.count}건` : `${topFirePlace.count} cases`)
                    : ""}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-[1.4rem] border border-card-border bg-card px-4 py-4">
              <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                {language === "ko" ? "장소 패턴 해석" : "Place pattern read"}
              </div>
              <div className="mt-2 text-base sm:text-lg font-black text-foreground break-keep">
                {firePlaceNarrative.title}
              </div>
              <p className="mt-2 text-sm sm:text-base font-bold leading-relaxed text-muted-foreground break-keep">
                {firePlaceNarrative.text}
              </p>
              {firePlaceNarrative.chips.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {firePlaceNarrative.chips.map((chip) => (
                    <span
                      key={chip.label}
                      className={cn("inline-flex rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide", toneClasses(chip.tone))}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            {fireSummary?.topPlaces?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {fireSummary.topPlaces.slice(0, 3).map((place) => (
                  <span
                    key={place.name}
                    className={cn(
                      "inline-flex rounded-full border px-3 py-1.5 text-[11px] sm:text-sm font-black tracking-wide",
                      place.outdoor
                        ? "border-nature-green/20 bg-nature-green/10 text-nature-green"
                        : "border-active-blue/20 bg-active-blue/10 text-active-blue"
                    )}
                  >
                    {place.name} · {place.count}
                  </span>
                ))}
              </div>
            ) : null}
            {fireSummary?.dailyTrend?.length ? (
              <div className="mt-4 rounded-[1.4rem] border border-card-border bg-card px-3 py-3">
                <div className="text-sm sm:text-base font-black uppercase tracking-wide text-muted-foreground">
                  {language === "ko" ? "최근 7일 접수 흐름" : "Recent 7-day flow"}
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {fireSummary.dailyTrend.slice(0, 7).map((day) => {
                    const dayTone = day.fireReceipt >= fireSummary.overview.sevenDayAverage * 1.4
                      ? "danger"
                      : day.fireReceipt >= fireSummary.overview.sevenDayAverage * 1.1
                        ? "caution"
                        : "safe"

                    return (
                      <div
                        key={day.date}
                        className={cn(
                          "rounded-[1rem] border px-2 py-2.5 text-center",
                          toneClasses(dayTone)
                        )}
                      >
                        <div className="text-xs sm:text-sm font-black uppercase tracking-wide">
                          {formatShortDateLabel(day.date, language)}
                        </div>
                        <div className="mt-1 text-lg sm:text-xl font-black">{day.fireReceipt}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 rounded-[1.7rem] border border-card-border/60 bg-[var(--interactive)]/50 px-4 py-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="shrink-0 rounded-full border border-card-border bg-card px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground/80">
              {language === "ko" ? "데이터 기준" : "Data basis"}
            </div>
            <div className="flex flex-1 flex-wrap gap-2">
              <span className="inline-flex rounded-full border border-card-border/80 bg-card/80 px-3 py-1.5 text-[11px] sm:text-xs font-black tracking-wide text-foreground/80">
                {language === "ko"
                  ? `기상·재난 ${cachePolicy?.weatherMinutes ?? 10}분 / 특보 ${cachePolicy?.alertMinutes ?? 15}분`
                  : `Weather ${cachePolicy?.weatherMinutes ?? 10}m / alerts ${cachePolicy?.alertMinutes ?? 15}m`}
              </span>
              <span className="inline-flex rounded-full border border-card-border/80 bg-card/80 px-3 py-1.5 text-[11px] sm:text-xs font-black tracking-wide text-foreground/80">
                {language === "ko"
                  ? `대기 ${weatherData.metadata?.station || "전주 인근 측정소"} · ${cachePolicy?.airMinutes ?? 60}분`
                  : `Air ${weatherData.metadata?.station || "Jeonju station"} · ${cachePolicy?.airMinutes ?? 60}m`}
              </span>
              <span className="inline-flex rounded-full border border-card-border/80 bg-card/80 px-3 py-1.5 text-[11px] sm:text-xs font-black tracking-wide text-foreground/80">
                {language === "ko"
                  ? `화재 ${fireSummary?.metadata.coverageDays ?? 7}일 흐름 · ${fireSummary?.metadata.cacheHours ?? 12}시간`
                  : `Fire ${fireSummary?.metadata.coverageDays ?? 7}d flow · ${fireSummary?.metadata.cacheHours ?? 12}h`}
              </span>
              <span className="inline-flex rounded-full border border-card-border/80 bg-card/80 px-3 py-1.5 text-[11px] sm:text-xs font-black tracking-wide text-muted-foreground">
                {language === "ko"
                  ? `기상청 ${formatUpdateLabel(weatherUpdatedAt)} · 대기 ${formatUpdateLabel(airUpdatedAt)}`
                  : `KMA ${formatUpdateLabel(weatherUpdatedAt)} · Air ${formatUpdateLabel(airUpdatedAt)}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
