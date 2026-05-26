"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MapPin, Clock, Star, Utensils, Coffee, Sparkles, RefreshCcw, ChevronRight, LoaderCircle, CloudAlert, Shuffle, Home, Car, Footprints } from "lucide-react"
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
  lat?: number | null
  lon?: number | null
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
    startAt: "방문",
    empty: "현재 날씨 조건에 맞는 코스를 찾을 수 없어요. 날씨가 좋아지면 다시 추천해 드릴게요.",
    fallbackNote: "날씨 컨텍스트 없이 기본 코스를 표시합니다.",
    dislike: "다른 곳",
    dislikeHint: "이 장소 대신 다른 곳을 추천받기",
    excludedCount: "제외됨",
    
    // Journey Timeline 추가 번역
    startNode: "나들이 출발지",
    myLocation: "내 실시간 위치 (GPS)",
    defaultLocation: "전주 중심부 (기본 설정)",
    transitWalk: "도보 이동",
    transitDrive: "차량/택시 이동",
    finishNode: "나들이 완료 & 귀가",
    finishDescription: "오늘의 알찬 전주 나들이 여정이 마무리되었습니다. 조심히 귀가하세요!",
    returnHome: "출발지로 귀가",
    step1: "1차 방문지",
    step2: "2차 경유지",
    step3: "최종 목적지",
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
    startAt: "Visit",
    empty: "No suitable course found for current conditions. Check back when weather improves.",
    fallbackNote: "Showing default course (no weather context).",
    dislike: "Try elsewhere",
    dislikeHint: "Get a different recommendation",
    excludedCount: "excluded",

    // Journey Timeline English
    startNode: "Starting Point",
    myLocation: "My Location (GPS)",
    defaultLocation: "Jeonju City Center (Default)",
    transitWalk: "Walk",
    transitDrive: "Car/Taxi",
    finishNode: "Outing Completed",
    finishDescription: "Today's wonderful Jeonju outing has concluded. Have a safe trip home!",
    returnHome: "Return to Start",
    step1: "1st Destination",
    step2: "2nd Waypoint",
    step3: "Final Destination",
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
    startAt: "游览",
    empty: "当前天气条件下未找到合适的路线。天气好转后会再次推荐。",
    fallbackNote: "显示默认路线（无天气数据）。",
    dislike: "换一个",
    dislikeHint: "换其他地方推荐",
    excludedCount: "已排除",

    // Journey Timeline Chinese
    startNode: "纳凉出发地",
    myLocation: "当前位置 (GPS)",
    defaultLocation: "全州市中心 (默认)",
    transitWalk: "步行",
    transitDrive: "乘车/出租车",
    finishNode: "行程圆满结束",
    finishDescription: "今天的全州出行已圆满结束。祝您安全返航！",
    returnHome: "返回出发地",
    step1: "第一站",
    step2: "第二站 (途经)",
    step3: "最终目的地",
  },
  ja: {
    badge: "おすすめコース",
    title: "今日のおすすめコース",
    description: "リアルタイム의 天気を反映した全州半일コースです。",
    loading: "最適なコースを探しています...",
    error: "コースを読み込めませんでした。",
    retry: "再試行",
    refreshHint: "3분ごとに自動更新",
    outdoor: "屋外",
    indoor: "屋内",
    semiOutdoor: "半屋外",
    rating: "評価",
    menu: "メニュー",
    noMenu: "メニュー情報なし",
    nearby: "近くのおすすめ",
    startAt: "訪問",
    empty: "現在の天気条件に合うコースが見つかりません。天気が良くなったらまたおすすめします。",
    fallbackNote: "デフォルトコースを表示中（天気データなし）。",
    dislike: "別の場所",
    dislikeHint: "別のおすすめを見る",
    excludedCount: "除外済",

    // Journey Timeline Japanese
    startNode: "出発地",
    myLocation: "現在地 (GPS)",
    defaultLocation: "全州市中心部 (デフォルト)",
    transitWalk: "徒歩移動",
    transitDrive: "車/タクシー移動",
    finishNode: "お出かけ完了・帰路",
    finishDescription: "本日の充実した全州お出かけプランが終了しました。お気をつけてお帰りください！",
    returnHome: "出発地へ帰る",
    step1: "1番目の目的地",
    step2: "2番目の経由地",
    step3: "最終目的地",
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
  customCourse?: any[] | null
}

