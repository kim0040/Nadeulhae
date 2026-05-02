# 나들해 (Nadeulhae) — 아키텍처 UML 문서 (한국어판)

> **버전**: 0.1.0 | **프레임워크**: Next.js 16.2.4 (App Router) | **언어**: TypeScript 6.0

---

## 1. 프로젝트 개요

**나들해**("나들이" + "해")는 **날씨 기반 야외활동 점수 서비스 + AI 채팅 + 코드 공유 플랫폼**이다. 전주시를 중심으로 기상청(KMA), 한국환경공단(AirKorea), APIHub의 실시간 데이터를 결합해 0~100점의 피크닉 지수를 산출하고, OpenAI 호환 LLM 기반의 AI 채팅, FSRS 알고리즘을 활용한 어휘 암기(랩), 그리고 WebSocket 기반 실시간 협업 코드 에디터를 제공한다.

---

## 2. 시스템 아키텍처 — 배포 구성도

```mermaid
graph TB
    subgraph UserDevice["사용자 기기"]
        BROWSER["웹 브라우저 (React SPA)"]
    end

    subgraph EdgeCDN["엣지 / CDN"]
        NGINX["Nginx 리버스 프록시<br/>SSL 종료<br/>WebSocket 업그레이드<br/>CSP / HSTS 헤더"]
    end

    subgraph AppServer["애플리케이션 서버 (Node.js)"]
        direction TB
        S_TS["server.ts (커스텀 HTTP + WS 서버)"]
        
        subgraph NextJS["Next.js App Router"]
            MIDDLE["proxy.ts (속도 제한 / 보안)"]
            PAGES["SSR 페이지<br/>대시보드 / 랩 / 전주 / 통계"]
            API["API 라우트 (50+개)<br/>인증, 날씨, 채팅, 랩, 코드공유, 분석"]
        end

        WSS["WebSocket 서버<br/>코드공유 접속현황 / 타이핑 / 하트비트"]
        
        SCHEDULER["전주 브리핑 스케줄러<br/>일일 AI 브리핑 생성기"]

        S_TS --> MIDDLE
        MIDDLE --> PAGES
        MIDDLE --> API
        S_TS --> WSS
        S_TS --> SCHEDULER
    end

    subgraph Persistence["영속성 계층"]
        TIDB[("TiDB / MySQL 8 (20개 테이블)")]
    end

    subgraph ExternalAPIs["외부 API"]
        KMA["기상청 KMA<br/>초단기예보 / 단기예보 / 중기예보"]
        AIR["AirKorea<br/>PM10 / PM2.5 / 통합대기지수"]
        APIHUB["APIHub<br/>기상특보 / 위성·레이더·지진 이미지"]
        GENERAL_LLM["범용 LLM API<br/>OpenAI 호환 (범용)"]
        LAB_LLM["실험실 LLM API<br/>OpenAI 호환 (실험실)"]
        TAVILY["Tavily API (웹 검색)"]
    end

    BROWSER -- HTTPS --> NGINX
    NGINX -- HTTP/WS --> S_TS
    API --> TIDB
    WSS -- 세션 인증 --> TIDB
    API --> KMA
    API --> AIR
    API --> APIHUB
    API --> GENERAL_LLM
    API --> LAB_LLM
    API --> TAVILY
    SCHEDULER --> GENERAL_LLM
    SCHEDULER --> TIDB
```

---

## 3. 프론트엔드 컴포넌트 계층 구조

```mermaid
graph TD
    ROOT["RootLayout (layout.tsx)"]
    
    LP["LanguageProvider (한국어 / 영어 / 중국어 / 일본어)"]
    TP["ThemeProvider (다크 / 라이트 / 시스템)"]
    AP["AuthProvider (로딩중 / 비회원 / 인증됨)"]
    
    ROOT --> LP
    LP --> TP
    TP --> AP
    
    PVT["PageViewTracker (방문 분석)"]
    ACB["AnalyticsConsentBanner (분석 동의)"]
    NAV["Navbar (로고 / 인증상태 / 테마 / 언어)"]
    
    AP --> PVT
    AP --> ACB
    AP --> NAV
    AP --> PAGES

    subgraph Pages["페이지 컴포넌트"]
        HOME["홈 (/)"]
        HOME_COMP["홈 하위 컴포넌트<br/>TodayHourlyForecast<br/>PicnicBriefing<br/>FireInsightPanel<br/>WeatherImagePanel"]
        
        DASH["대시보드 (/dashboard)<br/>DashboardChatPanel"]
        
        LAB_HUB["랩 허브 (/lab)<br/>기기 성능 감지"]
        LAB_VOCAB["어휘 학습 (/lab/vocab)<br/>VocabReportPanel / 카드 복습"]
        LAB_AI["AI 채팅 (/lab/ai-chat)<br/>LabAiChatPanel / 웹 검색"]
        LAB_CS["코드 공유 (/lab/code-share)<br/>CodeShareHub"]
        
        CS_EDITOR["코드 공유 편집기<br/>(/code-share/[세션ID])<br/>CodeMirror + 접속현황"]
        
        JEONJU["전주 (/jeonju)<br/>일일브리핑 / 채팅 / 안전정보"]
        
        STATS["통계 (/statistics/calendar)<br/>PicnicCalendar"]
        
        AUTH_PAGES["인증 페이지<br/>로그인 / 회원가입 / 계정관리 / 약관"]
    end

    HOME --> HOME_COMP
    AP --> HOME
    AP --> DASH
    AP --> LAB_HUB
    LAB_HUB --> LAB_VOCAB
    LAB_HUB --> LAB_AI
    LAB_HUB --> LAB_CS
    AP --> CS_EDITOR
    AP --> JEONJU
    AP --> STATS
    AP --> AUTH_PAGES
```

---

## 4. 데이터베이스 스키마 — Entity-Relationship Diagram (ERD)

> **암호화 범례**: [E] = AES-256-GCM 암호화 필드 | [BI] = 블라인드 인덱스 (HMAC-SHA256) | [IDX] = 인덱스 컬럼

