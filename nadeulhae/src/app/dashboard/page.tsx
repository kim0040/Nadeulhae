"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CloudSun,
  LogOut,
  Mail,
  MapPinned,
  Navigation,
  RefreshCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react"
import { useTheme } from "next-themes"

import { MagicCard } from "@/components/magicui/magic-card"
import { BorderBeam } from "@/components/magicui/border-beam"
import { Meteors } from "@/components/magicui/meteors"
import { Particles } from "@/components/magicui/particles"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { TodayHourlyForecast, type HourlyForecastItem } from "@/components/today-hourly-forecast"
import { PicnicBriefing } from "@/components/picnic-briefing"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import {
  AGE_BAND_OPTIONS,
  INTEREST_OPTIONS,
  MAX_INTEREST_SELECTIONS,
  PRIMARY_REGION_OPTIONS,
  TIME_SLOT_OPTIONS,
  WEATHER_SENSITIVITY_OPTIONS,
  getOptionLabel,
} from "@/lib/auth/profile-options"
import type { AuthResponseBody, AuthUser } from "@/lib/auth/types"
import { cn } from "@/lib/utils"
import { dataService, type WeatherData } from "@/services/dataService"

type ProfileFormState = {
  displayName: string
  ageBand: string
  primaryRegion: string
  interestTags: string[]
  interestOther: string
  preferredTimeSlot: string
  weatherSensitivity: string[]
  marketingAccepted: boolean
}

type ChatMessage =
  | { id: string; role: "assistant"; kind: "intro" | "pending" }
  | { id: string; role: "user"; kind: "text"; text: string }

