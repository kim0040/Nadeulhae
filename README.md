# 나들해 (Nadeulhae)

공공 기상/환경 데이터를 기반으로 현재 위치의 나들이 적합도를 계산하고, 브리핑/예보/기상 이미지를 제공하는 Next.js 애플리케이션입니다.

## 1. 프로젝트 개요

이 저장소는 다음 두 레이어로 구성됩니다.

- 웹 앱: `/nadeulhae` (Next.js App Router)
- 문서/데이터: 루트의 `api_data_list.md`, 기획 문서들

핵심 사용자 흐름은 다음과 같습니다.

1. 사용자 위치(허용 시) 또는 기본 위치(전주)로 날씨 요청
2. 서버 API(`/api/weather/current`)가 외부 API를 호출하고 캐시/검증/점수 계산 수행
3. 메인 페이지에서 브리핑 + 기상 이미지 + 다국어 메시지 렌더링
4. 캘린더 페이지에서 단기/중기 예보를 합성해 10일 예보 제공

## 2. 기술 스택

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS v4
- Framer Motion
- Lucide Icons
- `proj4` (WGS84 → TM 좌표 변환)
- `next-themes` (라이트/다크 모드)

## 3. 주요 기능

### 3.1 피크닉 지수 계산 (Knock-out + 가중치)

`/api/weather/current`에서 점수를 계산합니다.

- 즉시 탈락(Knock-out)
  - 지진/기상특보/지진해일/화산 활성 시: `0점`
  - 현재 강수(PTY>0 또는 RN1>0) 시: `10점`
- 일반 계산(100점 만점)
  - 대기질(KHAI 등급): 40점
  - 기온(T1H): 30점
  - 하늘(SKY): 20점
  - 풍속(WSD): 10점

### 3.2 위치 기반 관측소 매핑

- 위치 허용 시 위경도 → TM 좌표 변환 후 인근 측정소 조회
- 인근 측정소 결과를 캐시하여 같은 좌표권 재요청 비용 최소화
- 위치 미허용 시 기본 프로필(전주) 사용

### 3.3 위험 이벤트 감시

다음 이벤트를 병합 판단합니다.

- 기상특보
- 지진
- 지진해일
- 화산
- 강수

이벤트 상태에 따라 메인 경고 UI, 브리핑 문구, 이미지 패널 상태 배지가 동적으로 바뀝니다.

### 3.4 기상 이미지 패널

`/api/weather/images`에서 이미지 URL을 수집합니다.

- 기본: 레이더(합성영상 우선) + GK2A 위성
- 조건부 extras:
  - `dust` (황사/에어로졸)
  - `lgt` (낙뢰)
- 실제 접근 가능한 이미지 URL만 선택(HEAD 검사)

### 3.5 다국어 및 랜덤 메시지

- 한국어/영어 전환 (`LanguageContext`)
- 점수/지역 조건 기반 메시지 풀에서 랜덤 문구 선택

## 4. 실행 방법

루트가 아닌 앱 디렉토리에서 실행합니다.

```bash
cd nadeulhae
npm install
npm run dev
```

기본 개발 URL: `http://localhost:3000`

빌드/검증:

```bash
npm run lint
npm run build
npm run start
```

## 5. 환경 변수

`/nadeulhae/.env.local`에 설정합니다.

### 필수

```env
KMA_API_KEY=...
AIRKOREA_API_KEY=...
```

### 선택

```env
NEXT_PUBLIC_API_URL=/api/weather
NEXT_PUBLIC_MOCK_MODE=false
KMA_NX=63
KMA_NY=89
AIRKOREA_STATION_NAME=송천동
AIRKOREA_DAILY_LIMIT=500
```

설명:

- `KMA_API_KEY`: 기상청(API Hub 포함) 호출 키
- `AIRKOREA_API_KEY`: AirKorea/data.go.kr 호출 키
- `KMA_NX`, `KMA_NY`: 위치 미허용 시 기본 격자
- `AIRKOREA_DAILY_LIMIT`: 일일 대기 API 소비 상한(기본 500)
- `NEXT_PUBLIC_MOCK_MODE=true`: 프론트 서비스 레이어에서 목업 데이터 우선

## 6. 내부 API 명세