```mermaid
erDiagram
    users {
        string id PK "UUIDv4"
        string email "AES-256-GCM 암호화 [E]"
        string email_hash "HMAC-SHA256 블라인드 인덱스 [BI] [IDX] UNIQUE"
        string display_name "암호화 [E]"
        string nickname "암호화 [E]"
        string nickname_hash "블라인드 인덱스 [BI] [IDX] 태그와 함께 UNIQUE"
        string nickname_tag "랜덤 4자리 태그"
        string password_hash "scrypt(N=16384)"
        string password_salt "scrypt 솔트"
        string password_algo "항상 scrypt-v1"
        string age_band "암호화 [E]"
        string primary_region "암호화 [E]"
        string interest_tags "JSON 배열 암호화 [E]"
        string interest_other "암호화 [E]"
        string preferred_time_slot "암호화 [E]"
        string weather_sensitivity "JSON 배열 암호화 [E]"
        datetime terms_agreed_at "약관 동의 일시"
        datetime privacy_agreed_at "개인정보 동의 일시"
        datetime age_confirmed_at "연령 확인 일시"
        boolean marketing_accepted "마케팅 동의"
        boolean analytics_accepted "분석 동의"
        boolean lab_enabled "랩 기능 활성화 여부"
        datetime created_at "생성일시"
        datetime updated_at "수정일시"
    }

    user_sessions {
        string id PK "UUIDv4"
        string user_id FK "users.id 참조"
        string token_hash "세션 토큰 SHA-256 [IDX] UNIQUE"
        datetime expires_at "인덱스 [IDX]"
        string user_agent "암호화 [E]"
        string ip_address "암호화 [E]"
        datetime created_at "생성일시"
        datetime last_used_at "마지막 사용일시"
    }

    auth_attempt_buckets {
        int id PK "AUTO_INCREMENT"
        string action "로그인 또는 회원가입"
        string scope_key "IP 또는 email_hash"
        int attempt_count "시도 횟수"
        datetime window_started_at "제한 윈도우 시작"
        datetime blocked_until "인덱스 [IDX]"
        datetime last_attempt_at "마지막 시도일시"
        string uniqueKey "action + scope_key 쌍 UNIQUE"
    }

    auth_security_events {
        int id PK "AUTO_INCREMENT"
        string event_type "이벤트 유형"
        string action "작업"
        string outcome "성공 또는 실패"
        string user_id FK "인덱스 [IDX]"
        string email "암호화 [E]"
        string email_hash "블라인드 인덱스 [BI] [IDX]"
        string ip_address "암호화 [E]"
        string user_agent "암호화 [E]"
        string metadata "JSON"
        datetime created_at "인덱스 [IDX]"
    }

    user_chat_sessions {
        int id PK "AUTO_INCREMENT"
        string user_id FK "인덱스 [IDX]"
        string title "세션 제목"
        string locale "ko | en | zh | ja"
        boolean is_auto_title "자동 생성 제목 여부"
        string memory_summary_text "암호화 [E]"
        int memory_token_estimate "추정 토큰 수"
        int summarized_message_count "요약된 메시지 수"
        string memory_model_used "사용된 모델명"
        datetime last_compacted_at "마지막 압축일시"
        datetime last_message_at "인덱스 [IDX]"
        datetime created_at "인덱스 [IDX]"
        datetime updated_at "인덱스 [IDX]"
    }

    user_chat_messages {
        int id PK "AUTO_INCREMENT"
        string user_id FK "인덱스 [IDX]"
        int session_id FK "인덱스 [IDX]"
        string role "user | assistant | system"
        string locale
        string content "AES-256-GCM 암호화 [E]"
        string provider_message_id
        string requested_model
        string resolved_model
        int prompt_tokens
        int completion_tokens
        int total_tokens
        int cached_prompt_tokens
        datetime included_in_memory_at "인덱스 [IDX]"
        datetime created_at "인덱스 [IDX]"
    }

    user_chat_memory {
        string user_id PK "users 참조"
        string summary_text "세션간 메모리 [E]"
        string assessment_text "사용자 프로필 평가 [E]"
        int summary_token_estimate
        int summarized_message_count
        int last_profile_message_id
        string model_used
        string profile_model_used
        datetime last_compacted_at
        datetime profile_refreshed_at
        datetime updated_at
    }

    user_chat_usage_daily {
        date metric_date PK "기준일자"
        string user_id PK "인덱스 [IDX]"
        int request_count "요청 수"
        int success_count "성공 수"
        int failure_count "실패 수"
        bigint prompt_tokens
        bigint completion_tokens
        bigint total_tokens
        bigint cached_prompt_tokens
        datetime last_used_at "인덱스 [IDX]"
    }

    user_chat_request_events {
        int id PK "AUTO_INCREMENT"
        string user_id FK "인덱스 [IDX]"
        int session_id FK "인덱스 [IDX]"
        string request_kind "인덱스 [IDX]"
        string status "인덱스 [IDX]"
        string locale
        string requested_model
        string resolved_model
        string provider_request_id
        int message_count
        int input_characters
        int output_characters
        int prompt_tokens
        int completion_tokens
        int total_tokens
        int cached_prompt_tokens
        int latency_ms "응답시간(ms)"
        string error_code
        string error_message
        datetime created_at "인덱스 [IDX]"
    }

    lab_decks {
        int id PK "AUTO_INCREMENT"
        string user_id FK "인덱스 [IDX]"
        string locale
        string title_text "덱 제목"
        string topic_text "덱 주제"
        string requested_model
        string resolved_model
        int card_count "카드 수"
        datetime created_at "인덱스 [IDX]"
        datetime updated_at
    }

    lab_cards {
        int id PK "AUTO_INCREMENT"
        int deck_id FK "인덱스 [IDX]"
        string user_id FK "인덱스 [IDX]"
        string term_text "어휘 단어"
        string meaning_text "의미 / 해석"
        string example_text "예문"
        string example_translation_text "예문 번역"
        string pos_text "품사"
        string tip_text "팁 / 비고"
        string learning_state "인덱스 [IDX]: 신규 | 학습중 | 복습 | 재학습"
        int consecutive_correct "연속 정답"
        int stage "FSRS 단계 (0-8)"
        double stability_days "FSRS 안정도"
        double difficulty "FSRS 난이도 (1-10)"
        int total_reviews "총 복습 횟수"
        int lapses "망각 횟수"
        int last_review_outcome "0=다시, 1=어려움, 2=좋음, 3=쉬움"
        datetime next_review_at "인덱스 [IDX]: FSRS 예정 복습일시"
        datetime last_reviewed_at "마지막 복습일시"
        datetime created_at
        datetime updated_at
    }

    lab_daily_usage {
        date metric_date PK "기준일자"
        string user_id PK "인덱스 [IDX]"
        int generation_count "생성 수"
        int review_count "복습 수"
        datetime created_at
        datetime updated_at
    }

    lab_ai_chat_sessions {
        int id PK "AUTO_INCREMENT"
        string user_id FK "인덱스 [IDX]"
        string title_text "세션 제목"
        string locale
        string memory_summary_text "메모리 요약"
        int memory_token_estimate
        int summarized_message_count
        string memory_model_used
        datetime last_compacted_at
        datetime last_message_at "인덱스 [IDX]"
        datetime created_at "인덱스 [IDX]"
        datetime updated_at "인덱스 [IDX]"
    }

    lab_ai_chat_messages {
        int id PK "AUTO_INCREMENT"
        string user_id FK "인덱스 [IDX]"
        int session_id FK "인덱스 [IDX]"
        string role "user | assistant"
        string locale
        string content "메시지 내용"
        string provider_message_id
        string requested_model
        string resolved_model
        int prompt_tokens
        int completion_tokens
        int total_tokens
        int cached_prompt_tokens
        datetime included_in_memory_at "인덱스 [IDX]"
        datetime created_at "인덱스 [IDX]"
    }

    lab_ai_chat_web_search_state {
        string user_id PK "복합 PK"
        int session_id PK "복합 PK"
        int session_call_count "세션 내 호출 수"
        int fallback_call_count "폴백 호출 수"
        string cache_query_text "캐시된 검색어"
        string cache_result_text "캐시된 결과"
        string cache_topic "검색 주제"
        string cache_time_range "검색 기간"
        date cache_start_date "검색 시작일"
        date cache_end_date "검색 종료일"
        int cache_result_count "캐시 결과 수"
        datetime cache_updated_at "인덱스 [IDX]"
        datetime created_at
        datetime updated_at "인덱스 [IDX]"
    }

    code_share_sessions {
        int id PK "AUTO_INCREMENT"
        string session_id "UNIQUE [IDX], 공개 세션 토큰"
        string owner_actor_id "인덱스 [IDX]: 게스트 행위자 UUID"
        string owner_user_id "인덱스 [IDX]: 인증 사용자 ID (선택)"
        string title_text "세션 제목"
        string language_code "언어: javascript | python | go 등"
        string code_text "코드 내용"
        string status "인덱스 [IDX]: 활성 | 종료"
        int version "낙관적 동시성 버전"
        datetime last_activity_at "인덱스 [IDX]"
        datetime closed_at "종료일시"
        datetime created_at
        datetime updated_at
    }

    llm_global_usage_daily {
        date metric_date PK "아시아/서울 기준일"
        int request_count "원자적 카운터 (FOR UPDATE)"
        int success_count
        int failure_count
        datetime last_used_at "인덱스 [IDX]"
    }

    llm_user_action_usage_daily {
        date metric_date PK "복합 PK"
        string user_id PK "복합 PK"
        string quota_key PK "복합 PK (예: chat_message)"
        int request_count
        int success_count
        int failure_count
        datetime last_used_at "인덱스 [IDX]"
    }

    analytics_daily_route_metrics {
        date metric_date PK "기준일자"
        string dimension_key PK "모든 차원의 SHA-256 해시"
        string route_kind "인덱스 [IDX]: 페이지 | API"
        string route_path "인덱스 [IDX]"
        string method "GET | POST | PUT | DELETE"
        int status_code "HTTP 상태코드"
        string status_group "2xx | 3xx | 4xx | 5xx"
        string auth_state "인증 상태"
        string device_type "기기 유형"
        string locale "언어"
        bigint request_count
        bigint unique_visitors
        bigint unique_users
        bigint total_duration_ms "총 소요시간(ms)"
        int peak_duration_ms "최대 소요시간(ms)"
        datetime first_seen_at "최초 기록일시"
        datetime last_seen_at "인덱스 [IDX]"
    }

    analytics_daily_unique_entities {
        date metric_date PK "기준일자"
        string dimension_key PK "복합 PK"
        string entity_type PK "복합 PK"
        string entity_hash PK "SHA-256, 복합 PK"
    }

    analytics_daily_actor_activity {
        date metric_date PK "기준일자"
        string actor_key PK "행위자 키"
        string actor_type "방문자 | 사용자"
        string user_id FK "인덱스 [IDX]"
        string auth_state "인증 상태"
        string device_type "기기 유형"
        string locale "언어"
        bigint page_view_count "페이지뷰 수"
        bigint api_request_count "API 요청 수"
        bigint mutation_count "변경 작업 수"
        bigint error_count "오류 수"
        datetime first_seen_at
        datetime last_seen_at "인덱스 [IDX]"
    }

    analytics_daily_page_context_metrics {
        date metric_date PK "기준일자"
        string dimension_key PK "차원 키"
        string route_path "인덱스 [IDX]"
        string auth_state "인증 상태"
        string device_type "기기 유형"
        string locale "언어"
        string theme "다크 | 라이트 | 시스템"
        string viewport_bucket "뷰포트 구간"
        string time_zone "시간대"
        string referrer_host "유입 호스트"
        string acquisition_channel "인덱스 [IDX]"
        string utm_source "UTM 소스"
        string utm_medium "UTM 매체"
        string utm_campaign "UTM 캠페인"
        bigint page_view_count
        bigint unique_visitors
        bigint unique_users
        bigint total_load_ms "총 로딩시간(ms)"
        int peak_load_ms "최대 로딩시간(ms)"
        datetime first_seen_at
        datetime last_seen_at "인덱스 [IDX]"
    }

    analytics_daily_consent_metrics {
        date metric_date PK "기준일자"
        string dimension_key PK "차원 키"
        string decision_source "인덱스 [IDX]: 배너 | 설정"
        string consent_state "인덱스 [IDX]: 동의 | 거부"
        string auth_state "인증 상태"
        string device_type "기기 유형"
        string locale "언어"
        bigint decision_count "결정 수"
        bigint unique_visitors
        bigint unique_users
        datetime first_seen_at
        datetime last_seen_at "인덱스 [IDX]"
    }

    jeonju_daily_briefings {
        int id PK "AUTO_INCREMENT"
        date briefing_date "UNIQUE"
        string content "다국어 브리핑 내용"
        string model_used "사용된 모델"
        datetime generated_at "생성일시"
        datetime created_at
    }

    jeonju_chat_messages {
        int id PK "AUTO_INCREMENT"
        string visitor_id "인덱스 [IDX]"
        string user_id "인덱스 [IDX]"
        string role "user | assistant"
        string content "메시지 내용"
        datetime created_at "인덱스 [IDX]"
    }

    users ||--o{ user_sessions : 보유
    users ||--o{ user_chat_sessions : 소유
    users ||--o{ user_chat_messages : 전송
    users ||--|| user_chat_memory : 보유
    users ||--o{ lab_decks : 소유
    users ||--o{ lab_cards : 소유
    users ||--o{ lab_ai_chat_sessions : 소유
    users ||--o{ lab_ai_chat_messages : 전송
    users ||--o{ llm_user_action_usage_daily : 소비
    users ||--o{ analytics_daily_actor_activity : 생성
    users ||--o{ code_share_sessions : 생성
    users ||--o{ jeonju_chat_messages : 작성
    
    user_chat_sessions ||--o{ user_chat_messages : 포함
    user_chat_sessions ||--o{ user_chat_request_events : 추적
    lab_decks ||--o{ lab_cards : 포함
    lab_ai_chat_sessions ||--o{ lab_ai_chat_messages : 포함
    lab_ai_chat_sessions ||--|| lab_ai_chat_web_search_state : 보유
```

