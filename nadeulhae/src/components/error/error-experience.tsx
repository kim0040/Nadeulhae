"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  Home,
  Languages,
  LayoutDashboard,
  Monitor,
  Moon,
  RefreshCcw,
  Sun,
} from "lucide-react"
import { useTheme } from "next-themes"

import { BorderBeam } from "@/components/magicui/border-beam"
import { MagicCard } from "@/components/magicui/magic-card"
import { Meteors } from "@/components/magicui/meteors"
import { Particles } from "@/components/magicui/particles"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

type ErrorVariant = "notFound" | "routeError" | "globalError"

type ErrorExperienceProps = {
  variant: ErrorVariant
  error?: Error & { digest?: string }
  reset?: () => void
  hasExternalNav?: boolean
  showStandaloneControls?: boolean
}

const COPY = {
  ko: {
    surfaceBadge: "nadeulhae recovery surface",
    quickStatus: "상태 점검",
    theme: "테마",
    language: "언어",
    recovery: "복구 동선",
    themeLight: "라이트",
    themeDark: "다크",
    themeSystem: "시스템",
    langValue: "한국어",
    retry: "다시 시도",
    reload: "새로고침",
    home: "홈으로 이동",
    dashboard: "대시보드",
    back: "이전 화면",
    toggleLanguage: "한/영 전환",
    stepsTitle: "바로 해볼 수 있는 것",
    digestLabel: "오류 참조",
    detailsLabel: "개발 상세",
    modes: {
      notFound: {
        code: "404",
        eyebrow: "페이지 없음",
        title: "요청한 화면을 찾지 못했습니다.",
        description:
          "주소가 바뀌었거나 더 이상 제공되지 않는 경로입니다. 홈으로 돌아가거나 대시보드에서 다시 진입해 주세요.",
        steps: [
          "주소를 직접 입력했다면 경로를 다시 확인합니다.",
          "로그인 사용자라면 대시보드에서 주요 기능으로 재진입합니다.",
          "문제가 반복되면 홈에서 새로고침 후 다시 시도합니다.",
        ],
      },
      routeError: {
        code: "500",
        eyebrow: "렌더링 오류",
        title: "이 화면을 불러오는 중 문제가 발생했습니다.",
        description:
          "데이터 로딩이나 렌더링 과정에서 예외가 발생했습니다. 같은 화면을 다시 시도하거나 홈으로 이동해 흐름을 복구할 수 있습니다.",
        steps: [
          "먼저 다시 시도를 눌러 같은 화면을 한 번 더 불러옵니다.",
          "반복되면 홈이나 대시보드로 이동해 다른 경로로 진입합니다.",
          "지속되면 오류 참조 값과 함께 원인을 추적합니다.",
        ],
      },
      globalError: {
        code: "fatal",
        eyebrow: "전역 오류",
        title: "앱 전반에서 예기치 않은 문제가 발생했습니다.",
        description:
          "루트 레벨에서 예외가 발생해 기본 화면을 유지할 수 없습니다. 우선 새로고침하거나 홈으로 돌아가 복구를 시도해 주세요.",
        steps: [
          "새로고침으로 앱 셸을 다시 초기화합니다.",
          "복구되지 않으면 홈으로 이동해 첫 진입부터 다시 시작합니다.",
          "지속되면 오류 참조 값을 기준으로 로그를 확인합니다.",
        ],
      },
    },
  },
  en: {
    surfaceBadge: "nadeulhae recovery surface",
    quickStatus: "Status",
    theme: "Theme",
    language: "Language",
    recovery: "Recovery",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    langValue: "English",
    retry: "Try again",
    reload: "Reload",
    home: "Go home",
    dashboard: "Dashboard",
    back: "Go back",
    toggleLanguage: "Switch language",
    stepsTitle: "What to try next",
    digestLabel: "Error reference",
    detailsLabel: "Dev detail",
    modes: {
      notFound: {
        code: "404",
        eyebrow: "Page missing",
        title: "The requested page could not be found.",
        description:
          "The route may have moved or no longer exists. Return home or re-enter from the dashboard.",
        steps: [
          "If you typed the URL manually, check the path again.",
          "If you are signed in, reopen the main flow from the dashboard.",
          "If it repeats, refresh from the home page and try again.",
        ],
      },
      routeError: {
        code: "500",
        eyebrow: "Render error",
        title: "Something went wrong while loading this screen.",
        description:
          "An exception occurred while loading data or rendering the route. Retry this screen or recover from home.",
        steps: [
          "Use retry first to load the same screen again.",
          "If it repeats, move to home or dashboard and re-enter from another path.",
          "If it persists, trace it with the error reference value.",
        ],
      },
      globalError: {
        code: "fatal",
        eyebrow: "Global failure",
        title: "An unexpected problem affected the app shell.",
        description:
          "A root-level exception interrupted the normal interface. Reload first or return home to recover the flow.",
        steps: [
          "Reload to reinitialize the app shell.",
          "If recovery fails, go home and restart the flow from the beginning.",
          "If it persists, inspect logs with the error reference value.",
        ],
      },
    },
  },
} as const