// Haversine distance calculator on client
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Transit routing calculator
function getRouteInfo(
  lat1: number | null | undefined,
  lon1: number | null | undefined,
  lat2: number | null | undefined,
  lon2: number | null | undefined,
  locale: string = "ko"
) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const dist = haversineKm(lat1, lon1, lat2, lon2)
  if (dist < 0.05) {
    return {
      text: locale === "ko" ? "바로 인접 (도보 1분 이내)" 
            : locale === "en" ? "Right next to it (walk < 1 min)"
            : locale === "zh" ? "紧邻 (步行不到1分钟)"
            : "すぐ隣 (徒歩 1 分以内)",
      dist,
      type: "walk" as const
    }
  }
  if (dist < 1.0) {
    const walkTime = Math.round(dist * 12) // ~5km/h = 12 min per km
    return {
      text: locale === "ko" ? `도보 약 ${walkTime}분 (약 ${Math.round(dist * 1000)}m)`
            : locale === "en" ? `Walk approx ${walkTime} min (approx ${Math.round(dist * 1000)}m)`
            : locale === "zh" ? `步行约 ${walkTime} 分钟 (约 ${Math.round(dist * 1000)}米)`
            : `徒歩約 ${walkTime} 分 (約 ${Math.round(dist * 1000)}m)`,
      dist,
      type: "walk" as const
    }
  } else {
    // 30km/h average in the city including traffic lights
    const driveTime = Math.round(dist * 2.5) + 2
    return {
      text: locale === "ko" ? `차량 약 ${driveTime}분 (${dist.toFixed(1)}km)`
            : locale === "en" ? `Car approx ${driveTime} min (${dist.toFixed(1)}km)`
            : locale === "zh" ? `乘车约 ${driveTime} 分钟 (${dist.toFixed(1)}公里)`
            : `車で約 ${driveTime} 分 (${dist.toFixed(1)}km)`,
      dist,
      type: "drive" as const
    }
  }
}