---

## 5. 인증 흐름 — 시퀀스 다이어그램

```mermaid
sequenceDiagram
    actor User as 사용자
    participant Browser as React (클라이언트)
    participant Proxy as proxy.ts (속도 제한)
    participant AuthGuard as 요청 보안
    participant Validator as validation.ts (검증)
    participant Repository as auth/repository.ts
    participant Password as password.ts (scrypt)
    participant Crypto as data-protection.ts (AES-256-GCM)
    participant Cookie as session.ts
    participant DB as TiDB / MySQL

    Note over User,DB: 회원가입 흐름

    User->>Browser: 회원가입 폼 제출
    Browser->>Proxy: POST /api/auth/register

    Proxy->>AuthGuard: 요청 출처 및 헤더 확인
    Proxy->>Proxy: 속도 제한 확인: IP당 분당 20회
    alt 속도 제한 초과
        Proxy-->>Browser: 429 요청이 너무 많습니다
        Browser-->>User: "잠시 후 다시 시도해주세요"
    end

    AuthGuard->>Validator: 모든 필드 검증
    Validator->>Validator: NFKC 정규화, XSS 필터, 길이 검사
    Validator-->>AuthGuard: 검증된 페이로드

    AuthGuard->>Crypto: createBlindIndex(이메일)
    Crypto-->>AuthGuard: SHA-256(이메일 + 페퍼 + 컨텍스트)

    AuthGuard->>Repository: 블라인드 인덱스로 이메일 중복 확인
    Repository->>DB: SELECT WHERE email_hash = ?
    DB-->>Repository: 중복이면 409 반환

    AuthGuard->>Password: hashPassword(평문비밀번호, 페퍼)
    Password->>Password: scrypt(N=16384, r=8, p=1) 랜덤 솔트 사용
    Password-->>AuthGuard: password_hash, password_salt

    AuthGuard->>Crypto: encryptDatabaseValue() 모든 개인정보 필드 암호화
    Crypto->>Crypto: HKDF 키 파생 후 AES-256-GCM 암호화
    Crypto-->>AuthGuard: enc:v1:솔트:iv:태그:암호문

    AuthGuard->>Repository: 암호화된 행 INSERT
    AuthGuard->>Repository: 보안 이벤트 INSERT
    Repository->>DB: 트랜잭션 시작, INSERT, 커밋
    DB-->>Repository: 성공

    AuthGuard->>Cookie: createSessionRecord(사용자ID, UserAgent, IP)
    Cookie->>Cookie: 128비트 랜덤 토큰 생성, SHA-256 해싱
    Cookie->>DB: INSERT INTO user_sessions
    Cookie-->>Browser: Set-Cookie: nadeulhae_auth (HttpOnly, Secure, 7일)
    Browser-->>User: 홈으로 리디렉션

    Note over User,DB: 로그인 흐름

    User->>Browser: 로그인 폼 제출
    Browser->>Proxy: POST /api/auth/login

    Proxy->>AuthGuard: 블라인드 이메일 인덱스로 사용자 조회
    AuthGuard->>Crypto: createBlindIndex(이메일)
    AuthGuard->>DB: SELECT FROM users WHERE email_hash = ?

    alt 사용자 미발견 (블라인드 인덱스 불일치)
        AuthGuard->>Password: hashPassword(더미, 페퍼) (더미 해시 방어)
        Note over Password: 타이밍 기반 사용자 열거 공격 방지를 위해<br/>존재하지 않는 사용자도 항상 scrypt 실행
        AuthGuard-->>Browser: 401 잘못된 인증 정보
    end

    DB-->>AuthGuard: 암호화된 사용자 행

    AuthGuard->>DB: 속도 제한 버킷 확인 (15분당 10회)
    alt 속도 제한 버킷 초과
        AuthGuard->>DB: UPDATE blocked_until = NOW() + 15분
        AuthGuard-->>Browser: 429 너무 많은 시도
    end

    AuthGuard->>Password: verifyPassword(평문, 저장된해시, 저장된솔트)
    Password->>Password: scrypt + 타이밍 안전 비교
    alt 비밀번호 불일치
        AuthGuard->>DB: 시도 버킷 증가, 보안 이벤트 기록
        AuthGuard-->>Browser: 401 잘못된 인증 정보
    else 비밀번호 일치
        AuthGuard->>DB: 시도 버킷 초기화
        AuthGuard->>Cookie: 세션 생성, 쿠키 설정
        Cookie-->>Browser: 200 { user }
        Browser-->>User: 홈으로 리디렉션
    end

    Note over User,DB: 세션 검증 (모든 요청)

    Browser->>Proxy: GET /api/auth/me
    Proxy->>Cookie: nadeulhae_auth 쿠키 추출
    Cookie->>Cookie: SHA-256(토큰) 후 인메모리 캐시 확인 (15초 TTL)

    alt 캐시 적중 (유효)
        Cookie-->>Browser: 200 { user }
    else 캐시 미스
        Cookie->>DB: SELECT 세션 JOIN 사용자 WHERE token_hash AND expires_at
        alt 세션 유효 및 24시간 갱신 범위 내
            Cookie->>DB: UPDATE 세션 expires_at = NOW() + 7일 (갱신)
        end
        alt 세션 유효
            Cookie->>Cookie: 인메모리 캐시 쓰기
            Cookie-->>Browser: 200 { user }
        else 세션 만료 또는 무효
            Cookie->>Cookie: 캐시 항목 삭제
            Cookie-->>Browser: 401 인증 필요
        end
    end
```

