"use client"

import { useMemo, useState, useSyncExternalStore, useTransition } from "react"
import Link from "next/link"
import { BarChart3, ShieldCheck } from "lucide-react"

import { BorderBeam } from "@/components/magicui/border-beam"
import { MagicCard } from "@/components/magicui/magic-card"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import {
  ANALYTICS_CONSENT_COOKIE_NAME,
  type AnalyticsConsentPreference,
  normalizeAnalyticsConsentPreference,
} from "@/lib/analytics/consent"
import { cn } from "@/lib/utils"

const BANNER_COPY = {
  ko: {
    badge: "privacy controls",
    title: "서비스 개선용 분석 동의를 선택해 주세요",
    description:
      "기본 운영 통계는 익명 일일 합계로만 저장합니다. 상세 방문 분석은 동의한 경우에만 경로, 유입 채널, 테마, 기기 구간, 고유 방문자 수를 일별 집계로 저장합니다.",
    essentialTitle: "필수 운영 통계만 유지",
    essentialDescription: "보안, 장애 대응, 기본 이용량 확인을 위한 익명 일일 집계만 저장합니다.",
    allowTitle: "서비스 개선 분석 허용",
    allowDescription: "유입 채널, 페이지 맥락, 고유 방문자·회원 수를 추가 집계해 추천과 UX 개선에 활용합니다.",
    essentialAction: "필수만 유지",
    allowAction: "분석 허용",
    link: "약관·개인정보 보기",
    saving: "저장 중...",
  },
  en: {
    badge: "privacy controls",
    title: "Choose your service-improvement analytics preference",
    description:
      "Essential operational stats are stored only as anonymous daily aggregates. Detailed visit analytics are collected only with consent, including route, acquisition channel, theme, device bucket, and daily unique visitor counts.",
    essentialTitle: "Keep essential metrics only",
    essentialDescription: "Store only anonymous daily aggregates for security, reliability, and basic traffic monitoring.",
    allowTitle: "Allow improvement analytics",
    allowDescription: "Add acquisition, page context, and unique visitor or member counts to improve recommendations and UX.",
    essentialAction: "Essential only",
    allowAction: "Allow analytics",
    link: "View terms and privacy",
    saving: "Saving...",
  },
} as const

function readConsentPreferenceFromDocument() {
  if (typeof document === "undefined") {
    return null
  }

  const cookies = document.cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)

  const cookie = cookies.find((part) => part.startsWith(`${ANALYTICS_CONSENT_COOKIE_NAME}=`))
  if (!cookie) {
    return null
  }

  return normalizeAnalyticsConsentPreference(cookie.split("=")[1] ?? "")
}

export function AnalyticsConsentBanner() {
  const { language } = useLanguage()
  const { user, status, refreshSession } = useAuth()
  const [optimisticPreference, setOptimisticPreference] = useState<AnalyticsConsentPreference | null>(null)
  const [isPending, startTransition] = useTransition()
  const copy = BANNER_COPY[language]
  const cookiePreference = useSyncExternalStore(
    () => () => {},
    readConsentPreferenceFromDocument,
    () => null
  )

  const preference = useMemo(() => {
    if (optimisticPreference) {
      return optimisticPreference
    }

    if (cookiePreference) {
      return cookiePreference
    }

    if (status === "loading") {
      return undefined
    }

    if (user?.analyticsAccepted) {
      return "allow"
    }

    return null
  }, [cookiePreference, optimisticPreference, status, user?.analyticsAccepted])

  const handleSelect = (nextPreference: AnalyticsConsentPreference) => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/analytics/consent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            preference: nextPreference,
            locale: language,
          }),
        })

        if (!response.ok) {
          return
        }

        setOptimisticPreference(nextPreference)
        await refreshSession()
      } catch (error) {
        console.error("Failed to update analytics consent:", error)
      }
    })
  }

  if (preference !== null) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] px-4 sm:bottom-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <MagicCard
          className="pointer-events-auto overflow-hidden rounded-[2rem]"
          gradientSize={220}
          gradientOpacity={0.7}
        >
          <div className="relative rounded-[2rem] border border-card-border/70 bg-card/95 p-5 shadow-2xl backdrop-blur-2xl sm:p-6">
            <BorderBeam
              size={180}
              duration={10}
              colorFrom="var(--beam-from)"
              colorTo="var(--beam-to)"
            />
            <div className="relative z-10 space-y-5">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-blue/20 bg-sky-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-sky-blue">
                  <ShieldCheck className="size-3.5" />
                  {copy.badge}
                </span>
                <div className="space-y-2">
                  <h2 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
                    {copy.title}
                  </h2>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    {copy.description}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-[1.5rem] border border-card-border/70 bg-background/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-foreground">
                    <ShieldCheck className="size-4 text-sky-blue" />
                    {copy.essentialTitle}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {copy.essentialDescription}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-card-border/70 bg-background/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-foreground">
                    <BarChart3 className="size-4 text-sky-blue" />
                    {copy.allowTitle}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {copy.allowDescription}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/terms#analytics"
                  className="text-sm font-semibold text-sky-blue transition hover:text-active-blue"
                >
                  {copy.link}
                </Link>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => handleSelect("essential")}
                    disabled={isPending}
                    className={cn(
                      "rounded-full border border-card-border/70 bg-background/80 px-5 py-3 text-sm font-black text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue disabled:cursor-not-allowed disabled:opacity-70"
                    )}
                  >
                    {isPending ? copy.saving : copy.essentialAction}
                  </button>
                  <ShimmerButton
                    type="button"
                    onClick={() => handleSelect("allow")}
                    disabled={isPending}
                    className="rounded-full px-6 py-3 text-sm font-black"
                  >
                    {isPending ? copy.saving : copy.allowAction}
                  </ShimmerButton>
                </div>
              </div>
            </div>
          </div>
        </MagicCard>
      </div>
    </div>
  )
}
