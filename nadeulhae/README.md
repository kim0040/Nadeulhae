# 나들해 (Nadeulhae)

**AI 기반 날씨 분석 및 영어 학습 플랫폼**

나들해는 실시간 날씨 데이터 분석, AI 채팅, 그리고 영어 단어 학습 기능을 통합한 웹 애플리케이션입니다. 사용자의 지역 기반 맞춤형 날씨 정보를 제공하고, AI 와의 자연스러운 대화를 통해 영어 학습을 지원합니다.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.2.4-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.2.4-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178c6?logo=typescript)
![MySQL](https://img.shields.io/badge/Database-MySQL%2F TiDB-4479a1?logo=mysql)

---

## 📑 목차

- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [아키텍처](#-아키텍처)
- [프로젝트 구조](#-프로젝트-구조)
- [시작하기](#-시작하기)
- [환경 변수 설정](#-환경-변수-설정)
- [API 엔드포인트](#-api-엔드포인트)
- [데이터베이스 스키마](#-데이터베이스-스키마)
- [보안 가이드](#-보안-가이드)
- [성능 최적화](#-성능-최적화)
- [테스트](#-테스트)
- [배포 가이드](#-배포-가이드)
- [트러블슈팅](#-트러블슈팅)
- [기여 가이드](#-기여-가이드)
- [라이선스](#-라이선스)

---

## 🎯 주요 기능

### 1. **실시간 날씨 분석**
- **초단기 예보**: 기상청 API 를 통한 45 분 단위 업데이트
- **대기질 정보**: 미세먼지 (PM10/PM2.5), 오존, 이산화질소 등 실시간 측정
- **악기상 경보**: 지진, 쓰나미, 화산, 태풍 등 재난 상황 실시간 알림
- **날씨 점수**: 공기질, 온도, 하늘 상태, 풍속을 기반으로 한 종합 점수 (0-100)
- **체감 온도**: 한국형·WHO 기준 체감온도 및 불쾌지수 계산

### 2. **AI 채팅 (FactChat)**
- **맥락 인식 대화**: 사용자 프로필과 날씨 정보를 활용한 맞춤 응답
- **멀티 세션 관리**: 병렬 채팅 지원 (동일 사용자 락킹 방지)
- **사용량 추적**: 일일/월간 AI 요청 횟수 제한 및 과금 추적
- **코드 공유**: 실시간 협업 코딩 세션 (WebSocket 기반)

### 3. **실험실 (Lab) - 영어 학습**
- **AI 단어 생성**: 주제 기반 맞춤형 영어 단어 카드 자동 생성
- **간격 반복 학습**: 과학적 기억 곡선 기반 학습 스케줄링
- **배치 리뷰**: 효율적인 복습을 위한 일괄 평가 시스템
- **내보내기/가져오기**: Anki 호환 형식 지원

### 4. **전주 특화 서비스**
- **전주 날씨 챗봇**: 전주 지역 정보에 특화된 AI 어시스턴트
- **관광 정보**: 전주 관광지, 음식점, 문화행사 연계

### 5. **통계 및 분석**
- **사용자 활동 대시보드**: 학습 진행률, 채팅 기록 시각화
- **캘린더 뷰**: 월간 활동 히트맵

---

## 🛠 기술 스택

### Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| **Next.js** | 16.2.4 | React 프레임워크 (App Router) |
| **React** | 19.2.4 | UI 라이브러리 |
| **TypeScript** | Strict | 타입 안전성 |
| **Tailwind CSS** | ^4.0.0 | 유틸리티 퍼스트 CSS |
| **Magic UI** | Latest | 재사용 가능한 UI 컴포넌트 |
| **Framer Motion** | ^12.0.0 | 애니메이션 |

### Backend
| 기술 | 버전 | 용도 |
|------|------|------|
| **Node.js** | 18+ | 런타임 |
| **Next.js API Routes** | - | RESTful API |
| **WebSocket** | ws ^8.20.0 | 실시간 양방향 통신 |
| **mysql2** | ^3.20.0 | 데이터베이스 드라이버 |

### Database
| 기술 | 버전 | 용도 |
|------|------|------|
| **TiDB Cloud** | - | 분산 MySQL 호환 DB |
| **Connection Pooling** | - | 효율적인 연결 관리 |
| **SSL/TLS** | TLS 1.2+ | 암호화된 연결 |

### AI/ML
| 기술 | 용도 |
|------|------|
| **FactChat (SAIT 3 Pro)** | 메인 LLM 모델 |
| **Solar-pro3** | 폴백 모델 |
| **프롬프트 엔지니어링** | 한국어/영어 이중 처리 |

### 외부 API
| API | 용도 |
|-----|------|
| **기상청 OpenAPI** | 초단기 예보, 중기 예보, 특보 |
| **AirKorea API** | 대기질 측정망 데이터 |
| **KMA ApiHub** | 지진, 쓰나미, 화산 정보 |

### 인프라
| 기술 | 용도 |
|------|------|
| **Ubuntu Server** | 프로덕션 서버 |
| **PM2 / systemd** | 프로세스 관리 |
| **Nginx** | 리버스 프록시 (선택) |
| **Let's Encrypt** | SSL 인증서 |

---

## 🏗 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Web UI  │  │  Mobile  │  │  Admin   │  │   API    │   │
│  │ (React)  │  │   PWA    │  │ Dashboard│  │  Client  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                      │
│                   Next.js App Router                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  Middleware                          │  │
│  │  • Authentication  • Rate Limiting  • Logging        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │   Pages    │  │   Layout   │  │  Loading   │           │
│  │  (SSR/SSG) │  │  (Nested)  │  │   States   │           │
│  └────────────┘  └────────────┘  └────────────┘           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                            │
│               Next.js API Routes (/api/*)                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   /auth/*   │ │  /chat/*    │ │ /weather/*  │          │
│  │  /lab/*     │ │ /code-share │ │ /analytics  │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Auth Service │  │ Chat Service │  │Weather Service│    │
│  │  • Login     │  │  • FactChat  │  │  • KMA API    │    │
│  │  • Session   │  │  • Context   │  │  • AirKorea   │    │
│  │  • RateLimit │  │  • Memory    │  │  • Caching    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │  Lab Service │  │ WebSocket    │                        │
│  │  • Cards     │  │  • Broadcast │                        │
│  │  • Review    │  │  • Rooms     │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Data Access Layer                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                Repository Pattern                   │   │
│  │  • auth/repository.ts   • chat/repository.ts       │   │
│  │  • lab/repository.ts    • weather/repository.ts    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              TiDB Cloud (MySQL Compatible)          │   │
│  │  • users            • user_sessions                 │   │
│  │  • user_chat_*      • lab_decks / lab_cards         │   │
│  │  • forecast_points  • auth_security_events          │   │
│  │  └─ SSL Encrypted Connection (TLS 1.2+)             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 데이터 흐름

#### 1. **사용자 인증 플로우**
```
Client → /api/auth/login → Rate Limit Check → Password Hash Verify
                                            ↓
    ← Session Cookie ← DB Insert Session ← Create Token
```

#### 2. **날씨 데이터 플로우**
```
Client → /api/weather/current → Cache Check → KMA/AirKorea API
                                               ↓
    ← JSON Response ← Score Calculation ← Parse & Validate
```

#### 3. **실시간 채팅 플로우**
```
Client → WebSocket /ws → Auth Verify → Join Room → Message Broadcast
                              ↓
                         DB Logging ← Context Memory Update
```

---

## 📁 프로젝트 구조

```
nadeulhae/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # 인증 관련 페이지 그룹
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── api/                      # API 엔드포인트
│   │   │   ├── auth/                 # 인증 API
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── register/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── me/route.ts
│   │   │   ├── chat/                 # AI 채팅 API
│   │   │   ├── weather/              # 날씨 API
│   │   │   │   ├── current/route.ts
│   │   │   │   ├── forecast/route.ts
│   │   │   │   └── archives/route.ts
│   │   │   ├── lab/                  # 실험실 API
│   │   │   │   ├── generate/route.ts
│   │   │   │   ├── review/route.ts
│   │   │   │   └── decks/route.ts
│   │   │   └── code-share/           # 코드 공유 API
│   │   ├── dashboard/                # 대시보드 페이지
│   │   ├── lab/                      # 실험실 UI
│   │   ├── account/                  # 계정 설정
│   │   ├── layout.tsx                # 루트 레이아웃
│   │   └── page.tsx                  # 홈 페이지
│   │
│   ├── components/                   # React 컴포넌트
│   │   ├── ui/                       # 재사용 가능한 UI
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── dialog.tsx
│   │   ├── weather/                  # 날씨 관련 컴포넌트
│   │   │   ├── current-display.tsx
│   │   │   ├── forecast-panel.tsx
│   │   │   └── alert-banner.tsx
│   │   ├── chat/                     # 채팅 컴포넌트
│   │   │   ├── chat-window.tsx
│   │   │   └── message-bubble.tsx
│   │   └── lab/                      # 실험실 컴포넌트
│   │       ├── card-generator.tsx
│   │       └── review-session.tsx
│   │
│   ├── lib/                          # 비즈니스 로직
│   │   ├── auth/                     # 인증 모듈
│   │   │   ├── repository.ts         # DB 연동
│   │   │   ├── session.ts            # 세션 관리
│   │   │   ├── guardrails.ts         # 속도 제한
│   │   │   └── schema.ts             # DB 스키마
│   │   ├── chat/                     # 채팅 모듈
│   │   │   ├── factchat.ts           # LLM 연동
│   │   │   ├── repository.ts         # 메시지 저장
│   │   │   └── memory.ts             # 컨텍스트 메모리
│   │   ├── weather/                  # 날씨 모듈
│   │   │   ├── kma-api.ts            # 기상청 API
│   │   │   ├── air-quality.ts        # 대기질 API
│   │   │   └── utils.ts              # 유틸리티
│   │   ├── lab/                      # 실험실 모듈
│   │   │   ├── constants.ts          # 상수 정의
│   │   │   ├── prompt.ts             # 프롬프트 템플릿
│   │   │   └── scheduler.ts          # 학습 스케줄링
│   │   ├── websocket/                # WebSocket 모듈
│   │   │   ├── server.ts             # 서버 설정
│   │   │   └── broadcast.ts          # 브로드캐스트
│   │   ├── security/                 # 보안 모듈
│   │   │   ├── data-protection.ts    # 암호화
│   │   │   └── rate-limit.ts         # 속도 제한
│   │   ├── db.ts                     # 데이터베이스 풀
│   │   └── utils.ts                  # 공통 유틸리티
│   │
│   ├── context/                      # React Context
│   │   ├── AuthContext.tsx           # 인증 상태
│   │   └── WebSocketContext.tsx      # WebSocket 연결
│   │
│   ├── hooks/                        # 커스텀 훅
│   │   ├── use-auth.ts               # 인증 훅
│   │   ├── use-websocket.ts          # WebSocket 훅
│   │   └── use-weather.ts            # 날씨 훅
│   │
│   └── types/                        # TypeScript 타입
│       ├── auth.ts
│       ├── weather.ts
│       └── api.ts
│
├── public/                           # 정적 파일
│   ├── images/
│   └── icons/
│
├── scripts/                          # 유틸리티 스크립트
│   ├── test-auth-flows.mjs
│   ├── test-chat-flow.mjs
│   └── test-lab-features.mjs
│
├── server.ts                         # 커스텀 서버 (WebSocket)
├── next.config.ts                    # Next.js 설정
├── tsconfig.json                     # TypeScript 설정
├── tailwind.config.ts                # Tailwind 설정
├── package.json                      # 종속성 정의
└── .env.example                      # 환경 변수 템플릿
```

---

## 🚀 시작하기

### 시스템 요구사항
- **Node.js**: 18.x 이상
- **npm**: 9.x 이상
- **데이터베이스**: MySQL 8.0+ 또는 TiDB Cloud
- **운영체제**: Linux (Ubuntu 20.04+ 권장), macOS, Windows

### 설치 단계

#### 1. **저장소 클론**
```bash
git clone https://github.com/your-org/nadeulhae.git
cd nadeulhae/nadeulhae
```

#### 2. **종속성 설치**
```bash
npm install
```

#### 3. **환경 변수 설정**
```bash
cp .env.example .env.local
```

`.env.local` 파일을 열어 아래 [환경 변수 설정](#-환경-변수-설정) 섹션을 참고하여 값을 입력합니다.

#### 4. **데이터베이스 설정**
```sql
-- TiDB Cloud 또는 MySQL 에서 실행
CREATE DATABASE nadeulhae CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### 5. **개발 서버 시작**
```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 으로 접속합니다.

#### 6. **프로덕션 빌드**
```bash
npm run build
npm run start
```

---

## ⚙️ 환경 변수 설정

### 필수 환경 변수

#### 데이터베이스
```bash
DB_HOST=your-tidb-host.tidbcloud.com
DB_PORT=4000
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=nadeulhae
DB_CA_PATH=/etc/ssl/certs/ca-certificates.crt
DB_POOL_LIMIT=10
```

#### 외부 API 키
```bash
KMA_API_KEY=your_kma_api_key
AIRKOREA_API_KEY=your_airkorea_api_key
APIHUB_KEY=your_apihub_key
FACTCHAT_API_KEY=your_factchat_api_key
```

#### 인증 및 보안
```bash
AUTH_PEPPER=32_byte_random_secret_1
DATA_PROTECTION_KEY=32_byte_random_secret_2
AUTH_SESSION_DAYS=30
AUTH_COOKIE_NAME=nadeulhae_auth
ALWAYS_SECURE_COOKIES=true
APP_BASE_URL=https://your-domain.com
```

#### AI 설정
```bash
FACTCHAT_BASE_URL=https://factchat-cloud.mindlogic.ai/v1/gateway
FACTCHAT_MODEL=SAIT 3 Pro
FACTCHAT_FALLBACK_MODEL=solar-pro3
```

#### 옵션 환경 변수
```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
TRUST_PROXY_HEADERS=true
AIRKOREA_DAILY_LIMIT=500
```

### 🔐 보안 키 생성 방법

```bash
# OpenSSL 을 사용한 랜덤 시크릿 생성
openssl rand -base64 32  # AUTH_PEPPER 용
openssl rand -base64 32  # DATA_PROTECTION_KEY 용
```

---

## 🌐 API 엔드포인트

### 인증 API

#### `POST /api/auth/register`
회원가입

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!",
  "displayName": "홍길동",
  "nickname": "길동",
  "ageBand": "20s",
  "primaryRegion": "jeonju"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "홍길동"
  }
}
```

#### `POST /api/auth/login`
로그인

**Response:**
- 성공: `Set-Cookie: nadeulhae_auth=<token>; HttpOnly; Secure; Path=/`
- 실패: `{ "error": "Invalid credentials" }` (401)

#### `POST /api/auth/logout`
로그아웃

#### `GET /api/auth/me`
현재 사용자 정보 조회

---

### 채팅 API

#### `POST /api/chat`
메시지 전송 및 응답 생성

**Request Body:**
```json
{
  "message": "오늘 날씨 어때?",
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "message": {
    "id": "msg-uuid",
    "role": "assistant",
    "content": "전주의 현재 날씨는...",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "usage": {
    "dailyCount": 5,
    "monthlyCount": 50
  }
}
```

#### `GET /api/chat/sessions`
채팅 세션 목록 조회

---

### 날씨 API

#### `GET /api/weather/current?lat=35.82&lon=127.14`
현재 날씨 조회

**Query Parameters:**
- `lat`: 위도 (옵션, 기본값: 전주)
- `lon`: 경도 (옵션, 기본값: 전주)

**Response:**
```json
{
  "score": 85,
  "status": "status_good",
  "message": "msg_home_good",
  "details": {
    "temp": 22.5,
    "humidity": 45,
    "wind": 2.3,
    "pm10": 25,
    "pm25": 12,
    "uv": "보통"
  },
  "metadata": {
    "region": "전주시 덕진구",
    "lastUpdate": {
      "kma": "2024.01.01 14:00",
      "air": "2024.01.01 13:00"
    }
  }
}
```

#### `GET /api/weather/forecast`
중기 예보 조회

#### `GET /api/weather/archives`
과거 날씨 데이터 조회

---

### 실험실 (Lab) API

#### `POST /api/lab/generate`
단어 카드 생성

**Request Body:**
```json
{
  "topic": "기후 변화",
  "cardCount": 10
}
```

**Progress Events (WebSocket):**
```json
{
  "type": "lab_generate_progress",
  "payload": {
    "requestId": "uuid",
    "status": "round_started",
    "round": 1,
    "collectedCount": 0,
    "targetCount": 10
  }
}
```

#### `POST /api/lab/review`
학습 리뷰 제출

#### `GET /api/lab/decks`
단어 덱 목록 조회

---

### 코드 공유 API

#### `POST /api/code-share/sessions`
코드 공유 세션 생성

#### `GET /api/code-share/sessions/:sessionId`
세션 정보 조회

#### WebSocket Events
- `code_share_subscribe`: 세션 구독
- `code_share_unsubscribe`: 세션 해제
- `code_share_typing`: 타이밍 상태
- `code_share_saved`: 코드 저장 알림

---

## 🗄 데이터베이스 스키마

### 주요 테이블

#### `users` 테이블
```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARBINARY(255) NOT NULL,          -- 암호화됨
  email_hash VARBINARY(64) NOT NULL,       -- 블라인드 인덱스
  display_name VARBINARY(255) NOT NULL,    -- 암호화됨
  nickname VARBINARY(100) NOT NULL,        -- 암호화됨
  nickname_hash VARBINARY(64) NOT NULL,    -- 블라인드 인덱스
  nickname_tag CHAR(4) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  password_salt VARCHAR(64) NOT NULL,
  password_algo VARCHAR(32) NOT NULL,
  age_band VARBINARY(50),                  -- 암호화됨
  primary_region VARBINARY(100),           -- 암호화됨
  interest_tags VARBINARY(1024),           -- 암호화됨 (JSON)
  preferred_time_slot VARBINARY(50),       -- 암호화됨
  marketing_accepted TINYINT(1) DEFAULT 0,
  analytics_accepted TINYINT(1) DEFAULT 0,
  lab_enabled TINYINT(1) DEFAULT 0,
  terms_agreed_at DATETIME,
  privacy_agreed_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uniq_email_hash (email_hash),
  UNIQUE KEY uniq_nickname (nickname_hash, nickname_tag),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### `user_sessions` 테이블
```sql
CREATE TABLE user_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  user_agent VARBINARY(512),               -- 암호화됨
  ip_address VARBINARY(64),                -- 암호화됨
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_token_hash (token_hash),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### `user_chat_sessions` 테이블
```sql
CREATE TABLE user_chat_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255),
  model_requested VARCHAR(100),
  model_resolved VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_user_created (user_id, created_at),
  CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### `user_chat_messages` 테이블
```sql
CREATE TABLE user_chat_messages (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role ENUM('user', 'assistant', 'system') NOT NULL,
  content TEXT NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_session_created (session_id, created_at),
  CONSTRAINT fk_chat_session FOREIGN KEY (session_id) 
    REFERENCES user_chat_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### `lab_decks` 테이블
```sql
CREATE TABLE lab_decks (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  locale ENUM('ko', 'en') NOT NULL DEFAULT 'ko',
  title VARCHAR(255) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  model_requested VARCHAR(100),
  model_resolved VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_created (user_id, created_at),
  CONSTRAINT fk_lab_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### `lab_cards` 테이블
```sql
CREATE TABLE lab_cards (
  id VARCHAR(36) PRIMARY KEY,
  deck_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  term VARCHAR(255) NOT NULL,
  meaning VARCHAR(512) NOT NULL,
  part_of_speech VARCHAR(100),
  example VARCHAR(512),
  example_translation VARCHAR(512),
  explanation VARCHAR(512),
  ease_factor DECIMAL(5,2) DEFAULT 2.5,
  interval_days INT DEFAULT 1,
  due_date DATE,
  status ENUM('new', 'learning', 'review', 'graduated') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  
  INDEX idx_deck (deck_id),
  INDEX idx_user_due (user_id, due_date),
  INDEX idx_status_due (status, due_date),
  CONSTRAINT fk_card_deck FOREIGN KEY (deck_id) REFERENCES lab_decks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### `auth_attempt_buckets` 테이블 (Rate Limiting)
```sql
CREATE TABLE auth_attempt_buckets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  scope_key VARCHAR(255) NOT NULL,
  attempt_count INT NOT NULL DEFAULT 1,
  window_started_at DATETIME NOT NULL,
  last_attempt_at DATETIME NOT NULL,
  blocked_until DATETIME,
  
  UNIQUE KEY uniq_action_scope (action, scope_key),
  INDEX idx_blocked (blocked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### `auth_security_events` 테이블
```sql
CREATE TABLE auth_security_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  outcome ENUM('success', 'failed', 'blocked', 'rejected') NOT NULL,
  user_id VARCHAR(36),
  email VARBINARY(255),                  -- 암호화됨
  email_hash VARBINARY(64),              -- 블라인드 인덱스
  ip_address VARBINARY(64),              -- 암호화됨
  user_agent VARBINARY(512),             -- 암호화됨
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_outcome (user_id, outcome),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 🔒 보안 가이드

### 구현된 보안 기능

#### 1. **데이터 암호화**
- **이메일/닉네임**: AES-256-GCM 암호화 저장
- **블라인드 인덱스**: HMAC-SHA256 기반 검색용 해시
- **세션 토큰**: SHA-256 해시化处理

```typescript
// src/lib/security/data-protection.ts
encryptDatabaseValue(email, "users.email")
createBlindIndex(email, "users.email")
```

#### 2. **Rate Limiting**
- **로그인**: IP 당 10 회/15 분, 이메일 당 5 회/15 분
- **회원가입**: IP 당 6 회/시간, 이메일 당 3 회/시간
- **자동 차단**: 제한 초과 시 15 분 잠금

#### 3. **세션 관리**
- **쿠키 플래그**: `HttpOnly`, `Secure`, `SameSite=Lax`
- **세션 만료**: 30 일 (72 시간 내 자동 갱신)
- **최대 세션**: 사용자 당 5 개 동시 세션 제한

#### 4. **SQL Injection 방어**
- 파라미터화된 쿼리 사용
- `scopeKeys` 최대 10 개 제한

#### 5. **XSS 방지**
- React 의 자동 이스케이프
- 보안 헤더 적용 (`X-XSS-Protection`, `Content-Security-Policy`)

#### 6. **보안 헤더**
```typescript
// next.config.ts
headers: [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
]
```

### 보안 체크리스트

- [ ] `.env.local` 파일을 Git 에 커밋하지 않음
- [ ] 모든 API 키를 환경 변수로 관리
- [ ] 프로덕션에서 `ALWAYS_SECURE_COOKIES=true` 설정
- [ ] 데이터베이스 SSL 연결 활성화
- [ ] 정기적인 의존성 업데이트 (`npm audit`)
- [ ] 방화벽 설정으로 DB 포트 차단

---

## ⚡ 성능 최적화

### 캐싱 전략

#### 1. **인메모리 캐시**
```typescript
// src/app/api/weather/current/route.ts
const WEATHER_CACHE_DURATION = 30 * 60 * 1000  // 30 분
const AIR_CACHE_DURATION = 30 * 60 * 1000      // 30 분
const ALERT_CACHE_DURATION = 5 * 60 * 1000     // 5 분

const MAX_CACHE_KEYS = 2000  // 캐시당 최대 키 수
```

#### 2. **스마트 캐싱**
- 다음 업데이트 시간을 고려한 캐시 무효화
- 중요도별 차등 TTL (경보 데이터는 5 분)

#### 3. **응답 캐싱**
- 사용자별 응답 3 분 캐싱 (동일 조건 재요청 방지)

### 데이터베이스 최적화

#### 1. **연결 풀 설정**
```typescript
// src/lib/db.ts
connectionLimit: isProduction ? 10 : 2
queueLimit: isProduction ? 0 : 100
enableKeepAlive: true
```

#### 2. **인덱스 최적화**
- `users.email_hash`: 로그인 검색
- `user_sessions.token_hash`: 세션 검증
- `lab_cards.due_date`: 학습 스케줄링

### 번들 최적화

#### 1. **코드 스플리팅**
```typescript
// dynamic import
const PicnicBriefing = dynamic(() => 
  import("@/components/picnic-briefing"), 
  { ssr: false }
)
```

#### 2. **이미지 최적화**
- Next.js `Image` 컴포넌트 사용
- WebP/AVIF 포맷 자동 협상

### WebSocket 최적화

#### 1. **하트비트**
- 30 초 간격 Ping/Pong
- 60 초 타임아웃 연결 종료

#### 2. **방 기반 브로드캐스트**
- 코드 공유 세션별 격리
- 불필요한 브로드캐스트 최소화

---

## 🧪 테스트

### 자동화 테스트

#### 1. **인증 플로우 테스트**
```bash
npm run test:auth
```

#### 2. **채팅 플로우 테스트**
```bash
npm run test:chat
```

#### 3. **실험실 기능 테스트**
```bash
npm run test:lab
```

#### 4. **코드 공유 실시간 테스트**
```bash
# 터미널 1
NODE_ENV=production PORT=3101 npm run start

# 터미널 2
npm run test:code-share
```

### 수동 테스트 체크리스트

#### 인증
- [ ] 회원가입 (정상/예외 케이스)
- [ ] 로그인/로그아웃
- [ ] 세션 유지 및 갱신
- [ ] Rate Limiting 동작 확인

#### 날씨
- [ ] 현재 날씨 조회
- [ ] 위치 기반 맞춤 정보
- [ ] 악기상 경보 알림
- [ ] 캐싱 동작 확인

#### 채팅
- [ ] 메시지 송수신
- [ ] 세션 관리
- [ ] 사용량 제한
- [ ] 컨텍스트 메모리

#### 실험실
- [ ] 단어 카드 생성
- [ ] progress 이벤트
- [ ] 리뷰 배치
- [ ] 내보내기/가져오기

---

## 🚀 배포 가이드

### Ubuntu 서버 배포

#### 1. **서버 설정**
```bash
# Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Git 설치
sudo apt-get install -y git
```

#### 2. **프로젝트 클론 및 설정**
```bash
git clone https://github.com/your-org/nadeulhae.git
cd nadeulhae/nadeulhae
npm install --production
```

#### 3. **환경 변수 설정**
```bash
nano .env.production
# 필요한 환경 변수 입력 후 저장
```

#### 4. **시스템드 서비스 등록**
```bash
sudo nano /etc/systemd/system/nadeulhae.service
```

```ini
[Unit]
Description=Nadeulhae Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/nadeulhae/nadeulhae
ExecStart=/usr/bin/node server.ts
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

#### 5. **서비스 시작**
```bash
sudo systemctl daemon-reload
sudo systemctl enable nadeulhae
sudo systemctl start nadeulhae
sudo systemctl status nadeulhae
```

#### 6. **Nginx 리버스 프록시 (선택)**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location /ws {
        proxy_pass http://localhost:3000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

#### 7. **SSL 인증서 설정 (Let's Encrypt)**
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 모니터링

#### 로그 확인
```bash
# 애플리케이션 로그
journalctl -u nadeulhae -f

# Nginx 로그
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

#### 성능 모니터링
- CPU/메모리 사용량: `htop`
- 디스크 사용량: `df -h`
- 네트워크: `netstat -tuln`

---

## 🔧 트러블슈팅

### 일반적인 문제 해결

#### 1. **빌드 실패**
```bash
# 캐시 삭제 후 재빌드
rm -rf .next node_modules
npm install
npm run build
```

#### 2. **데이터베이스 연결 오류**
```bash
# SSL 인증서 경로 확인
ls -la /etc/ssl/certs/ca-certificates.crt

# 방화벽 포트 확인
sudo ufw status | grep 4000

# 연결 테스트
mysql -h your-tidb-host -P 4000 -u your_user -p
```

#### 3. **WebSocket 연결 불가**
```bash
# 포트 확인
netstat -tulpn | grep 3000

# Nginx 설정 확인
sudo nginx -t
sudo systemctl reload nginx
```

#### 4. **API 키 오류**
```bash
# 환경 변수 확인
grep KMA_API_KEY .env.local

# API 한도 확인 (기상청)
# https://apihub.kma.go.kr/myinfo/status.jsp
```

#### 5. **메모리 누수 의심**
```bash
# 프로세스 메모리 확인
ps aux | grep node

# 힙 스냅샷 분석 (Chrome DevTools)
```

### 에러 코드 목록

| 에러 코드 | 의미 | 해결 방법 |
|-----------|------|-----------|
| 401 | 인증 실패 | 로그인 다시 시도 |
| 403 | 권한 없음 | Lab 활성화 확인 |
| 429 | Rate Limit | 15 분 후 재시도 |
| 500 | 서버 오류 | 로그 확인 (`journalctl`) |
| 502 | 게이트웨이 오류 | 외부 API 상태 확인 |
| 503 | 서비스 불가능 | DB 연결 확인 |

---

## 🤝 기여 가이드

### 개발 워크플로우

#### 1. **포크 및 클론**
```bash
git fork https://github.com/your-org/nadeulhae
git clone https://github.com/your-username/nadeulhae.git
cd nadeulhae
```

#### 2. **브랜치 생성**
```bash
git checkout -b feature/your-feature-name
```

#### 3. **개발 및 커밋**
```bash
# 변경 사항 확인
git status

# 스테이징
git add src/path/to/file.ts

# 커밋 (Conventional Commits 준수)
git commit -m "feat: add new weather alert system"
```

#### 4. **푸시 및 PR**
```bash
git push origin feature/your-feature-name
# GitHub 에서 Pull Request 생성
```

### 커밋 컨벤션

- `feat:` 새로운 기능
- `fix:` 버그 수정
- `docs:` 문서 수정
- `style:` 코드 포맷팅
- `refactor:` 리팩토링
- `test:` 테스트 추가
- `chore:` 빌드 설정 등

### 코드 리뷰 체크리스트

- [ ] TypeScript 타입 안전성 확인
- [ ] 에러 핸들링完备
- [ ] 보안 취약점 없음
- [ ] 성능 영향 최소화
- [ ] 테스트 코드 포함

---

## 📄 라이선스

MIT License

Copyright (c) 2024 Nadeulhae

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 📞 연락처 및 지원

- **이슈 트래커**: https://github.com/your-org/nadeulhae/issues
- **이메일**: support@nadeulhae.space
- **문서**: https://nadeulhae.space/docs

---

**마지막 업데이트**: 2024 년 1 월 17 일