---

## 6. 날씨 점수 파이프라인 — 액티비티 다이어그램

```mermaid
flowchart TD
    START(["클라이언트 날씨 요청"])

    GEO{"위치 정보 사용 가능?"}
    START --> GEO
    GEO -->|"예"| COORDS["GPS 좌표 획득 (WGS84)"]
    GEO -->|"아니오 / 타임아웃"| DEFAULT_COORDS["기본 좌표 사용 (전주시 중심)"]

    COORDS --> TM_CONV["proj4: WGS84 → TM 좌표 변환 (EPSG:4326 → EPSG:5181)"]
    DEFAULT_COORDS --> TM_CONV

    TM_CONV --> GRID_LOOKUP["KMA 격자 좌표 DB 조회 (grid_nx, grid_ny)"]

    GRID_LOOKUP --> PARALLEL_CALLS
    subgraph PARALLEL_CALLS["병렬 API 호출 (Promise.all)"]
        KMA_ULTRA["기상청 초단기예보: 기온(T1H), 강수확률(POP), 하늘(SKY), 풍속(WSD)"]
        KMA_SHORT["기상청 단기예보: 최고/최저기온, 강수량(RN1), 습도(REH)"]
        AIR_QUALITY["AirKorea: PM10, PM2.5, 통합대기지수(CAI), 오존(O3), 자외선(UV)"]
        APIHUB_ALERT["APIHub 기상특보: 태풍, 지진, 해일, 기상경보/주의보"]
        APIHUB_IMAGE["APIHub 이미지: 위성영상, 레이더영상, 지진정보도"]
    end

    KMA_ULTRA --> AGGREGATE
    KMA_SHORT --> AGGREGATE
    AIR_QUALITY --> AGGREGATE
    APIHUB_ALERT --> AGGREGATE
    APIHUB_IMAGE --> IMAGE_PROC

    AGGREGATE["데이터 병합 및 정규화 (weather-utils.ts)"]

    AGGREGATE --> SCORE_CALC
    subgraph SCORE_CALC["점수 계산 (0-100점)"]
        TEMP_SCORE["기온 점수: 18-24도 최적"]
        RAIN_SCORE["강수 점수: POP 30% 미만 만점"]
        DUST_SCORE["미세먼지 점수: PM2.5 15 미만 만점"]
        WIND_SCORE["바람 점수: 1-3m/s 최적"]
        SKY_SCORE["하늘 점수: 맑음 만점"]
        ALERT_PENALTY["특보 페널티: 경보 -20, 주의보 -10"]
    end

    TEMP_SCORE --> WEIGHTED_SUM
    RAIN_SCORE --> WEIGHTED_SUM
    DUST_SCORE --> WEIGHTED_SUM
    WIND_SCORE --> WEIGHTED_SUM
    SKY_SCORE --> WEIGHTED_SUM

    WEIGHTED_SUM["가중 평균 계산"]
    ALERT_PENALTY --> WEIGHTED_SUM
    WEIGHTED_SUM --> CLAMP["0-100 범위 제한 및 등급 분류 (86+:최고, 66+:좋음, 36+:보통, 0-35:나쁨)"]

    IMAGE_PROC["조건부 이미지 요청 (미세먼지, 안개, 태풍, 해일, 화산)"]

    CLAMP --> RESPONSE["API 응답: {점수, 상세정보, 메타데이터, 메시지, 이미지}"]
    IMAGE_PROC --> RESPONSE
    RESPONSE --> CLIENT(["클라이언트 렌더링: 히어로 점수, 애니메이션, 브리핑, 이미지"])
```

