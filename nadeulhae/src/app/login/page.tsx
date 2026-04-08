"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Clock3,
  Lock,
  Mail,
  MapPinned,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { useTheme } from "next-themes"

import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text"
import { BorderBeam } from "@/components/magicui/border-beam"
import { MagicCard } from "@/components/magicui/magic-card"
import { Meteors } from "@/components/magicui/meteors"
import { Particles } from "@/components/magicui/particles"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import type { AuthResponseBody } from "@/lib/auth/types"
import { cn } from "@/lib/utils"

const LOGIN_COPY = {
  ko: {
    badge: "secure access",
    title: "로그인",
    description: "저장된 취향과 지역 설정을 불러와 오늘의 나들이 흐름을 바로 이어갑니다.",
    helper: "비밀번호는 서버에서 복호화되지 않는 해시로만 저장되고, 세션은 HttpOnly 쿠키로 유지됩니다.",
    sideEyebrow: "nadeulhae account",
    sideTitle: "날씨 기록과 취향 프로필을 한 번에 다시 연결하세요",
    sideDescription:
      "로그인 후에는 기본 지역, 선호 시간대, 취미 정보가 대시보드와 챗봇에 함께 반영됩니다.",
    statCards: [
      { label: "세션 유지", value: "30일", meta: "활동 시 자동 연장" },
      { label: "비밀번호", value: "scrypt", meta: "salt + pepper 적용" },
      { label: "개인화", value: "지역·취향", meta: "대시보드와 연동" },
    ],
    points: [
      {
        title: "기본 지역 복원",
        description: "전주 중심, 현재 위치 우선 등 저장된 기준을 바로 불러옵니다.",
      },
      {
        title: "취미 기반 추천",
        description: "산책, 카페, 자연, 가족 나들이 같은 선호가 다시 반영됩니다.",
      },
      {
        title: "안전한 인증 흐름",
        description: "로그인 실패 제한, 세션 보호, 출처 검사까지 적용된 상태입니다.",
      },
    ],
    emailLabel: "이메일",
    passwordLabel: "비밀번호",
    emailPlaceholder: "name@example.com",
    passwordPlaceholder: "비밀번호 입력",
    submit: "로그인하기",
    signupPrompt: "아직 계정이 없나요?",
    signupLink: "회원가입",
    termsLink: "약관 보기",
    pendingRedirect: "이미 로그인된 상태입니다. 대시보드로 이동합니다.",
    quickLabel: "로그인 후 바로 이어지는 정보",
    quickItems: ["날씨 브리핑", "대시보드", "챗봇 메모리", "계정 설정"],
  },
  en: {
    badge: "secure access",
    title: "Log in",
    description: "Restore your saved preferences and continue with today’s outing flow immediately.",
    helper: "Passwords are stored only as non-reversible hashes, and the session is maintained with an HttpOnly cookie.",
    sideEyebrow: "nadeulhae account",
    sideTitle: "Reconnect your weather profile and outing preferences",
    sideDescription:
      "After login, your saved region, preferred time slot, and interests flow back into the dashboard and chatbot.",
    statCards: [
      { label: "Session", value: "30 days", meta: "Extended during activity" },
      { label: "Password", value: "scrypt", meta: "Salt + pepper applied" },
      { label: "Personalization", value: "Region + taste", meta: "Shared with dashboard" },
    ],
    points: [
      {
        title: "Restore your region defaults",
        description: "Bring back saved choices like Jeonju-first or current-location priority.",
      },
      {
        title: "Reuse hobby-aware guidance",
        description: "Walking, cafe, nature, and family outing preferences are restored immediately.",
      },
      {
        title: "Protected sign-in flow",
        description: "Rate limits, session hardening, and same-origin checks are already applied.",
      },
    ],
    emailLabel: "Email",
    passwordLabel: "Password",
    emailPlaceholder: "name@example.com",
    passwordPlaceholder: "Enter your password",
    submit: "Log in",
    signupPrompt: "Need an account?",
    signupLink: "Sign up",
    termsLink: "View terms",
    pendingRedirect: "You are already logged in. Redirecting to the dashboard.",
    quickLabel: "Available right after login",
    quickItems: ["Weather briefing", "Dashboard", "Chat memory", "Account settings"],
  },
} as const

