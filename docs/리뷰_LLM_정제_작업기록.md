# 리뷰 LLM 정제 작업 기록

> 작업일: 2026-05-26
> 모델: deepseek-v4-flash (비추론, reasoning_effort: low)
> 처리 건수: 7,955건 대상 / 7,400건 성공 / 7,720건 TiDB 적재

---

## 1. 작업 배경

전주시 음식점·카페 크롤링 데이터(`전주시_음식점_크롤링결과1.csv`)에는 카카오맵 리뷰 텍스트가 원본 그대로 들어있었다.

```
원본 리뷰 예시:
"24시간 어머님 손맛"
"돌솥비빔밥 양 많고 반찬 맛있음. 사장님 친절"
"비빔밥 맛집! 평이 좋은 이유가 있네요"
```

이 원본을 그대로 코스 추천이나 챗봇에 쓰기에는 문제가 있었다:
- 길이가 제각각이라 UI에 바로 노출하기 어려움
- 감성(긍정/부정) 판단이 안 됨
- 키워드 태깅이 없어서 관심사 매칭 불가
- 대표 리뷰 선별이 안 됨

→ LLM으로 구조화된 형태로 정제하기로 결정.

---

## 2. 원본 데이터 현황

### 2.1 CSV 원본 (`전주시_음식점_크롤링결과1.csv`)

| 필드 | 설명 |
|------|------|
| `review_1_text` ~ `review_10_text` | 카카오맵 리뷰 텍스트 (최대 10건) |
| `review_1_grade` ~ `review_10_grade` | 리뷰 평점 |
| `kakao_review` | 리뷰 수 |
| `kakao_hours` | 영업시간 텍스트 |

### 2.2 전처리 스크립트에서 추출 (`preprocess-low-data.mjs`)

원본 CSV에서 다음을 추출하여 `places.json`에 포함:
- `kakaoRating`, `kakaoReview` → `rating`, `reviewCount`
- `kakaoHours` → `hoursJson` (raw 텍스트)
- `menu_1_name/price` ~ `menu_3_name/price` → `menuSummary`, `priceRange`

리뷰 텍스트(`review_*_text`)는 이 단계에서 **추출하지 않았다**.

---

## 3. TiDB 적재 (1차: 원본 리뷰)

### 3.1 마이그레이션: CSV → TiDB

`enrich-places-reviews.mjs` 스크립트로 원본 CSV에서 리뷰 텍스트를 추출하여 TiDB에 적재.

**처리 로직:**
1. CSV 파싱 (BOM 제거, 따옴표 처리, 빈 행 스킵)
2. 리뷰 정제: 제어문자 제거, 중복 제거, 5자 미만 필터링, 폐업/휴무 리뷰 제외, 200자 제한
3. 영업시간 정제: 공백 정규화, "정보 없음" 제외
4. Temp table 방식으로 배치 적재 (individual UPDATE 대신 JOIN UPDATE)

**SQL:**
```sql
ALTER TABLE places ADD COLUMN reviews_text TEXT NULL;
ALTER TABLE places ADD COLUMN hours_raw VARCHAR(512) NULL;

-- Temp table → JOIN UPDATE
CREATE TEMPORARY TABLE _place_enrich (
  name VARCHAR(255) NOT NULL PRIMARY KEY,
  reviews_text TEXT NULL,
  hours_raw VARCHAR(512) NULL
);
-- ... batch INSERT ...
UPDATE places p JOIN _place_enrich e ON p.name = e.name
SET p.reviews_text = e.reviews_text, p.hours_raw = e.hours_raw;
```

**결과:**
- `reviews_text` 적재: 10,530건
- `hours_raw` 적재: 10,652건

---

## 4. LLM 정제 배치

### 4.1 모델 선택

| 항목 | 값 |
|------|-----|
| 모델 | `deepseek-v4-flash` |
| 타입 | 비추론 (reasoning_effort: low) |
| 엔드포인트 | `https://api.deepseek.com/v1/chat/completions` |
| 동시성 | 100 |
| max_tokens | 2,000 (추론 토큰 포함) |
| temperature | 0 |

`deepseek-v4-flash`는 추론 모델이어서 `reasoning_effort: "disabled"`로 비활성화할 수 없었다. `"low"`로 설정하여 추론 토큰을 약 30% 절감.

