"use client"

import { 
  CloudSunIcon, 
  MapIcon, 
  CpuIcon, 
  UsersIcon, 
  SparklesIcon,
  SearchIcon,
  HistoryIcon,
  CodeIcon,
  ArrowRight,
  Thermometer,
  Wind,
  Droplets,
  Navigation,
  Cloud,
  Zap,
  ShieldCheck,
  CloudRain
} from "lucide-react"


import { Particles } from "@/components/magicui/particles"
import { WordPullUp } from "@/components/magicui/word-pull-up"
import { BentoGrid, BentoCard } from "@/components/magicui/bento-grid"
import { Marquee } from "@/components/magicui/marquee"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"


const features = [
  {
    name: "날씨 지능형 분석",
    description: "단순 온도를 넘어 습도, 풍속, 미세먼지를 종합하여 최적의 피크닉 순간을 포착합니다.",
    className: "col-span-3 lg:col-span-2",
    icon: CloudSunIcon,
    background: <div className="absolute inset-0 bg-gradient-to-br from-sky-blue/10 to-transparent" />,
  },
  {
    name: "AI 코스 큐레이션",
    description: "LLM이 전주의 장소 DB와 실시간 날씨를 조합해 맞춤형 동선을 설계합니다.",
    className: "col-span-3 lg:col-span-1",
    icon: SparklesIcon,
    background: <div className="absolute inset-0 bg-gradient-to-br from-purple-100/10 to-transparent" />,
  },
  {
    name: "로컬 장소 DB",
    description: "전주의 숨은 명소부터 인기 카페까지, 실내외 특성을 고려한 큐레이션을 제공합니다.",
    className: "col-span-3 lg:col-span-1",
    icon: MapIcon,
    background: <div className="absolute inset-0 bg-gradient-to-br from-teal-100/10 to-transparent" />,
  },
  {
    name: "과거 데이터 통찰",
    description: "지난 3년의 기상 통계를 통해 가장 완벽한 요일과 시간대를 추천합니다.",
    className: "col-span-3 lg:col-span-2",
    icon: CpuIcon,
    background: <div className="absolute inset-0 bg-gradient-to-br from-orange-100/10 to-transparent" />,
  },
]

const contributors = [
  { name: "Contributor 1", role: "Main Developer", avatar: "👤" },
  { name: "Contributor 2", role: "UI/UX Designer", avatar: "🎨" },
  { name: "Contributor 3", role: "Data Engineer", avatar: "📊" },
  { name: "Contributor 4", role: "AI Specialist", avatar: "🤖" },
]

import { useLanguage } from "@/context/LanguageContext"

