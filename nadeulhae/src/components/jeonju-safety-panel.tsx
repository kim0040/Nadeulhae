"use client"

/**
 * JeonjuSafetyPanel — comprehensive safety overview for Jeonju.
 * Combines real-time hazard signals, weather-derived mobility notes,
 * and Jeonbuk fire-flow data into one scrollable summary panel.
 * Fully i18n via the `language` prop.
 */

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

// Regex patterns to filter out non-actionable bulletin messages
const NON_BULLETIN_MESSAGE_PATTERN = /(전주 기준 대기질 데이터를 표시 중입니다|showing fallback air quality data)/i
const EMPTY_BULLETIN_PATTERN = /^(?:[oO○◯●□■▪︎ㆍ·\-\*\s]*)?(?:없음|없\s*음|none|no\s*alerts?|n\/a)(?:[\s.)\]]*)$/i

/** Format YYYYMMDD → YYYY.MM.DD */ function formatDateLabel(date: string) {
  if (!date || date.length !== 8) return date
  return `${date.slice(0, 4)}.${date.slice(4, 6)}.${date.slice(6, 8)}`
}

/** Format YYYYMMDD → locale-aware short label (M.D / M月D日 / M/D) */ function formatShortDateLabel(date: string, language: string) {
  if (!date || date.length !== 8) return date
  const month = Number(date.slice(4, 6))
  const day = Number(date.slice(6, 8))
  return language === "ko" ? `${month}.${day}` : language === "zh" ? `${month}月${day}日` : language === "ja" ? `${month}月${day}日` : `${month}/${day}`
}

/** Clean an ISO timestamp for display: strip T, truncate to 16 chars, replace - with . */ function formatUpdateLabel(value?: string) {
  if (!value) return ""
  return value.replace("T", " ").slice(0, 16).replace(/-/g, ".")
}

/** Map a Tone to border/bg/text utility classes */ function toneClasses(tone: Tone) {
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

// ---- Safety data helpers ----

/** Walk the alert pipeline and return the first meaningful non-fallback alert text */ function selectOfficialAlertText(weatherData: WeatherData) {
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
    chips.push({ label: language === "ko" ? "특보" : language === "zh" ? "警报" : language === "ja" ? "警報" : "Warning", tone: "danger" })
  }
  if (eventData?.isRain) {
    chips.push({ label: language === "ko" ? "강수" : language === "zh" ? "降水" : language === "ja" ? "降水" : "Rain", tone: "caution" })
  }
  if (eventData?.isEarthquake) {
    chips.push({ label: language === "ko" ? "지진" : language === "zh" ? "地震" : language === "ja" ? "地震" : "Earthquake", tone: "danger" })
  }
  if (eventData?.isTsunami) {
    chips.push({ label: language === "ko" ? "지진해일" : language === "zh" ? "海啸" : language === "ja" ? "津波" : "Tsunami", tone: "danger" })
  }
  if (eventData?.isVolcano) {
    chips.push({ label: language === "ko" ? "화산" : language === "zh" ? "火山" : language === "ja" ? "火山" : "Volcano", tone: "danger" })
  }
  if (eventData?.isTyphoon) {
    chips.push({ label: language === "ko" ? "태풍" : language === "zh" ? "台风" : language === "ja" ? "台風" : "Typhoon", tone: "danger" })
  }

  if (!chips.length) {
    const warningStatus = metadata?.bulletin?.warningStatus?.replace(/\s+/g, "")
    if (warningStatus && !/없음|none|o없음/i.test(warningStatus)) {
      chips.push({ label: language === "ko" ? "기상통보" : language === "zh" ? "气象通报" : language === "ja" ? "気象通報" : "Bulletin", tone: "info" })
    }
  }

  if (!chips.length) {
    chips.push({ label: language === "ko" ? "안정" : language === "zh" ? "稳定" : language === "ja" ? "安定" : "Stable", tone: "safe" })
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
      title: language === "ko" ? "활성 안전 신호" : language === "zh" ? "活跃安全信号" : language === "ja" ? "アクティブ安全信号" : "Active safety signal",
      text: detail || (language === "ko" ? "전주 기준 재난 또는 특보 신호가 감지되었습니다." : language === "zh" ? "全州地区检测到灾难或警报信号。" : language === "ja" ? "全州基準で災害または警報信号が検出されました。" : "A disaster or warning signal is active for Jeonju."),
    }
  }

  if (eventData?.isRain) {
    return {
      tone: "caution" as const,
      count: 1,
      title: language === "ko" ? "현재 강수" : language === "zh" ? "当前降水" : language === "ja" ? "現在の降水" : "Current precipitation",
      text: language === "ko"
        ? "비 또는 약한 강수가 감지되어 바깥 일정 전 노면과 우산 여부를 함께 확인하는 편이 좋습니다."
        : language === "zh"
          ? "检测到雨或弱降水，外出前最好确认路面和雨伞情况。"
          : language === "ja"
            ? "雨または弱い降水が検出されているため、外出前に路面と傘の有無を確認することをお勧めします。"
            : "Rain or light precipitation is currently detected, so it is worth checking road conditions before heading out.",
    }
  }

  return {
    tone: "safe" as const,
    count: 0,
    title: language === "ko" ? "활성 특보 없음" : language === "zh" ? "无活跃警报" : language === "ja" ? "アクティブ警報なし" : "No active warning",
    text: language === "ko"
      ? "전주 기준 현재 특보·지진·지진해일·화산 경보는 감지되지 않았습니다."
      : language === "zh"
        ? "全州地区目前未检测到警报、地震、海啸、火山信号。"
        : language === "ja"
          ? "全州基準では現在、警報・地震・津波・火山信号は検出されていません。"
          : "No active warning, earthquake, tsunami, or volcano signal is currently detected for Jeonju.",
  }
}

