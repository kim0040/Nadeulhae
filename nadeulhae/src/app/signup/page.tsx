"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Lock, Mail, MapPinned, Sparkles, User } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-shell"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import {
  AGE_BAND_OPTIONS,
  INTEREST_OPTIONS,
  MAX_INTEREST_SELECTIONS,
  PRIMARY_REGION_OPTIONS,
  TIME_SLOT_OPTIONS,
  WEATHER_SENSITIVITY_OPTIONS,
} from "@/lib/auth/profile-options"
import type { AuthResponseBody } from "@/lib/auth/types"
import { cn } from "@/lib/utils"

type FormState = {
  displayName: string
  email: string
  password: string
  ageBand: string
  primaryRegion: string
  preferredTimeSlot: string
  interestTags: string[]
  interestOther: string
  weatherSensitivity: string[]
  termsAccepted: boolean
  privacyAccepted: boolean
  ageConfirmed: boolean
  marketingAccepted: boolean
  analyticsAccepted: boolean
}

const SIGNUP_COPY = {
  ko: {
    badge: "profile onboarding",
    title: "회원가입",
    description: "나이, 취미, 선호 시간대를 함께 저장해서 나들해가 더 정확한 나들이 기준을 보여주도록 설정합니다.",
    sideEyebrow: "personal setup",
    sideTitle: "나들해에 어울리는 기본 프로필을 먼저 구성하세요",
    sideDescription:
      "가입 시 수집한 정보는 지역 기준 브리핑, 선호 시간대 추천, 취미 기반 나들이 제안의 기본값으로 사용됩니다.",
    stats: [
      { label: "필수 입력", value: "계정 + 프로필" },
      { label: "취미 선택", value: "최대 5개" },
      { label: "동의 항목", value: "필수 3 + 선택 2" },
    ],
    basicSection: "기본 계정 정보",
    personalSection: "맞춤 나들이 정보",
    consentSection: "필수·선택 동의",
    nameLabel: "이름",
    namePlaceholder: "홍길동",
    emailLabel: "이메일",
    passwordLabel: "비밀번호",
    passwordPlaceholder: "영문+숫자 포함 10자 이상",
    ageLabel: "연령대",
    regionLabel: "주 사용 지역",
    hobbyLabel: "취미·관심사",
    hobbyHelper: "나들해가 추천 방향을 잡을 수 있도록 최대 5개까지 골라 주세요.",
    hobbyOtherPlaceholder: "기타 취미를 적어 주세요",
    timeLabel: "선호 시간대",
    sensitivityLabel: "민감한 날씨 요소",
    sensitivityHelper: "선택 사항입니다. 민감한 요소는 브리핑 문구에 우선 반영됩니다.",
    termsLabel: "서비스 이용약관에 동의합니다. (필수)",
    privacyLabel: "개인정보 수집·이용 안내에 동의합니다. (필수)",
    ageConfirmLabel: "만 14세 이상입니다. (필수)",
    marketingLabel: "맞춤 추천/공지 알림 수신에 동의합니다. (선택)",
    analyticsLabel: "서비스 개선을 위한 이용행태 분석에 동의합니다. (선택)",
    analyticsHelper:
      "동의 시 유입 채널, 방문 경로, 라이트/다크 테마, 기기 구간, 고유 방문자 수를 일별 집계로 저장합니다. 원문 IP와 전체 리퍼러 URL은 분석 테이블에 저장하지 않습니다.",
    termsLink: "약관 보기",
    submit: "가입하고 바로 시작하기",
    loginPrompt: "이미 계정이 있나요?",
    loginLink: "로그인",
    successRedirect: "이미 로그인된 상태입니다. 계정 화면으로 이동합니다.",
  },
  en: {
    badge: "profile onboarding",
    title: "Sign up",
    description: "Save age range, hobbies, and preferred outing time so Nadeulhae can personalize your outings.",
    sideEyebrow: "personal setup",
    sideTitle: "Build your outdoor profile before you start",
    sideDescription:
      "These fields power regional defaults, time-of-day recommendations, and hobby-aware outing suggestions.",
    stats: [
      { label: "Inputs", value: "Account + profile" },
      { label: "Hobbies", value: "Up to 5" },
      { label: "Consent", value: "3 required + 2 optional" },
    ],
    basicSection: "Basic account details",
    personalSection: "Personalized outing profile",
    consentSection: "Required and optional consent",
    nameLabel: "Name",
    namePlaceholder: "Your name",
    emailLabel: "Email",
    passwordLabel: "Password",
    passwordPlaceholder: "At least 10 chars with letters and numbers",
    ageLabel: "Age range",
    regionLabel: "Primary region",
    hobbyLabel: "Hobbies and interests",
    hobbyHelper: "Choose up to 5 interests so the service can personalize recommendations.",
    hobbyOtherPlaceholder: "Describe your other interest",
    timeLabel: "Preferred time slot",
    sensitivityLabel: "Weather sensitivities",
    sensitivityHelper: "Optional. Sensitive factors are emphasized in your briefing.",
    termsLabel: "I agree to the service terms. (Required)",
    privacyLabel: "I agree to the privacy collection and use notice. (Required)",
    ageConfirmLabel: "I confirm I am at least 14 years old. (Required)",
    marketingLabel: "I agree to receive optional recommendation notices. (Optional)",
    analyticsLabel: "I agree to analytics for service improvement. (Optional)",
    analyticsHelper:
      "When enabled, Nadeulhae stores daily aggregates for acquisition source, page path, light or dark theme, device bucket, and unique visitor counts. Raw IP addresses and full referrer URLs are not stored in analytics tables.",
    termsLink: "Read terms",
    submit: "Create account",
    loginPrompt: "Already have an account?",
    loginLink: "Log in",
    successRedirect: "You are already logged in. Redirecting to your account.",
  },
} as const