---

## 7. AI 채팅 흐름 — 시퀀스 다이어그램 (대시보드 & 랩)

```mermaid
sequenceDiagram
    actor User as 사용자
    participant Client as React 컴포넌트
    participant API as /api/chat 또는 /api/lab/ai-chat
    participant Session as auth/session.ts
    participant Quota as llm/quota.ts
    participant Memory as chat/repository.ts
    participant Prompt as chat/prompt.ts
    participant LLM as 범용 LLM / 실험실 LLM
    participant Tavily as Tavily API (랩 전용)
    participant DB as TiDB

    User->>Client: 메시지 입력 및 전송
    Client->>API: POST /api/chat { 세션ID, 메시지, 언어 }

    API->>Session: 세션 쿠키 검증
    Session-->>API: 사용자ID

    API->>Quota: reserveGlobalLlmDailyRequest(한도 5000)
    Quota->>DB: UPSERT + SELECT FOR UPDATE (원자적 증가)
    alt 전역 할당량 소진
        Quota-->>API: { 허용: false }
        API-->>Client: 429 일일 LLM 한도 도달
    end

    API->>Quota: reserveUserActionDailyRequest(사용자ID, chat_message, 한도 200)
    Quota->>DB: UPSERT + SELECT FOR UPDATE (날짜, 사용자ID, 할당키)
    alt 사용자 할당량 소진
        Quota-->>API: { 허용: false }
        API-->>Client: 429 일일 채팅 한도 도달 (200/일)
    end

    Quota-->>API: { 허용: true, 사용량 }

    API->>DB: 세션 조회 또는 생성
    API->>DB: 최근 메시지 조회 (컨텍스트 윈도우 제한)
    API->>DB: 세션간 메모리 조회 (user_chat_memory)

    API->>Prompt: 시스템 프롬프트 구성
    Prompt->>Prompt: 날씨 컨텍스트, 점수, 야외활동 추천 주입
    Prompt->>Prompt: 사용자 메모리 요약, 프로필 평가 주입
    Prompt->>Prompt: 언어별 지시사항 적용
    Prompt-->>API: 시스템 프롬프트 + 메시지 이력

    opt 랩 AI 채팅 웹 검색
        API->>Tavily: 검색(질의, 주제, 기간)
        Tavily-->>API: 검색 결과
        API->>DB: 결과를 web_search_state에 캐싱
        API->>Prompt: 검색 결과를 시스템 프롬프트에 주입
    end

    API->>LLM: POST /chat/completions (SSE 스트림)
    Note over API,LLM: SSE 스트리밍 (text/event-stream)

    loop SSE 이벤트
        LLM-->>API: 토큰 델타
        API-->>Client: { 내용, 완료: false }
        Client->>Client: 채팅 UI에 토큰 추가
    end

    LLM-->>API: data: [DONE]

    API->>DB: 사용자 메시지 INSERT (role=user)
    API->>DB: 어시스턴트 메시지 INSERT (role=assistant, 토큰 수 포함)
    API->>Quota: recordGlobalLlmRequestOutcome(성공=true)
    API->>DB: 요청 이벤트 로그 INSERT

    API->>Memory: 메모리 압축 필요 확인
    alt 컨텍스트가 임계값 초과 (메시지 50건 이상)
        API->>LLM: 대화 요약 생성
        LLM-->>API: 요약 텍스트
        API->>DB: 세션 memory_summary_text 갱신
        API->>DB: user_chat_memory 갱신 (세션간 메모리)
    end

    API-->>Client: { 완료: true, 사용량 }
    Client-->>User: 완성된 응답 표시
```

---

## 8. 코드 공유 협업 — 시퀀스 & 상태 다이어그램

### 8.1 협업 시퀀스

```mermaid
sequenceDiagram
    actor UserA as 사용자 A (소유자)
    actor UserB as 사용자 B (게스트)
    participant WSA as WebSocket A
    participant WSB as WebSocket B
    participant WS_Server as WebSocket 서버
    participant API as /api/code-share
    participant DB as TiDB

    Note over UserA,DB: 세션 설정

    UserA->>API: POST /api/code-share/sessions
    API->>DB: INSERT code_share_sessions (세션ID, 버전 1)
    DB-->>API: 세션
    API-->>UserA: { 세션ID, 버전 1 }

    UserA->>WSA: WebSocket 연결 /ws
    WSA->>WS_Server: { 유형: code_share_subscribe, 세션ID }
    WS_Server->>WS_Server: validateOrigin(), authenticateWs()
    WS_Server->>DB: getCodeShareSessionById()
    WS_Server->>WS_Server: joinRoom(ws, "code_share:abc123")
    WS_Server->>WS_Server: joinCodeSharePresence(세션ID, 행위자ID, 별칭)
    WS_Server-->>WSA: { 유형: code_share_presence, 인원: 1 }

    Note over UserA,DB: 사용자 B 입장

    UserB->>WSB: URL 열기 /code-share/abc123
    WSB->>WS_Server: { 유형: code_share_subscribe, 세션ID }
    WS_Server->>DB: getCodeShareSessionById("abc123")
    DB-->>WS_Server: 세션 (버전 1, 코드내용)
    WS_Server->>WS_Server: joinRoom(wsB, 방)
    WS_Server->>WS_Server: joinCodeSharePresence(세션ID, 게스트ID, 별칭)
    WS_Server-->>WSB: { 유형: code_share_presence, 인원: 2 }
    WS_Server-->>WSA: { 유형: code_share_presence, 인원: 2 }

    Note over UserA,DB: 실시간 편집

    UserA->>API: PATCH /api/code-share/sessions/abc123 {코드, 버전 1}
    API->>DB: UPDATE WHERE 버전 = 1, 버전 2로 설정

    par 낙관적 갱신 성공
        DB-->>API: 영향받은 행: 1
        API-->>UserA: 200 { 버전: 2 }
        UserA->>WSA: { 유형: code_share_saved, 세션ID, 버전 2 }
        WSA->>WS_Server: 방에 브로드캐스트
        WS_Server-->>WSB: { 유형: code_share_saved, 버전 2, 행위자 }
        WSB->>UserB: 편집기 내용 자동 갱신
    and 버전 충돌
        UserB->>API: 버전 1로 PATCH
        API->>DB: UPDATE WHERE 버전 = 1 (실패, 현재 버전 2)
        DB-->>API: 영향받은 행: 0
        API-->>UserB: 409 충돌 { 현재버전: 2 }
        UserB->>UserB: 최신 버전 로드 후 편집 재적용
    end

    Note over UserA,DB: 타이핑 표시

    UserA->>WSA: { 유형: code_share_typing, isTyping: true }
    WSA->>WS_Server: setCodeShareTyping(세션ID, 행위자A, true)
    WS_Server->>WS_Server: 7.5초 자동 해제 타이머 시작
    WS_Server-->>WSB: { 유형: code_share_presence, 타이핑: true }
    WSB-->>UserB: "사용자 A 입력 중..."

    Note over UserA,DB: 연결 해제

    UserB->>WSB: 탭 닫기 / 연결 해제
    WSB->>WS_Server: ws.on("close")
    WS_Server->>WS_Server: leaveCodeSharePresence(), leaveRoom(), removeClient()
    WS_Server-->>WSA: { 유형: code_share_presence, 인원: 1 }
    WSA-->>UserA: "사용자 B 연결 해제됨"
```

