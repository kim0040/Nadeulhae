"use client"

import { Calendar as CalendarIcon, History, Zap } from "lucide-react"
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
        color={resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"}
      />
      
      <div className="container max-w-7xl mx-auto relative z-10">
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
            <div className="p-3 rounded-2xl bg-gradient-to-br from-nature-green/10 to-sky-blue/10 border border-nature-green/20">
              <Zap size={24} className="text-nature-green" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-foreground">{t("cal_realtime_title")}</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                {t("cal_realtime_desc")}
              </p>
            </div>
          </div>

          <PicnicCalendar />
        </div>

        {/* 아카이브 섹션 */}
        <div className="pt-24 border-t border-sky-blue/10">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-[var(--interactive)] border border-[var(--interactive-border)]">
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
