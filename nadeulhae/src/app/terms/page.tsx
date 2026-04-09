"use client"

import { FileCheck2, ShieldCheck } from "lucide-react"
import { useTheme } from "next-themes"

import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text"
import { BorderBeam } from "@/components/magicui/border-beam"
import { MagicCard } from "@/components/magicui/magic-card"
import { Meteors } from "@/components/magicui/meteors"
import { Particles } from "@/components/magicui/particles"
import { useLanguage } from "@/context/LanguageContext"

type PolicySection = {
  id: string
  eyebrow: string
  title: string
  items: string[]
}

const POLICY_CONTENT: Record<
  "ko" | "en",
  {
    badge: string
    title: string
    description: string
    effectiveDate: string
    contentsTitle: string
    summaryTitle: string
    summary: Array<{
      label: string
      value: string
      detail: string
    }>
    sections: PolicySection[]
  }
> = {
  ko: {
    badge: "policy pack",
    title: "나들해 이용약관 · 개인정보 처리방침 · 분석/쿠키 안내",
    description:
      "아래 문서는 회원가입, 로그인, 위치 기반 날씨 조회, 서비스 개선용 분석 수집까지 현재 구현 범위를 기준으로 정리한 운영 문안입니다.",
    effectiveDate: "시행 기준일: 2026년 4월 8일",
    contentsTitle: "빠른 이동",
    summaryTitle: "핵심 요약",
    summary: [
      {
        label: "필수 수집",
        value: "계정 + 프로필 + 보안기록",
        detail: "이메일, 이름, 닉네임, 비밀번호 해시/솔트, 연령대, 지역, 취미, 선호 시간대, 필수 동의 기록",
      },
      {
        label: "선택 수집",
        value: "마케팅 · 분석 동의",
        detail: "추천 알림 수신 여부와 서비스 개선 분석 허용 여부는 선택입니다.",
      },
      {
        label: "분석 기본값",
        value: "익명 일일 합계",
        detail: "동의 전에는 경로별 호출 수, 응답 시간, 오류 비율 같은 익명 운영 통계만 보관합니다.",
      },
      {
        label: "분석 추가 항목",
        value: "동의 시에만 확장",
        detail: "유입 채널, 테마, 기기 구간, 일별 고유 방문자·회원 수는 분석 동의가 있을 때만 집계합니다.",
      },
    ],
    sections: [
      {
        id: "service",
        eyebrow: "service terms",
        title: "1. 나들해 서비스 이용약관",
        items: [
          "나들해는 기상청, 에어코리아 등 공공데이터를 취합하여 날씨 브리핑, 피크닉 지수, 전주 지역 커뮤니티 채팅, 개인화 맞춤형 나들이 코스를 제공하는 서비스입니다.",
          "서비스 이용은 원칙적으로 무료이나, 사용자는 사실과 일치하는 정보를 입력해야 하며, 혐오 표현, 비속어, 무단 광고 송출, 트래픽 공격 등 서비스의 건전한 운영을 방해하는 행위를 할 수 없습니다. 약관 위반 시 사전 통보 없이 계정 이용이 정지 또는 접속이 차단될 수 있습니다.",
          "불가항력적인 공공 API 장애 접속 폭주, 시스템 유지 보수 등의 사유로 인하여 서비스가 일시 중단될 수 있으며, 운영자는 별도 공지가 불가피한 상황의 장애 및 이로 인한 직간접적 손해에 대하여 고의 또는 중과실이 없는 한 책임을 지지 않습니다.",
        ],
      },
      {
        id: "privacy",
        eyebrow: "privacy notice",
        title: "2. 개인정보 수집·이용 안내",
        items: [
          "필수 수집 항목: 이메일, 이름, 닉네임, 해시 변환된 암호, 연령대, 주 사용 지역 선택, 취미, 선호 시간대, 필수 약관 동의 시각 및 접속 IP 보안 로그.",
          "선택 수집 항목: 기타 자체 기재 취미, 민감 날씨 알림 요소, 마케팅/추천 팁 수신 동의, 서비스 운영 개선 통계 분석 허용 수집 로그.",
          "수집 및 이용 목적: 회원 식별, 커뮤니티 내 표시 및 소통, 지역별·취향별 정밀 맞춤형 나들이 추천, 불법 및 반복적 비정상적인 로그인 접근 차단을 위한 보안 적용.",
          "개인정보는 원칙적으로 본 동의 탈퇴 시까지 서비스 제공 목적으로만 보관되며, 해시와 개별 Salt 기법(Scrypt 등)을 적용해 원문을 알아낼 수 없게 암호화 등 안전한 보호 조치를 취하고 있습니다.",
        ],
      },
      {
        id: "location",
        eyebrow: "location privacy",
        title: "3. 위치기반서비스 이용약관 의무 사항",
        items: [
          "나들해의 위치정보 활용 서비스는 무료이며, 사용자가 허용한 기기 통신 환경(브라우저 Geolocation API)에서 제공받은 좌표를 기반으로 즉각적 날씨 정보 및 공기질, 인근 스팟을 필터링하여 응답합니다.",
          "당사는 '위치정보의 보호 및 이용 등에 관한 법률' 제16조 등 법률에 명시된 규칙을 준수하여 현재 위치 데이터를 서버나 이용자의 프로필에 연속적 궤적의 형태로 절대 영구 보관/추적하지 않고 일회성 브리핑 연산 직후 즉시 파기합니다.",
          "단, 법령에 따른 분쟁의 처리 및 이용자 보호 의무 증빙을 위해 최소한의 '위치정보 이용·제공 사실 확인자료'는 6개월간 보존하며 이 기간 만기 시 자동으로 파기합니다.",
          "이용자는 서비스 내 환경 설정 또는 브라우저 권한 관리를 통해 언제든지 1회 제공 내역이 포함되는 본 위치정보 활용 제공 부분에 대한 전부 혹은 일부 동의를 즉시 철회할 권리가 있으며 관련 불만 및 고충은 고객 문의처를 통해 신속히 대응받을 수 있습니다.",
        ],
      },
      {
        id: "cross-border",
        eyebrow: "cross-border transfer",
        title: "4. 개인정보 국외 이전 고지 의무 명시",
        items: [
          "나들해의 모든 회원 서비스는 보안 강화 및 최신의 기술 집약적인 클라우드 데이터 관리 환경 하에서 제공되며, '개인정보 보호법 제28조의8' 및 정보통신망 이용촉진 등에 관한 규정을 준수하여 수집된 정보를 다음과 같이 물리적 서버가 국외에 존재하는 수탁업체로 안전히 이전(위탁 보관)하여 처리합니다.",
          "① 국외 이전받는 자: PingCAP Inc (TiDB Cloud 데이터베이스 솔루션 운영사) 및 Vultr (클라우드 인프라/웹 호스팅 서버 운영사).",
          "② 이전되는 국가 및 이전 일시/방법: 데이터를 전송 및 저장하는 물리적 주요 거점 국가는 일본(AWS ap-northeast 리전) 및 미국이며, 서비스 가입 또는 정보 갱신/채팅 발송 시 암호화된 전송망(TLS 지원)을 통해 자동 실시간으로 이전됩니다.",
          "③ 이전되는 관련 정보 항목: 이메일, 개인 프로필(연령, 취미, 시간 등), 해시 암호, 작성한 채팅 메시지 등 나들해 서비스를 통해 가입 시 수집되거나 활동 시 생산된 전체 정보.",
          "④ 이전의 목적 및 보유 기간: 글로벌 최고 수준의 고가용성 데이터베이스 저장 목적이며, 데이터는 회원의 탈퇴 등 법정 파기 사유 달성 시점(다만 채팅은 규정된 단기 보존 만료 시 파기)까지 안정적으로 이용 및 보유됩니다.",
          "⑤ 처리 거부권 행사 및 불이익: 사용자는 본 국외 인프라 운영 방침에 동의하지 않을 권리가 있으나 나들해 서비스 아키텍처 상 클라우드 환경 없이 필수 정보 기록을 유지하고 원활하게 계정을 제공하는 것이 불가능하므로, 국외 이전을 거부하실 경우 서비스 이용 해지(회원 탈퇴) 절차가 필수적으로 요구됩니다.",
        ],
      },
      {
        id: "retention",
        eyebrow: "retention & deletion",
        title: "5. 보관 및 파기 절차 및 기준",
        items: [
          "수집된 회원 정보는 목적 달성(회원 탈퇴)과 동시에 해당 데이터베이스 테이블에서 삭제 및 영구 삭제 플래그로 파기하여 데이터 복원이 불가하도록 안전하게 소거합니다.",
          "통신비밀보호법 등 관련 법률 취지를 반영해 접속 이벤트 및 로그인 보안 통계는 최대 3개월(90일)까지 제한적으로 분리 보관되며, 기간 만료 시 자동 파기됩니다.",
          "단기 휘발성 보관 원칙에 따라 실시간 커뮤니티 채팅 서비스 상 작성한 메시지(닉네임 표시분 포함)는 서버 등록 기점 7일(168시간) 초과 시 어떠한 백업 저장분 없이 데이터베이스 상에서 원천 삭제됩니다.",
        ],
      },
      {
        id: "analytics",
        eyebrow: "analytics & cookies",
        title: "6. 쿠키와 통계 운영 및 선택 제공 정책",
        items: [
          "안전한 로그인 상태 유지를 위해서는 무적권 필수적 쿠키를 시스템 차원에서 HTTP 보안 속성과 함께 운용합니다.",
          "더욱 유용한 기능을 제작하기 위한 '사용성/UI 통계 동의'를 체크해주신 분들에 한정해 비식별화된 데이터(접속 URL, 버튼 클릭 수, 테마 설정 기호) 일별 합산 수치를 집계 분석합니다.",
          "이 같은 분석 시 개인 단말기 원본 IP 주소나 사용자를 정밀 식별할 수 있는 브라우저 지문을 별도 프로파일링하거나 제 3자 마케팅 에이전시에 절대 대여/매매하지 않습니다.",
        ],
      },
      {
        id: "rights",
        eyebrow: "user rights",
        title: "7. 이용자 권리와 구제(문의) 창구",
        items: [
          "모든 회원은 서비스 메인 화면 내 대시보드의 계정 설정 항목에서 본인의 등록 정보를 언제든 열람, 수정, 파기(회원 탈퇴 처리) 할 권한을 자유롭게 가집니다.",
          "개인정보 또는 위치정보 활용, 기타 시스템 장애와 관련해 발생하는 건의/민원 접수 및 법률 문의 대응은 공식 고객 지원 메일(kim0040@jbnu.ac.kr)로 접수해 신속히 처리합니다.",
        ],
      },
    ],
  },
  en: {
    badge: "policy pack",
    title: "Nadeulhae Terms, Privacy Policy, and Analytics Notice",
    description:
      "This policy reflects the currently implemented scope of sign-up, login, location-based weather lookup, and service-improvement analytics.",
    effectiveDate: "Effective basis: April 8, 2026",
    contentsTitle: "Quick navigation",
    summaryTitle: "Key summary",
    summary: [
      {
        label: "Required data",
        value: "Account, profile, and security logs",
        detail: "Email, display name, nickname, password hash and salt, age range, region, interests, preferred time, and required consent records",
      },
      {
        label: "Optional data",
        value: "Marketing and analytics consent",
        detail: "Recommendation notices and service-improvement analytics are optional choices.",
      },
      {
        label: "Default analytics",
        value: "Anonymous daily totals",
        detail: "Before consent, only anonymous route counts, timing, and error ratios are stored for operations.",
      },
      {
        label: "Expanded analytics",
        value: "Only with consent",
        detail: "Acquisition source, theme, device bucket, and daily unique visitor or member counts are added only after consent.",
      },
    ],
    sections: [
      {
        id: "service",
        eyebrow: "service terms",
        title: "1. Nadeulhae Terms of Service",
        items: [
          "Nadeulhae is a service that aggregates public data (KMA, AirKorea etc) to provide weather briefings, picnic scores, the Jeonju community chat, and personalized local outing courses.",
          "Access is generally free, but users must register with true and accurate information. Disruption of community operations through hate speech, abuse, profanity, or spam messaging is strictly prohibited, and may result in a ban or account termination without warning.",
          "Service downtime may occur due to public API instability, high-traffic surge, or scheduled maintenance. The operator is not liable for indirect damages arising from unforeseen disruptions except in cases of gross negligence.",
        ],
      },
      {
        id: "privacy",
        eyebrow: "privacy notice",
        title: "2. Privacy Collection and Usage",
        items: [
          "Required: Email, name, nickname, hashed password, age band, primary region, hobbies, time slot preference, consent timestamps, and security IP logs.",
          "Optional: Custom hobby descriptions, weather-sensitive alerts preferences, marketing consent, and analytics data.",
          "Purpose: Identity verification, community display, highly localized algorithm matching for recommendations, and security protection against unnatural login attempts.",
          "Basic profile data is retained until account deletion. Passwords are encrypted uni-directionally using advanced Scrypt hashing making them permanently irrecoverable.",
        ],
      },
      {
        id: "location",
        eyebrow: "location privacy",
        title: "3. Location-Based Services Legal Policy",
        items: [
          "Nadeulhae Location features are free of charge. Utilizing browser/device Geolocation permissions, coordinates are momentarily used for hyper-local weather fetching and spot discovery.",
          "Per Article 16 of the South Korean Location Data Act, Nadeulhae does not construct a permanent historical log or trajectory of user locations; coordinate data is immediately discarded or cached temporarily out of database reach purely for returning weather reports.",
          "However, to comply with the legal obligations of user safety disputes, minimal 'verification records of location data utilization' may be retained for 6 months and inherently deleted thereafter.",
          "Users retain the complete, unilateral right to disable or revoke geolocation consent anytime via browser preferences. Related grievances and requests are fulfilled via dedicated support.",
        ],
      },
      {
        id: "cross-border",
        eyebrow: "cross-border transfer",
        title: "4. Mandatory Notice on Cross-Border Data Transfer",
        items: [
          "Nadeulhae processes database structures utilizing cutting-edge global cloud technologies. Pursuant to the PIPA (Personal Information Protection Act) Article 28-8, paragraph 1, item 3, necessary records are securely transferred to overseas hosting vendors.",
          "① Transferee: PingCAP Inc. (TiDB Cloud Infrastructure DB Solutions) and Vultr (cloud infrastructure and web hosting provider).",
          "② Country and Transfer Mechanics: Principal server facilities reside in Japan (AWS ap-northeast) and USA. Transmission happens automatically in real-time under robust TLS/SSL encryption when members update profiles or submit chats.",
          "③ Processed Datasets: Names, emails, passwords (hashed), activity interests, and user-generated chat payloads created over Nadeulhae.",
          "④ Objective and Retention duration: Assures high-availability and fault-tolerant retention across borders. Retained strictly until members legally delete accounts (minus community chats which auto-expire at exactly 7 days).",
          "⑤ Refusal Consequences: Cross-border capabilities are architecturally foundational to the active service system. Accordingly, a user who expressly refuses their data transfer right cannot fundamentally exist on the database, thereby obligating permanent membership deletion as the only consequence."
        ],
      },
      {
        id: "retention",
        eyebrow: "retention & deletion",
        title: "5. Retention and Safe Disposal",
        items: [
          "Collected standard member data is instantly destructed and virtually voided (via permanent delete flags avoiding soft recoveries) synchronously upon an account deletion execution.",
          "Security-relevant access and login event logs are retained for up to 3 months (90 days) and automatically deleted once the retention period expires.",
          "As a strict privacy protocol, the 'Jeonju Real-Time Chat' data physically self-destructs precisely 168 hours (7 days) after a message has been sent; leaving no archived history nor identifiable residuals.",
        ],
      },
      {
        id: "analytics",
        eyebrow: "analytics & cookies",
        title: "6. Cookies and Anonymous Analytics",
        items: [
          "Essential cookies, absolutely necessary for authenticated logged-in states, persist alongside robust HTTP security defenses exclusively protecting user navigation.",
          "For users explicitly affirming analytics, aggregate anonymous metrics (button interactions, UI theme preferences, traffic routes) are compiled entirely detached from identifying tracking capabilities.",
          "Your underlying raw endpoint IPs, persistent hardware signatures, or behavioral footprints are deliberately prevented from third-party advertising pipelines.",
        ],
      },
      {
        id: "rights",
        eyebrow: "user rights",
        title: "7. User Claims and Remediation",
        items: [
          "Members yield perpetual authority to review, amend, and immediately terminate their Nadeulhae registry and related records straight from the in-app active Settings dashboard.",
          "For privacy, geolocation, and service complaints, contact our official support email at kim0040@jbnu.ac.kr for prompt assistance.",
        ],
      },
    ],
  },
}