### 8.2 WebSocket 연결 생명주기 — 상태 머신

```mermaid
stateDiagram-v2
    [*] --> 연결중

    연결중 --> 출처확인 : TCP 연결 수립
    출처확인 --> 거부됨 : 유효하지 않은 출처 (종료 코드 4403)
    출처확인 --> 용량확인 : 출처 유효
    
    용량확인 --> 거부됨 : 최대 연결 초과 (종료 코드 4429)
    용량확인 --> 등록됨 : addClient() 성공
    
    등록됨 --> 인증확인 : authenticateWs() 시작
    등록됨 --> 브로드캐스트중 : broadcast user_count
    등록됨 --> 하트비트중 : setupHeartbeat()

    인증확인 --> 인증됨 : 세션 유효 (updateClientMeta)
    인증확인 --> 게스트 : 유효한 세션 없음

    state 인증됨 {
        대기 : 대기
        구독됨 : 구독됨 (code_share_subscribe)
        타이핑중 : 타이핑중 (code_share_typing)
        저장됨 : 저장됨 (code_share_saved)
        구독해지됨 : 구독 해지됨 (code_share_unsubscribe)
        타이핑타임아웃 : 타이핑 타임아웃 (7.5초)

        [*] --> 대기
        대기 --> 구독됨
        대기 --> 타이핑중
        구독됨 --> 저장됨
        저장됨 --> 구독됨
        구독됨 --> 구독해지됨
        구독됨 --> 타이핑중
        타이핑중 --> 구독됨 : isTyping false
        타이핑중 --> 타이핑타임아웃 : 7.5초간 갱신 없음
        타이핑타임아웃 --> 구독됨
    }

    state 게스트 {
        G_대기 : 대기
        G_구독됨 : 구독됨
        G_구독해지됨 : 구독 해지됨

        [*] --> G_대기
        G_대기 --> G_구독됨
        G_구독됨 --> G_구독해지됨
    }

    등록됨 --> 게스트
    
    하트비트중 --> 하트비트중 : 30초마다 ping
    하트비트중 --> 연결해제됨 : pong 타임아웃 60초

    등록됨 --> 연결해제됨 : ws.on close
    등록됨 --> 연결해제됨 : ws.on error
    
    연결해제됨 --> 정리 : cleanup()
    정리 --> [*] : leaveRoom, removeClient, 브로드캐스트

    거부됨 --> [*]
```

---

## 9. FSRS 간격 반복 학습 — 카드 상태 머신

```mermaid
stateDiagram-v2
    [*] --> 신규 : 카드 생성

    state 신규 {
        첫복습대기 : 첫 복습 대기 (next_review_at = NOW())
        [*] --> 첫복습대기
    }

    첫복습대기 --> 학습중 : 첫 복습 제출 (결과 좋음/쉬움)

    state 학습중 {
        학습채점 : 복습 제출됨
        다시학습 : 결과 다시 (망각, 단계 0으로 초기화)
        학습진행 : 결과 좋음 (단계+1, 안정도*2)
        복습전환 : 결과 좋음 AND 단계 >= 2

        [*] --> 학습채점
        학습채점 --> 다시학습
        학습채점 --> 학습진행
        학습채점 --> 복습전환
    }

    복습전환 --> 복습 : 복습 상태로 전환

    state 복습 {
        복습예정 : FSRS가 next_review_at 계산
        다시복습 : 결과 다시 (망각, 재학습으로 이동)
        복습통과 : 결과 어려움/좋음/쉬움 (통과)

        [*] --> 복습예정
        복습예정 --> 다시복습
        복습예정 --> 복습통과
        복습통과 --> 복습예정 : FSRS 재계산 (total_reviews++)
    }

    다시복습 --> 재학습 : learning_state가 relearning으로 변경

    state 재학습 {
        재학습단계 : 결과 좋음 (단계 1)
        재학습반복 : 결과 다시 (단계 0)
        복습복귀 : 단계 >= 2

        [*] --> 재학습단계
        재학습단계 --> 복습복귀
        재학습단계 --> 재학습반복
    }

    복습복귀 --> 복습 : learning_state가 review로 변경
```

---

## 10. 모듈 의존성 그래프

```mermaid
graph LR
    subgraph Frontend["프론트엔드 (브라우저)"]
        PAGES["app/ (페이지)"]
        COMPONENTS["components/ (컴포넌트)"]
        CONTEXT["context/ (인증, 언어)"]
        SERVICES["services/ (dataService.ts)"]
    end

    subgraph Backend["백엔드 로직"]
        AUTH_LIB["lib/auth/ (10개 파일)"]
        CHAT_LIB["lib/chat/ (7개 파일)"]
        LAB_LIB["lib/lab/ (7개 파일, FSRS)"]
        LAB_AI_LIB["lib/lab-ai-chat/ (6개 파일)"]
        CODE_SHARE_LIB["lib/code-share/ (5개 파일)"]
        WS_LIB["lib/websocket/ (3개 파일)"]
        LLM_QUOTA["lib/llm/ (quota.ts)"]
        ANALYTICS_LIB["lib/analytics/ (4개 파일)"]
    end

    subgraph Infrastructure["인프라스트럭처"]
        DB_LIB["lib/db.ts (MySQL2 풀)"]
        SECURITY_LIB["lib/security/ (AES-256-GCM + HKDF)"]
        LLM_CLIENT["lib/llm/ (OpenAI 호환 코어)"]
        TAVILY_LIB["lib/tavily/ (웹 검색)"]
        WEATHER_UTILS["lib/weather-utils.ts, lib/coords-utils.ts"]
        FORECAST_GRID["lib/forecast-location/ (KMA 격자 DB)"]
    end

    PAGES --> COMPONENTS
    PAGES --> CONTEXT
    COMPONENTS --> CONTEXT
    COMPONENTS --> SERVICES

    AUTH_LIB --> DB_LIB
    AUTH_LIB --> SECURITY_LIB
    CHAT_LIB --> DB_LIB
    CHAT_LIB --> AUTH_LIB
    CHAT_LIB --> GENERAL_LLM
    CHAT_LIB --> LLM_QUOTA
    LAB_LIB --> DB_LIB
    LAB_LIB --> LLM_QUOTA
    LAB_AI_LIB --> DB_LIB
    LAB_AI_LIB --> TAVILY_LIB
    LAB_AI_LIB --> LLM_QUOTA
    CODE_SHARE_LIB --> DB_LIB
    CODE_SHARE_LIB --> AUTH_LIB
    WS_LIB --> AUTH_LIB
    WS_LIB --> CODE_SHARE_LIB
    ANALYTICS_LIB --> DB_LIB

    SECURITY_LIB --> DB_LIB
    LLM_QUOTA --> DB_LIB

    SERVICES -->|fetch| PAGES
    CONTEXT -->|fetch| PAGES
```

---

## 11. API 라우트 맵 — 전체 엔드포인트