function getMobilitySummary(weatherData: WeatherData, language: string) {
  const { details, eventData, metadata } = weatherData
  const bulletin = metadata?.bulletin?.summary || ""

  if (eventData?.isWeatherWarning || eventData?.isEarthquake || eventData?.isTsunami || eventData?.isVolcano) {
    return {
      tone: "danger" as const,
      label: language === "ko" ? "이동 재검토" : language === "zh" ? "重新考虑出行" : language === "ja" ? "移動再検討" : "Recheck travel",
      text: language === "ko"
        ? "위험 신호가 감지된 날에는 전주 내 이동 일정을 줄이거나 실내 위주로 바꾸는 편이 안전합니다."
        : language === "zh"
          ? "检测到危险信号的日子，建议减少全州内的出行安排或改为室内活动。"
          : language === "ja"
            ? "危険信号が検出された日は、全州内の移動を減らし、室内中心に切り替えるのが安全です。"
            : "When a hazard signal is active, it is safer to reduce movement and lean toward indoor plans in Jeonju.",
    }
  }

  if (eventData?.isRain || (details.rn1 || 0) > 0) {
    return {
      tone: "caution" as const,
      label: language === "ko" ? "젖은 노면 주의" : language === "zh" ? "湿滑路面注意" : language === "ja" ? "濡れた路面注意" : "Wet roads",
      text: language === "ko"
        ? "비가 내리면 전주천·덕진공원 주변 보행 구간과 차량 이동 모두 미끄럼에 주의하는 편이 좋습니다."
        : language === "zh"
          ? "下雨时全州川、德津公园周边步行区间和车辆移动都需注意防滑。"
          : language === "ja"
            ? "雨が降ると全州川・徳津公園周辺の歩行区間と車両移動ともに滑りやすくなるため注意が必要です。"
            : "Rain makes walking paths and local roads around Jeonju more slippery, so slower movement is advised.",
    }
  }

  if ((details.wind || 0) >= 7) {
    return {
      tone: "caution" as const,
      label: language === "ko" ? "강풍 구간 주의" : language === "zh" ? "强风区域注意" : language === "ja" ? "強風区間注意" : "Windy spots",
      text: language === "ko"
        ? "순간 바람이 강한 날에는 한옥마을 골목이나 개방된 공원 구간에서 체감이 크게 달라질 수 있습니다."
        : language === "zh"
          ? "瞬间风力较强时，韩屋村小巷或开阔公园区域的体感可能会有很大差异。"
          : language === "ja"
            ? "瞬間的な風が強い日は、韓屋村の路地や開放的な公園区間で体感が大きく変わることがあります。"
            : "When winds pick up, open park areas and narrow alleys in Jeonju can feel rougher than the raw number suggests.",
    }
  }

  if ((details.feelsLike ?? details.temp) <= 1) {
    return {
      tone: "caution" as const,
      label: language === "ko" ? "찬 공기 주의" : language === "zh" ? "冷空气注意" : language === "ja" ? "冷たい空気注意" : "Cold air",
      text: language === "ko"
        ? "체감 온도가 낮아 이른 시간대 이동은 다소 차갑게 느껴질 수 있습니다. 얇은 겉옷 하나 더 챙기는 편이 좋습니다."
        : language === "zh"
          ? "体感温度较低，清晨出行可能会感到有些冷，建议多带一件薄外套。"
          : language === "ja"
            ? "体感温度が低く、早い時間帯の移動はやや寒く感じられる可能性があります。薄手の上着をもう一枚用意することをお勧めします。"
            : "The air feels cold enough that early movement may be uncomfortable, so an extra layer is a good idea.",
    }
  }

  if ((details.humidity || 0) >= 90 && /안개/.test(bulletin)) {
    return {
      tone: "info" as const,
      label: language === "ko" ? "시야 확인" : language === "zh" ? "确认视野" : language === "ja" ? "視界確認" : "Check visibility",
      text: language === "ko"
        ? "안개 언급이 있어 하천변이나 외곽 이동 구간은 시야를 한 번 더 확인하는 편이 좋습니다."
        : language === "zh"
          ? "预报中提到有雾，河畔或外围移动区间建议再次确认视野。"
          : language === "ja"
            ? "霧の言及があるため、川辺や郊外の移動区間は視界を再度確認することをお勧めします。"
            : "Fog is mentioned in the bulletin, so riverside and outer-road visibility is worth checking.",
    }
  }

  return {
    tone: "safe" as const,
    label: language === "ko" ? "이동 무난" : language === "zh" ? "出行无碍" : language === "ja" ? "移動問題なし" : "Steady movement",
    text: language === "ko"
      ? "전주 시내 이동과 가벼운 산책을 하기에는 비교적 무난한 흐름입니다."
      : language === "zh"
        ? "全州市内出行和轻松散步相对来说是比较合适的天气。"
        : language === "ja"
          ? "全州市内の移動や軽い散歩には比較的問題のない状況です。"
          : "Conditions look fairly steady for city movement and a light walk around Jeonju.",
  }
}

