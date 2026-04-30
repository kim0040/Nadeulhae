"use client"

import { useEffect, useMemo, useState } from "react"
import { useTheme } from "next-themes"

import { useLanguage } from "@/context/LanguageContext"
import { dataService, type FireSummaryData, type WeatherData } from "@/services/dataService"
import { mockWeatherData } from "@/data/mockData"
import { Particles } from "@/components/magicui/particles"
import { WordPullUp } from "@/components/magicui/word-pull-up"
import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text"
import { Marquee } from "@/components/magicui/marquee"
import { PicnicBriefing } from "@/components/picnic-briefing"
import { PicnicCalendar } from "@/components/picnic-calendar"
import { JeonjuSafetyPanel } from "@/components/jeonju-safety-panel"
import { JeonjuChatPanel } from "@/components/jeonju-chat-panel"
import { JeonjuDailyBriefing } from "@/components/jeonju-daily-briefing"
import { getParticleCount } from "@/lib/performance"




const JEONJU_COORDS = {
  lat: 35.8242,
  lon: 127.148,
}

export default function JeonjuPage() {
  const { language } = useLanguage()
  const { resolvedTheme } = useTheme()
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [fireSummary, setFireSummary] = useState<FireSummaryData | null>(null)
  const particleColor = resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"
  const particleQuantity = useMemo(() => getParticleCount(24), [])

  useEffect(() => {
    const loadJeonjuData = async () => {
      try {
        const [data, fire] = await Promise.all([
          dataService.getWeatherData(JEONJU_COORDS.lat, JEONJU_COORDS.lon),
          dataService.getFireSummary({ regionKey: "jeonju" }),
        ])
        setWeatherData(data)
        setFireSummary(fire)
      } catch (error) {
        console.error("Failed to load Jeonju data:", error)
        setWeatherData(mockWeatherData)
      }
    }
    loadJeonjuData()
  }, [])

  const texts = useMemo(() => {
    const map: Record<string, { heroTag: string; heroTitle: string; heroDesc: string; fixedTitle: string; fixedDesc: string; marqueeTitle: string; yesterdayTitle: string; yesterdayDesc: string }> = {
      ko: {
        heroTag: "전주 특화 서비스",
        heroTitle: "전주를 위한 데이터 기반 나들이 실험실",
        heroDesc: "나들해의 고향, 전주를 위한 데이터 기반 나들이 실험실입니다. 실시간 환경 분석, 날씨 브리핑, 안전 패널, 그리고 매일 아침 나들AI가 정리하는 전주 소식까지, 전주만의 정밀한 로컬 경험을 제공합니다.",
        fixedTitle: "전주 고정 브리핑 & 피크닉 캘린더",
        fixedDesc: "이 구역의 나들이 브리핑과 10일 캘린더는 위치 추적 없이 항상 전주 기준으로만 계산하고 표시합니다.",
        marqueeTitle: "전주 사람들이 자주 찾는 장소",
        yesterdayTitle: "어제의 전주",
        yesterdayDesc: "나들AI가 어제의 전주 소식을 매일 아침 따뜻하게 브리핑해 드립니다.",
      },
      en: {
        heroTag: "Jeonju Special Service",
        heroTitle: "A Jeonju-first outdoor planning lab",
        heroDesc: "A data-driven outdoor lab dedicated to Nadeulhae's hometown, Jeonju. Featuring real-time environment analysis, weather briefings, safety panels, and daily Jeonju news curated by NadeulAI — a precision local experience crafted just for Jeonju.",
        fixedTitle: "Jeonju-fixed briefing & picnic calendar",
        fixedDesc: "The outing briefing and 10-day calendar in this section are always calculated and displayed for Jeonju only, without geolocation.",
        marqueeTitle: "Places locals in Jeonju often visit",
        yesterdayTitle: "Yesterday's Jeonju",
        yesterdayDesc: "NadeulAI delivers a warm morning briefing of yesterday's Jeonju news, every day.",
      },
      zh: {
        heroTag: "全州特色服务",
        heroTitle: "面向全州的数据驱动出行实验室",
        heroDesc: "这是为나들해的故乡全州打造的数据驱动出行实验室。提供实时环境分析、天气简报、安全面板，以及每天早晨由NadeulAI整理的全州新闻，带来专属于全州的精细化本地体验。",
        fixedTitle: "全州固定简报 & 野餐日历",
        fixedDesc: "本区域的出行简报和10天日历始终仅以全州为基准进行计算和显示，无需位置追踪。",
        marqueeTitle: "全州人常去的地方",
        yesterdayTitle: "昨日全州",
        yesterdayDesc: "NadeulAI每天早上为您温馨播报昨日的全州新闻。",
      },
      ja: {
        heroTag: "全州特化サービス",
        heroTitle: "全州のためのデータ駆動型お出かけラボ",
        heroDesc: "나들해の故郷、全州のためのデータ駆動型お出かけラボです。リアルタイム環境分析、天気ブリーフィング、安全パネル、そして毎朝NadeulAIがまとめる全州ニュースまで、全州だけの精密なローカル体験を提供します。",
        fixedTitle: "全州固定ブリーフィング & ピクニックカレンダー",
        fixedDesc: "このエリアのお出かけブリーフィングと10日間カレンダーは、位置追跡なしで常に全州基準のみで計算・表示します。",
        marqueeTitle: "全州の人々がよく訪れる場所",
        yesterdayTitle: "昨日の全州",
        yesterdayDesc: "NadeulAIが昨日の全州のニュースを毎朝暖かくブリーフィングします。",
      },
    }
    return map[language] ?? map.en
  }, [language])



  const jeonjuPlaces = useMemo(() => {
    const map: Record<string, string[]> = {
      ko: [
        "#전주한옥마을",
        "#경기전",
        "#덕진공원",
        "#전동성당",
        "#남부시장",
        "#객리단길",
        "#아중호수",
        "#오목대",
        "#풍남문",
        "#자만벽화마을",
        "#전주수목원",
        "#전주천",
        "#전주동물원",
        "#완산공원",
        "#한벽당",
        "#세병호",
        "#삼천변",
        "#한국도로공원",
        "#전라감영",
        "#조경단",
        "#금암동",
        "#서신동",
        "#효자동",
        "#송천동",
      ],
      en: [
        "#JeonjuHanokVillage",
        "#Gyeonggijeon",
        "#DeokjinPark",
        "#JeondongCathedral",
        "#NambuMarket",
        "#GaekridanGil",
        "#AjungLake",
        "#Omokdae",
        "#Pungnammun",
        "#JamanMuralVillage",
        "#JeonjuArboretum",
        "#JeonjuStream",
        "#JeonjuZoo",
        "#WansanPark",
        "#Hanbyeokdang",
        "#SebyeonghoLake",
        "#SamcheonRiverside",
        "#JeonjuHyanggyo",
        "#JeollaGamyeong",
        "#Jogyeongdan",
        "#GeumamDong",
        "#SeosinDong",
        "#HyojaDong",
        "#SongcheonDong",
      ],
      zh: [
        "#全州韩屋村",
        "#庆基殿",
        "#德津公园",
        "#殿洞圣堂",
        "#南部市场",
        "#客理团路",
        "#牙中湖",
        "#梧木台",
        "#豊南門",
        "#滋满壁画村",
        "#全州树木园",
        "#全州川",
        "#全州动物园",
        "#完山公园",
        "#寒碧堂",
        "#细碧湖",
        "#三川边",
        "#全州乡校",
        "#全罗监营",
        "#肇庆坛",
        "#金岩洞",
        "#西新洞",
        "#孝子洞",
        "#松川洞",
      ],
      ja: [
        "#全州韓屋村",
        "#慶基殿",
        "#徳津公園",
        "#殿洞聖堂",
        "#南部市場",
        "#客理団キル",
        "#牙中湖",
        "#梧木台",
        "#豊南門",
        "#滋満壁画村",
        "#全州樹木園",
        "#全州川",
        "#全州動物園",
        "#完山公園",
        "#寒碧堂",
        "#細碧湖",
        "#三川辺",
        "#全州郷校",
        "#全羅監営",
        "#肇慶壇",
        "#金岩洞",
        "#西新洞",
        "#孝子洞",
        "#松川洞",
      ],
    }
    return map[language] ?? map.en
  }, [language])

  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <section className="relative overflow-hidden px-4 pt-24 pb-20 sm:pt-28">
        {particleQuantity > 0 ? (
          <Particles className="absolute inset-0 z-0 opacity-60" quantity={particleQuantity} color={particleColor} />
        ) : null}
        <div className="relative z-10 container mx-auto max-w-6xl">
          <div className="mx-auto inline-flex rounded-full border border-nature-green/20 bg-nature-green/10 px-5 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-nature-green">
            {texts.heroTag}
          </div>
          <WordPullUp
            words={texts.heroTitle}
            className="mt-8 text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-foreground"
          />
          <p className="mx-auto mt-8 max-w-4xl text-center text-base sm:text-xl font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400">
            {texts.heroDesc}
          </p>
        </div>
      </section>

      <section className="py-14 relative overflow-hidden">
        <div className="container mx-auto max-w-6xl px-4 mb-6 text-center">
          <AnimatedGradientText
            className="text-base sm:text-xl font-black tracking-tight"
            colorFrom="#0b7d71"
            colorTo="#2f6fe4"
            speed={1.2}
          >
            {texts.marqueeTitle}
          </AnimatedGradientText>
        </div>
        <Marquee pauseOnHover className="[--duration:42s]">
          {jeonjuPlaces.map((place) => (
            <div key={place} className="mx-12 flex items-center justify-center group">
              <span className="text-2xl sm:text-3xl font-black text-neutral-400 dark:text-neutral-700 group-hover:text-foreground transition-colors tracking-tight italic text-center">
                {place}
              </span>
            </div>
          ))}
        </Marquee>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
              {texts.yesterdayTitle}
            </h2>
            <p className="mt-4 text-base sm:text-lg font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400">
              {texts.yesterdayDesc}
          </p>
        </div>
        <JeonjuDailyBriefing language={language} />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">{texts.fixedTitle}</h2>
          <p className="mt-4 text-base sm:text-lg font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400">
            {texts.fixedDesc}
          </p>
        </div>
        {weatherData && (
          <div className="pb-12">
            <PicnicBriefing weatherData={weatherData} />
          </div>
        )}
        <PicnicCalendar useGeolocation={false} />
      </section>

      {weatherData && (
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <JeonjuSafetyPanel weatherData={weatherData} fireSummary={fireSummary} language={language} />
        </section>
      )}


      {/* Jeonju Community Chat */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <JeonjuChatPanel />
      </section>
    </main>
  )
}