```mermaid
graph LR
    ROOT["API 라우트 (50+ 엔드포인트)"]

    subgraph AUTH["인증 /api/auth"]
        A_REG["POST 회원가입"]
        A_LOGIN["POST 로그인"]
        A_ME["GET 내정보"]
        A_OUT["POST 로그아웃"]
        A_PROF["GET 프로필"]
        A_UPROF["PUT 프로필수정"]
        A_DEL["DELETE 계정삭제"]
    end

    subgraph WX["날씨 /api/weather"]
        W_CUR["GET 현재날씨 (1391줄)"]
        W_FC["GET 예보"]
        W_IMG["GET 이미지"]
        W_AS["GET 이미지자산"]
        W_ARC["GET 과거기록"]
        W_TR["GET 추세분석"]
        W_IN["GET AI인사이트"]
        W_REC["POST 코스추천생성"]
    end

    subgraph FIRE["산불 /api/fire"]
        F_SUM["GET 요약"]
    end

    subgraph CHAT["채팅 /api/chat"]
        C_STATE["GET 상태"]
        C_SSE["POST SSE 스트리밍"]
        C_SESS_L["GET 세션목록"]
        C_SESS_C["POST 세션생성"]
        C_SESS_D["DELETE 세션삭제"]
    end

    subgraph LAB["랩 /api/lab"]
        L_DECKS_L["GET 덱목록"]
        L_DECKS_C["POST 덱생성"]
        L_CARDS_L["GET 카드목록"]
        L_CARDS_C["POST 카드생성"]
        L_AF["POST 자동완성"]
        L_GEN["POST AI덱생성"]
        L_REV["POST 단일복습"]
        L_REV_B["POST 일괄복습 (최대 50건)"]
        L_REP["GET 학습리포트"]
        L_IMP["POST 덱가져오기"]
        L_EXP["GET 덱내보내기"]
        L_TMPL["GET 템플릿"]
        L_ST["GET 랩상태"]
    end

    subgraph LABAI["랩 AI 채팅 /api/lab/ai-chat"]
        LA_SSE["POST SSE 스트리밍"]
        LA_SESS_L["GET 세션목록"]
        LA_SESS_C["POST 세션생성"]
    end

    subgraph CS["코드공유 /api/code-share"]
        CS_SESS_L["GET 세션목록"]
        CS_SESS_C["POST 세션생성"]
        CS_SESS_G["GET 세션상세"]
        CS_SESS_P["PATCH 세션수정"]
        CS_SESS_D["DELETE 세션삭제"]
    end

    subgraph JJ["전주 /api"]
        JJ_B["GET /jeonju/briefing"]
        JJ_C_L["GET /jeonju-chat"]
        JJ_C_C["POST /jeonju-chat"]
    end

    subgraph AN["분석 /api/analytics"]
        AN_PV["POST 페이지뷰"]
        AN_CN["POST 동의"]
    end

    ROOT --> AUTH
    ROOT --> WX
    ROOT --> FIRE
    ROOT --> CHAT
    ROOT --> LAB
    ROOT --> LABAI
    ROOT --> CS
    ROOT --> JJ
    ROOT --> AN
```

---

## 12. 속도 제한 및 할당량 아키텍처

```mermaid
flowchart TD
    REQ["수신 HTTP 요청"]

    subgraph L1["계층 1: 인메모리 (proxy.ts)"]
        L1_RATE["경로별 속도 제한 (Map)"]
        L1_RATE --> L1_CHECK{"한도 이내?"}
        L1_CHECK -->|"아니오"| L1_429["429 요청 과다 (Retry-After)"]
        L1_CHECK -->|"예"| L1_PASS["핸들러로 전달"]
    end

    REQ --> L1_RATE

    subgraph L2["계층 2: 인증 전용 DB"]
        L2_RATE["시도 버킷 (auth_attempt_buckets)"]
        L2_RATE --> L2_CHECK{"로그인: 15분당 10회, 회원가입: 시간당 5회"}
        L2_CHECK -->|"차단"| L2_429["429 + blocked_until"]
        L2_CHECK -->|"통과"| L2_PASS["진행"]
    end

    L1_PASS --> L2_RATE

    subgraph L3["계층 3: LLM 할당량 (llm/quota.ts)"]
        L3_GLOBAL["전역 일일 한도 (5000회/일)"]
        L3_USER["사용자별 작업별 한도 (100-200회/일)"]
        
        L3_GLOBAL --> L3_CHECK{"전역 요청 < 5000?"}
        L3_CHECK -->|"아니오"| L3_429["429 일일 LLM 한도 도달"]
        L3_CHECK -->|"예"| L3_USER
        
        L3_USER --> L3_UCHECK{"사용자 작업 요청 < 한도?"}
        L3_UCHECK -->|"아니오"| L3_429_USER["429 일일 한도 도달"]
        L3_UCHECK -->|"예"| L3_ALLOW["LLM 요청 진행 (원자적 증가)"]
    end

    L2_PASS --> L3_GLOBAL

    subgraph L4["계층 4: 랩 전용 할당량"]
        L4_WEB["웹 검색 월간 한도 (100회/월/사용자)"]
        L4_LAB["랩 생성 일일 한도 (30회/일/사용자)"]
    end

    L3_ALLOW --> L4_WEB
    L3_ALLOW --> L4_LAB
```

---

## 13. 데이터 암호화 아키텍처

```mermaid
flowchart LR
    W1["평문 값 (예: user@example.com)"]
    W2["HKDF로 마스터키에서 컨텍스트 키 파생"]
    W3["AES-256-GCM 암호화 (랜덤 IV + AAD)"]
    W4["블라인드 인덱스: HMAC-SHA256(평문, HKDF(MK, 컨텍스트.blind))"]
    W5["enc:v1:솔트:iv:태그:암호문 (Base64URL)"]

    W1 --> W2
    W2 --> W3
    W1 --> W3
    W3 --> W5
    W1 --> W4

    subgraph DB["데이터베이스 행"]
        DB_WRITE[("email: enc:v1:... / email_hash: a1b2c3...")]
    end

    W5 --> DB_WRITE
    W4 -.->|"복호화 없이 조회용 별도 컬럼에 저장"| DB_WRITE

    DB_WRITE --> R1["DB에서 암호화된 값 읽기"]
    R1 --> R2["버전, 솔트, IV, 태그, 암호문 추출"]
    R2 --> R3["HKDF로 컨텍스트 키 파생"]
    R3 --> R4["AES-256-GCM 복호화 (인증 태그 검증)"]
    R4 --> R5["평문 반환"]

    L1["검색 질의: 이메일로 사용자 찾기"]
    L2["블라인드 인덱스 HMAC-SHA256 계산"]
    L3["SELECT * FROM users WHERE email_hash = ?"]
    L1 --> L2
    L2 --> L3
    L3 --> DB_WRITE
```

---

## 14. 배포 아키텍처 (운영 환경)