export function CourseRecommendation({ weatherContext, userProfile, userLat, userLon, className, customCourse }: CourseRecommendationProps) {
  const { language } = useLanguage()
  const copy = COPY[language as keyof typeof COPY] ?? COPY.ko
  const [slots, setSlots] = useState<CourseSlotData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSlot, setExpandedSlot] = useState<number | null>(0)
  const [excludedNames, setExcludedNames] = useState<string[]>([])
  const excludeRef = useRef<string[]>([])

  // Resolve starting coordinates (fallback to Jeonju center if no GPS)
  const originLat = userLat ?? 35.8242
  const originLon = userLon ?? 127.1480
  const hasGps = userLat != null && userLon != null

  const fetchCourse = useCallback(async (excludeList?: string[]) => {
    if (customCourse) {
      setLoading(true)
      setError(null)
      try {
        // Collect place names from custom course
        const names = customCourse.flatMap(slot => slot.places.map((p: any) => p.name))
        if (names.length > 0) {
          // Hydrate place coordinates and details from DB
          const res = await fetch("/api/places/hydrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ names }),
          })
          if (res.ok) {
            const data = await res.json()
            const placeMap = new Map<string, any>()
            if (Array.isArray(data?.places)) {
              data.places.forEach((p: any) => placeMap.set(p.name, p))
            }

            // Unify slots with DB verified coordinate metadata
            const hydratedSlots = customCourse.map((slot: any) => ({
              ...slot,
              places: slot.places.map((p: any) => {
                const db = placeMap.get(p.name)
                return {
                  ...p,
                  lat: db?.lat ?? p.lat ?? null,
                  lon: db?.lon ?? p.lon ?? null,
                  rating: db?.rating ?? p.rating ?? null,
                  address: db?.address ?? p.address ?? null,
                  menuSummary: db?.menuSummary ?? p.menuSummary ?? null,
                  kakaoUrl: db?.kakaoUrl ?? p.kakaoUrl ?? null,
                  reviewSummary: db?.reviewSummary ?? p.reviewSummary ?? null,
                  reviewKeywords: (db?.reviewKeywords?.length ? db.reviewKeywords : null) ?? p.reviewKeywords ?? [],
                  reviewPicks: (db?.reviewPicks?.length ? db.reviewPicks : null) ?? p.reviewPicks ?? [],
                }
              })
            }))
            setSlots(hydratedSlots)
          } else {
            setSlots(customCourse)
          }
        } else {
          setSlots(customCourse)
        }
      } catch (err) {
        console.error("Custom course hydration failed:", err)
        setSlots(customCourse)
      } finally {
        setLoading(false)
      }
      return
    }

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
  }, [weatherContext, userProfile, userLat, userLon, copy.error, customCourse])

  useEffect(() => {
    excludeRef.current = excludedNames
    fetchCourse(excludedNames)
    const interval = setInterval(() => {
      if (!customCourse) fetchCourse()
    }, 3 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchCourse, customCourse, excludedNames])

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

  // Helper for step progression titles
  const getStepTitle = (index: number) => {
    if (index === 0) return copy.step1
    if (index === 1) return copy.step2
    return copy.step3
  }

  // Precompute all route elements
  const routingData = useMemo(() => {
    if (slots.length === 0) return []
    const routes: any[] = []

    // 1. Route from Starting Point to Slot 1
    const p1 = slots[0]?.places[0]
    routes.push(getRouteInfo(originLat, originLon, p1?.lat, p1?.lon, language))

    // 2. Routes between Slots
    for (let i = 0; i < slots.length - 1; i++) {
      const from = slots[i]?.places[0]
      const to = slots[i + 1]?.places[0]
      routes.push(getRouteInfo(from?.lat, from?.lon, to?.lat, to?.lon, language))
    }

    // 3. Route from Last Slot back to Starting Point
    const pLast = slots[slots.length - 1]?.places[0]
    routes.push(getRouteInfo(pLast?.lat, pLast?.lon, originLat, originLon, language))

    return routes
  }, [slots, originLat, originLon, language])

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
    <div className={cn("rounded-[2rem] border border-card-border/70 bg-card/90 p-5 sm:p-6 backdrop-blur-2xl transition-all duration-500", customCourse && "border-sky-blue/30 ring-1 ring-sky-blue/10 shadow-lg shadow-sky-blue/5", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-full bg-gradient-to-br from-sky-blue to-active-blue p-2.5 text-white shadow-md shadow-active-blue/20">
            <Sparkles className="size-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-[0.24em] text-foreground">{copy.badge}</h3>
              {customCourse && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-blue/20 to-active-blue/20 px-2.5 py-0.5 text-[9px] font-black text-sky-blue border border-sky-blue/20 animate-pulse">
                  AI 맞춤형
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {customCourse ? "나들AI 챗봇과 실시간 대화를 통해 맞춤 구성한 전주 나들이 코스입니다." : copy.description}
            </p>
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
        <div className="mt-6 space-y-0">
          
          {/* ============================== 🏠 1. START POINT NODE ============================== */}
          <div className="relative">
            {/* Timeline connector down */}
            <div className="absolute left-[19px] top-12 bottom-0 w-0.5 bg-gradient-to-b from-sky-blue to-sky-blue/30" />

            <div className="relative rounded-[1.4rem] border border-sky-blue/20 bg-gradient-to-r from-sky-blue/5 to-transparent p-4 flex items-center gap-4.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-sky-blue bg-sky-blue/10 text-sky-blue shadow-lg shadow-sky-blue/10 animate-pulse">
                <MapPin className="size-4.5 fill-sky-blue/20" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-blue/80 bg-sky-blue/10 px-2 py-0.5 rounded-full">START</span>
                  <span className="text-xs font-bold text-muted-foreground">{copy.startNode}</span>
                </div>
                <h4 className="mt-1 text-sm font-black text-foreground truncate">
                  {hasGps ? copy.myLocation : copy.defaultLocation}
                </h4>
                <p className="mt-0.5 text-[10px] font-mono text-muted-foreground/80">
                  GPS: {originLat.toFixed(4)}, {originLon.toFixed(4)}
                </p>
              </div>
            </div>
          </div>

          {/* ============================== Slots & Transit Connections ============================== */}
          {slots.map((slot, i) => {
            const isExpanded = expandedSlot === i
            const style = TYPE_STYLE[slot.type] ?? TYPE_STYLE.실내
            const isLast = i === slots.length - 1
            const transitToThis = routingData[i] // Route from previous node to this slot
            const transitToNext = routingData[i + 1] // Route from this slot to next node (or home)

            return (
              <div key={`${slot.time}-${i}`}>
                
                {/* 🚗 Transit Path Badge BEFORE this slot */}
                {transitToThis && (
                  <div className="relative h-14">
                    {/* Dotted connector */}
                    <div className="absolute left-[19px] top-0 bottom-0 w-0.5 border-l-2 border-dashed border-sky-blue/35" />
                    
                    {/* Floating capsule info */}
                    <div className="absolute left-[20px] top-1/2 -translate-y-1/2 ml-5 z-10 flex items-center gap-1.5 rounded-full border border-card-border/60 bg-card/90 px-3 py-1 text-[10.5px] font-bold text-muted-foreground shadow-sm backdrop-blur-md">
                      {transitToThis.type === "walk" ? (
                        <Footprints className="size-3 text-emerald-400" />
                      ) : (
                        <Car className="size-3 text-sky-blue" />
                      )}
                      <span>{transitToThis.text}</span>
                    </div>
                  </div>
                )}

                {/* 📌 SLOT NODE */}
                <div className="relative">
                  {/* Timeline connector down */}
                  <div className="absolute left-[19px] top-12 bottom-0 w-0.5 bg-gradient-to-b from-sky-blue/30 to-sky-blue/30" />

                  <div
                    className={cn(
                      "relative rounded-[1.4rem] border bg-background/80 p-4 transition-all duration-300",
                      isExpanded
                        ? "border-sky-blue/30 ring-1 ring-sky-blue/10 shadow-md shadow-sky-blue/5"
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
                              {getStepTitle(i)}
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
                      <p className="mt-2 text-sm leading-6 text-muted-foreground whitespace-pre-line">
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
                                    <p key={ri} className="text-[10px] text-muted-foreground leading-4 break-words font-medium">
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
                              {place.lat && place.lon && (
                                <p className="mt-1 text-[9px] text-muted-foreground/60 font-mono">
                                  GPS: {place.lat.toFixed(4)}, {place.lon.toFixed(4)}
                                </p>
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
                    {!customCourse && (
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
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* ============================== 🚗 3. Transit Path Badge BEFORE the Finish node ============================== */}
          {routingData[routingData.length - 1] && (
            <div className="relative h-14">
              {/* Dotted connector */}
              <div className="absolute left-[19px] top-0 bottom-0 w-0.5 border-l-2 border-dashed border-sky-blue/35" />
              
              {/* Floating capsule info */}
              <div className="absolute left-[20px] top-1/2 -translate-y-1/2 ml-5 z-10 flex items-center gap-1.5 rounded-full border border-card-border/60 bg-card/90 px-3 py-1 text-[10.5px] font-bold text-muted-foreground shadow-sm backdrop-blur-md">
                <Car className="size-3 text-sky-blue" />
                <span className="text-[10px] font-semibold text-sky-blue/80 mr-0.5">{copy.returnHome}:</span>
                <span>{routingData[routingData.length - 1].text}</span>
              </div>
            </div>
          )}

          {/* ============================== 🏁 4. FINISH NODE ============================== */}
          <div className="relative">
            <div className="relative rounded-[1.4rem] border border-emerald-500/25 bg-gradient-to-r from-emerald-500/5 to-transparent p-4 flex items-center gap-4.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/10">
                <Home className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">FINISH</span>
                  <span className="text-xs font-bold text-muted-foreground">{copy.finishNode}</span>
                </div>
                <h4 className="mt-1 text-sm font-black text-foreground truncate">
                  {copy.finishDescription}
                </h4>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
