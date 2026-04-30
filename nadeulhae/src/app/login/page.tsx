"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Lock, Mail, Sparkles } from "lucide-react"

import { AuthField } from "@/components/auth/auth-field"
import { AuthShell } from "@/components/auth/auth-shell"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import type { AuthResponseBody } from "@/lib/auth/types"

const LOGIN_COPY = {
  ko: {
    title: "로그인",
    emailLabel: "이메일",
    passwordLabel: "비밀번호",
    emailPlaceholder: "name@example.com",
    passwordPlaceholder: "비밀번호 입력",
    submit: "로그인하기",
    signupPrompt: "아직 계정이 없나요?",
    signupLink: "회원가입",
    termsLink: "약관 보기",
    pendingRedirect: "이미 로그인된 상태입니다. 대시보드로 이동합니다.",
    showPassword: "비밀번호 표시",
    hidePassword: "비밀번호 숨기기",
    submitting: "로그인 중...",
    loginFallbackError: "로그인에 실패했습니다.",
    loginNetworkError: "로그인 요청 중 네트워크 오류가 발생했습니다.",
  },
  en: {
    title: "Log in",
    emailLabel: "Email",
    passwordLabel: "Password",
    emailPlaceholder: "name@example.com",
    passwordPlaceholder: "Enter your password",
    submit: "Log in",
    signupPrompt: "Need an account?",
    signupLink: "Sign up",
    termsLink: "View terms",
    pendingRedirect: "You are already logged in. Redirecting to the dashboard.",
    showPassword: "Show password",
    hidePassword: "Hide password",
    submitting: "Logging in...",
    loginFallbackError: "Login failed.",
    loginNetworkError: "A network error occurred while logging in.",
  },
  zh: {
    title: "登录",
    emailLabel: "邮箱",
    passwordLabel: "密码",
    emailPlaceholder: "name@example.com",
    passwordPlaceholder: "请输入密码",
    submit: "登录",
    signupPrompt: "还没有账户？",
    signupLink: "注册",
    termsLink: "查看条款",
    pendingRedirect: "您已登录。正在跳转到仪表盘。",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    submitting: "登录中...",
    loginFallbackError: "登录失败。",
    loginNetworkError: "登录时发生网络错误。",
  },
  ja: {
    title: "ログイン",
    emailLabel: "メールアドレス",
    passwordLabel: "パスワード",
    emailPlaceholder: "name@example.com",
    passwordPlaceholder: "パスワードを入力",
    submit: "ログイン",
    signupPrompt: "アカウントをお持ちではありませんか？",
    signupLink: "会員登録",
    termsLink: "利用規約を見る",
    pendingRedirect: "すでにログインしています。ダッシュボードに移動します。",
    showPassword: "パスワードを表示",
    hidePassword: "パスワードを隠す",
    submitting: "ログイン中...",
    loginFallbackError: "ログインに失敗しました。",
    loginNetworkError: "ログイン中にネットワークエラーが発生しました。",
  },
} as const

async function readAuthErrorMessage(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: unknown }
    return typeof data?.error === "string" && data.error.trim().length > 0
      ? data.error
      : fallback
  } catch {
    return fallback
  }
}

export default function LoginPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const { status, setAuthenticatedUser } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const copy = ((LOGIN_COPY as any)[language] ?? LOGIN_COPY.ko)

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
            "Accept-Language": language,
          },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        })

        if (!response.ok) {
          setMessage(await readAuthErrorMessage(response, copy.loginFallbackError))
          return
        }

        const data = (await response.json()) as AuthResponseBody
        setAuthenticatedUser((data as AuthResponseBody).user)
        router.push("/dashboard")
        router.refresh()
      } catch (error) {
        console.error("Login request failed:", error)
        setMessage(copy.loginNetworkError)
      }
    })
  }

  const redirectMessage = status === "authenticated" ? copy.pendingRedirect : null

  return (
    <AuthShell
      title={copy.title}
      showSidePanel={false}
      performanceMode="fast"
      footer={(
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
      )}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <AuthField
          type="email"
          label={copy.emailLabel}
          icon={Mail}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={copy.emailPlaceholder}
          autoComplete="email"
          required
        />

        <AuthField
          type={showPassword ? "text" : "password"}
          label={copy.passwordLabel}
          icon={Lock}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={copy.passwordPlaceholder}
          autoComplete="current-password"
          required
          trailing={(
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition hover:text-foreground"
              tabIndex={-1}
              aria-label={showPassword ? copy.hidePassword : copy.showPassword}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          )}
        />

        {redirectMessage ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-[1.3rem] border border-sky-blue/20 bg-sky-blue/10 px-4 py-3 text-sm font-semibold text-sky-blue"
          >
            {redirectMessage}
          </div>
        ) : null}

        {message ? (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-[1.3rem] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger"
          >
            {message}
          </div>
        ) : null}

        <ShimmerButton
          type="submit"
          className="w-full rounded-[1.45rem] py-4 text-base font-black"
          disabled={isPending || status === "authenticated"}
        >
          <span className="inline-flex items-center gap-2">
            {isPending ? copy.submitting : copy.submit}
            <Sparkles className="size-4" />
          </span>
        </ShimmerButton>
      </form>
    </AuthShell>
  )
}