### `GET /api/weather/current`

- Query: `lat`, `lon` (옵션)
- 역할:
  - 실황/초단기예보 + 대기질 + UV + 통보/특보 + 지진/지진해일/화산 통합
  - 점수 계산
  - 브리핑용 메타데이터 생성
- 주요 응답 필드:
  - `score`, `status`, `message`
  - `eventData.*` (위험 플래그)
  - `details.*` (기온/습도/풍속/대기질 등)
  - `metadata.scoreBreakdown`, `metadata.alertSummary`, `metadata.locationContext`

### `GET /api/weather/forecast`

- Query: `lat`, `lon` (옵션)
- 역할:
  - 단기(`VilageFcst`) + 중기(`MidFcst`)를 합성하여 10일 예보 구성
- 주요 필드:
  - `daily[].date/tempMin/tempMax/sky/precipChance/precipAmount/snowAmount/score`

### `GET /api/weather/images`

- Query: `extras=dust,lgt` (옵션)
- 역할:
  - 레이더/위성 이미지 + 조건부 extras 반환

### 목업 API (DB/백엔드 연동 전)

- `GET /api/weather/insights`
- `GET /api/weather/trends`
- `POST /api/weather/recommendations/generate`
- `GET /api/weather/archives`

위 4개는 현재 `mockData` 기반입니다.

## 7. 캐시 및 호출 제어 정책

현재는 인메모리 캐시(Map) 기반입니다.

### `/api/weather/current`

- 사용자 응답 캐시: 5분 (세션/위치/격자 기반)
- 실황 공용 캐시: `nx,ny + baseDate/baseTime` 기반 공유 캐시
- 대기질: 60분
- UV: 60분
- 통보/특보/지진/지진해일/화산: 15분
- 인근측정소 매핑: 24시간
- 레이트리밋: IP 기준 1분 60회

### `/api/weather/forecast`

- 사용자 응답 캐시: 5분
- 단기예보 캐시: 3시간(스마트 만료)
- 중기예보 캐시: 12시간(스마트 만료)
- 레이트리밋: IP 기준 1분 30회

### `/api/weather/images`

- 레이더: 5분
- 위성: 2분
- extras: `dust` 10분, `lgt` 5분

## 8. 외부 데이터 소스

- 기상청 API Hub / 기상청 OpenAPI
  - 초단기실황/예보, 단기/중기 예보, 지진해일, 화산
- AirKorea / data.go.kr
  - 실시간 대기질, 인근 측정소, UV, 기상통보/특보, 지진
- weather.go.kr 이미지 REST
  - 레이더/위성/황사/낙뢰 이미지

## 9. 디렉토리 구조

```text
Nadeulhae/
├─ README.md
├─ api_data_list.md
└─ nadeulhae/
   ├─ src/
   │  ├─ app/
   │  │  ├─ page.tsx
   │  │  ├─ about/page.tsx
   │  │  ├─ statistics/calendar/page.tsx
   │  │  └─ api/weather/*/route.ts
   │  ├─ components/
   │  │  ├─ picnic-briefing.tsx
   │  │  ├─ picnic-calendar.tsx
   │  │  ├─ weather-image-panel.tsx
   │  │  └─ magicui/*
   │  ├─ context/LanguageContext.tsx
   │  ├─ lib/weather-utils.ts
   │  ├─ lib/coords-utils.ts
   │  └─ services/dataService.ts
   ├─ package.json
   └─ .env.local
```

## 10. 현재 상태와 확장 포인트

- 구현 완료:
  - 실시간/예보/이벤트 감시/이미지 패널/다국어/캐시/레이트리밋
- 미구현(목업):
  - 로그인/회원 기능 백엔드
  - 추천 코스 생성 LLM 실제 연동
  - 아카이브/인사이트/트렌드 DB 연동

## 11. 운영 시 주의사항

- 현재 캐시는 서버 프로세스 메모리 기반입니다.
  - 멀티 인스턴스/서버리스 환경에서는 캐시 일관성이 보장되지 않습니다.
  - 운영에서는 Redis 같은 외부 캐시 계층을 권장합니다.
- 본 서비스 정보는 참고용이며, 재난 대응은 반드시 공식 기관 안내를 우선해야 합니다.
