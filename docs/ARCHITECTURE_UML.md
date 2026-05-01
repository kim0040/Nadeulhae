# Nadeulhae — Architecture & UML Documentation

> **Version**: 0.1.0 | **Framework**: Next.js 16.2.4 (App Router) | **Language**: TypeScript 6.0

---

## 1. Project Overview

**Nadeulhae** (a portmanteau of "Nadeuri" meaning outing + "Hae" meaning sun/sea) is a **weather-based outdoor activity scoring service + AI Chat + code sharing platform**. Centered on Jeonju city, it combines real-time data from KMA, AirKorea, and APIHub to compute a 0-100 picnic score, along with OpenAI-compatible LLM-based AI chat, FSRS-algorithm vocabulary learning (Lab), and a WebSocket-based real-time collaborative code editor.

---

## 2. System Architecture — Deployment Diagram

```mermaid
graph TB
    subgraph UserDevice["User Device"]
        BROWSER["Web Browser (React SPA)"]
    end

    subgraph EdgeCDN["Edge / CDN"]
        NGINX["Nginx Reverse Proxy<br/>SSL Termination<br/>WebSocket Upgrade<br/>CSP / HSTS Headers"]
    end

    subgraph AppServer["Application Server (Node.js)"]
        direction TB
        S_TS["server.ts (Custom HTTP + WS Server)"]
        
        subgraph NextJS["Next.js App Router"]
            MIDDLE["proxy.ts (Rate Limit / Security)"]
            PAGES["SSR Pages<br/>Dashboard / Lab / Jeonju / Statistics"]
            API["API Routes (50+)<br/>auth, weather, chat, lab, code-share, analytics"]
        end

        WSS["WebSocket Server<br/>Code Share Presence / Typing / Heartbeat"]
        
        SCHEDULER["Jeonju Briefing Scheduler<br/>Daily AI Briefing Generator"]

        S_TS --> MIDDLE
        MIDDLE --> PAGES
        MIDDLE --> API
        S_TS --> WSS
        S_TS --> SCHEDULER
    end

    subgraph Persistence["Persistence Layer"]
        TIDB[("TiDB / MySQL 8 (20 Tables)")]
    end

    subgraph ExternalAPIs["External APIs"]
        KMA["KMA<br/>Ultra-short / short / mid-range forecast"]
        AIR["AirKorea<br/>PM10 / PM2.5 / CAI index"]
        APIHUB["APIHub<br/>Weather warnings / satellite / radar / quake images"]
        GENERAL_LLM["General LLM API<br/>OpenAI-compatible (범용)"]
        LAB_LLM["Lab LLM API<br/>OpenAI-compatible (실험실)"]
        TAVILY["Tavily API (Web Search)"]
    end

    BROWSER -- HTTPS --> NGINX
    NGINX -- HTTP/WS --> S_TS
    API --> TIDB
    WSS -- Session Auth --> TIDB
    API --> KMA
    API --> AIR
    API --> APIHUB
    API --> GENERAL_LLM
    API --> LAB_LLM
    SCHEDULER --> GENERAL_LLM
    SCHEDULER --> TIDB
```

---

## 3. Frontend Component Hierarchy — Component Tree