function getFireFlowBadge(fireSummary: FireSummaryData | null, language: string) {
  if (!fireSummary) {
    return {
      tone: "info" as const,
      label: language === "ko" ? "집계 대기" : language === "zh" ? "等待统计" : language === "ja" ? "集計待機" : "Loading",
      detail: language === "ko" ? "화재 집계 확인 중" : language === "zh" ? "正在确认火灾统计" : language === "ja" ? "火災集計確認中" : "Checking fire flow",
    }
  }

  const latest = fireSummary.overview.latestFireReceipt
  const avg = fireSummary.overview.sevenDayAverage

  if (latest >= Math.max(12, avg * 1.4)) {
    return {
      tone: "danger" as const,
      label: language === "ko" ? "평소보다 높음" : language === "zh" ? "高于平常" : language === "ja" ? "通常より高い" : "Above usual",
      detail: language === "ko" ? "최근 접수 흐름이 빠르게 올라간 날" : language === "zh" ? "最近接收量快速上升的日子" : language === "ja" ? "最近の受付件数が急増している日" : "Recent reports are running high",
    }
  }

  if (latest >= Math.max(6, avg * 1.1)) {
    return {
      tone: "caution" as const,
      label: language === "ko" ? "조금 많음" : language === "zh" ? "略多" : language === "ja" ? "やや多い" : "Slightly elevated",
      detail: language === "ko" ? "최근 평균보다 약간 많은 흐름" : language === "zh" ? "略高于近期平均" : language === "ja" ? "最近の平均よりやや多い" : "A bit above the recent average",
    }
  }

  return {
    tone: "safe" as const,
    label: language === "ko" ? "비교적 무난" : language === "zh" ? "相对平稳" : language === "ja" ? "比較的安定" : "Relatively steady",
    detail: language === "ko" ? "최근 평균 안쪽 흐름" : language === "zh" ? "在近期平均范围内" : language === "ja" ? "最近の平均範囲内" : "Within the recent baseline",
  }
}

