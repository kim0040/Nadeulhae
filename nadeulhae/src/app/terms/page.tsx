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
        detail: "AI 챗봇 대화는 AES-256-GCM 암호화 저장, LLM 제공사(NanoGPT, FactChat)에 일시 전송 후 폐기, 학습에 미사용",
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
          "불가항력적인 공공 API 장애, LLM 제공사(NanoGPT·FactChat) 서비스 중단, 시스템 유지 보수 등의 사유로 서비스가 일시 중단될 수 있으며, 운영자는 별도 공지가 불가피한 상황의 장애 및 이로 인한 직간접적 손해에 대하여 고의 또는 중과실이 없는 한 책임을 지지 않습니다.",
        ],
      },
      {
        id: "ai-services",
        eyebrow: "ai & llm",
        title: "2. AI/LLM 기반 서비스 이용약관",
        items: [
          "나들해는 다음 AI·LLM 서비스를 제공합니다: (가) 대시보드 AI 챗봇 — 날씨 기반 야외활동 어시스턴트, (나) 실험실 AI 챗 — Tavily 웹검색 연동 지식 챗봇, (다) 실험실 단어 생성 — FSRS 단어장 AI 자동 생성·번역·예문 작성, (라) 전주 AI 데일리 브리핑 — 지역 뉴스·이벤트 AI 요약.",
          "AI 서비스는 타사 LLM 제공사(NanoGPT 'deepseek-v4-flash/pro', FactChat 'SAIT 3 Pro') 및 웹검색 제공사(Tavily)의 API를 통해 처리됩니다. 사용자가 AI 챗봇에 입력한 대화 내용은 해당 제공사에 일시적으로 전송되어 응답 생성에만 사용되며, 제공사의 모델 학습 데이터로 활용되지 않습니다.",
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
          "① 이전받는 자: PingCAP Inc.(TiDB Cloud 데이터베이스), Vultr(클라우드 인프라), NanoGPT·FactChat(AI 모델 API), Tavily(웹검색 API).",
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
        detail: "AI chatbot conversations are AES-256-GCM encrypted, sent to LLM providers (NanoGPT, FactChat) only for inference, never used for model training",
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
          "Service downtime may occur due to public API instability, LLM provider (NanoGPT, FactChat) outages, or scheduled maintenance. The operator is not liable for indirect damages except in cases of gross negligence.",
        ],
      },
      {
        id: "ai-services",
        eyebrow: "ai & llm",
        title: "2. AI/LLM Services Terms",
        items: [
          "Nadeulhae provides these AI services: (a) Dashboard AI chatbot — weather-aware outdoor activity assistant, (b) Lab AI chat — Tavily web-search integrated knowledge chatbot, (c) Lab vocabulary generator — FSRS flashcard AI auto-generation with translations and examples, (d) Jeonju AI daily briefing — local news and event AI summary.",
          "AI services are processed through third-party LLM providers (NanoGPT: 'deepseek-v4-flash/pro', FactChat: 'SAIT 3 Pro') and web-search provider (Tavily). User input to AI chatbots is temporarily transmitted to these providers solely for response generation and is never used for model training.",
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
          "① Recipients: PingCAP Inc. (TiDB Cloud database), Vultr (cloud infrastructure), NanoGPT & FactChat (AI model APIs), Tavily (web-search API).",
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
}

export default function TermsPage() {
  const { language } = useLanguage()
  const { resolvedTheme } = useTheme()
  const copy = POLICY_CONTENT[language as "ko" | "en"] ?? POLICY_CONTENT.en

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
                    className="rounded-full border border-card-border max-w-[180px] truncate/70 bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue"
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
