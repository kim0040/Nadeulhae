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

  const texts = {
    heroTag: language === "ko" ? "전주 특화 서비스" : "Jeonju Special Service",
    heroTitle: language === "ko" ? "전주를 위한 데이터 기반 나들이 실험실" : "A Jeonju-first outdoor planning lab",
    heroDesc: language === "ko"
      ? "나들해의 고향, 전주를 위한 데이터 기반 나들이 실험실입니다. 현재 동작하는 실시간 환경 분석 기능을 시작으로, 향후 백엔드 및 공간 DB 통합을 통해 전주만의 정밀한 로컬 경험을 완성해 나갈 예정입니다."
      : "A data-driven outdoor lab dedicated to Nadeulhae's hometown, Jeonju. Starting with our active real-time environmental analysis, we are building toward a precision local experience powered by upcoming backend and spatial database integrations.",

    fixedTitle: language === "ko" ? "전주 고정 브리핑 & 피크닉 캘린더" : "Jeonju-fixed briefing & picnic calendar",
    fixedDesc: language === "ko"
      ? "이 구역의 나들이 브리핑과 10일 캘린더는 위치 추적 없이 항상 전주 기준으로만 계산하고 표시합니다."
      : "The outing briefing and 10-day calendar in this section are always calculated and displayed for Jeonju only, without geolocation.",

  }



  const jeonjuPlaces = language === "ko"
    ? [
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
      ]
    : [
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
      ]

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
            {language === "ko" ? "전주 사람들이 자주 찾는 장소" : "Places locals in Jeonju often visit"}
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
