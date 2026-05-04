"use client"

/**
 * Lab Hub Page — gateway to experimental features (AI Chat, Vocab, Code Share).
 * Handles authentication gate, lab-enabled guard, and viewport/device capability
 * detection to tone down heavy visual effects on low-end devices.
 */

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { BookOpenCheck, Bot, Code2, FlaskConical, Sparkles } from "lucide-react"

import { BorderBeam } from "@/components/magicui/border-beam"
import { MagicCard } from "@/components/magicui/magic-card"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { SectionCard } from "@/components/dashboard/ui"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"

const LAB_HUB_COPY = {
  ko: {
    loading: "실험실을 불러오는 중...",
    loginRequired: "로그인이 필요합니다. 로그인 페이지로 이동합니다.",
    disabledTitle: "실험실 기능이 꺼져 있어요.",
    disabledDescription:
      "대시보드 프로필 설정에서 '실험실 기능 활성화'를 켜면 바로 사용할 수 있습니다.",
    goDashboard: "대시보드로 이동",
    badge: "experimental lab",
    title: "나들 실험실",
    subtitle:
      "실험 기능을 한곳에서 관리하고, 필요한 기능 페이지로 바로 진입할 수 있습니다.",
    introNote:
      "프론트/서버 담당 김현민이 쓰려고 만든 기능인데, 다 같이 써도 됩니다.",
    availableTitle: "사용 가능한 기능",
    aiChatTitle: "나들 AI 채팅",
    aiChatDescription:
      "글쓰기, 코딩, 공부, 번역, 요약, 아이디어 정리까지 나들 AI와 이어서 대화할 수 있는 다용도 채팅입니다.",
    vocabTitle: "단어 암기 실험실",
    vocabDescription:
      "프로필 기반 주제로 카드를 생성하고, 간격 반복 복습으로 기억 유지까지 이어지는 학습 실험 기능입니다.",
    codeShareTitle: "코드공유 실험실",
    codeShareDescription:
      "링크 하나로 여러 명이 동시에 코드를 편집하고, 1시간 비활동 시 자동 종료되어 기록으로 남는 협업 기능입니다.",
    openFeature: "기능 열기",
  },
  en: {
    loading: "Loading lab...",
    loginRequired: "You need to log in first. Redirecting to login.",
    disabledTitle: "Lab is disabled.",
    disabledDescription:
      "Enable 'experimental lab' in dashboard profile settings to access this page.",
    goDashboard: "Go to dashboard",
    badge: "experimental lab",
    title: "Nadeul Lab",
    subtitle:
      "Manage experimental features in one place and move into each feature page when needed.",
    introNote:
      "Built by Hyunmin Kim (frontend/backend) mainly as his own utility feature, but open for everyone.",
    availableTitle: "Available features",
    aiChatTitle: "Nadeul AI Chat",
    aiChatDescription:
      "Continue with Nadeul AI across writing, coding, studying, translation, summaries, and idea work.",
    vocabTitle: "Vocabulary Memory Lab",
    vocabDescription:
      "Generate profile-based cards and retain them with spaced-repetition review.",
    codeShareTitle: "Code Share Lab",
    codeShareDescription:
      "Collaborate on code in real time through a shared link, with auto-close after 1 hour of inactivity and archived history.",
    openFeature: "Open feature",
  },
  zh: {
    loading: "正在加载实验室...",
    loginRequired: "请先登录。正在跳转到登录页面。",
    disabledTitle: "实验室功能未开启。",
    disabledDescription: "请在仪表盘个人设置中开启「实验性实验室功能」即可使用。",
    goDashboard: "前往仪表盘",
    badge: "实验性功能",
    title: "Nadeul 实验室",
    subtitle: "集中管理实验功能，需要时可进入各功能页面。",
    introNote: "由前端/后端开发者 Hyunmin Kim 为自己打造的实用功能，但也欢迎大家使用。",
    availableTitle: "可用功能",
    aiChatTitle: "Nadeul AI 聊天",
    aiChatDescription: "写作、编程、学习、翻译、摘要、创意整理 — 与 Nadeul AI 持续对话的多功能聊天。",
    vocabTitle: "单词记忆实验室",
    vocabDescription: "基于个人资料生成学习卡片，通过间隔重复复习保持记忆。",
    codeShareTitle: "代码共享实验室",
    codeShareDescription: "通过一个链接让多人同时编辑代码，1小时无活动自动关闭，记录保留。",
    openFeature: "打开功能",
  },
  ja: {
    loading: "ラボを読み込み中...",
    loginRequired: "ログインが必要です。ログインページに移動します。",
    disabledTitle: "ラボ機能が無効です。",
    disabledDescription: "ダッシュボードのプロフィール設定で「実験的ラボ機能」を有効にすると利用できます。",
    goDashboard: "ダッシュボードへ",
    badge: "実験的機能",
    title: "Nadeul ラボ",
    subtitle: "実験機能を一元管理し、必要な機能ページにすぐアクセスできます。",
    introNote: "フロントエンド/サーバー担当の Hyunmin Kim が自分用に作った機能ですが、どなたでも使えます。",
    availableTitle: "利用可能な機能",
    aiChatTitle: "Nadeul AI チャット",
    aiChatDescription: "文章作成、コーディング、学習、翻訳、要約、アイデア整理まで Nadeul AI と継続して対話できる多目的チャットです。",
    vocabTitle: "単語暗記ラボ",
    vocabDescription: "プロフィールベースのテーマでカードを作成し、間隔反復復習で記憶を維持する学習機能です。",
    codeShareTitle: "コード共有ラボ",
    codeShareDescription: "リンク一つで複数人が同時にコードを編集でき、1時間の無活動で自動終了、記録として残るコラボレーション機能です。",
    openFeature: "機能を開く",
  },
} as const