### 4.2 프롬프트

```
[system]
리뷰 분석기. 순수 JSON만 출력하라. 설명 절대 금지.
{"summary":"리뷰 핵심을 1~2문장 한국어 요약(80자 내외)",
 "keywords":["키워드1","키워드2","키워드3"],
 "sentiment":"positive",
 "picks":["대표리뷰1","대표리뷰2"]}
키워드는 반드시 여기서만 3~5개 선택:
데이트,가성비,혼밥,가족,모임,분위기좋은,주차편리,특별한날,
로컬맛집,친절,힐링,포토스팟,푸짐한양,깔끔한맛,뷰맛집,전통,
디저트,브런치

[user]
가게: 터미널가정회관 (한식)
리뷰:
1. 돌솥비빔밥 양 많고 반찬 맛있음. 사장님 친절
2. 비빔밥 맛집! 반찬 다양
3. 무조건 여기오세요
```

### 4.3 품질 관리 로직

```javascript
function qualityCheck(parsed) {
  if (!parsed.summary || parsed.summary.length < 8) return "summary_short"
  if (!Array.isArray(parsed.keywords) || parsed.keywords.length === 0) return "keywords_empty"
  if (!["positive", "neutral", "negative"].includes(parsed.sentiment)) {
    // 한국어 감성 보정
    if (parsed.sentiment === "긍정") parsed.sentiment = "positive"
    if (parsed.sentiment === "중립") parsed.sentiment = "neutral"
    if (parsed.sentiment === "부정") parsed.sentiment = "negative"
    else return "sentiment_invalid"
  }
  return null
}
```

- JSON 파싱 실패 → 재시도 1회
- summary 8자 미만 → 재시도
- keywords 빈 배열 → 재시도
- sentiment 형식 불일치 → 한국어 보정 후 재시도
- 2회 연속 실패 → 해당 건 스킵

### 4.4 배치 아키텍처

```
TiDB (7,955건 조회)
  │
  ├─ 100건씩 chunk (Promise pool)
  │     │
  │     ├─ Promise.allSettled(100 LLM 호출)
  │     │     각 호출: reviews → LLM → { summary, keywords, sentiment, picks }
  │     │
  │     ├─ 품질 검사 (실패 시 1회 재시도)
  │     └─ 로컬 JSON에 저장 (200건마다 checkpoint)
  │
  └─ 최종: TiDB temp table → JOIN UPDATE
```

**동시성 처리:**
- `idx` 변수로 작업 큐 관리
- 각 worker가 `while (idx < pending.length)` 루프로 다음 작업 가져감
- 체크포인트: 200건마다 로컬 JSON 저장 (중간 재시작 가능)

### 4.5 결과

| 항목 | 수치 |
|------|------|
| 처리 대상 | 7,955건 |
| 성공 | 7,400건 (93%) |
| 오류 | 426건 (JSON 파싱 실패, 타임아웃 등) |
| 미처리 | 129건 (LLM 응답 지연으로 멈춤) |
| 중복 제거 후 | 4,583건 (동명 가게 존재) |
| **TiDB 적재** | **7,720건** (동명 지점 포함) |
| 소요 시간 | 약 25분 |

---

## 5. TiDB 스키마 변경

### 5.1 추가된 컬럼

```sql
ALTER TABLE places ADD COLUMN reviews_text TEXT NULL;        -- 원본 리뷰 JSON
ALTER TABLE places ADD COLUMN hours_raw VARCHAR(512) NULL;   -- 영업시간 원본
ALTER TABLE places ADD COLUMN review_summary VARCHAR(512) NULL;  -- LLM 요약
ALTER TABLE places ADD COLUMN review_keywords JSON NULL;         -- LLM 키워드
ALTER TABLE places ADD COLUMN review_sentiment VARCHAR(16) NULL; -- LLM 감성
ALTER TABLE places ADD COLUMN review_picks JSON NULL;            -- LLM 대표 리뷰
```

### 5.2 현재 데이터 현황

