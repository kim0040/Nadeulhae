"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Lock, Mail } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-shell"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import type { AuthResponseBody } from "@/lib/auth/types"

const LOGIN_COPY = {
  ko: {
    badge: "secure access",
    title: "로그인",
    description: "저장된 취향과 지역 설정을 불러와 오늘의 나들이 판단을 바로 이어가세요.",
    sideEyebrow: "auth ready",
    sideTitle: "날씨 판단과 취향 기록을 한 번에 이어받는 로그인",
    sideDescription:
      "회원 정보를 DB에 안전하게 저장하고, 로그인 후에는 선호 시간대와 취미를 반영한 나들이 경험으로 이어집니다.",
    stats: [
      { label: "암호 처리", value: "scrypt + salt" },
      { label: "세션 보안", value: "HttpOnly Cookie" },
      { label: "프로필 연동", value: "지역·취미 반영" },
    ],
    emailLabel: "이메일",
    passwordLabel: "비밀번호",
    emailPlaceholder: "name@example.com",
    passwordPlaceholder: "비밀번호 입력",
    helper: "비밀번호는 서버에서 복호화되지 않는 해시 형태로만 저장됩니다.",
    submit: "로그인하기",
    signupPrompt: "아직 계정이 없나요?",
    signupLink: "회원가입",
    termsLink: "약관 보기",
    pendingRedirect: "이미 로그인된 상태입니다. 계정 페이지로 이동합니다.",
  },
  en: {
    badge: "secure access",
    title: "Log in",
    description: "Restore your saved outing profile and continue with today’s briefing immediately.",
    sideEyebrow: "auth ready",
    sideTitle: "Sign in to recover your weather profile and preferences",
    sideDescription:
      "The database stores profile preferences securely so the service can bring back your preferred time slots, region defaults, and interests.",
    stats: [
      { label: "Password", value: "scrypt + salt" },
      { label: "Session", value: "HttpOnly Cookie" },
      { label: "Profile", value: "Region + hobbies" },
    ],
    emailLabel: "Email",
    passwordLabel: "Password",
    emailPlaceholder: "name@example.com",
    passwordPlaceholder: "Enter your password",
    helper: "Passwords are stored only as non-reversible hashes on the server.",
    submit: "Log in",
    signupPrompt: "Need an account?",
    signupLink: "Sign up",
    termsLink: "View terms",
    pendingRedirect: "You are already logged in. Redirecting to your account.",
  },
} as const

const LOGIN_MARQUEE = [
  "Jeonju default briefing",
  "Fine dust aware",
  "Picnic profile",
  "Golden hour outings",
  "Weather-safe planning",
  "Cafe + park routes",
  "Alert-ready sessions",
  "Personalized timing",
]

export default function LoginPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const { status, setAuthenticatedUser } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const copy = LOGIN_COPY[language]

  useEffect(() => {
    if (status === "authenticated") {
      const timeout = window.setTimeout(() => {
        router.replace("/account")
      }, 400)

      return () => window.clearTimeout(timeout)
    }
  }, [copy.pendingRedirect, router, status])

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
        router.push("/account")
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

  const errorMessage = message
  const redirectMessage = status === "authenticated" ? copy.pendingRedirect : null

  return (
    <AuthShell
      badge={copy.badge}
      title={copy.title}
      description={copy.description}
      sideEyebrow={copy.sideEyebrow}
      sideTitle={copy.sideTitle}
      sideDescription={copy.sideDescription}
      marqueeItems={LOGIN_MARQUEE}
      statItems={copy.stats}
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-card-border/70 pt-6">
          <p className="text-sm text-muted-foreground">
            {copy.signupPrompt}{" "}
            <Link href="/signup" className="font-black text-sky-blue hover:underline">
              {copy.signupLink}
            </Link>
          </p>
          <Link href="/terms" className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground hover:text-sky-blue">
            {copy.termsLink}
          </Link>
        </div>
      )}
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="ml-1 text-[11px] font-black uppercase tracking-[0.28em] text-sky-blue">
            {copy.emailLabel}
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={copy.emailPlaceholder}
              className="w-full rounded-[1.5rem] border border-interactive-border bg-interactive/70 py-4 pl-12 pr-4 text-sm font-medium text-foreground outline-none transition focus:border-sky-blue/50"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="ml-1 text-[11px] font-black uppercase tracking-[0.28em] text-sky-blue">
            {copy.passwordLabel}
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={copy.passwordPlaceholder}
              className="w-full rounded-[1.5rem] border border-interactive-border bg-interactive/70 py-4 pl-12 pr-4 text-sm font-medium text-foreground outline-none transition focus:border-sky-blue/50"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        <div className="rounded-[1.4rem] border border-card-border/70 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
          {copy.helper}
        </div>

        {redirectMessage ? (
          <div className="rounded-[1.3rem] border border-sky-blue/20 bg-sky-blue/10 px-4 py-3 text-sm font-semibold text-sky-blue">
            {redirectMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-[1.3rem] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
            {errorMessage}
          </div>
        ) : null}

        <ShimmerButton
          type="submit"
          className="w-full rounded-[1.5rem] py-4 text-base font-black"
          disabled={isPending || status === "authenticated"}
        >
          {isPending ? "..." : copy.submit}
        </ShimmerButton>
      </form>
    </AuthShell>
  )
}
