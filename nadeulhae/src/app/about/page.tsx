"use client"

/**
 * About Page — introduces the Nadeulhae service, its live capabilities, tech stack,
 * environmental metric guide, operating data flow, and project stewardship.
 * Fully i18n — supports ko/en/zh/ja via the shared LanguageContext.
 */

import Link from "next/link"
import { useCallback, useMemo } from "react"
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
  Database,
  Wrench
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

// ---- Static content data: feature cards, contributors, pipelines ----

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

// ---- Component ----

export default function AboutPage() {
  const { resolvedTheme } = useTheme()
  const { t, language } = useLanguage()
  const particleColor = resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"
  const particleQuantity = useMemo(() => getParticleCount(30), [])
  const enableAnimations = useMemo(() => shouldRunRichAnimation(), [])

  const serviceSteps = ["DATA", "CACHE", "ARCHIVE", "ROUTE", "AI"]

  /** Inline locale helper: returns the first match in priority order ko > zh > ja > en */
  const locale = useCallback((ko: string, en = ko, zh = en, ja = zh) => {
    if (language === "ko") return ko
    if (language === "zh") return zh
    if (language === "ja") return ja
    return en
  }, [language])
  
  const expandedContent = useMemo(() => [
    {
      icon: Database,
      title: locale("날씨 아카이브와 통계", "Weather archive and statistics", "天气档案与统计", "天気アーカイブと統計"),
      desc: locale(
        "실시간 예보 캘린더와 피크닉 아카이브를 함께 제공해, 날짜별 흐름과 기록을 한 화면에서 확인할 수 있습니다.",
        "Pairs the live forecast calendar with a picnic archive so date-by-date patterns and records stay visible in one place.",
        "结合实时预报日历与野餐档案，在一个页面中查看按日期变化的趋势和记录。",
        "リアルタイム予報カレンダーとピクニックアーカイブを組み合わせ、日付ごとの流れと記録を一画面で確認できます。"
      ),
    },
    {
      icon: MapIcon,
      title: locale("전주 장소 데이터와 길찾기", "Jeonju places and directions", "全州地点数据与路线", "全州スポットデータと経路"),
      desc: locale(
        "장소 데이터에 실내·야외 성격과 위치 정보를 연결하고, 선택한 장소 사이의 이동 경로까지 이어집니다.",
        "Connects place data with indoor/outdoor traits and location details, then continues into directions between chosen stops.",
        "将地点数据与室内/室外属性及位置信息连接，并提供所选地点之间的路线。",
        "スポットデータに屋内・屋外の特性と位置情報を結び、選んだ場所同士の経路までつなげます。"
      ),
    },
    {
      icon: Route,
      title: locale("AI 코스 생성·저장·공유", "AI course creation, saving, and sharing", "AI路线生成、保存与分享", "AIコースの生成・保存・共有"),
      desc: locale(
        "날씨 흐름과 장소 정보를 바탕으로 코스를 만들고, 내 코스로 저장하거나 링크로 공유할 수 있습니다.",
        "Builds courses from weather flow and place data, then lets you save them or share them by link.",
        "基于天气变化和地点信息生成路线，并可保存为我的路线或通过链接分享。",
        "天気の流れとスポット情報からコースを作り、自分のコースとして保存したりリンクで共有したりできます。"
      ),
    },
  ], [locale])

  const stepContent = useMemo(() => [
    {
      title: locale("공공 데이터 수집", "Public data collection", "公共数据采集", "公共データ収集"),
      desc: locale(
        "기상청·AirKorea·공식 통보 데이터를 서비스 목적에 맞는 입력으로 정리합니다.",
        "Normalizes KMA, AirKorea, and official bulletin data into service-ready inputs.",
        "将气象厅、AirKorea和官方通报数据整理为适合服务使用的输入。",
        "気象庁・AirKorea・公式通報のデータをサービスに合う入力として整えます。"
      ),
    },
    {
      title: locale("지역 판별과 캐시", "Region resolution and cache", "区域识别与缓存", "地域判定とキャッシュ"),
      desc: locale(
        "지역별 관측소·예보 권역을 연결하고, 같은 요청이 반복돼도 외부 API 호출을 절제합니다.",
        "Maps local stations and forecast zones while limiting duplicate external API calls through caching.",
        "连接各地区观测站与预报区域，并通过缓存限制重复的外部API调用。",
        "地域ごとの観測所・予報圏域を結び、キャッシュで重複する外部API呼び出しを抑えます。"
      ),
    },
    {
      title: locale("아카이브와 통계", "Archive and statistics", "档案与统计", "アーカイブと統計"),
      desc: locale(
        "실시간 예보와 날짜별 피크닉 기록을 캘린더·아카이브 화면에서 읽기 쉽게 보여줍니다.",
        "Makes live forecasts and date-level picnic records easy to read in calendar and archive views.",
        "在日历和档案页面中清晰展示实时预报与按日期记录的野餐指数。",
        "リアルタイム予報と日付ごとのピクニック記録をカレンダー・アーカイブ画面で読みやすく見せます。"
      ),
    },
    {
      title: locale("장소와 이동 경로", "Places and directions", "地点与路线", "スポットと経路"),
      desc: locale(
        "전주 장소 데이터에 위치·유형을 더하고, 선택한 목적지 사이 이동 정보를 코스와 연결합니다.",
        "Enriches Jeonju places with type and location data, then connects movement between stops to a course.",
        "为全州地点补充类型和位置信息，并将目的地之间的移动连接到路线中。",
        "全州スポットに種類と位置情報を加え、目的地間の移動をコースにつなげます。"
      ),
    },
    {
      title: locale("AI 코스와 저장", "AI courses and saving", "AI路线与保存", "AIコースと保存"),
      desc: locale(
        "AI가 만든 코스를 저장하고 공유 링크로 이어, 다음 방문 때도 다시 확인할 수 있게 합니다.",
        "Keeps AI-created courses available through saved records and shareable links for later visits.",
        "通过保存记录和可分享链接保留AI生成的路线，方便下次再次查看。",
        "AIが作ったコースを保存と共有リンクで残し、次の訪問時にも確認できるようにします。"
      ),
    },
  ], [locale])

  const texts = useMemo(() => ({
    expandedTitle: locale("현재 제공 중인 확장 기능", "Expanded features available now", "当前提供的扩展功能", "現在提供中の拡張機能"),
    expandedDesc: locale(
      "처음의 로드맵으로 소개했던 아카이브, 장소 데이터, AI 코스 기능은 현재 서비스 안에서 실제로 사용할 수 있습니다.",
      "The archive, place data, and AI course capabilities once shown on the roadmap are now available in the service.",
      "曾在路线图中介绍的档案、地点数据和AI路线功能现已在服务中可用。",
      "以前ロードマップとして紹介していたアーカイブ、スポットデータ、AIコース機能は現在サービス内で利用できます。"
    ),
    pipelineTitle: locale("현재 서비스 구성과 데이터 흐름", "Current service structure and data flow", "当前服务结构与数据流", "現在のサービス構成とデータフロー"),
    pipelineDesc: locale(
      "화면의 판단은 공공 데이터 수집, 지역별 정리와 캐시, 기록·장소 데이터, AI 코스 생성 순서로 이어집니다.",
      "Every on-screen decision connects public-data intake, regional normalization and caching, records and place data, and AI course generation.",
      "界面上的判断连接了公共数据采集、区域整理与缓存、记录和地点数据以及AI路线生成。",
      "画面上の判断は、公共データ収集、地域別の整理とキャッシュ、記録・スポットデータ、AIコース生成へとつながります。"
    ),
    availableNow: locale("현재 제공 중", "Available now", "当前可用", "現在利用可能"),
    liveTitle: locale("지금 가능한 전주 기능", "What is already live for Jeonju", "当前可用的全州功能", "現在利用可能な全州機能"),
    liveDesc: locale(
      "현재는 전주 기준 실시간 점수, 브리핑, 예보 캘린더까지 동작합니다.",
      "Right now, Jeonju already has a live score, briefing, and forecast calendar.",
      "目前，全州已支持实时评分、简报和预报日历功能。",
      "現在は全州基準のリアルタイムスコア、ブリーフィング、予報カレンダーまで動作しています。"
    ),
  }), [locale])

  const liveContent = useMemo(() => [
    {
      icon: SparklesIcon,
      title: locale("실시간 전주 점수", "Live Jeonju score", "实时全州评分", "リアルタイム全州スコア"),
      desc: locale(
        "기상청·에어코리아·기상통보문 데이터를 모아 전주 기준 피크닉 점수를 계산합니다.",
        "Combines KMA, AirKorea, and weather bulletin data to compute Jeonju's picnic score.",
        "综合气象厅、AirKorea和气象通报数据，计算全州野餐评分。",
        "気象庁・AirKorea・気象通報文のデータを集めて全州基準のピクニックスコアを計算します。"
      ),
    },
    {
      icon: Route,
      title: locale("전주 고정 브리핑·캘린더", "Jeonju-fixed briefing and calendar", "全州固定简报与日历", "全州固定ブリーフィング・カレンダー"),
      desc: locale(
        "나들이 브리핑과 10일 예보 캘린더를 모두 위치 추적 없이 전주 기준으로만 보여줍니다.",
        "Shows both the outing briefing and the 10-day forecast calendar strictly in Jeonju mode, without geolocation.",
        "无需位置追踪，仅以全州为基准显示出行简报和10天预报日历。",
        "お出かけブリーフィングと10日間予報カレンダーを、位置追跡なしで常に全州基準でのみ表示します。"
      ),
    },
    {
      icon: ShieldCheck,
      title: locale("로컬 fallback 경험", "Local fallback experience", "本地回退体验", "ローカルフォールバック体験"),
      desc: locale(
        "위치 권한이 없거나 대기 응답이 비정상이면 전주 홈 기준 화면으로 안전하게 대체합니다.",
        "If location is unavailable or air data is unstable, the service safely falls back to Jeonju home mode.",
        "当缺少位置权限或空气质量数据异常时，安全地回退到全州首页模式。",
        "位置権限がないか大気データが異常な場合、全州ホーム基準の画面に安全に代替します。"
      ),
    },
  ], [locale])

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors overflow-x-hidden">
      {/* Hero — particles + tagline + animated title */}
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
          <p className="text-neutral-800 dark:text-neutral-400 text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed break-words font-semibold">
            {t("about_hero_desc")}
          </p>
        </div>
      </section>

      {/* Tech stack marquee — scrolls horizontally through project technologies */}
      <section className="py-24 relative overflow-hidden">
        <Marquee pauseOnHover className="[--duration:40s]">
          {[
            "Next.js 16", "React 19", "TypeScript", "Tailwind CSS",
            "TiDB / MySQL", "WebSocket", "Lucide Icons", "Magic UI",
            "Framer Motion", "PM2", "Vultr", "i18n"
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

      {/* Core features — bento grid with data-driven badge */}
      <section id="features" className="container mx-auto py-32 px-4">
        <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
          <div className="max-w-xl">
            <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight break-words">{t("about_features_title")}</h2>
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
                  "rounded-[2.5rem] border-sky-blue/5 shadow-2xl transition-[scale,box-shadow] hover:scale-[1.01] hover:shadow-sky-blue/5 dark:border-white/5",
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
          <p className="mt-6 text-neutral-500 dark:text-neutral-400 text-xl font-medium leading-relaxed break-words">
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
                <h3 className="mt-6 text-2xl font-black tracking-tight text-foreground break-words">
                  {t(card.titleKey)}
                </h3>
                <p className="mt-4 text-sm sm:text-base font-semibold leading-relaxed text-neutral-900 dark:text-neutral-300 break-words">
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
          <p className="text-neutral-500 dark:text-neutral-400 text-xl font-medium leading-relaxed break-words">
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
                <p className="text-sm sm:text-base font-semibold leading-relaxed break-words text-neutral-800 dark:text-neutral-400">
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
          <p className="text-neutral-500 dark:text-neutral-400 text-xl font-medium leading-relaxed break-words">
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
                <h3 className="text-2xl font-black text-foreground tracking-tight mb-4 break-words">
                  {t(card.titleKey)}
                </h3>
                <p className="text-sm sm:text-base font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400 break-words">
                  {t(card.descKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Metric guide — explains each environmental factor used in scoring */}
      <section id="guide" className="container mx-auto py-20 px-4">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <AnimatedGradientText className="text-3xl md:text-5xl font-black tracking-tight">
            {t("guide_title")}
          </AnimatedGradientText>
          <p className="mt-4 text-base sm:text-lg text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed break-words">
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
                  <h3 className="text-lg sm:text-xl font-black text-foreground break-words">
                    {t(`${item.tag}_t`)}
                  </h3>
                  <p className="mt-2 text-sm sm:text-[15px] leading-relaxed font-semibold text-neutral-800 dark:text-neutral-400 break-words">
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
          <p className="mt-4 text-base sm:text-lg font-semibold leading-relaxed break-words text-neutral-800 dark:text-neutral-400">
            {texts.liveDesc}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 max-w-6xl mx-auto">
          {liveContent.map((item) => (
            <div key={item.title} className="rounded-[2.5rem] border border-card-border bg-card p-8 shadow-[0_18px_42px_-32px_rgba(47,111,228,0.18)]">
              <div className="inline-flex rounded-2xl border border-sky-blue/20 bg-sky-blue/10 p-4 text-sky-blue">
                <item.icon size={24} />
              </div>
              <h3 className="mt-6 text-2xl font-black tracking-tight text-foreground break-words">{item.title}</h3>
              <p className="mt-4 text-sm sm:text-base font-bold leading-relaxed text-neutral-800 dark:text-neutral-400 break-words">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20 pt-10">
        <div className="mb-8 max-w-4xl mx-auto text-center">
          <AnimatedGradientText className="text-4xl md:text-5xl font-black tracking-tight">
            {texts.expandedTitle}
          </AnimatedGradientText>
          <p className="mt-4 text-base sm:text-lg font-semibold leading-relaxed break-words text-neutral-800 dark:text-neutral-400">
            {texts.expandedDesc}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 max-w-6xl mx-auto">
          {expandedContent.map((item) => (
            <div key={item.title} className="rounded-[2.5rem] border border-card-border bg-card p-8 shadow-[0_18px_42px_-32px_rgba(47,111,228,0.18)]">
              <div className="inline-flex rounded-2xl border border-nature-green/20 bg-nature-green/10 p-4 text-nature-green">
                <item.icon size={24} />
              </div>
              <div className="mt-6">
                <span className="inline-flex rounded-full border border-active-blue/20 bg-active-blue/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-active-blue">
                  {texts.availableNow}
                </span>
                <h3 className="mt-4 text-2xl font-black tracking-tight text-foreground break-words">{item.title}</h3>
              </div>
              <p className="mt-4 text-sm sm:text-base font-bold leading-relaxed text-neutral-800 dark:text-neutral-400 break-words">
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
            <p className="mt-4 text-base sm:text-lg font-medium leading-relaxed break-words text-neutral-500 dark:text-neutral-400">
              {texts.pipelineDesc}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {stepContent.map((step, index) => (
              <div key={step.title} className="rounded-[2rem] border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-5 min-w-0">
                <div className="text-sm font-black uppercase tracking-[0.24em] text-sky-blue">{serviceSteps[index]}</div>
                <h3 className="mt-3 text-xl sm:text-2xl font-black leading-tight text-foreground break-words">{step.title}</h3>
                <p className="mt-3 text-base font-bold leading-relaxed text-neutral-900 dark:text-neutral-300 break-words">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/statistics/calendar" className="inline-flex items-center gap-2 rounded-full border border-card-border bg-[var(--interactive)] px-5 py-3 text-sm font-black text-foreground transition-colors hover:bg-[var(--interactive-border)]">
              <CalendarClock size={16} />
              {locale("통계 달력 보기", "Open Calendar", "查看统计日历", "統計カレンダーを見る")}
            </Link>
          </div>
        </div>
      </section>

      <section id="maintenance" className="container mx-auto px-4 pb-28">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.75rem] border border-sky-blue/20 bg-[linear-gradient(135deg,rgba(47,111,228,0.12),rgba(255,255,255,0.02)_52%,rgba(11,125,113,0.1))] p-6 shadow-[0_28px_80px_-52px_rgba(47,111,228,0.48)] sm:p-10 lg:p-12">
          <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-sky-blue/12 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-end">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-blue/25 bg-background/60 px-3.5 py-2 text-xs font-black uppercase tracking-[0.2em] text-sky-blue">
                <Wrench className="size-4" />
                {locale("project maintenance", "project maintenance", "项目维护", "プロジェクト保守")}
              </span>
              <div className="space-y-3">
                <h2 className="max-w-3xl break-keep text-balance text-3xl font-black tracking-tight text-foreground sm:text-4xl">{locale("완성된 나들해는 이제 김현민이 단독으로 유지보수합니다.", "Nadeulhae is now maintained independently by Hyeonmin Kim.", "现已由金贤珉独立维护。", "現在のナドゥルヘはキム・ヒョンミンが単独で保守しています。")}</h2>
                <p className="max-w-3xl text-base font-semibold leading-8 text-muted-foreground sm:text-lg">{locale("초기 팀 프로젝트의 기반 위에서, 현재 기능 개선·장애 대응·서버 운영·데이터 품질 점검과 업데이트는 김현민이 책임지고 이어갑니다.", "Building on the original team project, Hyeonmin Kim now owns feature improvements, incident response, server operations, data-quality checks, and updates.", "在最初团队项目的基础上，功能改进、故障处理、服务器运营、数据质量检查和更新现由金贤珉负责。", "初期チームプロジェクトの基盤の上で、現在は機能改善・障害対応・サーバー運用・データ品質確認・更新をキム・ヒョンミンが担っています。")}</p>
              </div>
              <p className="rounded-[1.35rem] border border-card-border/70 bg-background/55 px-4 py-3 text-sm font-bold leading-6 text-foreground/90">{locale("프로젝트는 구축 단계를 마쳤고, 앞으로는 사용 경험과 신뢰도를 높이는 유지보수 중심으로 운영합니다.", "The build phase is complete; future work is maintenance-led, focused on a more reliable and useful experience.", "项目已完成构建阶段，后续将以提升使用体验和可靠性的维护工作为主。", "プロジェクトは構築段階を完了し、今後は使いやすさと信頼性を高める保守を中心に運用します。")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                { label: locale("기능 개선", "Feature care", "功能优化", "機能改善"), detail: locale("사용 흐름과 접근성", "Flows and accessibility", "使用流程与可访问性", "導線とアクセシビリティ"), icon: SparklesIcon },
                { label: locale("서비스 운영", "Service operations", "服务运营", "サービス運用"), detail: locale("서버·배포·장애 대응", "Server, deploys, incidents", "服务器、部署与故障处理", "サーバー・デプロイ・障害対応"), icon: CpuIcon },
                { label: locale("데이터 품질", "Data quality", "数据质量", "データ品質"), detail: locale("공공 데이터와 결과 점검", "Public data and outcome checks", "公共数据与结果检查", "公共データと結果確認"), icon: ShieldCheck },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.4rem] border border-card-border/70 bg-background/60 p-4 shadow-[0_12px_28px_rgba(17,32,39,0.05)]">
                  <item.icon className="size-5 text-sky-blue" />
                  <p className="mt-3 text-sm font-black text-foreground">{item.label}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team contributors — person cards with BorderBeam on capable devices */}
      <section id="contributors" className="container mx-auto py-32 px-4 border-y border-sky-blue/10 dark:border-white/5 relative overflow-hidden">
        <div className="hidden xl:block absolute top-0 right-0 px-8 py-2 bg-sky-blue/10 border-l border-b border-sky-blue/20 rounded-bl-3xl text-[10px] font-black uppercase tracking-[0.3em] text-sky-blue">
          The Engineering Team
        </div>
        
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight break-words">{t("about_contributors_title")}</h2>
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
                  <div className="mb-10 flex size-28 items-center justify-center rounded-[2.5rem] border border-sky-blue/15 bg-[var(--interactive)] text-sky-blue shadow-[inset_0_4px_10px_rgba(0,0,0,0.04)] transition-[border-color,background-color] duration-300 group-hover:border-sky-blue/30 group-hover:bg-sky-blue/10 sm:size-36 sm:rounded-[3rem]">
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

                  <div className="mb-8 h-1.5 w-14 rounded-full bg-sky-blue/20 transition-[width,background-color] duration-300 group-hover:w-20 group-hover:bg-sky-blue/50" />

                  <p className="px-4 text-center text-sm sm:text-base font-semibold leading-relaxed break-words text-neutral-800 dark:text-neutral-400">
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
