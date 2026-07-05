"use client"

/**
 * Client renderer for a shared saved course. Receives the already-fetched
 * course (or null) from the server component, so there's no client-side fetch —
 * the page is SSR'd and the OG metadata is set server-side.
 */

import Link from "next/link"
import { MapPinned, ArrowRight } from "lucide-react"

import { useLanguage } from "@/context/LanguageContext"
import { getCopy } from "@/lib/utils"
import { CourseRecommendation } from "@/components/course-recommendation"

const PAGE_COPY = {
  ko: {
    eyebrow: "공유된 코스",
    notFoundTitle: "코스를 찾을 수 없어요",
    notFoundDesc: "링크가 만료되었거나 비공개로 전환되었을 수 있어요.",
    goHome: "나들해 홈으로",
  },
  en: {
    eyebrow: "Shared course",
    notFoundTitle: "Course not found",
    notFoundDesc: "The link may have expired or been made private.",
    goHome: "Go to Nadeulhae home",
  },
  zh: {
    eyebrow: "共享路线",
    notFoundTitle: "未找到路线",
    notFoundDesc: "链接可能已过期或已设为私密。",
    goHome: "前往 Nadeulhae 首页",
  },
  ja: {
    eyebrow: "共有されたコース",
    notFoundTitle: "コースが見つかりません",
    notFoundDesc: "リンクの有効期限が切れたか、非公開に変更された可能性があります。",
    goHome: "ナドゥルヘのホームへ",
  },
} as const

export function SharedCourseView({ course }: { course: { title: string; slots: unknown[] } | null }) {
  const { language } = useLanguage()
  const copy = getCopy(PAGE_COPY, language)

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-20 pt-24 sm:px-6 sm:pt-28">
      <div className="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-sky-blue">
        <MapPinned className="size-4" />
        {copy.eyebrow}
      </div>

      {course ? (
        <CourseRecommendation
          weatherContext={null}
          customCourse={course.slots as unknown[] as any[]}
          userLat={null}
          userLon={null}
          readOnly
        />
      ) : (
        <div className="rounded-[1.5rem] border border-card-border/60 bg-card/70 p-8 text-center">
          <h1 className="text-2xl font-black tracking-tight text-foreground">{copy.notFoundTitle}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{copy.notFoundDesc}</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-sky-blue/30 bg-sky-blue/10 px-5 py-2.5 text-sm font-bold text-sky-blue transition hover:bg-sky-blue/15"
          >
            {copy.goHome}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </main>
  )
}
