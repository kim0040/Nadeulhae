<div align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
</div>

<h1 align="center">🧺 나들해 (Nadeulhae)</h1>
<p align="center"><strong>기상/환경 데이터 기반 인공지능 피크닉 지수 분석 & 추천 서비스</strong></p>

---

## 📖 프로젝트 개요

**나들해**는 기상청 및 에어코리아의 실시간 공공 기상/대기오염 데이터를 종합하여, 당신이 있는 지역에서 **"지금 피크닉 가기 얼마나 좋은 날씨인지"**를 0점부터 100점의 고도화된 '피크닉 지수'로 환산해주는 스마트 플랫폼입니다.

복잡한 온도, 강수, 오존, 미세먼지 수치를 직접 파악할 필요 없이, 가장 직관적인 형태의 메시지와 UI로 완벽한 나들이 타이밍을 알려드립니다.

---

## ⚡ 주요 기능 (Key Features)

### 1. 🌡️ 고도화된 '피크닉 지수' 알고리즘 (Knock-out System 도입)
단순한 기온/점수 합산 방식이 아닌, **다단계 Knock-out(즉시 탈락) 기반 점수 시스템**을 구축했습니다.
- **🚨 1단계 우선 검증 조건(즉시 탈락 필터)**: 비/눈이 오거나, 지역에 **태풍·호우·지진해일 등 기상 특보**가 발효 중인 경우 *무조건 0점 또는 최소점*을 부여하며 렌더링 UI 자체를 **위험(적색) 배너**로 긴급 교체(Event-Driven Architecture)합니다.
- **✅ 2단계 세부 가중치 계산 (100점 만점)**: 미세먼지(통합대기환경지수 Khai 기반 40점), 1시간 단위 기온 변화(30점), 풍속 및 습도(각 15점)를 합산하여 최종 점수를 제공합니다.

### 2. 🛡️ 서버사이드 프록시 & 인메모리 Rate Limiting
- 민감한 공공데이터 포털 API KEY 및 APIHub 인증 스펙의 탈취를 막기 위해 클라이언트 통신을 배제하였습니다.
- Next.js 서버 라우트(`route.ts`)를 활용한 프록시 구조로 설계되었으며, `In-memory Rate Limiting`을 통해 IP 당 1분 30회 초과 시 429 에러(Too Many Requests)를 반환하도록 트래픽을 완벽하게 통제합니다. 

### 3. 💬 다국어 및 랜덤 브리핑 언어
- 사용자가 접속할 때마다 단조로운 고정 멘트가 나오는 것을 지양합니다.
- 한국어(`ko`), 영어(`en`)로 구성된 수십 가지의 상황별 번역 문구(`msg_excellent`, `msg_fair` 등) 중 매번 **랜덤한 문구를 뽑아 노출**시킵니다. 
- API 백엔드는 추상적인 Key(예: `msg_good`)만 응답하며, 브라우저가 다국어 Context를 이용해 랜덤 변동을 부여하여 SSR Mismatch 문제를 근절했습니다.

### 4. 🎨 Magic UI와 결합한 '선택적 노출 디자인'
- 정보의 피로도를 낮추기 위해 **상시 노출과 조건부 노출**을 완벽히 분리했습니다.
- 평소에는 푸른 `ShineBorder`와 유리처럼 빛나는 `BorderBeam`을 이용한 영롱한 점수판이 나타나지만, 특정 Event(우천/특보)가 발동하는 즉시 애니메이션 코드가 모두 붉은색의 맥동형(Pulse) 🚨경보 알림 형태로 즉각 변화합니다 (`app/page.tsx` 및 `route.ts`).
- 마우스 모션과 연동되는 Particles, 마스킹된 Hero Image, Word Pull-Up 등 최고급 **Framer Motion 애니메이션과 Magic UI 컴포넌트**가 전체 웹 경험을 끌어올립니다.

---

## 🚀 시작 가이드 (Getting Started)

### 1단계: 저장소 복제 및 의존성 설치
```bash
cd nadeulhae
npm install
```

### 2단계: 환경 변수 구성
프로젝트 루트 디렉토리에 `.env.local` 파일을 생성하고 아래 양식에 맞추어 채워주세요. (보안상 절대 Git에 올라가지 않습니다.)

```env
NEXT_PUBLIC_API_URL=/api/weather
NEXT_PUBLIC_MOCK_MODE=false # 프론트엔드 목업 테스트 시 true

# [공공데이터 API 설정]
# 기상청 (KMA) 및 기상청 API 허브 (구 10000회/현 20000회)
KMA_API_KEY=발급받은_당신의_기상청_API_허브_인증키
# 에어코리아 환경공단 (AirKorea - data.go.kr)
AIRKOREA_API_KEY=에어코리아_발급_인코딩_디코딩_동일_키

# [위치 기반 기본 좌표 (전라북도 전주 덕진동 기준 셋업)]
KMA_NX=63
KMA_NY=89
AIRKOREA_STATION_NAME=송천동
MID_TERM_LAND_AREA_CODE=11F10000
MID_TERM_TEMP_AREA_CODE=11F10201
```

### 3단계: 로컬 개발 서버 시작
```bash
npm run dev
# 포트 3000번 (http://localhost:3000) 에서 나들해 앱이 실행됩니다!
```

---

## 📁 주요 파일 구조 분석

- `src/app/api/weather/current/route.ts`: 나들해의 코어 심장입니다. KMA 와 AirKorea 데이터를 묶어 패치하고 자체 Rate Limit 검사 및 100점 만점 평가 알고리즘을 계산/응답합니다.
- `src/data/mockData.ts`: API 연결이 어렵거나 `.env.local` 을 구성하지 않았을 경우 (`NEXT_PUBLIC_MOCK_MODE=true` 지정 시) 디자인 렌더링에 필요한 테스트 데이터를 공급합니다. `eventData`를 `true`로 바꿔 즉시 화면 구조가 무너지고 경고 배너가 등장하는지 테스트할 수 있습니다.
- `src/context/LanguageContext.tsx`: 시스템의 모든 하드코딩된 단어를 제거하고, 다국어 처리(EN/KO) 및 배열 형태의 번역 값 랜덤 반환 기능을 수행합니다.

---

## ⚖️ License
This project is open-source and meant for educational and environment-planning purposes. Not guaranteed for life-critical weather emergencies.
