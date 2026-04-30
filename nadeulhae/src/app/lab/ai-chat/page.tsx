"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bot } from "lucide-react"

import { SectionCard } from "@/components/dashboard/ui"
import { LabAiChatPanel } from "@/components/lab/lab-ai-chat-panel"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"

const PAGE_COPY = {
  ko: {
    loading: "채팅을 불러오는 중...",
    loginRequired: "로그인이 필요합니다. 로그인 페이지로 이동합니다.",
    disabledTitle: "실험실 기능이 꺼져 있어요.",
    disabledDescription: "대시보드 프로필 설정에서 '실험실 기능 활성화'를 켜면 바로 사용할 수 있습니다.",
    goDashboard: "대시보드로 이동",
    pageTitle: "나들 AI 채팅",
    pageDescription: "나들 AI와 업무, 공부, 글쓰기, 코딩, 요약까지 이어서 대화할 수 있어요.",
  },
  en: {
    loading: "Loading chat...",
    loginRequired: "You need to log in first. Redirecting to login.",
    disabledTitle: "Lab is disabled.",
    disabledDescription: "Enable 'experimental lab' in dashboard profile settings to access this page.",
    goDashboard: "Go to dashboard",
    pageTitle: "Nadeul AI Chat",
    pageDescription: "Keep a conversation going with Nadeul AI across work, study, writing, coding, and summaries.",
  },
  zh: {
    loading: "正在加载聊天...",
    loginRequired: "请先登录。正在跳转到登录页面。",
    disabledTitle: "实验室功能未开启。",
    disabledDescription: "请在仪表盘个人设置中开启「实验性实验室功能」即可使用。",
    goDashboard: "前往仪表盘",
    pageTitle: "Nadeul AI 聊天",
    pageDescription: "与 Nadeul AI 在工作、学习、写作、编程、摘要等方面持续对话。",
  },
  ja: {
    loading: "チャットを読み込み中...",
    loginRequired: "ログインが必要です。ログインページに移動します。",
    disabledTitle: "ラボ機能が無効です。",
    disabledDescription: "ダッシュボードのプロフィール設定でラボ機能を有効にしてください。",
    goDashboard: "ダッシュボードへ",
    pageTitle: "Nadeul AI チャット",
    pageDescription: "Nadeul AI と仕事、学習、文章作成、コーディング、要約まで継続して会話できます。",
  },
} as const

export default function LabAiChatPage() {
  const router = useRouter()
  const { user, status } = useAuth()
  const { language } = useLanguage()
  const copy = ((PAGE_COPY as any)[language] ?? PAGE_COPY.ko)

  useEffect(() => {
    if (status === "guest") {
      const timeout = window.setTimeout(() => {
        router.replace("/login")
      }, 450)
      return () => window.clearTimeout(timeout)
    }
  }, [router, status])

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-center text-base font-bold text-sky-blue">
        {copy.loading}
      </main>
    )
  }

  if (status === "guest" || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-center text-base font-bold text-sky-blue">
        {copy.loginRequired}
      </main>
    )
  }

  if (!user.labEnabled) {
    return (
      <main className="min-h-screen bg-background px-4 pb-14 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <SectionCard>
            <div className="space-y-4 text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-active-blue">
                <Bot className="size-3.5" />
                experimental lab
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

  return (
    <main className="flex h-[100svh] flex-col overflow-hidden bg-background pt-16 sm:pt-24">
      <LabAiChatPanel />
    </main>
  )
}