function getFirePlaceNarrative(fireSummary: FireSummaryData | null, language: string) {
  if (!fireSummary?.topPlaces?.length) {
    return {
      title: language === "ko" ? "장소 패턴 집계 중" : language === "zh" ? "场所模式统计中" : language === "ja" ? "場所パターン集計中" : "Reading place patterns",
      text: language === "ko"
        ? "장소별 화재 흐름은 데이터가 모이면 이곳에 정리됩니다."
        : language === "zh"
          ? "各场所的火灾趋势在数据收集后会在此处整理显示。"
          : language === "ja"
            ? "場所別の火災傾向はデータが集まり次第、こちらに整理されます。"
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
      label: language === "ko" ? `야외성 장소 ${outdoorCount}` : language === "zh" ? `户外场所 ${outdoorCount}` : language === "ja" ? `屋外系場所 ${outdoorCount}` : `Outdoor-like ${outdoorCount}`,
      tone: "caution",
    })
  }

  if (indoorCount > 0) {
    chips.push({
      label: language === "ko" ? `시설·생활권 ${indoorCount}` : language === "zh" ? `设施·生活圈 ${indoorCount}` : language === "ja" ? `施設・生活圏 ${indoorCount}` : `Facility / urban ${indoorCount}`,
      tone: "info",
    })
  }

  if (topPlace?.propertyDamage > 0) {
    chips.push({
      label: language === "ko"
        ? `재산피해 ${topPlace.propertyDamage.toLocaleString()}천원`
        : language === "zh"
          ? `财产损失 ${topPlace.propertyDamage.toLocaleString()}千韩元`
          : language === "ja"
            ? `財産被害 ${topPlace.propertyDamage.toLocaleString()}千ウォン`
            : `Loss ${topPlace.propertyDamage.toLocaleString()}k KRW`,
      tone: "danger",
    })
  }

  if (topPlace?.outdoor) {
    return {
      title: language === "ko" ? "야외성 장소 비중이 보입니다" : language === "zh" ? "户外场所比重显眼" : language === "ja" ? "屋外系場所の比率が目立ちます" : "Outdoor-type places stand out",
      text: language === "ko"
        ? `최근 집계된 상위 장소 ${fireSummary.topPlaces.length}개 중 ${outdoorCount}개가 야외성 장소로 잡혔습니다. 특히 '${topPlace.name}' 유형이 ${topPlace.count}건으로 가장 많이 보였습니다.`
        : language === "zh"
          ? `最近统计的前 ${fireSummary.topPlaces.length} 个场所中，${outdoorCount} 个为户外场所。其中 '${topPlace.name}' 类型出现最多，共 ${topPlace.count} 件。`
          : language === "ja"
            ? `最近集計された上位 ${fireSummary.topPlaces.length} ヶ所のうち、${outdoorCount} ヶ所が屋外系場所です。特に '${topPlace.name}' タイプが ${topPlace.count} 件で最も多く見られました。`
            : `Among the top ${fireSummary.topPlaces.length} place groups, ${outdoorCount} are outdoor-like. '${topPlace.name}' stands out most with ${topPlace.count} cases.`,
      chips,
    }
  }

  return {
    title: language === "ko" ? "생활권 시설 중심 흐름입니다" : language === "zh" ? "以生活圈设施为主的趋势" : language === "ja" ? "生活圏施設中心の流れです" : "The flow leans toward daily facilities",
    text: language === "ko"
      ? `최근 상위 장소 ${fireSummary.topPlaces.length}개는 생활권·시설물 비중이 더 큽니다. 대표 유형은 '${topPlace.name}'이며, 집계된 상위 장소 합은 ${totalCases}건입니다.`
      : language === "zh"
        ? `最近统计的前 ${fireSummary.topPlaces.length} 个场所中，生活圈和设施占比更大。代表类型为 '${topPlace.name}'，前几位场所合计 ${totalCases} 件。`
        : language === "ja"
          ? `最近の上位 ${fireSummary.topPlaces.length} ヶ所は生活圏・施設の割合が大きくなっています。代表タイプは '${topPlace.name}' で、上位場所の合計は ${totalCases} 件です。`
          : `The recent top place groups lean more toward everyday facilities. '${topPlace.name}' is the main type, and the top grouped places account for ${totalCases} cases in total.`,
    chips,
  }
}