| 컬럼 | 적재 수 | 설명 |
|------|---------|------|
| `reviews_text` | 10,530 | 원본 리뷰 JSON 배열 (내부 점수 계산용, UI 노출 안 됨) |
| `hours_raw` | 10,652 | 영업시간 텍스트 |
| `review_summary` | 7,720 | LLM 생성 1~2문장 요약 |
| `review_keywords` | 7,720 | LLM 생성 태그 3~5개 |
| `review_sentiment` | 7,720 | positive / neutral / negative |
| `review_picks` | 7,720 | LLM 선별 대표 리뷰 2건 |

### 5.3 샘플 데이터

**달리는커피서신점 (cafe, ★5.0)**
```json
{
  "summary": "사장님 친절, 가성비 좋고 양이 푸짐하며 신선한 재료가 일품인 카페.",
  "keywords": ["친절", "가성비", "푸짐한양", "깔끔한맛"],
  "sentiment": "positive",
  "picks": ["사장님이 정말 친절하세요", "가성비 좋아요"]
}
```

**시골밥상 (restaurant, ★5.0)**
```json
{
  "summary": "8000원에 든든한 집밥, 점심마다 찾는 가성비 최고 맛집",
  "keywords": ["가성비", "푸짐한양", "혼밥"],
  "sentiment": "positive",
  "picks": ["8000원에 이 정도면 가성비 최고", "매일 점심 먹으러 옵니다"]
}
```

---

## 6. 코스 엔진 연동

### 6.1 점수 체계 (최종)

```
최종점수 = 기본품질 + 취향부스트 + 거리부스트 + 영업시간패널티 + 리뷰보너스

기본품질:
  평점×2 (최대 10) + log(리뷰수)×2 (최대 5) + 메뉴유무(+1) + 카카오링크(+1)
  + 평점≥4 보너스(+3) + 리뷰개수(+1~5) + 영업시간유무(+1) + LLM키워드유무(+2)

취향부스트:
  foodie → restaurant/pub +5
  cafe → cafe/bakery +5
  nature → nature +5
  ... (사용자 interestTags 기반)

거리부스트 (GPS):
  1km 이내 +5, 3km +3, 5km +2, 10km +1

영업시간 패널티:
  마감시간 경과 -8, 휴게시간 중 -8, 요일 휴무 -8

리뷰 키워드-관심사 교차 매칭:
  LLM 키워드가 사용자 관심사의 관련 키워드셋과 겹치면 +3
  예: foodie 관심사 + ["가성비","푸짐한양"] 키워드 → +3
```

### 6.2 키워드-관심사 매핑

```javascript
const keywordBoostMap = {
  foodie: ["가성비", "푸짐한양", "로컬맛집", "깔끔한맛"],
  cafe: ["분위기좋은", "디저트", "브런치", "포토스팟"],
  nature: ["힐링", "포토스팟", "뷰맛집"],
  art_museum: ["전통", "포토스팟"],
  photography: ["포토스팟", "뷰맛집", "분위기좋은"],
  family: ["가족", "푸짐한양", "주차편리"],
  picnic: ["힐링", "가족"],
  walking: ["힐링", "주차편리"],
}
```

### 6.3 리뷰 요약 주입

코스 슬롯 description에 리뷰 요약을 주입:

```typescript
function getReviewNote(reviewSummary: string | null): string {
  if (!reviewSummary || reviewSummary.length < 10) return ""
  const trimmed = reviewSummary.length > 60
    ? reviewSummary.slice(0, 57) + "..."
    : reviewSummary
  return `\n→ 리뷰: "${trimmed}"`
}
```

**출력 예시:**
```
여유롭게 즐기기 좋은 카페입니다.
→ 리뷰: "사장님 친절, 가성비 좋고 양이 푸짐하며 신선한 재료가 일품인 카페."
→ 카페 취향에 맞춰 골랐어요.
```

---

## 7. 챗봇 프롬프트 연동

`/api/chat/route.ts`에서 `getTopPlacesForChat()` 호출 시 리뷰 요약·키워드를 포함하여 시스템 프롬프트에 주입.

### 7.1 프롬프트 컨텍스트 형식

```
[전주 장소 DB (날씨에 맞는 추천 장소, 실제 존재하는 장소만)]
- 달리는커피서신점 (cafe, 5) [취향: cafe]
  리뷰요약: 사장님 친절, 가성비 좋고 양이 푸짐하며 신선한 재료가 일품인 카페.
  태그: [친절, 가성비, 푸짐한양, 깔끔한맛]
- 시골밥상 (restaurant, 5) [취향: foodie]
  리뷰요약: 8000원에 든든한 집밥, 점심마다 찾는 가성비 최고 맛집
  태그: [가성비, 푸짐한양, 혼밥]
```