export default function TermsPage() {
  const { language } = useLanguage()
  const { resolvedTheme } = useTheme()
  const copy = POLICY_CONTENT[language]

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 pb-20 pt-24 sm:px-6 sm:pt-28 lg:px-8">
      <Particles
        className="absolute inset-0 z-0 opacity-75"
        quantity={60}
        ease={80}
        color={resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"}
        refresh
      />
      <Meteors number={7} className="z-0" />

      <div className="relative z-10 mx-auto max-w-6xl space-y-6 sm:space-y-8">
        <MagicCard className="overflow-hidden rounded-[2.6rem]" gradientSize={240}>
          <div className="relative rounded-[2.2rem] border border-card-border/70 bg-card/90 p-6 backdrop-blur-2xl sm:rounded-[2.6rem] sm:p-10">
            <BorderBeam
              size={200}
              duration={10}
              delay={4}
              colorFrom="var(--beam-from)"
              colorTo="var(--beam-to)"
            />
            <div className="relative z-10 space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/20 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-active-blue">
                <FileCheck2 className="size-3.5" />
                {copy.badge}
              </span>
              <div className="space-y-3">
                <AnimatedGradientText className="text-3xl font-black tracking-tight sm:text-4xl">
                  {copy.title}
                </AnimatedGradientText>
                <p className="max-w-4xl text-sm leading-7 text-muted-foreground sm:text-base">
                  {copy.description}
                </p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-[1.5rem] border border-card-border/70 bg-background/70 px-5 py-4 text-sm font-semibold text-foreground">
                  {copy.effectiveDate}
                </div>
              </div>
            </div>
          </div>
        </MagicCard>

        <MagicCard className="rounded-[2rem]" gradientSize={220} gradientOpacity={0.7}>
          <div className="rounded-[inherit] border border-card-border/70 bg-card/85 p-5 backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                  {copy.contentsTitle}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">
                  {copy.summaryTitle}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {copy.sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="rounded-full border border-card-border/70 bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue"
                  >
                    {section.title}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </MagicCard>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {copy.summary.map((item) => (
            <MagicCard
              key={item.label}
              className="rounded-[1.7rem]"
              gradientSize={200}
              gradientOpacity={0.7}
            >
              <div className="rounded-[inherit] border border-card-border/70 bg-card/85 p-5 backdrop-blur-xl">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                  {item.label}
                </p>
                <h2 className="mt-3 text-xl font-black tracking-tight text-foreground">
                  {item.value}
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            </MagicCard>
          ))}
        </div>

        <div className="grid gap-5 sm:gap-6">
          {copy.sections.map((section) => (
            <MagicCard
              key={section.id}
              className="rounded-[2rem]"
              gradientSize={220}
              gradientOpacity={0.7}
            >
              <section
                id={section.id}
                className="scroll-mt-32 rounded-[inherit] border border-card-border/70 bg-card/85 p-5 backdrop-blur-xl sm:scroll-mt-36 sm:p-8"
              >
                <div className="grid gap-5 lg:grid-cols-[0.33fr_1fr] lg:gap-8">
                  <div className="space-y-3 lg:sticky lg:top-28 lg:self-start">
                    <span className="inline-flex items-center gap-2 rounded-full border border-card-border/70 bg-background/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                      <ShieldCheck className="size-3.5 text-sky-blue" />
                      {section.eyebrow}
                    </span>
                    <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                      {section.title}
                    </h2>
                  </div>

                  <ul className="space-y-3">
                    {section.items.map((item, index) => (
                      <li
                        key={item}
                        className="flex gap-3 rounded-[1.25rem] border border-card-border/70 bg-background/70 px-4 py-3.5 text-sm leading-6 text-foreground"
                      >
                        <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-blue/10 text-[11px] font-black text-sky-blue">
                          {index + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </MagicCard>
          ))}
        </div>
      </div>
    </main>
  )
}
