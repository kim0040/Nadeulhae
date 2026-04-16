"use client"

import { useLanguage } from "@/context/LanguageContext"
import { WeatherData } from "@/services/dataService"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Sparkles, CheckCircle2, AlertCircle, Wind, Thermometer,
  Info, Clock, Database, Droplets, Cloud, CloudRain, ShieldCheck, Zap,
  Navigation, Sun, TriangleAlert, MapPin
} from "lucide-react"

interface PicnicBriefingProps {
  weatherData: WeatherData
}

type GuideTone = "danger" | "caution" | "safe"

interface BriefingPoint {
  icon: React.ReactNode
  text: string
  type: "success" | "warning" | "info" | "neutral"
  fullWidth?: boolean
}

type BulletinSegment = {
  label: string
  text: string
}

type BulletinTagTone = "danger" | "caution" | "info" | "neutral"

const NON_BULLETIN_MESSAGE_PATTERN = /(전주 기준 대기질 데이터를 표시 중입니다|showing fallback air quality data)/i
const EMPTY_BULLETIN_PATTERN = /^(?:[oO○◯●□■▪︎ㆍ·\-\*\s]*)?(?:없음|없\s*음|none|no\s*alerts?|n\/a)(?:[\s.)\]]*)$/i

export function PicnicBriefing({ weatherData }: PicnicBriefingProps) {
  const { t, language } = useLanguage()
  const { details, metadata, eventData, isFallback } = weatherData
  const regionLabel = language === "ko"
    ? metadata?.region || "현재 지역"
    : metadata?.regionEn || metadata?.region || "your area"

  const formatBriefing = (key: string, values: Record<string, string | number>) => {
    const template = t(key)
    if (template === key) return "" // Key not found
    let text = template
    Object.entries(values).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v))
    })
    return text
  }

  const translateBulletinText = (text: string) => {
    if (language === "ko") return text

    const replacements: Array<[RegExp, string]> = [
      [/전북/g, "Jeonbuk"],
      [/전주/g, "Jeonju"],
      [/오늘/g, "today"],
      [/내일/g, "tomorrow"],
      [/모레/g, "the day after tomorrow"],
      [/글피/g, "in 3 days"],
      [/오전/g, "morning"],
      [/오후/g, "afternoon"],
      [/새벽/g, "early morning"],
      [/밤/g, "night"],
      [/비와 눈/g, "rain and snow"],
      [/소나기/g, "showers"],
      [/비/g, "rain"],
      [/눈/g, "snow"],
      [/안개/g, "fog"],
      [/황사/g, "dust"],
      [/미세먼지/g, "fine dust"],
      [/건조/g, "dry"],
      [/강풍/g, "strong wind"],
      [/호우/g, "heavy rain"],
      [/대설/g, "heavy snow"],
      [/폭염/g, "heat"],
      [/한파/g, "cold wave"],
      [/흐림/g, "cloudy"],
      [/구름많음/g, "mostly cloudy"],
      [/맑음/g, "clear"],
      [/기온/g, "temperature"],
      [/강수확률/g, "rain chance"],
      [/강수/g, "precipitation"],
      [/특보/g, "warning"],
      [/전망/g, "outlook"],
      [/예보/g, "forecast"],
      [/부터/g, "from"],
    ]

    let translated = text
    for (const [pattern, replacement] of replacements) {
      translated = translated.replace(pattern, replacement)
    }
    return translated
  }

  const localizeBulletinLabel = (label: string) => {
    if (language === "ko") return label
    const dayMatch = label.match(/(\d{1,2})일/)
    const dayNumber = dayMatch?.[1]

    const withoutDaySuffix = label.replace(/,\s*\d{1,2}일/g, "").replace(/\d{1,2}일/g, "").trim()
    const mapped = withoutDaySuffix
      .replace(/오늘/g, "Today")
      .replace(/내일/g, "Tomorrow")
      .replace(/모레/g, "Day after tomorrow")
      .replace(/글피/g, "In 3 days")

    return dayNumber ? `${mapped}, ${dayNumber}` : mapped
  }

  const parseBulletinSummary = (summary: string) => {
    const normalized = summary.replace(/\s+/g, " ").trim()
    const cleanedSummary = normalized.replace(/^□\s*\(([^)]+)\)\s*/, "").trim()
    const splitItems = cleanedSummary.split(/\s(?=○\s*\()/).filter(Boolean)
    const headline = splitItems[0]?.startsWith("○")
      ? (language === "ko" ? "현재 공식 통보 요약입니다." : "This is the latest official bulletin summary.")
      : translateBulletinText(splitItems.shift() || (language === "ko" ? "현재 공식 통보에 특이사항이 없습니다." : "No notable official bulletin right now."))
    const segments: BulletinSegment[] = splitItems
      .map((item) => item.replace(/^○\s*/, "").trim())
      .map((item) => {
        const match = item.match(/^\(([^)]+)\)\s*(.*)$/)
        if (!match) {
          return {
            label: language === "ko" ? "안내" : "Note",
            text: translateBulletinText(item),
          }
        }
        return {
          label: localizeBulletinLabel(match[1]),
          text: translateBulletinText(match[2]),
        }
      })

    return {
      headline,
      segments: segments.slice(0, 3),
    }
  }

  const getBulletinTone = (text: string): BulletinTagTone => {
    const normalized = text.replace(/\s+/g, "")
    if (/특보|호우|대설|태풍|강풍|폭염|한파|지진|산불|화재/.test(normalized)) return "danger"
    if (/건조|비|소나기|눈|안개|황사|미세먼지|기온차|결빙/.test(normalized)) return "caution"
    if (/맑음|구름|흐림|예보|전망/.test(normalized)) return "info"
    return "neutral"
  }

  const getBulletinTags = (text: string) => {
    const entries = [
      {
        match: /건조|산불|화재/,
        ko: "건조·화재",
        en: "Dry / Fire",
        tone: "danger" as const,
      },
      {
        match: /호우|비|소나기/,
        ko: "강수",
        en: "Rain",
        tone: "caution" as const,
      },
      {
        match: /대설|눈|결빙/,
        ko: "눈·결빙",
        en: "Snow / Ice",
        tone: "caution" as const,
      },
      {
        match: /강풍|태풍/,
        ko: "강풍",
        en: "Strong Wind",
        tone: "danger" as const,
      },
      {
        match: /안개/,
        ko: "안개",
        en: "Fog",
        tone: "info" as const,
      },
      {
        match: /황사|미세먼지/,
        ko: "대기질",
        en: "Air Quality",
        tone: "caution" as const,
      },
      {
        match: /기온차|폭염|한파/,
        ko: "기온 변화",
        en: "Temperature",
        tone: "caution" as const,
      },
    ]

    return entries
      .filter((entry) => entry.match.test(text))
      .map((entry) => ({
        label: language === "ko" ? entry.ko : entry.en,
        tone: entry.tone,
      }))
  }

  const getToneClasses = (tone: BulletinTagTone) => {
    switch (tone) {
      case "danger":
        return "border-red-500/20 bg-red-500/8 text-red-600 dark:text-red-300"
      case "caution":
        return "border-orange-500/20 bg-orange-500/8 text-orange-600 dark:text-orange-300"
      case "info":
        return "border-sky-blue/20 bg-sky-blue/8 text-sky-blue"
      default:
        return "border-border bg-card text-foreground/80"
    }
  }

  const getScoreNarrative = () => {
    const breakdown = metadata?.scoreBreakdown
    if (!breakdown) return null

    if (breakdown.knockout === "warning") {
      return {
        text: language === "ko"
          ? "기상특보, 지진해일, 화산 또는 규모 4.0 이상 지진이 감지되어 피크닉 지수는 즉시 0점으로 처리됩니다."
          : "An active weather warning, tsunami/volcano signal, or earthquake at M4.0+ triggers the knock-out rule and forces the score to 0.",
        type: "warning" as const,
        icon: <AlertCircle size={18} />,
        fullWidth: true,
      }
    }

    if (breakdown.knockout === "rain") {
      return {
        text: language === "ko"
          ? "현재 강수가 감지되어 피크닉 지수는 즉시 10점으로 고정됩니다. 다른 항목 계산은 생략합니다."
          : "Current precipitation is detected, so the picnic score is fixed at 10 and the rest of the calculation is skipped.",
        type: "warning" as const,
        icon: <CloudRain size={18} />,
        fullWidth: true,
      }
    }

    return {
      text: language === "ko"
        ? `현재 지수는 대기질 ${breakdown.air}점, 기온 ${breakdown.temperature}점, 하늘 ${breakdown.sky}점, 바람 ${breakdown.wind}점을 합산한 총 ${breakdown.total}점입니다.`
        : `Today's score is ${breakdown.total}, built from air ${breakdown.air}, temperature ${breakdown.temperature}, sky ${breakdown.sky}, and wind ${breakdown.wind}.`,
      type: "neutral" as const,
      icon: <ShieldCheck size={18} />,
      fullWidth: true,
    }
  }

  const getPrecipitationGuide = () => {
    const precipitationActive = eventData?.isRain || ((details.pty ?? 0) > 0)
    if (!precipitationActive) return null

    const pty = details.pty ?? 0
    if (pty === 3) {
      return {
        title: language === "ko" ? "눈 신호가 있어 오늘 점수는 보수적으로 반영됩니다" : "Snow is active, so today's score is kept conservative",
        text: language === "ko"
          ? "현재 눈이나 가까운 시간대의 적설 신호가 있어 바깥 일정은 짧고 안전하게 보는 편이 좋습니다. 공식 통보와 시간대별 흐름을 함께 확인하세요."
          : "Snow or near-term wintry precipitation is active, so outdoor plans should stay short and cautious. Use the bulletin and hourly flow together.",
        chips: [
          language === "ko" ? "눈 · 결빙 주의" : "Snow / ice watch",
          language === "ko" ? "보행 안전 우선" : "Watch footing",
        ],
      }
    }

    if (pty === 2) {
      return {
        title: language === "ko" ? "비와 눈이 섞여 있어 오늘 점수는 보수적으로 반영됩니다" : "Mixed precipitation is active, so today's score is kept conservative",
        text: language === "ko"
          ? "비·눈이 섞인 신호가 있어 체감이 급격히 떨어질 수 있습니다. 우산과 미끄럼 주의를 함께 챙기는 편이 좋습니다."
          : "Mixed precipitation can make conditions deteriorate quickly. An umbrella and extra caution on slippery ground both matter.",
        chips: [
          language === "ko" ? "비·눈 혼합" : "Rain / snow mix",
          language === "ko" ? "노면 주의" : "Watch surfaces",
        ],
      }
    }

    if (pty === 4) {
      return {
        title: language === "ko" ? "소나기 신호가 있어 오늘 점수는 보수적으로 반영됩니다" : "Showers are active, so today's score is kept conservative",
        text: language === "ko"
          ? "짧게 지나가는 강수라도 바깥 체류감은 크게 달라질 수 있습니다. 시간대별 강수 가능성을 함께 보는 편이 좋습니다."
          : "Even short showers can change the outdoor feel quickly. Use the hourly precipitation windows for a better call.",
        chips: [
          language === "ko" ? "소나기 가능" : "Passing showers",
          language === "ko" ? "짧은 외출 추천" : "Shorter trips",
        ],
      }
    }

    return {
      title: language === "ko" ? "비 신호가 있어 오늘 점수는 보수적으로 반영됩니다" : "Rain is active, so today's score is kept conservative",
      text: language === "ko"
        ? "현재 비나 가까운 시간대 강수 신호가 있어 피크닉 지수는 낮게 계산됩니다. 아래 통보와 시간대별 날씨를 함께 보면 판단이 더 쉽습니다."
        : "Current or near-term rain is active, so the picnic score is intentionally kept low. Use the bulletin and hourly forecast below for context.",
      chips: [
        language === "ko" ? "현재·근접 강수" : "Current / near-term rain",
        language === "ko" ? "우산 준비" : "Umbrella ready",
      ],
    }
  }

  const getAirGuide = () => {
    const pm10 = details.pm10 ?? 0
    const pm25 = details.pm25 ?? 0
    const bulletinText = `${metadata?.bulletin?.summary || ""} ${metadata?.bulletin?.warningStatus || ""}`
    const hasDustSignal = /황사|미세먼지/.test(bulletinText)

    if (pm10 >= 81 || pm25 >= 36 || hasDustSignal) {
      return {
        tone: "caution" as GuideTone,
        icon: <Sparkles size={18} />,
        title: language === "ko" ? "대기질 변수를 함께 보고 움직이는 편이 좋습니다" : "Air quality deserves a closer look today",
        text: language === "ko"
          ? "미세먼지 또는 황사 신호가 있어 바깥 체류감을 크게 바꿀 수 있습니다. 짧은 외출 위주로 보고, 이미지 섹션의 황사 흐름도 함께 확인해보세요."
          : "Fine dust or dust signals can change outdoor comfort noticeably. Keep plans lighter and check the dust imagery below as well.",
        chips: [
          language === "ko" ? "대기질 주의" : "Air quality watch",
          language === "ko" ? "마스크 판단" : "Mask check",
        ],
      }
    }

    return null
  }

  const getDryGuide = () => {
    const bulletinText = `${metadata?.bulletin?.summary || ""} ${metadata?.bulletin?.warningStatus || ""}`
    const drySignal = (details.humidity ?? 0) < 30 || /건조|산불|화재/.test(bulletinText)
    if (!drySignal) return null

    return {
      tone: "caution" as GuideTone,
      icon: <Droplets size={18} />,
      title: language === "ko" ? "건조한 공기라 화기와 수분 관리가 중요합니다" : "Dry air means hydration and fire caution matter today",
      text: language === "ko"
        ? "습도나 공식 통보상 건조 신호가 보여 작은 불씨나 장시간 노출에 더 민감한 날입니다. 따뜻한 음료나 물을 챙기고, 화기는 특히 조심하세요."
        : "Humidity and bulletin signals both suggest a drier day. Carry water, avoid long dry exposure, and be extra careful with fire sources.",
      chips: [
        language === "ko" ? "건조 신호" : "Dry signal",
        language === "ko" ? "수분 보충" : "Hydrate",
      ],
    }
  }

  const getFogGuide = () => {
    const bulletinText = `${metadata?.bulletin?.summary || ""} ${metadata?.bulletin?.warningStatus || ""}`
    const fogSignal = (details.humidity ?? 0) >= 90 || /안개/.test(bulletinText)
    if (!fogSignal) return null

    return {
      tone: "caution" as GuideTone,
      icon: <Cloud size={18} />,
      title: language === "ko" ? "안개 가능성이 있어 이동 전 시야를 함께 확인하세요" : "Fog is possible, so visibility matters before moving",
      text: language === "ko"
        ? "습도나 통보문상 안개 신호가 보여 이른 시간 이동 체감이 달라질 수 있습니다. 차량 이동이나 강변 산책 전 시야를 먼저 확인하는 편이 좋습니다."
        : "Humidity and bulletin text both suggest fog risk. Visibility can change fast, especially for early movement or waterside walks.",
      chips: [
        language === "ko" ? "안개 가능" : "Fog signal",
        language === "ko" ? "시야 확인" : "Check visibility",
      ],
    }
  }

  const getIntegratedGuide = () => {
    const alertTitle = [
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
        && !EMPTY_BULLETIN_PATTERN.test(value))

    if (eventData?.isEarthquake || eventData?.isTsunami || eventData?.isVolcano) {
      return {
        tone: "danger" as const,
        icon: <TriangleAlert size={18} />,
        title: language === "ko" ? "오늘은 공식 재난 안내를 먼저 확인하세요" : "Check the official hazard bulletin first today",
        text: alertTitle || (language === "ko"
          ? "재난 신호가 감지된 날에는 피크닉 지수보다 공식 통보와 이동 안전을 우선으로 보는 편이 좋습니다."
          : "When a hazard signal is active, official bulletins should take priority over the picnic score."),
        chips: [
          language === "ko" ? "실시간 재난 감지" : "Live hazard",
          language === "ko" ? "공식 통보 우선" : "Official bulletin first",
        ],
      }
    }

    if (eventData?.isWeatherWarning) {
      return {
        tone: "danger" as GuideTone,
        icon: <AlertCircle size={18} />,
        title: language === "ko" ? "오늘은 특보 내용을 함께 보고 움직이세요" : "Move with the warning details in mind today",
        text: alertTitle || (language === "ko"
          ? "기상특보가 발효된 상태라 점수만 보기보다 공식 통보와 시간대별 변화를 같이 확인하는 편이 안전합니다."
          : "A weather warning is active, so the official bulletin and hourly changes matter more than the score alone."),
        chips: [
          language === "ko" ? "기상특보" : "Weather warning",
          language === "ko" ? "바깥 일정 재점검" : "Recheck plans",
        ],
      }
    }

    const precipitationGuide = getPrecipitationGuide()
    if (precipitationGuide) {
      return {
        tone: "caution" as GuideTone,
        icon: <CloudRain size={18} />,
        title: precipitationGuide.title,
        text: precipitationGuide.text,
        chips: precipitationGuide.chips,
      }
    }

    const airGuide = getAirGuide()
    if (airGuide) return airGuide

    const fogGuide = getFogGuide()
    if (fogGuide) return fogGuide

    const dryGuide = getDryGuide()
    if (dryGuide) return dryGuide

    return {
      tone: "safe" as GuideTone,
      icon: <ShieldCheck size={18} />,
      title: language === "ko" ? "오늘은 큰 위험 신호 없이 흐름을 읽기 좋은 날입니다" : "Today looks steady enough to read the flow at a glance",
      text: language === "ko"
        ? "지수와 공식 통보, 시간대별 날씨를 함께 보면 오늘 움직이기 좋은 시간대를 비교적 편하게 판단할 수 있습니다."
        : "The score, bulletin, and hourly forecast should be enough to judge today's best outdoor windows without major hazard signals.",
      chips: [
        language === "ko" ? "지수 + 통보 + 시간대" : "Score + bulletin + hourly",
      ],
    }
  }

  // 1. 풍부한 상황별 나들이 멘트 (Enhanced Logic)
  const getBriefingQuotes = (): BriefingPoint[] => {
    const points: BriefingPoint[] = []
    const scoreNarrative = getScoreNarrative()

    if (scoreNarrative?.type === "neutral") {
      points.push(scoreNarrative)
    }
    
    // -- Temperature --
    const temp = details.temp
    if (temp < 5) {
      points.push({ text: formatBriefing("brief_temp_v_cold", { temp }), type: "warning", icon: <AlertCircle size={18} /> })
    } else if (temp < 15) {
      points.push({ text: formatBriefing("brief_temp_cold", { temp }), type: "info", icon: <Thermometer size={18} /> })
    } else if (temp < 20) {
      points.push({ text: formatBriefing("brief_temp_mild", { temp }), type: "success", icon: <Thermometer size={18} /> })
    } else if (temp <= 25) {
      points.push({ text: formatBriefing("brief_temp_perfect", { temp }), type: "success", icon: <CheckCircle2 size={18} /> })
    } else if (temp <= 28) {
      points.push({ text: formatBriefing("brief_temp_warm", { temp }), type: "success", icon: <Sun size={18} /> })
    } else if (temp <= 31) {
      points.push({ text: formatBriefing("brief_temp_hot", { temp }), type: "info", icon: <Sun size={18} /> })
    } else {
      points.push({ text: formatBriefing("brief_temp_v_hot", { temp }), type: "warning", icon: <AlertCircle size={18} /> })
    }

    // -- Dust & Air --
    const pm10 = details.pm10 || 0
    if (pm10 > 0) {
      if (pm10 <= 30) {
        points.push({
          text: language === "ko"
            ? `${regionLabel}의 미세먼지 농도는 ${pm10}µg/m³로 매우 낮아 공기가 맑고 깨끗합니다.`
            : `PM10 in ${regionLabel} is ${pm10}µg/m³, so the air is exceptionally clean right now.`,
          type: "success",
          icon: <Sparkles size={18} />,
        })
      } else if (pm10 <= 80) {
        points.push({
          text: language === "ko"
            ? `${regionLabel}의 미세먼지 농도는 ${pm10}µg/m³로 보통 수준입니다. 민감하다면 대기 상태를 한 번 더 확인하세요.`
            : `PM10 in ${regionLabel} is ${pm10}µg/m³, which is moderate. Sensitive visitors should double-check the air conditions.`,
          type: "info",
          icon: <Info size={18} />,
        })
      } else {
        points.push({
          text: language === "ko"
            ? `${regionLabel}의 미세먼지 농도는 ${pm10}µg/m³로 높습니다. 실외 체류 시간을 줄이고 마스크 착용을 권장합니다.`
            : `PM10 in ${regionLabel} is ${pm10}µg/m³, which is high. Shorter outdoor stays and a mask are recommended.`,
          type: "warning",
          icon: <AlertCircle size={18} />,
        })
      }
    }

    if ((details.pm25 ?? 0) >= 36) {
      points.push({
        text: language === "ko"
          ? `${regionLabel}의 초미세먼지 농도는 ${details.pm25}µg/m³로 높습니다. 짧은 외출이나 마스크 착용을 권장합니다.`
          : `PM2.5 in ${regionLabel} is ${details.pm25}µg/m³, which is high. Shorter outdoor stays or a mask are recommended.`,
        type: "warning",
        icon: <AlertCircle size={18} />,
      })
    }

    // -- Wind --
    const wind = details.wind
    if (wind < 1.5) {
      points.push({ text: formatBriefing("brief_wind_calm", { wind }), type: "success", icon: <Wind size={18} /> })
    } else if (wind <= 5) {
      points.push({ text: formatBriefing("brief_wind_breezy", { wind }), type: "success", icon: <Wind size={18} /> })
    } else {
      points.push({ text: formatBriefing("brief_wind_strong", { wind }), type: "warning", icon: <AlertCircle size={18} /> })
    }

    // -- Humidity --
    const humi = details.humidity
    if (humi < 30) {
      points.push({ text: formatBriefing("brief_humi_dry", { humi }), type: "info", icon: <Droplets size={18} /> })
    } else if (humi <= 60) {
      points.push({ text: formatBriefing("brief_humi_comfort", { humi }), type: "success", icon: <Droplets size={18} /> })
    } else if (humi > 70) {
      points.push({ text: formatBriefing("brief_humi_humid", { humi }), type: "info", icon: <Droplets size={18} /> })
    }

    const bulletinText = `${metadata?.bulletin?.summary || ""} ${metadata?.bulletin?.warningStatus || ""}`
    if (/안개/.test(bulletinText)) {
      points.push({
        text: language === "ko"
          ? "공식 통보문에 안개 신호가 있어 이른 시간 이동 전 시야를 한 번 더 확인하는 편이 좋습니다."
          : "The official bulletin mentions fog, so it is worth checking visibility before early movement.",
        type: "info",
        icon: <Cloud size={18} />,
      })
    }

    if (/황사/.test(bulletinText)) {
      points.push({
        text: language === "ko"
          ? "공식 통보문에 황사 언급이 있습니다. 공기질 수치와 함께 황사 이미지를 같이 보는 편이 좋습니다."
          : "The official bulletin mentions dust. It is better to read the air values together with the dust imagery.",
        type: "warning",
        icon: <Sparkles size={18} />,
      })
    }

    if (/건조|산불|화재/.test(bulletinText) && humi >= 30) {
      points.push({
        text: language === "ko"
          ? "공식 통보문상 건조·화재 주의 신호가 있습니다. 화기 사용과 장시간 야외 체류를 조금 더 보수적으로 보세요."
          : "The official bulletin carries a dry or fire caution signal. Be more conservative with fire sources and long outdoor stays.",
        type: "warning",
        icon: <AlertCircle size={18} />,
      })
    }

    // -- Precipitation --
    if (isFallback) {
      points.push({
        text: t("fallback_message"),
        type: "neutral",
        icon: <Info size={18} />,
        fullWidth: true,
      })
    }

    return points.filter(p => p.text !== "")
  }

  // 2. 상세 환경 수치 (Technical Data View)
  const getTechnicalPoints = () => [
    { label: t("hero_temp"), value: `${details.temp ?? "--"}°C`, icon: <Thermometer size={14} /> },
    { label: t("hero_humidity"), value: `${details.humidity ?? "--"}%`, icon: <Droplets size={14} /> },
    { label: t("hero_wind"), value: `${details.wind ?? "--"}m/s`, icon: <Wind size={14} /> },
    { label: t("hero_vec"), value: `${details.vec ?? "--"}°`, icon: <Navigation size={14} style={{ transform: `rotate(${details.vec || 0}deg)` }} /> },
    { label: t("hero_pm10"), value: `${details.pm10 ?? "--"}µg/m³`, icon: <Cloud size={14} /> },
    { label: t("hero_pm25"), value: `${details.pm25 ?? "--"}µg/m³`, icon: <Sparkles size={14} /> },
    { label: t("hero_o3"), value: `${details.o3 ?? "--"}ppm`, icon: <Zap size={14} /> },
    { label: t("hero_no2"), value: `${details.no2 ?? "--"}ppm`, icon: <Zap size={14} /> },
    { label: t("hero_khai"), value: `${details.khai ?? "--"}`, icon: <ShieldCheck size={14} /> },
    { label: t("hero_precip"), value: `${details.rn1 ?? "--"}mm`, icon: <CloudRain size={14} /> },
  ]

  const quotes = getBriefingQuotes()
  const integratedGuide = getIntegratedGuide()
  const techData = getTechnicalPoints()
  const bulletinSummary = metadata?.bulletin?.summary || (
    language === "ko" ? "현재 공식 통보문에 특이사항이 없습니다." : "No notable official bulletin right now."
  )
  const bulletin = parseBulletinSummary(bulletinSummary)
  const bulletinTags = getBulletinTags(`${bulletin.headline} ${bulletin.segments.map((segment) => segment.text).join(" ")}`)
  const sourceLabels = (() => {
    const sourceText = String(metadata?.dataSource || "")
    const labels: string[] = []
    if (/기상청|KMA/i.test(sourceText)) labels.push(t("data_source_kma"))
    if (/한국환경공단|AirKorea/i.test(sourceText)) labels.push(t("data_source_air"))
    return labels.length > 0 ? labels : [t("data_source_combined")]
  })()
  const getUpdateTime = (type: 'kma' | 'air') => {
    if (typeof metadata?.lastUpdate === 'string') return metadata.lastUpdate
    if (type === 'kma') return (metadata?.lastUpdate as any)?.kma || "--:--"
    return (metadata?.lastUpdate as any)?.air || "--:--"
  }
  const briefingMeta = [
    {
      label: language === "ko" ? "지역 기준" : "Region",
      title: language === "ko"
        ? `${metadata?.region || "현재 지역"} · ${metadata?.station || t("station_dukjin")}`
        : `${metadata?.regionEn || metadata?.region || "Current Area"} · ${metadata?.station || t("station_dukjin")}`,
      detail: isFallback
        ? (language === "ko" ? "전주 홈 기준으로 안전 대체 중" : "Safely falling back to Jeonju home mode")
        : (language === "ko" ? "가장 가까운 권역과 측정소 기준" : "Matched to the nearest region and station"),
      icon: <MapPin size={15} className="text-sky-blue" />,
    },
    {
      label: language === "ko" ? "판단 방식" : "Scoring Mode",
      title: metadata?.scoreBreakdown?.knockout === "warning"
        ? (language === "ko" ? "특보·재난 우선 모드" : "Warning-first mode")
        : metadata?.scoreBreakdown?.knockout === "rain"
          ? (language === "ko" ? "강수 보수 반영 모드" : "Precipitation-conservative mode")
          : (language === "ko" ? "일반 합산 모드" : "Standard scoring mode"),
      detail: metadata?.scoreBreakdown?.knockout === "warning"
        ? (language === "ko" ? "점수보다 공식 통보를 먼저 봅니다." : "Official bulletins take priority over the score.")
        : metadata?.scoreBreakdown?.knockout === "rain"
          ? (language === "ko" ? "현재·근접 강수 신호를 먼저 반영합니다." : "Current and near-term precipitation is applied first.")
          : (language === "ko" ? "대기질·기온·하늘·바람을 함께 읽습니다." : "Air, temperature, sky, and wind are combined together."),
      icon: <ShieldCheck size={15} className="text-nature-green" />,
    },
  ]
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="w-full max-w-5xl mx-auto rounded-[3rem] bg-[var(--card)] border border-[var(--card-border)] shadow-2xl overflow-hidden"
    >
      {/* Header with Title and Station info */}
      <div className="p-8 sm:p-12 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-nature-green to-active-blue text-white shadow-lg shadow-active-blue/20">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight leading-none">{t("brief_title")}</h3>
              <p className="text-[10px] sm:text-xs font-black text-sky-blue uppercase tracking-[0.3em] mt-2 italic opacity-70">{t("brief_station_engine")}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-end">
               <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">{t("status_nearby_station")}</span>
               <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--interactive)] border border-[var(--interactive-border)]">
                 <MapPin size={12} className="text-sky-blue" />
                 <span className="text-xs font-black text-foreground">{metadata?.station || t("station_dukjin")}</span>
               </div>
             </div>
          </div>
        </div>

        <div className="space-y-4 mb-4">
          <div
            className={cn(
              "lg:col-span-2 rounded-[1.85rem] border px-5 py-5",
              integratedGuide.tone === "danger"
                ? "border-red-500/20 bg-red-500/8 text-red-600 dark:text-red-300"
                : integratedGuide.tone === "caution"
                  ? "border-orange-500/20 bg-orange-500/8 text-orange-600 dark:text-orange-300"
                  : "border-nature-green/20 bg-nature-green/10 text-nature-green"
            )}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {integratedGuide.icon}
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-current/80">
                    {language === "ko" ? "오늘의 종합 안내" : "Today's guidance"}
                  </span>
                </div>
                <div className="mt-3 text-xl sm:text-2xl font-black leading-tight text-foreground dark:text-current break-keep">
                  {integratedGuide.title}
                </div>
                <p className="mt-3 text-sm sm:text-base font-bold leading-relaxed text-foreground/80 dark:text-current break-words">
                  {integratedGuide.text}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 lg:max-w-[280px] lg:justify-end">
                {integratedGuide.chips.map((chip) => (
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {briefingMeta.map((item) => (
              <div
                key={item.label}
                className="rounded-[1.45rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-4 py-4 min-w-0"
              >
                <div className="flex items-center gap-2 mb-3">
                  {item.icon}
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">{item.label}</span>
                </div>
                <div className="text-base sm:text-lg font-black leading-snug text-foreground break-words">
                  {item.title}
                </div>
                <div className="mt-2 text-xs sm:text-sm font-bold leading-relaxed text-muted-foreground break-words">
                  {item.detail}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.85rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} className="text-sky-blue" />
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              {language === "ko" ? "공식 통보" : "Official Bulletin"}
            </span>
          </div>
          <div className="rounded-[1.4rem] border border-sky-blue/15 bg-card px-4 py-4">
            <p className="text-sm sm:text-base font-bold leading-relaxed text-foreground/90 break-words">
              {bulletin.headline}
            </p>
            {bulletinTags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {bulletinTags.map((tag) => (
                  <span
                    key={`${tag.label}-${tag.tone}`}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-xs sm:text-base font-black uppercase tracking-widest",
                      getToneClasses(tag.tone)
                    )}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          {bulletin.segments.length > 0 && (
            <div className="mt-4 space-y-2">
              {bulletin.segments.map((segment) => (
                <div
                  key={`${segment.label}-${segment.text}`}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 rounded-2xl border px-4 py-3 min-w-0",
                    getToneClasses(getBulletinTone(segment.text))
                  )}
                >
                  <span className="inline-flex self-start sm:self-auto sm:shrink-0 w-fit max-w-[82%] sm:max-w-none rounded-2xl sm:rounded-full border border-current/10 bg-background/95 px-3 py-1.5 sm:px-3.5 text-current shadow-sm dark:bg-background/60">
                    <span
                      className={cn(
                        "block max-w-full break-words whitespace-normal text-left leading-snug",
                        language === "en"
                          ? "normal-case tracking-tight text-[11px] sm:text-sm font-extrabold"
                          : "tracking-[0.08em] text-[11px] sm:text-sm font-black"
                      )}
                    >
                      {segment.label}
                    </span>
                  </span>
                  <span className="min-w-0 text-base sm:text-lg font-bold leading-relaxed break-words text-current">
                    {segment.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 1. Conversational Briefing Summary (Key Highlights) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {quotes.map((quote, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "min-w-0 rounded-[1.5rem] border px-5 py-4 transition-all",
                quote.fullWidth && "lg:col-span-2",
                quote.type === "success" ? "bg-teal-400/5 border-teal-400/20 text-teal-600 dark:text-teal-400" :
                quote.type === "warning" ? "bg-orange-400/5 border-orange-400/20 text-orange-600 dark:text-orange-400" :
                quote.type === "neutral" ? "bg-[var(--interactive)] border-[var(--interactive-border)] text-foreground/85" :
                "bg-active-blue/5 border-active-blue/20 text-sky-blue"
              )}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="shrink-0 mt-0.5">{quote.icon}</div>
                <span className="text-sm sm:text-base font-bold leading-relaxed break-words">
                  {quote.text}
                </span>
              </div>
            </motion.div>
          ))}
        </div>


        {/* 2. Technical Data Grid (Full Parameters) */}
        <div className="p-8 rounded-[2.5rem] bg-[var(--interactive)] border border-[var(--interactive-border)]">
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-sky-blue animate-pulse" />
              <h4 className="text-xs sm:text-lg font-black uppercase tracking-[0.2em] text-muted-foreground">{t("brief_observation_grid")}</h4>
            </div>
            <span className="text-[8px] sm:text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.15em]">{t("brief_nrs_protocol")}</span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-y-8 gap-x-6 relative z-10">
            {techData.map((item, i) => (
              <div key={i} className="flex flex-col items-start group">
                <div className="flex items-center gap-2 text-muted-foreground mb-2 group-hover:text-sky-blue transition-colors">
                  <div className="p-1 rounded-md bg-[var(--interactive)] border border-[var(--interactive-border)] transition-colors group-hover:bg-sky-blue/10">
                    {item.icon}
                  </div>
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">{item.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-foreground tabular-nums tracking-tighter break-words">
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer with Sync Status */}
      <div className="bg-[var(--interactive)] px-8 sm:px-12 py-6 border-t border-[var(--card-border)]">
        <div className="flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-3">
             <Clock size={14} className="text-sky-blue opacity-50" />
             <div className="flex flex-col">
               <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">{t("brief_kma_sync")}</span>
               <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 italic">
                 {getUpdateTime('kma')} ({t(metadata?.intervals.kma || "interval_45m")})
               </span>
             </div>
          </div>
          <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 hidden sm:block" />
          <div className="flex items-center gap-3">
             <Database size={14} className="text-sky-blue opacity-50" />
             <div className="flex flex-col">
               <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">{t("brief_air_sync")}</span>
               <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 italic">
                 {getUpdateTime('air')} ({t(metadata?.intervals.air || "interval_0m")})
               </span>
             </div>
          </div>
          <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 hidden sm:block" />
          <div className="flex items-center gap-3">
             <Info size={14} className="text-sky-blue opacity-50" />
             <div className="flex flex-col">
               <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">{t("brief_data_source")}</span>
               <div className="mt-1 flex flex-wrap items-center gap-2">
                 {sourceLabels.map((source) => (
                     <span
                       key={source}
                       className="rounded-full border border-sky-blue/15 bg-sky-blue/8 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-sky-blue"
                     >
                       {source}
                     </span>
                   ))}
               </div>
              </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
