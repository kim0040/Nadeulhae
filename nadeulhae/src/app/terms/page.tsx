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
    legalNote: string
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
    legalNote:
      "개인정보 보호법, 위치정보 관련 규정, 국외 이전 고지 의무를 반영해 작성했지만 공개 전에는 반드시 최종 법률 검토를 권장합니다.",
    summary: [
      {
        label: "필수 수집",
        value: "계정 + 프로필 + 보안기록",
        detail: "이메일, 이름, 비밀번호 해시/솔트, 연령대, 지역, 취미, 선호 시간대, 필수 동의 기록",
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
        title: "1. 서비스 이용약관",
        items: [
          "나들해는 날씨 브리핑, 피크닉 지수, 지역 기반 나들이 정보, 회원 프로필 저장, 개인화 추천을 제공하는 서비스입니다.",
          "회원은 정확한 가입 정보를 입력해야 하며 타인의 정보를 도용하거나 자동화 공격, 계정 공유, 부정 이용을 해서는 안 됩니다.",
          "운영자는 공공 데이터 중단, 유지보수, 보안 대응, 약관 위반이 있는 경우 서비스 일부를 제한하거나 계정을 보호 목적으로 정지할 수 있습니다.",
          "로그인 보호를 위해 실패 횟수 제한, 세션 수 제한, 요청 출처 검증, 보안 이벤트 기록이 적용됩니다.",
        ],
      },
      {
        id: "privacy",
        eyebrow: "privacy notice",
        title: "2. 수집 항목과 이용 목적",
        items: [
          "필수 항목: 이메일, 이름, 비밀번호 해시와 개별 솔트, 연령대, 주 사용 지역, 취미 선택, 선호 시간대, 필수 약관 동의 시각.",
          "선택 항목: 기타 취미 설명, 민감한 날씨 요소, 추천 알림 동의 여부, 서비스 개선 분석 동의 여부.",
          "보안 운영 항목: 로그인 세션 토큰 해시, 세션 만료 시각, 접속 기기 정보, 접속 IP 기반 보안 기록, 인증 실패 제한 기록.",
          "이 정보는 회원 식별, 로그인 유지, 개인화 브리핑, 악성 접근 차단, 서비스 안정화, 고객 요청 대응을 위해 사용됩니다.",
        ],
      },
      {
        id: "analytics",
        eyebrow: "analytics & cookies",
        title: "3. 쿠키와 서비스 개선 분석",
        items: [
          "필수 쿠키: 로그인 유지용 인증 쿠키와 방문 세션 식별 쿠키를 사용합니다. 이 쿠키는 보안과 기본 동작에 필요합니다.",
          "분석 동의 전에는 페이지/API 호출 수, 상태 코드, 응답 시간 같은 익명 일일 합계만 저장합니다. 이 집계에는 원문 비밀번호, 원문 IP, 전체 리퍼러 URL을 저장하지 않습니다.",
          "분석 동의 시에는 경로, 유입 호스트, UTM source/medium/campaign, 라이트·다크 테마, 기기 구간, 시간대, 일별 고유 방문자 수와 고유 회원 수를 추가 집계할 수 있습니다.",
          "분석은 일(day) 단위로 계속 누적되어 과거 날짜도 그대로 남습니다. 다만 개별 사용자를 직접 식별하기 위한 프로파일링 목적에는 사용하지 않습니다.",
          "회원은 대시보드 또는 동의 배너에서 언제든지 분석 동의를 변경할 수 있습니다.",
        ],
      },
      {
        id: "location",
        eyebrow: "location notice",
        title: "4. 위치정보 안내",
        items: [
          "현재 위치 기반 날씨 조회는 브라우저 또는 기기 운영체제의 위치 권한을 사용해 현재 지역 날씨를 계산할 때만 활용합니다.",
          "현재 구현 기준으로 정밀 위치 좌표를 회원 프로필이나 분석 테이블에 장기 저장하지 않습니다.",
          "향후 위치 기반 추천 이력 저장, 친구 공유, 위치 알림 등 개인위치정보 기능이 추가되면 별도 위치정보 이용약관과 추가 고지를 제공합니다.",
        ],
      },
      {
        id: "retention",
        eyebrow: "retention & deletion",
        title: "5. 보관 및 파기 기준",
        items: [
          "회원 기본 정보는 탈퇴 시까지 보관하며, 탈퇴 요청이 처리되면 로그인 세션과 프로필을 우선 삭제합니다.",
          "활성 세션 정보는 만료, 로그아웃, 탈퇴 시 정리됩니다. 인증 보호용 시도 기록과 보안 이벤트는 보안 목적 달성 범위 내에서 운영 관리됩니다.",
          "일별 집계 통계는 서비스 품질 비교와 장기 개선을 위해 계속 보관될 수 있습니다. 이 통계는 직접 식별정보 대신 집계 또는 해시 기반 식별자를 사용합니다.",
          "법령상 별도 보관이 필요한 경우에는 해당 기간 동안 분리 보관 후 파기합니다.",
        ],
      },
      {
        id: "sharing",
        eyebrow: "processors & transfers",
        title: "6. 제3자 제공, 위탁, 국외 인프라",
        items: [
          "현재 구현 기준으로 회원 정보를 광고 사업자에게 판매하거나 맞춤형 광고 목적으로 제3자 제공하지 않습니다.",
          "클라우드 인프라, 데이터베이스, 호스팅 운영 과정에서 외부 서비스형 인프라를 사용할 수 있으며, 실제 운영 전 수탁업체명과 처리 범위를 별도 문서에 확정해야 합니다.",
          "국외 리전 인프라를 사용할 가능성이 있으므로, 공개 전에는 이전 국가, 이전 항목, 보관 기간, 거부권 및 불이익을 포함한 국외 이전 고지를 최종 반영해야 합니다.",
        ],
      },
      {
        id: "security",
        eyebrow: "security measures",
        title: "7. 보안 조치",
        items: [
          "비밀번호 원문은 저장하지 않고 scrypt 기반 해시와 개별 솔트를 사용합니다. 추가 비밀값(pepper)은 환경변수로 분리해 관리합니다.",
          "인증 요청은 동일 출처 검사, 본문 크기 제한, 실패 지연, 이메일·IP 기준 로그인/회원가입 제한, 활성 세션 상한을 적용합니다.",
          "분석 테이블에는 원문 IP, 전체 리퍼러 URL, 원문 비밀번호를 저장하지 않으며, 고유 수 집계는 해시 기반 식별자로 처리합니다.",
        ],
      },
      {
        id: "rights",
        eyebrow: "user rights",
        title: "8. 이용자 권리와 문의",
        items: [
          "회원은 본인 정보의 열람, 정정, 삭제, 처리정지, 동의 철회를 요청할 수 있습니다.",
          "대시보드에서 프로필 수정, 로그아웃, 탈퇴, 분석 동의 변경이 가능합니다. 다만 법령상 보관 의무가 있는 정보는 즉시 삭제되지 않을 수 있습니다.",
          "운영 책임자 연락처, 수탁사 목록, 국외 이전 내역이 확정되면 이 문서에 즉시 갱신해야 합니다.",
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
    legalNote:
      "This draft reflects Korean privacy, location-related, and cross-border notice considerations, but it still requires final legal review before public launch.",
    summary: [
      {
        label: "Required data",
        value: "Account, profile, and security logs",
        detail: "Email, display name, password hash and salt, age range, region, interests, preferred time, and required consent records",
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
        title: "1. Service Terms",
        items: [
          "Nadeulhae provides weather briefings, outing scores, regional outing information, saved member profiles, and personalized recommendations.",
          "Members must submit accurate registration details and must not impersonate others, automate abusive access, share accounts, or misuse the service.",
          "The operator may limit part of the service during public-data outages, maintenance, security response, or confirmed policy violations.",
          "Login protection includes failed-attempt limits, session caps, request-origin validation, and security event logging.",
        ],
      },
      {
        id: "privacy",
        eyebrow: "privacy notice",
        title: "2. Collected Data and Purposes",
        items: [
          "Required data: email, display name, password hash and per-user salt, age range, primary region, interest selections, preferred time slot, and required consent timestamps.",
          "Optional data: custom interest text, weather sensitivities, notice consent, and analytics consent for service improvement.",
          "Security and operations data: hashed session tokens, session expiry, device information, IP-based security records, and authentication attempt buckets.",
          "These records support member identification, session management, personalized briefings, malicious-access blocking, service stability, and support requests.",
        ],
      },
      {
        id: "analytics",
        eyebrow: "analytics & cookies",
        title: "3. Cookies and Improvement Analytics",
        items: [
          "Essential cookies are used for authenticated sessions and anonymous visit sessions. These cookies are required for security and core functionality.",
          "Before analytics consent, only anonymous daily aggregates such as page/API counts, status codes, and timing totals are stored. Raw passwords, raw IPs, and full referrer URLs are not stored in analytics tables.",
          "With analytics consent, Nadeulhae may additionally aggregate route path, referrer host, UTM source/medium/campaign, light or dark theme, device bucket, time zone, and daily unique visitor or member counts.",
          "Analytics are stored by daily unit and continue accumulating historically. They are not intended for direct personal profiling.",
          "Members can change analytics consent at any time from the dashboard or the consent banner.",
        ],
      },
      {
        id: "location",
        eyebrow: "location notice",
        title: "4. Location Notice",
        items: [
          "Current-location weather lookup uses browser or device location permission only to calculate nearby weather and briefings.",
          "Under the current implementation, precise latitude and longitude are not stored long-term in member profiles or analytics tables.",
          "If future features store location history, sharing, or alerts, separate location terms and additional notice should be added before launch.",
        ],
      },
      {
        id: "retention",
        eyebrow: "retention & deletion",
        title: "5. Retention and Deletion",
        items: [
          "Core member data is retained until account deletion. When deletion is requested, sessions and saved profile data are removed first.",
          "Active session records are cleaned up on expiry, logout, or account deletion. Security attempt logs and event logs are operated within the scope required for protection purposes.",
          "Daily aggregated statistics may be retained long-term for service quality comparisons and trend analysis. Those statistics use aggregate or hashed identifiers instead of direct identifiers.",
          "Where the law requires separate retention, the data should be retained separately for that legal period and then deleted.",
        ],
      },
      {
        id: "sharing",
        eyebrow: "processors & transfers",
        title: "6. Third-Party Sharing, Vendors, and Cross-Border Infrastructure",
        items: [
          "Under the current implementation, member data is not sold or shared with advertising partners for targeted advertising.",
          "Cloud infrastructure, databases, and hosting vendors may process data on behalf of the service, and the final vendor list and processing scope should be fixed before public launch.",
          "Because overseas regions may be used, the final public policy should explicitly disclose destination country, transferred items, retention period, and the user’s right to refuse where required.",
        ],
      },
      {
        id: "security",
        eyebrow: "security measures",
        title: "7. Security Measures",
        items: [
          "Raw passwords are never stored. Nadeulhae uses scrypt-based password hashing with per-user salts, while a separate pepper is stored in environment variables.",
          "Authentication endpoints apply same-origin checks, body-size limits, failure delay, email and IP rate limits, and active-session caps.",
          "Analytics tables do not store raw IP addresses, full referrer URLs, or raw passwords. Unique counts use hashed identifiers.",
        ],
      },
      {
        id: "rights",
        eyebrow: "user rights",
        title: "8. User Rights and Contact",
        items: [
          "Members may request access, correction, deletion, suspension of processing, or withdrawal of consent for their own data.",
          "The dashboard currently allows profile edits, logout, account deletion, and analytics-consent changes. Data subject to legal retention obligations may not be deleted immediately.",
          "The contact point, vendor list, and cross-border transfer details should be updated in this document before public launch.",
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
    <main className="relative min-h-screen overflow-hidden bg-background px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <Particles
        className="absolute inset-0 z-0 opacity-75"
        quantity={72}
        ease={80}
        color={resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"}
        refresh
      />
      <Meteors number={10} className="z-0" />

      <div className="relative z-10 mx-auto max-w-6xl space-y-8">
        <MagicCard className="overflow-hidden rounded-[2.6rem]" gradientSize={240}>
          <div className="relative rounded-[2.6rem] border border-card-border/70 bg-card/90 p-8 backdrop-blur-2xl sm:p-10">
            <BorderBeam
              size={220}
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
              <div className="grid gap-3 lg:grid-cols-[0.75fr_1.25fr]">
                <div className="rounded-[1.5rem] border border-card-border/70 bg-background/70 px-5 py-4 text-sm font-semibold text-foreground">
                  {copy.effectiveDate}
                </div>
                <div className="rounded-[1.5rem] border border-warning/20 bg-warning/10 px-5 py-4 text-sm leading-6 text-warning">
                  {copy.legalNote}
                </div>
              </div>
            </div>
          </div>
        </MagicCard>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {copy.summary.map((item) => (
            <MagicCard
              key={item.label}
              className="rounded-[1.9rem]"
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

        <div className="grid gap-6">
          {copy.sections.map((section) => (
            <MagicCard
              key={section.id}
              className="rounded-[2rem]"
              gradientSize={220}
              gradientOpacity={0.7}
            >
              <section
                id={section.id}
                className="rounded-[inherit] border border-card-border/70 bg-card/85 p-6 backdrop-blur-xl sm:p-8"
              >
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-card-border/70 bg-background/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-sky-blue" />
                    {section.eyebrow}
                  </span>
                  <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                    {section.title}
                  </h2>
                </div>

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
