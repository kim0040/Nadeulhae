# Nadeulhae

나들해는 공공 기상·환경 데이터를 바탕으로 현재 위치 또는 기본 지역의 야외 활동 적합도를 계산하고, 브리핑, 예보 캘린더, 기상 이미지를 함께 보여주는 Next.js 기반 웹 애플리케이션입니다.  
현재는 실시간 판단과 예보 중심 기능이 동작하며, 로그인/회원, 장소 DB, 장기 아카이브 같은 기능은 추후 서버 및 DB와 연결될 예정입니다.

## 프로젝트 구성

이 저장소는 두 층으로 나뉩니다.

- 웹 애플리케이션: [`/Users/gimhyeonmin/test/Nadeulhae/nadeulhae`](/Users/gimhyeonmin/test/Nadeulhae/nadeulhae)
- 문서 및 참고 자료: 저장소 루트의 `api_data_list.md`, 기획 문서들

실제 실행과 개발은 모두 [`/Users/gimhyeonmin/test/Nadeulhae/nadeulhae`](/Users/gimhyeonmin/test/Nadeulhae/nadeulhae) 디렉토리에서 이뤄집니다.

## 무엇을 하는 서비스인가

나들해는 단순히 현재 날씨를 보여주는 앱이 아니라, 여러 실시간 데이터를 한데 묶어 "지금 밖에 나가기 괜찮은지"를 빠르게 판단해 주는 서비스입니다.

- 현재 위치 또는 기본 위치(전주) 기준으로 날씨 데이터를 수집합니다.
- 실황, 예보, 대기질, 통보문, 특보, 지진/지진해일/화산 정보를 종합합니다.
- 규칙 기반 피크닉 지수를 계산합니다.
- 결과를 한글/영문 브리핑, 캘린더, 기상 이미지 패널로 시각화합니다.

## 현재 구현된 주요 기능

### 1. 위치 기반 실시간 피크닉 지수

메인 페이지는 브라우저 위치 권한이 허용되면 현재 좌표를 사용하고, 거부되면 전주 기본 프로필로 동작합니다.

- 실시간 기온, 습도, 풍속, 풍향, 강수량
- 미세먼지, 초미세먼지, 오존, 이산화질소, 통합대기지수(KHAI)
- 체감 온도 계산
- 인근 측정소 연결
- 지역별 통보문/특보문 반영

### 2. Knock-out 기반 피크닉 점수 계산

피크닉 지수는 [`/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/app/api/weather/current/route.ts`](/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/app/api/weather/current/route.ts)에서 계산합니다.

- 기상특보, 지진, 지진해일, 화산 정보가 활성 상태면 즉시 `0점`
- 현재 강수가 감지되면 즉시 `10점`
- 일반 상황에서는 아래 항목을 합산
  - 대기질: 최대 40점
  - 기온: 최대 30점
  - 하늘상태: 최대 20점
  - 풍속: 최대 10점

### 3. 오늘의 나들이 브리핑

브리핑 패널은 단순 숫자 나열이 아니라 실제 상황을 읽기 쉽게 재구성합니다.

- 지역 및 측정소 정보
- 위험 상태 요약
- 공식 통보문 정리
- 점수 해석 문장
- 실시간 수치 그리드
- KMA/AirKorea 동기화 시각 및 출처

### 4. 예보 캘린더

캘린더 페이지와 전주 전용 페이지에서 예보 카드를 확인할 수 있습니다.

- 단기예보 + 중기예보를 합성한 10일 예보
- 날짜별 점수, 강수확률, 예상 강수량, 야외 팁
- 추천일 강조 표시

### 5. 피크닉 아카이브 뷰

현재 아카이브 UI는 월 단위 달력으로 추천일 패턴을 보여줍니다.

- 반짝 아이콘 날짜는 피크닉 점수 80점 이상 추천일
- 현재는 예보 데이터를 월 단위로 재구성해 미리보기 형태로 동작
- 장기 과거 데이터 저장소(DB)와 직접 연결하는 구조는 아직 포함되지 않음

