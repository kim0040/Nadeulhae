# 코드 리뷰 보고서 - 나들해 (Nadeulhae)

**리뷰 일자:** 2026-04-17  
**리뷰 범위:** 주요 소스 코드 파일 (Auth, Chat, Weather, Lab, WebSocket 등)

---

## 📋 실행 요약 (Executive Summary)

전반적으로 **매우 잘 구조화된 코드베이스**입니다. 다음 영역에서 우수한 설계가 확인되었습니다:

- ✅ 보안: 암호화, 블라인드 인덱스, Rate Limiting
- ✅ 에러 핸들링: try-catch, 폴백 로직
- ✅ 성능: 캐싱, 배치 처리, WebSocket
- ✅ 타입 안전성: TypeScript 엄격 모드

하지만 몇 가지 **개선 필요 사항**과 **잠재적 위험 요소**가 발견되었습니다.

---

## 🔴 Critical Issues (즉시 수정 권장)

### 1. **환경 변수 누락 시 보안 취약점** (`src/app/api/weather/current/route.ts:1068-1070`)

```typescript
const kmaKey = process.env.KMA_API_KEY
const publicServiceKey = process.env.AIRKOREA_API_KEY

if (!kmaKey || !publicServiceKey) {
  return NextResponse.json({ error: "API Keys not configured" }, { status: 500 })
}
```

**문제점:**
- API 키가 설정되지 않았을 때 `"API Keys not configured"` 오류를 반환 → 공격자에게 시스템 정보 노출
- `.env.local` 파일이 git 에 커밋될 위험 (`.env.example` 존재 확인)

**권장 사항:**
```typescript
if (!kmaKey || !publicServiceKey) {
  console.error("Missing API keys") // 로그로만 기록
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}
```

---

### 2. **SQL Injection 잠재적 위험** (`src/lib/auth/repository.ts:667-676`)

```typescript
const placeholders = scopeKeys.map(() => "?").join(", ")
const rows = await queryRows<AttemptBucketRow[]>(
  `
    SELECT ... FROM auth_attempt_buckets
    WHERE action = ? AND scope_key IN (${placeholders})
    ...
  `,
  [action, ...scopeKeys]
)
```

**문제점:**
- 현재는 파라미터화된 쿼리로 안전하지만, `scopeKeys` 배열의 길이에 따라 동적 SQL 이 생성됨
- `scopeKeys` 가 사용자 입력에서 직접 유래할 경우, 배열 길이 제한이 없으면 DoS 공격 가능

**권장 사항:**
```typescript
// 최대 길이 제한 추가
const MAX_SCOPE_KEYS = 10
const limitedScopeKeys = scopeKeys.slice(0, MAX_SCOPE_KEYS)
```

---

### 3. **무한 루프 위험** (`src/lib/auth/repository.ts:260-277`)

```typescript
async function generateUniqueNicknameTag(nickname: string): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const tag = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    const existing = await queryRows(...)
    if (existing.length === 0) return tag
  }
  // Fallback: sequential scan
  for (let n = 0; n < 10000; n++) {
    const tag = String(n).padStart(4, '0')
    if (!usedSet.has(tag)) return tag
  }
  throw new Error('All nickname tags exhausted for this nickname')
}
```

**문제점:**
- 10,000 개의 태그가 모두 사용된 경우 예외 발생 → 서비스 거부
- 실제로는 발생 확률이 극히 낮지만, 이론적 가능성 존재

**권장 사항:**
- 5 자리 태그 시스템으로 확장 고려
- 또는 UUID 기반 태그 사용

---

## 🟡 High Priority Issues (우선 수정 권장)

### 4. **메모리 누수 위험 - 전역 캐시** (`src/app/api/weather/current/route.ts:61-350`)

```typescript
const stationCache = new Map<string, StationCacheEntry>()
const airQualityCache = new Map<string, CacheEntry<AirQualitySnapshot>>()
const currentResponseCache = new Map<string, UserCacheEntry<Record<string, unknown>>>()
// ... 7 개의 추가 캐시 Map
```

**문제점:**
- 서버 재시작까지 캐시가 무제한 성장 가능
- `MAX_USER_RESPONSE_CACHE_KEYS = 500` 제한은 있지만, 다른 캐시는 명시적 제한 없음
- `runMaintenanceSweepIfNeeded()` 가 5 분 주기로 실행되지만, 급격한 메모리 증가 시 대응 불가

**권장 사항:**
```typescript
// LRU 캐시 구현 또는 Map 크기 제한 강화
const MAX_CACHE_KEYS = 2000
if (airQualityCache.size > MAX_CACHE_KEYS) {
  const oldestKey = airQualityCache.keys().next().value
  airQualityCache.delete(oldestKey)
}
```

