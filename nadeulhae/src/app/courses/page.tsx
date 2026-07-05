"use client"

/**
 * "Saved courses" — authenticated gallery of the user's saved outing courses.
 * Each card links to the public read-only share view (/courses/[token]) and
 * can be deleted. Data comes from GET /api/courses.
 */

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bookmark, LoaderCircle, Trash2, ArrowRight, MapPinned, Globe, Lock } from "lucide-react"

import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import { cn, getCopy } from "@/lib/utils"

type SavedCourse = {
  id: string
  title: string
  slots: unknown[]
  shareToken: string
  isPublic: boolean
  createdAt: string
}

const PAGE_COPY = {
  ko: {
    eyebrow: "내 저장 코스",
    title: "저장한 코스",
    subtitle: "나들AI로 만든 코스를 저장하고 링크로 공유하세요.",
    loading: "저장한 코스를 불러오는 중...",
    loginRequired: "로그인이 필요합니다. 로그인 페이지로 이동합니다.",
    empty: "아직 저장한 코스가 없어요. 대시보드에서 코스를 추천받고 '코스 저장'을 눌러보세요.",
    goDashboard: "대시보드로 가기",
    open: "열기",
    del: "삭제",
    deleting: "삭제 중...",
    deleteConfirm: "이 코스를 삭제할까요?",
    slotsLabel: "개 코스 구간",
    loadError: "코스를 불러오지 못했어요.",
    visPublic: "공개",
    visPrivate: "비공개",
    visHint: "비공개로 바꾸면 공유 링크가 열리지 않아요.",
  },
  en: {
    eyebrow: "My saved courses",
    title: "Saved courses",
    subtitle: "Save the courses you build with NadeulAI and share them by link.",
    loading: "Loading your saved courses...",
    loginRequired: "You need to log in first. Redirecting to login.",
    empty: "No saved courses yet. Get a recommendation on the dashboard and tap 'Save course'.",
    goDashboard: "Go to dashboard",
    open: "Open",
    del: "Delete",
    deleting: "Deleting...",
    deleteConfirm: "Delete this course?",
    slotsLabel: " stops",
    loadError: "Failed to load courses.",
    visPublic: "Public",
    visPrivate: "Private",
    visHint: "Making it private disables the share link.",
  },
  zh: {
    eyebrow: "我的收藏路线",
    title: "已保存路线",
    subtitle: "保存用 NadeulAI 制作的路线，并通过链接分享。",
    loading: "正在加载已保存的路线...",
    loginRequired: "请先登录。正在跳转到登录页面。",
    empty: "还没有保存的路线。在仪表盘获取推荐后点击「保存路线」。",
    goDashboard: "前往仪表盘",
    open: "打开",
    del: "删除",
    deleting: "删除中...",
    deleteConfirm: "确定删除此路线？",
    slotsLabel: " 个路线段",
    loadError: "加载路线失败。",
    visPublic: "公开",
    visPrivate: "私密",
    visHint: "设为私密后分享链接将无法打开。",
  },
  ja: {
    eyebrow: "保存したコース",
    title: "保存したコース",
    subtitle: "NadeulAIで作ったコースを保存し、リンクで共有しましょう。",
    loading: "保存したコースを読み込み中...",
    loginRequired: "ログインが必要です。ログインページに移動します。",
    empty: "まだ保存したコースがありません。ダッシュボードで推薦を受け「コースを保存」を押してください。",
    goDashboard: "ダッシュボードへ",
    open: "開く",
    del: "削除",
    deleting: "削除中...",
    deleteConfirm: "このコースを削除しますか？",
    slotsLabel: "区間",
    loadError: "コースを読み込めませんでした。",
    visPublic: "公開",
    visPrivate: "非公開",
    visHint: "非公開にすると共有リンクが開けなくなります。",
  },
} as const