function getOverallSafetyGuide(weatherData: WeatherData, fireSummary: FireSummaryData | null, language: string) {
  const alertDetail = selectOfficialAlertText(weatherData)

  if (weatherData.eventData?.isEarthquake || weatherData.eventData?.isTsunami || weatherData.eventData?.isVolcano) {
    return {
      tone: "danger" as const,
      title: language === "ko" ? "오늘은 전주 안전 안내를 먼저 확인하는 편이 좋습니다" : language === "zh" ? "今天建议优先确认全州安全指南" : language === "ja" ? "本日は全州の安全案内をまず確認することをお勧めします" : "Today is a day to check Jeonju safety notices first",
      text: alertDetail || (language === "ko"
        ? "재난 신호가 감지된 날에는 외부 일정 확대보다 공식 안내와 이동 안전을 우선으로 보는 편이 좋습니다."
        : language === "zh"
          ? "检测到灾难信号的日子，比起扩大外部行程，建议优先查看官方指南和出行安全。"
          : language === "ja"
            ? "災害信号が検出された日は、外部予定の拡大よりも公式案内と移動の安全を優先することをお勧めします。"
            : "With a hazard signal active, official guidance and movement safety should come before expanding outdoor plans."),
      chips: [
        language === "ko" ? "공식 통보 우선" : language === "zh" ? "官方通报优先" : language === "ja" ? "公式通報優先" : "Official bulletin first",
        language === "ko" ? "이동 재검토" : language === "zh" ? "重新考虑出行" : language === "ja" ? "移動再検討" : "Recheck movement",
      ],
    }
  }

  if (weatherData.eventData?.isWeatherWarning) {
    return {
      tone: "danger" as const,
      title: language === "ko" ? "오늘은 특보 내용까지 보고 움직이는 편이 안전합니다" : language === "zh" ? "今天建议确认警报内容后再行动更为安全" : language === "ja" ? "本日は警報内容を確認してから行動するのが安全です" : "Today is safer if you move with the warning details in mind",
      text: alertDetail || (language === "ko"
        ? "전주 기준 특보가 감지된 상태라 실시간 점수보다 통보 내용과 바람·강수 흐름을 함께 보는 편이 좋습니다."
        : language === "zh"
          ? "全州地区已检测到警报，建议实时分数与通报内容、风、降水趋势一同确认。"
          : language === "ja"
            ? "全州基準で警報が検出されているため、リアルタイムスコアよりも通報内容と風・降水の動向を一緒に確認することをお勧めします。"
            : "A warning is active for Jeonju, so the bulletin plus wind and rain signals matter more than the score alone."),
      chips: [
        language === "ko" ? "기상특보" : language === "zh" ? "气象警报" : language === "ja" ? "気象警報" : "Weather warning",
        language === "ko" ? "야외 일정 축소" : language === "zh" ? "减少户外活动" : language === "ja" ? "屋外予定縮小" : "Scale back plans",
      ],
    }
  }

  if (weatherData.eventData?.isRain) {
    return {
      tone: "caution" as const,
      title: language === "ko" ? "비가 이어져 오늘 전주 일정은 보수적으로 보는 편이 좋습니다" : language === "zh" ? "持续降雨，今天全州行程建议保守安排" : language === "ja" ? "雨が続くため、本日の全州予定は控えめに見ることをお勧めします" : "Rain is active, so it is better to read today's Jeonju plans conservatively",
      text: language === "ko"
        ? "현재 강수 또는 가까운 시간대 비 신호가 있어 이동 속도와 야외 체류 시간을 줄이는 쪽이 무난합니다."
        : language === "zh"
          ? "当前有降雨或短时降雨信号，建议降低移动速度并减少户外停留时间。"
          : language === "ja"
            ? "現在の降水または近い時間帯の雨の信号があるため、移動速度と屋外滞在時間を減らすのが無難です。"
            : "Current or near-term rain is active, so slower movement and shorter outdoor stays are the safer call.",
      chips: [
        language === "ko" ? "우산 준비" : language === "zh" ? "准备雨伞" : language === "ja" ? "傘の準備" : "Umbrella ready",
        language === "ko" ? "젖은 노면 주의" : language === "zh" ? "湿滑路面注意" : language === "ja" ? "濡れた路面注意" : "Wet roads",
      ],
    }
  }

  if (fireSummary?.overview.cautionLevel === "high") {
    return {
      tone: "caution" as const,
      title: language === "ko" ? "날씨는 무난하지만 최근 화재 흐름은 한 번 더 볼 만합니다" : language === "zh" ? "天气尚可，但近期火灾趋势值得再次关注" : language === "ja" ? "天気は穏やかですが、最近の火災の流れはもう一度確認する価値があります" : "Weather looks steady, but recent fire flow is worth a second look",
      text: language === "ko"
        ? "전북 화재 접수가 평균보다 올라간 흐름이라 야외 화기 사용이나 건조한 장소에서는 조금 더 조심하는 편이 좋습니다."
        : language === "zh"
          ? "全北火灾接报量高于平均水平，在户外用火或干燥场所建议多加小心。"
          : language === "ja"
            ? "全北の火災受付が平均より増加しているため、屋外での火器使用や乾燥した場所ではより注意することをお勧めします。"
            : "Recent fire reports in Jeonbuk are above baseline, so extra care around dry outdoor spots and open flames makes sense.",
      chips: [
        language === "ko" ? "전북 화재 흐름 높음" : language === "zh" ? "全北火灾趋势偏高" : language === "ja" ? "全北火災流動高い" : "Fire flow elevated",
      ],
    }
  }

  return {
    tone: "safe" as const,
    title: language === "ko" ? "오늘은 전주 흐름을 비교적 편하게 읽어볼 수 있습니다" : language === "zh" ? "今天全州的状况相对容易把握" : language === "ja" ? "本日は全州の状況を比較的楽に読み取れます" : "Today looks fairly easy to read for Jeonju plans",
    text: language === "ko"
      ? "실시간 위험 신호가 크지 않아 체감 기온, 바람, 전북 화재 흐름 정도를 함께 보며 일정을 정하기 좋습니다."
      : language === "zh"
        ? "实时危险信号不大，可结合体感温度、风力和全北火灾趋势来安排行程。"
        : language === "ja"
          ? "リアルタイムの危険信号は大きくないため、体感気温、風、全北の火災傾向を一緒に見ながら予定を決めるのに適しています。"
          : "No major active signal is standing out, so temperature feel, wind, and fire flow should be enough to shape today's plans.",
    chips: [
      language === "ko" ? "실시간 신호 안정" : language === "zh" ? "实时信号稳定" : language === "ja" ? "リアルタイム信号安定" : "Signals steady",
    ],
  }
}

// ---- Component ----