---

### 5. **경쟁 조건 (Race Condition)** (`src/app/api/chat/route.ts:66-90`)

```typescript
declare global {
  var __nadeulhaeChatUsersInFlight: Set<string> | undefined
}

function acquireChatUserLock(userId: string) {
  const inFlight = getChatUsersInFlight()
  if (inFlight.has(userId)) return false
  inFlight.add(userId)
  return true
}
```

**문제점:**
- In-memory lock 은 멀티 프로세스/서버 환경에서 작동하지 않음
- 수평 확장 시 동일한 사용자의 동시 요청을 차단하지 못함

**권장 사항:**
- Redis 와 같은 분산 락 사용
- 또는 데이터베이스 행 락 활용

---

### 6. **WebSocket 인증 취약점** (`src/lib/websocket/use-websocket.ts:10-18`)

```typescript
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? ""

function getWsUrl() {
  if (WS_BASE) return WS_BASE
  if (typeof window === "undefined") return ""
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${window.location.host}/ws`
}
```

**문제점:**
- WebSocket 연결 시 명시적 인증 토큰 검증 로직이 보이지 않음
- `NON_RETRIABLE_CLOSE_CODES = new Set([4403])` 는 있지만, 초기 연결 인증이 불명확

**권장 사항:**
- WebSocket handshake 시 JWT 또는 세션 토큰 검증 추가
- `server.ts` 의 WebSocket 서버 코드 확인 필요

---

### 7. **과도한 캐시 의존성** (`src/app/api/weather/current/route.ts:172-219`)

```typescript
const WEATHER_CACHE_DURATION = 90 * 60 * 1000  // 90 분
const AIR_CACHE_DURATION = 60 * 60 * 1000      // 60 분
const USER_RESPONSE_CACHE_DURATION = 5 * 60 * 1000  // 5 분
```

**문제점:**
- 날씨 데이터가 90 분간 캐시됨 → 급격한 기상 변화 시 사용자에 잘못된 정보 제공
- `getSmartCachedValue` 함수가 있지만, 기본 TTL 이 김

**권장 사항:**
- 중요도별 캐시 시간 차등화 (경보 데이터는 5 분, 일반 데이터는 30 분)
- WebSocket 으로 실시간 업데이트 트리거

---

## 🟢 Medium Priority Issues (개선 권장)

### 8. **일관되지 않은 에러 처리** (전반적)

**예시 1** - Chat API:
```typescript
catch (error) {
  console.error("Chat POST API failed:", error)
  // ... 상세 에러 처리
}
```

**예시 2** - Weather API:
```typescript
catch (error) {
  console.error("External fetch failed:", error)
  return null
}
```

**문제점:**
- 일부 함수는 `console.error` 만 기록
- 일부는 에러를 상위로 전파
- 에러 로깅이 일관되지 않음 (구조화된 로깅 부재)

**권장 사항:**
- 통합 에러 로깅 유틸리티 제작
- 에러 코드 체계화

---

### 9. **하드코딩된 매직 넘버** (전반적)

```typescript
// src/app/api/weather/current/route.ts:557-578
function calculateHeatIndexC(tempC: number, humidity: number) {
  const hiF =
    -42.379
    + 2.04901523 * tempF
    + 10.14333127 * humidity
    // ... 상수들
}
```

**문제점:**
- 과학적 상수는 설명이 없으면 유지보수 어려움
- 수식 출처 명시 필요

**권장 사항:**
```typescript
// NOAA Heat Index 계산식 (출처: https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml)
const HE_INDEX_INTERCEPT = -42.379
const HE_INDEX_TEMP_COEFF = 2.04901523
// ...
```

---

### 10. **TypeScript `any` 사용** (`src/app/api/weather/current/route.ts:750-753`)

```typescript
const exactStation = stationItems.find(
  (item: any) => String(item?.stationName ?? "").trim() === normalizedStationName
)
```

**문제점:**
- `any` 타입은 타입 안전성을 해침
- API 응답 타입 정의가 존재해야 함

**권장 사항:**
```typescript
interface AirKoreaStationItem {
  stationName: string
  pm10Value: string
  pm25Value: string
  // ...
}