```mermaid
graph TB
    USERS["최종 사용자"]

    subgraph Server["리눅스 서버 (PM2)"]
        NGINX["Nginx: 80→443 리다이렉트, SSL 종료, WebSocket 업그레이드, CSP/HSTS/CORS"]

        subgraph PM2["PM2 프로세스"]
            NODE["Node.js 프로세스 (tsx server.ts)"]
            NEXT["Next.js App Router (SSR + API 라우트 + 미들웨어)"]
            WS["WebSocket 서버 (코드공유 접속현황, 타이핑, 하트비트)"]
            SCHEDULER["브리핑 스케줄러 (전주 일일 브리핑)"]
            
            NODE --> NEXT
            NODE --> WS
            NODE --> SCHEDULER
        end
    end

    subgraph External["외부 서비스"]
        DB[("TiDB Cloud (MySQL 8 호환)")]
        GENERAL_LLM_EXT["범용 LLM API<br/>OpenAI 호환 (범용)"]
        LAB_LLM_EXT["실험실 LLM API<br/>OpenAI 호환 (실험실)"]
        TAVILY_EXT["Tavily 검색 API"]
        KMA_EXT["기상청 KMA API"]
        AIR_EXT["AirKorea API"]
        APIHUB_EXT["APIHub"]
    end

    USERS -- "HTTPS:443" --> NGINX
    NGINX -- "HTTP:3000" --> NODE
    NEXT --> DB
    WS --> DB
    SCHEDULER --> GENERAL_LLM_EXT
    SCHEDULER --> DB
    NEXT --> GENERAL_LLM_EXT
    NEXT --> LAB_LLM_EXT
    NEXT --> TAVILY_EXT
    NEXT --> KMA_EXT
    NEXT --> AIR_EXT
    NEXT --> APIHUB_EXT
```

---

## 15. 다국어 지원 아키텍처

```mermaid
flowchart TD
    LOCALE_DETECT["언어 감지: 사용자 설정, 브라우저 Accept-Language, 기본값: 한국어"]

    LOCALE_DETECT --> CONTEXT["LanguageContext (React 컨텍스트 프로바이더)"]

    CONTEXT --> LOCALE_FILES["번역 파일: data/locales/ko.ts, en.ts, zh.ts, ja.ts"]

    LOCALE_FILES --> T_FUNC["t(키, 시드?) 함수: 단일 문자열 또는 결정적 배열 변형. 폴백: 한국어 → 영어 → 키"]

    T_FUNC --> COMPONENTS["모든 컴포넌트에서 useLanguage() 훅으로 사용"]

    CONTEXT --> API_HEADER["API 요청: X-Locale 헤더 (LLM 프롬프트 및 유효성 검사 메시지에 사용)"]
```

---

## 16. 성능 최적화 — 기기 등급 감지

```mermaid
flowchart TD
    DETECT["기기 등급 감지 (performance.ts)"]

    DETECT --> CPU["navigator.hardwareConcurrency"]
    DETECT --> MEM["navigator.deviceMemory"]
    DETECT --> PREFERS["prefers-reduced-motion"]
    DETECT --> SAVEDATA["navigator.connection.saveData"]
    DETECT --> LOW_PWR["Battery API 상태"]

    CPU --> TIER{"기기 등급?"}
    MEM --> TIER

    TIER -->|"낮음"| LOW_SETTINGS["낮음: 파티클 0, 메테오 0, ShineBorder 비활성화, 모든 애니메이션 축소"]
    
    TIER -->|"중간"| MID_SETTINGS["중간: 파티클 10, 메테오 1, ShineBorder 감속, 마키 반복 1"]
    
    TIER -->|"높음"| HIGH_SETTINGS["높음: 파티클 20, 메테오 3, ShineBorder 전체, 모든 애니메이션 활성화"]
    
    PREFERS -->|"활성"| REDUCED["움직임 축소: 모든 애니메이션 비활성화 (framer-motion: reduced)"]
    
    SAVEDATA -->|"활성"| SAVE["데이터 절약 모드: 최소 시각 효과, 이미지 지연 로딩"]
    
    LOW_PWR -->|"낮음"| BATTERY_SAVE["배터리 절약: 파티클 수 50% 감소"]
```

---

## 17. 전주 브리핑 스케줄러 — 타이머 기반 생성

```mermaid
sequenceDiagram
    participant Server as server.ts
    participant Scheduler as jeonju-scheduler.ts
    participant LLM as 범용 LLM API
    participant DB as TiDB

    Server->>Scheduler: startJeonjuBriefingScheduler()
    Scheduler->>Scheduler: 다음 실행 시간 계산 (매일 KST 06:00)

    loop 매일 KST 06:00
        Scheduler->>Scheduler: setTimeout으로 다음 06:00까지 대기
        
        Scheduler->>DB: 오늘 브리핑 존재 확인
        alt 이미 생성됨
            DB-->>Scheduler: 브리핑 존재, 건너뜀
        else 미생성
            Scheduler->>Scheduler: 전주 날씨 및 이벤트 데이터 수집
            
            Scheduler->>LLM: 브리핑 생성 (다국어 템플릿 프롬프트)
            LLM-->>Scheduler: 브리핑 내용 (한국어, 영어, 중국어, 일본어)
            
            Scheduler->>DB: INSERT INTO jeonju_daily_briefings
            DB-->>Scheduler: 성공
            
            Scheduler->>Scheduler: WebSocket으로 브로드캐스트 (jeonju_briefing_updated)
        end
        
        Scheduler->>Scheduler: 다음 실행 예약

        opt 정리 작업 (KST 07:00)
            Scheduler->>DB: DELETE FROM jeonju_chat_messages WHERE created_at < NOW() - 7일
            Note over Scheduler,DB: 채팅 메시지 7일 보존 정책
        end
    end
```

---

## 요약

| 계층 | 핵심 기술 | 담당 모듈 |
|------|-----------|-----------|
| **프론트엔드** | React 19, Next.js 16 App Router, TailwindCSS 4, Framer Motion, CodeMirror 6 | `src/app/`, `src/components/`, `src/context/` |
| **보안** | AES-256-GCM (필드 단위 암호화), scrypt(N=16384) + 페퍼, HKDF, HMAC 블라인드 인덱스 | `src/lib/security/`, `src/lib/auth/` |
| **인증** | 쿠키 기반 세션 (7일 TTL), SHA-256 토큰 해시, 인메모리 LRU 캐시 | `src/lib/auth/session.ts`, `src/lib/auth/repository.ts` |
| **데이터베이스** | TiDB / MySQL 8, mysql2/promise, 20개 테이블 | `src/lib/db.ts`, 각 도메인 `schema.ts` |
| **AI** | OpenAI 호환 LLM (범용 + 실험실), SSE 스트리밍, 날씨 컨텍스트 프롬프트 주입 | `src/lib/llm/`, `src/lib/chat/`, `src/lib/lab-ai-chat/` |
| **속도 제한** | 3계층: 인메모리 (proxy.ts) → DB 시도 버킷 → LLM 할당량 (FOR UPDATE) | `src/proxy.ts`, `src/lib/llm/quota.ts`, `src/lib/auth/repository.ts` |
| **WebSocket** | ws 라이브러리, 방 기반 Pub/Sub, 접속현황 추적, 하트비트, 타이핑 표시 | `src/lib/websocket/` |
| **간격 반복 학습** | FSRS v5 알고리즘 (안정도, 난이도, 상태 머신) | `src/lib/lab/` |
| **검색** | Tavily API, 결과 캐싱, 월간 할당량 | `src/lib/tavily/`, `src/lib/lab-ai-chat/` |
| **다국어** | 4개 언어 (한국어/영어/중국어/일본어), 결정적 배열 변형 선택 | `src/context/LanguageContext.tsx`, `src/data/locales/` |
| **분석** | 개인정보보호 우선, 동의 기반, 다차원 메트릭 | `src/lib/analytics/` |
| **배포** | PM2 + Nginx, 단일 Node.js 프로세스 (HTTP + WS), TiDB Cloud | `server.ts`, Nginx 설정 |
