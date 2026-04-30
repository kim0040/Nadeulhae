"use client"

import { AlertTriangle, Cloud, CloudRain, Orbit, Sparkles, Zap } from "lucide-react"
import Image from "next/image"

import { MagicCard } from "@/components/magicui/magic-card"
import { useLanguage } from "@/context/LanguageContext"
import type { WeatherData } from "@/services/dataService"

export type WeatherImageData = {
  radar: { name: string; tm: string; url: string } | null
  satellite: { name: string; tm: string; url: string } | null
  extras?: {
    dust?: { name: string; tm: string; url: string } | null
    lgt?: { name: string; tm: string; url: string } | null
    fog?: { name: string; tm: string; url: string } | null
    earthquake?: { name: string; tm: string; url: string } | null
    typhoon?: { name: string; tm: string; url: string } | null
    tsunami?: { name: string; tm: string; url: string } | null
    volcano?: { name: string; tm: string; url: string } | null
  }
  metadata?: {
    dataSource?: string
    cache?: {
      radarMinutes?: number
      satelliteMinutes?: number
    }
    fetchedAt?: {
      radar?: string
      satellite?: string
    }
  }
} | null

interface WeatherImagePanelProps {
  data: WeatherImageData
  weather?: Pick<WeatherData, "eventData" | "details" | "metadata">
}

function formatTm(tm: string | undefined) {
  if (!tm || tm.length < 12) return "--:--"
  return `${tm.slice(0, 4)}.${tm.slice(4, 6)}.${tm.slice(6, 8)} ${tm.slice(8, 10)}:${tm.slice(10, 12)}`
}

function ImageBlock({
  title,
  icon,
  image,
  emptyText,
  language,
}: {
  title: string
  icon: React.ReactNode
  image: { name: string; tm: string; url: string } | null
  emptyText: string
  language: string
}) {
  const localizedImageName = language === "ko"
    ? (image?.name || title)
    : title

  return (
    <div className="rounded-[1.75rem] border border-[var(--interactive-border)] bg-[var(--interactive)] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h4 className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">{title}</h4>
      </div>
      {image?.url ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Image
              src={image.url}
              alt={image.name || title}
              width={800}
              height={450}
              unoptimized
              className="h-[220px] w-full object-cover"
              loading="lazy"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          <p className="text-xs sm:text-sm font-semibold text-foreground/85 break-words">{localizedImageName}</p>
          <p className="text-[11px] font-bold text-muted-foreground">{formatTm(image.tm)}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm font-medium text-muted-foreground">
          {emptyText}
        </div>
      )}
    </div>
  )
}

