"use client"

/**
 * Terms & Privacy Page — displays the combined terms of service, privacy policy,
 * cookies/analytics notice, and cross-border data transfer disclosure.
 * Fully i18n via LanguageContext; content is statically defined in POLICY_CONTENT.
 */

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

// ---- Multi-language policy content (ko / en / zh / ja) ----

const POLICY_CONTENT: Record<
  "ko" | "en" | "zh" | "ja",
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
    effectiveDate: "시행 기준일: 2026년 4월 29일 (v2.0 갱신)",
    contentsTitle: "빠른 이동",
    summaryTitle: "핵심 요약",
    summary: [
      {
        label: "필수 수집",
        value: "계정 + 프로필 + 보안기록",
        detail: "이메일, 이름, 닉네임, 비밀번호(scrypt 해시), 연령대, 지역, 관심사, 선호 시간대, 필수 동의 기록, 접속 IP 보안 로그",
      },
      {
        label: "선택 수집",
        value: "마케팅 · 분석 · AI 기능",
        detail: "마케팅 수신 여부, 서비스 개선 분석 허용, 실험실(Lab) 기능 활성화, AI 챗봇 이용은 선택입니다.",
      },
      {
        label: "AI 데이터 처리",
        value: "채팅내용 암호화 전송",
        detail: "AI 챗봇 대화는 AES-256-GCM 암호화 저장, LLM API 제공사에 일시 전송 후 폐기, 학습에 미사용. 제공사는 변경될 수 있습니다.",
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
          "나들해는 기상청(KMA), 에어코리아(AirKorea), APIHub 등 공공데이터를 취합하여 실시간 날씨·대기질·자외선·기상특보 정보 및 야외활동 적합도 점수(0-100)를 제공하고, AI 기반 대시보드 챗봇, 실험실(단어암기·AI웹검색챗·코드공유), 전주 지역 AI 일일 브리핑 및 커뮤니티 채팅을 통합 제공하는 종합 야외활동 플랫폼입니다.",
          "서비스 이용은 원칙적으로 무료이나, 사용자는 사실과 일치하는 정보를 입력해야 하며, 혐오 표현, 비속어, 무단 광고, AI 챗봇을 통한 악의적 프롬프트 주입, 트래픽 공격 등 서비스의 건전한 운영을 방해하는 행위를 할 수 없습니다. 약관 위반 시 사전 통보 없이 계정 이용이 정지되거나 AI 기능 이용이 제한될 수 있습니다.",
          "불가항력적인 공공 API 장애, LLM API 제공사 서비스 중단·변경·종료, 시스템 유지 보수 등의 사유로 서비스가 일시 중단될 수 있으며, LLM API 제공사는 내부 사정에 따라 사전 고지 없이 변경되거나 대체될 수 있습니다. 운영자는 별도 공지가 불가피한 상황의 장애 및 이로 인한 직간접적 손해에 대하여 고의 또는 중과실이 없는 한 책임을 지지 않습니다.",
        ],
      },
      {
        id: "ai-services",
        eyebrow: "ai & llm",
        title: "2. AI/LLM 기반 서비스 이용약관",
        items: [
          "나들해는 다음 AI·LLM 서비스를 제공합니다: (가) 대시보드 AI 챗봇 — 날씨 기반 야외활동 어시스턴트, (나) 실험실 AI 챗 — Tavily 웹검색 연동 지식 챗봇, (다) 실험실 단어 생성 — FSRS 단어장 AI 자동 생성·번역·예문 작성, (라) 전주 AI 데일리 브리핑 — 지역 뉴스·이벤트 AI 요약.",
          "AI 서비스는 타사 LLM API 제공사를 통해 처리되며, 제공사는 서비스 품질·비용·가용성에 따라 사전 고지 없이 변경되거나 대체될 수 있습니다. 사용자가 AI 챗봇에 입력한 대화 내용은 해당 제공사에 일시적으로 전송되어 응답 생성에만 사용되며, 제공사의 모델 학습 데이터로 활용되지 않습니다.",
          "AI가 생성한 모든 응답(날씨 추천, 챗봇 답변, 단어 뜻·예문, 뉴스 요약)은 머신러닝 기반 추론 결과로, 사실과 다를 수 있습니다. 특히 전주 AI 브리핑의 뉴스 요약, 실험실 AI 챗의 웹검색 기반 답변은 참고용이며, 중요한 의사결정은 공식 출처를 직접 확인하시기 바랍니다.",
          "AI 서비스는 일일 사용량 제한(LLM 전역 5,000회/일, 사용자별 100~200회/일, 웹검색 월 800회)이 적용되며, 제한 초과 시 해당 기능이 일시 차단될 수 있습니다. 악의적 반복 호출은 AI 기능 영구 제한 사유가 됩니다.",
        ],
      },
      {
        id: "privacy",
        eyebrow: "privacy notice",
        title: "3. 개인정보 수집·이용 안내",
        items: [
          "필수 수집 항목: 이메일, 이름(표시명), 닉네임, 비밀번호(scrypt 해시), 연령대, 주 사용 지역 선택, 관심사 태그, 선호 시간대, 날씨 민감도, 필수 약관 동의 시각 및 접속 IP 보안 로그.",
          "선택 수집 항목: 기타 자체 기재 관심사, 마케팅 수신 동의, 서비스 분석 동의(방문 경로·기기정보·테마·버튼 상호작용), 실험실(Lab) 기능 활성화, AI 챗봇 이용.",
          "채팅 데이터 처리: 대시보드 AI 채팅·전주 커뮤니티 채팅 내용은 AES-256-GCM으로 데이터베이스에 암호화 저장됩니다. AI 챗봇 대화는 LLM API 요청 시 일시적으로 복호화되어 전송되며, 응답 생성 완료 후 제공사 서버에서 폐기됩니다.",
          "단어 암기 데이터: 실험실에서 생성·학습한 단어장과 카드 데이터(용어·뜻·예문·학습 진도)는 사용자 계정에 귀속되며, AES-256-GCM 암호화되어 저장됩니다. 타 사용자와 공유되지 않습니다.",
          "코드 공유 데이터: 코드 에디터에서 작성한 소스코드는 제목·언어·코드 내용을 포함하여 데이터베이스에 저장되며, 세션ID를 아는 누구나 접근 가능한 링크 공유 모델로 운영됩니다. 민감 정보(API 키, 비밀번호 등)는 코드 공유 세션에 절대 포함하지 마십시오.",
        ],
      },
      {
        id: "encryption",
        eyebrow: "data protection",
        title: "4. 데이터 암호화 및 보호 체계",
        items: [
          "모든 민감 개인정보(이메일, 이름, 닉네임, 연령대, 관심사, IP, User-Agent, 채팅 내용)는 AES-256-GCM 알고리즘과 HKDF 키 파생 함수를 적용한 필드 레벨 암호화로 보호됩니다. 각 필드는 독립된 컨텍스트 키로 암호화되어 한 필드의 키 노출이 다른 필드에 영향을 미치지 않습니다.",
          "이메일과 닉네임은 블라인드 인덱스(HMAC-SHA256 해시)를 통해 원문 복호화 없이 중복 가입 여부를 확인합니다.",
          "비밀번호는 scrypt(N=16384, r=8, p=1) 단방향 해시와 Pepper(AUTH_PEPPER 환경변수)를 적용하여 서버 메모리와 데이터베이스 어디에도 평문으로 저장되지 않습니다. 로그인 시도 시 존재하지 않는 계정에 대해서도 동일한 연산을 수행하여 타이밍 공격을 방지합니다.",
          "모든 데이터 전송은 TLS/SSL 암호화 채널을 통해 이루어집니다. 프로덕션 환경에서는 HSTS(max-age=2년), CSP, SameSite=Lax 등 보안 헤더가 적용됩니다.",
        ],
      },
      {
        id: "location",
        eyebrow: "location privacy",
        title: "5. 위치기반서비스 이용약관",
        items: [
          "나들해는 브라우저 Geolocation API를 통해 사용자가 허용한 현재 위치 좌표를 기반으로 즉각적 날씨 정보, 대기질, 인근 관측소 매칭, AI 추천 코스를 제공합니다.",
          "위치정보는 일회성 날씨 조회 연산에만 사용되며, 연속적 이동 궤적 형태로 영구 보관되지 않습니다. API 응답에는 소수점 2자리로 반올림된 근사 좌표만 포함됩니다.",
          "위치정보의 보호 및 이용 등에 관한 법률에 따라, 분쟁 처리 및 이용자 보호 의무 증빙을 위한 최소한의 '위치정보 이용·제공 사실 확인자료'는 6개월간 보존 후 자동 파기됩니다.",
          "이용자는 브라우저 권한 관리 또는 서비스 내 환경 설정을 통해 언제든지 위치정보 제공 동의를 철회할 수 있습니다.",
        ],
      },
      {
        id: "cross-border",
        eyebrow: "cross-border transfer",
        title: "6. 개인정보 국외 이전 고지",
        items: [
          "나들해는 고가용성 데이터베이스 서비스(TiDB Cloud)와 AI API 제공사의 인프라가 국외에 위치함에 따라, 개인정보 보호법 제28조의8에 의거하여 다음과 같이 국외 이전 사항을 고지합니다.",
          "① 이전받는 자: PingCAP Inc.(TiDB Cloud 데이터베이스), Vultr(클라우드 인프라), LLM API 제공사(AI 모델), Tavily(웹검색 API).",
          "② 이전 국가: 일본(AWS ap-northeast 리전, TiDB), 미국(Vultr·AI 제공사 인프라).",
          "③ 이전 항목: 이메일, 프로필 정보, 해시된 비밀번호, 암호화된 채팅 메시지, AI 챗봇 대화 내용(일시적), 단어장 데이터(암호화).",
          "④ 이전 목적: 글로벌 클라우드 기반 고가용성 데이터 저장 및 AI/LLM API 호출 처리.",
          "⑤ 거부권 및 불이익: 국외 이전을 거부하실 경우 서비스의 핵심 인프라(AI 기능, 데이터 저장) 이용이 불가능하므로 서비스 이용 해지(회원 탈퇴)가 필요합니다.",
        ],
      },
      {
        id: "retention",
        eyebrow: "retention & deletion",
        title: "7. 데이터 보관 및 파기",
        items: [
          "회원 탈퇴 시: 사용자 계정, 프로필, 세션, 대시보드 채팅 이력, 실험실 단어장·카드·학습기록, 코드 공유 세션(소유자), 전주 채팅, 분석 데이터 등 10개 이상의 연관 테이블에서 모든 개인 데이터가 트랜잭션 단위로 연쇄 삭제됩니다.",
          "보안 로그: 로그인·가입·로그아웃 등 인증 보안 이벤트 기록은 90일간 보관 후 자동 파기됩니다.",
          "전주 커뮤니티 채팅: 전주 지역 채팅 메시지는 발송 시점 기준 7일(168시간) 경과 후 데이터베이스에서 자동 삭제되며, 백업이 보관되지 않습니다.",
          "데이터 암호화 키: 데이터 보호 키(DATA_PROTECTION_KEY)는 환경변수로 관리되며, 키 분실 시 기존 암호화 데이터의 복호화가 불가능함을 유의하시기 바랍니다.",
        ],
      },
      {
        id: "cookies",
        eyebrow: "cookies & analytics",
        title: "8. 쿠키·분석·세션 정책",
        items: [
          "필수 쿠키: 인증 세션 유지를 위한 'nadeulhae_auth'(httpOnly, SameSite=Lax, Secure), 코드 공유 게스트 식별자, 익명 세션 관리용 쿠키가 설정됩니다. 이 쿠키는 서비스 동작에 필수적입니다.",
          "분석 쿠키 및 데이터: 분석 동의 시 페이지 방문 경로, 체류 시간, 버튼 클릭, 기기 유형, 테마 설정, 언어 설정 등의 비식별화된 사용성 데이터가 수집됩니다. 원본 IP 주소는 절대 저장되지 않습니다.",
          "분석 데이터는 일별 집계 통계 형태로만 보관되며, 개인 식별이 불가능하도록 설계되었습니다. 분석 동의는 계정 설정에서 언제든지 철회할 수 있습니다.",
          "LLM 사용량: AI 챗봇 이용 시 프롬프트 토큰, 응답 토큰, 요청 횟수가 서비스 품질 관리 및 일일 사용량 제한 적용을 위해 기록됩니다. 대화 내용은 암호화되어 토큰 수와 별도로 저장됩니다.",
        ],
      },
      {
        id: "rights",
        eyebrow: "user rights",
        title: "9. 이용자 권리와 문의",
        items: [
          "모든 회원은 대시보드 계정 설정에서 본인의 등록 정보 열람·수정, 마케팅·분석 동의 변경, 실험실 기능 활성화/비활성화, 회원 탈퇴(계정 삭제)를 자유롭게 할 수 있습니다.",
          "AI 챗봇 이용을 원하지 않는 경우, 계정 설정에서 실험실 기능을 비활성화할 수 있습니다. 단, 날씨 조회와 같은 기본 서비스는 AI 기능과 무관하게 이용 가능합니다.",
          "개인정보, 위치정보, AI 데이터 처리, 시스템 장애 관련 문의·민원·법률 대응은 공식 고객 지원 메일(kim0040@jbnu.ac.kr)로 접수해 주시기 바랍니다.",
        ],
      },
    ],
  },
  en: {
    badge: "policy pack",
    title: "Nadeulhae Terms, Privacy Policy, and Analytics Notice",
    description:
      "This policy reflects the currently implemented scope of sign-up, login, location-based weather lookup, and service-improvement analytics.",
    effectiveDate: "Effective: April 29, 2026 (v2.0 refreshed)",
    contentsTitle: "Quick navigation",
    summaryTitle: "Key summary",
    summary: [
      {
        label: "Required data",
        value: "Account, profile, security logs",
        detail: "Email, display name, nickname, scrypt-hashed password, age range, region, interests, preferred time, consent records, access IP logs",
      },
      {
        label: "Optional data",
        value: "Marketing · Analytics · AI",
        detail: "Marketing consent, analytics consent, Lab feature activation, AI chatbot usage are all optional choices.",
      },
      {
        label: "AI data handling",
        value: "Chat encrypted in transit",
        detail: "AI chatbot conversations are AES-256-GCM encrypted, sent to LLM API providers (subject to change) only for inference, never used for model training",
      },
      {
        label: "Default analytics",
        value: "Anonymous daily totals",
        detail: "Before consent, only anonymous route counts, response timing, and error ratios are stored for operations.",
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
          "Nadeulhae is a comprehensive outdoor activity platform that aggregates public data (KMA, AirKorea, APIHub) to provide real-time weather, air quality, UV, weather alerts, and a 0-100 outdoor suitability score, together with an AI-powered dashboard chatbot, a Lab hub (vocabulary/FSRS, AI web-search chat, code sharing), and Jeonju AI daily briefing and community chat.",
          "Access is generally free, but users must register with true and accurate information. Disruption through hate speech, profanity, spam, malicious AI prompt injection, or traffic attacks is prohibited and may result in account suspension or AI feature restriction without warning.",
          "Service downtime may occur due to public API instability, LLM API provider outages, changes, or discontinuation, or scheduled maintenance. LLM API providers may be changed or replaced without prior notice at the operator's discretion. The operator is not liable for indirect damages except in cases of gross negligence.",
        ],
      },
      {
        id: "ai-services",
        eyebrow: "ai & llm",
        title: "2. AI/LLM Services Terms",
        items: [
          "Nadeulhae provides these AI services: (a) Dashboard AI chatbot — weather-aware outdoor activity assistant, (b) Lab AI chat — Tavily web-search integrated knowledge chatbot, (c) Lab vocabulary generator — FSRS flashcard AI auto-generation with translations and examples, (d) Jeonju AI daily briefing — local news and event AI summary.",
          "AI services are processed through third-party LLM API providers, which may be changed or replaced without prior notice based on service quality, cost, and availability. User input to AI chatbots is temporarily transmitted to these providers solely for response generation and is never used for model training.",
          "All AI-generated content (weather recommendations, chatbot answers, vocabulary definitions, news summaries) is machine learning inference output and may be inaccurate. The Jeonju briefing news summaries and Lab AI chat web-search results are for reference only; verify critical decisions with official sources.",
          "AI services have daily usage limits (LLM global: 5,000 req/day, per-user: 100-200 req/day, web-search: 800/month). Exceeding limits may temporarily block AI features. Malicious repetitive calls may result in permanent AI feature restriction.",
        ],
      },
      {
        id: "privacy",
        eyebrow: "privacy notice",
        title: "3. Privacy Collection and Usage",
        items: [
          "Required: Email, display name, nickname, scrypt-hashed password, age band, primary region, interest tags, preferred time slot, weather sensitivity, consent timestamps, access IP security logs.",
          "Optional: Custom interest descriptions, marketing consent, analytics consent (referral source, device info, theme, button interactions), Lab feature activation, AI chatbot usage.",
          "Chat data handling: Dashboard AI chat and Jeonju community chat content is AES-256-GCM encrypted in the database. AI chatbot conversations are temporarily decrypted for LLM API transmission and discarded from provider servers after response generation.",
          "Vocabulary data: Decks, cards (terms, meanings, examples, learning progress) created in the Lab are user-owned and AES-256-GCM encrypted. They are never shared with other users.",
          "Code share data: Source code written in the code editor is stored with title, language, and content. Sessions operate on a link-sharing model — anyone with the session ID can access. Never include sensitive information (API keys, passwords) in code share sessions.",
        ],
      },
      {
        id: "encryption",
        eyebrow: "data protection",
        title: "4. Data Encryption & Protection",
        items: [
          "All sensitive personal data (email, name, nickname, age band, interests, IP, User-Agent, chat content) is protected with AES-256-GCM field-level encryption and HKDF key derivation. Each field uses an independent context key, preventing cross-field exposure from a single key compromise.",
          "Email and nickname use blind indexes (HMAC-SHA256 hashes) for duplicate registration checks without decrypting the original text.",
          "Passwords use scrypt (N=16384, r=8, p=1) one-way hashing with a Pepper (AUTH_PEPPER env var). Plain-text passwords are never stored in memory or database. Non-existent accounts receive identical computation to prevent timing attacks.",
          "All data transmission occurs over TLS/SSL. Production deployments apply HSTS (max-age=2 years), CSP, SameSite=Lax cookies, and additional security headers.",
        ],
      },
      {
        id: "location",
        eyebrow: "location privacy",
        title: "5. Location-Based Services",
        items: [
          "Nadeulhae uses the browser Geolocation API to obtain user-approved coordinates for immediate weather, air quality, nearby station matching, and AI course recommendations.",
          "Location data is used only for single-request weather computation and is never stored as a continuous trajectory. API responses include coordinates rounded to 2 decimal places.",
          "Per South Korea's Location Data Act, minimal 'location data utilization verification records' are retained for 6 months for dispute resolution, then automatically deleted.",
          "Users may revoke geolocation consent at any time through browser permissions or in-app settings.",
        ],
      },
      {
        id: "cross-border",
        eyebrow: "cross-border transfer",
        title: "6. Cross-Border Data Transfer Notice",
        items: [
          "Due to cloud database (TiDB Cloud) and AI API provider infrastructure located overseas, Nadeulhae discloses the following per PIPA Article 28-8.",
          "① Recipients: PingCAP Inc. (TiDB Cloud database), Vultr (cloud infrastructure), LLM API providers (AI model APIs), Tavily (web-search API).",
          "② Countries: Japan (AWS ap-northeast, TiDB), USA (Vultr & AI provider infrastructure).",
          "③ Data transferred: Email, profile info, hashed password, encrypted chat messages, temporary AI chatbot conversations, encrypted vocabulary data.",
          "④ Purpose: High-availability global cloud storage and AI/LLM API processing.",
          "⑤ Refusal consequence: Declining cross-border transfer makes core infrastructure (AI features, data storage) inoperable, requiring account deletion.",
        ],
      },
      {
        id: "retention",
        eyebrow: "retention & deletion",
        title: "7. Data Retention & Deletion",
        items: [
          "Account deletion: All user data across 10+ related tables (accounts, profiles, sessions, dashboard chats, Lab decks/cards, code share sessions owned, Jeonju chats, analytics) is cascade-deleted in a single transaction.",
          "Security logs: Authentication security event records (login, signup, logout) are retained for 90 days then auto-deleted.",
          "Jeonju community chat: Messages are automatically deleted from the database 168 hours (7 days) after posting, with no backup retained.",
          "Encryption key: The data protection key (DATA_PROTECTION_KEY) is managed via environment variable. Loss of this key renders encrypted data permanently unrecoverable.",
        ],
      },
      {
        id: "cookies",
        eyebrow: "cookies & analytics",
        title: "8. Cookies, Analytics & Session Policy",
        items: [
          "Essential cookies: Authentication session ('nadeulhae_auth', httpOnly, SameSite=Lax, Secure), code share guest identifiers, and anonymous session cookies. These are required for service operation.",
          "Analytics data: With consent, de-identified usability data (page visit paths, time on page, button clicks, device type, theme, language settings) is collected. Raw IP addresses are never stored.",
          "Analytics data is stored only as daily aggregate statistics designed to prevent individual identification. Analytics consent can be revoked anytime in account settings.",
          "LLM usage tracking: AI chatbot usage metrics (prompt tokens, response tokens, request counts) are recorded for service quality management and daily limit enforcement. Conversation content is stored encrypted and separately from token counts.",
        ],
      },
      {
        id: "rights",
        eyebrow: "user rights",
        title: "9. User Rights & Contact",
        items: [
          "All members can freely view, edit, and delete their account information, change marketing/analytics consent, toggle Lab features, and delete their account from the Dashboard settings.",
          "To opt out of AI chatbot features, disable Lab features in account settings. Basic services (weather lookup) remain available without AI features.",
          "For privacy, location, AI data processing, or system issues, contact our official support email at kim0040@jbnu.ac.kr.",
        ],
      },
    ],
  },
  zh: {
    badge: "服务条款",
    title: "Nadeulhae 服务条款 · 隐私政策 · 分析/Cookie 政策",
    description: "以下文件基于当前实现范围编写，涵盖注册、登录、位置天气查询及服务改善分析。",
    effectiveDate: "生效日期: 2026年4月29日 (v2.0)",
    contentsTitle: "快速导航",
    summaryTitle: "核心摘要",
    summary: [
      { label: "必要信息", value: "账户 + 个人资料 + 安全日志", detail: "电子邮件、姓名、昵称、加密密码、年龄段、地区、兴趣、时间偏好、同意记录、访问日志" },
      { label: "可选信息", value: "营销 · 分析 · AI", detail: "营销同意、分析同意、实验室功能激活、AI聊天机器人为可选。" },
      { label: "AI数据处理", value: "聊天内容加密传输", detail: "AI聊天对话使用AES-256-GCM加密，仅发送至LLM提供商用于推理，不用于模型训练。" },
      { label: "默认分析", value: "匿名每日汇总", detail: "同意前仅存储匿名路由计数、响应时间和错误率。" },
    ],
    sections: [
      { id: "service", eyebrow: "服务条款", title: "1. Nadeulhae 服务条款", items: [
        "Nadeulhae 是一项综合性户外活动平台，汇总公共数据(KMA、AirKorea、APIHub)提供实时天气、空气质量、紫外线、天气警报和0-100户外适宜性评分，以及AI驱动的仪表板聊天机器人、实验室中心(词汇/FSRS、AI网络搜索聊天、代码共享)和全州AI每日简报及社区聊天。",
        "访问通常是免费的，但用户必须注册真实准确的信息。禁止通过仇恨言论、辱骂、垃圾邮件、恶意AI提示注入或流量攻击扰乱社区运营，违者可能导致账号暂停或AI功能限制。",
         "服务可能因公共API不稳定、LLM API提供商服务中断·变更·终止或定期维护而停机。LLM API提供商可能因内部原因未经事先通知而更改或替换。运营方不对不可预见的服务中断造成的间接损失承担责任，重大过失除外。",
      ]},
      { id: "ai-services", eyebrow: "AI & LLM", title: "2. AI/LLM 服务条款", items: [
        "Nadeulhae 提供以下AI服务: (a) 仪表板AI聊天机器人 — 天气感知户外活动助手，(b) 实验室AI聊天 — Tavily网络搜索集成知识聊天机器人，(c) 实验室词汇生成器 — FSRS闪卡AI自动生成含翻译和例句，(d) 全州AI每日简报 — 本地新闻和事件AI摘要。",
         "AI服务通过第三方LLM API提供商处理，提供商可能根据服务质量·成本·可用性未经事先通知而更改或替换。用户输入仅暂时传输用于响应生成，绝不用于模型训练。",
        "所有AI生成内容(天气推荐、聊天机器人回答、词汇定义、新闻摘要)均为机器学习推理输出，可能不准确。全州简报新闻摘要和实验室AI聊天网络搜索结果仅供参考；关键决策请核实官方来源。",
        "AI服务设有每日使用限制(LLM全局: 5,000次/天，每用户: 100-200次/天，网络搜索: 800次/月)。超出限制可能导致AI功能暂时受限。恶意重复调用可能导致AI功能永久限制。",
      ]},
      { id: "privacy", eyebrow: "隐私声明", title: "3. 个人信息收集与使用", items: [
        "必填: 电子邮件、显示名称、昵称、加密密码、年龄段、主要地区、兴趣标签、时间偏好、天气敏感度、同意时间戳、访问IP安全日志。",
        "选填: 自定义兴趣描述、营销同意、分析同意(来源、设备信息、主题、按钮交互)、实验室功能激活、AI聊天机器人使用。",
        "数据处理: 仪表板AI聊天和全州社区聊天内容在数据库中使用AES-256-GCM加密。AI聊天对话在LLM API传输时暂时解密，生成响应后从提供商服务器丢弃。",
        "词汇数据: 实验室中创建的词库、卡片(术语、释义、例句、学习进度)归用户所有并使用AES-256-GCM加密。绝不与其他用户共享。",
        "代码共享数据: 代码编辑器中编写的源代码连同标题、语言和内容存储。会话采用链接共享模式 — 任何知道会话ID的人均可访问。切勿在代码共享会话中包含敏感信息(API密钥、密码)。",
      ]},
      { id: "encryption", eyebrow: "数据保护", title: "4. 数据加密与保护", items: [
        "所有敏感个人数据使用AES-256-GCM字段级加密和HKDF密钥派生保护。每个字段使用独立的上下文密钥，防止单密钥泄露导致跨字段暴露。",
        "电子邮件和昵称使用盲索引(HMAC-SHA256哈希)进行重复注册检查，无需解密原文。",
        "密码使用scrypt(N=16384, r=8, p=1)单向哈希和Pepper(AUTH_PEPPER环境变量)。明文密码绝不存储在内存或数据库中。对不存在的账户执行相同计算以防止时序攻击。",
        "所有数据传输通过TLS/SSL进行。生产部署应用HSTS(max-age=2年)、CSP、SameSite=Lax cookie和其他安全标头。",
      ]},
      { id: "location", eyebrow: "位置隐私", title: "5. 位置服务", items: [
        "Nadeulhae 使用浏览器定位API获取用户授权坐标，用于即时天气、空气质量、附近站点匹配和AI路线推荐。",
        "位置数据仅用于单次天气计算，从不作为连续轨迹存储。API响应包含四舍五入到2位小数的近似坐标。",
        "根据韩国《位置数据法》，用于争议解决的'位置数据使用验证记录'保留6个月后自动删除。",
        "用户可通过浏览器权限或应用内设置随时撤销定位同意。",
      ]},
      { id: "cross-border", eyebrow: "跨境传输", title: "6. 跨境数据传输通知", items: [
        "由于云数据库(TiDB Cloud)和AI API提供商基础设施位于海外，Nadeulhae 根据PIPA第28-8条披露以下信息。",
         "① 接收方: PingCAP Inc.(TiDB Cloud数据库), Vultr(云基础设施), LLM API提供商(AI模型API), Tavily(网络搜索API)。",
        "② 国家: 日本(AWS ap-northeast, TiDB), 美国(Vultr & AI提供商基础设施)。",
        "③ 传输数据: 电子邮件、个人资料信息、哈希密码、加密聊天消息、临时AI聊天对话、加密词汇数据。",
        "④ 目的: 高可用性全球云存储和AI/LLM API处理。",
        "⑤ 拒绝后果: 拒绝跨境传输将使核心基础设施(AI功能、数据存储)无法运行，需要删除账户。",
      ]},
      { id: "retention", eyebrow: "数据保留", title: "7. 数据保留与删除", items: [
        "账户删除: 在单个事务中级联删除10+个相关表中的所有用户数据(账户、个人资料、会话、仪表板聊天、实验室词库/卡片、拥有的代码共享会话、全州聊天、分析)。",
        "安全日志: 认证安全事件记录(登录、注册、退出)保留90天后自动删除。",
        "全州社区聊天: 消息发布168小时(7天)后自动从数据库删除，不保留备份。",
        "加密密钥: 数据保护密钥(DATA_PROTECTION_KEY)通过环境变量管理。丢失此密钥将使加密数据永久无法恢复。",
      ]},
      { id: "cookies", eyebrow: "Cookie & 分析", title: "8. Cookie、分析与会话政策", items: [
        "必要Cookie: 认证会话('nadeulhae_auth', httpOnly, SameSite=Lax, Secure)、代码共享访客标识符和匿名会话Cookie。这些是服务运行所必需的。",
        "分析数据: 经同意后收集去标识化的可用性数据(页面访问路径、页面停留时间、按钮点击、设备类型、主题、语言设置)。不存储原始IP地址。",
        "分析数据仅以每日汇总统计形式存储，旨在防止个人识别。可在账户设置中随时撤销分析同意。",
        "LLM使用追踪: 记录AI聊天机器人使用指标(提示令牌、响应令牌、请求计数)用于服务质量管理和每日限制执行。对话内容加密存储，与令牌计数分开。",
      ]},
      { id: "rights", eyebrow: "用户权利", title: "9. 用户权利与联系", items: [
        "所有会员可在仪表板账户设置中自由查看、编辑和删除账户信息，更改营销/分析同意，切换实验室功能，删除账户。",
        "如需退出AI聊天机器人功能，请在账户设置中禁用实验室功能。基本服务(天气查询)无需AI功能即可使用。",
        "关于隐私、位置、AI数据处理或系统问题，请通过官方支持邮箱 kim0040@jbnu.ac.kr 联系我们。",
      ]},
    ],
  },
  ja: {
    badge: "利用規約",
    title: "Nadeulhae 利用規約 · プライバシーポリシー · 分析/Cookie ポリシー",
    description: "以下の文書は現在の実装範囲に基づいて作成され、会員登録、ログイン、位置情報天気照会、サービス改善分析をカバーしています。",
    effectiveDate: "発効日: 2026年4月29日 (v2.0)",
    contentsTitle: "クイックナビゲーション",
    summaryTitle: "主要サマリー",
    summary: [
      { label: "必須情報", value: "アカウント + プロフィール + セキュリティログ", detail: "メールアドレス、表示名、ニックネーム、暗号化パスワード、年齢層、地域、興味、時間帯設定、同意記録、アクセスログ" },
      { label: "任意情報", value: "マーケティング · 分析 · AI", detail: "マーケティング同意、分析同意、ラボ機能の有効化、AIチャットボットは任意です。" },
      { label: "AIデータ処理", value: "チャット内容の暗号化転送", detail: "AIチャット会話はAES-256-GCMで暗号化され、LLMプロバイダーに推論目的でのみ送信され、モデル学習には使用されません。" },
      { label: "デフォルト分析", value: "匿名の日次集計", detail: "同意前は、匿名のルートカウント、応答時間、エラー率のみが保存されます。" },
    ],
    sections: [
      { id: "service", eyebrow: "利用規約", title: "1. Nadeulhae 利用規約", items: [
        "Nadeulhaeは、公共データ(KMA、AirKorea、APIHub)を集約してリアルタイムの天気、空気質、UV、気象警報、0-100の屋外適性スコアを提供し、AI搭載のダッシュボードチャットボット、ラボハブ(語彙/FSRS、AI Web検索チャット、コード共有)、全州AIデイリーブリーフィングとコミュニティチャットを統合した包括的なアウトドア活動プラットフォームです。",
        "アクセスは基本的に無料ですが、ユーザーは正確な情報で登録する必要があります。ヘイトスピーチ、悪用、スパム、悪意のあるAIプロンプト注入、トラフィック攻撃によるコミュニティ運営の妨害は禁止されており、アカウント停止やAI機能制限の対象となります。",
        "公共APIの不安定性、LLM APIプロバイダーの障害·変更·終了、または定期メンテナンスによりサービスが停止する場合があります。LLM APIプロバイダーは内部事情により事前通知なく変更·代替されることがあります。運営者は、重大な過失がない限り、予期せぬ中断による間接的な損害について責任を負いません。",
      ]},
      { id: "ai-services", eyebrow: "AI & LLM", title: "2. AI/LLM サービス利用規約", items: [
        "Nadeulhaeは以下のAIサービスを提供します: (a) ダッシュボードAIチャットボット — 天気認識型アウトドアアシスタント、(b) ラボAIチャット — Tavily Web検索統合型知識チャットボット、(c) ラボ語彙ジェネレーター — 翻訳と例文付きFSRSフラッシュカードAI自動生成、(d) 全州AIデイリーブリーフィング — ローカルニュースとイベントのAIサマリー。",
        "AIサービスはサードパーティLLM APIプロバイダーを通じて処理され、プロバイダーはサービス品質·コスト·可用性に応じて事前通知なく変更·代替されることがあります。ユーザー入力は応答生成の目的でのみ一時的に送信され、モデル学習には一切使用されません。",
        "すべてのAI生成コンテンツ(天気推奨、チャットボット回答、語彙定義、ニュースサマリー)は機械学習推論の出力であり、不正確な場合があります。全州ブリーフィングのニュースサマリーとラボAIチャットのWeb検索結果は参考用です。重要な判断は公式ソースで確認してください。",
        "AIサービスには1日の使用制限があります(LLMグローバル: 5,000回/日、ユーザーあたり: 100-200回/日、Web検索: 800回/月)。制限を超えるとAI機能が一時的に制限される場合があります。悪意のある繰り返し呼び出しは、AI機能の永続的な制限につながる場合があります。",
      ]},
      { id: "privacy", eyebrow: "プライバシー通知", title: "3. 個人情報の収集と利用", items: [
        "必須: メールアドレス、表示名、ニックネーム、暗号化パスワード、年齢層、主な地域、興味タグ、時間帯設定、天気感度、同意タイムスタンプ、アクセスIPセキュリティログ。",
        "任意: カスタム興味説明、マーケティング同意、分析同意(紹介元、デバイス情報、テーマ、ボタン操作)、ラボ機能の有効化、AIチャットボットの使用。",
        "データ処理: ダッシュボードAIチャットと全州コミュニティチャットの内容はデータベースでAES-256-GCM暗号化されています。AIチャットの会話はLLM API送信時に一時的に復号され、応答生成後にプロバイダーのサーバーから破棄されます。",
        "語彙データ: ラボで作成されたデッキ、カード(用語、意味、例文、学習進捗)はユーザー所有でAES-256-GCM暗号化されています。他のユーザーと共有されることはありません。",
        "コード共有データ: コードエディターで作成されたソースコードは、タイトル、言語、内容とともに保存されます。セッションはリンク共有モデルで運営され、セッションIDを知っている人は誰でもアクセスできます。APIキーやパスワードなどの機密情報をコード共有セッションに含めないでください。",
      ]},
      { id: "encryption", eyebrow: "データ保護", title: "4. データ暗号化と保護", items: [
        "すべての機密個人データは、AES-256-GCMフィールドレベル暗号化とHKDFキー導出で保護されています。各フィールドは独立したコンテキストキーを使用し、単一キーの漏洩によるクロスフィールド露出を防ぎます。",
        "メールアドレスとニックネームは、原文を復号することなく重複登録をチェックするためにブラインドインデックス(HMAC-SHA256ハッシュ)を使用します。",
        "パスワードはscrypt(N=16384, r=8, p=1)一方向ハッシュとPepper(AUTH_PEPPER環境変数)を使用します。平文パスワードがメモリやデータベースに保存されることはありません。存在しないアカウントに対しても同一の計算を実行し、タイミング攻撃を防ぎます。",
        "すべてのデータ転送はTLS/SSL経由で行われます。本番環境ではHSTS(max-age=2年)、CSP、SameSite=Lax Cookie、その他のセキュリティヘッダーが適用されます。",
      ]},
      { id: "location", eyebrow: "位置情報プライバシー", title: "5. 位置情報サービス", items: [
        "Nadeulhaeはブラウザの位置情報APIを使用して、ユーザーが許可した座標を即時の天気、空気質、近隣観測所マッチング、AIコース推奨に使用します。",
        "位置データは単一の天気計算にのみ使用され、連続的な軌跡として保存されることはありません。API応答には小数点以下2桁に丸められた近似座標が含まれます。",
        "韓国の「位置データ法」に基づき、紛争解決のための「位置データ利用検証記録」は6か月間保持され、その後自動的に削除されます。",
        "ユーザーはブラウザの権限またはアプリ内設定を通じて、いつでも位置情報の同意を取り消すことができます。",
      ]},
      { id: "cross-border", eyebrow: "越境転送", title: "6. 越境データ転送に関する通知", items: [
        "クラウドデータベース(TiDB Cloud)とAI APIプロバイダーのインフラが海外にあるため、NadeulhaeはPIPA第28-8条に基づき以下を開示します。",
        "① 受領者: PingCAP Inc.(TiDB Cloudデータベース)、Vultr(クラウドインフラ)、LLM APIプロバイダー(AIモデルAPI)、Tavily(Web検索API)。",
        "② 国: 日本(AWS ap-northeast、TiDB)、米国(Vultr & AIプロバイダーインフラ)。",
        "③ 転送データ: メールアドレス、プロフィール情報、ハッシュ化パスワード、暗号化チャットメッセージ、一時的なAIチャット会話、暗号化語彙データ。",
        "④ 目的: 高可用性グローバルクラウドストレージとAI/LLM API処理。",
        "⑤ 拒否の結果: 越境転送を拒否すると、コアインフラ(AI機能、データストレージ)が動作不能になり、アカウント削除が必要になります。",
      ]},
      { id: "retention", eyebrow: "データ保持", title: "7. データ保持と削除", items: [
        "アカウント削除: 単一トランザクションで10以上の関連テーブル(アカウント、プロフィール、セッション、ダッシュボードチャット、ラボデッキ/カード、所有コード共有セッション、全州チャット、分析)からすべてのユーザーデータが連鎖削除されます。",
        "セキュリティログ: 認証セキュリティイベント記録(ログイン、サインアップ、ログアウト)は90日間保持され、その後自動削除されます。",
        "全州コミュニティチャット: メッセージは投稿後168時間(7日)でデータベースから自動的に削除され、バックアップは保持されません。",
        "暗号化キー: データ保護キー(DATA_PROTECTION_KEY)は環境変数で管理されます。このキーを紛失すると、暗号化データが永久に復元不能になります。",
      ]},
      { id: "cookies", eyebrow: "Cookie & 分析", title: "8. Cookie、分析、セッションポリシー", items: [
        "必須Cookie: 認証セッション('nadeulhae_auth', httpOnly, SameSite=Lax, Secure)、コード共有ゲスト識別子、匿名セッションCookie。これらはサービス運用に必須です。",
        "分析データ: 同意がある場合、非識別化されたユーザビリティデータ(ページ訪問経路、滞在時間、ボタンクリック、デバイスタイプ、テーマ、言語設定)が収集されます。生のIPアドレスは保存されません。",
        "分析データは個人識別を防ぐよう設計された日次集計統計としてのみ保存されます。分析同意はアカウント設定でいつでも取り消せます。",
        "LLM使用量追跡: AIチャットボットの使用指標(プロンプトトークン、応答トークン、リクエスト数)がサービス品質管理と日次制限の実施のために記録されます。会話内容は暗号化され、トークン数とは別に保存されます。",
      ]},
      { id: "rights", eyebrow: "ユーザー権利", title: "9. ユーザー権利とお問い合わせ", items: [
        "すべてのメンバーはダッシュボードのアカウント設定から、アカウント情報の表示・編集・削除、マーケティング/分析同意の変更、ラボ機能の切り替え、アカウント削除を自由に行えます。",
        "AIチャットボット機能をオプトアウトするには、アカウント設定でラボ機能を無効にしてください。基本サービス(天気照会)はAI機能なしで利用可能です。",
        "プライバシー、位置情報、AIデータ処理、システムの問題については、公式サポートメール kim0040@jbnu.ac.kr までお問い合わせください。",
      ]},
    ],
  },
}