export default function AboutPage() {
  const { resolvedTheme } = useTheme()
  const { t } = useLanguage()
  

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-4 text-center overflow-hidden">
        <Particles
          className="absolute inset-0 z-0"
          quantity={100}
          color={resolvedTheme === "dark" ? "#ffffff" : "#87CEEB"}
        />
        <div className="relative z-10 max-w-4xl mx-auto">
          <span className="px-6 py-2 rounded-full bg-sky-blue/10 text-sky-blue text-[10px] font-black uppercase tracking-[0.3em] mb-8 inline-block border border-sky-blue/20">
            {t("about_hero_tag")}
          </span>
          <WordPullUp
            words={t("about_hero_title")}
            className="text-5xl md:text-7xl font-black mb-10 leading-tight tracking-tighter"
          />
          <p className="text-neutral-500 dark:text-neutral-400 text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed font-medium">
            {t("about_hero_desc")}
          </p>
        </div>
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
            <SparklesIcon size={18} /> 100% Data-Driven
          </div>
        </div>

        <BentoGrid className="grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <BentoCard key={i} {...feature} Icon={feature.icon as any} href="#ai-generator" cta="자세히 보기" className={cn(feature.className, "rounded-[2rem] border-sky-blue/5 dark:border-white/5 shadow-2xl")} />
          ))}
        </BentoGrid>
      </section>

      {/* Tech Stack Section (existing) */}
      <section className="bg-sky-blue/5 dark:bg-white/5 py-32 border-y border-sky-blue/10 dark:border-white/5 relative">
        {/* ... existing marquee ... */}
      </section>

      {/* Algorithm & Logic Section */}
      <section className="container mx-auto py-32 px-4">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-black mb-6 tracking-tight">{t("about_algo_title")}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-xl font-medium max-w-2xl mx-auto">
            {t("about_algo_desc")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {/* Temperature logic */}
          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 shadow-xl group hover:border-orange-400/30 transition-all duration-500">
            <div className="size-12 rounded-xl bg-orange-100/50 dark:bg-orange-900/20 flex items-center justify-center text-orange-500 mb-6 group-hover:scale-110 transition-transform">
              <Thermometer size={24} />
            </div>
            <h3 className="text-xl font-black mb-3">{t("about_algo_temp_title")}</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">
              {t("about_algo_temp_desc")}
            </p>
          </div>

          {/* Air Quality logic */}
          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 shadow-xl group hover:border-sky-blue/30 transition-all duration-500">
            <div className="size-12 rounded-xl bg-sky-blue/10 dark:bg-sky-blue/20 flex items-center justify-center text-sky-blue mb-6 group-hover:scale-110 transition-transform">
              <Wind size={24} />
            </div>
            <h3 className="text-xl font-black mb-3">{t("about_algo_dust_title")}</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">
              {t("about_algo_dust_desc")}
            </p>
          </div>

          {/* Rain & Wind logic */}
          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 shadow-xl group hover:border-purple-400/30 transition-all duration-500">
            <div className="size-12 rounded-xl bg-purple-100/50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500 mb-6 group-hover:scale-110 transition-transform">
              <CloudSunIcon size={24} />
            </div>
            <h3 className="text-xl font-black mb-3">{t("about_algo_weather_title")}</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">
              {t("about_algo_weather_desc")}
            </p>
          </div>

          {/* Data syncing logic */}
          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 shadow-xl group hover:border-teal-400/30 transition-all duration-500">
            <div className="size-12 rounded-xl bg-teal-100/50 dark:bg-teal-900/20 flex items-center justify-center text-teal-500 mb-6 group-hover:scale-110 transition-transform">
              <HistoryIcon size={24} />
            </div>
            <h3 className="text-xl font-black mb-3">{t("about_algo_data_title")}</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">
              {t("about_algo_data_desc")}
            </p>
          </div>
        </div>
      </section>

      {/* New: Detailed Environmental Metric Guide */}
      <section className="bg-sky-blue/5 dark:bg-white/[0.02] py-32 border-y border-sky-blue/10 dark:border-white/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-black mb-6 tracking-tight">{t("about_data_title")}</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-xl font-medium max-w-2xl mx-auto">
              {t("about_data_desc")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { id: 'temp', icon: <Thermometer size={20} /> },
              { id: 'humi', icon: <Droplets size={20} /> },
              { id: 'wind', icon: <Wind size={20} /> },
              { id: 'vec', icon: <Navigation size={20} /> },
              { id: 'pm10', icon: <Cloud size={20} /> },
              { id: 'pm25', icon: <SparklesIcon size={20} /> },
              { id: 'o3', icon: <Zap size={20} /> },
              { id: 'no2', icon: <SearchIcon size={20} /> },
              { id: 'khai', icon: <ShieldCheck size={20} /> },
              { id: 'precip', icon: <CloudRain size={20} /> },
            ].map((item) => (
              <div key={item.id} className="group p-8 rounded-[2rem] bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 shadow-lg hover:border-sky-blue/30 transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-xl bg-sky-blue/10 text-sky-blue group-hover:scale-110 transition-transform">
                    {item.icon}
                  </div>
                  <h3 className="text-lg font-black text-foreground">{t(`about_item_${item.id}`)}</h3>
                </div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">
                  {t(`about_item_${item.id}_desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contributors Section */}
      <section id="contributors" className="container mx-auto py-32 px-4 pb-64">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-black mb-6 tracking-tight">{t("about_contributors_title")}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-xl font-medium">{t("about_contributors_desc")}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 max-w-4xl mx-auto">
          {contributors.map((person, i) => (
            <div key={i} className="flex flex-col items-center group cursor-help transition-all">
              <div className="size-32 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-4xl mb-6 border-4 border-transparent group-hover:border-sky-blue group-hover:bg-sky-blue/10 transition-all shadow-[inset_0_4px_10px_rgba(0,0,0,0.05)]">
                {person.avatar}
              </div>
              <h3 className="font-black text-2xl text-foreground group-hover:text-sky-blue transition-colors">{person.name}</h3>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mt-2 font-bold">{person.role}</p>
            </div>
          ))}
        </div>
        
        <div className="mt-32 text-center max-w-xl mx-auto p-12 rounded-[3rem] border-2 border-dashed border-[var(--card-border)] bg-[var(--card)]">
          <UsersIcon size={48} className="mx-auto mb-6 text-sky-blue opacity-40" />
          <p className="text-lg italic font-medium text-neutral-400 dark:text-neutral-500 leading-relaxed">
            "{t("about_placeholder")}"
          </p>
        </div>
      </section>
    </main>
  )
}

