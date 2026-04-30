# 나들해 (Nadeulhae) — Architecture & UML Documentation

> **Version**: 0.1.0 | **Framework**: Next.js 16.2.4 (App Router) | **Language**: TypeScript 6.0

---

## 1. 프로젝트 개요 (Project Overview)

**Nadeulhae**("나들이" + "해")는 **날씨 기반 야외활동 점수 서비스 + AI Chat + 코드 공유 플랫폼**이다. 전주시를 중심으로 기상청(KMA)·한국환경공단(AirKorea)·APIHub의 실시간 데이터를 결합해 0~100점의 피크닉 지수를 산출하고, NanoGPT/FactChat 기반의 AI 채팅, FSRS 알고리즘을 활용한 어휘 암기(Lab), 그리고 WebSocket 기반 실시간 협업 코드 에디터를 제공한다.

---

## 2. System Architecture — Deployment Diagram

```mermaid
graph TB
    subgraph "User Device"
        BROWSER["Web Browser<br/>(React SPA)"]
    end

    subgraph "Edge / CDN"
        NGINX["Nginx Reverse Proxy<br/>- SSL Termination<br/>- Static Caching<br/>- WebSocket Upgrade<br/>- CSP/HTST Headers"]
    end

    subgraph "Application Server (Node.js)"
        direction TB
        S_TS["server.ts<br/>Custom HTTP + WS Server"]
        
        subgraph "Next.js App Router"
            MIDDLE["proxy.ts<br/>Rate Limit / Security"]
            PAGES["SSR Pages<br/>Dashboard / Lab / Jeonju / Statistics"]
            API["API Routes (50+)<br/>auth, weather, chat, lab, code-share, jeonju, analytics"]
        end

        WSS["WebSocket Server<br/>Code Share Presence<br/>Collaboration / Typing / Heartbeat"]
        
        SCHEDULER["Jeonju Briefing Scheduler<br/>Daily AI Briefing Generator"]

        S_TS --> MIDDLE
        MIDDLE --> PAGES
        MIDDLE --> API
        S_TS --> WSS
        S_TS --> SCHEDULER
    end

    subgraph "Persistence Layer"
        TIDB[("TiDB / MySQL 8<br/>20 Tables")]
    end

    subgraph "External APIs"
        KMA["기상청 KMA<br/>초단기예보 / 단기예보 / 중기예보"]
        AIR["AirKorea<br/>PM10 / PM2.5 / 통합대기지수"]
        APIHUB["APIHub<br/>기상특보 / 위성/레이더/지진 이미지"]
        NANOGPT["NanoGPT API<br/>OpenAI-compatible LLM<br/>(Primary)"]
        FACTCHAT["FactChat API<br/>SAIT 3 Pro<br/>(Fallback)"]
        TAVILY["Tavily API<br/>Web Search"]
    end

    BROWSER -- HTTPS --> NGINX
    NGINX -- HTTP/WS --> S_TS
    API --> TIDB
    WSS -- Session Auth --> TIDB
    API --> KMA
    API --> AIR
    API --> APIHUB
    API --> NANOGPT
    API --> FACTCHAT
    API --> TAVILY
    SCHEDULER --> NANOGPT
    SCHEDULER --> TIDB
```

---

## 3. Frontend Component Hierarchy — Component Tree