### 6. 기상 이미지 패널

[`/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/app/api/weather/images/route.ts`](/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/app/api/weather/images/route.ts)에서 KMA 이미지 REST를 사용합니다.

- 기본: 레이더, 위성
- 조건부: 황사(dust), 낙뢰(lgt)
- 실제 접근 가능한 최신 이미지 URL만 선택

### 7. 전주 특화 페이지

[`/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/app/jeonju/page.tsx`](/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/app/jeonju/page.tsx)는 전주 기준으로 고정된 경험을 제공합니다.

- 전주 기준 브리핑
- 전주 기준 예보 캘린더
- 전주 특화 기능 로드맵
- 전주 명소 마키 섹션

### 8. 한글/영문 지원

[`/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/context/LanguageContext.tsx`](/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/context/LanguageContext.tsx)에서 UI 텍스트를 관리합니다.

- 한국어/영어 전환
- 점수/상황 기반 랜덤 문구 지원
- 지역별 문맥 문구 지원

## 페이지 구성

- `/`
  메인 실시간 피크닉 판단 페이지
- `/about`
  서비스 소개 및 구조 설명
- `/statistics/calendar`
  예보 캘린더 + 아카이브 뷰
- `/jeonju`
  전주 전용 페이지
- `/login`
  로그인 UI 플레이스홀더
- `/signup`
  회원가입 UI 플레이스홀더

## 내부 API 구성

### `GET /api/weather/current`

역할:

- 초단기실황 + 초단기예보 + 대기질 + UV + 통보/특보 + 지진/지진해일/화산 통합
- 위치/관측소/권역 매핑
- 피크닉 점수 계산
- 브리핑용 응답 생성

주요 응답:

- `score`, `status`, `message`
- `eventData`
- `details`
- `metadata.scoreBreakdown`
- `metadata.alertSummary`
- `metadata.locationContext`

### `GET /api/weather/forecast`

역할:

- 단기예보(`VilageFcst`)와 중기예보(`MidFcst`)를 합성
- 오늘부터 10일 예보 구성

주요 응답:

- `daily[].date`
- `daily[].tempMin`
- `daily[].tempMax`
- `daily[].sky`
- `daily[].precipChance`
- `daily[].precipAmount`
- `daily[].score`

### `GET /api/weather/images`

역할:

- 레이더, 위성, 조건부 추가 이미지 반환

주요 응답:

- `radar`
- `satellite`
- `extras.dust`
- `extras.lgt`

### `GET /api/weather/archives`

역할:

- 월 단위 추천일 하이라이트 구성
- 현재는 예보 기반 월 뷰 프리뷰 제공

### 목업 기반 API

다음 엔드포인트는 현재 프론트 데모/확장 포인트 성격이 강합니다.

- `GET /api/weather/insights`
- `GET /api/weather/trends`
- `POST /api/weather/recommendations/generate`

## 캐시와 호출 제어

현재 구현은 서버 메모리 기반 `Map` 캐시입니다.

### `current` API

- 사용자 응답 캐시: 5분
- 실황 공용 캐시: 격자 + 기준시각 기반
- 대기질: 60분
- UV: 60분
- 통보/특보/지진/지진해일/화산: 15분
- 인근 측정소 매핑: 24시간
- 레이트리밋: IP 기준 분당 60회

### `forecast` API

- 사용자 응답 캐시: 5분
- 단기예보 캐시: 3시간
- 중기예보 캐시: 12시간
- 레이트리밋: IP 기준 분당 30회

### `images` API

- 레이더: 5분
- 위성: 2분
- dust: 10분
- lgt: 5분

이 구조는 새로고침이 잦아도 외부 API 호출이 불필요하게 늘지 않도록 하기 위한 장치입니다.

## 외부 데이터 소스

- 기상청 API Hub
  - 초단기실황/예보
  - 단기예보
  - 중기예보
  - 지진해일
  - 화산 정보
- data.go.kr / AirKorea
  - 대기질
  - 인근 측정소
  - 생활기상지수(UV)
  - 기상 통보/특보
  - 지진 정보