const exactStation = stationItems.find(
  (item: AirKoreaStationItem) => ...
)
```

---

### 11. **중복된 타입 정의**

**확인된 파일:**
- `src/lib/auth/types.ts`
- `src/lib/chat/types.ts`
- `src/lib/lab/types.ts`

**문제점:**
- 공통 타입 (예: `Locale`, `ApiResponse`) 이 여러 곳에 정의될 가능성
- 순환 참조 위험

**권장 사항:**
- `src/lib/types/common.ts` 와 같이 통합 타입 파일 생성

---

## 📊 코드 품질 메트릭스

| 항목 | 상태 | 비고 |
|------|------|------|
| 타입 안전성 | 🟢 우수 | Strict 모드 활성화 |
| 에러 핸들링 | 🟡 보통 | 일관성 개선 필요 |
| 보안 | 🟡 보통 | 몇 가지 취약점 발견 |
| 성능 | 🟢 우수 | 캐싱, 배치 처리 잘 구현됨 |
| 유지보수성 | 🟡 보통 | 매직 넘버, 주석 부족 |
| 테스트 | 🔴 미확인 | 테스트 파일 미확인 |

---

## 🔍 보안 체크리스트

### ✅ 잘 구현된 항목
- [x] 비밀번호 해싱 (`bcrypt` 또는 유사)
- [x] 블라인드 인덱스 (이메일, 닉네임 검색용)
- [x] Rate Limiting (로그인, 회원가입)
- [x] CSRF 쿠키 설정
- [x] SQL 파라미터화 쿼리
- [x] 환경 변수 분리

### ⚠️ 개선 필요 항목
- [ ] WebSocket 인증 강화
- [ ] API 키 오류 메시지 일반화
- [ ] XSS 방지 (React 가 기본적으로 방어가 되지만, `dangerouslySetInnerHTML` 사용 시 주의)
- [ ] CORS 설정 확인 (`next.config.ts`)
- [ ] Security Headers (CSP, HSTS 등)

---

## 🚀 성능 최적화 제안

### 1. **데이터베이스 쿼리 최적화**

현재:
```typescript
const [latestSessionMemory, profileMemory, contextMessages] = await Promise.all([
  getChatSessionMemorySnapshot(...),
  getChatMemorySnapshot(...),
  getRecentContextMessages(...),
])
```

✅ **좋음:** 병렬 실행

추가 제안:
- 인덱스 최적화 확인 (`users.email_hash`, `user_sessions.token_hash`)
- 쿼리 캐싱 (Redis 등)

### 2. **번들 사이즈 최적화**

```typescript
// src/app/page.tsx:27-33
const PicnicBriefing = dynamic(() => import("@/components/picnic-briefing").then(m => ({ default: m.PicnicBriefing })), { ssr: false })
```

✅ **좋음:** Code Splitting 구현

추가 제안:
- `next/bundle-analyzer` 로 번들 분석
- 사용하지 않는 Magic UI 컴포넌트 트리 셰이킹

### 3. **이미지 최적화**

```typescript
// src/components/weather-image-panel.tsx
<img src={`/api/weather/images/asset?${params}`} />
```

**권장 사항:**
- Next.js `Image` 컴포넌트 사용
- WebP/AVIF 포맷 지원
- CDN 연동

---

## 📝 문서화 및 주석

### 부족한 부분
1. **복잡한 비즈니스 로직에 주석 부재**
   - 점수 계산 로직 (`getAirScore`, `getTemperatureScore` 등)
   - 좌표 변환 (`wgs84ToTm`)

2. **API 문서화**
   - OpenAPI/Swagger 스펙 없음
   - API 엔드포인트 목록은 `api_data_list.md` 존재하지만, 상세 명세 부재

3. **데이터베이스 스키마**
   - `src/lib/auth/schema.ts` 는 있지만, ERD 부재

---

## 🧪 테스트 관련

**확인 필요 항목:**
- [ ] 단위 테스트 존재 여부 (`*.test.ts`, `*.spec.ts`)
- [ ] 통합 테스트
- [ ] E2E 테스트 (Playwright, Cypress)
- [ ] 스크립트 테스트 (`scripts/test-*.mjs`)

**패키지.json 확인:**
```json
"test:auth": "node scripts/test-auth-flows.mjs",
"test:chat": "node scripts/test-chat-flow.mjs",
"test:lab": "node scripts/test-lab-features.mjs",
"test:code-share": "node scripts/test-code-share-ws.mjs"
```

✅ **좋음:** 테스트 스크립트 존재

**권장 사항:**
- Jest/Vitest 기반 자동화 테스트 추가
- CI/CD 파이프라인 통합

---

## 📦 의존성 관리

### 현재 주요 패키지
```json
{
  "next": "^16.2.2",
  "react": "^19.2.4",
  "mysql2": "^3.20.0",
  "ws": "^8.20.0"
}
```

### 권장 사항
1. **보안 업데이트 확인:** `npm audit` 정기 실행
2. **Lock 파일:** `package-lock.json` 커밋됨 (✅ 좋음)
3. **피어 의존성 경고:** `eslint-config-next` 등 버전 호환성 확인

---

## 🏗️ 아키텍처 개선 제안

### 1. **레이어드 아키텍처 명확화**

현재 구조:
```
src/
├── app/          # 라우트 (프레젠테이션)
├── components/   # UI 컴포넌트
├── context/      # React Context
├── lib/          # 비즈니스 로직
└── services/     # 데이터 서비스
```

**제안:**
```
src/
├── app/              # Next.js 라우트
├── components/       # UI 컴포넌트
│   ├── ui/          # 재사용 가능한 프리미티브
│   └── features/    # 기능별 컴포넌트
├── hooks/           # 커스텀 훅 (context 에서 분리)
├── lib/             # 코어 로직
│   ├── auth/
│   ├── chat/
│   └── weather/
├── services/        # 외부 API 연동
├── repositories/    # 데이터 액세스 (lib 에서 분리)
└── types/           # 공통 타입
```

### 2. **기능 플래그 시스템**

현재:
```typescript
if (!authenticatedSession.user.labEnabled) {
  return ... { status: 403 }
}
```

**제안:**
- 중앙집중식 기능 플래그 관리
- A/B 테스트 지원

---

## ✅ 긍정적인 발견 사항

### 1. **잘 구현된 보안 기능**
- 다중 레이어 Rate Limiting (IP, 이메일)
- 암호화된 데이터 저장 (이메일, 닉네임, 관심사)
- 블라인드 인덱스로 검색 가능성 유지

### 2. **세련된 에러 처리**
```typescript
try {
  // ... 작업
} catch (error) {
  const providerError = error instanceof FactChatError ? error : null
  // ... 상세 에러 처리
} finally {
  if (!lockReleased) {
    releaseChatUserLock(lockedUserId)
  }
}
```

### 3. **성능 최적화**
- 지능형 캐싱 (`getSmartCachedValue`)
- 배치 처리 (Lab 카드 생성)
- WebSocket 실시간 브로드캐스트

### 4. **타입 안전성**
- Strict TypeScript
- 제네릭 활용
- 타입 가드 함수

---

## 📋 액션 아이템 요약

### 즉시 수정 (Critical)
1. [ ] API 키 오류 메시지 일반화
2. [ ] SQL 인젝션 방어 (scopeKeys 제한)
3. [ ] 닉네임 태그 고갈 처리 개선

### 우선 수정 (High)
4. [ ] 메모리 캐시 제한 강화
5. [ ] WebSocket 인증 로직 검토
6. [ ] 분산 락 시스템 도입 (확장성)
7. [ ] 날씨 캐시 시간 단축

### 개선 권장 (Medium)
8. [ ] 통합 에러 로깅 시스템
9. [ ] 매직 넘버 상수화 및 주석 추가
10. [ ] `any` 타입 제거
11. [ ] 공통 타입 통합

### 장기 개선 (Low)
12. [ ] 아키텍처 리팩토링
13. [ ] 테스트 커버리지 향상
14. [ ] API 문서화 (OpenAPI)
15. [ ] 보안 헤더 강화

---

## 📊 종합 평가

| 평가 항목 | 점수 | 비고 |
|---------|------|------|
| **코드 품질** | 8.5/10 | 전반적으로 우수 |
| **보안** | 7.5/10 | 몇 가지 개선 필요 |
| **성능** | 8.0/10 | 캐싱 전략 좋음 |
| **유지보수성** | 7.0/10 | 주석 및 문서화 보강 필요 |
| **확장성** | 7.5/10 | 분산 시스템 고려 필요 |
| **종합** | **7.7/10** | 프로덕션 수준, 개선 여지 있음 |

---

## 📌 결론

**나들해 프로젝트는 전반적으로 잘 설계된 프로덕션 레벨 코드베이스입니다.** 

특히 다음 영역에서 우수한 설계가 확인되었습니다:
- 보안 (암호화, Rate Limiting)
- 에러 핸들링 (상세한 복구 로직)
- 성능 최적화 (캐싱, 배치 처리)

하지만 다음과 같은 영역에서 개선이 필요합니다:
1. **보안:** API 키 오류 처리, WebSocket 인증
2. **성능:** 메모리 캐시 관리, 분산 락
3. **유지보수성:** 주석, 문서화, 타입 안전성

위 항목들을 우선순위에 따라 수정하면 더욱 견고한 서비스가 될 것입니다.

---

**리뷰어:** AI Code Assistant  
**버전:** 1.0  
**다음 리뷰 예정:** 주요 이슈 수정 후 재검토 권장