const DASHBOARD_COPY = {
  ko: {
    badge: "user cockpit",
    title: "대시보드",
    subtitle: "개인 날씨 브리핑, 회원 정보 관리, 추후 붙일 챗봇 작업공간까지 한 화면에서 관리합니다.",
    heroLead: "오늘의 사용자 워크스페이스",
    heroDescription:
      "실시간 날씨 상세, 저장된 취향 프로필, 계정 제어와 LLM 챗봇 UI 스캐폴드를 하나의 대시보드에 모았습니다.",
    redirecting: "로그인이 필요합니다. 로그인 페이지로 이동합니다.",
    weatherTitle: "실시간 날씨 상세",
    weatherDescription: "현재 위치 또는 기본 지역 기준으로 실시간 수치와 시간대별 흐름을 확인합니다.",
    weatherRefresh: "날씨 새로고침",
    weatherLoading: "날씨 데이터를 불러오는 중입니다.",
    weatherError: "날씨 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    profileTitle: "회원 정보 수정",
    profileDescription: "가입 시 저장한 취향과 선호를 대시보드에서 바로 수정할 수 있습니다.",
    chatbotTitle: "LLM 챗봇 랩",
    chatbotDescription: "백엔드 연동 전 단계의 UI입니다. 채팅 구조와 사용 흐름만 먼저 구성했습니다.",
    chatbotNotice: "현재는 UI만 준비되어 있으며 실제 LLM 호출은 아직 연결되지 않았습니다.",
    chatbotPlaceholder: "추후 나들이 코파일럿에게 물어볼 내용을 입력해 보세요",
    chatbotSend: "메시지 보내기",
    chatbotIntro: "안녕하세요. 추후 이 영역에 나들해 LLM 챗봇이 연결됩니다. 지금은 UI 흐름만 확인할 수 있습니다.",
    chatbotPending: "LLM 백엔드가 아직 연결되지 않았습니다. 추후 이 자리에서 일정 추천, 날씨 해설, 지역 비교 응답을 제공할 예정입니다.",
    chatbotSuggestedLabel: "빠른 질문",
    accountTitle: "계정 상태",
    accountDescription: "로그아웃, 가입일, 이메일 등 기본 계정 정보를 확인합니다.",
    dangerTitle: "위험 구역",
    dangerDescription: "탈퇴 시 저장된 세션과 프로필이 삭제됩니다. 진행하려면 DELETE를 입력하세요.",
    deletePlaceholder: "DELETE 입력",
    deleteAction: "회원 탈퇴",
    logoutAction: "로그아웃",
    saveAction: "변경사항 저장",
    saveSuccess: "회원 정보가 업데이트되었습니다.",
    saveError: "회원 정보 저장에 실패했습니다.",
    deleteError: "회원 탈퇴 처리에 실패했습니다.",
    deleteSuccess: "회원 탈퇴가 완료되었습니다.",
    location: "기준 지역",
    station: "관측 기준",
    updatedAt: "업데이트",
    source: "데이터 소스",
    email: "로그인 이메일",
    name: "이름",
    joined: "가입일",
    accountStatus: "계정 상태",
    active: "정상 활성",
    age: "연령대",
    region: "주 사용 지역",
    time: "선호 시간대",
    interests: "취미·관심사",
    sensitivity: "민감한 날씨 요소",
    marketing: "알림 수신 동의",
    yes: "동의",
    no: "미동의",
    score: "피크닉 지수",
    temp: "기온",
    feelsLike: "체감온도",
    humidity: "습도",
    wind: "풍속",
    uv: "자외선",
    pm10: "미세먼지",
    pm25: "초미세먼지",
    khai: "통합대기지수",
    bulletin: "공식 브리핑",
    breakdown: "점수 구성",
    noBulletin: "현재 표시할 공식 브리핑이 없습니다.",
    noSensitivity: "선택 없음",
    noTags: "표시할 태그 없음",
    profileHint: "취미는 최대 5개까지 선택할 수 있습니다.",
    otherInterestPlaceholder: "기타 취미를 적어 주세요",
    deleteHome: "탈퇴 후 홈으로 이동",
    weatherRetry: "다시 시도",
    dashboardNav: "대시보드",
    backHome: "홈으로 이동",
  },
  en: {
    badge: "user cockpit",
    title: "Dashboard",
    subtitle: "Manage personal weather detail, profile settings, account controls, and the future chatbot workspace in one surface.",
    heroLead: "Today’s user workspace",
    heroDescription:
      "This dashboard combines detailed live weather, saved outing preferences, account controls, and a UI scaffold for the future LLM chatbot.",
    redirecting: "You need to log in first. Redirecting to login.",
    weatherTitle: "Live weather detail",
    weatherDescription: "Review current metrics and hourly flow using your current location or the default region.",
    weatherRefresh: "Refresh weather",
    weatherLoading: "Loading weather data.",
    weatherError: "Failed to load weather data. Please try again shortly.",
    profileTitle: "Edit member profile",
    profileDescription: "Update the outing preferences you saved during sign-up directly from the dashboard.",
    chatbotTitle: "LLM chatbot lab",
    chatbotDescription: "This is a UI scaffold before backend integration. The chat structure and flow are prepared first.",
    chatbotNotice: "Only the UI is prepared right now. Real LLM calls are not connected yet.",
    chatbotPlaceholder: "Type what you want to ask the future outing copilot",
    chatbotSend: "Send message",
    chatbotIntro: "Hello. The Nadeulhae LLM chatbot will be connected here later. For now, this area only shows the chat UI flow.",
    chatbotPending: "The LLM backend is not connected yet. This area will later provide route suggestions, weather interpretation, and regional comparison answers.",
    chatbotSuggestedLabel: "Quick prompts",
    accountTitle: "Account status",
    accountDescription: "Review your login email, account status, sign-up date, and logout controls.",
    dangerTitle: "Danger zone",
    dangerDescription: "Deleting your account removes saved sessions and profile data. Type DELETE to proceed.",
    deletePlaceholder: "Type DELETE",
    deleteAction: "Delete account",
    logoutAction: "Log out",
    saveAction: "Save changes",
    saveSuccess: "Your profile has been updated.",
    saveError: "Failed to save profile changes.",
    deleteError: "Failed to delete your account.",
    deleteSuccess: "Your account has been deleted.",
    location: "Region",
    station: "Observation basis",
    updatedAt: "Updated",
    source: "Source",
    email: "Login email",
    name: "Name",
    joined: "Joined",
    accountStatus: "Account state",
    active: "Active",
    age: "Age range",
    region: "Primary region",
    time: "Preferred time",
    interests: "Interests",
    sensitivity: "Weather sensitivities",
    marketing: "Notification consent",
    yes: "Enabled",
    no: "Disabled",
    score: "Picnic score",
    temp: "Temperature",
    feelsLike: "Feels like",
    humidity: "Humidity",
    wind: "Wind",
    uv: "UV",
    pm10: "PM10",
    pm25: "PM2.5",
    khai: "KHAI",
    bulletin: "Official briefing",
    breakdown: "Score breakdown",
    noBulletin: "No official bulletin is available right now.",
    noSensitivity: "None selected",
    noTags: "No tags to show",
    profileHint: "Choose up to 5 interests.",
    otherInterestPlaceholder: "Describe your other interest",
    deleteHome: "Return home after deletion",
    weatherRetry: "Try again",
    dashboardNav: "Dashboard",
    backHome: "Go home",
  },
} as const