const SIGNUP_MARQUEE = [
  "전주 기준 브리핑",
  "취미 맞춤 코스",
  "가족/반려동물 나들이",
  "황사·비 민감도 반영",
  "선호 시간대 기억",
  "현재 위치 우선 판단",
  "캠퍼스/공원 산책",
  "해질녘 산책 루트",
]

function AuthField({
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
            "w-full rounded-[1.5rem] border border-interactive-border bg-interactive/70 py-4 pl-12 pr-4 text-sm font-medium text-foreground outline-none transition focus:border-sky-blue/50",
            props.className
          )}
        />
      </div>
    </div>
  )
}

function OptionButton({
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
        "rounded-[1.4rem] border px-4 py-3 text-left transition",
        selected
          ? "border-sky-blue/40 bg-sky-blue/10 text-sky-blue"
          : "border-card-border/70 bg-background/70 text-foreground hover:border-sky-blue/25"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black">{label}</p>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {selected ? <Check className="mt-0.5 size-4 shrink-0" /> : null}
      </div>
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

export default function SignupPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const { status, setAuthenticatedUser } = useAuth()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const copy = SIGNUP_COPY[language]

  const [form, setForm] = useState<FormState>({
    displayName: "",
    email: "",
    password: "",
    ageBand: "20_29",
    primaryRegion: "jeonju",
    preferredTimeSlot: "afternoon",
    interestTags: ["picnic", "walking"],
    interestOther: "",
    weatherSensitivity: [],
    termsAccepted: false,
    privacyAccepted: false,
    ageConfirmed: false,
    marketingAccepted: false,
    analyticsAccepted: false,
  })

  useEffect(() => {
    if (status === "authenticated") {
      const timeout = window.setTimeout(() => {
        router.replace("/account")
      }, 400)

      return () => window.clearTimeout(timeout)
    }
  }, [copy.successRedirect, router, status])

  const localizedRegions = useMemo(
    () => PRIMARY_REGION_OPTIONS.map((option) => ({
      ...option,
      label: option.label[language],
      description: option.description?.[language],
    })),
    [language]
  )

  const toggleInterest = (value: string) => {
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
        setMessage(
          language === "ko"
            ? `취미는 최대 ${MAX_INTEREST_SELECTIONS}개까지 선택할 수 있습니다.`
            : `You can select up to ${MAX_INTEREST_SELECTIONS} hobbies.`
        )
        return current
      }

      return {
        ...current,
        interestTags: [...current.interestTags, value],
      }
    })
  }

  const toggleWeatherSensitivity = (value: string) => {
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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(form),
        })

        const data = await response.json()
        if (!response.ok) {
          setMessage(
            data.error ?? (language === "ko" ? "회원가입에 실패했습니다." : "Sign-up failed.")
          )
          return
        }

        setAuthenticatedUser((data as AuthResponseBody).user)
        router.push("/account")
        router.refresh()
      } catch (error) {
        console.error("Sign-up request failed:", error)
        setMessage(
          language === "ko"
            ? "회원가입 요청 중 네트워크 오류가 발생했습니다."
            : "A network error occurred while signing up."
        )
      }
    })
  }

  return (
    <AuthShell
      badge={copy.badge}
      title={copy.title}
      description={copy.description}
      sideEyebrow={copy.sideEyebrow}
      sideTitle={copy.sideTitle}
      sideDescription={copy.sideDescription}
      marqueeItems={SIGNUP_MARQUEE}
      statItems={copy.stats}
      panelClassName="xl:min-h-[860px]"
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-card-border/70 pt-6">
          <p className="text-sm text-muted-foreground">
            {copy.loginPrompt}{" "}
            <Link href="/login" className="font-black text-sky-blue hover:underline">
              {copy.loginLink}
            </Link>
          </p>
          <Link href="/terms" className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground hover:text-sky-blue">
            {copy.termsLink}
          </Link>
        </div>
      )}
    >
      <form className="space-y-8" onSubmit={handleSubmit}>
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-muted-foreground">
              {copy.basicSection}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthField
              label={copy.nameLabel}
              icon={User}
              type="text"
              value={form.displayName}
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
              placeholder={copy.namePlaceholder}
              autoComplete="name"
              required
            />
            <AuthField
              label={copy.emailLabel}
              icon={Mail}
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="name@example.com"
              autoComplete="email"
              required
            />
          </div>
          <AuthField
            label={copy.passwordLabel}
            icon={Lock}
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder={copy.passwordPlaceholder}
            autoComplete="new-password"
            required
          />
        </section>

        <section className="space-y-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-muted-foreground">
              {copy.personalSection}
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-black text-foreground">{copy.ageLabel}</label>
            <div className="grid gap-3 sm:grid-cols-3">
              {AGE_BAND_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  selected={form.ageBand === option.value}
                  label={option.label[language]}
                  onClick={() => setForm((current) => ({ ...current, ageBand: option.value }))}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-black text-foreground">
              <MapPinned className="size-4 text-sky-blue" />
              {copy.regionLabel}
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {localizedRegions.map((option) => (
                <OptionButton
                  key={option.value}
                  selected={form.primaryRegion === option.value}
                  label={option.label}
                  description={option.description}
                  onClick={() => setForm((current) => ({ ...current, primaryRegion: option.value }))}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-black text-foreground">{copy.hobbyLabel}</label>
              <span className="text-xs font-bold text-muted-foreground">
                {form.interestTags.length}/{MAX_INTEREST_SELECTIONS}
              </span>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{copy.hobbyHelper}</p>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((option) => (
                <ToggleChip
                  key={option.value}
                  selected={form.interestTags.includes(option.value)}
                  label={option.label[language]}
                  onClick={() => toggleInterest(option.value)}
                />
              ))}
            </div>
            {form.interestTags.includes("other") ? (
              <input
                type="text"
                value={form.interestOther}
                onChange={(event) => setForm((current) => ({ ...current, interestOther: event.target.value }))}
                placeholder={copy.hobbyOtherPlaceholder}
                className="w-full rounded-[1.3rem] border border-interactive-border bg-interactive/70 px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-sky-blue/50"
              />
            ) : null}
          </div>

          <div className="space-y-3">
            <label className="text-sm font-black text-foreground">{copy.timeLabel}</label>
            <div className="grid gap-3 sm:grid-cols-2">
              {TIME_SLOT_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  selected={form.preferredTimeSlot === option.value}
                  label={option.label[language]}
                  onClick={() => setForm((current) => ({ ...current, preferredTimeSlot: option.value }))}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-black text-foreground">{copy.sensitivityLabel}</label>
            <p className="text-sm leading-6 text-muted-foreground">{copy.sensitivityHelper}</p>
            <div className="flex flex-wrap gap-2">
              {WEATHER_SENSITIVITY_OPTIONS.map((option) => (
                <ToggleChip
                  key={option.value}
                  selected={form.weatherSensitivity.includes(option.value)}
                  label={option.label[language]}
                  onClick={() => toggleWeatherSensitivity(option.value)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-[1.8rem] border border-card-border/70 bg-background/70 p-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-muted-foreground">
              {copy.consentSection}
            </p>
          </div>
          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.termsAccepted}
              onChange={(event) => setForm((current) => ({ ...current, termsAccepted: event.target.checked }))}
              className="mt-1 size-4 rounded border-card-border accent-sky-blue"
              required
            />
            <span>
              {copy.termsLabel}{" "}
              <Link href="/terms#service" className="font-black text-sky-blue hover:underline">
                {copy.termsLink}
              </Link>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.privacyAccepted}
              onChange={(event) => setForm((current) => ({ ...current, privacyAccepted: event.target.checked }))}
              className="mt-1 size-4 rounded border-card-border accent-sky-blue"
              required
            />
            <span>
              {copy.privacyLabel}{" "}
              <Link href="/terms#privacy" className="font-black text-sky-blue hover:underline">
                {copy.termsLink}
              </Link>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.ageConfirmed}
              onChange={(event) => setForm((current) => ({ ...current, ageConfirmed: event.target.checked }))}
              className="mt-1 size-4 rounded border-card-border accent-sky-blue"
              required
            />
            <span>{copy.ageConfirmLabel}</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.marketingAccepted}
              onChange={(event) => setForm((current) => ({ ...current, marketingAccepted: event.target.checked }))}
              className="mt-1 size-4 rounded border-card-border accent-sky-blue"
            />
            <span>{copy.marketingLabel}</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.analyticsAccepted}
              onChange={(event) => setForm((current) => ({ ...current, analyticsAccepted: event.target.checked }))}
              className="mt-1 size-4 rounded border-card-border accent-sky-blue"
            />
            <span>
              {copy.analyticsLabel}
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {copy.analyticsHelper}{" "}
                <Link href="/terms#analytics" className="font-black text-sky-blue hover:underline">
                  {copy.termsLink}
                </Link>
              </span>
            </span>
          </label>
        </section>

        {status === "authenticated" ? (
          <div className="rounded-[1.3rem] border border-sky-blue/20 bg-sky-blue/10 px-4 py-3 text-sm font-semibold text-sky-blue">
            {copy.successRedirect}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-[1.3rem] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
            {message}
          </div>
        ) : null}

        <ShimmerButton
          type="submit"
          className="w-full rounded-[1.5rem] py-4 text-base font-black"
          disabled={isPending || status === "authenticated"}
        >
          <span className="inline-flex items-center gap-2">
            {isPending ? "..." : copy.submit}
            <Sparkles className="size-4" />
          </span>
        </ShimmerButton>
      </form>
    </AuthShell>
  )
}
