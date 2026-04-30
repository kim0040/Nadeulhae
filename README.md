# 나들해 (Nadeulhae)

> 🌐 [English](docs/README_EN.md) · [中文](docs/README_ZH.md) · [日本語](docs/README_JA.md)

> **날씨 기반 피크닉 지수 + AI 대시보드 챗 + 실험실(어휘/코드공유) + 전주 지역 브리핑**

Next.js 16 풀스택 웹 애플리케이션입니다. 실시간 협업 코드 에디터, FSRS 간격 반복 학습, AI 웹검색 챗, GPS 기반 날씨 점수화 기능을 하나의 서비스로 통합 제공합니다.

---

## 목차

- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [빠른 시작](#빠른-시작)
- [배포](#배포)
- [문서](#문서)
- [기여자](#기여자)
- [라이선스](#라이선스)

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **🌤️ 날씨 인텔리전스** | 기상청(KMA), AirKorea, APIHub 실시간 데이터를 결합해 0-100 피크닉 지수 산출. 위성/레이더 이미지, 시간별 예보, 산불 정보 제공 |
| **🤖 대시보드 AI 챗** | 날씨 컨텍스트를 주입한 AI 챗봇. SSE 스트리밍 응답, 세션간 사용자 메모리, 컨텍스트 자동 압축 |
| **📚 랩 (Lab)** | FSRS v5 알고리즘 기반 어휘 암기 카드, AI 덱 자동 생성, 웹검색 연동 AI 챗 |
| **💻 코드 공유** | CodeMirror 6 기반 실시간 협업 편집기. WebSocket 접속현황, 타이핑 표시, 낙관적 동시성 제어 |
| **📍 전주 데일리 브리핑** | AI가 매일 생성하는 전주 맞춤형 브리핑. 지역 채팅, 안전 정보 |
| **📊 통계 캘린더** | 과거 날씨 아카이브, 월별 피크닉 점수 추이 |
| **🌐 4개 언어** | 한국어, English, 中文, 日本語 |

---

## 기술 스택

| 계층 | 기술 |
|------|------|
| **프레임워크** | Next.js 16 (App Router) |
| **언어** | TypeScript 6 (Strict) |
| **프론트엔드** | React 19, TailwindCSS 4, Framer Motion, Lucide Icons |
| **코드 에디터** | CodeMirror 6 (`@uiw/react-codemirror`) |
| **실시간 통신** | WebSocket (`ws` v8) |
| **데이터베이스** | TiDB / MySQL 8 (`mysql2/promise`) |
| **AI / LLM** | NanoGPT (주사용), FactChat / SAIT 3 Pro (예비) |
| **웹 검색** | Tavily API |
| **좌표 변환** | proj4 (WGS84 ↔ TM) |
| **인증** | scrypt (N=16384) + 페퍼, AES-256-GCM 필드 암호화 |
| **배포** | PM2 + Nginx 리버스 프록시 |

---

## 프로젝트 구조

```
Nadeulhae/
├── README.md
├── docs/                        # 문서
│   ├── ARCHITECTURE_UML.md      # 영문 UML 문서
│   ├── ARCHITECTURE_UML_KO.md   # 한글 UML 문서
│   ├── README_EN.md             # 영문 README
│   ├── README_JA.md             # 일본어 README
│   ├── README_ZH.md             # 중국어 README
│   └── ...
├── nadeulhae/
│   ├── server.ts                # 커스텀 HTTP + WebSocket 서버
│   ├── package.json
│   └── src/
│       ├── proxy.ts             # 속도 제한, 보안 헤더
│       ├── app/                 # App Router 페이지 + API 라우트
│       │   ├── page.tsx         # 홈 (날씨 히어로 + 점수)
│       │   ├── dashboard/       # AI 대시보드 챗
│       │   ├── lab/             # 어휘 암기 / AI챗 / 코드공유
│       │   ├── code-share/      # 실시간 협업 편집기
│       │   ├── jeonju/          # 전주 브리핑 + 채팅
│       │   └── api/             # 50+ REST API 엔드포인트
│       ├── components/          # 40+ React 컴포넌트
│       ├── context/             # AuthContext, LanguageContext
│       ├── lib/                 # 28개 모듈, 60+ 비즈니스 로직 파일
│       │   ├── auth/            # 인증 (10개 파일)
│       │   ├── chat/            # AI 챗 (7개 파일)
│       │   ├── lab/             # FSRS 간격 반복 (7개 파일)
│       │   ├── websocket/       # WS 서버/클라이언트 (3개 파일)
│       │   ├── security/        # AES-256-GCM 암호화
│       │   └── ...
│       ├── data/                # 번역 파일, 목업 데이터
│       └── services/            # 프론트엔드 API 서비스 레이어
└── scripts/                     # DB 부트스트랩, 테스트 스크립트
```

---

## 빠른 시작

```bash
cd nadeulhae
cp .env.example .env.local    # 환경 변수 설정
npm install
npm run dev                   # http://localhost:3000
```

필요한 환경 변수는 `.env.example` 파일을 참고하세요.

---

## 배포

```bash
cd nadeulhae
npm run build
NODE_ENV=production pm2 start npm --name nadeulhae -- run start
```

Nginx 리버스 프록시 설정과 Ubuntu 서버 배포 가이드는 [docs/ubuntu-server-deploy-auth.md](docs/ubuntu-server-deploy-auth.md)를 참고하세요.

---

## 문서

| 문서 | 설명 |
|------|------|
| [📘 ARCHITECTURE_UML.md](docs/ARCHITECTURE_UML.md) | 아키텍처 및 UML 다이어그램 (English) |
| [📘 ARCHITECTURE_UML_KO.md](docs/ARCHITECTURE_UML_KO.md) | 아키텍처 및 UML 다이어그램 (한국어) |
| [📗 README_EN.md](docs/README_EN.md) | README in English |
| [📗 README_JA.md](docs/README_JA.md) | 日本語のREADME |
| [📗 README_ZH.md](docs/README_ZH.md) | 中文 README |
| [📙 ubuntu-server-deploy-auth.md](docs/ubuntu-server-deploy-auth.md) | Ubuntu 서버 배포 가이드 |
| [📙 CODE_REVIEW_REPORT.md](docs/CODE_REVIEW_REPORT.md) | 코드 리뷰 리포트 |

---

## 기여자

| 이름 | 역할 | 소속 |
|------|------|------|
| **김현민** | 프론트엔드, 백엔드, UI/UX 디자인, 서버 구축, DB 설계, 실시간 API 연동 | 전북대학교 소프트웨어공학과 24학번 |
| **김은수** | 공공 API와 위치 데이터 수집 및 데이터베이스 적재 | 전북대학교 소프트웨어공학과 24학번 |
| **이재혁** | 실시간 날씨 데이터 파이프라인 구축 및 DB 연동 | 전북대학교 소프트웨어공학과 24학번 |

---

## 라이선스

MIT License

Copyright (c) 2025 Nadeulhae

본 소프트웨어의 사용, 복사, 수정, 병합, 출판, 배포, 서브라이선스, 판매를 제한 없이 허용합니다. 단, 모든 복사본에 위 저작권 표시와 본 허가 문구를 포함해야 합니다.

본 소프트웨어는 "있는 그대로" 제공되며, 상품성이나 특정 목적에의 적합성에 대한 보증을 포함한 어떠한 명시적 또는 묵시적 보증도 하지 않습니다.

---

> 📧 문의: [kim0040@jbnu.ac.kr](mailto:kim0040@jbnu.ac.kr)