- weather.go.kr 이미지 REST
  - 레이더
  - 위성
  - 황사
  - 낙뢰

## 기술 스택

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Framer Motion
- Lucide React
- next-themes
- date-fns
- proj4
- Magic UI 기반 커스텀 컴포넌트

## 로컬 실행

앱 디렉토리에서 실행합니다.

```bash
cd /Users/gimhyeonmin/test/Nadeulhae/nadeulhae
npm install
npm run dev
```

개발 서버 기본 주소:

```bash
http://localhost:3000
```

빌드/검증:

```bash
npm run build
npm run start
```

## 환경 변수

설정 파일:

- [`/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/.env.local`](/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/.env.local)

필수:

```env
KMA_API_KEY=...
AIRKOREA_API_KEY=...
```

선택:

```env
NEXT_PUBLIC_API_URL=/api/weather
NEXT_PUBLIC_MOCK_MODE=false
KMA_NX=63
KMA_NY=89
AIRKOREA_STATION_NAME=송천동
AIRKOREA_DAILY_LIMIT=500
```

설명:

- `KMA_API_KEY`
  기상청 API Hub 호출 키
- `AIRKOREA_API_KEY`
  AirKorea/data.go.kr 호출 키
- `KMA_NX`, `KMA_NY`
  위치 비허용 시 기본 격자
- `AIRKOREA_STATION_NAME`
  기본 측정소 이름
- `AIRKOREA_DAILY_LIMIT`
  일일 대기 API 사용 제한 상한
- `NEXT_PUBLIC_MOCK_MODE`
  클라이언트 서비스 레이어에서 목업 응답 사용 여부

## 보안 및 운영 메모

- 비밀키는 `NEXT_PUBLIC_` 접두사 없이 서버 라우트에서만 사용합니다.
- `.env*`는 gitignore 대상입니다.
- 현재 캐시는 프로세스 메모리 기반입니다.
- 멀티 인스턴스 운영이나 서버리스 환경으로 확장할 경우 Redis 같은 외부 캐시 계층이 적절합니다.
- 기상/재난 정보는 참고용 보조 정보이며, 실제 대응은 반드시 공식 기관 안내를 우선해야 합니다.

## 현재 상태

### 이미 동작하는 것

- 메인 실시간 피크닉 판단
- 브리핑 패널
- 기상 이미지 패널
- 예보 캘린더
- 전주 특화 페이지
- 한글/영문 UI
- 위치 기반 지역/측정소 매핑
- 캐시/레이트리밋

### 아직 서버·DB가 직접 연결되지 않은 영역

- 로그인/회원 인증
- 장소 데이터베이스
- 과거 장기 아카이브
- AI 반나절 코스 실제 생성 백엔드

## 디렉토리 구조

```text
Nadeulhae/
├─ README.md
├─ api_data_list.md
├─ 나들해 계획서.md
├─ 나들해 UIUX 및 컴포넌트 설계서.md
└─ nadeulhae/
   ├─ package.json
   ├─ src/
   │  ├─ app/
   │  │  ├─ page.tsx
   │  │  ├─ about/page.tsx
   │  │  ├─ jeonju/page.tsx
   │  │  ├─ login/page.tsx
   │  │  ├─ signup/page.tsx
   │  │  ├─ statistics/calendar/page.tsx
   │  │  └─ api/weather/*/route.ts
   │  ├─ components/
   │  │  ├─ navbar.tsx
   │  │  ├─ picnic-briefing.tsx
   │  │  ├─ picnic-calendar.tsx
   │  │  ├─ picnic-archive-calendar.tsx
   │  │  ├─ weather-image-panel.tsx
   │  │  └─ magicui/*
   │  ├─ context/
   │  │  └─ LanguageContext.tsx
   │  ├─ data/
   │  │  └─ mockData.ts
   │  ├─ lib/
   │  │  ├─ coords-utils.ts
   │  │  ├─ request-session.ts
   │  │  └─ weather-utils.ts
   │  └─ services/
   │     └─ dataService.ts
   └─ public/
```