function LoginField({
  label,
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="space-y-2">
      <label className="ml-1 text-[11px] font-black uppercase tracking-[0.28em] text-sky-blue">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          {...props}
          className={cn(
            "w-full rounded-[1.45rem] border border-interactive-border bg-interactive/75 py-4 pl-12 pr-4 text-sm font-medium text-foreground outline-none transition focus:border-sky-blue/45",
            props.className
          )}
        />
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  meta,
}: {
  label: string
  value: string
  meta: string
}) {
  return (
    <div className="rounded-[1.45rem] border border-card-border/70 bg-background/80 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-black tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{meta}</p>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const { resolvedTheme } = useTheme()
  const { status, setAuthenticatedUser } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const copy = LOGIN_COPY[language]
  const particleColor = resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"

  useEffect(() => {
    if (status === "authenticated") {
      const timeout = window.setTimeout(() => {
        router.replace("/dashboard")
      }, 400)

      return () => window.clearTimeout(timeout)
    }
  }, [router, status])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        })

        const data = await response.json()
        if (!response.ok) {
          setMessage(
            data.error ?? (language === "ko" ? "로그인에 실패했습니다." : "Login failed.")
          )
          return
        }

        setAuthenticatedUser((data as AuthResponseBody).user)
        router.push("/dashboard")
        router.refresh()
      } catch (error) {
        console.error("Login request failed:", error)
        setMessage(
          language === "ko"
            ? "로그인 요청 중 네트워크 오류가 발생했습니다."
            : "A network error occurred while logging in."
        )
      }
    })
  }

  const redirectMessage = status === "authenticated" ? copy.pendingRedirect : null

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28 lg:px-8">
      <Particles
        className="absolute inset-0 z-0 opacity-75"
        quantity={84}
        ease={80}
        color={particleColor}
        refresh
      />
      <Meteors number={12} className="z-0" />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(18rem,0.84fr)] lg:items-center">
        <section className="order-1">
          <MagicCard
            mode="orb"
            className="overflow-hidden rounded-[2rem] sm:rounded-[2.4rem]"
            glowSize={360}
            glowBlur={70}
            glowOpacity={0.44}
            glowFrom="#0b7d71"
            glowTo="#2f6fe4"
          >
            <div className="relative rounded-[2rem] border border-card-border/70 bg-card/92 p-5 shadow-[0_24px_120px_rgba(17,32,39,0.16)] backdrop-blur-2xl sm:rounded-[2.4rem] sm:p-8">
              <BorderBeam
                size={220}
                duration={10}
                delay={4}
                colorFrom="var(--beam-from)"
                colorTo="var(--beam-to)"
              />

              <div className="relative z-10 space-y-6">
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/20 bg-active-blue/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.35em] text-active-blue">
                    <Sparkles className="size-3.5" />
                    {copy.badge}
                  </span>
                  <div className="space-y-3">
                    <AnimatedGradientText className="text-3xl font-black tracking-tight sm:text-4xl">
                      {copy.title}
                    </AnimatedGradientText>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                      {copy.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {copy.quickItems.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-card-border/70 bg-background/75 px-3 py-1.5 text-xs font-bold text-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                  <LoginField
                    type="email"
                    label={copy.emailLabel}
                    icon={Mail}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={copy.emailPlaceholder}
                    autoComplete="email"
                    required
                  />

                  <LoginField
                    type="password"
                    label={copy.passwordLabel}
                    icon={Lock}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={copy.passwordPlaceholder}
                    autoComplete="current-password"
                    required
                  />

                  <div className="rounded-[1.35rem] border border-card-border/70 bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                    {copy.helper}
                  </div>

                  {redirectMessage ? (
                    <div className="rounded-[1.3rem] border border-sky-blue/20 bg-sky-blue/10 px-4 py-3 text-sm font-semibold text-sky-blue">
                      {redirectMessage}
                    </div>
                  ) : null}

                  {message ? (
                    <div className="rounded-[1.3rem] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
                      {message}
                    </div>
                  ) : null}

                  <ShimmerButton
                    type="submit"
                    className="w-full rounded-[1.45rem] py-4 text-base font-black"
                    disabled={isPending || status === "authenticated"}
                  >
                    <span className="inline-flex items-center gap-2">
                      {isPending ? "..." : copy.submit}
                      {!isPending ? <ArrowRight className="size-4" /> : null}
                    </span>
                  </ShimmerButton>
                </form>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-card-border/70 pt-5">
                  <p className="text-sm text-muted-foreground">
                    {copy.signupPrompt}{" "}
                    <Link href="/signup" className="font-black text-sky-blue hover:underline">
                      {copy.signupLink}
                    </Link>
                  </p>
                  <Link
                    href="/terms"
                    className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground hover:text-sky-blue"
                  >
                    {copy.termsLink}
                  </Link>
                </div>
              </div>
            </div>
          </MagicCard>
        </section>

        <section className="order-2 space-y-4 lg:pl-2">
          <MagicCard className="rounded-[1.9rem]" gradientSize={260} gradientOpacity={0.68}>
            <div className="rounded-[1.9rem] border border-card-border/70 bg-card/88 p-5 backdrop-blur-2xl sm:p-6">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/20 bg-active-blue/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.32em] text-active-blue">
                  <ShieldCheck className="size-3.5" />
                  {copy.sideEyebrow}
                </span>
                <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                  {copy.sideTitle}
                </h1>
                <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                  {copy.sideDescription}
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {copy.statCards.map((item) => (
                  <StatCard
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    meta={item.meta}
                  />
                ))}
              </div>
            </div>
          </MagicCard>

          <MagicCard className="rounded-[1.9rem]" gradientSize={240} gradientOpacity={0.55}>
            <div className="rounded-[1.9rem] border border-card-border/70 bg-card/84 p-5 backdrop-blur-2xl sm:p-6">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                {copy.quickLabel}
              </p>
              <div className="mt-4 space-y-4">
                {copy.points.map((point, index) => {
                  const icons = [MapPinned, Sparkles, Clock3]
                  const Icon = icons[index] ?? ShieldCheck

                  return (
                    <div
                      key={point.title}
                      className="rounded-[1.35rem] border border-card-border/70 bg-background/75 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sky-blue/10 text-sky-blue">
                          <Icon className="size-4" />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-sm font-black text-foreground">{point.title}</p>
                          <p className="text-sm leading-6 text-muted-foreground">{point.description}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </MagicCard>
        </section>
      </div>
    </main>
  )
}