export default function SavedCoursesPage() {
  const router = useRouter()
  const { user, status } = useAuth()
  const { language } = useLanguage()
  const copy = getCopy(PAGE_COPY, language)

  const [courses, setCourses] = useState<SavedCourse[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (status === "guest") {
      const timeout = window.setTimeout(() => router.replace("/login"), 450)
      return () => window.clearTimeout(timeout)
    }
  }, [router, status])

  useEffect(() => {
    if (status !== "authenticated" || !user) return
    let cancelled = false
    fetch("/api/courses", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setCourses(Array.isArray(data?.courses) ? data.courses : [])
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true)
          setCourses([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [status, user])

  const handleDelete = useCallback(
    async (id: string) => {
      if (deletingId) return
      if (typeof window !== "undefined" && !window.confirm(copy.deleteConfirm)) return
      setDeletingId(id)
      try {
        const res = await fetch(`/api/courses?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        })
        if (res.ok) {
          setCourses((prev) => (prev ? prev.filter((c) => c.id !== id) : prev))
        }
      } catch (err) {
        console.error("Delete course failed:", err)
      } finally {
        setDeletingId(null)
      }
    },
    [deletingId, copy.deleteConfirm]
  )

  const [togglingId, setTogglingId] = useState<string | null>(null)
  const handleToggleVisibility = useCallback(async (id: string, nextPublic: boolean) => {
    if (togglingId) return
    setTogglingId(id)
    // Optimistic update.
    setCourses((prev) => (prev ? prev.map((c) => (c.id === id ? { ...c, isPublic: nextPublic } : c)) : prev))
    try {
      const res = await fetch("/api/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isPublic: nextPublic }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      console.error("Toggle course visibility failed:", err)
      // Revert on failure.
      setCourses((prev) => (prev ? prev.map((c) => (c.id === id ? { ...c, isPublic: !nextPublic } : c)) : prev))
    } finally {
      setTogglingId(null)
    }
  }, [togglingId])

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-center text-base font-bold text-sky-blue">
        {copy.loading}
      </main>
    )
  }

  if (status === "guest" || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-center text-base font-bold text-sky-blue">
        {copy.loginRequired}
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-20 pt-24 sm:px-6 sm:pt-28">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-sky-blue">
        <Bookmark className="size-4" />
        {copy.eyebrow}
      </div>
      <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{copy.title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{copy.subtitle}</p>

      {courses === null ? (
        <div className="mt-8 flex items-center justify-center gap-2 rounded-[1.5rem] border border-card-border/60 bg-card/70 py-16 text-sm font-semibold text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin text-sky-blue" />
          {copy.loading}
        </div>
      ) : courses.length === 0 ? (
        <div className="mt-8 rounded-[1.5rem] border border-card-border/60 bg-card/70 p-8 text-center">
          <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">{loadError ? copy.loadError : copy.empty}</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-sky-blue/30 bg-sky-blue/10 px-5 py-2.5 text-sm font-bold text-sky-blue transition hover:bg-sky-blue/15"
          >
            {copy.goDashboard}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {courses.map((course) => {
            const slotCount = Array.isArray(course.slots) ? course.slots.length : 0
            const created = new Date(course.createdAt)
            const createdLabel = Number.isNaN(created.getTime())
              ? ""
              : created.toLocaleDateString(language === "ko" ? "ko-KR" : language === "ja" ? "ja-JP" : language === "zh" ? "zh-CN" : "en-US")
            return (
              <li
                key={course.id}
                className="flex flex-col gap-3 rounded-[1.4rem] border border-card-border/70 bg-card/80 p-4 transition hover:border-sky-blue/30"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-sky-blue to-active-blue p-2.5 text-white shadow-md shadow-active-blue/20">
                    <MapPinned className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-black text-foreground">{course.title}</h2>
                    <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                      {slotCount}
                      {copy.slotsLabel}
                      {createdLabel ? ` · ${createdLabel}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <Link
                    href={`/courses/${course.shareToken}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-sky-blue/30 bg-sky-blue/10 px-3.5 py-1.5 text-xs font-bold text-sky-blue transition hover:bg-sky-blue/15"
                  >
                    {copy.open}
                    <ArrowRight className="size-3.5" />
                  </Link>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleToggleVisibility(course.id, !course.isPublic)}
                      disabled={togglingId === course.id}
                      title={course.isPublic ? copy.visHint : undefined}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                        course.isPublic
                          ? "border-sky-blue/25 bg-sky-blue/10 text-sky-blue hover:bg-sky-blue/15"
                          : "border-card-border/60 bg-background/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {course.isPublic ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
                      <span className="hidden sm:inline">{course.isPublic ? copy.visPublic : copy.visPrivate}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(course.id)}
                      disabled={deletingId === course.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-card-border/60 bg-background/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-danger/30 hover:text-danger disabled:opacity-50"
                    >
                      {deletingId === course.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      <span className="hidden sm:inline">{deletingId === course.id ? copy.deleting : copy.del}</span>
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