const CHAT_SUGGESTIONS = {
  ko: [
    "이번 주말 전주 나들이 코스 추천해줘",
    "오후에 비 오면 대체 코스는 뭐가 좋아?",
    "미세먼지 높은 날 갈만한 실내 장소 알려줘",
  ],
  en: [
    "Recommend a Jeonju outing route for this weekend",
    "What is a good backup plan if it rains this afternoon?",
    "Suggest indoor places for a high fine-dust day",
  ],
} as const

function createProfileFormState(user: AuthUser): ProfileFormState {
  return {
    displayName: user.displayName,
    ageBand: user.ageBand,
    primaryRegion: user.primaryRegion,
    interestTags: user.interestTags,
    interestOther: user.interestOther ?? "",
    preferredTimeSlot: user.preferredTimeSlot,
    weatherSensitivity: user.weatherSensitivity,
    marketingAccepted: user.marketingAccepted,
  }
}

function formatLastUpdate(value: WeatherData["metadata"] extends { lastUpdate: infer T } ? T : unknown) {
  if (!value) return "-"
  if (typeof value === "string") return value
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, string>
    return Object.values(record).filter(Boolean).join(" / ")
  }
  return "-"
}

function SelectOptionTile({
  selected,
  label,
  description,
  onClick,
}: {
  selected: boolean
  label: string
  description?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[1.2rem] border px-4 py-3 text-left transition",
        selected
          ? "border-sky-blue/40 bg-sky-blue/10 text-sky-blue"
          : "border-card-border/70 bg-background/70 text-foreground hover:border-sky-blue/25"
      )}
    >
      <p className="text-sm font-black">{label}</p>
      {description ? (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
    </button>
  )
}

function ToggleChip({
  selected,
  label,
  onClick,
}: {
  selected: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-semibold transition",
        selected
          ? "border-sky-blue/40 bg-sky-blue/10 text-sky-blue"
          : "border-card-border/70 bg-background/70 text-foreground hover:border-sky-blue/25"
      )}
    >
      {label}
    </button>
  )
}

function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <MagicCard className={cn("overflow-hidden rounded-[2rem]", className)} gradientSize={220} gradientOpacity={0.7}>
      <div className="relative rounded-[2rem] border border-card-border/70 bg-card/90 p-5 backdrop-blur-2xl sm:p-6">
        <BorderBeam size={180} duration={10} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
        <div className="relative z-10">{children}</div>
      </div>
    </MagicCard>
  )
}

function StatusMetric({
  label,
  value,
  meta,
}: {
  label: string
  value: string
  meta?: string
}) {
  return (
    <div className="rounded-[1.4rem] border border-card-border/70 bg-background/75 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-black tracking-tight text-foreground">{value}</p>
      {meta ? <p className="mt-2 text-sm text-muted-foreground">{meta}</p> : null}
    </div>
  )
}

function ChatBubble({
  message,
  introText,
  pendingText,
}: {
  message: ChatMessage
  introText: string
  pendingText: string
}) {
  const content = message.kind === "text"
    ? message.text
    : message.kind === "intro"
      ? introText
      : pendingText

  return (
    <div
      className={cn(
        "max-w-[88%] rounded-[1.4rem] px-4 py-3 text-sm leading-6",
        message.role === "assistant"
          ? "border border-card-border/70 bg-background/75 text-foreground"
          : "ml-auto bg-sky-blue text-white"
      )}
    >
      {content}
    </div>
  )
}

