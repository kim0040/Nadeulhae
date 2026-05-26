"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MapPin, Clock, Star, Utensils, Coffee, Sparkles, RefreshCcw, ChevronRight, LoaderCircle, CloudAlert, Shuffle } from "lucide-react"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"
import type { ChatWeatherContext } from "@/lib/chat/prompt"
import type { UserProfile } from "@/lib/course-engine"

export interface CoursePlace {
  name: string
  category: string
  rating: number | null
  address: string | null
  menuSummary: string | null
  kakaoUrl: string | null
  reviewSummary: string | null
  reviewKeywords: string[]
  reviewPicks: string[]
}

export interface CourseSlotData {
  time: string
  title: string
  description: string
  type: "야외" | "실내" | "반실외"
  places: CoursePlace[]
}

const COPY = {
  ko: {
    badge: "나들 추천 코스",
    title: "오늘의 추천 코스",
    description: "실시간 날씨를 반영한 전주 반나절 코스입니다.",
    loading: "날씨에 맞는 코스를 찾는 중...",
    error: "코스를 불러오지 못했어요.",
    retry: "다시 시도",
    refreshHint: "3분마다 자동 갱신",
    outdoor: "야외",
    indoor: "실내",
    semiOutdoor: "반실외",
    rating: "평점",
    menu: "대표 메뉴",
    noMenu: "메뉴 정보 없음",
    nearby: "근처 추천",
    startAt: "시작",
    empty: "현재 날씨 조건에 맞는 코스를 찾을 수 없어요. 날씨가 좋아지면 다시 추천해 드릴게요.",
    fallbackNote: "날씨 컨텍스트 없이 기본 코스를 표시합니다.",
    dislike: "다른 곳",
    dislikeHint: "이 장소 대신 다른 곳을 추천받기",
    excludedCount: "제외됨",
  },
  en: {
    badge: "Recommended Course",
    title: "Today's Course",
    description: "A half-day Jeonju itinerary based on real-time weather.",
    loading: "Finding the best course for today...",
    error: "Failed to load course.",
    retry: "Retry",
    refreshHint: "Auto-refreshes every 3 min",
    outdoor: "Outdoor",
    indoor: "Indoor",
    semiOutdoor: "Semi-outdoor",
    rating: "Rating",
    menu: "Menu",
    noMenu: "No menu info",
    nearby: "Nearby picks",
    startAt: "Start",
    empty: "No suitable course found for current conditions. Check back when weather improves.",
    fallbackNote: "Showing default course (no weather context).",
    dislike: "Try elsewhere",
    dislikeHint: "Get a different recommendation",
    excludedCount: "excluded",
  },
  zh: {
    badge: "推荐路线",
    title: "今日推荐路线",
    description: "基于实时天气的全州半日行程。",
    loading: "正在寻找最佳路线...",
    error: "无法加载路线。",
    retry: "重试",
    refreshHint: "每3分钟自动刷新",
    outdoor: "户外",
    indoor: "室内",
    semiOutdoor: "半户外",
    rating: "评分",
    menu: "菜单",
    noMenu: "暂无菜单",
    nearby: "附近推荐",
    startAt: "开始",
    empty: "当前天气条件下未找到合适的路线。天气好转后会再次推荐。",
    fallbackNote: "显示默认路线（无天气数据）。",
    dislike: "换一个",
    dislikeHint: "换其他地方推荐",
    excludedCount: "已排除",
  },
  ja: {
    badge: "おすすめコース",
    title: "今日のおすすめコース",
    description: "リアルタイムの天気を反映した全州半日コースです。",
    loading: "最適なコースを探しています...",
    error: "コースを読み込めませんでした。",
    retry: "再試行",
    refreshHint: "3分ごとに自動更新",
    outdoor: "屋外",
    indoor: "屋内",
    semiOutdoor: "半屋外",
    rating: "評価",
    menu: "メニュー",
    noMenu: "メニュー情報なし",
    nearby: "近くのおすすめ",
    startAt: "開始",
    empty: "現在の天気条件に合うコースが見つかりません。天気が良くなったらまたおすすめします。",
    fallbackNote: "デフォルトコースを表示中（天気データなし）。",
    dislike: "別の場所",
    dislikeHint: "別のおすすめを見る",
    excludedCount: "除外済",
  },
} as const

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  restaurant: <Utensils className="size-3.5" />,
  cafe: <Coffee className="size-3.5" />,
  bakery: <Coffee className="size-3.5" />,
  pub: <Utensils className="size-3.5" />,
  nature: <Sparkles className="size-3.5" />,
  attraction: <MapPin className="size-3.5" />,
  culture: <MapPin className="size-3.5" />,
  festival: <Sparkles className="size-3.5" />,
  sports: <MapPin className="size-3.5" />,
}