function getThemeLabel(
  theme: string | undefined,
  labels: {
    themeLight: string
    themeDark: string
    themeSystem: string
  }
) {
  if (theme === "light") return labels.themeLight
  if (theme === "dark") return labels.themeDark
  return labels.themeSystem
}

function InfoLine({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span className="text-xs font-black uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
        {label}
      </span>
      <span className="text-sm font-semibold text-[var(--foreground)]">
        {value}
      </span>
    </div>
  )
}

export function ErrorExperience({
  variant,
  error,
  reset,
  hasExternalNav = false,
  showStandaloneControls = false,
}: ErrorExperienceProps) {
  const router = useRouter()
  const { language, setLanguage } = useLanguage()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const copy = (COPY as any)[language]
  const mode = copy.modes[variant]
  const activeTheme = theme === "system" ? resolvedTheme ?? "system" : theme
  const particleColor = activeTheme === "dark" ? "#dff4ff" : "#2f6fe4"
  const heroCodeClass = variant === "notFound"
    ? "text-[4.5rem] sm:text-[6rem] lg:text-[8rem]"
    : "text-[3.6rem] sm:text-[5rem] lg:text-[6.5rem]"
  const errorDetail = useMemo(() => {
    if (process.env.NODE_ENV === "production") {
      return null
    }

    const message = error?.message?.trim()
    return message ? message.slice(0, 200) : null
  }, [error?.message])

  const cycleTheme = () => {
    const modes: Array<"light" | "dark" | "system"> = ["light", "dark", "system"]
    const currentIndex = modes.indexOf((theme as "light" | "dark" | "system") ?? "system")
    const nextIndex = (currentIndex + 1) % modes.length
    setTheme(modes[nextIndex])
  }

  return (
    <section
      className={cn(
        "relative isolate min-h-screen overflow-hidden px-4 pb-8 sm:px-6 lg:px-10",
        hasExternalNav ? "pt-28 sm:pt-32" : "pt-6 sm:pt-8"
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(47,111,228,0.18),transparent_32%),radial-gradient(circle_at_80%_14%,rgba(11,125,113,0.16),transparent_28%),radial-gradient(circle_at_70%_82%,rgba(255,255,255,0.06),transparent_24%)]" />
      <Particles
        className="absolute inset-0"
        quantity={42}
        staticity={38}
        ease={72}
        size={1}
        color={particleColor}
        vx={0.02}
        vy={0.015}
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl items-center">
        <MagicCard
          className="relative w-full overflow-hidden rounded-[2rem] border border-[var(--card-border)] bg-[var(--card)]/80 backdrop-blur-2xl"
          mode="orb"
          glowFrom="rgba(11,125,113,0.35)"
          glowTo="rgba(47,111,228,0.38)"
          glowBlur={86}
          glowSize={420}
          glowOpacity={0.48}
        >
          <BorderBeam
            size={160}
            duration={8}
            borderWidth={1.5}
            colorFrom="var(--beam-from)"
            colorTo="var(--beam-to)"
          />
          <Meteors number={10} minDuration={3} maxDuration={8} className="opacity-70" />

          <div className="relative z-20 grid gap-10 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-12 lg:py-12">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--interactive-border)] bg-[var(--interactive)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
                <AlertTriangle className="size-4 text-[var(--accent-secondary)]" />
                <span>{copy.surfaceBadge}</span>
              </div>

              <p className="text-xs font-black uppercase tracking-[0.34em] text-[var(--accent)]">
                {mode.eyebrow}
              </p>
              <h1
                className={cn(
                  "mt-4 font-black leading-none tracking-[-0.08em] text-[var(--foreground)]/92",
                  heroCodeClass
                )}
              >
                {mode.code}
              </h1>
              <h2 className="mt-5 max-w-xl text-3xl font-black tracking-[-0.05em] text-[var(--foreground)] sm:text-4xl">
                {mode.title}
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted-foreground)] sm:text-lg">
                {mode.description}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {variant === "notFound" ? (
                  <ShimmerButton
                    type="button"
                    onClick={() => router.push("/")}
                    className="gap-2 px-5 py-3 text-sm font-black"
                  >
                    <Home className="size-4" />
                    {copy.home}
                  </ShimmerButton>
                ) : (
                  <ShimmerButton
                    type="button"
                    onClick={() => (reset ? reset() : router.refresh())}
                    className="gap-2 px-5 py-3 text-sm font-black"
                  >
                    <RefreshCcw className="size-4" />
                    {copy.retry}
                  </ShimmerButton>
                )}

                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--interactive-border)] bg-[var(--interactive)] px-5 py-3 text-sm font-black text-[var(--foreground)] transition hover:border-[var(--accent-secondary)]/40 hover:text-[var(--accent-secondary)]"
                >
                  <LayoutDashboard className="size-4" />
                  {copy.dashboard}
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--interactive-border)] px-5 py-3 text-sm font-black text-[var(--muted-foreground)] transition hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
                >
                  <Home className="size-4" />
                  {copy.home}
                </button>

                <button
                  type="button"
                  onClick={() => router.back()}
                  className="inline-flex items-center gap-2 rounded-full border border-transparent px-5 py-3 text-sm font-black text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
                >
                  <ArrowLeft className="size-4" />
                  {copy.back}
                </button>

                {variant === "globalError" ? (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 rounded-full border border-transparent px-5 py-3 text-sm font-black text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
                  >
                    <RefreshCcw className="size-4" />
                    {copy.reload}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[1.7rem] border border-[var(--card-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.02))] p-6 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))]">
                {showStandaloneControls ? (
                  <div className="mb-5 flex flex-wrap justify-end gap-2 border-b border-[var(--border)] pb-5">
                    <button
                      type="button"
                      onClick={cycleTheme}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--interactive-border)] bg-[var(--interactive)] px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
                    >
                      {theme === "light" && <Sun className="size-4" />}
                      {theme === "dark" && <Moon className="size-4" />}
                      {theme === "system" && <Monitor className="size-4" />}
                      <span>{getThemeLabel(theme, copy)}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLanguage(language === "ko" ? "en" : "ko")}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--interactive-border)] bg-[var(--interactive)] px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
                    >
                      <Languages className="size-4" />
                      <span>{language.toUpperCase()}</span>
                    </button>
                  </div>
                ) : null}

                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
                      {copy.quickStatus}
                    </p>
                    <div className="mt-4 space-y-0.5">
                      <InfoLine label={copy.theme} value={getThemeLabel(theme, copy)} />
                      <InfoLine label={copy.language} value={copy.langValue} />
                      <InfoLine label={copy.recovery} value={mode.eyebrow} />
                      {error?.digest ? (
                        <InfoLine label={copy.digestLabel} value={error.digest} />
                      ) : null}
                    </div>
                  </div>

                  <div className="border-t border-[var(--border)] pt-5">
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
                      {copy.stepsTitle}
                    </p>
                    <ul className="mt-4 space-y-3">
                      {mode.steps.map((step: any) => (
                        <li
                          key={step}
                          className="flex gap-3 text-sm leading-6 text-[var(--muted-foreground)]"
                        >
                          <span className="mt-1 block size-2 rounded-full bg-[var(--accent-secondary)]" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {errorDetail ? (
                    <div className="border-t border-[var(--border)] pt-5">
                      <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
                        {copy.detailsLabel}
                      </p>
                      <p className="mt-3 rounded-2xl border border-[var(--interactive-border)] bg-[var(--interactive)] px-4 py-3 text-sm leading-6 text-[var(--foreground)]">
                        {errorDetail}
                      </p>
                    </div>
                  ) : null}

                  {showStandaloneControls ? (
                    <div className="border-t border-[var(--border)] pt-5">
                      <button
                        type="button"
                        onClick={() => setLanguage(language === "ko" ? "en" : "ko")}
                        className="inline-flex items-center gap-2 text-sm font-black text-[var(--accent-secondary)] transition hover:opacity-80"
                      >
                        <Languages className="size-4" />
                        {copy.toggleLanguage}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </MagicCard>
      </div>
    </section>
  )
}
