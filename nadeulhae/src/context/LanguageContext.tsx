"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

type Language = "ko" | "en"
const LANGUAGE_STORAGE_KEY = "nadeulhae_language"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, seed?: string | number) => string
}

const translations: Record<Language, Record<string, string | string[]>> = {
  ko: {
    // Navbar
    nav_home: "홈",
    nav_jeonju: "전주+",
    nav_about: "소개",
    nav_stats: "통계 달력",
    nav_calendar: "달력",
    nav_lab: "실험실",
    nav_login: "로그인",
    nav_login_status: "연결 준비 중",
    nav_login_unsupported: "현재 지원되지 않음",
    logo_text: "나들해",
    login_back_home: "홈으로 돌아가기",
    login_back_login: "로그인으로 돌아가기",
    login_badge: "준비 중",
    login_title: "로그인",
    login_subtitle: "계정 기능은 추후 백엔드 연결과 함께 열릴 예정입니다.",
    login_email: "이메일",
    login_password: "비밀번호",
    login_email_placeholder: "name@example.com",
    login_password_placeholder: "••••••••",
    login_forgot: "비밀번호를 잊으셨나요?",
    login_cta_pending: "로그인 준비 중",
    login_no_account: "계정이 없으신가요?",
    login_go_signup: "회원가입",
    signup_title: "함께 시작해볼까요?",
    signup_subtitle: "회원가입 기능도 로그인과 함께 순차적으로 열릴 예정입니다.",
    signup_name: "이름",
    signup_name_placeholder: "홍길동",
    signup_password_placeholder: "최소 8자 이상",
    signup_terms: "가입 시 나들해의 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.",
    signup_cta_pending: "회원가입 준비 중",
    signup_has_account: "이미 계정이 있으신가요?",
    signup_go_login: "로그인",
    
    // UI General
    loading_weather: "날씨 정보를 불러오고 있습니다...",
    loading_locating: "위치 찾는 중...",
    footer_copy: "© 2026 나들해 (Nadeulhae). All rights reserved.",
    footer_notice: "위치 권한이 허용되면 현재 지역 날씨 판단에만 활용되며, 화면 데이터는 기상청·한국환경공단 등 공공 데이터를 기반으로 구성됩니다.",
    
    // Hero
    hero_title: "오늘 전주는 피크닉 가기 완벽한 날이에요!",
    hero_score_label: "현재",
    hero_score_subtitle: "피크닉 지수",
    hero_best_day: "최고의 나들이 날씨!",
    hero_unit: "점",
    hero_temp: "기온",
    hero_humidity: "습도",
    hero_wind: "풍속",
    hero_dust: "미세먼지",
    hero_pm10: "미세먼지(PM10)",
    hero_pm25: "초미세먼지(PM2.5)",
    hero_o3: "오존",
    hero_no2: "이산화질소",
    hero_co: "일산화탄소",
    hero_so2: "아황산가스",
    hero_khai: "통합대기지수",
    hero_vec: "풍향",
    hero_precip: "강수량",
    hero_uv: "자외선",
    
    status_coming_soon: "백엔드 연결 대기 중",
    status_nearby_station: "인근 측정소",
    station_dukjin: "덕진동",
    
    // Statistics
    stats_title: "과거 데이터로 보는 전주",
    stats_desc: "DB에 적재된 수년간의 기상 데이터를 분석한 결과입니다.",
    
    // AI Action
    ai_title: "당신의 하루를 설계해 드릴게요",
    ai_desc: "원하는 시간대와 지역을 선택하세요. AI가 실시간 날씨 흐름에 최적화된 반나절 코스를 추천합니다.",
    ai_time_label: "활동 시간대",
    ai_time_val: "13:00 ~ 18:00 (오후 반나절)",
    ai_loc_label: "추천 지역",
    ai_loc_val: "전주 덕진구 (세병호 인근)",
    ai_loc_current: "현재 위치 사용",
    ai_loc_mock: "전주시 완산구 (내 위치)",
    ai_button: "AI 코스 생성하기",
    ai_loading: "전주 날씨 데이터 분석 중...",
    ai_processing_label: "LLM & 날씨 DB 분석 중",
    ai_loading_detail: "기상 층밀림 현상 분석 중...",
    
    // Result
    result_title: "추천 반나절 코스",
    result_desc: "날씨 흐름에 맞춘 최적화된 동선입니다.",
    
    // About
    about_hero_tag: "Our Vision",
    about_hero_title: "전주의 모든 순간을 날씨와 연결하다",
    about_hero_desc: "나들해는 단순한 날씨 정보를 넘어, 당신의 소중한 전주 나들이가 날씨의 흐름 속에서 가장 아름다울 수 있도록 설계되었습니다.",
    about_features_title: "나들해가 하는 일",
    about_features_desc: "실시간 공공 데이터를 읽고, 위험 신호를 먼저 걸러낸 뒤, 지금 나들이가 괜찮은지 지역 기준으로 빠르게 정리합니다.",
    about_built_with: "Built with Modern Stack",
    about_contributors_title: "만든 사람들",
    
    // Algorithm Section
    about_algo_title: "나들이 지수 알고리즘",
    about_algo_desc: "현재 나들이 지수는 먼저 위험 요소를 차단한 뒤, 평시에는 대기질·기온·하늘·바람 네 축만 100점 만점으로 합산합니다.",
    about_algo_knockout_title: "1단계: 즉시 탈락 필터",
    about_algo_knockout_desc: "기상특보·지진해일·화산 또는 규모 4.0 이상 지진이 감지되면 즉시 0점, 현재 비·눈·소나기가 오면 즉시 10점으로 고정합니다. 이 경우 다른 계산은 생략됩니다.",
    about_algo_air_title: "대기질 40점",
    about_algo_air_desc: "AirKorea의 `khaiGrade`를 사용합니다. 좋음 40점, 보통 30점, 나쁨 10점, 매우나쁨 0점으로 계산합니다.",
    about_algo_temp_title: "기온 30점",
    about_algo_temp_desc: "TMP 기준으로 17~24℃는 30점, 12~16℃·25~28℃는 20점, 10~11℃·29~31℃는 10점, 그 밖은 0점입니다.",
    about_algo_sky_title: "하늘 20점",
    about_algo_sky_desc: "SKY가 맑음(1) 또는 구름많음(3)이면 20점, 흐림(4)이면 10점입니다.",
    about_algo_wind_title: "바람 10점",
    about_algo_wind_desc: "WSD가 0~3m/s면 10점, 4~6m/s면 5점, 7m/s 이상이면 0점입니다.",
    about_algo_data_title: "실시간 데이터 동기화",
    about_algo_data_desc: "기상청 초단기 실황/예보와 에어코리아 실시간 대기 API를 지역 캐시와 함께 읽어 실제 화면과 설명이 같은 규칙을 따르도록 맞춥니다.",
    about_placeholder: "이곳에 당신의 정보가 들어갈 수 있도록 추후 정보를 업데이트할 예정입니다.",
    
    // Calendar
    cal_title: "피크닉 캘린더",
    cal_desc: "실시간 예보와 날짜별 점수를 함께 보며 나들이 타이밍을 고를 수 있습니다.",
    cal_legend: "피크닉 최적일",
    cal_realtime_title: "실시간 예보 캘린더",
    cal_realtime_desc: "앞으로의 예보 흐름과 날짜별 피크닉 점수를 한 번에 확인할 수 있습니다.",
    cal_realtime_status: "실시간 데이터",
    cal_realtime_note: "기상청으로부터 실시간으로 수신된 예보 데이터입니다. 매시간 업데이트됩니다.",
    
    // Briefing
    brief_title: "오늘의 나들이 브리핑",
    brief_temp_perfect: "현재 기온이 {temp}°C로, 나들하기 딱 좋은 쾌적한 온도입니다.",
    brief_temp_v_cold: "현재 {temp}°C로 매우 춥습니다! 두꺼운 외투와 방한 용품이 필수예요.",
    brief_temp_cold: "현재 {temp}°C로 기온이 낮으니 따뜻한 겉옷을 챙기세요.",
    brief_temp_mild: "현재 {temp}°C로 선선한 날씨입니다. 가벼운 외투가 적당해요.",
    brief_temp_warm: "현재 {temp}°C로 완연한 봄 기운이 느껴지네요. 야외 활동하기 좋습니다.",
    brief_temp_hot: "현재 {temp}°C로 다소 더운 날씨입니다. 시원한 음료를 준비하세요.",
    brief_temp_v_hot: "현재 {temp}°C로 매우 덥습니다! 장시간 야외 활동은 피하고 수분을 섭취하세요.",
    
    brief_dust_excel: "미세먼지 농도가 {dust}로 매우 낮아 전주의 공기가 아주 맑고 깨끗합니다.",
    brief_dust_good: "미세먼지가 {dust}로 청정하여 상쾌한 나들이를 즐기기 좋습니다.",
    brief_dust_mod: "미세먼지가 {dust}로 보통 수준입니다. 민감하신 분은 대기 정보를 확인하세요.",
    brief_dust_bad: "미세먼지가 {dust}로 나쁨 수준입니다. 야외 활동 시 마스크를 꼭 쓰세요.",
    
    brief_wind_calm: "바람이 {wind}m/s로 거의 불지 않아 평온한 분위기입니다.",
    brief_wind_breezy: "바람이 {wind}m/s로 기분 좋게 선선하게 불어오네요.",
    brief_wind_strong: "현재 풍속이 {wind}m/s로 강하게 불어 지지물이 흔들릴 수 있습니다.",
    
    brief_humi_dry: "습도가 {humi}%로 매우 건조합니다. 화재 예방과 수분 섭취에 유의하세요.",
    brief_humi_comfort: "습도가 {humi}%로 쾌적하여 상쾌한 기분이 드는 날입니다.",
    brief_humi_humid: "습도가 {humi}%로 다소 눅눅합니다. 불쾌지수가 높을 수 있으니 참고하세요.",
    
    brief_pty_rain: "현재 비가 내리고 있습니다. 우산을 챙기거나 실내 나들이 코스를 권장합니다.",
    brief_pty_snow: "현재 눈이 내리고 있습니다. 빙판길 안전에 유의하며 설경을 즐겨보세요.",

    // Status Tiers
    status_excellent: "최고의 날",
    status_good: "좋은 날",
    status_fair: "보통인 날",
    status_poor: "나쁜 날",
    
    msg_excellent: [
      "오늘은 전주에서 피크닉 가기 완벽한 날이에요!",
      "오늘 전주는 나들이하기에 더할 나위 없이 완벽해요!",
      "기상 조건이 최상입니다. 지금 바로 세병호로 떠나보세요!",
      "세병호의 맑은 공기를 만끽하기 가장 좋은 날이에요!",
      "오늘 같은 날은 무심코 걷기만 해도 힐링이 되는 전주입니다."
    ],
    msg_good: [
      "산책하고 나들이하기 참 좋은 날씨입니다.",
      "햇살이 기분 좋게 내리쬐는 전주의 오후네요.",
      "가벼운 산책으로 기분 전환하기 딱 좋은 날씨입니다.",
      "적당한 햇살과 바람이 어우러진 기분 좋은 나들이 날씨예요.",
      "오늘 전주의 대기질은 아주 양호합니다. 야외 활동을 추천드려요."
    ],
    msg_fair: [
      "그럭저럭 나들이하기 괜찮은 날씨예요.",
      "조금은 아쉽지만, 근처 공원 산책 정도는 괜찮아요.",
      "날씨가 아주 나쁘진 않으니 가볍게 야외 공기를 쐬 보세요.",
      "완벽하진 않아도 가벼운 산책 정도는 즐기기 나쁘지 않은 날이에요.",
      "실내외 코스를 적절히 섞어서 전주를 즐겨보시는 건 어떨까요?"
    ],
    msg_poor: [
      "오늘은 야외 활동을 피하는 것이 좋겠어요.",
      "날씨가 불안정합니다. 가급적 실내 활동을 권장드려요.",
      "현재 야외 활동을 하기엔 부적합한 기상 조건입니다.",
      "야외보다는 전주의 예쁜 카페나 박물관을 방문해보는 건 어떨까요?",
      "아쉽게도 오늘은 날씨가 도와주지 않네요. 실내에서 여유를 찾아보세요."
    ],
    msg_home_excellent: [
      "오늘 전주는 강변 산책부터 세병호 나들이까지 마음껏 즐기기 좋은 날이에요.",
      "전주 하늘과 공기 흐름이 모두 안정적입니다. 여유 있게 바깥 일정을 잡아도 좋습니다.",
      "전주 특유의 느긋한 산책 코스를 즐기기 딱 좋은 컨디션이에요.",
      "덕진공원과 전주천 주변이 특히 쾌적하게 느껴질 만한 날씨입니다.",
      "오늘은 전주에서 오래 걷고 오래 머물기 좋은, 균형 잡힌 나들이 날입니다."
    ],
    msg_home_good: [
      "전주 기준으로 보면 꽤 안정적인 날씨라 가벼운 나들이에 잘 맞습니다.",
      "큰 변수 없이 전주 야외 코스를 소화하기 좋은 하루예요.",
      "햇살과 공기질이 무난해서 전주 골목 산책이나 공원 일정이 잘 어울립니다.",
      "전주에서 반나절 정도 바깥 일정을 잡기 좋은 흐름입니다.",
      "오늘 전주는 실외 일정 위주로 움직여도 부담이 크지 않겠어요."
    ],
    msg_home_fair: [
      "전주는 오늘 완벽하진 않지만, 짧은 산책 정도는 충분히 가능합니다.",
      "기상 조건이 살짝 아쉬워서 전주에서는 실내외를 섞은 일정이 더 잘 맞아요.",
      "오래 머무는 야외 일정보다는 짧게 움직이는 코스가 어울립니다.",
      "전주 기준으로는 무난한 편이지만, 시간대를 잘 골라 움직이는 게 좋겠습니다.",
      "상황을 보며 유연하게 동선을 바꾸면 충분히 즐길 수 있는 날입니다."
    ],
    msg_home_poor: [
      "오늘 전주는 야외보다 실내 코스를 우선으로 두는 편이 안전합니다.",
      "전주 지역 기상 흐름이 좋지 않아 실외 일정은 짧게 가져가는 쪽이 낫습니다.",
      "날씨 변수가 커서 전주에서는 카페나 실내 공간 중심 동선이 더 어울립니다.",
      "오늘은 무리한 나들이보다 실내에서 천천히 시간을 보내는 편이 좋겠어요.",
      "전주 하늘 상태가 불안정하니 평소보다 보수적으로 일정을 잡는 게 좋습니다."
    ],
    msg_away_excellent: [
      "지금 계신 지역은 야외 활동을 길게 잡아도 좋을 만큼 컨디션이 안정적입니다.",
      "현재 위치 기준으로 보면 산책이나 공원 일정에 매우 잘 맞는 날씨예요.",
      "오늘은 다른 지역에서도 전주 못지않게 쾌적한 바깥 일정이 가능합니다.",
      "현 위치의 공기와 기온 흐름이 좋아 긴 야외 코스를 계획하기 좋습니다.",
      "지금 계신 곳은 한동안 바깥에 머물기 좋은 맑고 안정적인 상태입니다."
    ],
    msg_away_good: [
      "현재 위치 기준으로 무난하게 야외 일정을 소화할 수 있는 날씨입니다.",
      "지금 계신 지역은 가벼운 산책이나 근거리 나들이에 잘 맞습니다.",
      "큰 위험 신호 없이 외부 활동을 즐기기 괜찮은 조건입니다.",
      "현재 지역은 반나절 정도의 실외 일정에 잘 어울리는 흐름입니다.",
      "지금 위치에서는 공원이나 산책 코스를 편하게 즐기기 좋겠어요."
    ],
    msg_away_fair: [
      "지금 계신 지역은 짧은 외출은 괜찮지만 오래 머무는 일정은 신중한 편이 좋습니다.",
      "현재 위치의 날씨는 평범한 수준이라 동선을 유연하게 잡는 게 좋겠습니다.",
      "가벼운 산책 정도는 괜찮지만 실내 대안을 함께 준비해두면 좋겠어요.",
      "현재 지역은 순간적인 변수에 대비해 짧은 코스로 움직이는 편이 적절합니다.",
      "실내외를 섞어서 움직이면 지금 위치에서도 충분히 하루를 즐길 수 있습니다."
    ],
    msg_away_poor: [
      "지금 계신 지역은 야외 활동보다 실내 대안을 우선으로 두는 편이 좋습니다.",
      "현재 위치의 기상 흐름이 불안정해 무리한 바깥 일정은 추천하지 않습니다.",
      "외부 체류 시간을 줄이고 실내 중심으로 움직이는 편이 안전합니다.",
      "지금 계신 지역은 실외 컨디션이 좋지 않아 일정 조정이 필요해 보입니다.",
      "현재 지역은 날씨 리스크가 있어 짧은 이동과 실내 계획이 더 잘 맞습니다."
    ],
    
    // Knock-out Event Alert Messages
    alert_earthquake_title: "🚨 지진해일 특보 발효 중",
    alert_earthquake_desc: "인근 해역 지진 발생으로 인하여 야외 활동을 절대 금지합니다.",
    alert_weather_wrn_title: "🚨 기상특보 발효 중",
    alert_weather_wrn_desc: "현재 조회 지역에 기상특보가 발효 중입니다. 안전을 위해 외출을 삼가세요.",
    alert_heavy_rain_title: "☔ 현재 거센 비/눈이 내리고 있습니다",
    alert_heavy_rain_desc: "기상 조건 악화로 피크닉 지수가 크게 하락했습니다. 실내 활동으로 일정을 변경하세요.",
    
    // Fallback Location
    fallback_message: "현재 계신 지역의 대기 정보를 일시적으로 불러올 수 없어, 나들해의 홈타운인 '전주' 기준 날씨를 보여드려요! 🏡",

    // Detailed Data Descriptions
    about_data_title: "데이터 항목 상세 안내",
    about_data_desc: "나들해에서 제공하는 10가지 이상의 정밀 기상 데이터를 이해하기 쉽게 설명해 드립니다.",
    
    about_item_temp: "기온 (Temperature)",
    about_item_temp_desc: "공기의 온도를 뜻하며, 18~24°C 사이가 나들이에 가장 쾌적합니다. 10°C 미만은 춥고, 30°C 이상은 폭염 유의가 필요합니다.",
    
    about_item_humi: "습도 (Humidity)",
    about_item_humi_desc: "공기 중 수증기 양으로, 40~60%가 가장 쾌적합니다. 70%가 넘으면 눅눅하고 불쾌지수가 높아질 수 있습니다.",
    
    about_item_wind: "풍속 (Wind Speed)",
    about_item_wind_desc: "바람의 세기로, 4m/s 이하는 기분 좋은 산들바람입니다. 8m/s 이상은 소지품이 날아갈 수 있어 주의가 필요합니다.",
    
    about_item_vec: "풍향 (Wind Direction)",
    about_item_vec_desc: "바람이 불어오는 방향입니다. 북풍은 주로 차가운 공기를, 서풍은 내륙의 먼지를 동반할 가능성이 있습니다.",
    
    about_item_pm10: "미세먼지 (PM10)",
    about_item_pm10_desc: "지름 10µg 이하의 먼지로, 30µg/m³ 이하면 매우 좋음입니다. 80µg/m³를 넘으면 마스크 착용이 권고됩니다.",
    
    about_item_pm25: "초미세먼지 (PM2.5)",
    about_item_pm25_desc: "머리카락 굵기보다 20~30배 작은 미세한 먼지입니다. 15µg/m³ 이하는 안전하지만 35µg/m³ 초과 시 주의해야 합니다.",
    
    about_item_o3: "오존 (Ozone)",
    about_item_o3_desc: "강한 햇빛에 의해 생성되며, 0.03ppm 이하는 안전합니다. 농도가 높으면 눈이나 호흡기에 자극을 줄 수 있습니다.",
    
    about_item_no2: "이산화질소 (NO2)",
    about_item_no2_desc: "주로 자동차 배기가스에서 발생합니다. 0.03ppm 이하면 청정하며, 도시 대기질의 주요 지표 중 하나입니다.",
    
    about_item_khai: "통합대기지수 (KHAI)",
    about_item_khai_desc: "여러 오염물질을 종합한 공기질 지수입니다. 0~50은 최고(Excellent), 100을 넘으면 건강에 유해할 수 있습니다.",
    
    about_item_precip: "강수량 (Precipitation)",
    about_item_precip_desc: "비나 눈의 양입니다. 나들이에는 0mm가 가장 완벽하며, 소량이라도 강수가 있으면 지수가 급격히 하락합니다.",

    // Features
    about_feature_1_name: "실시간 나들이 판단",
    about_feature_1_desc: "현재 날씨를 단순 표시하는 대신 대기질, 기온, 하늘, 바람을 점수화해 지금 바로 밖에 나가도 괜찮은지 빠르게 읽을 수 있게 정리합니다.",
    about_feature_2_name: "위험 신호 우선 감지",
    about_feature_2_desc: "기상특보, 공식 통보, 지진, 강수 여부를 함께 확인하고 실제 위험이 있을 때만 경고 화면과 문구를 강하게 드러냅니다.",
    about_feature_3_name: "지역 맞춤 관측소 연결",
    about_feature_3_desc: "사용자 위치에 따라 인근 측정소와 예보 권역을 다르게 연결해, 같은 서비스라도 지역에 맞는 공기질과 통보를 보여줍니다.",
    about_feature_4_name: "호출량을 아끼는 구조",
    about_feature_4_desc: "기상, 대기질, 특보 데이터를 지역별 캐시로 묶어 새로고침이 반복되어도 공공 API 호출이 과하게 늘지 않도록 설계했습니다.",
    about_feature_cta: "구현 내용 보기",
    about_data_driven: "공공 데이터 기반",
    about_live_title: "실시간 데이터 파이프라인",
    about_live_desc: "현재 서비스는 공공 API를 그대로 보여주지 않고, 지역 판별과 캐시 정책을 거쳐 화면에 맞는 형태로 다시 구성합니다.",
    about_live_card_1_title: "지역별 관측소 매핑",
    about_live_card_1_desc: "서울은 서울 측정소, 전주는 전북 권역과 전주 인근 측정소를 우선 연결해 실제 위치에 맞는 공기질을 보여줍니다.",
    about_live_card_2_title: "조건부 위험 노출",
    about_live_card_2_desc: "비, 특보, 지진 데이터가 실제로 감지될 때만 경고 UI를 띄우며, 평시에는 평온한 일반 화면만 유지합니다.",
    about_live_card_3_title: "전주 우선 경험",
    about_live_card_3_desc: "위치 권한이 없거나 대기질 응답이 비정상일 때는 전주 홈 기준으로 안전하게 대체하되, 그 사실을 명확히 안내합니다.",
    about_structure_title: "서비스 구성",
    about_structure_desc: "메인, 달력, 전주 특화 페이지의 역할을 분리해 화면은 단순하게 유지하고 필요한 정보는 더 정확하게 보여줍니다.",
    about_structure_home_title: "홈",
    about_structure_home_desc: "어느 지역에서 접속해도 현재 위치 기준 피크닉 지수, 공식 통보, 인근 측정소, 브리핑을 바로 확인하는 범용 진입 화면입니다.",
    about_structure_calendar_title: "달력",
    about_structure_calendar_desc: "10일 예보 흐름과 날짜별 점수를 집중해서 보는 전용 화면입니다. 지역 예보 캘린더는 이 페이지에서만 제공합니다.",
    about_structure_jeonju_title: "전주 특화",
    about_structure_jeonju_desc: "전주 로컬 맥락, 전용 안내, 향후 장소 DB와 코스 기능 로드맵을 모아두는 별도 공간입니다.",
    about_structure_future_title: "추후 오픈",
    about_structure_future_desc: "과거 통계, 음식점·카페·야외 스팟 DB, AI 반나절 코스는 백엔드와 DB 연결 이후 단계적으로 열 예정입니다.",

    // Technical Labels & Briefing UI
    brief_station_engine: "상황 분석 엔진",
    brief_observation_grid: "환경 관측 그리드",
    brief_nrs_protocol: "NRS V1.0 - 실시간 프로토콜",
    brief_kma_sync: "기상청 동기화",
    brief_air_sync: "대기질 동기화",
    brief_data_source: "데이터 출처",
    brief_ai_db_archive: "AI 엔진 / DB 아카이브",
    
    // Status & Levels
    level_excel: "매우 좋음",
    level_good: "좋음",
    level_mod: "보통",
    level_bad: "나쁨",
    level_v_bad: "매우 나쁨",
    
    uv_low: "낮음",
    uv_mod: "보통",
    uv_high: "높음",
    uv_v_high: "매우 높음",
    uv_extreme: "위험",
    
    // Meta & Sources
    interval_45m: "매시 45분",
    interval_0m: "매시 정각",
    data_source_kma: "기상청",
    data_source_air: "한국환경공단",
    data_source_combined: "기상청, 한국환경공단",
    label_domestic: "국내",
    label_who: "WHO",

    // Insights & Trends
    insight_1_title: "최적의 요일",
    insight_1_desc: "지난 3년 통계 분석 결과, 이번 달 가장 쾌적한 피크닉 요일은 '토요일'입니다.",
    insight_1_cta: "통계 달력 보기",
    insight_2_title: "기후 에너지",
    insight_2_desc: "오늘 전주의 기상 에너지는 92%로, 외부 활동에 매우 긍정적인 수치입니다.",
    insight_2_cta: "에너지 리포트",
    insight_3_title: "실시간 혼잡도",
    insight_3_desc: "덕진공원 인근은 현재 '여유' 로우며, 쾌적한 자리 선점이 가능합니다.",
    insight_3_cta: "장소 예약 문의",
    
    trend_header: "지금 전주 시민들이 많이 찾는 스팟",
    trend_title: "{spot}",
    
    course_1_title: "따뜻한 야외 타임 - 덕진공원",
    course_1_desc: "햇살이 가장 따뜻하고 미세먼지가 없는 시간대예요. 덕진공원에서 돗자리를 펴고 샌드위치를 드시는 걸 추천해요!",
    course_2_title: "바람 피하기 타임 - 카페 정비",
    course_2_desc: "늦은 오후부터는 찬 바람이 불어 체감 온도가 떨어질 수 있어요. 카페로 이동해 여유를 즐겨보세요.",

    // Metric Guide Title
    guide_title: "상세 기상 및 대기 데이터 가이드",
    guide_desc: "나들해는 기상청과 한국환경공단의 실시간 오픈 API를 통해 수집된 10가지 이상의 정밀 데이터를 분석하여 피크닉 최적도를 산출합니다. 각 지표의 의미와 기준은 다음과 같습니다.",

    // Metrics
    guide_temp_t: "기온",
    guide_temp_d: "현재 지표면 부근의 대기 온도입니다. 18°C~24°C 사이가 야외 활동에 가장 쾌적하며, 30°C 이상이거나 5°C 이하일 경우 주의가 필요합니다.",
    guide_humi_t: "습도",
    guide_humi_d: "공기 중 수증기의 비율입니다. 40%~60%가 가장 쾌적하며, 70% 이상일 경우 불쾌지수가 높아지고 땀 증발이 더뎌집니다.",
    guide_wind_t: "풍속",
    guide_wind_d: "공기의 이동 속도입니다. 1.5m/s~3.5m/s는 시원한 바람을 느끼기 좋으나, 5m/s 이상일 경우 물건이 날아가거나 돗자리 이용에 불편함이 있습니다.",
    guide_vec_t: "풍향",
    guide_vec_d: "바람이 불어오는 방향입니다. 전주의 지형적 특성상 북서풍이 불 때 체감 온도가 더 낮게 느껴질 수 있습니다.",
    guide_pm10_t: "미세먼지(PM10)",
    guide_pm10_d: "지름 10µg 이하의 미세 오염물질입니다. 30µg/m³ 이하는 '좋음', 80µg/m³ 이상은 '나쁨'으로 분류되어 장시간 실외 활동 자제를 권고합니다.",
    guide_pm25_t: "초미세먼지(PM2.5)",
    guide_pm25_d: "지름 2.5µg 이하로 폐포까지 침투 가능한 고위험 물질입니다. 15µg/m³ 이하가 이상적이며, 35µg/m³ 초과 시 마스크 착용이 필수적입니다.",
    guide_o3_t: "오존",
    guide_o3_d: "대기 중 농도가 높아지면 눈과 호흡기를 자극합니다. 주로 햇빛이 강한 여름 오후에 농도가 높아지며, 0.09ppm 초과 시 주의보가 발령됩니다.",
    guide_no2_t: "이산화질소",
    guide_no2_d: "주로 자동차 배기가스에서 배출되며 기관지 염증을 유발할 수 있습니다. 0.03ppm 이하가 쾌적한 수준입니다.",
    guide_khai_t: "통합대기환경지수",
    guide_khai_d: "초미세먼지, 오존 등 여러 오염물질을 종합하여 산출한 수치입니다. 0~50은 '좋음', 100 이상은 '나쁨'을 뜻합니다.",
    guide_rn1_t: "강수량",
    guide_rn1_d: "최근 1시간 동안 내린 비의 양입니다. 0.1mm 이상의 강수가 감지되면 피크닉 점수가 크게 하락합니다.",

    // Contributors & Status
    about_status_pending: "백엔드 연결 준비 중",
    about_contributors_desc: "전북대학교 소프트웨어공학과 3학년(24학번) 동기 3명이 함께 만든 데이터베이스 팀 프로젝트입니다. 모든 팀원이 데이터베이스 설계 및 구축에 핵심적으로 참여했습니다.",
    
    con_hm_name: "김현민",
    con_hm_role: "전북대학교 소프트웨어공학과 24학번",
    con_hm_desc: "서비스 전체 구조를 잡고 기상 데이터를 효율적으로 저장할 수 있는 데이터베이스의 뼈대를 설계했습니다.",
    
    con_es_name: "김은수",
    con_es_role: "전북대학교 소프트웨어공학과 24학번",
    con_es_desc: "공공 API와 위치 데이터를 직접 수집해서 우리 데이터베이스에 맞게 차곡차곡 쌓는 작업을 맡았습니다.",
    
    con_jh_name: "이재혁",
    con_jh_role: "전북대학교 소프트웨어공학과 24학번",
    con_jh_desc: "실시간으로 변하는 날씨 데이터를 우리 데이터베이스와 연결해 주는 파이프라인을 만들었습니다.",

    con_university: "전북대학교",
    con_department: "소프트웨어공학과 24학번",

    about_philosophy_title: "나들해를 만든 사람들",
    about_philosophy_desc: "전북대학교 소프트웨어공학과 24학번 동기 3명이 함께 기획하고 개발했습니다. 서비스의 화려함보다는 데이터가 어떻게 흐르고 저장되는지, 데이터베이스의 기본에 집중하며 만들었습니다.",

    // Statistics Page Extra
    cal_archive_title: "피크닉 아카이브",
    cal_archive_desc: "월 단위 달력에서 피크닉 지수 상위 추천일 패턴을 한눈에 확인합니다.",
    cal_insight_title: "인사이트",
    cal_insight_text: "전주는 전통적으로 5월 2~3주차 주말이 가장 쾌적한 피크닉 지수를 기록했습니다.",
    cal_origin_title: "데이터 출처",
    cal_origin_desc: "반짝 아이콘 날짜는 피크닉 지수 80점 이상인 추천일을 뜻합니다.",
  },

  en: {
    // Navbar
    nav_home: "Home",
    nav_jeonju: "Jeonju+",
    nav_about: "About",
    nav_calendar: "Calendar",
    nav_lab: "Lab",
    nav_login: "Login",
    nav_login_status: "Sync Pending",
    nav_login_unsupported: "Unsupported",
    logo_text: "Nadeulhae",
    login_back_home: "Back to Home",
    login_back_login: "Back to Login",
    login_badge: "Coming Soon",
    login_title: "Login",
    login_subtitle: "Account features will open later with backend integration.",
    login_email: "Email",
    login_password: "Password",
    login_email_placeholder: "name@example.com",
    login_password_placeholder: "••••••••",
    login_forgot: "Forgot your password?",
    login_cta_pending: "Login Coming Soon",
    login_no_account: "Don’t have an account?",
    login_go_signup: "Sign Up",
    signup_title: "Ready to start?",
    signup_subtitle: "Sign-up will also open later together with login support.",
    signup_name: "Name",
    signup_name_placeholder: "Your name",
    signup_password_placeholder: "At least 8 characters",
    signup_terms: "By signing up, you agree to the Terms of Service and Privacy Policy of Nadeulhae.",
    signup_cta_pending: "Sign Up Coming Soon",
    signup_has_account: "Already have an account?",
    signup_go_login: "Login",
    
    // UI General
    loading_weather: "Loading weather data...",
    footer_copy: "© 2026 Nadeulhae. All rights reserved.",
    footer_notice: "If location access is allowed, it is used only for regional weather decisions, and the interface is built from public datasets such as KMA and AirKorea.",

    // Hero
    hero_title: "Jeonju is perfect for a picnic today!",
    hero_unit: "pts",
    hero_temp: "Temp",
    hero_humidity: "Humidity",
    hero_wind: "Wind",
    hero_dust: "Dust",
    hero_pm10: "PM10",
    hero_pm25: "PM2.5",
    hero_o3: "O3",
    hero_no2: "NO2",
    hero_co: "CO",
    hero_so2: "SO2",
    hero_khai: "CAI",
    hero_vec: "Wind Dir",
    hero_precip: "Precip",
    hero_uv: "UV",
    hero_score_label: "Current",
    hero_score_subtitle: "Picnic Index",
    hero_best_day: "Perfect Picnic Weather!",
    
    status_coming_soon: "Coming Soon",
    status_nearby_station: "Nearby Station",
    station_dukjin: "Dukjin-dong",
    
    // Statistics
    stats_title: "Jeonju through Data",
    stats_desc: "Analysis of years of weather data stored in our DB.",
    
    // AI Action
    ai_title: "Designing Your Day",
    ai_desc: "Choose your time and area. AI will recommend a half-day course optimized for real-time weather.",
    ai_time_label: "Activity Time",
    ai_time_val: "13:00 ~ 18:00 (Afternoon)",
    ai_loc_label: "Area",
    ai_loc_val: "Deokjin-gu, Jeonju",
    ai_loc_current: "Use Current Location",
    ai_loc_mock: "Wansan-gu (My Location)",
    ai_button: "Generate AI Course",
    ai_loading: "Analyzing weather data...",
    ai_processing_label: "LLM & Weather DB Processing",
    ai_loading_detail: "Calculating atmospheric shifts...",
    
    // Result
    result_title: "Recommended Course",
    result_desc: "Optimized route based on weather transitions.",
    
    // About
    about_hero_tag: "Jeonju Weather Intelligence",
    about_hero_title: "The Science of a Perfect Picnic",
    about_hero_desc: "Nadeulhae isn't just a weather app. It's a data-driven companion that analyzes environmental signals to suggest the best time for your Jeonju outing.",
    about_features_title: "What Nadeulhae Does",
    about_features_desc: "It reads live public data, filters risk signals first, and turns the current conditions into a region-aware outing decision.",
    about_built_with: "Built with Modern Stack",
    about_contributors_title: "Team Nadeulhae",
    
    // Algorithm Section
    about_algo_title: "The Picnic Index Algorithm",
    about_algo_desc: "The current picnic index first applies a knock-out filter. On normal days it then sums only air quality, temperature, sky state, and wind into a 100-point score.",
    about_algo_knockout_title: "Step 1: Knock-out Filter",
    about_algo_knockout_desc: "Weather-warning, tsunami/volcano, or earthquake data at magnitude 4.0+ forces the score to 0. Current rain, snow, or showers force it to 10. All other calculations stop there.",
    about_algo_air_title: "Air Quality: 40 points",
    about_algo_air_desc: "Uses AirKorea `khaiGrade`. Good = 40, Moderate = 30, Bad = 10, Very Bad = 0.",
    about_algo_temp_title: "Temperature: 30 points",
    about_algo_temp_desc: "Using TMP, 17~24°C earns 30 points, 12~16°C or 25~28°C earns 20, 10~11°C or 29~31°C earns 10, and the rest earns 0.",
    about_algo_sky_title: "Sky: 20 points",
    about_algo_sky_desc: "SKY clear (1) or mostly cloudy (3) earns 20 points. Overcast (4) earns 10.",
    about_algo_wind_title: "Wind: 10 points",
    about_algo_wind_desc: "WSD 0~3m/s earns 10, 4~6m/s earns 5, and 7m/s or more earns 0.",
    about_algo_data_title: "Live Data Synchronization",
    about_algo_data_desc: "The score reads KMA ultra-short nowcast/forecast and AirKorea live air APIs through regional cache layers so the UI and the explanation stay aligned.",
    about_placeholder: "Your information could be here. Updates coming soon.",
    
    // Calendar
    cal_title: "Picnic Calendar",
    cal_desc: "Read the live forecast and day-by-day scores together to pick the right outing window.",
    cal_legend: "Optimal Picnic Day",
    cal_realtime_title: "Live Forecast Calendar",
    cal_realtime_desc: "See the upcoming forecast flow and picnic scores for each day in one place.",
    cal_realtime_status: "Live Data",
    cal_realtime_note: "Live forecast data received from Korea Meteorological Administration. Updated hourly.",
    
    // Briefing
    brief_title: "Today's Picnic Briefing",
    brief_temp_perfect: "The current temperature is {temp}°C, perfect for an outing.",
    brief_temp_v_cold: "It's extremely cold at {temp}°C! Thick coats and winter gear are essential.",
    brief_temp_cold: "It's {temp}°C, which is quite chilly. Bring a warm jacket.",
    brief_temp_mild: "It's {temp}°C, a bit cool. A light jacket will be perfect.",
    brief_temp_warm: "It's {temp}°C, feeling like a beautiful spring day. Great for outdoors.",
    brief_temp_hot: "It's {temp}°C, so it's quite hot. Prepare cold drinks.",
    brief_temp_v_hot: "It's {temp}°C, extremely hot! Avoid long outdoor activities and stay hydrated.",
    
    brief_dust_excel: "The dust level is {dust}, meaning the air in Jeonju is exceptionally clear today.",
    brief_dust_good: "The dust level is {dust}, giving us fresh and clean air for an outing.",
    brief_dust_mod: "The dust level is {dust}, which is moderate. Sensitive individuals should check updates.",
    brief_dust_bad: "Dust levels are high at {dust}. Please wear a mask outdoors.",
    
    brief_wind_calm: "The wind is calm at {wind}m/s, creating a peaceful atmosphere.",
    brief_wind_breezy: "A pleasant breeze at {wind}m/s is blowing today.",
    brief_wind_strong: "Winds are strong at {wind}m/s. Watch out for flying debris.",
    
    brief_humi_dry: "The humidity is {humi}%, very dry. Be careful of fire and stay hydrated.",
    brief_humi_comfort: "The humidity is {humi}%, which is very comfortable and refreshing.",
    brief_humi_humid: "It's {humi}% humid, feeling a bit sticky. Expect a higher discomfort index.",
    
    brief_pty_rain: "It is currently raining. We recommend an umbrella or an indoor course.",
    brief_pty_snow: "It is currently snowing. Watch out for slippery roads and enjoy the view.",

    // Status Tiers
    status_excellent: "Excellent",
    status_good: "Good",
    status_fair: "Fair",
    status_poor: "Poor",
    
    msg_excellent: [
      "It's a perfect day for a picnic in Jeonju!",
      "Conditions are absolutely perfect for an outing today!",
      "Top-tier weather detected! Time to head to Deokjin Park.",
      "The air is so fresh in Jeonju today, perfect for Sebyeong-ho!",
      "Simply walking around Jeonju today will heal your soul."
    ],
    msg_good: [
      "The weather is great for an outing today.",
      "A lovely afternoon in Jeonju with pleasant sunshine.",
      "Perfect weather for a refreshing light walk.",
      "Pleasant weather with a perfect mix of sun and breeze.",
      "Air quality is very reliable today. Outdoor activities recommended."
    ],
    msg_fair: [
      "It's a decent day for a short walk.",
      "Not the best, but a quick stroll nearby is okay.",
      "The weather isn't too bad for a bit of fresh air.",
      "Not perfect, but it's a decent day for a light stroll.",
      "How about mixing indoor and outdoor spots to enjoy Jeonju?"
    ],
    msg_poor: [
      "Better stay indoors and avoid outdoor activities today.",
      "Atmospheric conditions are unstable. Stay indoors if possible.",
      "Current weather is unsuitable for outdoor planning.",
      "How about visiting a pretty cafe or museum instead of outdoors?",
      "Sadly, the weather isn't helping today. Find comfort indoors."
    ],
    msg_home_excellent: [
      "Jeonju is in great shape today for a long riverside walk or a relaxed picnic stop.",
      "The flow of air, temperature, and sky over Jeonju is especially balanced right now.",
      "It is the kind of Jeonju weather that rewards slow walks and longer outdoor stays.",
      "Deokjin Park and the nearby lakeside areas should feel especially pleasant today.",
      "Today is one of those Jeonju days when staying outside a little longer just feels right."
    ],
    msg_home_good: [
      "Jeonju looks steady enough for a comfortable outdoor half-day.",
      "The weather in Jeonju is calm enough for a light outing without much adjustment.",
      "Sun, air quality, and temperature are aligned well for a simple Jeonju walk.",
      "Today fits a relaxed outdoor schedule around Jeonju better than an indoor-only plan.",
      "For Jeonju, this is a reliable day to keep most of your plans outside."
    ],
    msg_home_fair: [
      "Jeonju is usable today, but shorter outdoor stops will feel better than a long route.",
      "Conditions in Jeonju are decent, though mixing indoor and outdoor stops would be smarter.",
      "It is not a perfect Jeonju weather day, but a flexible itinerary should still work well.",
      "A lighter outdoor plan around Jeonju makes more sense than a full-day picnic today.",
      "Jeonju feels manageable today as long as the route stays adaptable."
    ],
    msg_home_poor: [
      "Jeonju is better suited for indoor plans today than long outdoor stays.",
      "Weather risk is elevated in Jeonju right now, so shorter and safer routes are better.",
      "Today is one of those Jeonju days when indoor cafes and galleries make more sense.",
      "Outdoor comfort in Jeonju is limited today, so keep plans conservative.",
      "Jeonju is not offering a stable outdoor window right now, so adjust the route carefully."
    ],
    msg_away_excellent: [
      "Your current area looks stable enough for a long outdoor plan.",
      "Based on your location, this is a strong day for walking, parks, and open-air stops.",
      "Conditions near you are calm and clean enough for an easy outdoor schedule.",
      "The weather around your current region is unusually cooperative today.",
      "Where you are now, it looks like a very good time to stay outside longer."
    ],
    msg_away_good: [
      "Your current region looks good for a light outdoor outing.",
      "Conditions near you are stable enough for a half-day outside.",
      "The current area supports an easy outdoor plan without much weather risk.",
      "This location looks reliable for a simple walk or a short picnic stop.",
      "The weather around you is good enough to keep most of the plan outdoors."
    ],
    msg_away_fair: [
      "Your current area is workable, but a shorter route would be safer than a long one.",
      "Conditions near you are average today, so keep the plan flexible.",
      "A quick outdoor stop should be fine, though indoor backups are worth keeping nearby.",
      "The region around you is not bad, but not stable enough for a long outdoor stretch.",
      "Your current weather is manageable if the route stays light and adjustable."
    ],
    msg_away_poor: [
      "Your current region is better suited for indoor alternatives right now.",
      "Weather risk near you is high enough that outdoor plans should be reduced.",
      "This location does not currently support a comfortable long outdoor stay.",
      "The safest move near your current area is to shift toward indoor stops.",
      "Conditions around you are unstable enough to make outdoor plans less practical today."
    ],
    
    // Knock-out Event Alert Messages
    alert_earthquake_title: "🚨 Tsunami/Earthquake Warning",
    alert_earthquake_desc: "Due to an earthquake in nearby waters, outdoor activities are strictly prohibited.",
    alert_weather_wrn_title: "🚨 Severe Weather Warning",
    alert_weather_wrn_desc: "A severe weather warning is active in the queried region. Please stay indoors for your safety.",
    alert_heavy_rain_title: "☔ Heavy Rain or Snow Currently",
    alert_heavy_rain_desc: "Picnic index has plummeted due to worsening conditions. We recommend switching to indoor plans.",
    
    // Fallback Location
    fallback_message: "We temporarily cannot fetch the atmospheric info for your location, so we're showing the weather for 'Jeonju', the hometown of Nadeulhae! 🏡",

    // Detailed Data Descriptions
    about_data_title: "Detailed Data Guide",
    about_data_desc: "Understand the meaning and impact of the 10+ environmental metrics we track.",
    
    about_item_temp: "Temperature",
    about_item_temp_desc: "Optimal between 18-24°C. Below 10°C is cold, while above 30°C requires caution for heat.",
    
    about_item_humi: "Humidity",
    about_item_humi_desc: "40-60% is most comfortable. Over 70% can feel sticky and increase the discomfort index.",
    
    about_item_wind: "Wind Speed",
    about_item_wind_desc: "Winds below 4m/s are pleasant. Above 8m/s can be difficult for outdoor settings.",
    
    about_item_vec: "Wind Direction",
    about_item_vec_desc: "The direction the wind originates from. North winds are cold, West winds often bring dust.",
    
    about_item_pm10: "PM10 (Dust)",
    about_item_pm10_desc: "Particles below 10µg. <30µg/m³ is excellent. >80µg/m³ requires a mask.",
    
    about_item_pm25: "PM2.5 (Fine Dust)",
    about_item_pm25_desc: "Micro-particles. <15µg/m³ is safe. >35µg/m³ is unhealthy for sensitive individuals.",
    
    about_item_o3: "Ozone",
    about_item_o3_desc: "Generated by intense sunlight. Safe below 0.03ppm. High levels can irritate eyes and throat.",
    
    about_item_no2: "Nitrogen Dioxide",
    about_item_no2_desc: "Primarily from vehicle exhaust. <0.03ppm is clean; it's a key urban air quality indicator.",
    
    about_item_khai: "CAI (Integrated Index)",
    about_item_khai_desc: "Comprehensive air quality index. 0-50 is Excellent, while >100 can be harmful.",
    
    about_item_precip: "Precipitation",
    about_item_precip_desc: "Amount of rain or snow. 0mm is perfect; any amount significantly lowers the picnic score.",

    // Features
    about_feature_1_name: "Live Outing Judgment",
    about_feature_1_desc: "Instead of just listing weather values, the service scores air quality, temperature, sky state, and wind so users can quickly judge whether going outside makes sense now.",
    about_feature_2_name: "Risk Signals First",
    about_feature_2_desc: "Weather warnings, official bulletins, earthquake notices, and active precipitation are checked together, and only real risk conditions trigger strong alert UI.",
    about_feature_3_name: "Region-Aware Station Mapping",
    about_feature_3_desc: "Nearby air stations and forecast zones change with the user's location so the same service can still show locally relevant air and bulletin context.",
    about_feature_4_name: "Quota-Safe Request Design",
    about_feature_4_desc: "Weather, air, and alert data are grouped behind regional caches so repeated refreshes do not explode public API usage.",
    about_feature_cta: "See Implementation",
    about_data_driven: "Built on Public Data",
    about_live_title: "Live Data Pipeline",
    about_live_desc: "The service does not dump public API payloads directly. It reshapes them through region detection, conditional alert logic, and cache policy before rendering.",
    about_live_card_1_title: "Regional Station Mapping",
    about_live_card_1_desc: "Seoul uses Seoul-side stations, while Jeonju prefers Jeonbuk coverage and nearby Jeonju stations to keep the air-quality context local.",
    about_live_card_2_title: "Conditional Hazard UI",
    about_live_card_2_desc: "Rain, warnings, and earthquake notices only trigger alert UI when a real event is present. Normal days stay visually calm.",
    about_live_card_3_title: "Jeonju-First Experience",
    about_live_card_3_desc: "If location permission is denied or atmospheric data is temporarily unreliable, the interface falls back to Jeonju and clearly tells the user why.",
    about_structure_title: "Service Structure",
    about_structure_desc: "Home, Calendar, and Jeonju pages now have distinct roles so the UI stays simpler while each page can go deeper where it matters.",
    about_structure_home_title: "Home",
    about_structure_home_desc: "A region-agnostic entry view that immediately shows picnic score, official bulletin, nearby station, and briefing for the current location.",
    about_structure_calendar_title: "Calendar",
    about_structure_calendar_desc: "A dedicated screen for the 10-day forecast flow and day-by-day scoring. The region-aware forecast calendar now lives only there.",
    about_structure_jeonju_title: "Jeonju Special",
    about_structure_jeonju_desc: "A separate space for Jeonju-specific context, local guidance, and the roadmap for future place-DB and course features.",
    about_structure_future_title: "Opening Later",
    about_structure_future_desc: "Historical statistics, cafe and restaurant DB, outdoor spots, and AI half-day courses will open step by step after backend and DB integration.",

    // Technical Labels & Briefing UI
    brief_station_engine: "Situational Analysis Engine",
    brief_observation_grid: "Environment Observation Grid",
    brief_nrs_protocol: "NRS V1.0 - Real-time Protocol",
    brief_kma_sync: "KMA Sync",
    brief_air_sync: "Air Poll",
    brief_data_source: "Data Source",
    brief_ai_db_archive: "AI Engine / DB Archive",
    
    // Status & Levels
    level_excel: "Excellent",
    level_good: "Good",
    level_mod: "Moderate",
    level_bad: "Bad",
    level_v_bad: "Very Bad",
    
    uv_low: "Low",
    uv_mod: "Moderate",
    uv_high: "High",
    uv_v_high: "Very High",
    uv_extreme: "Extreme",
    
    // Meta & Sources
    interval_45m: "Hourly at 45m",
    interval_0m: "Hourly at 0m",
    data_source_kma: "KMA",
    data_source_air: "AirKorea",
    data_source_combined: "KMA, AirKorea",
    label_domestic: "Domestic",
    label_who: "WHO",

    // Insights & Trends
    insight_1_title: "Optimal Picnic Day",
    insight_1_desc: "Based on 3-year stats, the most pleasant day this month is 'Saturday'.",
    insight_1_cta: "View Stats Calendar",
    insight_2_title: "Climate Energy",
    insight_2_desc: "Jeonju's weather energy is 92% today, highly positive for outdoor activities.",
    insight_2_cta: "Energy Report",
    insight_3_title: "Real-time Crowd",
    insight_3_desc: "Deokjin Park area is currently 'Relaxed', easy to find a good spot.",
    insight_3_cta: "Booking Inquiry",
    
    trend_header: "Popular spots in Jeonju",
    trend_title: "{spot}",
    
    course_1_title: "Warm Outdoor Time - Deokjin Park",
    course_1_desc: "The sun is warmest and the air is clear. We recommend a picnic with a mat at Deokjin Park!",
    course_2_title: "Shelter from Wind - Cafe Time",
    course_2_desc: "Cool breezes may lower the perceived temperature in the late afternoon. Enjoy some tea at a cozy cafe.",

    // Metric Guide Title
    guide_title: "Environmental Data Guide",
    guide_desc: "Nadeulhae calculates picnic scores by analyzing 10+ precision data points collected through real-time open APIs from the KMA and AirKorea. Here's a guide to each metric.",

    // Metrics
    guide_temp_t: "Temperature",
    guide_temp_d: "Current atmospheric temperature near the surface. 18°C~24°C is best for outdoor activities; caution is needed above 30°C or below 5°C.",
    guide_humi_t: "Humidity",
    guide_humi_d: "The ratio of water vapor in the air. 40%~60% is ideal; values above 70% increase discomfort and slow perspiration evaporation.",
    guide_wind_t: "Wind Speed",
    guide_wind_d: "The velocity of air movement. 1.5m/s~3.5m/s is perfect for a cool breeze, but above 5m/s might flip mats or disperse belongings.",
    guide_vec_t: "Wind Direction",
    guide_vec_d: "The direction from which the wind blows. Due to Jeonju's geography, northwesterly winds often feel cooler than the actual temperature.",
    guide_pm10_t: "PM10 (Dust)",
    guide_pm10_d: "Pollutants below 10µg in diameter. Below 30µg/m³ is 'Good'; above 80µg/m³ is 'Bad', meaning long outdoor exposures should be limited.",
    guide_pm25_t: "PM2.5 (Fine Dust)",
    guide_pm25_d: "High-risk particles below 2.5µg that can reach the deep lungs. Below 15µg/m³ is ideal; masks are essential above 35µg/m³.",
    guide_o3_t: "Ozone",
    guide_o3_d: "High ozone levels can irritate eyes and lungs. Levels peak on sunny summer afternoons; alerts are issued above 0.09ppm.",
    guide_no2_t: "Nitrogen Dioxide",
    guide_no2_d: "Mainly emitted from vehicle exhausts and can cause bronchial inflammation. Below 0.03ppm is considered pleasant.",
    guide_khai_t: "CAI (Air Quality Index)",
    guide_khai_d: "An integrated value of pollutants like PM2.5 and Ozone. 0-50 is 'Good'; 100+ is 'Bad' for outdoor activities.",
    guide_rn1_t: "Precipitation",
    guide_rn1_d: "The amount of rain over the last hour. Any rain detection (above 0.1mm) significantly drops the overall picnic score.",

    // Contributors & Status
    about_status_pending: "Backend Sync Pending",
    about_contributors_desc: "A database team project created by three juniors (Class of '24) from Jeonbuk National University, Software Engineering. All members actively participated in core DB design and construction.",
    
    con_hm_name: "Hyeonmin Kim",
    con_hm_role: "JNU Software Engineering ('24)",
    con_hm_desc: "Handled the overall service structure and designed the core database foundation for storing weather data efficiently.",
    
    con_es_name: "Eunsu Kim",
    con_es_role: "JNU Software Engineering ('24)",
    con_es_desc: "Collected public API and location data and organized them into our database one by one.",
    
    con_jh_name: "Jaehyeok Lee",
    con_jh_role: "JNU Software Engineering ('24)",
    con_jh_desc: "Created the pipeline that connects real-time weather data variations to our database.",

    con_university: "JBNU",
    con_department: "Software Engineering '24",

    about_philosophy_title: "The Minds Behind Nadeulhae",
    about_philosophy_desc: "Three Software Engineering juniors ('24) from JNU planned and developed this together. We focused on the basics of databases—how data flows and is stored—rather than just UI flashy features.",

    // Statistics Page Extra
    cal_archive_title: "Picnic Archive",
    cal_archive_desc: "Check high-score picnic day patterns in a monthly calendar view.",
    cal_insight_title: "Insight",
    cal_insight_text: "In Jeonju, the 2nd and 3rd weekends of May have traditionally recorded the most pleasant picnic index.",
    cal_origin_title: "Data Origin",
    cal_origin_desc: "Dates with the sparkle icon indicate recommended days with picnic score 80+.",
  }
}


const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("ko")

  useEffect(() => {
    const savedLanguage = typeof window !== "undefined"
      ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
      : null

    if (savedLanguage === "ko" || savedLanguage === "en") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLanguage(savedLanguage)
      return
    }

    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ko'
    const targetLang = browserLang === 'ko' ? 'ko' : 'en'

    setLanguage(targetLang)
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    }

    if (typeof document !== "undefined") {
      document.documentElement.lang = language
    }
  }, [language])

  const getSeedValue = (seed?: string | number) => {
    if (typeof seed === "number") return seed
    if (typeof seed === "string") {
      return Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0)
    }
    return null
  }

  const t = (key: string, seed?: string | number) => {
    const val = translations[language][key]
    if (Array.isArray(val)) {
      const hourSeed = new Date().getHours()
      const keySeed = Array.from(key).reduce((sum, char) => sum + char.charCodeAt(0), 0)
      const customSeed = getSeedValue(seed)
      const finalSeed = customSeed ?? hourSeed
      return val[(finalSeed + keySeed) % val.length]
    }
    return val || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
