# 🌏 기상·환경 공공 데이터 Open API 마스터 레퍼런스 (Absolute Master)

이 문서는 프로젝트 개발 시 영구적으로 참고할 수 있도록, 실제 API 응답 필드(Key)와 속성 타입, 그리고 서비스별 호출 한도(Quota)를 집대성한 **'완전판'** 레퍼런스입니다.

---

## 📑 목차
1. [📊 서비스별 호출 한도 (Traffic & Quotas)](#-서비스별-호출-한도-traffic--quotas)
2. [🛰️ [PRO] 기상청 API 허브 (Expert)](#-pro-기상청-api-허브-expert)
3. [🌤️ [Standard] 기상청 단기/중기 예보 (data.go.kr)](#-standard-기상청-단기중기-예보-datagokr)
4. [🍃 [Environment] 에어코리아 대기질 (data.go.kr)](#-environment-에어코리아-대기질-datagokr)
5. [🌋 [Special] 지진, 태풍 및 생활기상 (data.go.kr)](#-special-지진-태풍-및-생활기상-datagokr)
6. [🛠️ 기술 상세 및 코드 정의](#-기술-상세-및-코드-정의)

---

## 📊 서비스별 호출 한도 (Traffic & Quotas)
안정적인 서비스 운영을 위해 아래의 호출 한도를 반드시 확인하고 필요 시 **운영계정 전환**을 신청하십시오.

| 데이터 플랫폼 | 서비스 구분 | 일일 호출 한도 (Quota) | 대응 방안 (한도 초과 시) |
| :--- | :--- | :--- | :--- |
| **기상청 API 허브** | **전체 통합** | **20,000회** (일반) | 로컬 캐싱(Redis 등) 적용 권장 |
| **에어코리아** | 실시간 대기오염 | 개발계정 500회 / **운영 10,000회** | 운영계정 전환 신청 (온라인 자동 승인) |
| **기상청 (포털)** | 단기/중기 예보 | 개발계정 1,000회 / **운영 10,000회** | 동일 키로 여러 서비스 공유 주의 |
| **생활기상지수** | 꽃가루 등 | 개발계정 200회 / **운영 10,000회** | 발표 주기가 길어(1일 2회) 잦은 호출 불필요 |

---

## 🛰️ [PRO] 기상청 API 허브 (Expert)
전문가용 실시간 관측 데이터 필드 (인증키: `F8Gfb...`)

### 1. ASOS 시간자료 (`kma_sfctm2.php`)
| 필드명(Key) | 속성 타입 | 의미 설명 (Description) | 비고 |
| :--- | :--- | :--- | :--- |
| **TM** | String | 관측 시각 (KST, YYYYMMDDHHMM) | |
| **STN** | Number | 지점번호 (전주: 146) | |
| **WD** | Number | 풍향 (16방위 중 각도 표시) | |
| **WS** | Number | 풍속 (m/s) | |
| **TA** | Number | 기온 (℃) | |
| **TD** | Number | 이슬점온도 (℃) | 안개 예측 지표 |
| **HM** | Number | 상대습도 (%) | |
| **PV** | Number | 수증기압 (hPa) | |
| **PA** | Number | 현지기압 (hPa) | |
| **PS** | Number | 해면기압 (hPa) | |
| **PT** | Number | 기압변화경향 (코드) | |
| **PR** | Number | 기압변화량 (hPa) | |
| **RN** | Number | 강수량 (mm) | |
| **SD** | Number | **현재 적설 (cm)** | 지면 적설 깊이 |
| **SD_HR3** | Number | **3시간 신적설 (cm)** | 최근 3h 신규 |
| **SD_DAY** | Number | **일 신적설 (cm)** | 금일 누적 신규 |

---

## 🌤️ [Standard] 기상청 단기/중기 예보 (data.go.kr)
예보 카테고리(`category`)별 모든 가능한 응답 키 정의

### 1. 단기예보 (`VilageFcst`) 카테고리 전수 목록
| 카테고리(Key) | 데이터 타입 | 의미 및 단위 |
| :--- | :--- | :--- |
| **TMP** | String | 1시간 기온 (℃) |
| **UUU** | String | 풍속(동서성분) (m/s) |
| **VVV** | String | 풍속(남북성분) (m/s) |
| **VEC** | String | 풍향 (deg) |
| **WSD** | String | 풍속 (m/s) |
| **SKY** | String | 하늘상태 (1:맑음, 3:구름많음, 4:흐림) |
| **PTY** | String | 강수형태 (0:없음, 1:비, 2:비/눈, 3:눈, 4:소나기) |
| **POP** | String | 강수확률 (%) |
| **WAV** | String | 파고 (M) |
| **PCP** | String | 1시간 강수량 (범주) |
| **SNO** | String | 1시간 신적설 (범주: 1cm 미만 등) |
| **REH** | String | 습도 (%) |
| **TMN** | String | 아침 최저기온 (℃) - 일 1회(0200) 제공 |
| **TMX** | String | 낮 최고기온 (℃) - 일 1회(0200) 제공 |

---

## 🍃 [Environment] 에어코리아 대기질 (data.go.kr)
실시간 대기오염 관측값의 `Value`, `Grade`, `Flag` 관계 규명

### 1. 대기오염 항목별 상세 필드
| 항목 | 농도값(Value) | 등급(Grade) | 측정상태(Flag) |
| :--- | :--- | :--- | :--- |
| **미세먼지(PM10)** | `pm10Value` | `pm10Grade` | `pm10Flag` |
| **초미세먼지(PM2.5)** | `pm25Value` | `pm25Grade` | `pm25Flag` |
| **오존(O3)** | `o3Value` | `o3Grade` | `o3Flag` |
| **이산화질소(NO2)** | `no2Value` | `no2Grade` | `no2Flag` |
| **일산화탄소(CO)** | `coValue` | `coGrade` | `coFlag` |
| **아황산가스(SO2)** | `so2Value` | `so2Grade` | `so2Flag` |

*   **Grade의미**: 1(좋음), 2(보통), 3(나쁨), 4(매우나쁨)
*   **Flag의미**: 데이터 부재 시 사유 (예: 장비점검, 교정, 자료미수집 등)
*   **Khai (통합지수)**: `khaiValue`(지수값), `khaiGrade`(통합 등급)

---

## 🌋 [Special] 지진, 태풍 및 생활기상 (data.go.kr)

### 1. 지진해일 통보문 (`getEqkMsg`)
*   `tmEqk`: 발생 시각 / `mag`: 규모 / `lat, lon`: 위경도 / `loc`: 발생위치 / `img`: 파형 이미지 URL

### 2. 기상특보 (`getWthrWrnList`)
*   `title`: 특보명 (예: [특보] 제03-24호) / `content`: 상세 내용 텍스트

---

## 🛠️ 기술 상세 및 코드 정의

### 1. 바람 벡터 좌표 변환 (Vector Math)
실제 앱에서 화살표 애니메이션을 구현하려면 다음 수식을 사용하십시오.
- **풍속**: `sqrt(UUU^2 + VVV^2)`
- **풍향(Degree)**: `(atan2(UUU, VVV) * 180 / PI + 180) % 360`

### 2. API 전수 데이터 타입 유의사항
- **data.go.kr**: 모든 수치 데이터가 **String** 타입으로 반환되는 경우가 많으니 반드시 `float()` 또는 `int()` 형변환이 필요합니다.
- **API Hub (RAW)**: 공백으로 구분된 텍스트 데이터이므로 정규표현식이나 `split()`을 통한 신중한 파싱이 필요합니다.

---
> [!TIP]
> **운영계정 신청 팁**: 공공데이터포털 마이페이지에서 신청 후 '운영 승인'이 완료되면, 동일한 키를 사용하되 할당량만 즉시 늘어납니다. (별도의 키 발급 불필요)