export function JeonjuSafetyPanel({
  weatherData,
  fireSummary,
  language,
}: JeonjuSafetyPanelProps) {
  // Derive all sub-section data from weather + fire sources
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
            {language === "ko" ? "오늘의 전주안전" : language === "zh" ? "今日全州安全" : language === "ja" ? "今日の全州安全" : "Today's Jeonju Safety"}
          </AnimatedGradientText>
          <p className="mt-4 text-base sm:text-lg font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400">
            {language === "ko"
              ? "전주 기준으로 오늘 바로 확인할 안전 신호를 한곳에 모았습니다. 실시간 특보·재난, 전북 화재 흐름, 이동 주의 포인트를 좌표·관측소·광역 집계 기준에 맞춰 읽을 수 있습니다."
              : language === "zh"
                ? "基于全州标准，将今日需要确认的安全信号汇集一处。可根据坐标、观测站和广域统计基准查看实时警报·灾害、全北火灾趋势及出行注意事项。"
                : language === "ja"
                  ? "全州基準で今日すぐ確認すべき安全信号を一箇所にまとめました。リアルタイムの警報・災害、全北の火災動向、移動注意ポイントを座標・観測所・広域集計基準に合わせて読むことができます。"
                  : "This panel brings together Jeonju's key safety signals for today, including live warnings, Jeonbuk fire flow, and movement notes with their own location and cache rules."}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <span className="inline-flex rounded-full border border-active-blue/20 bg-active-blue/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-active-blue">
            <MapPinned size={14} className="mr-1.5" />
            {language === "ko" ? "전주 고정 좌표" : language === "zh" ? "全州固定坐标" : language === "ja" ? "全州固定座標" : "Fixed Jeonju coordinates"}
          </span>
          <span className="inline-flex rounded-full border border-nature-green/20 bg-nature-green/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-nature-green">
            <Waves size={14} className="mr-1.5" />
            {language === "ko" ? "실시간 + 집계 혼합" : language === "zh" ? "实时+统计混合" : language === "ja" ? "リアルタイム+集計混合" : "Live + aggregated mix"}
          </span>
          {fireSummary && (
            <span className="inline-flex rounded-full border border-orange-500/20 bg-orange-500/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-orange-600 dark:text-orange-300">
              <Flame size={14} className="mr-1.5" />
              {language === "ko" ? "전북 광역 화재 흐름" : language === "zh" ? "全北广域火灾趋势" : language === "ja" ? "全北広域火災流動" : "Jeonbuk fire flow"}
            </span>
          )}
        </div>

        <div className={cn("mt-6 rounded-[2rem] border px-5 py-5 sm:px-6", toneClasses(overallGuide.tone))}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-current/80">
                {language === "ko" ? "오늘의 종합 안내" : language === "zh" ? "今日综合指南" : language === "ja" ? "今日の総合案内" : "Today's guidance"}
              </div>
              <div className="mt-3 text-xl sm:text-2xl font-black leading-tight text-foreground dark:text-current break-words">
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
                {language === "ko" ? "실시간 위험 신호" : language === "zh" ? "实时危险信号" : language === "ja" ? "リアルタイム危険信号" : "Live risk signals"}
              </div>
              <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">{hazardSummary.count}</div>
                  <p className="mt-2 text-lg sm:text-2xl font-black text-foreground break-words">{hazardSummary.title}</p>
                  <p className="mt-3 max-w-2xl text-sm sm:text-base font-bold leading-relaxed text-muted-foreground break-words">
                    {hazardSummary.text}
                  </p>
                </div>
                <div className="grid shrink-0 grid-cols-3 gap-2 sm:w-auto sm:min-w-[240px]">
                  <div className="rounded-[1.2rem] border border-card-border bg-card px-3 py-3">
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                      <Thermometer size={12} />
                      {language === "ko" ? "체감" : language === "zh" ? "体感" : language === "ja" ? "体感" : "Feels"}
                    </div>
                    <div className="mt-2 text-base sm:text-lg font-black text-foreground">{Math.round(weatherData.details.feelsLike ?? weatherData.details.temp)}°C</div>
                  </div>
                  <div className="rounded-[1.2rem] border border-card-border bg-card px-3 py-3">
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                      <Wind size={12} />
                      {language === "ko" ? "바람" : language === "zh" ? "风力" : language === "ja" ? "風" : "Wind"}
                    </div>
                    <div className="mt-2 text-base sm:text-lg font-black text-foreground">{weatherData.details.wind}m/s</div>
                  </div>
                  <div className="rounded-[1.2rem] border border-card-border bg-card px-3 py-3">
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                      <CloudRain size={12} />
                      {language === "ko" ? "강수" : language === "zh" ? "降水" : language === "ja" ? "降水" : "Rain"}
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
                {language === "ko" ? "이동 주의 포인트" : language === "zh" ? "出行注意事项" : language === "ja" ? "移動注意ポイント" : "Movement note"}
              </div>
              <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-lg sm:text-2xl font-black tracking-tight text-foreground">{mobilitySummary.label}</div>
                  <p className="mt-2 max-w-2xl text-sm sm:text-base font-bold leading-relaxed text-muted-foreground break-words">
                    {mobilitySummary.text}
                  </p>
                </div>
                <div className={cn("inline-flex self-start rounded-full border px-3 py-1.5 text-[11px] sm:text-sm font-black tracking-wide", toneClasses(mobilitySummary.tone))}>
                  {language === "ko" ? "전주 현장 감각 중심" : language === "zh" ? "全州现场感知中心" : language === "ja" ? "全州現場感覚中心" : "Jeonju field note"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2.2rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              <Flame size={14} className={cn(fireTone === "danger" ? "text-red-500" : fireTone === "caution" ? "text-orange-500" : "text-nature-green")} />
              {language === "ko" ? "전북 화재 흐름" : language === "zh" ? "全北火灾趋势" : language === "ja" ? "全北火災流動" : "Jeonbuk fire flow"}
            </div>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
                  {fireSummary?.overview.latestFireReceipt ?? "-"}
                </div>
                <p className="mt-2 text-sm sm:text-base font-bold text-foreground break-words">
                  {fireSummary
                    ? (language === "ko"
                      ? `최근 평균 ${fireSummary.overview.sevenDayAverage}건 · ${formatDateLabel(fireSummary.metadata.latestDate)} 기준`
                      : language === "zh"
                        ? `近平均 ${fireSummary.overview.sevenDayAverage}件 · ${formatDateLabel(fireSummary.metadata.latestDate)} 基准`
                        : language === "ja"
                          ? `最近平均 ${fireSummary.overview.sevenDayAverage}件 · ${formatDateLabel(fireSummary.metadata.latestDate)} 基準`
                          : `Avg ${fireSummary.overview.sevenDayAverage} · latest ${formatDateLabel(fireSummary.metadata.latestDate)}`)
                    : (language === "ko" ? "전북 화재 집계를 불러오는 중입니다." : language === "zh" ? "正在加载全北火灾统计数据。" : language === "ja" ? "全北火災集計を読み込んでいます。" : "Loading Jeonbuk fire flow.")}
                </p>
              </div>
              <span className={cn("inline-flex shrink-0 rounded-full border px-3 py-1.5 text-[11px] sm:text-sm font-black tracking-wide", toneClasses(fireFlowBadge.tone))}>
                {fireFlowBadge.label}
              </span>
            </div>
            <p className="mt-3 text-sm sm:text-base font-bold leading-relaxed text-muted-foreground break-words">
              {fireSummary
                ? (language === "ko" ? fireSummary.overview.shortMessageKo : language === "zh" ? fireSummary.overview.shortMessageZh : language === "ja" ? fireSummary.overview.shortMessageJa : fireSummary.overview.shortMessageEn)
                : (language === "ko" ? "최근 화재 접수 흐름과 장소 패턴을 곧 반영합니다." : language === "zh" ? "最近的火灾接报趋势和场所模式将很快显示。" : language === "ja" ? "最近の火災受付の流れと場所パターンを間もなく反映します。" : "Recent fire flow and place patterns will appear here once loaded.")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[1.2rem] border border-card-border bg-card px-3 py-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                  {language === "ko" ? "피크일" : language === "zh" ? "峰值日" : language === "ja" ? "ピーク日" : "Peak day"}
                </div>
                <div className="mt-2 text-base sm:text-lg font-black text-foreground">
                  {fireSummary ? formatShortDateLabel(fireSummary.overview.peakDate, language) : "-"}
                </div>
                <div className="mt-1 text-xs sm:text-sm font-bold text-muted-foreground">
                  {fireSummary
                    ? (language === "ko"
                      ? `${fireSummary.overview.peakFireReceipt}건 접수`
                      : language === "zh"
                        ? `${fireSummary.overview.peakFireReceipt}件接报`
                        : language === "ja"
                          ? `${fireSummary.overview.peakFireReceipt}件受付`
                          : `${fireSummary.overview.peakFireReceipt} reports`)
                    : ""}
                </div>
              </div>
              <div className="rounded-[1.2rem] border border-card-border bg-card px-3 py-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                  {language === "ko" ? "가장 많이 보인 장소" : language === "zh" ? "最常见场所" : language === "ja" ? "最も多く見られた場所" : "Top place"}
                </div>
                <div className="mt-2 text-base sm:text-lg font-black text-foreground break-words">
                  {topFirePlace?.name || (language === "ko" ? "집계 없음" : language === "zh" ? "暂无数据" : language === "ja" ? "データなし" : "No data")}
                </div>
                <div className="mt-1 text-xs sm:text-sm font-bold text-muted-foreground">
                  {topFirePlace
                    ? (language === "ko" ? `${topFirePlace.count}건` : language === "zh" ? `${topFirePlace.count}件` : language === "ja" ? `${topFirePlace.count}件` : `${topFirePlace.count} cases`)
                    : ""}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-[1.4rem] border border-card-border bg-card px-4 py-4">
              <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                {language === "ko" ? "장소 패턴 해석" : language === "zh" ? "场所模式解读" : language === "ja" ? "場所パターン解釈" : "Place pattern read"}
              </div>
              <div className="mt-2 text-base sm:text-lg font-black text-foreground break-words">
                {firePlaceNarrative.title}
              </div>
              <p className="mt-2 text-sm sm:text-base font-bold leading-relaxed text-muted-foreground break-words">
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
                  {language === "ko" ? "최근 7일 접수 흐름" : language === "zh" ? "最近7日接报趋势" : language === "ja" ? "最近7日間の受付動向" : "Recent 7-day flow"}
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
              {language === "ko" ? "데이터 기준" : language === "zh" ? "数据基准" : language === "ja" ? "データ基準" : "Data basis"}
            </div>
            <div className="flex flex-1 flex-wrap gap-2">
              <span className="inline-flex rounded-full border border-card-border/80 bg-card/80 px-3 py-1.5 text-[11px] sm:text-xs font-black tracking-wide text-foreground/80">
                {language === "ko"
                  ? `기상·재난 ${cachePolicy?.weatherMinutes ?? 10}분 / 특보 ${cachePolicy?.alertMinutes ?? 15}분`
                  : language === "zh"
                    ? `天气·灾难 ${cachePolicy?.weatherMinutes ?? 10}分 / 警报 ${cachePolicy?.alertMinutes ?? 15}分`
                    : language === "ja"
                      ? `気象・災害 ${cachePolicy?.weatherMinutes ?? 10}分 / 警報 ${cachePolicy?.alertMinutes ?? 15}分`
                      : `Weather ${cachePolicy?.weatherMinutes ?? 10}m / alerts ${cachePolicy?.alertMinutes ?? 15}m`}
              </span>
              <span className="inline-flex rounded-full border border-card-border/80 bg-card/80 px-3 py-1.5 text-[11px] sm:text-xs font-black tracking-wide text-foreground/80">
                {language === "ko"
                  ? `대기 ${weatherData.metadata?.station || "전주 인근 측정소"} · ${cachePolicy?.airMinutes ?? 60}분`
                  : language === "zh"
                    ? `大气 ${weatherData.metadata?.station || "全州附近观测站"} · ${cachePolicy?.airMinutes ?? 60}分`
                    : language === "ja"
                      ? `大気 ${weatherData.metadata?.station || "全州近郊観測所"} · ${cachePolicy?.airMinutes ?? 60}分`
                      : `Air ${weatherData.metadata?.station || "Jeonju station"} · ${cachePolicy?.airMinutes ?? 60}m`}
              </span>
              <span className="inline-flex rounded-full border border-card-border/80 bg-card/80 px-3 py-1.5 text-[11px] sm:text-xs font-black tracking-wide text-foreground/80">
                {language === "ko"
                  ? `화재 ${fireSummary?.metadata.coverageDays ?? 7}일 흐름 · ${fireSummary?.metadata.cacheHours ?? 12}시간`
                  : language === "zh"
                    ? `火灾 ${fireSummary?.metadata.coverageDays ?? 7}日趋势 · ${fireSummary?.metadata.cacheHours ?? 12}小时`
                    : language === "ja"
                      ? `火災 ${fireSummary?.metadata.coverageDays ?? 7}日流動 · ${fireSummary?.metadata.cacheHours ?? 12}時間`
                      : `Fire ${fireSummary?.metadata.coverageDays ?? 7}d flow · ${fireSummary?.metadata.cacheHours ?? 12}h`}
              </span>
              <span className="inline-flex rounded-full border border-card-border/80 bg-card/80 px-3 py-1.5 text-[11px] sm:text-xs font-black tracking-wide text-muted-foreground">
                {language === "ko"
                  ? `기상청 ${formatUpdateLabel(weatherUpdatedAt)} · 대기 ${formatUpdateLabel(airUpdatedAt)}`
                  : language === "zh"
                    ? `气象厅 ${formatUpdateLabel(weatherUpdatedAt)} · 大气 ${formatUpdateLabel(airUpdatedAt)}`
                    : language === "ja"
                      ? `気象庁 ${formatUpdateLabel(weatherUpdatedAt)} · 大気 ${formatUpdateLabel(airUpdatedAt)}`
                      : `KMA ${formatUpdateLabel(weatherUpdatedAt)} · Air ${formatUpdateLabel(airUpdatedAt)}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