### 7.2 LLM 응답 규칙

시스템 프롬프트에 추가된 규칙:
```
- 장소를 추천할 때는 [전주 장소 DB]에 있는 실제 장소명을 우선 인용하고,
  평점·분위기·대표메뉴를 함께 언급할 것
- [전주 장소 DB]에 없는 장소는 함부로 만들어내지 말고,
  DB에 있는 유사 장소를 대신 추천할 것
```

---

## 8. UI 연동

`course-recommendation.tsx`의 확장 카드에 리뷰 데이터 표시:

```
[Slot 1] 13:00 - 15:30 | 덕진공원
  ☀️ 야외
  햇살 좋은 시간에 방문하기 좋은 자연 명소입니다.

  [펼치기]
  ┌─────────────────────────────────────────┐
  │ ★ 4.7  호남제일문                        │
  │ 전주시 완산구 전라감영4길 13-7            │
  │                                         │
  │ "역사적 의미가 있는 전주 관문"            │  ← reviewSummary
  │                                         │
  │ 전통 | 포토스팟 | 데이트                  │  ← reviewKeywords
  └─────────────────────────────────────────┘
```

---

## 9. 키워드 빈도 분석 (7,720건 기준)

| 키워드 | 건수 | 비율 |
|--------|------|------|
| 깔끔한맛 | 4,027 | 52% |
| 로컬맛집 | 3,934 | 51% |
| 가성비 | 3,656 | 47% |
| 친절 | 2,748 | 36% |
| 분위기좋은 | 1,878 | 24% |
| 푸짐한양 | 1,663 | 22% |
| 전통 | 1,347 | 17% |
| 혼밥 | 1,290 | 17% |
| 힐링 | 1,210 | 16% |
| 디저트 | 878 | 11% |
| 모임 | 554 | 7% |
| 특별한날 | 521 | 7% |
| 데이트 | 469 | 6% |
| 가족 | 376 | 5% |
| 포토스팟 | 293 | 4% |
| 주차편리 | 276 | 4% |
| 브런치 | 121 | 2% |
| 뷰맛집 | 97 | 1% |

---

## 10. 감성 분포

| 감성 | 건수 | 비율 |
|------|------|------|
| positive | 5,898 | 76% |
| neutral | 499 | 6% |
| negative | 1,323 | 17% |

---

## 11. 카테고리별 정제 현황

| 카테고리 | 정제 완료 |
|----------|----------|
| restaurant | 5,188 |
| cafe | 1,322 |
| other | 612 |
| pub | 292 |
| shopping | 151 |
| bakery | 107 |
| sports | 33 |
| culture | 7 |
| accommodation | 4 |
| nature | 3 |
| attraction | 1 |

---

## 12. 남은 작업

| 항목 | 상태 |
|------|------|
| 원본 리뷰(`reviews_text`) UI 노출 차단 | 완료 (PlaceSlotItem에 포함 안 됨) |
| 오류 건(426건) 재처리 | 미실시 (필요 시 배치 재실행) |
| 미처리 건(129건) 처리 | 미실시 |
| `reviews_enriched.json` 로컬 백업 | 3.3MB, gitignore 처리 |
| SQLite 파일 완전 제거 | 완료 (places.db 삭제, 패키지 제거) |

---

## 13. 관련 파일

| 파일 | 역할 |
|------|------|
| `src/lib/course-engine.ts` | TiDB 기반 코스 추천 엔진 (점수 계산, 필터링, 리뷰 키워드 매칭) |
| `src/components/course-recommendation.tsx` | 타임라인 카드 UI (리뷰 요약·키워드 표시) |
| `src/app/api/weather/recommendations/generate/route.ts` | 코스 추천 API |
| `src/app/api/chat/route.ts` | 챗봇 프롬프트에 리뷰 요약 주입 |
| `src/lib/chat/prompt.ts` | 시스템 프롬프트 빌더 (장소 DB 컨텍스트) |
| `src/app/dashboard/page.tsx` | 대시보드에 추천 코스 섹션 |
