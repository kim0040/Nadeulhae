"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { MagicCard } from "@/components/ui/magic-card"

interface Props {
  weatherData: any
  language: string
}

export function OutlookBanner({ weatherData, language }: Props) {
  const [outlook, setOutlook] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const d = weatherData?.details
    const region = weatherData?.metadata?.region || ""
    if (!d || !region) return

    const fetchOutlook = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          locale: language,
          temp: String(d.temp ?? 0),
          humidity: String(d.humidity ?? 0),
          wind: String(d.wind ?? 0),
          sky: d.sky || "",
          pty: String(d.pty ?? 0),
          pm10: String(d.pm10 ?? 0),
          pm25: String(d.pm25 ?? 0),
          khai: String(d.khai ?? 0),
          score: String(weatherData.score),
          status: weatherData.status || "",
          region,
          isRain: String(weatherData.eventData?.isRain ?? false),
          hasWarning: String(weatherData.eventData?.isWeatherWarning ?? false),
          bulletinSummary: weatherData.bulletin?.summary || "",
        })
        const res = await fetch(`/api/weather/outlook?${params}`)
        const json = await res.json()
        if (json.outlook) setOutlook(json.outlook)
      } catch {
        // Silently fail - the static briefing is shown below
      } finally {
        setLoading(false)
      }
    }

    fetchOutlook()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherData.score, language])

  if (!outlook && !loading) return null

  return (
    <MagicCard className="my-6 rounded-[2rem]" gradientSize={180} gradientOpacity={0.5}>
      <div className="rounded-[inherit] border border-sky-blue/10 bg-card/90 p-4 sm:p-6 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-4 text-sky-blue" />
          <span className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-blue">
            {language === "ko" ? "나들AI 종합 안내" : language === "zh" ? "나들AI 综合指南" : language === "ja" ? "나들AI 総合ガイド" : "Nadeul AI Outlook"}
          </span>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground animate-pulse">
            {language === "ko" ? "AI가 날씨를 분석하고 있습니다..." : language === "zh" ? "AI正在分析天气..." : language === "ja" ? "AIが天気を分析中..." : "AI is analyzing the weather..."}
          </p>
        ) : (
          <p className="text-sm sm:text-base font-medium leading-relaxed text-foreground/85">
            {outlook}
          </p>
        )}
      </div>
    </MagicCard>
  )
}
