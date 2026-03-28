"use client"

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
            "Framer Motion", "Shadcn UI", "Vercel", "i18n"
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

        <BentoGrid className="md:grid-cols-3 gap-4 sm:gap-8">
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
              <BorderBeam
                size={240}
                duration={8}
                delay={index * 1.1}
                colorFrom="var(--beam-from)"
                colorTo="var(--beam-to)"
              />
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-sky-blue/8 to-transparent pointer-events-none" />
              <div className="relative z-10 min-w-0">
                <div className="inline-flex rounded-2xl border border-sky-blue/20 bg-sky-blue/10 p-4 text-sky-blue">
                  <card.icon size={24} />
                </div>
                <h3 className="mt-6 text-2xl font-black tracking-tight text-foreground break-keep">
                  {t(card.titleKey)}
                </h3>
                <p className="mt-4 text-sm sm:text-base font-semibold leading-relaxed text-neutral-900 dark:text-neutral-300 break-keep">
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
                <h3 className="text-2xl font-black text-foreground tracking-tight mb-4 break-keep">
                  {t(card.titleKey)}
                </h3>
                <p className="text-sm sm:text-base font-semibold leading-relaxed text-neutral-800 dark:text-neutral-400 break-keep">
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

      {/* Contributors Section */}
      <section id="contributors" className="container mx-auto py-32 px-4 bg-sky-blue/5 dark:bg-white/5 border-y border-sky-blue/10 dark:border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 px-8 py-2 bg-sky-blue/10 border-l border-b border-sky-blue/20 rounded-bl-3xl text-[10px] font-black uppercase tracking-[0.3em] text-sky-blue">
          The Engineering Team
        </div>
        
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">{t("about_contributors_title")}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-xl font-medium max-w-3xl mx-auto">
            {t("about_philosophy_desc")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 max-w-6xl mx-auto">
          {contributors.map((person, i) => (
            <div
              key={i}
              className="group relative h-full overflow-hidden rounded-[3rem] sm:rounded-[4rem] border border-card-border bg-card shadow-[0_24px_70px_-48px_rgba(47,111,228,0.22)] transition-transform duration-300 hover:-translate-y-1"
            >
              <BorderBeam
                size={320}
                duration={10}
                delay={i * 1.5}
                colorFrom="var(--beam-from)"
                colorTo="var(--beam-to)"
                borderWidth={1.5}
              />
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
