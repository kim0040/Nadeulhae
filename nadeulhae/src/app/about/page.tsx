"use client"

import { useMemo } from "react"
import { 
  AlertTriangle,
  CloudSunIcon, 
  MapIcon, 
  CpuIcon, 
  SparklesIcon,
  SearchIcon,
  CodeIcon,
  Thermometer,
  Wind,
  Droplets,
  Navigation,
  Cloud,
  Zap,
  ShieldCheck,
  CloudRain,
  Database
} from "lucide-react"

import { Particles } from "@/components/magicui/particles"
import { WordPullUp } from "@/components/magicui/word-pull-up"
import { BentoGrid, BentoCard } from "@/components/magicui/bento-grid"
import { Marquee } from "@/components/magicui/marquee"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/context/LanguageContext"
import { BorderBeam } from "@/components/magicui/border-beam"
import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text"
import { CalendarClock, Route } from "lucide-react"
import { getParticleCount, shouldRunRichAnimation } from "@/lib/performance"

const features = [
  {
    nameKey: "about_feature_1_name",
    descKey: "about_feature_1_desc",
    className: "md:col-span-2",
    icon: CloudSunIcon,
    background: <div className="absolute inset-0 bg-gradient-to-br from-sky-blue/10 to-transparent" />,
    pending: false,
  },
  {
    nameKey: "about_feature_2_name",
    descKey: "about_feature_2_desc",
    className: "md:col-span-1",
    icon: SparklesIcon,
    background: <div className="absolute inset-0 bg-gradient-to-br from-active-blue/10 to-transparent" />,
    pending: false,
  },
  {
    nameKey: "about_feature_3_name",
    descKey: "about_feature_3_desc",
    className: "md:col-span-1",
    icon: MapIcon,
    background: <div className="absolute inset-0 bg-gradient-to-br from-teal-100/10 to-transparent" />,
    pending: false,
  },
  {
    nameKey: "about_feature_4_name",
    descKey: "about_feature_4_desc",
    className: "md:col-span-2",
    icon: CpuIcon,
    background: <div className="absolute inset-0 bg-gradient-to-br from-nature-green/10 to-transparent" />,
    pending: false,
  },
]

const contributors = [
  { id: "hm", icon: CpuIcon, roleKey: "con_hm_role", nameKey: "con_hm_name", descKey: "con_hm_desc" },
  { id: "es", icon: SearchIcon, roleKey: "con_es_role", nameKey: "con_es_name", descKey: "con_es_desc" },
  { id: "jh", icon: Database, roleKey: "con_jh_role", nameKey: "con_jh_name", descKey: "con_jh_desc" },
]

const livePipelineCards = [
  { icon: MapIcon, titleKey: "about_live_card_1_title", descKey: "about_live_card_1_desc" },
  { icon: ShieldCheck, titleKey: "about_live_card_2_title", descKey: "about_live_card_2_desc" },
  { icon: SparklesIcon, titleKey: "about_live_card_3_title", descKey: "about_live_card_3_desc" },
]

const structureCards = [
  { icon: MapIcon, titleKey: "about_structure_home_title", descKey: "about_structure_home_desc" },
  { icon: CloudRain, titleKey: "about_structure_calendar_title", descKey: "about_structure_calendar_desc" },
  { icon: SparklesIcon, titleKey: "about_structure_jeonju_title", descKey: "about_structure_jeonju_desc" },
  { icon: Database, titleKey: "about_structure_future_title", descKey: "about_structure_future_desc" },
]

const algorithmCards = [
  { icon: AlertTriangle, titleKey: "about_algo_knockout_title", descKey: "about_algo_knockout_desc" },
  { icon: Cloud, titleKey: "about_algo_air_title", descKey: "about_algo_air_desc" },
  { icon: Thermometer, titleKey: "about_algo_temp_title", descKey: "about_algo_temp_desc" },
  { icon: CloudSunIcon, titleKey: "about_algo_sky_title", descKey: "about_algo_sky_desc" },
  { icon: Wind, titleKey: "about_algo_wind_title", descKey: "about_algo_wind_desc" },
  { icon: Database, titleKey: "about_algo_data_title", descKey: "about_algo_data_desc" },
]

