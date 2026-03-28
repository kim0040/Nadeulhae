"use client"

import { useEffect, useState } from "react"
import {
  CalendarClock,
  Database,
  MapPinned,
  Route,
  Waves,
} from "lucide-react"

import { useLanguage } from "@/context/LanguageContext"
import { dataService, type WeatherData } from "@/services/dataService"
import { mockWeatherData } from "@/data/mockData"
import { Particles } from "@/components/magicui/particles"
import { WordPullUp } from "@/components/magicui/word-pull-up"
import { BorderBeam } from "@/components/magicui/border-beam"
import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text"
import { PicnicBriefing } from "@/components/picnic-briefing"
import { PicnicCalendar } from "@/components/picnic-calendar"

const liveCards = [
  { icon: Waves, key: "live-weather" },
  { icon: MapPinned, key: "place-db" },
  { icon: Route, key: "ai-course" },
]

const devSteps = [
  "01",
  "02",
  "03",
  "04",
  "05",
]

const JEONJU_COORDS = {
  lat: 35.8242,
  lon: 127.148,
}

export default function JeonjuPage() {
  const { language } = useLanguage()
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)

  useEffect(() => {
    const loadJeonjuData = async () => {
      try {
        const data = await dataService.getWeatherData(JEONJU_COORDS.lat, JEONJU_COORDS.lon)
        setWeatherData(data)
      } catch (error) {
        console.error("Failed to load Jeonju data:", error)
        setWeatherData(mockWeatherData)
      }
    }
    loadJeonjuData()
  }, [])

  const texts = {
    heroTag: language === "ko" ? "전주 특화 서비스" : "Jeonju Special Service",
    heroTitle: language === "ko" ? "전주를 위한 데이터 중심 나들이 실험실" : "A Jeonju-first outdoor planning lab",
    heroDesc: language === "ko"
      ? "나들해의 고향, 전주를 위한 데이터 기반 나들이 실험실입니다. 현재 동작하는 실시간 환경 분석 기능을 시작으로, 향후 백엔드 및 공간 DB 통합을 통해 전주만의 정밀한 로컬 경험을 완성해 나갈 예정입니다."
      : "A data-driven outdoor lab dedicated to Nadeulhae's hometown, Jeonju. Starting with our active real-time environmental analysis, we are building toward a precision local experience powered by upcoming backend and spatial database integrations.",
    liveTitle: language === "ko" ? "지금 가능한 전주 기능" : "What is already live for Jeonju",
    liveDesc: language === "ko"
      ? "현재는 전주 기준 실시간 점수, 브리핑, 예보 캘린더까지 동작합니다."
      : "Right now, Jeonju already has a live score, briefing, and forecast calendar.",
    futureTitle: language === "ko" ? "추후 열릴 전주 전용 기능" : "Jeonju features opening later",
    futureDesc: language === "ko"
      ? "전주만의 깊이 있는 경험을 위해, 서버 시스템과 데이터베이스 구축 단계에 맞춰 다음 기능들을 순차적으로 선보일 예정입니다."
      : "To provide a deeper Jeonju experience, we will sequentially roll out the following features as we complete our server-side and database architecture.",
    pipelineTitle: language === "ko" ? "개발 순서와 데이터 흐름" : "Development sequence and data flow",
    pipelineDesc: language === "ko"
      ? "나들해의 진화는 단순히 화면을 늘리는 것이 아닙니다. 데이터 수집부터 체계적인 저장, 서버 처리, 그리고 AI 생성에 이르는 철저한 데이터 파이프라인을 구축해 나갑니다."
      : "Nadeulhae's evolution is more than just UI. We are building a robust data pipeline that encompasses everything from collection and structured storage to server-side processing and AI generation.",
    openLater: language === "ko" ? "추후 오픈" : "Opens Later",
    calendarTitle: language === "ko" ? "전주 기준 피크닉 캘린더" : "Jeonju Picnic Calendar",
    calendarDesc: language === "ko"
      ? "이 페이지에서는 위치 추적 없이 항상 전주 기준 예보와 점수를 보여줍니다."
      : "This page always shows Jeonju-based forecast and scoring without geolocation.",
  }

  const liveContent = [
    {
      title: language === "ko" ? "실시간 전주 점수" : "Live Jeonju score",
      desc: language === "ko"
        ? "기상청·에어코리아·기상통보문 데이터를 모아 전주 기준 피크닉 점수를 계산합니다."
        : "Combines KMA, AirKorea, and weather bulletin data to compute Jeonju's picnic score.",
    },
    {
      title: language === "ko" ? "전주 예보 캘린더" : "Jeonju forecast calendar",
      desc: language === "ko"
        ? "전주 10일 예보를 강수확률과 야외 팁 중심으로 읽을 수 있습니다."
        : "Reads Jeonju's 10-day forecast with rain chance and outdoor tips.",
    },
    {
      title: language === "ko" ? "로컬 fallback 경험" : "Local fallback experience",
      desc: language === "ko"
        ? "위치 권한이 없거나 대기 응답이 비정상이면 전주 홈 기준 화면으로 안전하게 대체합니다."
        : "If location is unavailable or air data is unstable, the service safely falls back to Jeonju home mode.",
    },
  ]

  const futureContent = [
    {
      icon: Database,
      title: language === "ko" ? "과거 날씨 통계 DB" : "Historical weather DB",
      desc: language === "ko"
        ? "수년치 전주 기상 데이터, 평균값, 월별/요일별 통계를 적재해 과거 아카이브와 인사이트를 엽니다."
        : "Stores Jeonju's multi-year weather history, averages, and weekday/monthly stats for archive and insight views.",
    },
    {
      icon: MapPinned,
      title: language === "ko" ? "전주 장소 DB" : "Jeonju place DB",
      desc: language === "ko"
        ? "음식점, 카페, 야외 스팟을 실내/야외 유형과 위치 태그까지 가공해 반나절 코스 추천에 연결합니다."
        : "Builds restaurants, cafes, and outdoor spots with indoor/outdoor types and location tags for routing.",
    },
    {
      icon: Route,
      title: language === "ko" ? "AI 반나절 코스" : "AI half-day course",
      desc: language === "ko"
        ? "시간대별 날씨 흐름과 장소 DB를 묶어 야외에서 실내로 이어지는 전주 맞춤 동선을 생성합니다."
        : "Combines time-based weather flow and the place DB to generate Jeonju-specific half-day routes.",
    },
  ]

  const stepContent = [
    {
      title: language === "ko" ? "기획 구체화 및 DB 설계" : "Planning and DB design",
      desc: language === "ko"
        ? "날씨 테이블, 장소 테이블, API 키 점검, 전주 스팟 초기 데이터 정리를 먼저 합니다."
        : "Start with weather tables, place tables, API key checks, and seed data for Jeonju spots.",
    },
    {
      title: language === "ko" ? "데이터 수집 파이프라인" : "Data collection pipeline",
      desc: language === "ko"
        ? "배치와 스케줄러로 기상 데이터와 실시간 예보를 DB와 캐시에 채웁니다."
        : "Use batch jobs and schedulers to populate the DB and cache with historical and live weather.",
    },
    {
      title: language === "ko" ? "기본 API 및 화면 연동" : "Base API and UI integration",
      desc: language === "ko"
        ? "피크닉 점수와 통계 데이터를 API로 내려주고 UI와 연결합니다."
        : "Expose picnic score and statistics APIs, then connect them to the UI.",
    },
    {
      title: language === "ko" ? "시간대별 날씨-장소 매칭" : "Time-based weather-place matching",
      desc: language === "ko"
        ? "비가 오기 전 야외, 바람이 강해진 뒤 실내처럼 룰 기반 1차 매칭을 수행합니다."
        : "Do first-pass rule matching such as outdoors before rain, indoors after strong winds.",
    },
    {
      title: language === "ko" ? "RAG 기반 LLM 고도화" : "RAG-based LLM layer",
      desc: language === "ko"
        ? "정리된 날씨/장소 데이터를 바탕으로 자연스러운 전주 반나절 코스 문장을 생성합니다."
        : "Generate natural Jeonju half-day course text from structured weather and place data.",
    },
  ]

  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <section className="relative overflow-hidden px-4 pt-36 pb-20">
        <Particles className="absolute inset-0 z-0 opacity-60" quantity={48} color="#2f6fe4" />
        <div className="relative z-10 container mx-auto max-w-6xl">
          <div className="rounded-full border border-nature-green/20 bg-nature-green/10 px-5 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-nature-green inline-flex">
            {texts.heroTag}
          </div>
          <WordPullUp
            words={texts.heroTitle}
            className="mt-8 text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-foreground"
          />
          <p className="mt-8 max-w-4xl text-base sm:text-xl font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400">
            {texts.heroDesc}
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20">
        <div className="mb-8 max-w-3xl">
          <AnimatedGradientText className="text-3xl sm:text-5xl font-black tracking-tight">
            {texts.liveTitle}
          </AnimatedGradientText>
          <p className="mt-4 text-base sm:text-lg font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400">
            {texts.liveDesc}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {liveCards.map((card, index) => (
            <div
              key={card.key}
              className="relative overflow-hidden rounded-[2.5rem] border border-card-border bg-card p-8 shadow-xl shadow-[0_24px_70px_-48px_rgba(47,111,228,0.45)]"
            >
              <BorderBeam size={220} duration={9} delay={index * 1.3} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-active-blue/8 to-transparent pointer-events-none" />
              <div className="relative z-10 min-w-0">
                <div className="inline-flex rounded-2xl border border-active-blue/20 bg-active-blue/10 p-4 text-active-blue">
                  <card.icon size={24} />
                </div>
                <div className="mt-6 text-[10px] font-black uppercase tracking-[0.26em] text-muted-foreground">
                  {language === "ko" ? "Live Layer" : "Live Layer"}
                </div>
                <h3 className="mt-3 text-2xl font-black tracking-tight text-foreground break-keep">{liveContent[index].title}</h3>
                <p className="mt-4 text-base sm:text-lg font-bold leading-relaxed text-neutral-900 dark:text-neutral-300 break-keep">
                  {liveContent[index].desc}
                </p>
                {weatherData && index === 0 && (
                  <div className="mt-6 rounded-[1.5rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {language === "ko" ? "현재 전주 점수" : "Current Jeonju score"}
                    </div>
                    <div className="mt-2 text-4xl font-black tracking-tight text-foreground">{weatherData.score}</div>
                    <div className="mt-2 text-xs font-bold text-muted-foreground break-keep">
                      {weatherData.metadata?.station} · {weatherData.details.temp}°C · {weatherData.details.dust}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {weatherData && (
        <section className="container mx-auto px-4 pb-20">
          <PicnicBriefing weatherData={weatherData} />
        </section>
      )}

      <section className="container mx-auto px-4 pb-20">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">{texts.calendarTitle}</h2>
          <p className="mt-4 text-base sm:text-lg font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400">
            {texts.calendarDesc}
          </p>
        </div>
        <PicnicCalendar useGeolocation={false} />
      </section>

      <section className="container mx-auto px-4 pb-20">
        <div className="mb-8 max-w-3xl">
          <AnimatedGradientText className="text-3xl sm:text-5xl font-black tracking-tight">
            {texts.futureTitle}
          </AnimatedGradientText>
          <p className="mt-4 text-base sm:text-lg font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400">
            {texts.futureDesc}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {futureContent.map((item) => (
            <div key={item.title} className="rounded-[2.5rem] border border-card-border bg-card p-8 shadow-xl shadow-[0_24px_70px_-48px_rgba(47,111,228,0.45)]">
              <div className="inline-flex rounded-2xl border border-nature-green/20 bg-nature-green/10 p-4 text-nature-green">
                <item.icon size={24} />
              </div>
              <div className="mt-6">
                <span className="inline-flex rounded-full border border-active-blue/20 bg-active-blue/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-active-blue">
                  {texts.openLater}
                </span>
                <h3 className="mt-4 text-2xl font-black tracking-tight text-foreground break-keep">{item.title}</h3>
              </div>
              <p className="mt-4 text-base sm:text-lg font-bold leading-relaxed text-neutral-900 dark:text-neutral-300 break-keep">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-28">
        <div className="rounded-[3rem] border border-card-border bg-card p-8 sm:p-12 shadow-[0_28px_80px_-50px_rgba(47,111,228,0.45)]">
          <div className="max-w-3xl mb-10">
            <AnimatedGradientText className="text-3xl sm:text-5xl font-black tracking-tight">
              {texts.pipelineTitle}
            </AnimatedGradientText>
            <p className="mt-4 text-base sm:text-lg font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">
              {texts.pipelineDesc}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {stepContent.map((step, index) => (
              <div key={step.title} className="rounded-[2rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5 min-w-0">
                <div className="text-sm font-black uppercase tracking-[0.24em] text-sky-blue">{devSteps[index]}</div>
                <h3 className="mt-3 text-xl sm:text-2xl font-black leading-tight text-foreground break-keep">{step.title}</h3>
                <p className="mt-3 text-base font-bold leading-relaxed text-neutral-900 dark:text-neutral-300 break-keep">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/statistics/calendar" className="inline-flex items-center gap-2 rounded-full border border-card-border bg-[var(--interactive)] px-5 py-3 text-sm font-black text-foreground">
              <CalendarClock size={16} />
              {language === "ko" ? "통계 달력 보기" : "Open Calendar"}
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
