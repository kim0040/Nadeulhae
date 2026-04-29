"use client"

import { useMemo, useState, useSyncExternalStore, useTransition } from "react"
import Link from "next/link"
import { ChartColumn, ShieldCheck } from "lucide-react"

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
      "기본 운영 통계는 익명 일일 합계만 저장합니다. 상세 방문 분석은 동의한 경우에만 확장됩니다.",
    essentialTitle: "필수 운영 통계만 유지",
    essentialDescription: "보안, 장애 대응, 기본 이용량 확인을 위한 익명 일일 집계만 저장합니다.",
    allowTitle: "서비스 개선 분석 허용",
    allowDescription: "유입 채널, 페이지 맥락, 고유 방문자·회원 수를 추가 집계해 추천과 UX 개선에 활용합니다.",
    note: "원문 IP와 전체 리퍼러 URL은 분석 테이블에 저장하지 않습니다.",
    essentialAction: "필수만 유지",
    allowAction: "분석 허용",
    link: "약관·개인정보 보기",
    saving: "저장 중...",
    saveError: "동의 설정 저장에 실패했어요. 다시 시도해 주세요.",
  },
  en: {
    badge: "privacy controls",
    title: "Choose your service-improvement analytics preference",
    description:
      "Essential operational stats are stored only as anonymous daily aggregates. Detailed visit analytics expand only after consent.",
    essentialTitle: "Keep essential metrics only",
    essentialDescription: "Store only anonymous daily aggregates for security, reliability, and basic traffic monitoring.",
    allowTitle: "Allow improvement analytics",
    allowDescription: "Add acquisition, page context, and unique visitor or member counts to improve recommendations and UX.",
    note: "Raw IP addresses and full referrer URLs are not stored in analytics tables.",
    essentialAction: "Essential only",
    allowAction: "Allow analytics",
    link: "View terms and privacy",
    saving: "Saving...",
    saveError: "Failed to save your consent preference. Please try again.",
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const copy = (BANNER_COPY as any)[language]
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
    setErrorMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch("/api/analytics/consent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept-Language": language,
          },
          credentials: "include",
          body: JSON.stringify({
            preference: nextPreference,
            locale: language,
          }),
        })

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: unknown } | null
          setErrorMessage(
            typeof payload?.error === "string" && payload.error.trim().length > 0
              ? payload.error
              : copy.saveError
          )
          return
        }

        setOptimisticPreference(nextPreference)
        await refreshSession()
      } catch (error) {
        console.error("Failed to update analytics consent:", error)
        setErrorMessage(copy.saveError)
      }
    })
  }

  if (preference !== null) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[70] px-3 sm:bottom-5 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <MagicCard
          className="pointer-events-auto overflow-hidden rounded-[2rem]"
          gradientSize={220}
          gradientOpacity={0.7}
        >
          <div className="relative max-h-[calc(100svh-1.5rem)] overflow-y-auto rounded-[2rem] border border-card-border/70 bg-card/95 p-4 shadow-2xl backdrop-blur-2xl sm:p-6">
            <BorderBeam
              size={180}
              duration={10}
              colorFrom="var(--beam-from)"
              colorTo="var(--beam-to)"
            />
            <div className="relative z-10 space-y-5">
              <div className="space-y-2.5">
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-blue/20 bg-sky-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-sky-blue">
                  <ShieldCheck className="size-3.5" />
                  {copy.badge}
                </span>
                <div className="space-y-2">
                  <h2 className="text-lg font-black tracking-tight text-foreground sm:text-2xl">
                    {copy.title}
                  </h2>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    {copy.description}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.35rem] border border-card-border/70 bg-background/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-foreground">
                    <ShieldCheck className="size-4 text-sky-blue" />
                    {copy.essentialTitle}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {copy.essentialDescription}
                  </p>
                </div>
                <div className="rounded-[1.35rem] border border-card-border/70 bg-background/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-foreground">
                    <ChartColumn className="size-4 text-sky-blue" />
                    {copy.allowTitle}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {copy.allowDescription}
                  </p>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-card-border/70 bg-background/60 px-4 py-3 text-xs leading-5 text-muted-foreground">
                {copy.note}
              </div>

              {errorMessage ? (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="rounded-[1.2rem] border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger"
                >
                  {errorMessage}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 border-t border-card-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/terms#analytics"
                  className="text-sm font-semibold text-sky-blue transition hover:text-active-blue"
                >
                  {copy.link}
                </Link>
                <div className="grid gap-3 sm:flex sm:flex-row">
                  <button
                    type="button"
                    onClick={() => handleSelect("essential")}
                    disabled={isPending}
                    className={cn(
                      "w-full rounded-full border border-card-border/70 bg-background/80 px-5 py-3 text-sm font-black text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                    )}
                  >
                    {isPending ? copy.saving : copy.essentialAction}
                  </button>
                  <ShimmerButton
                    type="button"
                    onClick={() => handleSelect("allow")}
                    disabled={isPending}
                    className="w-full rounded-full px-6 py-3 text-sm font-black sm:w-auto"
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