// ---- Component ----

export default function LabHubPage() {
  const router = useRouter()
  const { user, status } = useAuth()
  const { language } = useLanguage()
  const copy = ((LAB_HUB_COPY as any)[language] ?? LAB_HUB_COPY.ko)

  // Device/accessibility flags used to reduce heavy visual effects on constrained devices
  const [isCompactViewport, setIsCompactViewport] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isLowPowerDevice, setIsLowPowerDevice] = useState(false)

  // Redirect guests to login after a brief UX-friendly delay (not instant, so the page flash is readable)
  useEffect(() => {
    if (status === "guest") {
      const timeout = window.setTimeout(() => {
        router.replace("/login")
      }, 450)
      return () => window.clearTimeout(timeout)
    }
  }, [router, status])

  // Detect viewport width, reduced-motion preference, and device CPU/memory on mount
  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const applyMotionPreference = () => {
      setPrefersReducedMotion(media.matches)
    }
    const applyViewportMode = () => {
      setIsCompactViewport(window.innerWidth < 1024)
    }
    const applyPowerProfile = () => {
      // Device capability hint used to tone down heavy visual effects on low-end devices.
      const nav = navigator as Navigator & { deviceMemory?: number }
      const cpuCores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : 8
      const memoryGiB = typeof nav.deviceMemory === "number" ? nav.deviceMemory : 8
      setIsLowPowerDevice(cpuCores <= 4 || memoryGiB <= 4)
    }

    applyMotionPreference()
    applyViewportMode()
    applyPowerProfile()

    window.addEventListener("resize", applyViewportMode, { passive: true })
    media.addEventListener("change", applyMotionPreference)
    return () => {
      window.removeEventListener("resize", applyViewportMode)
      media.removeEventListener("change", applyMotionPreference)
    }
  }, [])

  // True when visual effects should be toned down
  const reduceVisualEffects = prefersReducedMotion || isCompactViewport || isLowPowerDevice

  // ---- Render guards ----

  // Auth loading state
  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-center text-base font-bold text-sky-blue">
        {copy.loading}
      </main>
    )
  }

  // Guest / unauthenticated — show message while redirect fires
  if (status === "guest" || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-center text-base font-bold text-sky-blue">
        {copy.loginRequired}
      </main>
    )
  }

  // Lab not enabled — prompt user to toggle in dashboard settings
  if (!user.labEnabled) {
    return (
      <main className="min-h-screen bg-background px-4 pb-14 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <SectionCard>
            <div className="space-y-4 text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-active-blue">
                <FlaskConical className="size-3.5" />
                {copy.badge}
              </span>
              <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">{copy.disabledTitle}</h1>
              <p className="mx-auto max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">{copy.disabledDescription}</p>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-[1.25rem] border border-sky-blue/30 bg-sky-blue/10 px-5 py-3 text-base font-black text-sky-blue transition hover:border-sky-blue hover:bg-sky-blue/20"
              >
                {copy.goDashboard}
              </Link>
            </div>
          </SectionCard>
        </div>
      </main>
    )
  }

  // ---- Main content: lab hub with feature cards ----

  return (
    <main className="min-h-screen bg-background px-4 pb-14 pt-24 sm:px-6 sm:pt-28 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <SectionCard>
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-active-blue">
              <Sparkles className="size-3.5" />
              {copy.badge}
            </span>
            <div className="space-y-2">
              <h1 className="text-5xl font-black tracking-tight text-foreground sm:text-6xl">{copy.title}</h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">{copy.subtitle}</p>
              <p className="max-w-3xl rounded-[1.1rem] border border-sky-blue/20 bg-sky-blue/8 px-4 py-3 text-base font-semibold leading-8 text-foreground/90">
                {copy.introNote}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="space-y-4">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">{copy.availableTitle}</p>
            <div className="grid gap-4">
              <MagicCard
                className="overflow-hidden rounded-[1.8rem]"
                gradientSize={reduceVisualEffects ? 150 : 210}
                gradientOpacity={reduceVisualEffects ? 0.55 : 0.72}
              >
                <div className="relative rounded-[1.8rem] border border-card-border/70 bg-background/80 p-5 sm:p-6">
                  {!reduceVisualEffects ? (
                    <BorderBeam size={170} duration={10.5} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
                  ) : null}
                  <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-card-border/70 bg-card/80 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                        <Bot className="size-3.5" />
                        {copy.aiChatTitle}
                      </span>
                      <p className="max-w-2xl text-base leading-8 text-muted-foreground">{copy.aiChatDescription}</p>
                    </div>
                    <ShimmerButton
                      type="button"
                      onClick={() => router.push("/lab/ai-chat")}
                      className="rounded-[1.1rem] px-5 py-3 text-base font-black sm:shrink-0"
                    >
                      {copy.openFeature}
                    </ShimmerButton>
                  </div>
                </div>
              </MagicCard>

              <MagicCard
                className="overflow-hidden rounded-[1.8rem]"
                gradientSize={reduceVisualEffects ? 150 : 210}
                gradientOpacity={reduceVisualEffects ? 0.55 : 0.72}
              >
                <div className="relative rounded-[1.8rem] border border-card-border/70 bg-background/80 p-5 sm:p-6">
                  {!reduceVisualEffects ? (
                    <BorderBeam size={170} duration={11} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
                  ) : null}
                  <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-card-border/70 bg-card/80 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                        <BookOpenCheck className="size-3.5" />
                        {copy.vocabTitle}
                      </span>
                      <p className="max-w-2xl text-base leading-8 text-muted-foreground">{copy.vocabDescription}</p>
                    </div>
                    <ShimmerButton
                      type="button"
                      onClick={() => router.push("/lab/vocab")}
                      className="rounded-[1.1rem] px-5 py-3 text-base font-black sm:shrink-0"
                    >
                      {copy.openFeature}
                    </ShimmerButton>
                  </div>
                </div>
              </MagicCard>

              <MagicCard
                className="overflow-hidden rounded-[1.8rem]"
                gradientSize={reduceVisualEffects ? 150 : 210}
                gradientOpacity={reduceVisualEffects ? 0.55 : 0.72}
              >
                <div className="relative rounded-[1.8rem] border border-card-border/70 bg-background/80 p-5 sm:p-6">
                  {!reduceVisualEffects ? (
                    <BorderBeam size={170} duration={12.5} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
                  ) : null}
                  <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-card-border/70 bg-card/80 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                        <Code2 className="size-3.5" />
                        {copy.codeShareTitle}
                      </span>
                      <p className="max-w-2xl text-base leading-8 text-muted-foreground">{copy.codeShareDescription}</p>
                    </div>
                    <ShimmerButton
                      type="button"
                      onClick={() => router.push("/lab/code-share")}
                      className="rounded-[1.1rem] px-5 py-3 text-base font-black sm:shrink-0"
                    >
                      {copy.openFeature}
                    </ShimmerButton>
                  </div>
                </div>
              </MagicCard>
            </div>
          </div>
        </SectionCard>
      </div>
    </main>
  )
}
