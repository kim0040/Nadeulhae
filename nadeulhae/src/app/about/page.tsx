"use client"

import { 
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

const features = [
  {
    nameKey: "about_feature_1_name",
    descKey: "about_feature_1_desc",
    className: "col-span-3 lg:col-span-2",
    icon: CloudSunIcon,
    background: <div className="absolute inset-0 bg-gradient-to-br from-sky-blue/10 to-transparent" />,
    pending: false,
  },
  {
    nameKey: "about_feature_2_name",
    descKey: "about_feature_2_desc",
    className: "col-span-3 lg:col-span-1",
    icon: SparklesIcon,
    background: <div className="absolute inset-0 bg-gradient-to-br from-purple-100/10 to-transparent" />,
    pending: true,
  },
  {
    nameKey: "about_feature_3_name",
    descKey: "about_feature_3_desc",
    className: "col-span-3 lg:col-span-1",
    icon: MapIcon,
    background: <div className="absolute inset-0 bg-gradient-to-br from-teal-100/10 to-transparent" />,
    pending: true,
  },
  {
    nameKey: "about_feature_4_name",
    descKey: "about_feature_4_desc",
    className: "col-span-3 lg:col-span-2",
    icon: CpuIcon,
    background: <div className="absolute inset-0 bg-gradient-to-br from-orange-100/10 to-transparent" />,
    pending: true,
  },
]

const contributors = [
  { id: "hm", icon: CpuIcon, roleKey: "con_hm_role", nameKey: "con_hm_name", descKey: "con_hm_desc" },
  { id: "es", icon: SearchIcon, roleKey: "con_es_role", nameKey: "con_es_name", descKey: "con_es_desc" },
  { id: "jh", icon: Database, roleKey: "con_jh_role", nameKey: "con_jh_name", descKey: "con_jh_desc" },
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
          <p className="text-neutral-500 dark:text-neutral-400 text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed font-medium">
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

        <BentoGrid className="grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div key={i} className="relative group">
              <BentoCard 
                {...feature} 
                name={t(feature.nameKey)}
                description={t(feature.descKey)}
                Icon={feature.icon as any} 
                href={feature.pending ? "#" : "#ai-generator"} 
                cta={feature.pending ? t("about_status_pending") : t("about_feature_cta")} 
                className={cn(
                  feature.className, 
                  "rounded-[2.5rem] border-sky-blue/5 dark:border-white/5 shadow-2xl transition-all hover:scale-[1.01] hover:shadow-sky-blue/5",
                  feature.pending && "opacity-80 grayscale-[0.3]"
                )} 
              />
              {feature.pending && (
                <div className="absolute top-8 right-8 z-20">
                  <span className="px-4 py-1.5 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                    {t("about_status_pending")}
                  </span>
                </div>
              )}
            </div>
          ))}
        </BentoGrid>
      </section>

      {/* Environmental Metric Guide */}
      <section id="guide" className="container mx-auto py-32 px-4 bg-white/50 dark:bg-neutral-900/20 backdrop-blur-xl border-t border-sky-blue/10 dark:border-white/5 pb-64">
        <div className="max-w-4xl mx-auto text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">{t("guide_title")}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-xl font-medium leading-relaxed">
            {t("guide_desc")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
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
            <div key={i} className="p-10 rounded-[2.5rem] bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-white/5 shadow-xl hover:shadow-2xl transition-all group">
              <div className="flex items-center gap-5 mb-8">
                <div className="p-4 rounded-2xl bg-sky-blue/10 text-sky-blue group-hover:bg-sky-blue group-hover:text-white transition-all shadow-lg shadow-sky-blue/5">
                  <item.icon size={28} />
                </div>
                <h3 className="text-2xl font-black text-foreground">
                  {t(`${item.tag}_t`)}
                </h3>
              </div>
              <p className="text-neutral-500 dark:text-neutral-400 text-base leading-relaxed font-medium">
                {t(`${item.tag}_d`)}
              </p>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-6xl mx-auto">
          {contributors.map((person, i) => (
            <div key={i} className="flex flex-col items-center group transition-all p-12 rounded-[4rem] bg-white/70 dark:bg-neutral-900/70 border border-neutral-100 dark:border-white/5 hover:border-sky-blue/30 hover:shadow-2xl backdrop-blur-md">
              <div className="size-36 rounded-[3rem] bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-sky-blue mb-10 border-2 border-transparent group-hover:border-sky-blue group-hover:bg-sky-blue/10 transition-all shadow-[inset_0_4px_10px_rgba(0,0,0,0.05)]">
                <person.icon size={56} strokeWidth={1.2} />
              </div>
              <h3 className="font-black text-3xl text-foreground group-hover:text-sky-blue transition-colors">
                {t(person.nameKey)}
              </h3>
              <div className="flex flex-col items-center gap-2 mt-4">
                <span className="text-xs text-sky-blue font-bold tracking-wider">
                  {t("con_university")}
                </span>
                <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">
                  {t("con_department")}
                </span>
              </div>
              <div className="w-12 h-1 bg-neutral-200 dark:bg-neutral-800 my-8 rounded-full group-hover:bg-sky-blue/30 transition-colors" />
              <p className="text-center text-base text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium px-4">
                {t(person.descKey)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
