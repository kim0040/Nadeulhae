"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MapPin, Clock, Star, Utensils, Coffee, Sparkles, RefreshCcw, ChevronRight, LoaderCircle, CloudAlert, Shuffle, Home, Car, Footprints, Navigation, Palette, Bookmark, Check, Link2 } from "lucide-react"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"
import type { ChatWeatherContext } from "@/lib/chat/prompt"
import type { UserProfile, CourseTheme } from "@/lib/course-types"
import { COURSE_THEME_CONFIG } from "@/lib/course-types"

declare global {
  interface Window {
    kakao: any
  }
}

// Client-side cache for Kakao Maps key to avoid hitting API repeatedly (conserves DB usage count / daily quota)
let cachedKakaoKey: string | null = null
let cachedKakaoLoadErrorTime: number | null = null // TTL cache error timestamp

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
    beta: "BETA",
    title: "오늘의 추천 코스",
    description: "실시간 날씨를 반영한 전주 반나절 코스입니다.",
    loading: "날씨에 맞는 코스를 찾는 중...",
    error: "코스를 불러오지 못했어요.",
    retry: "다시 시도",
    refreshHint: "새로고침",
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
    customBadge: "AI 맞춤형",
    customDescription: "나들AI 챗봇과 실시간 대화를 통해 맞춤 구성한 전주 나들이 코스입니다.",
    save: "코스 저장",
    saving: "저장 중...",
    saved: "저장됨! 공유 링크가 준비됐어요.",
    saveError: "코스를 저장하지 못했어요.",
    shareCopy: "링크 복사",
    shareCopied: "복사됨",
    
    // Theme selector
    themeSelect: "코스 테마",
    themeHint: "원하는 스타일의 코스를 선택하세요",
    balanced: "균형잡힌 코스",
    foodie_focus: "맛집 탐방",
    nature_heal: "자연 힐링",
    date_night: "데이트 코스",
    family_fun: "가족 나들이",
    hidden_gem: "숨은 명소",
    rainy_day: "비 오는 날",
    
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
    
    // Kakao Map UI
    directions: "길찾기",
    mapView: "지도 보기",
    mapLoading: "인터랙티브 지도 불러오는 중...",
    mapError: "지도를 로딩할 수 없습니다 (설정 확인 필요)",
    mapErrorSubtext: "일일 쿼타 초과(50회) 또는 카카오 개발자 콘솔의 [플랫폼 > Web]에 현재 접속 주소(예: http://localhost:3000)가 정상 등록되어 있는지 확인해 주세요.",
    realtimeTraffic: "실시간 교통",
  },
  en: {
    badge: "Recommended Course",
    beta: "BETA",
    title: "Today's Course",
    description: "A half-day Jeonju itinerary based on real-time weather.",
    loading: "Finding the best course for today...",
    error: "Failed to load course.",
    retry: "Retry",
    refreshHint: "Refresh",
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
    customBadge: "AI Custom",
    customDescription: "A personalized Jeonju course customized through real-time chat with NadeulAI.",
    save: "Save course",
    saving: "Saving...",
    saved: "Saved! Your share link is ready.",
    saveError: "Failed to save the course.",
    shareCopy: "Copy link",
    shareCopied: "Copied",

    // Theme selector
    themeSelect: "Course Theme",
    themeHint: "Choose your preferred course style",
    balanced: "Balanced",
    foodie_focus: "Foodie Focus",
    nature_heal: "Nature Healing",
    date_night: "Date Night",
    family_fun: "Family Fun",
    hidden_gem: "Hidden Gem",
    rainy_day: "Rainy Day",

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

    // Kakao Map English
    directions: "Directions",
    mapView: "View Map",
    mapLoading: "Loading interactive map...",
    mapError: "Unable to load map (Check Settings)",
    mapErrorSubtext: "Quota exceeded (50/day) or check if your current URL (e.g., http://localhost:3000) is registered under [Platforms > Web] in the Kakao Developers Console.",
    realtimeTraffic: "Real-time",
  },
  zh: {
    badge: "推荐路线",
    beta: "BETA",
    title: "今日推荐路线",
    description: "基于实时天气的全州半日行程。",
    loading: "正在寻找最佳路线...",
    error: "无法加载路线。",
    retry: "重试",
    refreshHint: "刷新",
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
    customBadge: "AI 定制",
    customDescription: "通过与 NadeulAI 实时对话定制的个性化全州路线。",
    save: "保存路线",
    saving: "保存中...",
    saved: "已保存！分享链接已就绪。",
    saveError: "保存路线失败。",
    shareCopy: "复制链接",
    shareCopied: "已复制",

    // Theme selector
    themeSelect: "路线主题",
    themeHint: "选择您喜欢的路线风格",
    balanced: "均衡路线",
    foodie_focus: "美食探店",
    nature_heal: "自然疗愈",
    date_night: "约会路线",
    family_fun: "家庭出行",
    hidden_gem: "隐藏名所",
    rainy_day: "雨天路线",

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

    // Kakao Map Chinese
    directions: "导航",
    mapView: "查看地图",
    mapLoading: "正在加载地图...",
    mapError: "无法加载地图 (需要检查设置)",
    mapErrorSubtext: "每日限额已超(50次)或请检查当前域名(如 http://localhost:3000)是否已在 Kakao 控制台의 [平台 > Web] 中注册。",
    realtimeTraffic: "实时交通",
  },
  ja: {
    badge: "おすすめコース",
    beta: "BETA",
    title: "今日のおすすめコース",
    description: "リアルタイムの天気を反映した全州半日コースです。",
    loading: "最適なコースを探しています...",
    error: "コースを読み込めませんでした。",
    retry: "再試行",
    refreshHint: "更新",
    outdoor: "屋外",
    indoor: "屋内",
    semiOutdoor: "半屋外",
    rating: "評価",
    menu: "メニュー",
    noMenu: "メニュー情報なし",
    nearby: "近くのおすすめ",
    startAt: "訪問",
    empty: "現在の天気条件に合うコースが見つかりませんでした。天気が良くなったら再度おすすめします。",
    fallbackNote: "デフォルトコースを表示中（天気データなし）。",
    dislike: "別の場所",
    dislikeHint: "別のおすすめを見る",
    excludedCount: "除外済",
    customBadge: "AI カスタマイズ",
    customDescription: "ナ들AI チャットボットとのリアルタイム対話を通じてカスタマイズされた全州お出かけコースです。",
    save: "コースを保存",
    saving: "保存中...",
    saved: "保存しました！共有リンクの準備ができました。",
    saveError: "コースを保存できませんでした。",
    shareCopy: "リンクをコピー",
    shareCopied: "コピー済み",

    // Theme selector
    themeSelect: "コーステーマ",
    themeHint: "お好みのコーススタイルを選択してください",
    balanced: "バランス",
    foodie_focus: "グルメ",
    nature_heal: "自然癒し",
    date_night: "デート",
    family_fun: "家族お出かけ",
    hidden_gem: "穴場スポット",
    rainy_day: "雨の日",

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

    // Kakao Map Japanese
    directions: "ルート",
    mapView: "地図を見る",
    mapLoading: "インタラクティブ地図を読み込み中...",
    mapError: "地図をロードできません (設定確認が必要)",
    mapErrorSubtext: "1日の制限(50回)を超過したか、現在のドメイン(例: http://localhost:3000)がKakao開発者コンソールの[プラットフォーム > Web]に登録されているか確認してください。",
    realtimeTraffic: "リアルタイム交通",
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
  onThemeChange?: (theme: CourseTheme) => void
  onCourseReset?: () => void
  /** Read-only public view (shared link): hides save/refresh/swap controls. */
  readOnly?: boolean
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
  locale: string = "ko",
  transportMode: "walk" | "drive" | "auto" = "auto"
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
  
  // 사용자가 도보로 이동한다고 명시한 경우 항상 도보 시간 표시
  if (transportMode === "walk") {
    const walkTime = Math.round(dist * 12) // ~5km/h = 12 min per km
    return {
      text: locale === "ko" ? `도보 약 ${walkTime}분 (약 ${Math.round(dist * 1000)}m)`
            : locale === "en" ? `Walk approx ${walkTime} min (approx ${Math.round(dist * 1000)}m)`
            : locale === "zh" ? `步行约 ${walkTime} 分钟 (约 ${Math.round(dist * 1000)}米)`
            : `徒歩約 ${walkTime} 分 (約 ${Math.round(dist * 1000)}m)`,
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
    // 30km/h average in the city including traffic signals
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

// Subcomponent to load and render dynamic Kakao Map dynamically client side
interface KakaoPlaceMapProps {
  placeName: string
  lat: number
  lon: number
  kakaoKeyLoaded: boolean
  loadError: boolean
  localeCopy: { mapLoading: string; mapError: string; mapErrorSubtext: string }
  heightClass?: string
}

export function KakaoPlaceMap({ placeName, lat, lon, kakaoKeyLoaded, loadError, localeCopy, heightClass }: KakaoPlaceMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapInitialized, setMapInitialized] = useState(false)

  useEffect(() => {
    if (!kakaoKeyLoaded || loadError || !mapRef.current) return

    let isAborted = false
    let timeoutId: any = null
    let intervalId: any = null

    const initMap = () => {
      if (isAborted) return
      try {
        if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) {
          // Wait for window namespace to settle
          timeoutId = setTimeout(initMap, 150)
          return
        }

        // Clean container innerHTML to prevent duplicate canvas mounting leaks
        if (mapRef.current) {
          mapRef.current.innerHTML = ""
        }

        const container = mapRef.current
        if (!container) return

        const options = {
          center: new window.kakao.maps.LatLng(lat, lon),
          level: 3,
        }
        
        const map = new window.kakao.maps.Map(container, options)
        
        // Add single marker at coordinates
        const markerPosition = new window.kakao.maps.LatLng(lat, lon)
        const marker = new window.kakao.maps.Marker({
          position: markerPosition,
        })
        marker.setMap(map)

        // Add info window for place name
        const iwContent = `<div style="padding:5px;font-size:12px;color:#000;text-align:center;width:150px;font-weight:bold;">${placeName}</div>`
        const infowindow = new window.kakao.maps.InfoWindow({
          content: iwContent
        })
        infowindow.open(map, marker)

        // Add standard zoom control UI
        const zoomControl = new window.kakao.maps.ZoomControl()
        map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT)

        setMapInitialized(true)
      } catch (err) {
        console.error("[KakaoMap] Failed to initialize map canvas:", err)
      }
    }

    if (window.kakao && window.kakao.maps) {
      if (window.kakao.maps.Map) {
        initMap()
      } else {
        window.kakao.maps.load(initMap)
      }
    } else {
      intervalId = setInterval(() => {
        if (window.kakao && window.kakao.maps && window.kakao.maps.Map) {
          clearInterval(intervalId)
          initMap()
        }
      }, 300)
    }

    return () => {
      isAborted = true
      if (timeoutId) clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [lat, lon, kakaoKeyLoaded, loadError, placeName])

  if (loadError) {
    return (
      <div className={cn("mt-3 flex w-full flex-col items-center justify-center rounded-2xl border border-danger/10 bg-danger/5 px-4 text-center", heightClass || "h-52 sm:h-64")}>
        <MapPin className="size-5 text-danger/50 shrink-0" />
        <p className="mt-1 text-xs font-bold text-danger">{localeCopy.mapError}</p>
        <p className="mt-1 text-[9px] text-muted-foreground leading-4 max-w-sm text-center">{localeCopy.mapErrorSubtext}</p>
      </div>
    )
  }

  return (
    <div className={cn("relative mt-3 w-full overflow-hidden rounded-2xl border border-card-border/60 bg-muted/20 shadow-md group transition-[border-color] duration-300 hover:border-sky-blue/30", heightClass || "h-52 sm:h-64")}>
      {/* Kakao map tiles are always light; in dark mode invert + hue-rotate the
          tile layer only (not the themed overlays below) so the map blends with
          the dark theme instead of glaring bright. No effect in light mode. */}
      <div ref={mapRef} className="w-full h-full transition-transform duration-500 group-hover:scale-[1.01] dark:[filter:invert(0.9)_hue-rotate(180deg)_brightness(1.05)]" />
      {!mapInitialized && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-[2.5px] gap-2">
          <LoaderCircle className="size-4 animate-spin text-sky-blue" />
          <span className="text-[10px] text-muted-foreground font-semibold">{localeCopy.mapLoading}</span>
        </div>
      )}
    </div>
  )
}

export function CourseRecommendation({ weatherContext, userProfile, userLat, userLon, className, customCourse, onThemeChange, onCourseReset, readOnly = false }: CourseRecommendationProps) {
  const { language } = useLanguage()
  const copy = useMemo(() => COPY[language as keyof typeof COPY] ?? COPY.ko, [language])
  const [slots, setSlots] = useState<CourseSlotData[]>([])
  const safeSetSlots = useCallback((nextSlots: CourseSlotData[]) => {
    setSlots((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(nextSlots)) {
        return prev;
      }
      return nextSlots;
    });
  }, []);
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSlot, setExpandedSlot] = useState<number | null>(0)
  const [excludedNames, setExcludedNames] = useState<string[]>([])
  // Save & share state
  const [saving, setSaving] = useState(false)
  const [savedToken, setSavedToken] = useState<string | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const shareCopyTimerRef = useRef<number | null>(null)
  const [selectedTheme, setSelectedTheme] = useState<CourseTheme>("balanced")
  const selectedThemeRef = useRef<CourseTheme>(selectedTheme)
  useEffect(() => {
    selectedThemeRef.current = selectedTheme
  }, [selectedTheme])

  useEffect(() => {
    return () => {
      if (shareCopyTimerRef.current != null) {
        window.clearTimeout(shareCopyTimerRef.current)
        shareCopyTimerRef.current = null
      }
    }
  }, [])
  
  // Props를 useRef로 안정화
  const propsRef = useRef({ weatherContext, userProfile, customCourse, onThemeChange, onCourseReset })
  useEffect(() => { propsRef.current = { weatherContext, userProfile, customCourse, onThemeChange, onCourseReset } })

  // Kakao Map SDK integration state
  const [kakaoKey, setKakaoKey] = useState<string | null>(null)
  const [kakaoLoadError, setKakaoLoadError] = useState(false)
  const kakaoKeyLoaded = kakaoKey != null

  // Real-time directions state
  const [realtimeRoutes, setRealtimeRoutes] = useState<any[]>([])

  // fetchCourse 함수 (안정적인 참조)
  const fetchCourse = useCallback(async (excludeList?: string[], themeOverride?: CourseTheme) => {
    const { weatherContext: wx, userProfile: profile, customCourse: cc } = propsRef.current
    
    if (cc) {
      setLoading(true)
      setError(null)
      try {
        const names = cc.flatMap((slot: any) => slot.places?.map((p: any) => p.name) || [])
        if (names.length > 0) {
          const res = await fetch("/api/places/hydrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ names }),
          })
          if (res.ok) {
            const data = await res.json()
            // Match on a normalized key (lowercased, whitespace-stripped) so a
            // slight name drift between the LLM output and the DB row still
            // resolves — mirrors the server-side matching in /api/places/hydrate.
            const normalizeName = (value: string) => value.toLowerCase().replace(/\s+/g, "")
            const placeMap = new Map<string, any>()
            if (Array.isArray(data?.places)) {
              data.places.forEach((p: any) => {
                if (p?.name) placeMap.set(normalizeName(String(p.name)), p)
              })
            }
            const hydratedSlots = cc.map((slot: any) => ({
              ...slot,
              places: (slot.places || []).map((p: any) => {
                const db = p?.name ? placeMap.get(normalizeName(String(p.name))) : undefined
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
            safeSetSlots(hydratedSlots)
          } else {
            safeSetSlots(cc)
          }
        } else {
          safeSetSlots(cc)
        }
      } catch (err) {
        console.error("Custom course hydration failed:", err)
        safeSetSlots(cc)
      } finally {
        setLoading(false)
      }
      return
    }

    const list = excludeList ?? []
    const theme = themeOverride ?? selectedThemeRef.current ?? "balanced"
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/weather/recommendations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          weatherContext: wx, 
          userProfile: profile, 
          userLat, 
          userLon, 
          excludeNames: list, 
          theme, 
          language 
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      safeSetSlots(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(copy.error)
      console.error("Course fetch failed:", e)
    } finally {
      setLoading(false)
    }
  }, [userLat, userLon, language, copy.error, safeSetSlots])

  // Theme change handler
  const handleThemeChange = useCallback((theme: CourseTheme) => {
    setSelectedTheme(theme)
    propsRef.current.onThemeChange?.(theme)
    if (propsRef.current.customCourse) {
      propsRef.current.onCourseReset?.()
    }
    fetchCourse([], theme)
  }, [fetchCourse])

  // Save the current course and get a shareable link.
  const handleSaveCourse = useCallback(async () => {
    if (saving || slots.length === 0) return
    setSaving(true)
    setSaveError(false)
    try {
      const title = propsRef.current.customCourse ? copy.customBadge : copy.title
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slots,
          weatherSnapshot: propsRef.current.weatherContext ?? null,
          isPublic: true,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data?.shareToken) {
        setSavedToken(String(data.shareToken))
        setShareCopied(false)
      } else {
        setSaveError(true)
      }
    } catch (err) {
      console.error("Save course failed:", err)
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }, [saving, slots, copy.customBadge, copy.title])

  const handleCopyShareLink = useCallback(async () => {
    if (!savedToken || typeof window === "undefined") return
    const url = `${window.location.origin}/courses/${savedToken}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard may be unavailable (insecure context); the link is still shown.
    }
    setShareCopied(true)
    if (shareCopyTimerRef.current != null) {
      window.clearTimeout(shareCopyTimerRef.current)
    }
    shareCopyTimerRef.current = window.setTimeout(() => {
      setShareCopied(false)
      shareCopyTimerRef.current = null
    }, 1600)
  }, [savedToken])

  // A new/changed course invalidates any previously-generated share link.
  useEffect(() => {
    setSavedToken(null)
    setSaveError(false)
    if (shareCopyTimerRef.current != null) {
      window.clearTimeout(shareCopyTimerRef.current)
      shareCopyTimerRef.current = null
    }
    setShareCopied(false)
  }, [slots])

  // Fetch Kakao Maps JS Key
  useEffect(() => {
    if (cachedKakaoKey) {
      setKakaoKey(cachedKakaoKey)
      return
    }
    const ONE_HOUR = 60 * 60 * 1000
    if (cachedKakaoLoadErrorTime && (Date.now() - cachedKakaoLoadErrorTime < ONE_HOUR)) {
      setKakaoLoadError(true)
      return
    }
    fetch("/api/places/kakao-config")
      .then((res) => {
        if (!res.ok) throw new Error("Quota exceeded")
        return res.json()
      })
      .then((data) => {
        if (data.kakaoKey) {
          cachedKakaoKey = data.kakaoKey
          setKakaoKey(data.kakaoKey)
        } else {
          cachedKakaoLoadErrorTime = Date.now()
          setKakaoLoadError(true)
        }
      })
      .catch(() => {
        cachedKakaoLoadErrorTime = Date.now()
        setKakaoLoadError(true)
      })
  }, [])

  // Inject Kakao Maps SDK script
  useEffect(() => {
    if (!kakaoKey) return
    if (window.kakao && window.kakao.maps) return

    const scriptId = "kakao-maps-sdk"
    if (document.getElementById(scriptId)) return

    const script = document.createElement("script")
    script.id = scriptId
    script.type = "text/javascript"
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&autoload=false`
    script.async = true
    script.onload = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {})
      }
    }
    script.onerror = () => {
      cachedKakaoLoadErrorTime = Date.now()
      setKakaoLoadError(true)
    }
    document.head.appendChild(script)
  }, [kakaoKey])

  // Resolve starting coordinates
  const originLat = userLat ?? 35.8242
  const originLon = userLon ?? 127.1480
  const hasGps = userLat != null && userLon != null

  // customCourse 실제 내용 값 기반의 변화 감지를 위한 ref 사용 (주소 꼬리물기 방지)
  const lastCustomCourseStrRef = useRef<string>("")

  // 초기 로딩 및 customCourse 변경 대응 (일반 코스 <-> AI 맞춤형 코스 원활한 연동)
  useEffect(() => {
    const currentCcStr = customCourse ? JSON.stringify(customCourse) : ""
    if (lastCustomCourseStrRef.current !== currentCcStr) {
      lastCustomCourseStrRef.current = currentCcStr
      fetchCourse(undefined, selectedThemeRef.current)
    }
  }, [customCourse, fetchCourse])

  const handleDislike = useCallback((slotIndex: number) => {
    if (slotIndex >= slots.length) return
    const slot = slots[slotIndex]
    const namesToExclude = slot?.places?.map((p: any) => p.name) || []
    const next = [...new Set([...excludedNames, ...namesToExclude])]
    setExcludedNames(next)
    fetchCourse(next, selectedThemeRef.current)
  }, [slots, excludedNames, fetchCourse])

  const handleResetExclusions = useCallback(() => {
    setExcludedNames([])
    fetchCourse([], selectedThemeRef.current)
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

  // Fallback synchronous routing (client-side heuristic)
  const heuristicRoutingData = useMemo(() => {
    if (slots.length === 0) return []
    const routes: any[] = []

    // 1. Starting Point ➔ Slot 1
    const p1 = slots[0]?.places?.[0]
    routes.push(getRouteInfo(originLat, originLon, p1?.lat, p1?.lon, language))

    // 2. Routes between Slots
    for (let i = 0; i < slots.length - 1; i++) {
      const from = slots[i]?.places?.[0]
      const to = slots[i + 1]?.places?.[0]
      routes.push(getRouteInfo(from?.lat, from?.lon, to?.lat, to?.lon, language))
    }

    // 3. Last Slot ➔ Starting Point (Return Home)
    const pLast = slots[slots.length - 1]?.places?.[0]
    routes.push(getRouteInfo(pLast?.lat, pLast?.lon, originLat, originLon, language))

    return routes
  }, [slots, originLat, originLon, language])

  // Fetch real-time traffic directions asynchronously (Stale-While-Revalidate with Debounce & Lock)
  const realtimeFetchInFlightRef = useRef<boolean>(false)
  const realtimeFetchRunIdRef = useRef(0)
  useEffect(() => {
    const runId = realtimeFetchRunIdRef.current + 1
    realtimeFetchRunIdRef.current = runId
    let cancelled = false
    let controller: AbortController | null = null
    const isCurrentRun = () => !cancelled && realtimeFetchRunIdRef.current === runId

    // Clear previous routes immediately to avoid showing stale route info for new slots (Fixes Bug #3)
    setRealtimeRoutes([])

    if (slots.length === 0) {
      return () => {
        cancelled = true
      }
    }

    const timer = window.setTimeout(async () => {
      if (realtimeFetchInFlightRef.current) return
      realtimeFetchInFlightRef.current = true
      controller = new AbortController()

      const transitions: any[] = []

      // 1. Starting Point ➔ Slot 1
      const p1 = slots[0]?.places?.[0]
      transitions.push({ lat1: originLat, lon1: originLon, lat2: p1?.lat, lon2: p1?.lon })

      // 2. Slot i ➔ Slot i+1
      for (let i = 0; i < slots.length - 1; i++) {
        const from = slots[i]?.places?.[0]
        const to = slots[i + 1]?.places?.[0]
        transitions.push({ lat1: from?.lat, lon1: from?.lon, lat2: to?.lat, lon2: to?.lon })
      }

      // 3. Last Slot ➔ Starting Point (Return Home)
      const pLast = slots[slots.length - 1]?.places?.[0]
      transitions.push({ lat1: pLast?.lat, lon1: pLast?.lon, lat2: originLat, lon2: originLon })

      try {
        const results: any[] = new Array(transitions.length).fill(null)
        
        // Sequential fetch with 100ms spacing to completely bypass throttle limit triggers
        for (let idx = 0; idx < transitions.length; idx++) {
          const t = transitions[idx]
          if (t.lat1 == null || t.lon1 == null || t.lat2 == null || t.lon2 == null) {
            continue
          }

          if (idx > 0) {
            await new Promise((r) => setTimeout(r, 100))
          }

          try {
            const res = await fetch("/api/places/directions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({ lat1: t.lat1, lon1: t.lon1, lat2: t.lat2, lon2: t.lon2 }),
            })

            if (res.ok) {
              const data = await res.json()
              const dist = data.distanceMeters / 1000 // KM
              const timeMin = Math.round(data.durationSeconds / 60)
              
              let text = ""
              let type: "walk" | "drive" = dist < 1.0 ? "walk" : "drive"

              if (dist < 0.05) {
                text = language === "ko" ? "바로 인접 (도보 1분 이내)" 
                      : language === "en" ? "Right next to it (walk < 1 min)"
                      : language === "zh" ? "紧邻 (步行不到1分钟)"
                      : "すぐ隣 (徒歩 1 分以内)"
                type = "walk"
              } else if (dist < 1.0) {
                text = language === "ko" ? `도보 약 ${timeMin}분 (약 ${data.distanceMeters}m)`
                      : language === "en" ? `Walk approx ${timeMin} min (approx ${data.distanceMeters}m)`
                      : language === "zh" ? `步行约 ${timeMin} 分钟 (约 ${data.distanceMeters}米)`
                      : `徒歩約 ${timeMin} 分 (約 ${data.distanceMeters}m)`
                type = "walk"
              } else {
                text = language === "ko" ? `차량 약 ${timeMin}분 (${dist.toFixed(1)}km)`
                      : language === "en" ? `Car approx ${timeMin} min (${dist.toFixed(1)}km)`
                      : language === "zh" ? `乘车约 ${timeMin} 分钟 (${dist.toFixed(1)}公里)`
                      : `車で約 ${timeMin} 分 (${dist.toFixed(1)}km)`
                type = "drive"
              }

              results[idx] = { text, dist, type, source: data.source }
            }
          } catch (err) {
            if (!isCurrentRun() || (err instanceof DOMException && err.name === "AbortError")) {
              continue
            }
            console.warn(`[DirectionsAPI] Transition ${idx} fetch failed:`, err)
          }
        }

        if (isCurrentRun()) {
          setRealtimeRoutes(results)
        }
      } catch (err) {
        if (isCurrentRun()) {
          console.error("[KakaoMap] Asynchronous directions fetch failed:", err)
        }
      } finally {
        if (realtimeFetchRunIdRef.current === runId) {
          realtimeFetchInFlightRef.current = false
        }
      }
    }, 600)

    return () => {
      cancelled = true
      if (realtimeFetchRunIdRef.current === runId) {
        realtimeFetchInFlightRef.current = false
      }
      window.clearTimeout(timer)
      controller?.abort()
    }
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
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-[0.24em] text-foreground">{copy.badge}</h3>
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-black text-amber-600 border border-amber-500/20">{copy.beta}</span>
              </div>
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
    <div className={cn("rounded-[2rem] border border-card-border/70 bg-card/90 p-5 sm:p-6 backdrop-blur-2xl transition-[border-color,box-shadow] duration-500", customCourse && "border-sky-blue/30 ring-1 ring-sky-blue/10 shadow-lg shadow-sky-blue/5", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-full bg-gradient-to-br from-sky-blue to-active-blue p-2.5 text-white shadow-md shadow-active-blue/20">
            <Sparkles className="size-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-[0.24em] text-foreground">{copy.badge}</h3>
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-black text-amber-600 border border-amber-500/20">{copy.beta}</span>
              {customCourse && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-blue/20 to-active-blue/20 px-2.5 py-0.5 text-[9px] font-black text-sky-blue border border-sky-blue/20 animate-pulse">
                  {copy.customBadge}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {customCourse ? copy.customDescription : copy.description}
            </p>
          </div>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {slots.length > 0 && !loading && (
              <button
                type="button"
                onClick={() => void handleSaveCourse()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-blue/30 bg-sky-blue/10 px-3 py-1.5 text-xs font-semibold text-sky-blue transition hover:border-sky-blue/50 hover:bg-sky-blue/15 disabled:opacity-60"
              >
                {saving ? <LoaderCircle className="size-3 animate-spin" /> : <Bookmark className="size-3" />}
                <span className="hidden sm:inline">{saving ? copy.saving : copy.save}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => fetchCourse(excludedNames, selectedThemeRef.current)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-card-border/70 bg-background/75 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-sky-blue/30 hover:text-sky-blue"
            >
              <RefreshCcw className={cn("size-3", loading && "animate-spin")} />
              <span className="hidden sm:inline">{copy.refreshHint}</span>
            </button>
          </div>
        )}
      </div>

      {/* Save result / share link */}
      {saveError && (
        <div role="alert" className="mt-3 rounded-[1rem] border border-danger/20 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          {copy.saveError}
        </div>
      )}
      {savedToken && typeof window !== "undefined" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[1rem] border border-sky-blue/20 bg-sky-blue/5 px-3 py-2">
          <Check className="size-3.5 shrink-0 text-sky-blue" />
          <span className="text-xs font-semibold text-foreground">{copy.saved}</span>
          <div className="ml-auto flex items-center gap-2">
            <code className="max-w-[46vw] truncate rounded bg-background/70 px-2 py-1 text-[11px] text-muted-foreground sm:max-w-xs">
              {`${window.location.origin}/courses/${savedToken}`}
            </code>
            <button
              type="button"
              onClick={() => void handleCopyShareLink()}
              className="inline-flex items-center gap-1 rounded-full border border-sky-blue/30 bg-sky-blue/10 px-2.5 py-1 text-[11px] font-bold text-sky-blue transition hover:bg-sky-blue/15"
            >
              {shareCopied ? <Check className="size-3" /> : <Link2 className="size-3" />}
              {shareCopied ? copy.shareCopied : copy.shareCopy}
            </button>
          </div>
        </div>
      )}

      {/* Theme Selector */}
      {!customCourse && (
        <div className="mt-4 rounded-[1.2rem] border border-card-border/50 bg-background/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="size-3.5 text-sky-blue" />
            <span className="text-[11px] font-bold text-muted-foreground">{copy.themeSelect}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(COURSE_THEME_CONFIG) as CourseTheme[]).map((themeKey) => (
              <button
                key={themeKey}
                type="button"
                onClick={() => handleThemeChange(themeKey)}
                className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-bold transition-[background-color,color,box-shadow,scale] duration-200 active:scale-[0.96]",
                  selectedTheme === themeKey
                    ? "bg-sky-blue text-white shadow-md shadow-sky-blue/20"
                    : "bg-muted/50 text-muted-foreground hover:bg-sky-blue/10 hover:text-sky-blue"
                )}
              >
                {copy[themeKey] ?? COURSE_THEME_CONFIG[themeKey].labelKo}
              </button>
            ))}
          </div>
        </div>
      )}

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
              onClick={() => fetchCourse(excludedNames, selectedThemeRef.current)}
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
            
            // Progressive enhancement: render real-time DB directions if loaded, fallback to client heuristic
            const transitToThis = realtimeRoutes[i] || heuristicRoutingData[i]

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
                      {transitToThis.source === "kakao" && (
                        <span className="inline-flex items-center rounded bg-sky-blue/10 px-1 py-0.2 text-[8px] font-black text-sky-blue border border-sky-blue/15 scale-[0.9]">
                          {copy.realtimeTraffic}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 📌 SLOT NODE */}
                <div className="relative">
                  {/* Timeline connector down */}
                  <div className="absolute left-[19px] top-12 bottom-0 w-0.5 bg-gradient-to-b from-sky-blue/30 to-sky-blue/30" />

                  <div
                    className={cn(
                      "relative rounded-[1.4rem] border bg-background/80 p-4 transition-[border-color,box-shadow,scale] duration-300",
                      isExpanded
                        ? "border-sky-blue/40 ring-1 ring-sky-blue/10 shadow-lg shadow-sky-blue/5 scale-[1.004]"
                        : "border-card-border/70 hover:border-sky-blue/25 hover:shadow-md hover:shadow-sky-blue/5",
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
                        {slot.places?.map((place, pi) => (
                          <div
                            key={`${place.name}-${pi}`}
                            className="flex flex-col gap-3 rounded-[1.2rem] border border-card-border/40 bg-card/45 backdrop-blur-[2px] px-4 py-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-[border-color,box-shadow,scale] duration-300 hover:scale-[1.01] hover:border-sky-blue/30 hover:shadow-md"
                          >
                            <div className="flex items-start gap-3 w-full">
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
                                    &ldquo;{place.reviewSummary}&rdquo;
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
                              <div className="flex flex-col gap-1.5 shrink-0">
                                {place.kakaoUrl && (
                                  <a
                                    href={place.kakaoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full bg-muted/60 hover:bg-sky-blue/15 hover:text-sky-blue px-2.5 py-1 text-[10px] font-bold text-muted-foreground transition"
                                    onClick={(e) => e.stopPropagation()}
                                    title={copy.mapView}
                                  >
                                    <MapPin className="size-3" />
                                    <span>{copy.mapView}</span>
                                  </a>
                                )}
                                {place.lat && place.lon && (
                                  <a
                                    href={`https://map.kakao.com/link/to/${place.name},${place.lat},${place.lon}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full bg-muted/60 hover:bg-emerald-500/15 hover:text-emerald-400 px-2.5 py-1 text-[10px] font-bold text-muted-foreground transition"
                                    onClick={(e) => e.stopPropagation()}
                                    title={copy.directions}
                                  >
                                    <Navigation className="size-3" />
                                    <span>{copy.directions}</span>
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Dynamic Kakao Map Integration (Client Side render) */}
                            {place.lat != null && place.lon != null && (
                              <KakaoPlaceMap
                                placeName={place.name}
                                lat={place.lat}
                                lon={place.lon}
                                kakaoKeyLoaded={kakaoKeyLoaded}
                                loadError={kakaoLoadError}
                                localeCopy={copy}
                              />
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
          {(() => {
            const transitToHome = realtimeRoutes[realtimeRoutes.length - 1] || heuristicRoutingData[heuristicRoutingData.length - 1]
            if (!transitToHome) return null

            return (
              <div className="relative h-14">
                {/* Dotted connector */}
                <div className="absolute left-[19px] top-0 bottom-0 w-0.5 border-l-2 border-dashed border-sky-blue/35" />
                
                {/* Floating capsule info */}
                <div className="absolute left-[20px] top-1/2 -translate-y-1/2 ml-5 z-10 flex items-center gap-1.5 rounded-full border border-card-border/60 bg-card/90 px-3 py-1 text-[10.5px] font-bold text-muted-foreground shadow-sm backdrop-blur-md">
                  {transitToHome?.type === "walk" ? (
                    <Footprints className="size-3 text-emerald-400" />
                  ) : (
                    <Car className="size-3 text-sky-blue" />
                  )}
                  <span className="text-[10px] font-semibold text-sky-blue/80 mr-0.5">{copy.returnHome}:</span>
                  <span>{transitToHome?.text ?? "--"}</span>
                  {transitToHome?.source === "kakao" && (
                    <span className="inline-flex items-center rounded bg-sky-blue/10 px-1 py-0.2 text-[8px] font-black text-sky-blue border border-sky-blue/15 scale-[0.9]">
                      {copy.realtimeTraffic}
                    </span>
                  )}
                </div>
              </div>
            )
          })()}

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
