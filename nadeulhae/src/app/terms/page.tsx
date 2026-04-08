"use client"

import { ShieldCheck } from "lucide-react"
import { useTheme } from "next-themes"

import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text"
import { BorderBeam } from "@/components/magicui/border-beam"
import { MagicCard } from "@/components/magicui/magic-card"
import { Meteors } from "@/components/magicui/meteors"
import { Particles } from "@/components/magicui/particles"
import { useLanguage } from "@/context/LanguageContext"

const TERMS_CONTENT = {
  ko: {
    badge: "draft terms",
    title: "나들해 이용약관 및 개인정보 수집 안내",
    description:
      "회원가입 화면에서 동의받는 서비스 이용약관과 개인정보 수집·이용 안내의 초안입니다. 실제 운영 전에는 법무 및 개인정보 검토가 필요합니다.",
    draft: "운영 전 최종 법률 검토 필요",
    serviceTitle: "서비스 이용약관",
    privacyTitle: "개인정보 수집·이용 안내",
    sections: [
      {
        id: "service",
        title: "제1조 목적",
        items: [
          "본 약관은 나들해 서비스의 회원 가입, 로그인, 개인화 나들이 추천 이용 조건을 정합니다.",
          "회원은 본 약관과 운영정책을 준수하는 범위에서 서비스를 이용할 수 있습니다.",
        ],
      },
      {
        title: "제2조 제공 기능",
        items: [
          "나들해는 날씨 브리핑, 피크닉 지수, 지역 기반 추천, 계정 저장 기능을 제공합니다.",
          "서비스 내용은 공공 데이터 상황, 기술적 사정, 운영 정책에 따라 변경될 수 있습니다.",
        ],
      },
      {
        title: "제3조 회원의 의무",
        items: [
          "회원은 정확한 가입 정보를 입력해야 하며, 타인의 정보를 도용해서는 안 됩니다.",
          "계정 보안은 회원 본인 책임이며, 비밀번호와 로그인 수단을 제3자와 공유해서는 안 됩니다.",
        ],
      },
      {
        title: "제4조 서비스 제한",
        items: [
          "운영자는 시스템 점검, 장애, 데이터 공급 중단 시 서비스 일부를 제한할 수 있습니다.",
          "약관 위반, 부정 이용, 타인 권리 침해가 확인되면 계정 이용이 제한될 수 있습니다.",
        ],
      },
      {
        id: "privacy",
        title: "개인정보 수집 항목",
        items: [
          "필수 항목: 이름, 이메일, 비밀번호 해시, 연령대, 주 사용 지역, 취미, 선호 시간대, 필수 동의 여부.",
          "선택 항목: 기타 취미, 민감한 날씨 요소, 추천/공지 알림 수신 동의.",
          "비밀번호 원문은 저장하지 않으며, 개별 솔트가 포함된 scrypt 해시만 저장합니다.",
        ],
      },
      {
        title: "개인정보 이용 목적",
        items: [
          "회원 식별, 로그인 세션 관리, 개인화 추천, 지역 맞춤 브리핑 제공에 활용합니다.",
          "알림 수신에 동의한 경우에만 중요 공지 또는 맞춤 추천 알림 목적으로 사용할 수 있습니다.",
        ],
      },
      {
        title: "보관 및 파기",
        items: [
          "회원 탈퇴 또는 이용 목적 달성 시 관련 정보를 지체 없이 파기하는 것을 원칙으로 합니다.",
          "법령상 보관 의무가 있는 경우 해당 기간 동안 별도 보관 후 파기합니다.",
        ],
      },
      {
        title: "이용자 권리",
        items: [
          "회원은 본인 정보의 조회, 정정, 삭제, 처리 정지를 요청할 수 있습니다.",
          "초안 기준으로 계정 삭제/정정 자동화는 아직 제공되지 않으므로 운영 단계에서 별도 기능이 추가되어야 합니다.",
        ],
      },
    ],
  },
  en: {
    badge: "draft terms",
    title: "Nadeulhae Terms and Privacy Notice",
    description:
      "This draft covers the service terms and privacy collection notice referenced during sign-up. Legal and privacy review is required before production launch.",
    draft: "Legal review required before launch",
    serviceTitle: "Service Terms",
    privacyTitle: "Privacy Collection Notice",
    sections: [
      {
        id: "service",
        title: "Article 1. Purpose",
        items: [
          "These terms govern membership, login, and personalized outing recommendations within Nadeulhae.",
          "Members may use the service only while complying with these terms and related policies.",
        ],
      },
      {
        title: "Article 2. Service Scope",
        items: [
          "Nadeulhae provides weather briefings, outing scores, regional recommendations, and account storage.",
          "Service details may change depending on public data availability, technical conditions, or operations.",
        ],
      },
      {
        title: "Article 3. Member Responsibilities",
        items: [
          "Members must provide accurate registration details and must not impersonate others.",
          "Account security remains the member’s responsibility, including password confidentiality.",
        ],
      },
      {
        title: "Article 4. Service Restrictions",
        items: [
          "The operator may limit service during maintenance, failures, or public data interruptions.",
          "Accounts may be restricted when policy violations, abuse, or rights infringement are detected.",
        ],
      },
      {
        id: "privacy",
        title: "Collected Personal Data",
        items: [
          "Required: name, email, password hash, age range, primary region, hobbies, preferred time, and required consent records.",
          "Optional: custom hobby text, weather sensitivities, and recommendation notice consent.",
          "Raw passwords are never stored. Only scrypt hashes with per-user salt are stored.",
        ],
      },
      {
        title: "Purpose of Use",
        items: [
          "Data is used for member identification, authenticated sessions, personalized recommendations, and region-aware briefings.",
          "Optional notices may be sent only when the member consents to recommendation or notice delivery.",
        ],
      },
      {
        title: "Retention and Deletion",
        items: [
          "Data should be deleted without delay after account deletion or once the purpose is fulfilled.",
          "Where laws require retention, the data should be retained separately for the required period and then deleted.",
        ],
      },
      {
        title: "User Rights",
        items: [
          "Members may request access, correction, deletion, or suspension of processing of their own data.",
          "This draft does not yet include a self-service deletion workflow, which should be added before production.",
        ],
      },
    ],
  },
} as const