function DashboardWorkspace({ user }: { user: AuthUser }) {
  const router = useRouter()
  const { language } = useLanguage()
  const { resolvedTheme } = useTheme()
  const { setAuthenticatedUser } = useAuth()
  const copy = DASHBOARD_COPY[language]

  const [form, setForm] = useState<ProfileFormState>(() => createProfileFormState(user))
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecastItem[]>([])
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const [isWeatherRefreshing, setIsWeatherRefreshing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "intro", role: "assistant", kind: "intro" },
  ])

  const particleColor = resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"

  const loadWeather = useCallback(async (lat?: number, lon?: number) => {
    const detail = await dataService.getWeatherData(lat, lon)
    setWeatherData(detail)

    const query = lat != null && lon != null ? `?lat=${lat}&lon=${lon}` : ""
    const response = await fetch(`/api/weather/forecast${query}`, {
      cache: "no-store",
      credentials: "include",
    })
    if (!response.ok) {
      setHourlyForecast([])
      return
    }

    const data = await response.json()
    setHourlyForecast(Array.isArray(data?.todayHourly) ? data.todayHourly : [])
  }, [])

  const refreshWeather = useCallback(async () => {
    setIsWeatherRefreshing(true)
    setWeatherError(null)

    const fallback = async () => {
      try {
        await loadWeather()
      } catch (error) {
        console.error("Dashboard weather refresh failed:", error)
        setWeatherError(copy.weatherError)
      } finally {
        setIsWeatherRefreshing(false)
      }
    }

    if (!navigator.geolocation) {
      await fallback()
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await loadWeather(position.coords.latitude, position.coords.longitude)
        } catch (error) {
          console.error("Location weather refresh failed:", error)
          await fallback()
          return
        }
        setIsWeatherRefreshing(false)
      },
      async () => {
        await fallback()
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 0,
      }
    )
  }, [copy.weatherError, loadWeather])

  useEffect(() => {
    void refreshWeather()
  }, [refreshWeather])

  const weatherMetrics = useMemo(() => {
    if (!weatherData) return []

    return [
      { label: copy.score, value: String(weatherData.score), meta: weatherData.status },
      { label: copy.temp, value: `${weatherData.details.temp ?? "--"}°C` },
      { label: copy.feelsLike, value: `${weatherData.details.feelsLike ?? weatherData.details.temp ?? "--"}°C` },
      { label: copy.humidity, value: `${weatherData.details.humidity ?? "--"}%` },
      { label: copy.wind, value: `${weatherData.details.wind ?? "--"}m/s` },
      { label: copy.uv, value: weatherData.details.uv || "--" },
      { label: copy.pm10, value: weatherData.details.pm10 != null ? `${weatherData.details.pm10}` : weatherData.details.dust || "--" },
      { label: copy.pm25, value: weatherData.details.pm25 != null ? `${weatherData.details.pm25}` : "--" },
      { label: copy.khai, value: weatherData.details.khai != null ? `${weatherData.details.khai}` : "--" },
    ]
  }, [copy.feelsLike, copy.humidity, copy.khai, copy.pm10, copy.pm25, copy.score, copy.temp, copy.uv, copy.wind, weatherData])

  const weatherTags = useMemo(() => {
    if (!weatherData?.metadata?.alertSummary?.hazardTags?.length) {
      return []
    }

    return weatherData.metadata.alertSummary.hazardTags
  }, [weatherData])

  const profileInterestLabels = useMemo(() => {
    return form.interestTags.map((value) => getOptionLabel(INTEREST_OPTIONS, value, language))
  }, [form.interestTags, language])

  const weatherSensitivityLabels = useMemo(() => {
    return form.weatherSensitivity.length > 0
      ? form.weatherSensitivity.map((value) => getOptionLabel(WEATHER_SENSITIVITY_OPTIONS, value, language))
      : [copy.noSensitivity]
  }, [copy.noSensitivity, form.weatherSensitivity, language])

  const handleToggleInterest = (value: string) => {
    setSaveMessage(null)
    setForm((current) => {
      const exists = current.interestTags.includes(value)
      if (exists) {
        return {
          ...current,
          interestTags: current.interestTags.filter((item) => item !== value),
          interestOther: value === "other" ? "" : current.interestOther,
        }
      }

      if (current.interestTags.length >= MAX_INTEREST_SELECTIONS) {
        setSaveMessage({ type: "error", text: copy.profileHint })
        return current
      }

      return {
        ...current,
        interestTags: [...current.interestTags, value],
      }
    })
  }

  const handleToggleSensitivity = (value: string) => {
    setForm((current) => {
      const exists = current.weatherSensitivity.includes(value)
      return {
        ...current,
        weatherSensitivity: exists
          ? current.weatherSensitivity.filter((item) => item !== value)
          : [...current.weatherSensitivity, value],
      }
    })
  }

  const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(form),
      })

      const data = await response.json()
      if (!response.ok) {
        setSaveMessage({
          type: "error",
          text: data.error ?? copy.saveError,
        })
        return
      }

      setAuthenticatedUser((data as AuthResponseBody).user)
      setSaveMessage({
        type: "success",
        text: copy.saveSuccess,
      })
      router.refresh()
    } catch (error) {
      console.error("Profile save failed:", error)
      setSaveMessage({
        type: "error",
        text: copy.saveError,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteMessage(null)
    setIsDeleting(true)

    try {
      const response = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ confirmText: deleteConfirm }),
      })

      const data = await response.json()
      if (!response.ok) {
        setDeleteMessage(data.error ?? copy.deleteError)
        return
      }

      setDeleteMessage(copy.deleteSuccess)
      setAuthenticatedUser(null)
      router.push("/")
      router.refresh()
    } catch (error) {
      console.error("Account deletion failed:", error)
      setDeleteMessage(copy.deleteError)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
    } catch (error) {
      console.error("Logout failed:", error)
    } finally {
      setAuthenticatedUser(null)
      router.push("/login")
      router.refresh()
    }
  }

  const handleSendChat = () => {
    const text = chatInput.trim()
    if (!text) return

    setChatMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        kind: "text",
        text,
      },
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        kind: "pending",
      },
    ])
    setChatInput("")
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 pb-16 pt-28 sm:px-6 lg:px-8">
      <Particles
        className="absolute inset-0 z-0 opacity-70"
        quantity={80}
        ease={80}
        color={particleColor}
        refresh
      />
      <Meteors number={12} className="z-0" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <SectionCard>
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/20 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-active-blue">
                <Sparkles className="size-3.5" />
                {copy.badge}
              </span>
              <div className="space-y-2">
                <p className="text-sm font-black uppercase tracking-[0.32em] text-muted-foreground">
                  {copy.heroLead}
                </p>
                <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                  {user.displayName} · {copy.title}
                </h1>
                <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                  {copy.heroDescription}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatusMetric
                label={copy.location}
                value={getOptionLabel(PRIMARY_REGION_OPTIONS, user.primaryRegion, language)}
                meta={copy.subtitle}
              />
              <StatusMetric
                label={copy.interests}
                value={`${profileInterestLabels.length}`}
                meta={profileInterestLabels.join(" · ")}
              />
              <StatusMetric
                label={copy.marketing}
                value={user.marketingAccepted ? copy.yes : copy.no}
                meta={copy.accountTitle}
              />
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <section className="space-y-6">
            <SectionCard>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                    {copy.weatherTitle}
                  </p>
                  <h2 className="text-3xl font-black tracking-tight text-foreground">
                    {weatherData?.metadata?.region || weatherData?.metadata?.regionEn || copy.weatherTitle}
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {copy.weatherDescription}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void refreshWeather()}
                  className="inline-flex items-center gap-2 self-start rounded-full border border-card-border/70 bg-background/75 px-4 py-2 text-sm font-black text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue disabled:opacity-50"
                  disabled={isWeatherRefreshing}
                >
                  <RefreshCcw className={cn("size-4", isWeatherRefreshing && "animate-spin")} />
                  {copy.weatherRefresh}
                </button>
              </div>

              {weatherError ? (
                <div className="mt-5 rounded-[1.4rem] border border-danger/20 bg-danger/10 px-4 py-4 text-sm font-semibold text-danger">
                  <div className="flex items-center justify-between gap-3">
                    <span>{weatherError}</span>
                    <button
                      type="button"
                      onClick={() => void refreshWeather()}
                      className="rounded-full border border-danger/20 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em]"
                    >
                      {copy.weatherRetry}
                    </button>
                  </div>
                </div>
              ) : null}

              {!weatherData && !weatherError ? (
                <div className="mt-5 rounded-[1.4rem] border border-card-border/70 bg-background/75 px-4 py-5 text-sm font-semibold text-muted-foreground">
                  {copy.weatherLoading}
                </div>
              ) : null}

              {weatherData ? (
                <>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {weatherMetrics.map((metric) => (
                      <StatusMetric
                        key={metric.label}
                        label={metric.label}
                        value={metric.value}
                        meta={metric.meta}
                      />
                    ))}
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[1.5rem] border border-card-border/70 bg-background/75 p-5">
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                        <MapPinned className="size-4 text-sky-blue" />
                        {copy.source}
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <StatusMetric
                          label={copy.location}
                          value={weatherData.metadata?.region || weatherData.metadata?.regionEn || "-"}
                        />
                        <StatusMetric
                          label={copy.station}
                          value={weatherData.metadata?.station || weatherData.metadata?.locationContext?.stationMap?.selected || "-"}
                        />
                        <StatusMetric
                          label={copy.updatedAt}
                          value={formatLastUpdate(weatherData.metadata?.lastUpdate)}
                        />
                        <StatusMetric
                          label={copy.source}
                          value={weatherData.metadata?.dataSource || "-"}
                        />
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-card-border/70 bg-background/75 p-5">
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                        <ShieldAlert className="size-4 text-sky-blue" />
                        {copy.breakdown}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {weatherData.metadata?.scoreBreakdown ? (
                          <>
                            <span className="rounded-full border border-sky-blue/20 bg-sky-blue/10 px-3 py-1.5 text-sm font-semibold text-sky-blue">
                              Air {weatherData.metadata.scoreBreakdown.air}
                            </span>
                            <span className="rounded-full border border-sky-blue/20 bg-sky-blue/10 px-3 py-1.5 text-sm font-semibold text-sky-blue">
                              Temp {weatherData.metadata.scoreBreakdown.temperature}
                            </span>
                            <span className="rounded-full border border-sky-blue/20 bg-sky-blue/10 px-3 py-1.5 text-sm font-semibold text-sky-blue">
                              Sky {weatherData.metadata.scoreBreakdown.sky}
                            </span>
                            <span className="rounded-full border border-sky-blue/20 bg-sky-blue/10 px-3 py-1.5 text-sm font-semibold text-sky-blue">
                              Wind {weatherData.metadata.scoreBreakdown.wind}
                            </span>
                          </>
                        ) : (
                          <span className="rounded-full border border-card-border/70 bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground">
                            {copy.noTags}
                          </span>
                        )}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {(weatherTags.length > 0 ? weatherTags : [copy.noTags]).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-[1.5rem] border border-card-border/70 bg-background/75 p-5">
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                      <CloudSun className="size-4 text-sky-blue" />
                      {copy.bulletin}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-foreground">
                      {weatherData.metadata?.bulletin?.summary || copy.noBulletin}
                    </p>
                  </div>

                  <TodayHourlyForecast items={hourlyForecast} />
                  <PicnicBriefing weatherData={weatherData} />
                </>
              ) : null}
            </SectionCard>

            <SectionCard>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                    {copy.chatbotTitle}
                  </p>
                  <h2 className="text-3xl font-black tracking-tight text-foreground">
                    {copy.chatbotTitle}
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {copy.chatbotDescription}
                  </p>
                </div>
                <span className="rounded-full border border-warning/20 bg-warning/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.28em] text-warning">
                  UI Only
                </span>
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-card-border/70 bg-background/75 p-4 text-sm text-muted-foreground">
                {copy.chatbotNotice}
              </div>

              <div className="mt-5">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                  {copy.chatbotSuggestedLabel}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CHAT_SUGGESTIONS[language].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setChatInput(suggestion)}
                      className="rounded-full border border-card-border/70 bg-background/75 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-sky-blue/25 hover:text-sky-blue"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-[1.7rem] border border-card-border/70 bg-background/80 p-4">
                <div className="space-y-3">
                  {chatMessages.map((message) => (
                    <ChatBubble
                      key={message.id}
                      message={message}
                      introText={copy.chatbotIntro}
                      pendingText={copy.chatbotPending}
                    />
                  ))}
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder={copy.chatbotPlaceholder}
                    className="min-h-[110px] rounded-[1.4rem] border border-card-border/70 bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-sky-blue/30"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {copy.chatbotNotice}
                    </span>
                    <button
                      type="button"
                      onClick={handleSendChat}
                      className="inline-flex items-center gap-2 rounded-full border border-sky-blue/20 bg-sky-blue/10 px-4 py-2 text-sm font-black text-sky-blue transition hover:border-sky-blue/35"
                    >
                      <Send className="size-4" />
                      {copy.chatbotSend}
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          </section>

          <aside className="space-y-6">
            <SectionCard>
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                  {copy.profileTitle}
                </p>
                <h2 className="text-3xl font-black tracking-tight text-foreground">
                  {copy.profileTitle}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {copy.profileDescription}
                </p>
              </div>

              <form className="mt-5 space-y-6" onSubmit={handleSaveProfile}>
                <div className="space-y-2">
                  <label className="text-sm font-black text-foreground">{copy.email}</label>
                  <div className="flex items-center gap-3 rounded-[1.3rem] border border-card-border/70 bg-background/75 px-4 py-3 text-sm font-semibold text-muted-foreground">
                    <Mail className="size-4 text-sky-blue" />
                    {user.email}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-foreground">{copy.name}</label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                    className="w-full rounded-[1.3rem] border border-card-border/70 bg-background/75 px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-sky-blue/30"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-black text-foreground">{copy.age}</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {AGE_BAND_OPTIONS.map((option) => (
                      <SelectOptionTile
                        key={option.value}
                        selected={form.ageBand === option.value}
                        label={option.label[language]}
                        onClick={() => setForm((current) => ({ ...current, ageBand: option.value }))}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-black text-foreground">{copy.region}</label>
                  <div className="grid gap-3">
                    {PRIMARY_REGION_OPTIONS.map((option) => (
                      <SelectOptionTile
                        key={option.value}
                        selected={form.primaryRegion === option.value}
                        label={option.label[language]}
                        description={option.description?.[language]}
                        onClick={() => setForm((current) => ({ ...current, primaryRegion: option.value }))}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-black text-foreground">{copy.interests}</label>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {form.interestTags.length}/{MAX_INTEREST_SELECTIONS}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {INTEREST_OPTIONS.map((option) => (
                      <ToggleChip
                        key={option.value}
                        selected={form.interestTags.includes(option.value)}
                        label={option.label[language]}
                        onClick={() => handleToggleInterest(option.value)}
                      />
                    ))}
                  </div>
                  {form.interestTags.includes("other") ? (
                    <input
                      type="text"
                      value={form.interestOther}
                      onChange={(event) => setForm((current) => ({ ...current, interestOther: event.target.value }))}
                      placeholder={copy.otherInterestPlaceholder}
                      className="w-full rounded-[1.3rem] border border-card-border/70 bg-background/75 px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-sky-blue/30"
                    />
                  ) : null}
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-black text-foreground">{copy.time}</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {TIME_SLOT_OPTIONS.map((option) => (
                      <SelectOptionTile
                        key={option.value}
                        selected={form.preferredTimeSlot === option.value}
                        label={option.label[language]}
                        onClick={() => setForm((current) => ({ ...current, preferredTimeSlot: option.value }))}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-black text-foreground">{copy.sensitivity}</label>
                  <div className="flex flex-wrap gap-2">
                    {WEATHER_SENSITIVITY_OPTIONS.map((option) => (
                      <ToggleChip
                        key={option.value}
                        selected={form.weatherSensitivity.includes(option.value)}
                        label={option.label[language]}
                        onClick={() => handleToggleSensitivity(option.value)}
                      />
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-[1.3rem] border border-card-border/70 bg-background/75 px-4 py-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.marketingAccepted}
                    onChange={(event) => setForm((current) => ({ ...current, marketingAccepted: event.target.checked }))}
                    className="mt-1 size-4 rounded border-card-border accent-sky-blue"
                  />
                  <span>{copy.marketing}</span>
                </label>

                {saveMessage ? (
                  <div
                    className={cn(
                      "rounded-[1.3rem] border px-4 py-3 text-sm font-semibold",
                      saveMessage.type === "success"
                        ? "border-success/20 bg-success/10 text-success"
                        : "border-danger/20 bg-danger/10 text-danger"
                    )}
                  >
                    {saveMessage.text}
                  </div>
                ) : null}

                <ShimmerButton
                  type="submit"
                  className="w-full rounded-[1.4rem] py-4 text-base font-black"
                  disabled={isSaving}
                >
                  {isSaving ? "..." : copy.saveAction}
                </ShimmerButton>
              </form>
            </SectionCard>

            <SectionCard>
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                  {copy.accountTitle}
                </p>
                <h2 className="text-3xl font-black tracking-tight text-foreground">
                  {copy.accountTitle}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {copy.accountDescription}
                </p>
              </div>

              <div className="mt-5 grid gap-3">
                <StatusMetric
                  label={copy.accountStatus}
                  value={copy.active}
                  meta={copy.dashboardNav}
                />
                <StatusMetric
                  label={copy.joined}
                  value={new Date(user.createdAt).toLocaleDateString(language === "ko" ? "ko-KR" : "en-US")}
                />
                <StatusMetric
                  label={copy.sensitivity}
                  value={weatherSensitivityLabels.join(" · ")}
                />
              </div>

              <div className="mt-5 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center gap-2 rounded-[1.3rem] border border-card-border/70 bg-background/75 px-4 py-3 text-sm font-black text-foreground transition hover:border-sky-blue/25 hover:text-sky-blue"
                >
                  <LogOut className="size-4" />
                  {copy.logoutAction}
                </button>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 rounded-[1.3rem] border border-card-border/70 bg-background/75 px-4 py-3 text-sm font-black text-foreground transition hover:border-sky-blue/25 hover:text-sky-blue"
                >
                  <Navigation className="size-4" />
                  {copy.backHome}
                </Link>
              </div>
            </SectionCard>

            <SectionCard>
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-danger/80">
                  {copy.dangerTitle}
                </p>
                <h2 className="text-3xl font-black tracking-tight text-foreground">
                  {copy.dangerTitle}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {copy.dangerDescription}
                </p>
              </div>

              <div className="mt-5 space-y-4">
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(event) => setDeleteConfirm(event.target.value)}
                  placeholder={copy.deletePlaceholder}
                  className="w-full rounded-[1.3rem] border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-danger/40"
                />

                {deleteMessage ? (
                  <div className="rounded-[1.3rem] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
                    {deleteMessage}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleDeleteAccount()}
                  disabled={isDeleting || deleteConfirm !== "DELETE"}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[1.3rem] border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-black text-danger transition hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                  {isDeleting ? "..." : copy.deleteAction}
                </button>
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>
    </main>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const { user, status } = useAuth()
  const copy = DASHBOARD_COPY[language]

  useEffect(() => {
    if (status === "guest") {
      const timeout = window.setTimeout(() => {
        router.replace("/login")
      }, 500)

      return () => window.clearTimeout(timeout)
    }
  }, [router, status])

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-bold text-sky-blue">
        ...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm font-semibold text-muted-foreground">
        {copy.redirecting}
      </div>
    )
  }

  const workspaceKey = JSON.stringify([
    language,
    user.id,
    user.displayName,
    user.ageBand,
    user.primaryRegion,
    user.preferredTimeSlot,
    user.marketingAccepted,
    user.interestTags.join(","),
    user.weatherSensitivity.join(","),
    user.interestOther ?? "",
  ])

  return <DashboardWorkspace key={workspaceKey} user={user} />
}
