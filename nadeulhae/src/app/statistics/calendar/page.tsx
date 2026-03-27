"use client"

import Link from "next/link"
import { ArrowLeft, Calendar as CalendarIcon, History, Zap, Sparkles } from "lucide-react"
import { PicnicCalendar } from "@/components/picnic-calendar"
import { PicnicArchiveCalendar } from "@/components/picnic-archive-calendar"
import { useLanguage } from "@/context/LanguageContext"
import { Particles } from "@/components/magicui/particles"
import { useTheme } from "next-themes"

export default function CalendarPage() {
  const { t } = useLanguage()
  const { resolvedTheme } = useTheme()

  return (
    <main className="min-h-screen bg-background pt-32 pb-64 px-4 relative overflow-hidden">
      <Particles
        className="absolute inset-0 z-0"
        quantity={100}
        color={resolvedTheme === "dark" ? "#ffffff" : "#87CEEB"}
      />
      
      <div className="container max-w-5xl mx-auto relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-sky-blue mb-12 transition-colors font-bold group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          {t("nav_home")}
        </Link>

        <div className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 rounded-[1.5rem] bg-sky-blue/10 text-sky-blue border border-sky-blue/20">
              <CalendarIcon size={32} />
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-foreground">
              {t("cal_title")}
            </h1>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 text-xl font-medium max-w-2xl leading-relaxed">
            {t("cal_desc")}
          </p>
        </div>

        {/* 실시간 피크닉 캘린더 섹션 */}
        <div className="mb-32">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-teal-500/10 to-sky-blue/10 border border-teal-500/20">
              <Zap size={24} className="text-teal-500" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-foreground">{t("cal_realtime_title")}</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                {t("cal_realtime_desc")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3">
              <PicnicCalendar />
            </div>
            <div className="lg:col-span-1 space-y-6">
              <div className="p-8 rounded-[2.5rem] bg-sky-blue text-white shadow-2xl shadow-sky-blue/20">
                <h3 className="font-black text-xl mb-4">{t("cal_insight_title")}</h3>
                <p className="text-white/90 font-bold leading-relaxed">
                  {t("cal_insight_text")}
                </p>
              </div>
              <div className="p-8 rounded-[2.5rem] bg-[var(--card)] border border-[var(--card-border)]">
                <div className="flex items-start gap-4 mb-4">
                  <Sparkles className="text-sky-blue shrink-0" size={24} />
                  <h3 className="font-black text-lg text-foreground">{t("cal_realtime_status")}</h3>
                </div>
                <p className="text-neutral-500 dark:text-neutral-400 text-xs font-medium leading-relaxed">
                  {t("cal_realtime_note")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 아카이브 섹션 */}
        <div className="pt-24 border-t border-sky-blue/10">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-neutral-200/50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
              <History size={24} className="text-neutral-600 dark:text-neutral-400" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-foreground">{t("cal_archive_title")}</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                {t("cal_archive_desc")}
              </p>
            </div>
          </div>
          <PicnicArchiveCalendar />
        </div>
      </div>
    </main>
  )
}