```mermaid
graph TD
    ROOT["RootLayout<br/>layout.tsx"]
    
    LP["LanguageProvider<br/>ko / en / zh / ja"]
    TP["ThemeProvider<br/>dark / light / system"]
    AP["AuthProvider<br/>loading / guest / authenticated"]
    
    ROOT --> LP
    LP --> TP
    TP --> AP
    
    PVT["PageViewTracker<br/>Analytics"]
    ACB["AnalyticsConsentBanner<br/>Consent Management"]
    NAV["Navbar<br/>Logo / Auth Status / Theme Toggle / Language Switch"]
    
    AP --> PVT
    AP --> ACB
    AP --> NAV
    AP --> PAGES

    subgraph "Pages"
        HOME["Home (/)<br/>│ Particles / Meteors<br/>│ WordPullUp Hero<br/>│ MagicCard Score (0-100)<br/>│ Quick Metrics (Temp, Hum, Wind, Dust, UV)"]
        
        HOME_COMP["Home Sub-Components<br/>│ TodayHourlyForecast<br/>│ PicnicBriefing<br/>│ FireInsightPanel<br/>│ WeatherImagePanel"]
        
        DASH["Dashboard (/dashboard)<br/>│ DashboardChatPanel<br/>│ Session List / Chat Stream"]
        
        LAB_HUB["Lab Hub (/lab)<br/>│ Performance Detection (Device Tier)"]
        LAB_VOCAB["Lab Vocab (/lab/vocab)<br/>│ VocabReportPanel<br/>│ Card Review UI<br/>│ Deck Management"]
        LAB_AI["Lab AI Chat (/lab/ai-chat)<br/>│ LabAiChatPanel<br/>│ Web Search Toggle"]
        LAB_CS["Lab Code Share (/lab/code-share)<br/>│ CodeShareHub<br/>│ Session List"]
        
        CS_EDITOR["Code Share Editor<br/>(/code-share/[sessionId])<br/>│ CodeMirror Editor (12 langs)<br/>│ CodeShareWorkspace<br/>│ Presence / Typing Indicators"]
        
        JEONJU["Jeonju (/jeonju)<br/>│ JeonjuDailyBriefing<br/>│ JeonjuChatPanel<br/>│ JeonjuSafetyPanel"]
        
        STATS["Statistics (/statistics/calendar)<br/>│ PicnicCalendar<br/>│ Historical Weather"]
        
        AUTH_PAGES["Auth Pages<br/>│ Login / Signup / Account / Terms / About"]
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

## 4. Database Schema — Entity-Relationship Diagram (ERD)

> **범례**  
> 🔒 = AES-256-GCM 암호화 필드  
> 🏷️ = Blind Index (HMAC-SHA256) 검색용  
> ⚡ = Indexed column

```mermaid
erDiagram
    users {
        CHAR36 id PK "UUID"
        VARCHAR700 email 🔒 "AES-256-GCM"
        CHAR64 email_hash 🏷️⚡ "HMAC-SHA256 Blind Index | UNIQUE"
        VARCHAR255 display_name 🔒 "화면 표시 이름"
        VARCHAR700 nickname 🔒 "닉네임"
        CHAR64 nickname_hash 🏷️⚡ "Blind Index | UNIQUE with tag"
        CHAR4 nickname_tag "랜덤 4자리 태그 (중복방지)"
        CHAR128 password_hash "scrypt(N=16384)"
        CHAR32 password_salt "scrypt salt"
        VARCHAR24 password_algo "scrypt-v1"
        VARCHAR700 age_band 🔒 "연령대"
        VARCHAR700 primary_region 🔒 "주 활동 지역"
        LONGTEXT interest_tags 🔒 "JSON 관심사 배열"
        VARCHAR512 interest_other 🔒 "기타 관심사"
        VARCHAR700 preferred_time_slot 🔒 "선호 시간대"
        LONGTEXT weather_sensitivity 🔒 "JSON 날씨 민감도 배열"
        DATETIME terms_agreed_at
        DATETIME privacy_agreed_at
        DATETIME age_confirmed_at
        TINYINT1 marketing_accepted
        TINYINT1 analytics_accepted
        TINYINT1 lab_enabled "Lab 기능 활성화 여부"
        DATETIME created_at
        DATETIME updated_at
    }

    user_sessions {
        CHAR36 id PK "UUID"
        CHAR36 user_id FK ⚡
        CHAR64 token_hash ⚡ "SHA-256(Session Token) | UNIQUE"
        DATETIME expires_at ⚡
        VARCHAR700 user_agent 🔒
        VARCHAR700 ip_address 🔒
        DATETIME created_at
        DATETIME last_used_at
    }

    auth_attempt_buckets {
        BIGINT id PK "AUTO_INCREMENT"
        VARCHAR32 action "login | register | etc"
        VARCHAR191 scope_key "IP or email_hash"
        INT attempt_count
        DATETIME window_started_at
        DATETIME blocked_until ⚡
        DATETIME last_attempt_at
        UNIQUE action_scope UNIQUE "action, scope_key"
    }

    auth_security_events {
        BIGINT id PK "AUTO_INCREMENT"
        VARCHAR48 event_type
        VARCHAR24 action
        VARCHAR24 outcome "success | failure"
        CHAR36 user_id FK ⚡
        VARCHAR700 email 🔒
        CHAR64 email_hash 🏷️⚡
        VARCHAR700 ip_address 🔒
        VARCHAR700 user_agent 🔒
        JSON metadata
        DATETIME created_at ⚡
    }

    user_chat_sessions {
        BIGINT id PK "AUTO_INCREMENT"
        CHAR36 user_id FK ⚡
        VARCHAR512 title
        VARCHAR8 locale "ko | en | zh | ja"
        TINYINT1 is_auto_title
        LONGTEXT memory_summary_text 🔒 "Context summary"
        INT memory_token_estimate
        INT summarized_message_count
        VARCHAR120 memory_model_used
        DATETIME last_compacted_at
        DATETIME last_message_at ⚡
        DATETIME created_at ⚡
        DATETIME updated_at ⚡
    }

    user_chat_messages {
        BIGINT id PK "AUTO_INCREMENT"
        CHAR36 user_id FK ⚡
        BIGINT session_id FK ⚡
        VARCHAR16 role "user | assistant | system"
        VARCHAR8 locale
        LONGTEXT content 🔒 "AES-256-GCM"
        VARCHAR128 provider_message_id
        VARCHAR120 requested_model
        VARCHAR120 resolved_model
        INT prompt_tokens
        INT completion_tokens
        INT total_tokens
        INT cached_prompt_tokens
        DATETIME included_in_memory_at ⚡
        DATETIME created_at ⚡
    }

    user_chat_memory {
        CHAR36 user_id PK "FK to users"
        LONGTEXT summary_text 🔒 "Cross-session memory"
        LONGTEXT assessment_text 🔒 "User profile assessment"
        INT summary_token_estimate
        INT summarized_message_count
        BIGINT last_profile_message_id
        VARCHAR120 model_used
        VARCHAR120 profile_model_used
        DATETIME last_compacted_at
        DATETIME profile_refreshed_at
        DATETIME updated_at
    }

    user_chat_usage_daily {
        DATE metric_date PK
        CHAR36 user_id PK ⚡
        INT request_count
        INT success_count
        INT failure_count
        BIGINT prompt_tokens
        BIGINT completion_tokens
        BIGINT total_tokens
        BIGINT cached_prompt_tokens
        DATETIME last_used_at ⚡
    }

    user_chat_request_events {
        BIGINT id PK "AUTO_INCREMENT"
        CHAR36 user_id FK ⚡
        BIGINT session_id FK ⚡
        VARCHAR16 request_kind ⚡
        VARCHAR24 status ⚡
        VARCHAR8 locale
        VARCHAR120 requested_model
        VARCHAR120 resolved_model
        VARCHAR128 provider_request_id
        INT message_count
        INT input_characters
        INT output_characters
        INT prompt_tokens
        INT completion_tokens
        INT total_tokens
        INT cached_prompt_tokens
        INT latency_ms
        VARCHAR64 error_code
        VARCHAR255 error_message
        DATETIME created_at ⚡
    }

    lab_decks {
        BIGINT id PK "AUTO_INCREMENT"
        CHAR36 user_id FK ⚡
        VARCHAR8 locale
        LONGTEXT title_text
        LONGTEXT topic_text
        VARCHAR191 requested_model
        VARCHAR191 resolved_model
        INT card_count
        DATETIME created_at ⚡
        DATETIME updated_at
    }

    lab_cards {
        BIGINT id PK "AUTO_INCREMENT"
        BIGINT deck_id FK ⚡
        CHAR36 user_id FK ⚡
        LONGTEXT term_text "어휘 단어"
        LONGTEXT meaning_text "의미/해석"
        LONGTEXT example_text "예문"
        LONGTEXT example_translation_text "예문 번역"
        LONGTEXT pos_text "품사"
        LONGTEXT tip_text "팁/비고"
        VARCHAR16 learning_state ⚡ "new | learning | review | relearning"
        TINYINT consecutive_correct
        TINYINT stage "0-8 (FSRS)" 
        DOUBLE stability_days "FSRS stability"
        DOUBLE difficulty "FSRS difficulty (1-10)"
        INT total_reviews
        INT lapses
        TINYINT last_review_outcome "0=again, 1=hard, 2=good, 3=easy"
        DATETIME next_review_at ⚡ "FSRS scheduled review time"
        DATETIME last_reviewed_at
        DATETIME created_at
        DATETIME updated_at
    }

    lab_daily_usage {
        DATE metric_date PK
        CHAR36 user_id PK ⚡
        INT generation_count
        INT review_count
        DATETIME created_at
        DATETIME updated_at
    }

    lab_ai_chat_sessions {
        BIGINT id PK "AUTO_INCREMENT"
        CHAR36 user_id FK ⚡
        LONGTEXT title_text
        VARCHAR8 locale
        LONGTEXT memory_summary_text
        INT memory_token_estimate
        INT summarized_message_count
        VARCHAR191 memory_model_used
        DATETIME last_compacted_at
        DATETIME last_message_at ⚡
        DATETIME created_at ⚡
        DATETIME updated_at ⚡
    }

    lab_ai_chat_messages {
        BIGINT id PK "AUTO_INCREMENT"
        CHAR36 user_id FK ⚡
        BIGINT session_id FK ⚡
        VARCHAR16 role
        VARCHAR8 locale
        LONGTEXT content
        VARCHAR128 provider_message_id
        VARCHAR191 requested_model
        VARCHAR191 resolved_model
        INT prompt_tokens
        INT completion_tokens
        INT total_tokens
        INT cached_prompt_tokens
        DATETIME included_in_memory_at ⚡
        DATETIME created_at ⚡
    }

    lab_ai_chat_web_search_state {
        CHAR36 user_id PK "FK to users"
        BIGINT session_id PK "Composite PK"
        INT session_call_count
        INT fallback_call_count
        LONGTEXT cache_query_text
        LONGTEXT cache_result_text
        VARCHAR16 cache_topic
        VARCHAR16 cache_time_range
        DATE cache_start_date
        DATE cache_end_date
        INT cache_result_count
        DATETIME cache_updated_at ⚡
        DATETIME created_at
        DATETIME updated_at ⚡
    }

    code_share_sessions {
        BIGINT id PK "AUTO_INCREMENT"
        VARCHAR48 session_id UK ⚡ "UNIQUE, public session token"
        CHAR36 owner_actor_id ⚡ "Guest actor UUID"
        CHAR36 owner_user_id ⚡ "Optional auth user ID"
        VARCHAR191 title_text
        VARCHAR64 language_code "javascript | python | go | etc."
        LONGTEXT code_text "Code content"
        VARCHAR16 status ⚡ "active | closed"
        INT version "Optimistic concurrency"
        DATETIME last_activity_at ⚡
        DATETIME closed_at
        DATETIME created_at
        DATETIME updated_at
    }

    llm_global_usage_daily {
        DATE metric_date PK "Asia/Seoul date"
        INT request_count "Atomic counter (FOR UPDATE)"
        INT success_count
        INT failure_count
        DATETIME last_used_at ⚡
    }

    llm_user_action_usage_daily {
        DATE metric_date PK "Composite PK"
        CHAR36 user_id PK "Composite PK"
        VARCHAR64 quota_key PK "Composite PK | e.g. 'chat_message'"
        INT request_count
        INT success_count
        INT failure_count
        DATETIME last_used_at ⚡
    }

    analytics_daily_route_metrics {
        DATE metric_date PK
        CHAR64 dimension_key PK "SHA-256 hash of all dims"
        VARCHAR16 route_kind ⚡ "page | api"
        VARCHAR191 route_path ⚡
        VARCHAR16 method "GET | POST | PUT | DELETE"
        SMALLINT status_code
        VARCHAR8 status_group "2xx | 3xx | 4xx | 5xx"
        VARCHAR16 auth_state
        VARCHAR16 device_type
        VARCHAR8 locale
        BIGINT request_count
        BIGINT unique_visitors
        BIGINT unique_users
        BIGINT total_duration_ms
        INT peak_duration_ms
        DATETIME first_seen_at
        DATETIME last_seen_at ⚡
    }

    analytics_daily_unique_entities {
        DATE metric_date PK
        CHAR64 dimension_key PK "Composite PK"
        VARCHAR16 entity_type PK "Composite PK"
        CHAR64 entity_hash PK "SHA-256 | Composite PK"
    }

    analytics_daily_actor_activity {
        DATE metric_date PK
        CHAR64 actor_key PK
        VARCHAR16 actor_type "visitor | user"
        CHAR36 user_id FK ⚡
        VARCHAR16 auth_state
        VARCHAR16 device_type
        VARCHAR8 locale
        BIGINT page_view_count
        BIGINT api_request_count
        BIGINT mutation_count
        BIGINT error_count
        DATETIME first_seen_at
        DATETIME last_seen_at ⚡
    }

    analytics_daily_page_context_metrics {
        DATE metric_date PK
        CHAR64 dimension_key PK
        VARCHAR191 route_path ⚡
        VARCHAR16 auth_state
        VARCHAR16 device_type
        VARCHAR8 locale
        VARCHAR16 theme "dark | light | system"
        VARCHAR16 viewport_bucket
        VARCHAR48 time_zone
        VARCHAR191 referrer_host
        VARCHAR32 acquisition_channel ⚡
        VARCHAR80 utm_source
        VARCHAR80 utm_medium
        VARCHAR120 utm_campaign
        BIGINT page_view_count
        BIGINT unique_visitors
        BIGINT unique_users
        BIGINT total_load_ms
        INT peak_load_ms
        DATETIME first_seen_at
        DATETIME last_seen_at ⚡
    }

    analytics_daily_consent_metrics {
        DATE metric_date PK
        CHAR64 dimension_key PK
        VARCHAR24 decision_source ⚡ "banner | settings | landing"
        VARCHAR16 consent_state ⚡ "accepted | rejected"
        VARCHAR16 auth_state
        VARCHAR16 device_type
        VARCHAR8 locale
        BIGINT decision_count
        BIGINT unique_visitors
        BIGINT unique_users
        DATETIME first_seen_at
        DATETIME last_seen_at ⚡
    }

    jeonju_daily_briefings {
        BIGINT id PK "AUTO_INCREMENT"
        DATE briefing_date
        LONGTEXT content
        VARCHAR120 model_used
        DATETIME generated_at
        DATETIME created_at
        UNIQUE date_ix UNIQUE "briefing_date"
    }

    jeonju_chat_messages {
        BIGINT id PK "AUTO_INCREMENT"
        VARCHAR36 visitor_id ⚡
        CHAR36 user_id ⚡
        VARCHAR16 role
        LONGTEXT content
        DATETIME created_at ⚡
    }

    %% ----- Relationships -----
    users ||--o{ user_sessions : "has"
    users ||--o{ user_chat_sessions : "owns"
    users ||--o{ user_chat_messages : "sends"
    users ||--|| user_chat_memory : "has"
    users ||--o{ lab_decks : "owns"
    users ||--o{ lab_cards : "owns"
    users ||--o{ lab_ai_chat_sessions : "owns"
    users ||--o{ lab_ai_chat_messages : "sends"
    users ||--o{ llm_user_action_usage_daily : "consumes"
    users ||--o{ analytics_daily_actor_activity : "generates"
    users ||--o{ code_share_sessions : "creates"
    users ||--o{ jeonju_chat_messages : "writes"
    
    user_chat_sessions ||--o{ user_chat_messages : "contains"
    user_chat_sessions ||--o{ user_chat_request_events : "tracks"
    lab_decks ||--o{ lab_cards : "contains"
    lab_ai_chat_sessions ||--o{ lab_ai_chat_messages : "contains"
    lab_ai_chat_sessions ||--|| lab_ai_chat_web_search_state : "has"
```

---

## 5. Authentication Flow — Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant Browser as React (Client)
    participant Proxy as proxy.ts (Rate Limit)
    participant AuthGuard as Request Security
    participant Validator as validation.ts
    participant Repository as auth/repository.ts
    participant Password as password.ts (scrypt)
    participant Crypto as data-protection.ts (AES-256-GCM)
    participant Cookie as session.ts
    participant DB as TiDB / MySQL

    %% ------ REGISTRATION ------
    Note over User,DB: ======= REGISTRATION FLOW =======
    
    User->>Browser: Submit Registration Form
    Browser->>Proxy: POST /api/auth/register {email, password, nickname, ...}
    
    Proxy->>AuthGuard: Check origin & request headers
    Proxy->>Proxy: Rate Limit Check: 20/min per IP
    alt Rate Limit Exceeded
        Proxy-->>Browser: 429 Too Many Requests
        Browser-->>User: "잠시 후 다시 시도해주세요"
    end

    AuthGuard->>Validator: Validate all fields
    Validator->>Validator: NFKC Normalization, XSS filter, length checks
    Validator-->>AuthGuard: Validated payload { email, password, displayName, ... }

    AuthGuard->>Crypto: createBlindIndex(email) → email_hash
    Crypto-->>AuthGuard: SHA-256(email || pepper || context)

    AuthGuard->>Repository: Check email uniqueness via blind index
    Repository->>DB: SELECT ... WHERE email_hash = ?
    DB-->>Repository: Conflict? → 409

    AuthGuard->>Password: hashPassword(plainPassword, pepper)
    Password->>Password: scrypt(N=16384, r=8, p=1) with random salt
    Password-->>AuthGuard: password_hash, password_salt

    AuthGuard->>Crypto: encryptDatabaseValue() on ALL PII fields
    Crypto->>Crypto: HKDF derive key from context → AES-256-GCM encrypt
    Crypto-->>AuthGuard: "enc:v1:<salt>:<iv>:<tag>:<ciphertext>"

    AuthGuard->>Repository: INSERT encrypted row into users
    AuthGuard->>Repository: INSERT security event (event_type=register, outcome=success)
    Repository->>DB: BEGIN TRAN → INSERT users → INSERT security event → COMMIT
    DB-->>Repository: OK

    AuthGuard->>Cookie: createSessionRecord(userId, userAgent, ip)
    Cookie->>Cookie: Generate 128-bit random token → SHA-256(token) → token_hash
    Cookie->>DB: INSERT INTO user_sessions
    Cookie-->>Browser: Set-Cookie: nadeulhae_auth=<token>; HttpOnly; Secure; SameSite=Lax; Max-Age=7d
    Browser-->>User: Redirect to Home

    %% ------ LOGIN ------
    Note over User,DB: ======= LOGIN FLOW =======

    User->>Browser: Submit Login Form
    Browser->>Proxy: POST /api/auth/login {email, password}
    Proxy->>Proxy: Rate Limit: 20/min per IP

    Proxy->>AuthGuard: Lookup user by blind email index
    AuthGuard->>Crypto: createBlindIndex(email) → email_hash
    AuthGuard->>DB: SELECT * FROM users WHERE email_hash = ?

    alt User not found (Blind Index miss)
        AuthGuard->>Password: hashPassword(dummy, pepper) — Dummy hash defense
        Note over Password: Always runs scrypt even for non-existent users<br/>to prevent timing-based user enumeration
        AuthGuard-->>Browser: 401 Invalid credentials (same timing as success)
    end

    DB-->>AuthGuard: Encrypted user row

    AuthGuard->>DB: Check rate limit bucket (10 attempts / 15min)
    alt Rate limit bucket full
        AuthGuard->>DB: UPDATE blocked_until = NOW() + 15min
        AuthGuard-->>Browser: 429 "Too many attempts, try again later"
    end

    AuthGuard->>Password: verifyPassword(plainPassword, storedHash, storedSalt)
    Password->>Password: scrypt(plainPassword, salt) → Timing-safe comparison
    alt Password mismatch
        AuthGuard->>DB: Increment attempt bucket → Log security event
        AuthGuard-->>Browser: 401 Invalid credentials
    else Password matches
        AuthGuard->>DB: Reset attempt bucket
        AuthGuard->>Cookie: Create session → Set-Cookie
        Cookie-->>Browser: Set-Cookie + 200 { user }
        Browser-->>User: Redirect to Home
    end

    %% ------ SESSION VALIDATION ------
    Note over User,DB: ======= SESSION VALIDATION (Every Request) =======

    Browser->>Proxy: GET /api/auth/me
    Proxy->>Cookie: Extract nadeulhae_auth cookie
    Cookie->>Cookie: SHA-256(token) → token_hash
    Cookie->>Cookie: Check In-Memory Cache (15s TTL)

    alt Cache Hit (valid)
        Cookie-->>Browser: 200 { user }
    else Cache Miss
        Cookie->>DB: SELECT session JOIN users WHERE token_hash = ? AND expires_at > NOW()
        alt Session valid & within 24h refresh window
            Cookie->>DB: UPDATE session SET expires_at = NOW() + 7d (refresh)
        end
        alt Session valid
            Cookie->>Cookie: Write to In-Memory Cache
            Cookie-->>Browser: 200 { user }
        else Session expired or invalid
            Cookie->>Cookie: Clear cache entry
            Cookie-->>Browser: 401 Unauthorized
        end
    end
```

---

## 6. Weather Score Pipeline — Activity Diagram

```mermaid
flowchart TD
    START([Client requests weather])
    GEO{Gelocation Available?}
    
    START --> GEO
    GEO -->|Yes| COORDS[Get GPS Coordinates<br/>lat: WGS84, lon: WGS84]
    GEO -->|No / Timeout| DEFAULT_COORDS[Use Default Coordinates<br/>Jeonju City Center]

    COORDS --> TM_CONV["proj4: WGS84 → TM 좌표 변환<br/>(EPSG:4326 → EPSG:5181)"]
    DEFAULT_COORDS --> TM_CONV

    TM_CONV --> GRID_LOOKUP["forecast-location/repository.ts<br/>KMA 격자 좌표 조회<br/>(grid_nx, grid_ny)"]

    GRID_LOOKUP --> PARALLEL_CALLS
    subgraph PARALLEL_CALLS["Parallel API Calls (Promise.all)"]
        KMA_ULTRA["KMA 초단기예보<br/>- 기온(T1H)<br/>- 강수확률(POP)<br/>- 하늘상태(SKY)<br/>- 풍속(WSD)"]
        KMA_SHORT["KMA 단기예보<br/>- 최고/최저 기온<br/>- 강수량(RN1)<br/>- 습도(REH)"]
        AIR_QUALITY["AirKorea<br/>- PM10 / PM2.5<br/>- 통합대기지수(CAI)<br/>- 오존(O3)<br/>- 자외선(UV)"]
        APIHUB_ALERT["APIHub 기상특보<br/>- 태풍 / 지진 / 해일<br/>- 화산 / 황사<br/>- 기상경보/주의보"]
        APIHUB_IMAGE["APIHub 이미지<br/>- 위성영상<br/>- 레이더영상<br/>- 지진정보도"]
    end

    KMA_ULTRA --> AGGREGATE
    KMA_SHORT --> AGGREGATE
    AIR_QUALITY --> AGGREGATE
    APIHUB_ALERT --> AGGREGATE
    APIHUB_IMAGE --> IMAGE_PROC

    AGGREGATE["데이터 병합 &amp; 정규화<br/>weather-utils.ts"]

    AGGREGATE --> SCORE_CALC
    subgraph SCORE_CALC["Score Calculation (0-100)"]
        TEMP_SCORE["기온 점수<br/>18-24°C = 최적<br/>0°C↓ or 35°C↑ = 감점"]
        RAIN_SCORE["강수 점수<br/>POP < 30% = 만점<br/>POP > 70% = 큰 감점"]
        DUST_SCORE["미세먼지 점수<br/>PM2.5 < 15㎍/㎥ = 만점<br/>PM2.5 > 50㎍/㎥ = 큰 감점"]
        WIND_SCORE["바람 점수<br/>1-3m/s = 최적<br/>10m/s↑ = 큰 감점"]
        SKY_SCORE["하늘 점수<br/>맑음 = 만점<br/>흐림/비 = 감점"]
        ALERT_PENALTY["특보 페널티<br/>경보 = -20, 주의보 = -10"]
    end

    TEMP_SCORE --> WEIGHTED_SUM
    RAIN_SCORE --> WEIGHTED_SUM
    DUST_SCORE --> WEIGHTED_SUM
    WIND_SCORE --> WEIGHTED_SUM
    SKY_SCORE --> WEIGHTED_SUM

    WEIGHTED_SUM["가중치 합산<br/>Weighted Average"]
    ALERT_PENALTY --> WEIGHTED_SUM
    WEIGHTED_SUM --> CLAMP["0-100 범위 Clamp<br/>& Score Category 분류<br/>86+ ✨최고의 날 | 66+ 😊좋음<br/>36+ 😐보통 | 0-35 😞나쁨"]

    IMAGE_PROC["이미지 조건부 요청<br/>- 미세먼지 ≥51 → dust<br/>- 습도 ≥90 → fog<br/>- 특보 있음 → lgt/typhoon/tsunami/volcano"]

    CLAMP --> RESPONSE["API Response<br/>{score, details, metadata, message, images}"]
    IMAGE_PROC --> RESPONSE
    RESPONSE --> CLIENT(["Client renders:<br/>Hero Score + Animations<br/>PicnicBriefing + Images"])
```

---

## 7. AI Chat Flow — Sequence Diagram (Dashboard & Lab)

```mermaid
sequenceDiagram
    actor User
    participant Client as React Component
    participant API as /api/chat or /api/lab/ai-chat
    participant Session as auth/session.ts
    participant Quota as llm/quota.ts
    participant Memory as chat/repository.ts
    participant Prompt as chat/prompt.ts
    participant LLM as NanoGPT / FactChat
    participant Tavily as Tavily API (Lab only)
    participant DB as TiDB

    User->>Client: Type message &amp; send
    Client->>API: POST /api/chat { sessionId?, message, locale }

    API->>Session: Validate session cookie
    Session-->>API: userId

    API->>Quota: reserveGlobalLlmDailyRequest(limit=5000)
    Quota->>DB: UPSERT + SELECT FOR UPDATE → atomic increment
    alt Global quota exhausted
        Quota-->>API: { allowed: false }
        API-->>Client: 429 "Daily LLM limit reached"
    end

    API->>Quota: reserveUserActionDailyRequest(userId, "chat_message", limit=200)
    Quota->>DB: UPSERT + SELECT FOR UPDATE on (date, userId, quota_key)
    alt User quota exhausted
        Quota-->>API: { allowed: false }
        API-->>Client: 429 "Your daily chat limit reached (200/day)"
    end

    Quota-->>API: { allowed: true, usage }

    API->>DB: Lookup/Create session
    API->>DB: Fetch recent messages (last N, context window limits)
    API->>DB: Fetch cross-session memory (user_chat_memory)

    API->>Prompt: Build system prompt
    Prompt->>Prompt: Inject weather context + score + outdoor recommendations
    Prompt->>Prompt: Inject user memory summary + profile assessment
    Prompt->>Prompt: Apply locale-specific instructions
    Prompt-->>API: System prompt + message history

    opt Lab AI Chat with Web Search
        API->>Tavily: Search(query, topic, timeRange)
        Tavily-->>API: Search results
        API->>DB: Cache results in lab_ai_chat_web_search_state
        API->>Prompt: Inject search results into system prompt
    end

    API->>LLM: POST /chat/completions (SSE stream)
    Note over API,LLM: SSE Streaming<br/>Content-Type: text/event-stream

    loop SSE Events
        LLM-->>API: data: {"choices":[{"delta":{"content":"..."}}]}
        API-->>Client: data: {"content":"...", "done":false}
        Client->>Client: Append token to chat UI
    end

    LLM-->>API: data: [DONE]

    API->>DB: INSERT user message (role=user)
    API->>DB: INSERT assistant message (role=assistant, with token counts)
    API->>Quota: recordGlobalLlmRequestOutcome(success=true)
    API->>DB: INSERT request event log

    API->>Memory: Check if memory compaction needed
    alt Context exceeds threshold (e.g., messages > 50)
        API->>LLM: Generate conversation summary
        LLM-->>API: Summary text
        API->>DB: UPDATE session.memory_summary_text
        API->>DB: Update user_chat_memory (cross-session)
    end

    API-->>Client: data: { done: true, usage: {...} }
    Client-->>User: Display complete response
```

---

## 8. Code Share Collaboration — Sequence & State Diagram

### 8.1 Collaboration Sequence

```mermaid
sequenceDiagram
    actor UserA as User A (Owner)
    actor UserB as User B (Guest)
    participant WSA as WebSocket A
    participant WSB as WebSocket B
    participant WS_Server as WebSocket Server
    participant API as /api/code-share
    participant DB as TiDB

    Note over UserA,DB: ======= SESSION SETUP =======

    UserA->>API: POST /api/code-share/sessions {title, language, code}
    API->>DB: INSERT code_share_sessions (sessionId, version=1)
    DB-->>API: session
    API-->>UserA: { sessionId: "abc123...", version: 1 }

    UserA->>WSA: Connect WebSocket /ws
    WSA->>WS_Server: { type: "code_share_subscribe", sessionId }
    WS_Server->>WS_Server: validateOrigin() → pass
    WS_Server->>WS_Server: authenticateWs() → userA (optional)
    WS_Server->>DB: getCodeShareSessionById()
    WS_Server->>WS_Server: joinRoom(ws, "code_share:abc123")
    WS_Server->>WS_Server: joinCodeSharePresence(sessionId, actorId, alias)
    WS_Server-->>WSA: { type: "code_share_presence", count: 1, participants: [{alias: "UserA", typing: false}] }

    Note over UserA,DB: ======= USER B JOINS =======

    UserB->>WSB: Open URL /code-share/abc123
    WSB->>WS_Server: { type: "code_share_subscribe", sessionId }
    WS_Server->>DB: getCodeShareSessionById("abc123")
    DB-->>WS_Server: session → version=1, code_text
    WS_Server->>WS_Server: joinRoom(wsB, "code_share:abc123")
    WS_Server->>WS_Server: joinCodeSharePresence(sessionId, "guest-xxxx", "Guest-xxxx")
    WS_Server-->>WSB: { type: "code_share_presence", count: 2, participants: [...] }
    WS_Server-->>WSA: { type: "code_share_presence", count: 2, participants: [...] }

    Note over UserA,DB: ======= REAL-TIME EDIT =======

    UserA->>API: PATCH /api/code-share/sessions/abc123 {code, version: 1}
    API->>DB: UPDATE ... WHERE version = 1 → version 2

    par Optimistic Update Success
        DB-->>API: Rows affected: 1
        API-->>UserA: 200 { version: 2 }
        UserA->>WSA: { type: "code_share_saved", sessionId, version: 2 }
        WSA->>WS_Server: Broadcast to room
        WS_Server-->>WSB: { type: "code_share_saved", version: 2, actor: {alias: "UserA"} }
        WSB->>UserB: Silent refresh editor content
    and Version Conflict
        UserB->>API: PATCH /api/code-share/sessions/abc123 {code, version: 1}
        API->>DB: UPDATE ... WHERE version = 1 → FAILS (current version = 2)
        DB-->>API: Rows affected: 0
        API-->>UserB: 409 Conflict { currentVersion: 2 }
        UserB->>UserB: Reload latest version &amp; reapply edits
    end

    Note over UserA,DB: ======= TYPING INDICATORS =======

    UserA->>WSA: { type: "code_share_typing", sessionId, isTyping: true }
    WSA->>WS_Server: Route to presence manager
    WS_Server->>WS_Server: setCodeShareTyping(sessionId, actorA, true)
    WS_Server->>WS_Server: Start 7.5s auto-clear timeout
    WS_Server-->>WSB: { type: "code_share_presence", participants: [{alias: "UserA", typing: true}, ...] }
    WSB-->>UserB: "UserA is typing..."

    Note over UserA,DB: ======= DISCONNECT =======

    UserB->>WSB: Close tab / disconnect
    WSB->>WS_Server: ws.on("close")
    WS_Server->>WS_Server: leaveCodeSharePresence(sessionId, actorB)
    WS_Server->>WS_Server: leaveRoom(wsB, room)
    WS_Server->>WS_Server: removeClient(wsB)
    WS_Server-->>WSA: { type: "code_share_presence", count: 1, participants: [{typing: true}] }
    WSA-->>UserA: "User B disconnected"
```

### 8.2 WebSocket Connection Lifecycle — State Machine

```mermaid
stateDiagram-v2
    [*] --> Connecting

    Connecting --> OriginCheck : TCP established
    OriginCheck --> Rejected : Invalid Origin → close(4403)
    OriginCheck --> CapacityCheck : Origin valid
    
    CapacityCheck --> Rejected : Max connections → close(4429)
    CapacityCheck --> Registered : addClient() success
    
    Registered --> AuthCheck : Start authenticateWs()
    Registered --> Broadcasting : broadcast("user_count")
    Registered --> Heartbeat : setupHeartbeat()

    AuthCheck --> Authenticated : Session valid → updateClientMeta
    AuthCheck --> Guest : No valid session → stays guest

    state Authenticated {
        [*] --> Idle
        Idle --> Subscribed : code_share_subscribe
        Idle --> Typing : code_share_typing
        Subscribed --> Saved : code_share_saved
        Saved --> Subscribed
        Subscribed --> Unsubscribed : code_share_unsubscribe
        Subscribed --> Typing
        Typing --> Subscribed : isTyping: false
        Typing --> TimedOut : 7.5s no update → auto-clear
        TimedOut --> Subscribed
    }

    state Guest {
        [*] --> G_Idle
        G_Idle --> G_Subscribed : code_share_subscribe
        G_Subscribed --> G_Unsubscribed : code_share_unsubscribe
    }

    Registered --> Guest
    
    Heartbeat --> Heartbeat : ping every 30s
    Heartbeat --> Disconnected : pong timeout 60s → terminate()

    Registered --> Disconnected : ws.on("close")
    Registered --> Disconnected : ws.on("error")
    
    Disconnected --> Cleanup : cleanup()
    Cleanup --> [*] : leaveRoom() + removeClient() + broadcast presences

    Rejected --> [*]
```

---

## 9. FSRS Spaced Repetition — Card State Machine

```mermaid
stateDiagram-v2
    [*] --> New : Card created<br/>learning_state = 'new'<br/>stage = 0, stability = 0.2d

    state New {
        [*] --> AwaitingFirstReview : next_review_at = NOW()
    }

    AwaitingFirstReview --> Learning : First review submitted<br/>outcome = 'good' or 'easy'<br/>learning_state → 'learning'<br/>stage = 1, stability = 1d

    state Learning {
        [*] --> LearningGraded : Review submitted
        LearningGraded --> LearningAgain : outcome = 'again' (lapse)<br/>stage reset to 0<br/>stability *= 0.5
        LearningGraded --> LearningAdvance : outcome = 'good'<br/>stage + 1<br/>stability *= 2
        LearningGraded --> ReviewTransition : outcome = 'good' AND stage ≥ 2<br/>learning_state → 'review'
    }

    state Review {
        [*] --> ReviewScheduled : FSRS calculates next_review_at<br/>via stability &amp; difficulty
        ReviewScheduled --> ReviewAgain : outcome = 'again' (lapse)<br/>learning_state → 'relearning'<br/>lapses++<br/>difficulty = min(10, difficulty + 1)<br/>stability *= 0.5
        ReviewScheduled --> ReviewPassed : outcome = 'hard' → stability *= 1.2<br/>outcome = 'good' → stability *= 2.5<br/>outcome = 'easy' → stability *= 4.0<br/>difficulty adjusted by outcome
        ReviewPassed --> ReviewScheduled : FSRS recalculates next_review_at<br/>stability_days updated<br/>total_reviews++
    }

    state Relearning {
        [*] --> RelearningStep : outcome = 'good' → stage = 1<br/>outcome = 'again' → stage = 0
        RelearningStep --> ReviewTransition : stage ≥ 2<br/>learning_state → 'review'
        RelearningStep --> RelearningAgain : stage < 2 → continue relearning
    }
```

---

## 10. Dependency Graph — Package-Level Module Dependencies

```mermaid
graph LR
    subgraph "Frontend (Browser)"
        PAGES["app/ (Pages)"]
        COMPONENTS["components/"]
        CONTEXT["context/<br/>Auth / Language"]
        SERVICES["services/<br/>dataService.ts"]
    end

    subgraph "Backend Logic"
        AUTH_LIB["lib/auth/<br/>10 files"]
        CHAT_LIB["lib/chat/<br/>7 files"]
        LAB_LIB["lib/lab/<br/>7 files (FSRS)"]
        LAB_AI_LIB["lib/lab-ai-chat/<br/>6 files"]
        CODE_SHARE_LIB["lib/code-share/<br/>5 files"]
        WS_LIB["lib/websocket/<br/>3 files"]
        LLM_QUOTA["lib/llm/<br/>quota.ts"]
        ANALYTICS_LIB["lib/analytics/<br/>4 files"]
    end

    subgraph "Infrastructure"
        DB_LIB["lib/db.ts<br/>MySQL2 Pool"]
        SECURITY_LIB["lib/security/<br/>data-protection.ts<br/>AES-256-GCM + HKDF"]
        NANOGPT["lib/nanogpt/<br/>client.ts<br/>OpenAI-compatible"]
        TAVILY_LIB["lib/tavily/<br/>client.ts"]
        WEATHER_UTILS["lib/weather-utils.ts<br/>lib/coords-utils.ts"]
        FORECAST_GRID["lib/forecast-location/<br/>KMA Grid DB"]
    end

    PAGES --> COMPONENTS
    PAGES --> CONTEXT
    COMPONENTS --> CONTEXT
    COMPONENTS --> SERVICES

    AUTH_LIB --> DB_LIB
    AUTH_LIB --> SECURITY_LIB
    CHAT_LIB --> DB_LIB
    CHAT_LIB --> AUTH_LIB
    CHAT_LIB --> NANOGPT
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

    SERVICES -->|fetch()| PAGES
    CONTEXT -->|fetch()| PAGES
```

---

## 11. API Route Map — All Endpoints

```mermaid
mindmap
  root((API Routes<br/>50+ Endpoints))
    Auth /api/auth
      POST register
      POST login
      GET me
      POST logout
      GET profile
      PUT profile
      DELETE account
    Weather /api/weather
      GET current (1391 lines)
      GET forecast
      GET images
      GET images/asset
      GET archives
      GET trends
      GET insights
      POST recommendations/generate
    Fire /api/fire
      GET summary
    Chat /api/chat
      GET (state)
      POST (SSE stream)
      sessions
        GET (list)
        POST (create)
        DELETE [id]
    Lab /api/lab
      decks
        GET (list)
        POST (create)
      cards
        GET (list)
        POST (create)
        POST autofill
      POST generate (AI deck)
      POST review (single)
      POST review/batch (up to 50)
      GET report
      POST import
      GET export
      GET template
      GET state
    Lab AI Chat /api/lab/ai-chat
      POST (SSE stream)
      sessions
        GET (list)
        POST (create)
    Code Share /api/code-share
      sessions
        GET (list)
        POST (create)
        GET [sessionId]
        PATCH [sessionId] (optimistic)
        DELETE [sessionId]
    Jeonju /api/jeonju
      GET briefing
    Jeonju Chat /api/jeonju-chat
      GET (list)
      POST (send)
    Analytics /api/analytics
      POST page-view
      POST consent
```

---

## 12. Rate Limiting & Quota Architecture

```mermaid
flowchart TD
    REQ["Incoming HTTP Request"]

    subgraph "Layer 1: In-Memory (proxy.ts)"
        L1_RATE["Route-based Rate Limit<br/>Map<IP, Bucket>"]
        L1_RATE --> L1_CHECK{"Under Limit?"}
        L1_CHECK -->|No| L1_429["429 Too Many Requests<br/>Retry-After Header"]
        L1_CHECK -->|Yes| L1_PASS["Pass to Handler"]
    end

    REQ --> L1_RATE

    subgraph "Layer 2: Auth-Specific DB (auth/repository.ts)"
        L2_RATE["Attempt Buckets<br/>auth_attempt_buckets table"]
        L2_RATE --> L2_CHECK{"login: 10/15min<br/>register: 5/hour"}
        L2_CHECK -->|Blocked| L2_429["429 + blocked_until"]
        L2_CHECK -->|OK| L2_PASS["Proceed"]
    end

    L1_PASS --> L2_RATE

    subgraph "Layer 3: LLM Quota (llm/quota.ts)"
        L3_GLOBAL["Global Daily Limit<br/>llm_global_usage_daily<br/>UPSERT + FOR UPDATE<br/>Default: 5000 req/day"]
        L3_USER["Per-User Per-Action Limit<br/>llm_user_action_usage_daily<br/>UPSERT + FOR UPDATE<br/>Default: 100-200 req/day"]
        
        L3_GLOBAL --> L3_CHECK{"global_req < 5000?"}
        L3_CHECK -->|No| L3_429["429 Daily LLM limit reached"]
        L3_CHECK -->|Yes| L3_USER
        
        L3_USER --> L3_UCHECK{"user_action_req < limit?"}
        L3_UCHECK -->|No| L3_429_USER["429 Your daily limit reached"]
        L3_UCHECK -->|Yes| L3_ALLOW["LLM Request Proceeds<br/>Atomic counter increment"]
    end

    L2_PASS --> L3_GLOBAL

    subgraph "Layer 4: Lab-Specific Quotas"
        L4_WEB["Web Search Monthly Limit<br/>lab_ai_chat_web_search_usage_monthly<br/>100/month/user"]
        L4_LAB["Lab Generation Daily<br/>lab_daily_usage<br/>30/day/user"]
    end

    L3_ALLOW --> L4_WEB
    L3_ALLOW --> L4_LAB
```

---

## 13. Data Encryption Architecture

```mermaid
flowchart LR
    subgraph "Write Path"
        W1["Plaintext value<br/>e.g. 'user@example.com'"]
        W2["HKDF Context Key<br/>SHA-256(MK, 'users.email')"]
        W3["AES-256-GCM Encrypt<br/>Random IV + AAD"]
        W4["Blind Index<br/>HMAC-SHA256(plaintext, HKDF(MK, 'users.email.blind'))"]
        W5["enc:v1:&lt;salt&gt;:&lt;iv&gt;:&lt;tag&gt;:&lt;ct&gt;<br/>Base64URL"]
    end

    W1 --> W2
    W2 --> W3
    W1 --> W3
    W3 --> W5
    W1 --> W4
    W4 -.->|Stored in separate column<br/>for lookup without decryption| DB_WRITE

    subgraph "DB"
        DB_WRITE[("users table<br/>email: enc:v1:...<br/>email_hash: a1b2c3...")]
    end

    W5 --> DB_WRITE

    subgraph "Read Path"
        R1["Read encrypted value from DB"]
        R2["Extract version, salt, IV, tag, ct"]
        R3["HKDF derive key from context"]
        R4["AES-256-GCM Decrypt<br/>verify auth tag"]
        R5["Return plaintext"]
    end

    DB_WRITE --> R1
    R1 --> R2
    R2 --> R3
    R3 --> R4
    R4 --> R5

    subgraph "Lookup Path (No Decryption)"
        L1["Search query: find user by email"]
        L2["Compute Blind Index<br/>HMAC-SHA256(plaintext_email, HKDF(MK, 'users.email.blind'))"]
        L3["SELECT * FROM users WHERE email_hash = ?"]
    end

    L1 --> L2
    L2 --> L3
    L3 --> DB_WRITE
```

---

## 14. Deployment Architecture (Production)

```mermaid
graph TB
    subgraph "Internet"
        USERS["End Users"]
    end

    subgraph "Linux Server (PM2)"
        NGINX["Nginx<br/>:80 → :443 redirect<br/>SSL/TLS Termination<br/>WebSocket Upgrade<br/>gzip / cache-control<br/>CSP / HSTS / CORS"]

        subgraph "PM2 Process"
            NODE["Node.js Process<br/>tsx server.ts"]
            NEXT["Next.js App Router<br/>SSR + API Routes<br/>Middleware (proxy.ts)"]
            WS["WebSocket Server<br/>Code Share Presence<br/>Typing / Heartbeat"]
            SCHEDULER["Briefing Scheduler<br/>Daily Jeonju Briefing"]
            
            NODE --> NEXT
            NODE --> WS
            NODE --> SCHEDULER
        end
    end

    subgraph "External"
        DB[("TiDB Cloud<br/>(MySQL 8 Compatible)")]
        NANOGPT_EXT["NanoGPT API<br/>LLM Completions"]
        FACTCHAT_EXT["FactChat API<br/>Fallback LLM"]
        TAVILY_EXT["Tavily Search API"]
        KMA_EXT["KMA 기상청 API"]
        AIR_EXT["AirKorea API"]
        APIHUB_EXT["APIHub"]
    end

    USERS -- HTTPS:443 --> NGINX
    NGINX -- HTTP:3000 --> NODE
    NEXT --> DB
    WS --> DB
    SCHEDULER --> NANOGPT_EXT
    SCHEDULER --> DB
    NEXT --> NANOGPT_EXT
    NEXT --> FACTCHAT_EXT
    NEXT --> TAVILY_EXT
    NEXT --> KMA_EXT
    NEXT --> AIR_EXT
    NEXT --> APIHUB_EXT
```

---

## 15. i18n Architecture

```mermaid
flowchart TD
    LOCALE_DETECT["Language Detection<br/>1. User setting (cookie/localStorage)<br/>2. Browser Accept-Language<br/>3. Default: ko"]

    LOCALE_DETECT --> CONTEXT["LanguageContext<br/>React Context Provider<br/>{ language, t(), setLocale() }"]

    CONTEXT --> LOCALE_FILES["Translation Files<br/>data/locales/<br/>├── ko.ts<br/>├── en.ts<br/>├── zh.ts<br/>└── ja.ts"]

    LOCALE_FILES --> T_FUNC["t(key, seed?)<br/>- Simple: t('hero_temp') → single string<br/>- Array: t('message', seed?) → deterministic variant<br/>- seed = hour + char codes → no flicker<br/>- Fallback: ko → en → key"]

    T_FUNC --> COMPONENTS["All Components<br/>useLanguage() hook<br/>{t('key')}"]

    CONTEXT --> API_HEADER["API Requests<br/>X-Locale: ko<br/>(Used by LLM prompts & validation messages)"]
```

---

## 16. Performance Optimization — Device Tier Detection

```mermaid
flowchart TD
    DETECT["Device Tier Detection<br/>performance.ts"]

    DETECT --> CPU["navigator.hardwareConcurrency"]
    DETECT --> MEM["navigator.deviceMemory"]
    DETECT --> PREFERS["prefers-reduced-motion"]
    DETECT --> SAVEDATA["navigator.connection?.saveData"]
    DETECT --> LOW_PWR["Battery API status"]

    CPU --> TIER{"Device Tier?"}
    MEM --> TIER

    TIER -->|Low| LOW_SETTINGS["Low Device Settings<br/>• Particles: 0<br/>• Meteors: 0<br/>• ShineBorder: disabled<br/>• Marquee repeats: 0<br/>• WordPullUp: static<br/>• AnimatedProgress: instant"]
    
    TIER -->|Mid| MID_SETTINGS["Mid Device Settings<br/>• Particles: 10<br/>• Meteors: 1<br/>• ShineBorder: reduced speed<br/>• Marquee repeats: 1"]
    
    TIER -->|High| HIGH_SETTINGS["High Device Settings<br/>• Particles: 20<br/>• Meteors: 3<br/>• ShineBorder: full animation<br/>• Marquee repeats: 2<br/>• All animations enabled"]
    
    PREFERS -->|true| REDUCED["Reduced Motion<br/>All animations disabled<br/>framer-motion: reduced"]
    
    SAVEDATA -->|true| SAVE["Save Data Mode<br/>Minimal visual effects<br/>Deferred image loading"]
    
    LOW_PWR -->|low| BATTERY_SAVE["Battery Saver<br/>Reduce particle count by 50%"]
```

---

## 17. Jeonju Briefing Scheduler — Timer-Based Generation

```mermaid
sequenceDiagram
    participant Server as server.ts
    participant Scheduler as jeonju-scheduler.ts
    participant LLM as NanoGPT API
    participant DB as TiDB

    Server->>Scheduler: startJeonjuBriefingScheduler()
    Scheduler->>Scheduler: Calculate next run time<br/>(Daily at 06:00 KST)

    loop Every Day at 06:00 KST
        Scheduler->>Scheduler: setTimeout until next 06:00
        
        Scheduler->>DB: Check if today's briefing exists
        alt Already generated
            DB-->>Scheduler: Briefing exists → Skip
        else Not yet generated
            Scheduler->>Scheduler: Gather Jeonju weather + events data
            
            Scheduler->>LLM: Generate briefing (prompt with locale templates)
            LLM-->>Scheduler: Briefing content (ko, en, zh, ja)
            
            Scheduler->>DB: INSERT INTO jeonju_daily_briefings
            DB-->>Scheduler: OK
            
            Scheduler->>Scheduler: Broadcast via WebSocket<br/>to all connected clients<br/>event: "jeonju_briefing_updated"
        end
        
        Scheduler->>Scheduler: Schedule next run

        opt Cleanup Job (07:00 KST)
            Scheduler->>DB: DELETE FROM jeonju_chat_messages<br/>WHERE created_at < NOW() - 7 DAYS
            Note over Scheduler,DB: 7-day retention policy for chat messages
        end
    end
```

---

## 요약 (Summary)

| 계층 | 핵심 기술 | 담당 모듈 |
|------|-----------|-----------|
| **프론트엔드** | React 19, Next.js 16 App Router, TailwindCSS 4, Framer Motion, CodeMirror 6 | `src/app/`, `src/components/`, `src/context/` |
| **보안** | AES-256-GCM (Field-level Encryption), scrypt(N=16384) + Pepper, HKDF, HMAC Blind Index | `src/lib/security/`, `src/lib/auth/` |
| **인증** | Cookie-based Session (7d TTL), SHA-256 Token Hash, In-Memory LRU Cache | `src/lib/auth/session.ts`, `src/lib/auth/repository.ts` |
| **DB** | TiDB / MySQL 8, mysql2/promise, 20 Tables | `src/lib/db.ts`, 각 도메인 `schema.ts` |
| **AI** | NanoGPT (Primary) + FactChat (Fallback), SSE Streaming, Prompt Injection with Weather Context | `src/lib/chat/`, `src/lib/nanogpt/`, `src/lib/lab-ai-chat/` |
| **Rate Limit** | 3-Layer: In-Memory (proxy.ts) → DB Attempt Buckets → LLM Quota (FOR UPDATE) | `src/proxy.ts`, `src/lib/llm/quota.ts`, `src/lib/auth/repository.ts` |
| **WebSocket** | ws library, Room-based Pub/Sub, Presence Tracking, Heartbeat, Typing Indicators | `src/lib/websocket/` |
| **Spaced Repetition** | FSRS v5 Algorithm (stability, difficulty, state machine) | `src/lib/lab/` |
| **Search** | Tavily API, Cached Results, Monthly Quota | `src/lib/tavily/`, `src/lib/lab-ai-chat/` |
| **i18n** | 4 Languages (ko/en/zh/ja), Deterministic Array Variable Selection | `src/context/LanguageContext.tsx`, `src/data/locales/` |
| **Analytics** | Privacy-First, Consent-Gated, Multi-Dimensional Metrics | `src/lib/analytics/` |
| **Deploy** | PM2 + Nginx, Single Node.js Process (HTTP + WS), TiDB Cloud | `server.ts`, Nginx config |