export default function TermsPage() {
  const { language } = useLanguage()
  const { resolvedTheme } = useTheme()
  const copy = TERMS_CONTENT[language]

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 pb-16 pt-28 sm:px-6 lg:px-8">
      <Particles
        className="absolute inset-0 z-0 opacity-75"
        quantity={72}
        ease={80}
        color={resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"}
        refresh
      />
      <Meteors number={10} className="z-0" />

      <div className="relative z-10 mx-auto max-w-5xl space-y-8">
        <MagicCard className="overflow-hidden rounded-[2.6rem]" gradientSize={240}>
          <div className="relative rounded-[2.6rem] border border-card-border/70 bg-card/90 p-8 backdrop-blur-2xl sm:p-10">
            <BorderBeam
              size={220}
              duration={10}
              delay={5}
              colorFrom="var(--beam-from)"
              colorTo="var(--beam-to)"
            />
            <div className="relative z-10 space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/20 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-active-blue">
                <ShieldCheck className="size-3.5" />
                {copy.badge}
              </span>
              <div className="space-y-3">
                <AnimatedGradientText className="text-3xl font-black tracking-tight sm:text-4xl">
                  {copy.title}
                </AnimatedGradientText>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                  {copy.description}
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-warning/20 bg-warning/10 px-5 py-4 text-sm font-semibold text-warning">
                {copy.draft}
              </div>
            </div>
          </div>
        </MagicCard>

        <div className="grid gap-6">
          {copy.sections.map((section) => (
            <MagicCard
              key={section.title}
              className="rounded-[2rem]"
              gradientSize={220}
              gradientOpacity={0.65}
            >
              <section
                id={"id" in section ? section.id : undefined}
                className="rounded-[inherit] border border-card-border/70 bg-card/85 p-6 backdrop-blur-xl sm:p-8"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                  {"id" in section
                    ? section.id === "service"
                      ? copy.serviceTitle
                      : copy.privacyTitle
                    : copy.badge}
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground">
                  {section.title}
                </h2>
                <ul className="mt-5 space-y-3">
                  {section.items.map((item) => (
                    <li
                      key={item}
                      className="rounded-[1.4rem] border border-card-border/70 bg-background/70 px-4 py-3 text-sm leading-6 text-foreground"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            </MagicCard>
          ))}
        </div>
      </div>
    </main>
  )
}