export function WeatherImagePanel({ data, weather }: WeatherImagePanelProps) {
  const { language } = useLanguage()
  const __l = (ko: string, en: string, zh?: string, ja?: string) => {
    if (language === "ko") return ko
    if (language === "zh") return zh || en || ko
    if (language === "ja") return ja || en || ko
    return en || ko
  }

  const labels = (() => {
    if (language === "zh") return {
      title: "气象图像",
      subtitle: "气象厅预报·卫星最新图像",
      radar: "1小时降雨预测",
      satellite: "千里眼云图",
      empty: "暂无可用最新图像。",
      source: "来源",
      contextTitle: "状态监测",
      weatherWarning: "气象特报监测",
      earthquake: "地震通报监测",
      earthquakeEpicenter: "地震发生位置",
      rain: "降雨追踪",
      fog: "雾信号",
      dust: "沙尘探测",
      lgt: "闪电分布",
      typhoon: "台风监测",
      tsunami: "海啸监测",
      volcano: "火山监测",
    }
    if (language === "ja") return {
      title: "気象画像",
      subtitle: "気象庁予測·衛星ベースの最新画像",
      radar: "1時間降水予測",
      satellite: "千里眼雲強調",
      empty: "表示可能な最新画像がありません。",
      source: "ソース",
      contextTitle: "状況モニター",
      weatherWarning: "気象特報監視",
      earthquake: "地震通報監視",
      earthquakeEpicenter: "地震発生位置",
      rain: "降水追跡",
      fog: "霧信号",
      dust: "黄砂探知",
      lgt: "落雷分布",
      typhoon: "台風監視",
      tsunami: "津波監視",
      volcano: "火山監視",
    }
    if (language === "ko") return {
      title: "기상 이미지",
      subtitle: "기상청 예측·위성 기반 최신 이미지",
      radar: "1시간 강수 예측",
      satellite: "천리안 구름 강조",
      empty: "표시 가능한 최신 이미지가 없습니다.",
      source: "출처",
      contextTitle: "상황 모니터",
      weatherWarning: "기상특보 감시",
      earthquake: "지진 통보 감시",
      earthquakeEpicenter: "지진 발생 지점",
      rain: "강수 추적",
      fog: "안개 신호",
      dust: "황사 탐지",
      lgt: "낙뢰 분포",
      typhoon: "태풍 감시",
      tsunami: "지진해일 감시",
      volcano: "화산 감시",
    }
    return {
      title: "Weather Images",
      subtitle: "Latest KMA forecast and satellite imagery",
      radar: "1h Rain Forecast",
      satellite: "GK2A RGB Cloud",
      empty: "No latest image is available right now.",
      source: "Source",
      contextTitle: "Situation Monitor",
      weatherWarning: "Weather Warning",
      earthquake: "Earthquake Bulletin",
      earthquakeEpicenter: "Earthquake Epicenter",
      rain: "Precipitation Tracking",
      fog: "Fog Signal",
      dust: "Dust Detection",
      lgt: "Lightning",
      typhoon: "Typhoon",
      tsunami: "Tsunami",
      volcano: "Volcano",
    }
  })()

  const statusPills = [
    weather?.eventData?.isWeatherWarning
      ? { label: labels.weatherWarning, className: "border-red-500/25 bg-red-500/8 text-red-500 dark:text-red-300" }
      : null,
    weather?.eventData?.isEarthquake
      ? { label: labels.earthquake, className: "border-orange-500/25 bg-orange-500/8 text-orange-600 dark:text-orange-300" }
      : null,
    weather?.eventData?.isRain || ((weather?.details?.pty ?? 0) > 0)
      ? { label: labels.rain, className: "border-active-blue/25 bg-active-blue/8 text-active-blue" }
      : null,
    weather?.eventData?.isTyphoon
      ? { label: labels.typhoon, className: "border-red-500/25 bg-red-500/8 text-red-500 dark:text-red-300" }
      : null,
    weather?.eventData?.isTsunami
      ? { label: labels.tsunami, className: "border-orange-500/25 bg-orange-500/8 text-orange-600 dark:text-orange-300" }
      : null,
    weather?.eventData?.isVolcano
      ? { label: labels.volcano, className: "border-amber-500/25 bg-amber-500/8 text-amber-600 dark:text-amber-300" }
      : null,
  ].filter(Boolean) as Array<{ label: string; className: string }>

  const cards: Array<{
    key: string
    title: string
    icon: React.ReactNode
    image: { name: string; tm: string; url: string } | null
  }> = [
    {
      key: "radar",
      title: labels.radar,
      icon: <CloudRain size={16} className="text-active-blue" />,
      image: data?.radar || null,
    },
    {
      key: "satellite",
      title: labels.satellite,
      icon: <Orbit size={16} className="text-nature-green" />,
      image: data?.satellite || null,
    },
  ]

  if (data?.extras?.dust?.url) {
    cards.push({
      key: "dust",
      title: labels.dust,
      icon: <Sparkles size={16} className="text-orange-500" />,
      image: data.extras.dust,
    })
  }
  if (data?.extras?.fog?.url) {
    cards.push({
      key: "fog",
      title: labels.fog,
      icon: <Cloud size={16} className="text-neutral-500 dark:text-neutral-300" />,
      image: data.extras.fog,
    })
  }
  if (data?.extras?.lgt?.url) {
    cards.push({
      key: "lgt",
      title: labels.lgt,
      icon: <Zap size={16} className="text-yellow-500" />,
      image: data.extras.lgt,
    })
  }

  if (data?.extras?.typhoon?.url) {
    cards.push({
      key: "typhoon",
      title: labels.typhoon,
      icon: <AlertTriangle size={16} className="text-red-500" />,
      image: data.extras.typhoon,
    })
  }

  if (data?.extras?.tsunami?.url) {
    cards.push({
      key: "tsunami",
      title: labels.tsunami,
      icon: <AlertTriangle size={16} className="text-orange-500" />,
      image: data.extras.tsunami,
    })
  }

  if (data?.extras?.volcano?.url) {
    cards.push({
      key: "volcano",
      title: labels.volcano,
      icon: <AlertTriangle size={16} className="text-amber-500" />,
      image: data.extras.volcano,
    })
  }

  return (
    <section className="mt-8 w-full max-w-5xl mx-auto">
      <MagicCard
        className="rounded-[2.5rem] border border-card-border p-6 sm:p-8"
        gradientSize={260}
        gradientFrom="#0b7d71"
        gradientTo="#2f6fe4"
      >
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{labels.title}</h3>
            <p className="mt-2 text-sm sm:text-base font-medium text-muted-foreground">{labels.subtitle}</p>
          </div>
          <span className="text-[11px] font-black uppercase tracking-widest text-sky-blue">
            {labels.source}: {__l("기상청", "KMA")}
          </span>
        </div>

        {statusPills.length > 0 && (
          <div className="mb-6 rounded-[1.5rem] border border-[var(--interactive-border)] bg-[var(--interactive)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-sky-blue" />
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">
                {labels.contextTitle}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {statusPills.map((pill) => (
                <span
                  key={pill.label}
                  className={`rounded-full border px-3 py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-widest ${pill.className}`}
                >
                  {pill.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <ImageBlock
              key={card.key}
              title={card.title}
              icon={card.icon}
              image={card.image}
              emptyText={labels.empty}
              language={language}
            />
          ))}
        </div>
      </MagicCard>
    </section>
  )
}
