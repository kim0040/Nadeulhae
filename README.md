# 🧺 전주 나들해 (Jeonju Nadeulhae)

> **"오늘 전주는 피크닉 가기 완벽한 날이에요!"**  
> 전주 지역의 실시간 기상 데이터와 과거 통계 데이터를 분석하여 최적의 나들이 타이밍과 코스를 제안하는 맞춤형 환경 서비스입니다.

---

## 🌟 주요 기능 (Key Features)

### 1. 실시간 나들이 브리핑 (Live Weather Briefing)
- **프리미엄 벤토 그리드 UI**: 현재 기온, 습도, 풍속, 미세먼지 등을 한눈에 확인하세요.
- **지능형 상황별 멘트**: 20가지 이상의 기상 조건(기온, 비/눈, 강풍 등)을 분석하여 맞춤형 조언을 제공합니다.
- **이중 미세먼지 기준**: 국내 환경부 기준과 더불어 엄격한 **WHO(세계보건기구)** 권고 기준을 동시에 비교 제공하여 건강한 야외 활동을 돕습니다.

### 2. AI 반나절 코스 생성기 (AI Course Generator)
- **날씨 흐름 기반 추천**: "오후 1시~6시"와 같이 원하는 시간을 입력하면, 기상 변화(야외→실내 등)에 최적화된 동선을 AI가 자동으로 생성합니다.
- **데이터 기반 큐레이션**: 전주의 주요 명소(덕진공원, 한옥마을 등)와 주변 실내 공간을 적절히 배합합니다.

### 3. 실시간 10일 예보 달력 (10-Day Forecast Calendar)
- **피크닉 지수 스코어링**: 기상청의 단기/중기 예측 데이터를 파싱하여 각 날짜별 '나들이 적합도'를 점수로 환산합니다.
- **최적일 하이라이트**: 향후 10일 중 나들이하기 가장 좋은 날을 자동으로 추천합니다.

### 4. 과거 데이터 아카이브 (Historical Statistics)
- 전주 지역의 지난 기상 데이터를 시각화하여 시즌별 나들이 트렌드를 확인할 수 있습니다.

---

## 🛠 기술 스택 (Tech Stack)

- **Frontend**: `Next.js 14 (App Router)`, `React`, `Tailwind CSS`
- **Animation**: `Framer Motion`, `Magic UI`
- **Icons**: `Lucide React`
- **State/Context**: `React Context API` (Language & Theme support)
- **Deployment**: `Vercel` (Recommended)

---

## 🔌 API 연동 (API Integration)

본 서비스는 공공데이터포털의 신뢰할 수 있는 데이터를 실시간으로 캐싱하여 제공합니다.
- **기상청 (KMA)**: 단기예보 및 중기예보 데이터
- **에어코리아 (AirKorea)**: 전주 지역 실시간 대기 오염도 (PM10) 데이터

---

## 🚀 시작하기 (Getting Started)

### 1. 환경 변수 설정
`.env.local` 파일을 생성하고 아래 키를 입력하세요.
```env
KMA_API_KEY=your_kma_api_key_here
AIR_KOREA_API_KEY=your_airkorea_api_key_here
NEXT_PUBLIC_MOCK_MODE=false
```

### 2. 실행
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

---

## 🌐 다국어 및 다크 모드 지원
- **한국어/영어** 완벽 대응
- **시스템 설정 기반 테마** (Light / Pure Black Dark Mode) 지원

---

## 📂 프로젝트 구조
- `/src/app/api`: 기상청/에어코리아 프록시 및 캐싱 로직
- `/src/components`: 벤토 그리드, 브리핑 카드, 예보 달력 등 UI 컴포넌트
- `/src/context`: 언어 스위칭 및 테마 관리
- `/src/services`: 데이터 통합 처리 모듈

---

© 2026 전주 나들해 (Jeonju Nadeulhae). All rights reserved.