```mermaid
graph TD
    ROOT["RootLayout (layout.tsx)"]
    
    LP["LanguageProvider (ko / en / zh / ja)"]
    TP["ThemeProvider (dark / light / system)"]
    AP["AuthProvider (loading / guest / authenticated)"]
    
    ROOT --> LP
    LP --> TP
    TP --> AP
    
    PVT["PageViewTracker (Analytics)"]
    ACB["AnalyticsConsentBanner"]
    NAV["Navbar (Logo / Auth / Theme / Language)"]
    
    AP --> PVT
    AP --> ACB
    AP --> NAV
    AP --> PAGES

    subgraph Pages["Page Components"]
        HOME["Home (/)"]
        HOME_COMP["Home Sub-Components<br/>TodayHourlyForecast<br/>PicnicBriefing<br/>FireInsightPanel<br/>WeatherImagePanel"]
        
        DASH["Dashboard (/dashboard)<br/>DashboardChatPanel"]
        
        LAB_HUB["Lab Hub (/lab)<br/>Performance Detection"]
        LAB_VOCAB["Lab Vocab (/lab/vocab)<br/>VocabReportPanel / Card Review"]
        LAB_AI["Lab AI Chat (/lab/ai-chat)<br/>LabAiChatPanel / Web Search"]
        LAB_CS["Lab Code Share (/lab/code-share)<br/>CodeShareHub"]
        
        CS_EDITOR["Code Share Editor<br/>(/code-share/[sessionId])<br/>CodeMirror + Presence"]
        
        JEONJU["Jeonju (/jeonju)<br/>DailyBriefing / Chat / Safety"]
        
        STATS["Statistics (/statistics/calendar)<br/>PicnicCalendar"]
        
        AUTH_PAGES["Auth Pages<br/>Login / Signup / Account / Terms"]
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

> **Encryption Legend**: [E] = AES-256-GCM encrypted field | [BI] = Blind Index (HMAC-SHA256) | [IDX] = Indexed column

```mermaid
erDiagram
    users {
        string id PK "UUIDv4"
        string email "AES-256-GCM encrypted [E]"
        string email_hash "HMAC-SHA256 Blind Index [BI] [IDX] UNIQUE"
        string display_name "Encrypted [E]"
        string nickname "Encrypted [E]"
        string nickname_hash "Blind Index [BI] [IDX] UNIQUE with tag"
        string nickname_tag "Random 4-digit tag"
        string password_hash "scrypt(N equals 16384)"
        string password_salt "scrypt salt"
        string password_algo "always scrypt-v1"
        string age_band "Encrypted [E]"
        string primary_region "Encrypted [E]"
        string interest_tags "JSON array encrypted [E]"
        string interest_other "Encrypted [E]"
        string preferred_time_slot "Encrypted [E]"
        string weather_sensitivity "JSON array encrypted [E]"
        datetime terms_agreed_at
        datetime privacy_agreed_at
        datetime age_confirmed_at
        boolean marketing_accepted
        boolean analytics_accepted
        boolean lab_enabled "Lab feature toggle"
        datetime created_at
        datetime updated_at
    }

    user_sessions {
        string id PK "UUIDv4"
        string user_id FK "Reference users.id"
        string token_hash "SHA-256 of session token [IDX] UNIQUE"
        datetime expires_at "Indexed [IDX]"
        string user_agent "Encrypted [E]"
        string ip_address "Encrypted [E]"
        datetime created_at
        datetime last_used_at
    }

    auth_attempt_buckets {
        int id PK "AUTO_INCREMENT"
        string action "login or register"
        string scope_key "IP or email_hash"
        int attempt_count
        datetime window_started_at
        datetime blocked_until "Indexed [IDX]"
        datetime last_attempt_at
        string uniqueKey "UNIQUE on action plus scope_key"
    }

    auth_security_events {
        int id PK "AUTO_INCREMENT"
        string event_type
        string action
        string outcome "success or failure"
        string user_id FK "Indexed [IDX]"
        string email "Encrypted [E]"
        string email_hash "Blind Index [BI] [IDX]"
        string ip_address "Encrypted [E]"
        string user_agent "Encrypted [E]"
        string metadata "JSON"
        datetime created_at "Indexed [IDX]"
    }

    user_chat_sessions {
        int id PK "AUTO_INCREMENT"
        string user_id FK "Indexed [IDX]"
        string title
        string locale "ko or en or zh or ja"
        boolean is_auto_title
        string memory_summary_text "Encrypted [E]"
        int memory_token_estimate
        int summarized_message_count
        string memory_model_used
        datetime last_compacted_at
        datetime last_message_at "Indexed [IDX]"
        datetime created_at "Indexed [IDX]"
        datetime updated_at "Indexed [IDX]"
    }

    user_chat_messages {
        int id PK "AUTO_INCREMENT"
        string user_id FK "Indexed [IDX]"
        int session_id FK "Indexed [IDX]"
        string role "user or assistant or system"
        string locale
        string content "AES-256-GCM encrypted [E]"
        string provider_message_id
        string requested_model
        string resolved_model
        int prompt_tokens
        int completion_tokens
        int total_tokens
        int cached_prompt_tokens
        datetime included_in_memory_at "Indexed [IDX]"
        datetime created_at "Indexed [IDX]"
    }

    user_chat_memory {
        string user_id PK "FK to users"
        string summary_text "Cross-session memory [E]"
        string assessment_text "User profile assessment [E]"
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
        date metric_date PK
        string user_id PK "Indexed [IDX]"
        int request_count
        int success_count
        int failure_count
        bigint prompt_tokens
        bigint completion_tokens
        bigint total_tokens
        bigint cached_prompt_tokens
        datetime last_used_at "Indexed [IDX]"
    }

    user_chat_request_events {
        int id PK "AUTO_INCREMENT"
        string user_id FK "Indexed [IDX]"
        int session_id FK "Indexed [IDX]"
        string request_kind "Indexed [IDX]"
        string status "Indexed [IDX]"
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
        int latency_ms
        string error_code
        string error_message
        datetime created_at "Indexed [IDX]"
    }

    lab_decks {
        int id PK "AUTO_INCREMENT"
        string user_id FK "Indexed [IDX]"
        string locale
        string title_text
        string topic_text
        string requested_model
        string resolved_model
        int card_count
        datetime created_at "Indexed [IDX]"
        datetime updated_at
    }

    lab_cards {
        int id PK "AUTO_INCREMENT"
        int deck_id FK "Indexed [IDX]"
        string user_id FK "Indexed [IDX]"
        string term_text "Vocabulary term"
        string meaning_text "Meaning / translation"
        string example_text "Example sentence"
        string example_translation_text "Example translation"
        string pos_text "Part of speech"
        string tip_text "Tips / notes"
        string learning_state "Indexed [IDX]: new or learning or review or relearning"
        int consecutive_correct
        int stage "FSRS stage (0-8)"
        double stability_days "FSRS stability"
        double difficulty "FSRS difficulty (1-10)"
        int total_reviews
        int lapses
        int last_review_outcome "0 equals again, 1 equals hard, 2 equals good, 3 equals easy"
        datetime next_review_at "Indexed [IDX]: FSRS scheduled review time"
        datetime last_reviewed_at
        datetime created_at
        datetime updated_at
    }

    lab_daily_usage {
        date metric_date PK
        string user_id PK "Indexed [IDX]"
        int generation_count
        int review_count
        datetime created_at
        datetime updated_at
    }

    lab_ai_chat_sessions {
        int id PK "AUTO_INCREMENT"
        string user_id FK "Indexed [IDX]"
        string title_text
        string locale
        string memory_summary_text
        int memory_token_estimate
        int summarized_message_count
        string memory_model_used
        datetime last_compacted_at
        datetime last_message_at "Indexed [IDX]"
        datetime created_at "Indexed [IDX]"
        datetime updated_at "Indexed [IDX]"
    }

    lab_ai_chat_messages {
        int id PK "AUTO_INCREMENT"
        string user_id FK "Indexed [IDX]"
        int session_id FK "Indexed [IDX]"
        string role
        string locale
        string content
        string provider_message_id
        string requested_model
        string resolved_model
        int prompt_tokens
        int completion_tokens
        int total_tokens
        int cached_prompt_tokens
        datetime included_in_memory_at "Indexed [IDX]"
        datetime created_at "Indexed [IDX]"
    }

    lab_ai_chat_web_search_state {
        string user_id PK "Composite PK"
        int session_id PK "Composite PK"
        int session_call_count
        int fallback_call_count
        string cache_query_text
        string cache_result_text
        string cache_topic
        string cache_time_range
        date cache_start_date
        date cache_end_date
        int cache_result_count
        datetime cache_updated_at "Indexed [IDX]"
        datetime created_at
        datetime updated_at "Indexed [IDX]"
    }

    code_share_sessions {
        int id PK "AUTO_INCREMENT"
        string session_id "UNIQUE [IDX], public session token"
        string owner_actor_id "Indexed [IDX]: Guest actor UUID"
        string owner_user_id "Indexed [IDX]: Optional auth user ID"
        string title_text
        string language_code "javascript or python or go etc."
        string code_text "Code content"
        string status "Indexed [IDX]: active or closed"
        int version "Optimistic concurrency"
        datetime last_activity_at "Indexed [IDX]"
        datetime closed_at
        datetime created_at
        datetime updated_at
    }

    llm_global_usage_daily {
        date metric_date PK "Asia/Seoul date"
        int request_count "Atomic counter (FOR UPDATE)"
        int success_count
        int failure_count
        datetime last_used_at "Indexed [IDX]"
    }

    llm_user_action_usage_daily {
        date metric_date PK "Composite PK"
        string user_id PK "Composite PK"
        string quota_key PK "Composite PK, e.g. chat_message"
        int request_count
        int success_count
        int failure_count
        datetime last_used_at "Indexed [IDX]"
    }

    analytics_daily_route_metrics {
        date metric_date PK
        string dimension_key PK "SHA-256 hash of all dimensions"
        string route_kind "Indexed [IDX]: page or api"
        string route_path "Indexed [IDX]"
        string method "GET or POST or PUT or DELETE"
        int status_code
        string status_group "2xx or 3xx or 4xx or 5xx"
        string auth_state
        string device_type
        string locale
        bigint request_count
        bigint unique_visitors
        bigint unique_users
        bigint total_duration_ms
        int peak_duration_ms
        datetime first_seen_at
        datetime last_seen_at "Indexed [IDX]"
    }

    analytics_daily_unique_entities {
        date metric_date PK
        string dimension_key PK "Composite PK"
        string entity_type PK "Composite PK"
        string entity_hash PK "SHA-256, Composite PK"
    }

    analytics_daily_actor_activity {
        date metric_date PK
        string actor_key PK
        string actor_type "visitor or user"
        string user_id FK "Indexed [IDX]"
        string auth_state
        string device_type
        string locale
        bigint page_view_count
        bigint api_request_count
        bigint mutation_count
        bigint error_count
        datetime first_seen_at
        datetime last_seen_at "Indexed [IDX]"
    }

    analytics_daily_page_context_metrics {
        date metric_date PK
        string dimension_key PK
        string route_path "Indexed [IDX]"
        string auth_state
        string device_type
        string locale
        string theme "dark, light, system"
        string viewport_bucket
        string time_zone
        string referrer_host
        string acquisition_channel "Indexed [IDX]"
        string utm_source
        string utm_medium
        string utm_campaign
        bigint page_view_count
        bigint unique_visitors
        bigint unique_users
        bigint total_load_ms
        int peak_load_ms
        datetime first_seen_at
        datetime last_seen_at "Indexed [IDX]"
    }

    analytics_daily_consent_metrics {
        date metric_date PK
        string dimension_key PK
        string decision_source "Indexed [IDX]: banner or settings"
        string consent_state "Indexed [IDX]: accepted or rejected"
        string auth_state
        string device_type
        string locale
        bigint decision_count
        bigint unique_visitors
        bigint unique_users
        datetime first_seen_at
        datetime last_seen_at "Indexed [IDX]"
    }

    jeonju_daily_briefings {
        int id PK "AUTO_INCREMENT"
        date briefing_date "UNIQUE"
        string content "Multi-locale briefing"
        string model_used
        datetime generated_at
        datetime created_at
    }

    jeonju_chat_messages {
        int id PK "AUTO_INCREMENT"
        string visitor_id "Indexed [IDX]"
        string user_id "Indexed [IDX]"
        string role "user or assistant"
        string content
        datetime created_at "Indexed [IDX]"
    }

    users ||--o{ user_sessions : has
    users ||--o{ user_chat_sessions : owns
    users ||--o{ user_chat_messages : sends
    users ||--|| user_chat_memory : has
    users ||--o{ lab_decks : owns
    users ||--o{ lab_cards : owns
    users ||--o{ lab_ai_chat_sessions : owns
    users ||--o{ lab_ai_chat_messages : sends
    users ||--o{ llm_user_action_usage_daily : consumes
    users ||--o{ analytics_daily_actor_activity : generates
    users ||--o{ code_share_sessions : creates
    users ||--o{ jeonju_chat_messages : writes
    
    user_chat_sessions ||--o{ user_chat_messages : contains
    user_chat_sessions ||--o{ user_chat_request_events : tracks
    lab_decks ||--o{ lab_cards : contains
    lab_ai_chat_sessions ||--o{ lab_ai_chat_messages : contains
    lab_ai_chat_sessions ||--|| lab_ai_chat_web_search_state : has
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

    Note over User,DB: REGISTRATION FLOW

    User->>Browser: Submit Registration Form
    Browser->>Proxy: POST /api/auth/register

    Proxy->>AuthGuard: Check origin and request headers
    Proxy->>Proxy: Rate Limit Check: 20 per min per IP
    alt Rate Limit Exceeded
        Proxy-->>Browser: 429 Too Many Requests
        Browser-->>User: "Please try again later"
    end

    AuthGuard->>Validator: Validate all fields
    Validator->>Validator: NFKC Normalization, XSS filter, length checks
    Validator-->>AuthGuard: Validated payload

    AuthGuard->>Crypto: createBlindIndex(email)
    Crypto-->>AuthGuard: SHA-256(email + pepper + context)

    AuthGuard->>Repository: Check email uniqueness via blind index
    Repository->>DB: SELECT WHERE email_hash equals ?
    DB-->>Repository: Conflict detected? Return 409

    AuthGuard->>Password: hashPassword(plainPassword, pepper)
    Password->>Password: scrypt(N 16384, r 8, p 1) with random salt
    Password-->>AuthGuard: password_hash, password_salt

    AuthGuard->>Crypto: encryptDatabaseValue() on ALL PII fields
    Crypto->>Crypto: HKDF derive key then AES-256-GCM encrypt
    Crypto-->>AuthGuard: enc:v1:salt:iv:tag:ciphertext

    AuthGuard->>Repository: INSERT encrypted row into users
    AuthGuard->>Repository: INSERT security event
    Repository->>DB: BEGIN TRAN, INSERT, COMMIT
    DB-->>Repository: OK

    AuthGuard->>Cookie: createSessionRecord(userId, userAgent, ip)
    Cookie->>Cookie: Generate 128-bit token, SHA-256(token)
    Cookie->>DB: INSERT INTO user_sessions
    Cookie-->>Browser: Set-Cookie: nadeulhae_auth (HttpOnly, Secure, 7d)
    Browser-->>User: Redirect to Home

    Note over User,DB: LOGIN FLOW

    User->>Browser: Submit Login Form
    Browser->>Proxy: POST /api/auth/login

    Proxy->>AuthGuard: Lookup user by blind email index
    AuthGuard->>Crypto: createBlindIndex(email)
    AuthGuard->>DB: SELECT FROM users WHERE email_hash equals ?

    alt User not found (Blind Index miss)
        AuthGuard->>Password: hashPassword(dummy, pepper) (Dummy hash defense)
        Note over Password: Always runs scrypt to prevent timing-based enumeration
        AuthGuard-->>Browser: 401 Invalid credentials
    end

    DB-->>AuthGuard: Encrypted user row

    AuthGuard->>DB: Check rate limit bucket (10 attempts per 15min)
    alt Rate limit bucket full
        AuthGuard->>DB: UPDATE blocked_until = NOW() + 15min
        AuthGuard-->>Browser: 429 Too many attempts
    end

    AuthGuard->>Password: verifyPassword(plain, storedHash, storedSalt)
    Password->>Password: scrypt + timing-safe comparison
    alt Password mismatch
        AuthGuard->>DB: Increment attempt bucket, log security event
        AuthGuard-->>Browser: 401 Invalid credentials
    else Password matches
        AuthGuard->>DB: Reset attempt bucket
        AuthGuard->>Cookie: Create session, Set-Cookie
        Cookie-->>Browser: 200 { user }
        Browser-->>User: Redirect to Home
    end

    Note over User,DB: SESSION VALIDATION (Every Request)

    Browser->>Proxy: GET /api/auth/me
    Proxy->>Cookie: Extract nadeulhae_auth cookie
    Cookie->>Cookie: SHA-256(token) then check In-Memory Cache (15s TTL)

    alt Cache Hit (valid)
        Cookie-->>Browser: 200 { user }
    else Cache Miss
        Cookie->>DB: SELECT session JOIN users WHERE token_hash and expires_at
        alt Session valid and within 24h refresh window
            Cookie->>DB: UPDATE session expires_at = NOW() + 7d
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
    START(["Client requests weather"])

    GEO{"Geolocation Available?"}
    START --> GEO
    GEO -->|"Yes"| COORDS["Get GPS Coordinates (WGS84)"]
    GEO -->|"No / Timeout"| DEFAULT_COORDS["Use Default Coordinates (Jeonju City)"]

    COORDS --> TM_CONV["proj4: WGS84 to TM (EPSG:4326 to EPSG:5181)"]
    DEFAULT_COORDS --> TM_CONV

    TM_CONV --> GRID_LOOKUP["Forecast Location Grid DB Lookup (grid_nx, grid_ny)"]

    GRID_LOOKUP --> PARALLEL_CALLS
    subgraph PARALLEL_CALLS["Parallel API Calls (Promise.all)"]
        KMA_ULTRA["KMA Ultra-short forecast: T1H(temp), POP(rain), SKY, WSD(wind)"]
        KMA_SHORT["KMA Short-range forecast: Max/Min temp, RN1(rainfall), REH(humidity)"]
        AIR_QUALITY["AirKorea: PM10, PM2.5, CAI, O3, UV"]
        APIHUB_ALERT["APIHub Weather Warnings: Typhoon, Earthquake, Tsunami, Warning"]
        APIHUB_IMAGE["APIHub Images: Satellite, Radar, Earthquake maps"]
    end

    KMA_ULTRA --> AGGREGATE
    KMA_SHORT --> AGGREGATE
    AIR_QUALITY --> AGGREGATE
    APIHUB_ALERT --> AGGREGATE
    APIHUB_IMAGE --> IMAGE_PROC

    AGGREGATE["Data Merge and Normalize (weather-utils.ts)"]

    AGGREGATE --> SCORE_CALC
    subgraph SCORE_CALC["Score Calculation (0-100)"]
        TEMP_SCORE["Temperature Score: 18-24C optimal"]
        RAIN_SCORE["Rain Score: POP less than 30% full score"]
        DUST_SCORE["Dust Score: PM2.5 less than 15 optimal"]
        WIND_SCORE["Wind Score: 1-3 m/s optimal"]
        SKY_SCORE["Sky Score: Clear sky full score"]
        ALERT_PENALTY["Alert Penalty: Warning -20, Advisory -10"]
    end

    TEMP_SCORE --> WEIGHTED_SUM
    RAIN_SCORE --> WEIGHTED_SUM
    DUST_SCORE --> WEIGHTED_SUM
    WIND_SCORE --> WEIGHTED_SUM
    SKY_SCORE --> WEIGHTED_SUM

    WEIGHTED_SUM["Weighted Average Calculation"]
    ALERT_PENALTY --> WEIGHTED_SUM
    WEIGHTED_SUM --> CLAMP["Clamp to 0-100 Range and Assign Category (86+:Best, 66+:Good, 36+:Ok, 0-35:Bad)"]

    IMAGE_PROC["Conditional Image Requests (dust, fog, typhoon, tsunami, volcano)"]

    CLAMP --> RESPONSE["API Response: {score, details, metadata, message, images}"]
    IMAGE_PROC --> RESPONSE
    RESPONSE --> CLIENT(["Client Renders: Hero Score, Animations, PicnicBriefing, Images"])
```

---

## 7. AI Chat Flow — Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant Client as React Component
    participant API as /api/chat or /api/lab/ai-chat
    participant Session as auth/session.ts
    participant Quota as llm/quota.ts
    participant Memory as chat/repository.ts
    participant Prompt as chat/prompt.ts
    participant LLM as General LLM / Lab LLM
    participant Tavily as Tavily API (Lab only)
    participant DB as TiDB

    User->>Client: Type message and send
    Client->>API: POST /api/chat { sessionId, message, locale }

    API->>Session: Validate session cookie
    Session-->>API: userId

    API->>Quota: reserveGlobalLlmDailyRequest(limit 5000)
    Quota->>DB: UPSERT + SELECT FOR UPDATE (atomic increment)
    alt Global quota exhausted
        Quota-->>API: { allowed: false }
        API-->>Client: 429 Daily LLM limit reached
    end

    API->>Quota: reserveUserActionDailyRequest(userId, chat_message, limit 200)
    Quota->>DB: UPSERT + SELECT FOR UPDATE on (date, userId, quota_key)
    alt User quota exhausted
        Quota-->>API: { allowed: false }
        API-->>Client: 429 Your daily chat limit reached (200/day)
    end

    Quota-->>API: { allowed: true, usage }

    API->>DB: Lookup or Create session
    API->>DB: Fetch recent messages (context window limit)
    API->>DB: Fetch cross-session memory (user_chat_memory)

    API->>Prompt: Build system prompt
    Prompt->>Prompt: Inject weather context, score, recommendations
    Prompt->>Prompt: Inject user memory summary, profile assessment
    Prompt->>Prompt: Apply locale-specific instructions
    Prompt-->>API: System prompt with message history

    opt Lab AI Chat with Web Search
        API->>Tavily: Search(query, topic, timeRange)
        Tavily-->>API: Search results
        API->>DB: Cache results in web_search_state
        API->>Prompt: Inject search results into system prompt
    end

    API->>LLM: POST /chat/completions (SSE stream)
    Note over API,LLM: SSE Streaming (text/event-stream)

    loop SSE Events
        LLM-->>API: Token delta
        API-->>Client: { content, done: false }
        Client->>Client: Append token to chat UI
    end

    LLM-->>API: data: [DONE]

    API->>DB: INSERT user message (role user)
    API->>DB: INSERT assistant message (role assistant, with token counts)
    API->>Quota: recordGlobalLlmRequestOutcome(success true)
    API->>DB: INSERT request event log

    API->>Memory: Check if memory compaction needed
    alt Context exceeds threshold (messages greater than 50)
        API->>LLM: Generate conversation summary
        LLM-->>API: Summary text
        API->>DB: UPDATE session memory_summary_text
        API->>DB: Update user_chat_memory (cross-session)
    end

    API-->>Client: { done: true, usage }
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

    Note over UserA,DB: SESSION SETUP

    UserA->>API: POST /api/code-share/sessions
    API->>DB: INSERT code_share_sessions (sessionId, version 1)
    DB-->>API: session
    API-->>UserA: { sessionId, version 1 }

    UserA->>WSA: Connect WebSocket /ws
    WSA->>WS_Server: { type: code_share_subscribe, sessionId }
    WS_Server->>WS_Server: validateOrigin(), authenticateWs()
    WS_Server->>DB: getCodeShareSessionById()
    WS_Server->>WS_Server: joinRoom(ws, "code_share:abc123")
    WS_Server->>WS_Server: joinCodeSharePresence(sessionId, actorId, alias)
    WS_Server-->>WSA: { type: code_share_presence, count: 1 }

    Note over UserA,DB: USER B JOINS

    UserB->>WSB: Open URL /code-share/abc123
    WSB->>WS_Server: { type: code_share_subscribe, sessionId }
    WS_Server->>DB: getCodeShareSessionById("abc123")
    DB-->>WS_Server: session (version 1, code_text)
    WS_Server->>WS_Server: joinRoom(wsB, room)
    WS_Server->>WS_Server: joinCodeSharePresence(sessionId, guestActorId, alias)
    WS_Server-->>WSB: { type: code_share_presence, count: 2 }
    WS_Server-->>WSA: { type: code_share_presence, count: 2 }

    Note over UserA,DB: REAL-TIME EDIT

    UserA->>API: PATCH /api/code-share/sessions/abc123 {code, version 1}
    API->>DB: UPDATE WHERE version equals 1, set version 2

    par Optimistic Update Success
        DB-->>API: Rows affected: 1
        API-->>UserA: 200 { version: 2 }
        UserA->>WSA: { type: code_share_saved, sessionId, version 2 }
        WSA->>WS_Server: Broadcast to room
        WS_Server-->>WSB: { type: code_share_saved, version 2, actor }
        WSB->>UserB: Silent refresh editor content
    and Version Conflict
        UserB->>API: PATCH session with version 1
        API->>DB: UPDATE WHERE version equals 1 (FAILS, current is 2)
        DB-->>API: Rows affected: 0
        API-->>UserB: 409 Conflict { currentVersion: 2 }
        UserB->>UserB: Reload latest version and reapply edits
    end

    Note over UserA,DB: TYPING INDICATORS

    UserA->>WSA: { type: code_share_typing, isTyping: true }
    WSA->>WS_Server: setCodeShareTyping(sessionId, actorA, true)
    WS_Server->>WS_Server: Start 7.5s auto-clear timeout
    WS_Server-->>WSB: { type: code_share_presence, typing: true }
    WSB-->>UserB: "UserA is typing..."

    Note over UserA,DB: DISCONNECT

    UserB->>WSB: Close tab / disconnect
    WSB->>WS_Server: ws.on("close")
    WS_Server->>WS_Server: leaveCodeSharePresence(), leaveRoom(), removeClient()
    WS_Server-->>WSA: { type: code_share_presence, count: 1 }
    WSA-->>UserA: "User B disconnected"
```

### 8.2 WebSocket Connection Lifecycle — State Machine

```mermaid
stateDiagram-v2
    [*] --> Connecting

    Connecting --> OriginCheck : TCP established
    OriginCheck --> Rejected : Invalid Origin (close code 4403)
    OriginCheck --> CapacityCheck : Origin valid
    
    CapacityCheck --> Rejected : Max connections (close code 4429)
    CapacityCheck --> Registered : addClient() success
    
    Registered --> AuthCheck : Start authenticateWs()
    Registered --> Broadcasting : broadcast user_count
    Registered --> Heartbeat : setupHeartbeat()

    AuthCheck --> Authenticated : Session valid (updateClientMeta)
    AuthCheck --> Guest : No valid session

    state Authenticated {
        IdleA : Idle
        SubscribedA : Subscribed (code_share_subscribe)
        TypingA : Typing (code_share_typing)
        SavedA : Saved (code_share_saved)
        UnsubscribedA : Unsubscribed (code_share_unsubscribe)
        TimedOutA : Typing Timed Out (7.5s)

        [*] --> IdleA
        IdleA --> SubscribedA
        IdleA --> TypingA
        SubscribedA --> SavedA
        SavedA --> SubscribedA
        SubscribedA --> UnsubscribedA
        SubscribedA --> TypingA
        TypingA --> SubscribedA : isTyping false
        TypingA --> TimedOutA : 7.5s no update
        TimedOutA --> SubscribedA
    }

    state Guest {
        G_Idle : Idle
        G_Subscribed : Subscribed
        G_Unsubscribed : Unsubscribed

        [*] --> G_Idle
        G_Idle --> G_Subscribed
        G_Subscribed --> G_Unsubscribed
    }

    Registered --> Guest
    
    Heartbeat --> Heartbeat : ping every 30s
    Heartbeat --> Disconnected : pong timeout 60s

    Registered --> Disconnected : ws.on close
    Registered --> Disconnected : ws.on error
    
    Disconnected --> Cleanup : cleanup()
    Cleanup --> [*] : leaveRoom, removeClient, broadcast presences

    Rejected --> [*]
```

---

## 9. FSRS Spaced Repetition — Card State Machine

```mermaid
stateDiagram-v2
    [*] --> New : Card created

    state New {
        AwaitingFirstReview : Awaiting first review (next_review_at = NOW())
        [*] --> AwaitingFirstReview
    }

    AwaitingFirstReview --> Learning : First review submitted (outcome good/easy)

    state Learning {
        LearningGraded : Review submitted
        LearningAgain : outcome again (lapse, stage reset 0)
        LearningAdvance : outcome good (stage+1, stability*2)
        ReviewFromLearning : outcome good and stage >= 2

        [*] --> LearningGraded
        LearningGraded --> LearningAgain
        LearningGraded --> LearningAdvance
        LearningGraded --> ReviewFromLearning
    }

    ReviewFromLearning --> Review : Transition to review state

    state Review {
        ReviewScheduled : FSRS schedules next_review_at
        ReviewAgain : outcome again (lapse, goes to relearning)
        ReviewPassed : outcome hard/good/easy (passed)

        [*] --> ReviewScheduled
        ReviewScheduled --> ReviewAgain
        ReviewScheduled --> ReviewPassed
        ReviewPassed --> ReviewScheduled : FSRS recalculates (total_reviews++)
    }

    ReviewAgain --> Relearning : learning_state becomes relearning

    state Relearning {
        RelearningStep : outcome good (stage 1)
        RelearningAgain : outcome again (stage 0)
        BackToReview : stage >= 2

        [*] --> RelearningStep
        RelearningStep --> BackToReview
        RelearningStep --> RelearningAgain
    }

    BackToReview --> Review : learning_state becomes review
```

---

## 10. Dependency Graph — Package-Level Module Dependencies

```mermaid
graph LR
    subgraph Frontend["Frontend (Browser)"]
        PAGES["app/ (Pages)"]
        COMPONENTS["components/"]
        CONTEXT["context/ (Auth, Language)"]
        SERVICES["services/ (dataService.ts)"]
    end

    subgraph Backend["Backend Logic"]
        AUTH_LIB["lib/auth/ (10 files)"]
        CHAT_LIB["lib/chat/ (7 files)"]
        LAB_LIB["lib/lab/ (7 files, FSRS)"]
        LAB_AI_LIB["lib/lab-ai-chat/ (6 files)"]
        CODE_SHARE_LIB["lib/code-share/ (5 files)"]
        WS_LIB["lib/websocket/ (3 files)"]
        LLM_QUOTA["lib/llm/ (quota.ts)"]
        ANALYTICS_LIB["lib/analytics/ (4 files)"]
    end

    subgraph Infrastructure["Infrastructure"]
        DB_LIB["lib/db.ts (MySQL2 Pool)"]
        SECURITY_LIB["lib/security/ (AES-256-GCM + HKDF)"]
        LLM_CLIENT["lib/llm/ (OpenAI-compatible Core)"]
        TAVILY_LIB["lib/tavily/ (Web Search)"]
        WEATHER_UTILS["lib/weather-utils.ts, lib/coords-utils.ts"]
        FORECAST_GRID["lib/forecast-location/ (KMA Grid DB)"]
    end

    PAGES --> COMPONENTS
    PAGES --> CONTEXT
    COMPONENTS --> CONTEXT
    COMPONENTS --> SERVICES

    AUTH_LIB --> DB_LIB
    AUTH_LIB --> SECURITY_LIB
    CHAT_LIB --> DB_LIB
    CHAT_LIB --> AUTH_LIB
    CHAT_LIB --> LLM_CLIENT
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

## 11. API Route Map — All Endpoints

```mermaid
graph LR
    ROOT["API Routes (50+ Endpoints)"]

    subgraph AUTH["Auth /api/auth"]
        A_REG["POST register"]
        A_LOGIN["POST login"]
        A_ME["GET me"]
        A_OUT["POST logout"]
        A_PROF["GET profile"]
        A_UPROF["PUT profile"]
        A_DEL["DELETE account"]
    end

    subgraph WX["Weather /api/weather"]
        W_CUR["GET current (1391 lines)"]
        W_FC["GET forecast"]
        W_IMG["GET images"]
        W_AS["GET images/asset"]
        W_ARC["GET archives"]
        W_TR["GET trends"]
        W_IN["GET insights"]
        W_REC["POST recommendations/generate"]
    end

    subgraph FIRE["Fire /api/fire"]
        F_SUM["GET summary"]
    end

    subgraph CHAT["Chat /api/chat"]
        C_STATE["GET state"]
        C_SSE["POST SSE stream"]
        C_SESS_L["GET sessions"]
        C_SESS_C["POST create session"]
        C_SESS_D["DELETE session"]
    end

    subgraph LAB["Lab /api/lab"]
        L_DECKS_L["GET decks"]
        L_DECKS_C["POST create deck"]
        L_CARDS_L["GET cards"]
        L_CARDS_C["POST create card"]
        L_AF["POST autofill"]
        L_GEN["POST generate (AI deck)"]
        L_REV["POST review (single)"]
        L_REV_B["POST review/batch (up to 50)"]
        L_REP["GET report"]
        L_IMP["POST import"]
        L_EXP["GET export"]
        L_TMPL["GET template"]
        L_ST["GET state"]
    end

    subgraph LABAI["Lab AI Chat /api/lab/ai-chat"]
        LA_SSE["POST SSE stream"]
        LA_SESS_L["GET sessions"]
        LA_SESS_C["POST create session"]
    end

    subgraph CS["Code Share /api/code-share"]
        CS_SESS_L["GET sessions"]
        CS_SESS_C["POST create session"]
        CS_SESS_G["GET [sessionId]"]
        CS_SESS_P["PATCH [sessionId]"]
        CS_SESS_D["DELETE [sessionId]"]
    end

    subgraph JJ["Jeonju /api"]
        JJ_B["GET /jeonju/briefing"]
        JJ_C_L["GET /jeonju-chat"]
        JJ_C_C["POST /jeonju-chat"]
    end

    subgraph AN["Analytics /api/analytics"]
        AN_PV["POST page-view"]
        AN_CN["POST consent"]
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

## 12. Rate Limiting & Quota Architecture

```mermaid
flowchart TD
    REQ["Incoming HTTP Request"]

    subgraph L1["Layer 1: In-Memory (proxy.ts)"]
        L1_RATE["Route-based Rate Limit (Map)"]
        L1_RATE --> L1_CHECK{"Under Limit?"}
        L1_CHECK -->|"No"| L1_429["429 Too Many Requests (Retry-After)"]
        L1_CHECK -->|"Yes"| L1_PASS["Pass to Handler"]
    end

    REQ --> L1_RATE

    subgraph L2["Layer 2: Auth-Specific DB"]
        L2_RATE["Attempt Buckets (auth_attempt_buckets)"]
        L2_RATE --> L2_CHECK{"login: 10/15min, register: 5/hour"}
        L2_CHECK -->|"Blocked"| L2_429["429 + blocked_until"]
        L2_CHECK -->|"OK"| L2_PASS["Proceed"]
    end

    L1_PASS --> L2_RATE

    subgraph L3["Layer 3: LLM Quota (llm/quota.ts)"]
        L3_GLOBAL["Global Daily Limit (5000 req/day)"]
        L3_USER["Per-User Per-Action Limit (100-200 req/day)"]
        
        L3_GLOBAL --> L3_CHECK{"global_req less than 5000?"}
        L3_CHECK -->|"No"| L3_429["429 Daily LLM limit reached"]
        L3_CHECK -->|"Yes"| L3_USER
        
        L3_USER --> L3_UCHECK{"user_action_req less than limit?"}
        L3_UCHECK -->|"No"| L3_429_USER["429 Your daily limit reached"]
        L3_UCHECK -->|"Yes"| L3_ALLOW["LLM Request Proceeds (atomic increment)"]
    end

    L2_PASS --> L3_GLOBAL

    subgraph L4["Layer 4: Lab-Specific Quotas"]
        L4_WEB["Web Search Monthly (100/month/user)"]
        L4_LAB["Lab Generation Daily (30/day/user)"]
    end

    L3_ALLOW --> L4_WEB
    L3_ALLOW --> L4_LAB
```

---

## 13. Data Encryption Architecture

```mermaid
flowchart LR
    W1["Plaintext value (e.g. user@example.com)"]
    W2["HKDF derive context key from Master Key"]
    W3["AES-256-GCM Encrypt (Random IV + AAD)"]
    W4["Blind Index: HMAC-SHA256(plaintext, HKDF(MK, context.blind))"]
    W5["enc:v1:salt:iv:tag:ciphertext (Base64URL)"]

    W1 --> W2
    W2 --> W3
    W1 --> W3
    W3 --> W5
    W1 --> W4

    subgraph DB["Database Row"]
        DB_WRITE[("email: enc:v1:... / email_hash: a1b2c3...")]
    end

    W5 --> DB_WRITE
    W4 -.->|"Stored in separate column for lookup"| DB_WRITE

    DB_WRITE --> R1["Read encrypted value from DB"]
    R1 --> R2["Extract version, salt, IV, tag, ciphertext"]
    R2 --> R3["HKDF derive key from context"]
    R3 --> R4["AES-256-GCM Decrypt (verify auth tag)"]
    R4 --> R5["Return plaintext"]

    L1["Search query: find user by email"]
    L2["Compute Blind Index HMAC-SHA256"]
    L3["SELECT * FROM users WHERE email_hash = ?"]
    L1 --> L2
    L2 --> L3
    L3 --> DB_WRITE
```

---

## 14. Deployment Architecture (Production)

```mermaid
graph TB
    USERS["End Users"]

    subgraph Server["Linux Server (PM2)"]
        NGINX["Nginx: port 80 to 443 redirect, SSL Termination, WebSocket Upgrade, CSP/HSTS/CORS"]

        subgraph PM2["PM2 Process"]
            NODE["Node.js Process (tsx server.ts)"]
            NEXT["Next.js App Router (SSR + API Routes + Middleware)"]
            WS["WebSocket Server (Code Share Presence, Typing, Heartbeat)"]
            SCHEDULER["Briefing Scheduler (Daily Jeonju Briefing)"]
            
            NODE --> NEXT
            NODE --> WS
            NODE --> SCHEDULER
        end
    end

    subgraph External["External Services"]
        DB[("TiDB Cloud (MySQL 8 Compatible)")]
        GENERAL_LLM_EXT["General LLM API<br/>OpenAI-compatible (범용)"]
        LAB_LLM_EXT["Lab LLM API<br/>OpenAI-compatible (실험실)"]
        TAVILY_EXT["Tavily Search API"]
        KMA_EXT["KMA API"]
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

## 15. i18n Architecture

```mermaid
flowchart TD
    LOCALE_DETECT["Language Detection: User setting, Browser Accept-Language, Default: ko"]

    LOCALE_DETECT --> CONTEXT["LanguageContext (React Context Provider)"]

    CONTEXT --> LOCALE_FILES["Translation Files: data/locales/ko.ts, en.ts, zh.ts, ja.ts"]

    LOCALE_FILES --> T_FUNC["t(key, seed?) function: Simple string or deterministic array variant. Fallback: ko to en to key"]

    T_FUNC --> COMPONENTS["All Components via useLanguage() hook"]

    CONTEXT --> API_HEADER["API Requests: X-Locale header (used by LLM prompts and validation)"]
```

---

## 16. Performance Optimization — Device Tier Detection

```mermaid
flowchart TD
    DETECT["Device Tier Detection (performance.ts)"]

    DETECT --> CPU["navigator.hardwareConcurrency"]
    DETECT --> MEM["navigator.deviceMemory"]
    DETECT --> PREFERS["prefers-reduced-motion"]
    DETECT --> SAVEDATA["navigator.connection.saveData"]
    DETECT --> LOW_PWR["Battery API status"]

    CPU --> TIER{"Device Tier?"}
    MEM --> TIER

    TIER -->|"Low"| LOW_SETTINGS["Low: Particles 0, Meteors 0, ShineBorder disabled, All animations reduced"]
    
    TIER -->|"Mid"| MID_SETTINGS["Mid: Particles 10, Meteors 1, ShineBorder reduced speed, Marquee repeats 1"]
    
    TIER -->|"High"| HIGH_SETTINGS["High: Particles 20, Meteors 3, ShineBorder full, All animations enabled"]
    
    PREFERS -->|"true"| REDUCED["Reduced Motion: All animations disabled (framer-motion: reduced)"]
    
    SAVEDATA -->|"true"| SAVE["Save Data Mode: Minimal visual effects, Deferred image loading"]
    
    LOW_PWR -->|"low"| BATTERY_SAVE["Battery Saver: Reduce particle count by 50 percent"]
```

---

## 17. Jeonju Briefing Scheduler — Timer-Based Generation

```mermaid
sequenceDiagram
    participant Server as server.ts
    participant Scheduler as jeonju-scheduler.ts
    participant LLM as General LLM / Lab LLM
    participant DB as TiDB

    Server->>Scheduler: startJeonjuBriefingScheduler()
    Scheduler->>Scheduler: Calculate next run time (Daily at 06:00 KST)

    loop Every Day at 06:00 KST
        Scheduler->>Scheduler: setTimeout until next 06:00
        
        Scheduler->>DB: Check if today's briefing exists
        alt Already generated
            DB-->>Scheduler: Briefing exists, skip
        else Not yet generated
            Scheduler->>Scheduler: Gather Jeonju weather and events data
            
            Scheduler->>LLM: Generate briefing (prompt with locale templates)
            LLM-->>Scheduler: Briefing content (ko, en, zh, ja)
            
            Scheduler->>DB: INSERT INTO jeonju_daily_briefings
            DB-->>Scheduler: OK
            
            Scheduler->>Scheduler: Broadcast via WebSocket (jeonju_briefing_updated)
        end
        
        Scheduler->>Scheduler: Schedule next run

        opt Cleanup Job (07:00 KST)
            Scheduler->>DB: DELETE FROM jeonju_chat_messages WHERE created_at < NOW() - 7 DAYS
            Note over Scheduler,DB: 7-day retention policy for chat messages
        end
    end
```

---

## Summary

| Layer | Core Technology | Module |
|-------|----------------|--------|
| **Frontend** | React 19, Next.js 16 App Router, TailwindCSS 4, Framer Motion, CodeMirror 6 | `src/app/`, `src/components/`, `src/context/` |
| **Security** | AES-256-GCM (Field-level Encryption), scrypt(N=16384) + Pepper, HKDF, HMAC Blind Index | `src/lib/security/`, `src/lib/auth/` |
| **Auth** | Cookie-based Session (7d TTL), SHA-256 Token Hash, In-Memory LRU Cache | `src/lib/auth/session.ts`, `src/lib/auth/repository.ts` |
| **Database** | TiDB / MySQL 8, mysql2/promise, 20 Tables | `src/lib/db.ts`, domain `schema.ts` files |
| **AI** | OpenAI-compatible LLM (General + Lab), SSE Streaming, Prompt Injection with Weather Context | `src/lib/llm/`, `src/lib/chat/`, `src/lib/lab-ai-chat/` |
| **Rate Limit** | 3-Layer: In-Memory (proxy.ts), DB Attempt Buckets, LLM Quota (FOR UPDATE) | `src/proxy.ts`, `src/lib/llm/quota.ts`, `src/lib/auth/repository.ts` |
| **WebSocket** | ws library, Room-based Pub/Sub, Presence Tracking, Heartbeat, Typing Indicators | `src/lib/websocket/` |
| **Spaced Repetition** | FSRS v5 Algorithm (stability, difficulty, state machine) | `src/lib/lab/` |
| **Search** | Tavily API, Cached Results, Monthly Quota | `src/lib/tavily/`, `src/lib/lab-ai-chat/` |
| **i18n** | 4 Languages (ko/en/zh/ja), Deterministic Array Variant Selection | `src/context/LanguageContext.tsx`, `src/data/locales/` |
| **Analytics** | Privacy-First, Consent-Gated, Multi-Dimensional Metrics | `src/lib/analytics/` |
| **Deploy** | PM2 + Nginx, Single Node.js Process (HTTP + WS), TiDB Cloud | `server.ts`, Nginx config |