const TYPE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  야외: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  실내: { bg: "bg-sky-blue/10", text: "text-sky-blue", border: "border-sky-blue/20" },
  반실외: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
}

interface CourseRecommendationProps {
  weatherContext: ChatWeatherContext | null
  userProfile?: UserProfile | null
  userLat?: number | null
  userLon?: number | null
  className?: string
}

export function CourseRecommendation({ weatherContext, userProfile, userLat, userLon, className }: CourseRecommendationProps) {
  const { language } = useLanguage()
  const copy = COPY[language as keyof typeof COPY] ?? COPY.ko
  const [slots, setSlots] = useState<CourseSlotData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSlot, setExpandedSlot] = useState<number | null>(0)
  const [excludedNames, setExcludedNames] = useState<string[]>([])
  const excludeRef = useRef<string[]>([])

  const fetchCourse = useCallback(async (excludeList?: string[]) => {
    const list = excludeList ?? excludeRef.current
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/weather/recommendations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weatherContext, userProfile, userLat, userLon, excludeNames: list }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSlots(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(copy.error)
      console.error("Course fetch failed:", e)
    } finally {
      setLoading(false)
    }
  }, [weatherContext, userProfile, userLat, userLon, copy.error])

  useEffect(() => {
    excludeRef.current = excludedNames
    fetchCourse(excludedNames)
    const interval = setInterval(() => fetchCourse(), 3 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchCourse])

  const handleDislike = useCallback((slotIndex: number) => {
    if (slotIndex >= slots.length) return
    const slot = slots[slotIndex]
    const namesToExclude = slot.places.map(p => p.name)
    const next = [...new Set([...excludedNames, ...namesToExclude])]
    setExcludedNames(next)
    excludeRef.current = next
    fetchCourse(next)
  }, [slots, excludedNames, fetchCourse])

  const handleResetExclusions = useCallback(() => {
    setExcludedNames([])
    excludeRef.current = []
    fetchCourse([])
  }, [fetchCourse])

  const typeLabel = useMemo(() => {
    return (t: string) => {
      if (t === "야외") return copy.outdoor
      if (t === "실내") return copy.indoor
      return copy.semiOutdoor
    }
  }, [copy])

  if (loading) {
    return (
      <div className={cn("rounded-[2rem] border border-card-border/70 bg-card/90 p-5 sm:p-6 backdrop-blur-2xl", className)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-full bg-gradient-to-br from-sky-blue to-active-blue p-2.5 text-white shadow-md shadow-active-blue/20">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.24em] text-foreground">{copy.badge}</h3>
              <p className="text-xs text-muted-foreground">{copy.description}</p>
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-center py-12">
          <LoaderCircle className="size-6 animate-spin text-sky-blue" />
          <span className="ml-3 text-sm font-semibold text-muted-foreground">{copy.loading}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("rounded-[2rem] border border-card-border/70 bg-card/90 p-5 sm:p-6 backdrop-blur-2xl", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-full bg-gradient-to-br from-sky-blue to-active-blue p-2.5 text-white shadow-md shadow-active-blue/20">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.24em] text-foreground">{copy.badge}</h3>
            <p className="text-xs text-muted-foreground">{copy.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fetchCourse()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-card-border/70 bg-background/75 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-sky-blue/30 hover:text-sky-blue"
        >
          <RefreshCcw className={cn("size-3", loading && "animate-spin")} />
          <span className="hidden sm:inline">{copy.refreshHint}</span>
        </button>
      </div>

      {/* Weather context note */}
      {!weatherContext && (
        <div className="mt-4 flex items-center gap-2 rounded-[1.2rem] border border-amber-500/20 bg-amber-500/10 px-4 py-2.5">
          <CloudAlert className="size-4 text-amber-400 shrink-0" />
          <p className="text-xs font-semibold text-amber-400">{copy.fallbackNote}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-[1.4rem] border border-danger/20 bg-danger/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-danger">{error}</span>
            <button
              type="button"
              onClick={() => fetchCourse()}
              className="rounded-full border border-danger/20 px-3 py-1 text-xs font-bold text-danger"
            >
              {copy.retry}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!error && !loading && slots.length === 0 && (
        <div className="mt-5 rounded-[1.4rem] border border-card-border/70 bg-background/75 px-4 py-5 text-sm font-semibold text-muted-foreground text-center">
          {copy.empty}
        </div>
      )}

      {/* Timeline slots */}
      {!error && slots.length > 0 && (
        <div className="mt-5 space-y-3">
          {slots.map((slot, i) => {
            const isExpanded = expandedSlot === i
            const style = TYPE_STYLE[slot.type] ?? TYPE_STYLE.실내
            const isLast = i === slots.length - 1

            return (
              <div key={`${slot.time}-${i}`} className="relative">
                {/* Timeline connector */}
                {!isLast && (
                  <div className="absolute left-[19px] top-12 bottom-0 w-0.5 bg-gradient-to-b from-sky-blue/40 to-transparent" />
                )}

                <div
                  className={cn(
                    "relative rounded-[1.4rem] border bg-background/80 p-4 transition-all duration-300",
                    isExpanded
                      ? "border-sky-blue/30 ring-1 ring-sky-blue/10"
                      : "border-card-border/70 hover:border-sky-blue/20",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedSlot(isExpanded ? null : i)}
                    className="w-full text-left"
                  >
                    {/* Time badge + type */}
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-sky-blue/30 bg-sky-blue/10">
                        <Clock className="size-4 text-sky-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                            {copy.startAt} {i + 1}
                          </span>
                          <span className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em]",
                            style.border, style.bg, style.text,
                          )}>
                            {typeLabel(slot.type)}
                          </span>
                          <span className="text-[11px] font-black text-sky-blue">{slot.time}</span>
                        </div>
                        <h4 className="mt-1 text-base font-black text-foreground truncate">{slot.title}</h4>
                      </div>
                      <ChevronRight className={cn(
                        "size-4 text-muted-foreground shrink-0 transition-transform duration-300",
                        isExpanded && "rotate-90",
                      )} />
                    </div>

                    {/* Always-visible description */}
                    <p className="mt-2 text-sm leading-6 text-muted-foreground line-clamp-2">
                      {slot.description}
                    </p>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 space-y-2.5 border-t border-card-border/50 pt-4">
                      {slot.places.map((place, pi) => (
                        <div
                          key={`${place.name}-${pi}`}
                          className="flex items-start gap-3 rounded-[1.1rem] bg-muted/30 px-3.5 py-3"
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-blue/10 text-sky-blue">
                            {CATEGORY_ICON[place.category] ?? <MapPin className="size-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-foreground">{place.name}</span>
                              {place.rating != null && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-black text-amber-400">
                                  <Star className="size-2.5 fill-amber-400" />
                                  {place.rating.toFixed(1)}
                                </span>
                              )}
                            </div>
                            {place.address && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{place.address}</p>
                            )}
                            {place.menuSummary && (
                              <p className="mt-1 text-[11px] text-sky-blue/80 font-semibold">
                                {copy.menu}: {place.menuSummary}
                              </p>
                            )}
                            {place.reviewSummary && (
                              <p className="mt-1 text-[11px] text-foreground/80 leading-5 break-words">
                                "{place.reviewSummary}"
                              </p>
                            )}
                            {place.reviewPicks && place.reviewPicks.length > 0 && (
                              <div className="mt-1.5 flex flex-col gap-1">
                                {place.reviewPicks.slice(0, 2).map((pick, ri) => (
                                  <p key={ri} className="text-[10px] text-muted-foreground leading-4 break-words">
                                    {pick}
                                  </p>
                                ))}
                              </div>
                            )}
                            {place.reviewKeywords && place.reviewKeywords.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {place.reviewKeywords.map((kw, ki) => (
                                  <span key={ki} className="rounded-full border border-card-border/50 bg-muted/40 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {place.kakaoUrl && (
                            <a
                              href={place.kakaoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 rounded-full bg-muted/50 p-1.5 text-muted-foreground transition hover:bg-sky-blue/10 hover:text-sky-blue"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MapPin className="size-3.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Feedback: dislike this slot, get alternatives */}
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-card-border/40 pt-3">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDislike(i) }}
                      disabled={loading}
                      className="inline-flex items-center gap-1 rounded-full border border-card-border/60 bg-background/50 px-3 py-1.5 text-[11px] font-black text-muted-foreground transition hover:border-amber-500/30 hover:text-amber-400 disabled:opacity-30"
                      title={copy.dislikeHint}
                    >
                      <Shuffle className="size-3" />
                      {copy.dislike}
                    </button>
                    {excludedNames.length > 0 && i === 0 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleResetExclusions() }}
                        className="text-[10px] font-semibold text-muted-foreground/70 hover:text-sky-blue"
                      >
                        {excludedNames.length} {copy.excludedCount} ↺
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