export default function AboutPage() {
  const { resolvedTheme } = useTheme()
  const { t, language } = useLanguage()
  const particleColor = resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"
  const particleQuantity = useMemo(() => getParticleCount(30), [])
  const enableAnimations = useMemo(() => shouldRunRichAnimation(), [])

  const devSteps = ["01", "02", "03", "04", "05"]
  
  const futureContent = [
    {
      icon: Database,
      title: language === "ko" ? "과거 날씨 통계 DB" : "Historical weather DB",
      desc: language === "ko"
        ? "수년치 전주 기상 데이터, 평균값, 월별/요일별 통계를 적재해 과거 아카이브와 인사이트를 엽니다."
        : "Stores Jeonju's multi-year weather history, averages, and weekday/monthly stats for archive and insight views.",
    },
    {
      icon: MapIcon,
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

  const texts = {
    futureTitle: language === "ko" ? "추후 열릴 전주 전용 기능" : "Jeonju features opening later",
    futureDesc: language === "ko"
      ? "전주만의 깊이 있는 경험을 위해, 서버 시스템과 데이터베이스 구축 단계에 맞춰 다음 기능들을 순차적으로 선보일 예정입니다."
      : "To provide a deeper Jeonju experience, we will sequentially roll out the following features as we complete our server-side and database architecture.",
    pipelineTitle: language === "ko" ? "개발 순서와 데이터 흐름" : "Development sequence and data flow",
    pipelineDesc: language === "ko"
      ? "나들해의 진화는 단순히 화면을 늘리는 것이 아닙니다. 데이터 수집부터 체계적인 저장, 서버 처리, 그리고 AI 생성에 이르는 철저한 데이터 파이프라인을 구축해 나갑니다."
      : "Nadeulhae's evolution is more than just UI. We are building a robust data pipeline that encompasses everything from collection and structured storage to server-side processing and AI generation.",
    openLater: language === "ko" ? "추후 오픈" : "Opens Later",
    liveTitle: language === "ko" ? "지금 가능한 전주 기능" : "What is already live for Jeonju",
    liveDesc: language === "ko"
      ? "현재는 전주 기준 실시간 점수, 브리핑, 예보 캘린더까지 동작합니다."
      : "Right now, Jeonju already has a live score, briefing, and forecast calendar.",
  }

  const liveContent = [
    {
      icon: SparklesIcon,
      title: language === "ko" ? "실시간 전주 점수" : "Live Jeonju score",
      desc: language === "ko"
        ? "기상청·에어코리아·기상통보문 데이터를 모아 전주 기준 피크닉 점수를 계산합니다."
        : "Combines KMA, AirKorea, and weather bulletin data to compute Jeonju's picnic score.",
    },
    {
      icon: Route,
      title: language === "ko" ? "전주 고정 브리핑·캘린더" : "Jeonju-fixed briefing and calendar",
      desc: language === "ko"
        ? "나들이 브리핑과 10일 예보 캘린더를 모두 위치 추적 없이 전주 기준으로만 보여줍니다."
        : "Shows both the outing briefing and the 10-day forecast calendar strictly in Jeonju mode, without geolocation.",
    },
    {
      icon: ShieldCheck,
      title: language === "ko" ? "로컬 fallback 경험" : "Local fallback experience",
      desc: language === "ko"
        ? "위치 권한이 없거나 대기 응답이 비정상이면 전주 홈 기준 화면으로 안전하게 대체합니다."
        : "If location is unavailable or air data is unstable, the service safely falls back to Jeonju home mode.",
    },
  ]

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative px-4 pb-20 pt-24 text-center overflow-hidden sm:pt-28">
        {particleQuantity > 0 ? (
          <Particles
            className="absolute inset-0 z-0"
            quantity={particleQuantity}
            color={particleColor}
          />
        ) : null}
        <div className="relative z-10 max-w-4xl mx-auto">
          <span className="px-6 py-2 rounded-full bg-sky-blue/10 text-sky-blue text-[10px] font-black uppercase tracking-[0.3em] mb-8 inline-block border border-sky-blue/20">
            {t("about_hero_tag")}
          </span>
          <WordPullUp
            words={t("about_hero_title")}
            className="text-5xl md:text-7xl font-black mb-10 leading-tight tracking-tighter"
          />
          <p className="text-neutral-800 dark:text-neutral-400 text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed font-semibold">
            {t("about_hero_desc")}
          </p>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-24 relative overflow-hidden">
        <Marquee pauseOnHover className="[--duration:40s]">
          {[
            "Next.js 16", "React 19+", "TypeScript", "Tailwind CSS", 
            "Prisma ORM", "MySQL", "Lucide Icons", "Magic UI", 
            "Framer Motion", "Shadcn UI", "Vultr", "i18n"
          ].map((tech, i) => (
            <div key={i} className="mx-16 flex items-center gap-4 group">
              <CodeIcon size={24} className="text-sky-blue opacity-50 group-hover:opacity-100 transition-opacity" />
              <span className="text-3xl font-black text-neutral-400 dark:text-neutral-700 group-hover:text-foreground transition-colors tracking-tighter italic">
                {tech}
              </span>
            </div>
          ))}
        </Marquee>
      </section>

      {/* Feature Section */}
      <section id="features" className="container mx-auto py-32 px-4">
        <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
          <div className="max-w-xl">
            <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">{t("about_features_title")}</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-xl font-medium">
              {t("about_features_desc")}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sky-blue font-black text-xs bg-sky-blue/10 px-6 py-3 rounded-full border border-sky-blue/20 shadow-lg shadow-sky-blue/5">
            <SparklesIcon size={18} /> {t("about_data_driven")}
          </div>
        </div>

        <BentoGrid className="gap-4 sm:gap-8">
          {features.map((feature, i) => (
            <div key={i} className="relative group">
              <BentoCard 
                {...feature} 
                name={t(feature.nameKey)}
                description={t(feature.descKey)}
                Icon={feature.icon as any} 
                href={feature.pending ? "#" : "#guide"} 
                cta={feature.pending ? t("about_status_pending") : t("about_feature_cta")} 
                className={cn(
                  feature.className, 
                  "rounded-[2.5rem] border-sky-blue/5 dark:border-white/5 shadow-2xl transition-all hover:scale-[1.01] hover:shadow-sky-blue/5",
                  feature.pending && "opacity-80 grayscale-[0.3]"
                )} 
              />
              {feature.pending && (
                <div className="absolute top-8 right-8 z-20">
                  <span className="px-4 py-1.5 rounded-full bg-active-blue/10 text-active-blue border border-active-blue/20 text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                    {t("about_status_pending")}
                  </span>
                </div>
              )}
            </div>
          ))}
        </BentoGrid>
      </section>

      <section className="container mx-auto py-24 px-4">
        <div className="max-w-4xl mx-auto text-center mb-14">
          <AnimatedGradientText className="text-4xl md:text-5xl font-black tracking-tight">
            {t("about_algo_title")}
          </AnimatedGradientText>
          <p className="mt-6 text-neutral-500 dark:text-neutral-400 text-xl font-medium leading-relaxed">
            {t("about_algo_desc")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {algorithmCards.map((card, index) => (
            <div
              key={card.titleKey}
              className="relative overflow-hidden rounded-[2.5rem] border border-card-border bg-card p-8 sm:p-10 shadow-xl shadow-[0_22px_70px_-48px_rgba(47,111,228,0.45)]"
            >
              {enableAnimations ? (
                <BorderBeam
                  size={240}
                  duration={8}
                  delay={index * 1.1}
                  colorFrom="var(--beam-from)"
                  colorTo="var(--beam-to)"
                />
              ) : null}
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-sky-blue/8 to-transparent pointer-events-none" />
              <div className="relative z-10 min-w-0">
                <div className="inline-flex rounded-2xl border border-sky-blue/20 bg-sky-blue/10 p-4 text-sky-blue">
                  <card.icon size={24} />
                </div>
                <h3 className="mt-6 text-2xl font-black tracking-tight text-foreground break-keep break-all">
                  {t(card.titleKey)}
                </h3>
                <p className="mt-4 text-sm sm:text-base font-semibold leading-relaxed text-neutral-900 dark:text-neutral-300 break-keep break-all">
                  {t(card.descKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto py-24 px-4">
        <div className="max-w-4xl mx-auto text-center mb-14">
          <AnimatedGradientText className="text-4xl md:text-5xl font-black tracking-tight">
            {t("about_live_title")}
          </AnimatedGradientText>
          <p className="text-neutral-500 dark:text-neutral-400 text-xl font-medium leading-relaxed">
            {t("about_live_desc")}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {livePipelineCards.map((card) => (
            <div
              key={card.titleKey}
              className="rounded-[2.5rem] border border-card-border bg-card p-8 sm:p-10 shadow-[0_18px_42px_-32px_rgba(47,111,228,0.18)]"
            >
              <div className="min-w-0">
                <div className="mb-6 inline-flex rounded-2xl border border-nature-green/20 bg-nature-green/10 p-4 text-nature-green">
                  <card.icon size={26} />
                </div>
                <h3 className="text-2xl font-black text-foreground tracking-tight mb-4">
                  {t(card.titleKey)}
                </h3>
                <p className="text-sm sm:text-base font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400">
                  {t(card.descKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto py-24 px-4">
        <div className="max-w-4xl mx-auto text-center mb-14">
          <AnimatedGradientText className="text-4xl md:text-5xl font-black tracking-tight">
            {t("about_structure_title")}
          </AnimatedGradientText>
          <p className="text-neutral-500 dark:text-neutral-400 text-xl font-medium leading-relaxed">
            {t("about_structure_desc")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {structureCards.map((card) => (
            <div
              key={card.titleKey}
              className="rounded-[2.5rem] border border-card-border bg-card p-8 sm:p-10 shadow-[0_18px_42px_-32px_rgba(47,111,228,0.18)]"
            >
              <div className="min-w-0">
                <div className="mb-6 inline-flex rounded-2xl border border-sky-blue/20 bg-sky-blue/10 p-4 text-sky-blue">
                  <card.icon size={26} />
                </div>
                <h3 className="text-2xl font-black text-foreground tracking-tight mb-4 break-keep break-all">
                  {t(card.titleKey)}
                </h3>
                <p className="text-sm sm:text-base font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400 break-keep break-all">
                  {t(card.descKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Environmental Metric Guide */}
      <section id="guide" className="container mx-auto py-20 px-4">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <AnimatedGradientText className="text-3xl md:text-5xl font-black tracking-tight">
            {t("guide_title")}
          </AnimatedGradientText>
          <p className="mt-4 text-base sm:text-lg text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed">
            {t("guide_desc")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 max-w-5xl mx-auto">
          {[
            { tag: "guide_temp", icon: Thermometer },
            { tag: "guide_humi", icon: Droplets },
            { tag: "guide_wind", icon: Wind },
            { tag: "guide_vec", icon: Navigation },
            { tag: "guide_pm10", icon: Cloud },
            { tag: "guide_pm25", icon: SparklesIcon },
            { tag: "guide_o3", icon: Zap },
            { tag: "guide_no2", icon: Zap },
            { tag: "guide_khai", icon: ShieldCheck },
            { tag: "guide_rn1", icon: CloudRain },
          ].map((item, i) => (
            <div
              key={i}
              className="rounded-[1.75rem] border border-card-border bg-card px-5 py-5 shadow-[0_18px_42px_-32px_rgba(47,111,228,0.18)]"
            >
              <div className="flex items-start gap-4">
                <div className="mt-1 shrink-0 rounded-2xl border border-sky-blue/20 bg-sky-blue/10 p-3 text-sky-blue">
                  <item.icon size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-black text-foreground break-all">
                    {t(`${item.tag}_t`)}
                  </h3>
                  <p className="mt-2 text-sm sm:text-[15px] leading-relaxed font-semibold text-neutral-800 dark:text-neutral-400 break-all">
                    {t(`${item.tag}_d`)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20 pt-10">
        <div className="mb-8 max-w-4xl mx-auto text-center">
          <AnimatedGradientText className="text-4xl md:text-5xl font-black tracking-tight">
            {texts.liveTitle}
          </AnimatedGradientText>
          <p className="mt-4 text-base sm:text-lg font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400">
            {texts.liveDesc}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 max-w-6xl mx-auto">
          {liveContent.map((item) => (
            <div key={item.title} className="rounded-[2.5rem] border border-card-border bg-card p-8 shadow-[0_18px_42px_-32px_rgba(47,111,228,0.18)]">
              <div className="inline-flex rounded-2xl border border-sky-blue/20 bg-sky-blue/10 p-4 text-sky-blue">
                <item.icon size={24} />
              </div>
              <h3 className="mt-6 text-2xl font-black tracking-tight text-foreground break-keep break-all">{item.title}</h3>
              <p className="mt-4 text-sm sm:text-base font-bold leading-relaxed text-neutral-800 dark:text-neutral-400 break-keep break-all">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20 pt-10">
        <div className="mb-8 max-w-4xl mx-auto text-center">
          <AnimatedGradientText className="text-4xl md:text-5xl font-black tracking-tight">
            {texts.futureTitle}
          </AnimatedGradientText>
          <p className="mt-4 text-base sm:text-lg font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400">
            {texts.futureDesc}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 max-w-6xl mx-auto">
          {futureContent.map((item) => (
            <div key={item.title} className="rounded-[2.5rem] border border-card-border bg-card p-8 shadow-[0_18px_42px_-32px_rgba(47,111,228,0.18)]">
              <div className="inline-flex rounded-2xl border border-nature-green/20 bg-nature-green/10 p-4 text-nature-green">
                <item.icon size={24} />
              </div>
              <div className="mt-6">
                <span className="inline-flex rounded-full border border-active-blue/20 bg-active-blue/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-active-blue">
                  {texts.openLater}
                </span>
                <h3 className="mt-4 text-2xl font-black tracking-tight text-foreground break-keep break-all">{item.title}</h3>
              </div>
              <p className="mt-4 text-sm sm:text-base font-bold leading-relaxed text-neutral-800 dark:text-neutral-400 break-keep break-all">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-28">
        <div className="rounded-[3rem] border border-card-border bg-card p-8 sm:p-12 shadow-[0_28px_80px_-50px_rgba(47,111,228,0.45)] max-w-6xl mx-auto">
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
                <h3 className="mt-3 text-xl sm:text-2xl font-black leading-tight text-foreground break-keep break-all">{step.title}</h3>
                <p className="mt-3 text-base font-bold leading-relaxed text-neutral-900 dark:text-neutral-300 break-keep break-all">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/statistics/calendar" className="inline-flex items-center gap-2 rounded-full border border-card-border bg-[var(--interactive)] px-5 py-3 text-sm font-black text-foreground transition-colors hover:bg-[var(--interactive-border)]">
              <CalendarClock size={16} />
              {language === "ko" ? "통계 달력 보기" : "Open Calendar"}
            </a>
          </div>
        </div>
      </section>

      {/* Contributors Section */}
      <section id="contributors" className="container mx-auto py-32 px-4 border-y border-sky-blue/10 dark:border-white/5 relative overflow-hidden">
        <div className="hidden xl:block absolute top-0 right-0 px-8 py-2 bg-sky-blue/10 border-l border-b border-sky-blue/20 rounded-bl-3xl text-[10px] font-black uppercase tracking-[0.3em] text-sky-blue">
          The Engineering Team
        </div>
        
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">{t("about_contributors_title")}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-xl font-medium max-w-3xl mx-auto">
            {t("about_contributors_desc")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 sm:gap-12 max-w-6xl mx-auto">
          {contributors.map((person, i) => (
            <div
              key={i}
              className={cn(
                "group relative h-full overflow-hidden rounded-[3rem] sm:rounded-[4rem] border border-card-border bg-card shadow-[0_24px_70px_-48px_rgba(47,111,228,0.22)] transition-transform duration-300 hover:-translate-y-1",
                i === contributors.length - 1 && "md:col-span-2 md:mx-auto md:max-w-[34rem] xl:col-span-1 xl:max-w-none"
              )}
            >
              {enableAnimations ? (
                <BorderBeam
                  size={320}
                  duration={10}
                  delay={i * 1.5}
                  colorFrom="var(--beam-from)"
                  colorTo="var(--beam-to)"
                  borderWidth={1.5}
                />
              ) : null}
              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-sky-blue/8 to-transparent pointer-events-none" />

              <div className="relative z-10 flex h-full w-full flex-col items-center justify-between p-8 sm:p-14">
                <div className="flex w-full flex-col items-center">
                  <div className="mb-10 flex size-28 sm:size-36 items-center justify-center rounded-[2.5rem] sm:rounded-[3rem] border border-sky-blue/15 bg-[var(--interactive)] text-sky-blue shadow-[inset_0_4px_10px_rgba(0,0,0,0.04)] transition-all duration-300 group-hover:border-sky-blue/30 group-hover:bg-sky-blue/10">
                    <person.icon size={48} className="sm:size-16 transition-transform duration-300 group-hover:scale-105" strokeWidth={1.25} />
                  </div>

                  <h3 className="mb-4 text-center text-3xl sm:text-4xl font-black tracking-tighter text-foreground transition-colors group-hover:text-sky-blue">
                    {t(person.nameKey)}
                  </h3>

                  <div className="mb-8 flex flex-col items-center gap-2">
                    <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-red-600 sm:text-xs dark:text-red-400 dark:bg-red-500/20 dark:border-red-500/30">
                      {t("con_university")}
                    </span>
                    <span className="mt-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                      {t("con_department")}
                    </span>
                  </div>

                  <div className="mb-8 h-1.5 w-14 rounded-full bg-sky-blue/20 transition-all duration-300 group-hover:w-20 group-hover:bg-sky-blue/50" />

                  <p className="px-4 text-center text-sm sm:text-base font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400">
                    {t(person.descKey)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
