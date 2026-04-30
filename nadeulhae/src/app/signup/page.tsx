"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Eye, EyeOff, Lock, Mail, MapPinned, Sparkles, User } from "lucide-react"

import { AuthField } from "@/components/auth/auth-field"
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
  nickname: string
  email: string
  password: string
  passwordConfirm: string
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
    title: "회원가입",
    sideEyebrow: "personal setup",
    sideTitle: "나만의 맞춤 나들이 프로필을 만들어보세요",
    sideDescription:
      "여기서 설정한 정보들은 나들해가 지역 브리핑과 취향 맞춤 코스를 추천할 때 소중하게 쓰입니다.",
    stats: [
      { label: "필수 입력", value: "계정 + 프로필" },
      { label: "취미 선택", value: "최대 5개" },
      { label: "동의 항목", value: "필수 3 + 선택 2" },
    ],
    basicSection: "기본 계정 설정",
    personalSection: "나들이 취향 설정",
    consentSection: "약관 동의",
    consentHelper: "선택 항목은 나중에 대시보드에서 편하게 바꿀 수 있어요.",
    consentAllLabel: "아래 약관 항목 전체에 동의합니다. (선택/필수 포함)",
    nameLabel: "이름",
    namePlaceholder: "홍길동",
    nicknameLabel: "닉네임",
    nicknamePlaceholder: "초코송이",
    nicknameHint: "채팅에서 사용되는 별명입니다. (2~16자)",
    emailLabel: "이메일",
    passwordLabel: "비밀번호",
    passwordPlaceholder: "영문+숫자 포함 10자 이상",
    passwordConfirmLabel: "비밀번호 확인",
    passwordConfirmPlaceholder: "비밀번호를 다시 입력하세요",
    passwordRuleLength: "10자 이상",
    passwordRuleLetter: "영문 포함",
    passwordRuleNumber: "숫자 포함",
    passwordRuleMatch: "비밀번호 일치",
    ageLabel: "연령대",
    regionLabel: "주 사용 지역",
    hobbyLabel: "취미·관심사",
    hobbyHelper: "나들해가 즐거운 목적지를 추천해 드릴 수 있도록 최대 5개까지 골라주세요.",
    hobbyOtherPlaceholder: "기타 취미를 적어 주세요",
    timeLabel: "선호 시간대",
    sensitivityLabel: "민감한 날씨 요소",
    sensitivityHelper: "선택해 주시면 오늘 꼭 피해야 할 날씨를 알림 브리핑에서 먼저 알려드릴게요.",
    termsLabel: "서비스 이용약관에 동의합니다. (필수)",
    privacyLabel: "개인정보 수집·이용 안내에 동의합니다. (필수)",
    ageConfirmLabel: "만 14세 이상입니다. (필수)",
    marketingLabel: "나들이 맞춤 추천 및 꿀팁 알림 수신에 동의합니다. (선택)",
    analyticsLabel: "더 나은 나들해를 만들기 위한 이용 통계 수집에 동의합니다. (선택)",
    analyticsHelper:
      "어떤 화면을 좋아하시는지 통계를 내어 서비스를 개선하는 데 활용해요. 개인을 식별할 수 있는 민감한 정보는 절대 저장하지 않으니 안심하세요.",
    termsLink: "약관 보기",
    submit: "가입하고 바로 시작하기",
    loginPrompt: "이미 계정이 있나요?",
    loginLink: "로그인",
    successRedirect: "이미 로그인된 상태입니다. 계정 화면으로 이동합니다.",
    showPassword: "비밀번호 표시",
    hidePassword: "비밀번호 숨기기",
    showPasswordConfirm: "비밀번호 확인 표시",
    hidePasswordConfirm: "비밀번호 확인 숨기기",
    submitting: "가입 처리 중...",
    signupFallbackError: "회원가입에 실패했습니다.",
    signupNetworkError: "회원가입 요청 중 네트워크 오류가 발생했습니다.",
    passwordMismatchError: "비밀번호가 일치하지 않습니다.",
  },
  en: {
    title: "Sign up",
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
    consentHelper: "Required items are needed to create the account. Optional items can be changed later from the dashboard.",
    consentAllLabel: "I agree to all consent items below. (Required + optional)",
    nameLabel: "Name",
    namePlaceholder: "Your name",
    nicknameLabel: "Nickname",
    nicknamePlaceholder: "CoolBeans",
    nicknameHint: "Your chat display name. (2-16 chars)",
    emailLabel: "Email",
    passwordLabel: "Password",
    passwordPlaceholder: "At least 10 chars with letters and numbers",
    passwordConfirmLabel: "Confirm password",
    passwordConfirmPlaceholder: "Re-enter your password",
    passwordRuleLength: "At least 10 characters",
    passwordRuleLetter: "Contains a letter",
    passwordRuleNumber: "Contains a number",
    passwordRuleMatch: "Passwords match",
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
    showPassword: "Show password",
    hidePassword: "Hide password",
    showPasswordConfirm: "Show confirm password",
    hidePasswordConfirm: "Hide confirm password",
    submitting: "Creating account...",
    signupFallbackError: "Sign-up failed.",
    signupNetworkError: "A network error occurred while signing up.",
    passwordMismatchError: "Passwords do not match.",
  },
  zh: {
    title: "注册",
    sideEyebrow: "個人設定",
    sideTitle: "创建属于你的出行档案",
    sideDescription: "这些信息将用于个性化推荐地区简报和兴趣匹配的出行路线。",
    stats: [
      { label: "必填", value: "账号 + 档案" },
      { label: "兴趣", value: "最多5个" },
      { label: "同意", value: "3项必选 + 2项可选" },
    ],
    basicSection: "基本账号信息",
    personalSection: "出行偏好设置",
    consentSection: "条款同意",
    consentHelper: "必填项用于创建账号，可选项可在仪表盘中随时修改。",
    consentAllLabel: "我同意以下所有条款。（必选 + 可选）",
    nameLabel: "姓名",
    namePlaceholder: "请输入姓名",
    nicknameLabel: "昵称",
    nicknamePlaceholder: "请输入昵称",
    nicknameHint: "聊天中显示的昵称。（2~16个字符）",
    emailLabel: "邮箱",
    passwordLabel: "密码",
    passwordPlaceholder: "至少10个字符，包含字母和数字",
    passwordConfirmLabel: "确认密码",
    passwordConfirmPlaceholder: "请再次输入密码",
    passwordRuleLength: "至少10个字符",
    passwordRuleLetter: "包含字母",
    passwordRuleNumber: "包含数字",
    passwordRuleMatch: "密码一致",
    ageLabel: "年龄段",
    regionLabel: "常用地区",
    hobbyLabel: "兴趣爱好",
    hobbyHelper: "最多选择5个兴趣，以便我们为您推荐个性化的目的地。",
    hobbyOtherPlaceholder: "请描述其他兴趣",
    timeLabel: "偏好时间段",
    sensitivityLabel: "敏感天气要素",
    sensitivityHelper: "可选。选择的敏感要素会在简报中优先提醒。",
    termsLabel: "我同意服务条款。（必选）",
    privacyLabel: "我同意个人信息收集与使用说明。（必选）",
    ageConfirmLabel: "我确认已年满14周岁。（必选）",
    marketingLabel: "我同意接收可选的推荐通知。（可选）",
    analyticsLabel: "我同意为改善服务而收集使用统计信息。（可选）",
    analyticsHelper: "启用后，Nadeulhae 将保存每日汇总数据，包括访问来源、页面路径、主题偏好和设备类型。不会存储原始 IP 地址和完整引荐 URL。",
    termsLink: "查看条款",
    submit: "注册并开始",
    loginPrompt: "已有账户？",
    loginLink: "登录",
    successRedirect: "您已登录。正在跳转到账户页面。",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    showPasswordConfirm: "显示确认密码",
    hidePasswordConfirm: "隐藏确认密码",
    submitting: "正在注册...",
    signupFallbackError: "注册失败。",
    signupNetworkError: "注册时发生网络错误。",
    passwordMismatchError: "两次输入的密码不一致。",
  },
  ja: {
    title: "会員登録",
    sideEyebrow: "個人設定",
    sideTitle: "自分だけのお出かけプロフィールを作成",
    sideDescription: "ここで設定した情報は、地域ブリーフィングや趣味に合わせたお出かけコースの提案に活用されます。",
    stats: [
      { label: "必須", value: "アカウント + プロフィール" },
      { label: "趣味", value: "最大5つ" },
      { label: "同意", value: "必須3 + 任意2" },
    ],
    basicSection: "基本アカウント設定",
    personalSection: "お出かけプロフィール設定",
    consentSection: "利用規約同意",
    consentHelper: "必須項目はアカウント作成に必要です。任意項目は後でダッシュボードから変更できます。",
    consentAllLabel: "以下のすべての同意項目に同意します。（必須 + 任意）",
    nameLabel: "名前",
    namePlaceholder: "お名前を入力",
    nicknameLabel: "ニックネーム",
    nicknamePlaceholder: "ニックネームを入力",
    nicknameHint: "チャットで使われる名前です。（2〜16文字）",
    emailLabel: "メールアドレス",
    passwordLabel: "パスワード",
    passwordPlaceholder: "10文字以上、英字と数字を含む",
    passwordConfirmLabel: "パスワード確認",
    passwordConfirmPlaceholder: "もう一度パスワードを入力",
    passwordRuleLength: "10文字以上",
    passwordRuleLetter: "英字を含む",
    passwordRuleNumber: "数字を含む",
    passwordRuleMatch: "パスワード一致",
    ageLabel: "年齢層",
    regionLabel: "主な利用地域",
    hobbyLabel: "趣味・関心",
    hobbyHelper: "最大5つまで趣味を選んでください。パーソナライズされた目的地をおすすめします。",
    hobbyOtherPlaceholder: "その他の趣味を記入",
    timeLabel: "希望時間帯",
    sensitivityLabel: "敏感な天気要素",
    sensitivityHelper: "任意。選択した要素はブリーフィングで優先的にお知らせします。",
    termsLabel: "サービス利用規約に同意します。（必須）",
    privacyLabel: "個人情報の収集・利用案内に同意します。（必須）",
    ageConfirmLabel: "14歳以上であることを確認します。（必須）",
    marketingLabel: "任意のおすすめ通知の受信に同意します。（任意）",
    analyticsLabel: "サービス改善のための利用統計収集に同意します。（任意）",
    analyticsHelper: "有効にすると、Nadeulhae はアクセス元、ページパス、テーマ、デバイスタイプの日次集計データを保存します。生のIPアドレスや完全なリファラーURLは保存されません。",
    termsLink: "利用規約を見る",
    submit: "登録して始める",
    loginPrompt: "すでにアカウントをお持ちですか？",
    loginLink: "ログイン",
    successRedirect: "すでにログインしています。アカウントページに移動します。",
    showPassword: "パスワードを表示",
    hidePassword: "パスワードを隠す",
    showPasswordConfirm: "確認パスワードを表示",
    hidePasswordConfirm: "確認パスワードを隠す",
    submitting: "登録中...",
    signupFallbackError: "登録に失敗しました。",
    signupNetworkError: "登録中にネットワークエラーが発生しました。",
    passwordMismatchError: "パスワードが一致しません。",
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
  const copy = ((SIGNUP_COPY as any)[language] ?? SIGNUP_COPY.ko)

  const [form, setForm] = useState<FormState>({
    displayName: "",
    nickname: "",
    email: "",
    password: "",
    passwordConfirm: "",
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

  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)

  const passwordRules = useMemo(() => {
    const pw = form.password
    return [
      { key: "length", label: copy.passwordRuleLength, met: pw.length >= 10 },
      { key: "letter", label: copy.passwordRuleLetter, met: /[A-Za-z]/.test(pw) },
      { key: "number", label: copy.passwordRuleNumber, met: /\d/.test(pw) },
    ]
  }, [form.password, copy])

  const passwordsMatch = form.password.length > 0 && form.password === form.passwordConfirm
  const allConsentsChecked =
    form.termsAccepted
    && form.privacyAccepted
    && form.ageConfirmed
    && form.marketingAccepted
    && form.analyticsAccepted

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
      label: (option.label as any)[language],
      description: (option.description as any)?.[language],
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

    if (form.password !== form.passwordConfirm) {
      setMessage(copy.passwordMismatchError)
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept-Language": language,
          },
          credentials: "include",
          body: JSON.stringify(form),
        })

        if (!response.ok) {
          setMessage(await readAuthErrorMessage(response, copy.signupFallbackError))
          return
        }

        const data = (await response.json()) as AuthResponseBody
        setAuthenticatedUser((data as AuthResponseBody).user)
        router.push("/account")
        router.refresh()
      } catch (error) {
        console.error("Sign-up request failed:", error)
        setMessage(copy.signupNetworkError)
      }
    })
  }

  const handleToggleAllConsents = (checked: boolean) => {
    setForm((current) => ({
      ...current,
      termsAccepted: checked,
      privacyAccepted: checked,
      ageConfirmed: checked,
      marketingAccepted: checked,
      analyticsAccepted: checked,
    }))
  }

  return (
    <AuthShell
      title={copy.title}
      showSidePanel={false}
      performanceMode="fast"
      sideEyebrow={copy.sideEyebrow}
      sideTitle={copy.sideTitle}
      sideDescription={copy.sideDescription}
      marqueeItems={SIGNUP_MARQUEE}
      statItems={copy.stats}
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
          <div className="space-y-1">
            <AuthField
              label={copy.nicknameLabel}
              icon={User}
              type="text"
              value={form.nickname}
              onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value.slice(0, 16) }))}
              placeholder={copy.nicknamePlaceholder}
              autoComplete="nickname"
              required
            />
            <p className="ml-1 text-[10px] font-bold text-muted-foreground/60">{copy.nicknameHint}</p>
          </div>
          <div className="space-y-1">
            <AuthField
              label={copy.passwordLabel}
              icon={Lock}
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder={copy.passwordPlaceholder}
              autoComplete="new-password"
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
            {form.password.length > 0 && (
              <div className="ml-1 flex flex-wrap gap-x-3 gap-y-1">
                {passwordRules.map((rule) => (
                  <span
                    key={rule.key}
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-bold transition-colors",
                      rule.met ? "text-nature-green" : "text-danger"
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", rule.met ? "bg-nature-green" : "bg-danger")} />
                    {rule.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <AuthField
              label={copy.passwordConfirmLabel}
              icon={Lock}
              type={showPasswordConfirm ? "text" : "password"}
              value={form.passwordConfirm}
              onChange={(event) => setForm((current) => ({ ...current, passwordConfirm: event.target.value }))}
              placeholder={copy.passwordConfirmPlaceholder}
              autoComplete="new-password"
              required
              trailing={(
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm((v) => !v)}
                  className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPasswordConfirm ? copy.hidePasswordConfirm : copy.showPasswordConfirm}
                >
                  {showPasswordConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              )}
            />
            {form.passwordConfirm.length > 0 && (
              <span
                className={cn(
                  "ml-1 inline-flex items-center gap-1 text-[11px] font-bold transition-colors",
                  passwordsMatch ? "text-nature-green" : "text-danger"
                )}
              >
                <span className={cn("size-1.5 rounded-full", passwordsMatch ? "bg-nature-green" : "bg-danger")} />
                {copy.passwordRuleMatch}
              </span>
            )}
          </div>
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
                  label={(option.label as any)[language]}
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
                  label={(option.label as any)[language]}
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
                  label={(option.label as any)[language]}
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
                  label={(option.label as any)[language]}
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
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {copy.consentHelper}
            </p>
          </div>
          <label className="flex items-start gap-3 rounded-[1.2rem] border border-sky-blue/20 bg-sky-blue/10 px-4 py-3 text-sm font-semibold text-foreground">
            <input
              type="checkbox"
              checked={allConsentsChecked}
              onChange={(event) => handleToggleAllConsents(event.target.checked)}
              className="mt-1 size-4 rounded border-card-border accent-sky-blue"
            />
            <span>{copy.consentAllLabel}</span>
          </label>
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
          <div
            role="status"
            aria-live="polite"
            className="rounded-[1.3rem] border border-sky-blue/20 bg-sky-blue/10 px-4 py-3 text-sm font-semibold text-sky-blue"
          >
            {copy.successRedirect}
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
          className="w-full rounded-[1.5rem] py-4 text-base font-black"
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