// ---- Component ----

export default function TermsPage() {
  const { language } = useLanguage()
  const { resolvedTheme } = useTheme()
  const copy = (POLICY_CONTENT as any)[language] ?? POLICY_CONTENT.en
  const typedCopy = copy as typeof POLICY_CONTENT.en

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
                {typedCopy.badge}
              </span>
              <div className="space-y-3">
                <AnimatedGradientText className="text-3xl font-black tracking-tight sm:text-4xl">
                  {typedCopy.title}
                </AnimatedGradientText>
                <p className="max-w-4xl text-sm leading-7 text-muted-foreground sm:text-base break-words">
                  {typedCopy.description}
                </p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-[1.5rem] border border-card-border/70 bg-background/70 px-5 py-4 text-sm font-semibold text-foreground">
                  {typedCopy.effectiveDate}
                </div>
              </div>
            </div>
          </div>
        </MagicCard>

        <MagicCard className="rounded-[2rem]" gradientSize={220} gradientOpacity={0.7}>
          <div className="rounded-[inherit] bg-card/85 p-5 backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                  {typedCopy.contentsTitle}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">
                  {typedCopy.summaryTitle}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {typedCopy.sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="rounded-full border border-card-border max-w-[180px] truncate bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue"
                  >
                    {section.title}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </MagicCard>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {typedCopy.summary.map((item) => (
            <MagicCard
              key={item.label}
              className="rounded-[1.7rem]"
              gradientSize={200}
              gradientOpacity={0.7}
            >
              <div className="rounded-[inherit] bg-card/85 p-5 backdrop-blur-xl">
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
          {typedCopy.sections.map((section) => (
            <MagicCard
              key={section.id}
              className="rounded-[2rem]"
              gradientSize={220}
              gradientOpacity={0.7}
            >
              <section
                id={section.id}
                className="scroll-mt-32 rounded-[inherit] bg-card/85 p-5 backdrop-blur-xl sm:scroll-mt-36 sm:p-8"
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
                        className="flex gap-3 rounded break-words-[1.25rem] border border-card-border/70 bg-background/70 px-4 py-3.5 text-sm leading-6 text-foreground"
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
