"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

type Language = "ko" | "en" | "zh" | "ja"
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
    footer_terms: "이용약관 및 개인정보 처리방침",
    footer_about: "나들해 소개",
    
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
     con_hm_desc: "프론트엔드, 백엔드, UI/UX 디자인, 서버 구축, DB 설계, 실시간 API 연동을 담당했습니다.",
    
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
     loading_locating: "Locating...",
     footer_copy: "© 2026 Nadeulhae. All rights reserved.",
    footer_notice: "If location access is allowed, it is used only for regional weather decisions, and the interface is built from public datasets such as KMA and AirKorea.",
    footer_terms: "Terms of Service & Privacy Policy",
    footer_about: "About Nadeulhae",

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
     con_hm_desc: "Handled frontend, backend, UI/UX design, server setup, DB design, and real-time API integration.",
    
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
  },

  zh: {
    // Navbar
    nav_home: "首页",
    nav_jeonju: "全州+",
    nav_about: "介绍",
    nav_stats: "统计日历",
    nav_calendar: "日历",
    nav_lab: "实验室",
    nav_login: "登录",
    nav_login_status: "连接准备中",
    nav_login_unsupported: "暂不支持",
    logo_text: "Nadeulhae",
    login_back_home: "返回首页",
    login_back_login: "返回登录",
    login_badge: "准备中",
    login_title: "登录",
    login_subtitle: "账户功能将在后端连接完成后开放。",
    login_email: "邮箱",
    login_password: "密码",
    login_email_placeholder: "name@example.com",
    login_password_placeholder: "••••••••",
    login_forgot: "忘记密码？",
    login_cta_pending: "登录准备中",
    login_no_account: "还没有账户？",
    login_go_signup: "注册",
    signup_title: "一起开始吧？",
    signup_subtitle: "注册功能将与登录功能一起逐步开放。",
    signup_name: "姓名",
    signup_name_placeholder: "请输入姓名",
    signup_password_placeholder: "至少8个字符",
    signup_terms: "注册即表示您同意나들해的服务条款和隐私政策。",
    signup_cta_pending: "注册准备中",
    signup_has_account: "已有账户？",
    signup_go_login: "登录",

    // UI General
    loading_weather: "正在加载天气信息...",
    loading_locating: "正在获取位置...",
    footer_copy: "© 2026 Nadeulhae. All rights reserved.",
    footer_notice: "如允许位置权限，仅用于判断当前区域天气，页面数据基于气象厅、韩国环境公团等公共数据构建。",
    footer_terms: "服务条款与隐私政策",
    footer_about: "关于나들해",

    // Hero
    hero_title: "今天全州是野餐的完美天气！",
    hero_score_label: "当前",
    hero_score_subtitle: "野餐指数",
    hero_best_day: "最佳出游天气！",
    hero_unit: "分",
    hero_temp: "气温",
    hero_humidity: "湿度",
    hero_wind: "风速",
    hero_dust: "微尘",
    hero_pm10: "微尘(PM10)",
    hero_pm25: "超微尘(PM2.5)",
    hero_o3: "臭氧",
    hero_no2: "二氧化氮",
    hero_co: "一氧化碳",
    hero_so2: "二氧化硫",
    hero_khai: "综合空气指数",
    hero_vec: "风向",
    hero_precip: "降水量",
    hero_uv: "紫外线",

    status_coming_soon: "等待后端连接",
    status_nearby_station: "邻近监测站",
    station_dukjin: "德津洞",

    // Statistics
    stats_title: "通过数据看全州",
    stats_desc: "基于数据库中多年气象数据的分析结果。",

    // AI Action
    ai_title: "为您设计今日行程",
    ai_desc: "选择时间段和区域，AI将推荐针对实时天气优化的半日路线。",
    ai_time_label: "活动时间",
    ai_time_val: "13:00 ~ 18:00 (下午)",
    ai_loc_label: "推荐区域",
    ai_loc_val: "全州 德津区 (细碧湖附近)",
    ai_loc_current: "使用当前位置",
    ai_loc_mock: "全州市 完山区 (我的位置)",
    ai_button: "生成AI路线",
    ai_loading: "正在分析全州天气数据...",
    ai_processing_label: "LLM & 天气数据库分析中",
    ai_loading_detail: "正在分析气象切变现象...",

    // Result
    result_title: "推荐半日路线",
    result_desc: "根据天气变化优化的行程路线。",

    // About
    about_hero_tag: "Our Vision",
    about_hero_title: "连接全州的每一个瞬间与天气",
    about_hero_desc: "나들해不仅仅是天气信息，它旨在让您宝贵的全州之旅在天气的流动中绽放最美的光彩。",
    about_features_title: "나들해的功能",
    about_features_desc: "读取实时公共数据，优先过滤风险信号，然后按区域标准快速判断当前是否适合出游。",
    about_built_with: "Built with Modern Stack",
    about_contributors_title: "创建者",

    // Algorithm Section
    about_algo_title: "出游指数算法",
    about_algo_desc: "当前出游指数首先排除风险因素，平时则仅综合空气质量、气温、天空、风力四个维度，满分100分。",
    about_algo_knockout_title: "第一阶段：即时淘汰过滤",
    about_algo_knockout_desc: "如检测到气象特报、海啸、火山或4.0级以上地震，立即判为0分；如当前下雨、下雪或阵雨，则固定为10分。在此情况下，其他计算将被跳过。",
    about_algo_air_title: "空气质量 40分",
    about_algo_air_desc: "使用AirKorea的khaiGrade。良好40分，一般30分，差10分，非常差0分。",
    about_algo_temp_title: "气温 30分",
    about_algo_temp_desc: "基于TMP标准，17~24°C为30分，12~16°C或25~28°C为20分，10~11°C或29~31°C为10分，其余为0分。",
    about_algo_sky_title: "天空 20分",
    about_algo_sky_desc: "SKY为晴天(1)或多云(3)则为20分，阴天(4)为10分。",
    about_algo_wind_title: "风力 10分",
    about_algo_wind_desc: "WSD为0~3m/s则为10分，4~6m/s为5分，7m/s以上为0分。",
    about_algo_data_title: "实时数据同步",
    about_algo_data_desc: "通过区域缓存读取气象厅超短期实时观测/预报和AirKorea实时空气质量API，确保界面显示与说明遵循相同规则。",
    about_placeholder: "此处将在后续更新中补充相关信息。",

    // Calendar
    cal_title: "野餐日历",
    cal_desc: "同时查看实时预报和每日评分，挑选出游时机。",
    cal_legend: "野餐最佳日",
    cal_realtime_title: "实时预报日历",
    cal_realtime_desc: "在一个页面中查看未来预报趋势和每日野餐评分。",
    cal_realtime_status: "实时数据",
    cal_realtime_note: "来自气象厅实时接收的预报数据。每小时更新一次。",

    // Briefing
    brief_title: "今日出游简报",
    brief_temp_perfect: "当前气温{temp}°C，正是出游的理想温度。",
    brief_temp_v_cold: "当前{temp}°C，非常寒冷！厚外套和防寒用品必不可少。",
    brief_temp_cold: "当前{temp}°C，气温较低，请带上保暖外套。",
    brief_temp_mild: "当前{temp}°C，天气凉爽。穿一件轻便外套刚好合适。",
    brief_temp_warm: "当前{temp}°C，春意盎然。非常适合户外活动。",
    brief_temp_hot: "当前{temp}°C，稍显炎热。请准备冷饮。",
    brief_temp_v_hot: "当前{temp}°C，非常炎热！请避免长时间户外活动，注意补充水分。",

    brief_dust_excel: "微尘浓度{dust}极低，全州的空气非常清新洁净。",
    brief_dust_good: "微尘浓度{dust}处于洁净水平，适合享受清爽的出游。",
    brief_dust_mod: "微尘浓度{dust}为一般水平。敏感人群请留意空气信息。",
    brief_dust_bad: "微尘浓度{dust}达到差等级。户外活动请务必佩戴口罩。",

    brief_wind_calm: "风速{wind}m/s，几乎无风，氛围宁静。",
    brief_wind_breezy: "风速{wind}m/s，微风徐徐，令人心旷神怡。",
    brief_wind_strong: "当前风速{wind}m/s，风力强劲，物品可能被吹动。",

    brief_humi_dry: "湿度{humi}%，非常干燥。请注意防火和补充水分。",
    brief_humi_comfort: "湿度{humi}%，体感舒适，清爽宜人。",
    brief_humi_humid: "湿度{humi}%，略显潮湿。不适指数可能较高，请留意。",

    brief_pty_rain: "当前正在下雨。建议携带雨伞或选择室内路线。",
    brief_pty_snow: "当前正在下雪。请注意路面结冰，同时享受雪景吧。",

    // Status Tiers
    status_excellent: "最佳天气",
    status_good: "好天气",
    status_fair: "一般",
    status_poor: "差天气",

    msg_excellent: [
      "今天全州是野餐的完美日子！",
      "今天全州出游的条件再好不过了！",
      "气象条件极佳。现在就去细碧湖吧！",
      "今天是享受细碧湖清新空气的最佳日子！",
      "像今天这样的日子，在全州随便走走都能治愈心灵。"
    ],
    msg_good: [
      "散步出游的好天气。",
      "阳光舒适地照耀着全州的午后。",
      "正是轻松散步转换心情的好天气。",
      "阳光和微风恰到好处，是愉快的出游天气。",
      "今天全州的空气质量很好。推荐户外活动。"
    ],
    msg_fair: [
      "还算适合出游的天气。",
      "虽然有些不完美，但附近公园散步还是可以的。",
      "天气不算太差，出门呼吸一下户外空气吧。",
      "虽不完美，但轻松散步还是不错的选择。",
      "不如混合室内外路线来享受全州如何？"
    ],
    msg_poor: [
      "今天最好避免户外活动。",
      "天气不稳定。建议尽量选择室内活动。",
      "当前气象条件不适合户外活动。",
      "不如去全州漂亮的咖啡馆或博物馆看看？",
      "可惜今天天气不太配合。在室内寻找悠闲时光吧。"
    ],
    msg_home_excellent: [
      "今天全州从河边散步到细碧湖出游都适合尽情享受。",
      "全州的天空和空气流动都很稳定。可以放心安排户外行程。",
      "正是享受全州特有悠闲散步路线的绝佳状态。",
      "德津公园和全州川周边会感觉特别舒适。",
      "今天是全州适合长时间散步和停留的均衡出游日。"
    ],
    msg_home_good: [
      "以全州标准来看天气相当稳定，适合轻松的出游。",
      "没有大的变数，适合安排全州户外路线的一天。",
      "阳光和空气质量都不错，适合全州小巷散步或公园行程。",
      "全州适合安排半天左右的户外行程。",
      "今天全州以户外行程为主也不会太有负担。"
    ],
    msg_home_fair: [
      "全州今天虽不完美，但短途散步还是完全可行的。",
      "气象条件略有不足，全州更适合室内外混合的行程。",
      "相比长时间户外，短途移动的路线更合适。",
      "以全州标准来看还算可以，但最好选好时间段出行。",
      "看情况灵活调整路线，足以享受这一天。"
    ],
    msg_home_poor: [
      "今天全州优先选择室内路线更为安全。",
      "全州地区气象状况不佳，户外行程尽量短一些比较好。",
      "天气变数较大，全州更适合以咖啡馆或室内空间为中心的路线。",
      "今天比起勉强出游，在室内悠闲度过更好。",
      "全州天空状态不稳定，行程安排比平时更保守一些为好。"
    ],
    msg_away_excellent: [
      "您所在区域天气稳定，适合安排长时间户外活动。",
      "以当前位置来看，非常适合散步或公园行程的天气。",
      "今天其他地区也能享受不亚于全州的舒适户外行程。",
      "当前位置的空气和气温状况良好，适合规划长距离户外路线。",
      "您现在所在的地方天气晴朗稳定，适合长时间待在户外。"
    ],
    msg_away_good: [
      "以当前位置来看，是能够轻松安排户外行程的天气。",
      "您所在区域适合轻松散步或短途出游。",
      "没有大的风险信号，适合享受户外活动。",
      "当前区域适合半天左右的户外行程。",
      "当前位置适合轻松享受公园或散步路线。"
    ],
    msg_away_fair: [
      "您所在区域短途外出还好，但长时间停留的行程需谨慎。",
      "当前位置天气一般，灵活安排路线比较好。",
      "轻松散步还可以，但最好同时准备室内备选方案。",
      "当前区域需要注意突发变化，适合短途路线。",
      "室内外混合安排的话，在当前位置也足够享受一天。"
    ],
    msg_away_poor: [
      "您所在区域优先选择室内替代方案比较好。",
      "当前位置气象状况不稳定，不建议过度户外安排。",
      "减少户外停留时间，以室内为中心活动更安全。",
      "当前位置户外条件不佳，需要调整行程。",
      "当前区域存在天气风险，短途移动和室内计划更合适。"
    ],

    // Knock-out Event Alert Messages
    alert_earthquake_title: "🚨 海啸/地震警报生效中",
    alert_earthquake_desc: "由于附近海域发生地震，严禁一切户外活动。",
    alert_weather_wrn_title: "🚨 气象特报警报生效中",
    alert_weather_wrn_desc: "当前查询区域已发布气象特报。为了安全，请避免外出。",
    alert_heavy_rain_title: "☔ 当前正在下大雨/雪",
    alert_heavy_rain_desc: "天气条件恶化，野餐指数大幅下降。请将行程改为室内活动。",

    // Fallback Location
    fallback_message: "暂时无法获取您所在区域的大气信息，因此显示나들해的故乡「全州」的天气！🏡",

    // Detailed Data Descriptions
    about_data_title: "数据项目详细说明",
    about_data_desc: "对나들해提供的10种以上精密气象数据进行通俗易懂的说明。",

    about_item_temp: "气温 (Temperature)",
    about_item_temp_desc: "指空气的温度，18~24°C最适合出游。低于10°C偏冷，高于30°C需注意暑热。",

    about_item_humi: "湿度 (Humidity)",
    about_item_humi_desc: "空气中水蒸气的含量，40~60%最为舒适。超过70%会感觉潮湿，不适指数可能升高。",

    about_item_wind: "风速 (Wind Speed)",
    about_item_wind_desc: "风的强度，4m/s以下为舒适的微风。8m/s以上物品可能被吹走，需注意。",

    about_item_vec: "风向 (Wind Direction)",
    about_item_vec_desc: "风吹来的方向。北风主要带来冷空气，西风可能伴随内陆尘埃。",

    about_item_pm10: "微尘 (PM10)",
    about_item_pm10_desc: "直径10µg以下的尘埃，30µg/m³以下为非常好。超过80µg/m³建议佩戴口罩。",

    about_item_pm25: "超微尘 (PM2.5)",
    about_item_pm25_desc: "比头发丝细20~30倍的微细尘埃。15µg/m³以下安全，超过35µg/m³需注意。",

    about_item_o3: "臭氧 (Ozone)",
    about_item_o3_desc: "由强阳光产生，0.03ppm以下安全。浓度高时可能刺激眼睛和呼吸道。",

    about_item_no2: "二氧化氮 (NO2)",
    about_item_no2_desc: "主要来自汽车尾气。0.03ppm以下为洁净，是城市空气质量的主要指标之一。",

    about_item_khai: "综合空气指数 (KHAI)",
    about_item_khai_desc: "综合多种污染物的空气质量指数。0~50为最佳(Excellent)，超过100可能对健康有害。",

    about_item_precip: "降水量 (Precipitation)",
    about_item_precip_desc: "雨或雪的量。出游0mm最完美，即使有少量降水，指数也会急剧下降。",

    // Features
    about_feature_1_name: "实时出游判断",
    about_feature_1_desc: "不仅简单显示当前天气，还将空气质量、气温、天空、风力进行评分，让您快速判断现在是否适合出门。",
    about_feature_2_name: "优先感知风险信号",
    about_feature_2_desc: "同时检查气象特报、官方通报、地震、降水情况，只有真正存在危险时才强烈显示警告画面和文字。",
    about_feature_3_name: "区域定制监测站连接",
    about_feature_3_desc: "根据用户位置连接不同的邻近监测站和预报区域，即使是同一服务，也能显示适合当地的空气质量和通报。",
    about_feature_4_name: "节省调用次数的架构",
    about_feature_4_desc: "将气象、空气质量、特报数据按区域缓存，即使重复刷新也不会过度增加公共API调用。",
    about_feature_cta: "查看实现内容",
    about_data_driven: "基于公共数据",
    about_live_title: "实时数据管道",
    about_live_desc: "当前服务不直接展示公共API数据，而是经过区域判别和缓存策略，重新构造成适合屏幕显示的形式。",
    about_live_card_1_title: "区域监测站映射",
    about_live_card_1_desc: "首尔连接首尔监测站，全州优先连接全北区域和全州附近监测站，显示符合实际位置的空气质量。",
    about_live_card_2_title: "条件性风险展示",
    about_live_card_2_desc: "只有实际检测到降雨、特报、地震数据时才显示警告UI，平时保持平静的普通界面。",
    about_live_card_3_title: "全州优先体验",
    about_live_card_3_desc: "当无位置权限或空气质量响应异常时，以全州为基础安全替代，并明确告知用户原因。",
    about_structure_title: "服务架构",
    about_structure_desc: "将首页、日历、全州特色页面的角色分离，保持界面简洁的同时更准确地呈现必要信息。",
    about_structure_home_title: "首页",
    about_structure_home_desc: "无论从哪个地区访问，都能即时查看当前位置的野餐指数、官方通报、邻近监测站、简报的通用入口页面。",
    about_structure_calendar_title: "日历",
    about_structure_calendar_desc: "专注展示10日预报趋势和每日评分的专用页面。区域预报日历仅在此页面提供。",
    about_structure_jeonju_title: "全州特色",
    about_structure_jeonju_desc: "汇集全州本地特色、专用指南、未来地点数据库和路线功能路线图的独立空间。",
    about_structure_future_title: "后续开放",
    about_structure_future_desc: "历史统计、餐饮店·咖啡馆·户外地点数据库、AI半日路线将在后端和数据库连接后逐步开放。",

    // Technical Labels & Briefing UI
    brief_station_engine: "情景分析引擎",
    brief_observation_grid: "环境观测网格",
    brief_nrs_protocol: "NRS V1.0 - 实时协议",
    brief_kma_sync: "气象厅同步",
    brief_air_sync: "空气质量同步",
    brief_data_source: "数据来源",
    brief_ai_db_archive: "AI引擎 / 数据库归档",

    // Status & Levels
    level_excel: "非常好",
    level_good: "好",
    level_mod: "一般",
    level_bad: "差",
    level_v_bad: "非常差",

    uv_low: "低",
    uv_mod: "中等",
    uv_high: "高",
    uv_v_high: "非常高",
    uv_extreme: "极高",

    // Meta & Sources
    interval_45m: "每小时45分",
    interval_0m: "每小时整点",
    data_source_kma: "气象厅",
    data_source_air: "韩国环境公团",
    data_source_combined: "气象厅, 韩国环境公团",
    label_domestic: "国内",
    label_who: "WHO",

    // Insights & Trends
    insight_1_title: "最佳出游日",
    insight_1_desc: "根据过去3年统计分析，本月最舒适的野餐日是「星期六」。",
    insight_1_cta: "查看统计日历",
    insight_2_title: "气候能量",
    insight_2_desc: "今天全州的气象能量为92%，对外部活动非常积极。",
    insight_2_cta: "能量报告",
    insight_3_title: "实时拥挤度",
    insight_3_desc: "德津公园附近目前「悠闲」，可以轻松找到好位置。",
    insight_3_cta: "场所预约咨询",

    trend_header: "当前全州市民常去的热门地点",
    trend_title: "{spot}",

    course_1_title: "温暖户外时光 - 德津公园",
    course_1_desc: "这是阳光最温暖、微尘最低的时段。推荐在德津公园铺上垫子享受野餐！",
    course_2_title: "避风时光 - 咖啡馆休整",
    course_2_desc: "傍晚开始刮冷风，体感温度可能下降。移步咖啡馆享受悠闲时光吧。",

    // Metric Guide Title
    guide_title: "详细气象与空气质量数据指南",
    guide_desc: "나들해通过气象厅和韩国环境公团的实时开放API收集的10余种精密数据，分析计算野餐最佳度。各指标的含义和标准如下。",

    // Metrics
    guide_temp_t: "气温",
    guide_temp_d: "当前地表附近的大气温度。18°C~24°C最适合户外活动，30°C以上或5°C以下需注意。",
    guide_humi_t: "湿度",
    guide_humi_d: "空气中水蒸气的比例。40%~60%最舒适，70%以上不适指数升高，汗液蒸发变慢。",
    guide_wind_t: "风速",
    guide_wind_d: "空气的移动速度。1.5m/s~3.5m/s适合感受凉爽微风，但5m/s以上物品可能被吹走或使用垫子不便。",
    guide_vec_t: "风向",
    guide_vec_d: "风吹来的方向。由于全州地形特性，刮西北风时体感温度会更低。",
    guide_pm10_t: "微尘(PM10)",
    guide_pm10_d: "直径10µg以下的微小污染物。30µg/m³以下为「好」，80µg/m³以上为「差」，建议减少长时间户外活动。",
    guide_pm25_t: "超微尘(PM2.5)",
    guide_pm25_d: "直径2.5µg以下，可渗透至肺泡的高危物质。15µg/m³以下为理想，超过35µg/m³必须佩戴口罩。",
    guide_o3_t: "臭氧",
    guide_o3_d: "大气中浓度升高会刺激眼睛和呼吸道。主要在阳光强烈的夏季下午浓度升高，超过0.09ppm时发布注意报。",
    guide_no2_t: "二氧化氮",
    guide_no2_d: "主要来自汽车尾气排放，可能引起支气管炎症。0.03ppm以下为舒适水平。",
    guide_khai_t: "综合空气环境指数",
    guide_khai_d: "综合超微尘、臭氧等多种污染物计算得出的数值。0~50为「好」，100以上为「差」。",
    guide_rn1_t: "降水量",
    guide_rn1_d: "最近1小时的降雨量。检测到0.1mm以上降水时，野餐评分会大幅下降。",

    // Contributors & Status
    about_status_pending: "后端连接准备中",
    about_contributors_desc: "由全北大学软件工程系三年级(24级)的3名同学共同创建的数据库团队项目。所有团队成员都核心参与了数据库设计及构建。",

    con_hm_name: "金贤珉",
    con_hm_role: "全北大学 软件工程系 24级",
     con_hm_desc: "负责前端、后端、UI/UX设计、服务器搭建、数据库设计、实时API集成。",

    con_es_name: "金恩秀",
    con_es_role: "全北大学 软件工程系 24级",
    con_es_desc: "负责直接收集公共API和位置数据，并逐一整理适配到我们的数据库中。",

    con_jh_name: "李在赫",
    con_jh_role: "全北大学 软件工程系 24级",
    con_jh_desc: "构建了将实时变化的天气数据连接到我们数据库的管道。",

    con_university: "全北大学",
    con_department: "软件工程系 24级",

    about_philosophy_title: "나들해的创建者",
    about_philosophy_desc: "由全北大学软件工程系24级的3名同学共同策划和开发。比起服务的华丽，我们更专注于数据如何流动和存储这些数据库的基础。",

    // Statistics Page Extra
    cal_archive_title: "野餐档案",
    cal_archive_desc: "在月度日历中一目了然地查看野餐指数高分推荐日的模式。",
    cal_insight_title: "洞察",
    cal_insight_text: "全州传统上5月第2~3周的周末记录了最舒适的野餐指数。",
    cal_origin_title: "数据来源",
    cal_origin_desc: "闪烁图标日期表示野餐指数80分以上的推荐日。",
  },

  ja: {
    // Navbar
    nav_home: "ホーム",
    nav_jeonju: "全州+",
    nav_about: "紹介",
    nav_stats: "統計カレンダー",
    nav_calendar: "カレンダー",
    nav_lab: "ラボ",
    nav_login: "ログイン",
    nav_login_status: "接続準備中",
    nav_login_unsupported: "現在未対応",
    logo_text: "Nadeulhae",
    login_back_home: "ホームに戻る",
    login_back_login: "ログインに戻る",
    login_badge: "準備中",
    login_title: "ログイン",
    login_subtitle: "アカウント機能は今後バックエンド接続と共に開放予定です。",
    login_email: "メール",
    login_password: "パスワード",
    login_email_placeholder: "name@example.com",
    login_password_placeholder: "••••••••",
    login_forgot: "パスワードをお忘れですか？",
    login_cta_pending: "ログイン準備中",
    login_no_account: "アカウントをお持ちではありませんか？",
    login_go_signup: "会員登録",
    signup_title: "一緒に始めてみませんか？",
    signup_subtitle: "会員登録機能もログインと共に順次開放予定です。",
    signup_name: "名前",
    signup_name_placeholder: "名前を入力",
    signup_password_placeholder: "最低8文字以上",
    signup_terms: "登録により、나들해の利用規約およびプライバシーポリシーに同意したことになります。",
    signup_cta_pending: "会員登録準備中",
    signup_has_account: "すでにアカウントをお持ちですか？",
    signup_go_login: "ログイン",

    // UI General
    loading_weather: "天気情報を読み込んでいます...",
    loading_locating: "位置情報を取得中...",
    footer_copy: "© 2026 Nadeulhae. All rights reserved.",
    footer_notice: "位置情報の許可がある場合、現在地の天気判断にのみ使用され、画面データは気象庁・韓国環境公団などの公共データに基づいて構成されます。",
    footer_terms: "利用規約およびプライバシーポリシー",
    footer_about: "나들해について",

    // Hero
    hero_title: "今日の全州はピクニックに最適な日です！",
    hero_score_label: "現在",
    hero_score_subtitle: "ピクニック指数",
    hero_best_day: "最高のお出かけ日和！",
    hero_unit: "点",
    hero_temp: "気温",
    hero_humidity: "湿度",
    hero_wind: "風速",
    hero_dust: "微細粉塵",
    hero_pm10: "微細粉塵(PM10)",
    hero_pm25: "超微細粉塵(PM2.5)",
    hero_o3: "オゾン",
    hero_no2: "二酸化窒素",
    hero_co: "一酸化炭素",
    hero_so2: "二酸化硫黄",
    hero_khai: "統合大気指数",
    hero_vec: "風向",
    hero_precip: "降水量",
    hero_uv: "紫外線",

    status_coming_soon: "バックエンド接続待機中",
    status_nearby_station: "近隣の観測所",
    station_dukjin: "徳津洞（トクチンドン）",

    // Statistics
    stats_title: "データで見る全州",
    stats_desc: "DBに蓄積された長年の気象データを分析した結果です。",

    // AI Action
    ai_title: "あなたの一日をデザインします",
    ai_desc: "希望の時間帯と地域を選択してください。AIがリアルタイムの天気の流れに最適化された半日コースをおすすめします。",
    ai_time_label: "活動時間帯",
    ai_time_val: "13:00 ~ 18:00 (午後)",
    ai_loc_label: "おすすめ地域",
    ai_loc_val: "全州 徳津区 (セビョンホ付近)",
    ai_loc_current: "現在地を使用",
    ai_loc_mock: "全州市 完山区 (現在地)",
    ai_button: "AIコースを生成",
    ai_loading: "全州の天気データを分析中...",
    ai_processing_label: "LLM & 気象DB分析中",
    ai_loading_detail: "気象シアー現象を分析中...",

    // Result
    result_title: "おすすめ半日コース",
    result_desc: "天気の流れに合わせて最適化された動線です。",

    // About
    about_hero_tag: "Our Vision",
    about_hero_title: "全州のすべての瞬間を天気とつなぐ",
    about_hero_desc: "나들해は単なる天気情報を超えて、あなたの大切な全州でのお出かけが天気の流れの中で最も美しくなるようにデザインされています。",
    about_features_title: "나들해の機能",
    about_features_desc: "リアルタイムの公共データを読み取り、危険信号を先にフィルタリングした上で、今お出かけしても大丈夫かを地域基準で素早く整理します。",
    about_built_with: "Built with Modern Stack",
    about_contributors_title: "制作者",

    // Algorithm Section
    about_algo_title: "お出かけ指数アルゴリズム",
    about_algo_desc: "現在のお出かけ指数は、まず危険要素を排除した上で、平時には大気質・気温・空・風の4軸のみを100点満点で合算します。",
    about_algo_knockout_title: "第1段階：即時失格フィルター",
    about_algo_knockout_desc: "気象特報・津波・火山、またはマグニチュード4.0以上の地震が感知された場合は即時0点、現在雨・雪・にわか雨の場合は即時10点に固定します。この場合、他の計算は省略されます。",
    about_algo_air_title: "大気質 40点",
    about_algo_air_desc: "AirKoreaの`khaiGrade`を使用します。良好40点、普通30点、悪い10点、非常に悪い0点で計算します。",
    about_algo_temp_title: "気温 30点",
    about_algo_temp_desc: "TMP基準で17~24℃は30点、12~16℃・25~28℃は20点、10~11℃・29~31℃は10点、それ以外は0点です。",
    about_algo_sky_title: "空 20点",
    about_algo_sky_desc: "SKYが晴れ(1)または曇り多め(3)なら20点、曇り(4)なら10点です。",
    about_algo_wind_title: "風 10点",
    about_algo_wind_desc: "WSDが0~3m/sなら10点、4~6m/sなら5点、7m/s以上なら0点です。",
    about_algo_data_title: "リアルタイムデータ同期",
    about_algo_data_desc: "気象庁の超短期実況/予報とAirKoreaのリアルタイム大気APIを地域キャッシュと共に読み取り、実際の画面と説明が同じルールに従うように調整します。",
    about_placeholder: "ここに情報が入るよう、今後アップデート予定です。",

    // Calendar
    cal_title: "ピクニックカレンダー",
    cal_desc: "リアルタイム予報と日付別スコアを一緒に見ながらお出かけのタイミングを選べます。",
    cal_legend: "ピクニック最適日",
    cal_realtime_title: "リアルタイム予報カレンダー",
    cal_realtime_desc: "これからの予報の流れと日付別ピクニックスコアを一度に確認できます。",
    cal_realtime_status: "リアルタイムデータ",
    cal_realtime_note: "気象庁からリアルタイムで受信された予報データです。1時間ごとに更新されます。",

    // Briefing
    brief_title: "今日のお出かけブリーフィング",
    brief_temp_perfect: "現在の気温は{temp}°Cで、お出かけにちょうど良い快適な温度です。",
    brief_temp_v_cold: "現在{temp}°Cで非常に寒いです！厚手のコートと防寒具が必須です。",
    brief_temp_cold: "現在{temp}°Cで気温が低いので、暖かい上着をお持ちください。",
    brief_temp_mild: "現在{temp}°Cで涼しい天気です。軽い上着がちょうど良いでしょう。",
    brief_temp_warm: "現在{temp}°Cで春の陽気を感じます。屋外活動に最適です。",
    brief_temp_hot: "現在{temp}°Cでやや暑い天気です。冷たい飲み物をご用意ください。",
    brief_temp_v_hot: "現在{temp}°Cで非常に暑いです！長時間の屋外活動は避け、水分補給をしてください。",

    brief_dust_excel: "微細粉塵の濃度が{dust}と非常に低く、全州の空気がとてもきれいで澄んでいます。",
    brief_dust_good: "微細粉塵が{dust}で清浄なため、爽やかなお出かけを楽しむのに最適です。",
    brief_dust_mod: "微細粉塵が{dust}で普通レベルです。敏感な方は大気情報をご確認ください。",
    brief_dust_bad: "微細粉塵が{dust}で悪いレベルです。屋外活動時は必ずマスクを着用してください。",

    brief_wind_calm: "風が{wind}m/sでほとんど吹いておらず、穏やかな雰囲気です。",
    brief_wind_breezy: "風が{wind}m/sで心地よく涼しく吹いています。",
    brief_wind_strong: "現在の風速が{wind}m/sで強く吹いており、物が揺れる可能性があります。",

    brief_humi_dry: "湿度が{humi}%で非常に乾燥しています。火災予防と水分補給にご注意ください。",
    brief_humi_comfort: "湿度が{humi}%で快適で、爽やかな気分になる日です。",
    brief_humi_humid: "湿度が{humi}%でやや蒸し暑いです。不快指数が高くなる可能性がありますのでご注意ください。",

    brief_pty_rain: "現在雨が降っています。傘をお持ちいただくか、屋内のお出かけコースをおすすめします。",
    brief_pty_snow: "現在雪が降っています。凍結路面の安全に注意しながら雪景色をお楽しみください。",

    // Status Tiers
    status_excellent: "最高の日",
    status_good: "良い日",
    status_fair: "普通の日",
    status_poor: "悪い日",

    msg_excellent: [
      "今日は全州でピクニックに行くのに完璧な日です！",
      "今日の全州はお出かけにこれ以上ないほど完璧です！",
      "気象条件が最高です。今すぐセビョンホに出かけましょう！",
      "セビョンホの澄んだ空気を満喫するのに最高の日です！",
      "今日のような日は、ただ歩くだけでも癒される全州です。"
    ],
    msg_good: [
      "散歩やお出かけにちょうど良い天気です。",
      "日差しが心地よく降り注ぐ全州の午後ですね。",
      "軽い散歩で気分転換するのにぴったりの天気です。",
      "程よい日差しと風が調和した気持ちの良いお出かけ日和です。",
      "今日の全州の大気質は非常に良好です。屋外活動をおすすめします。"
    ],
    msg_fair: [
      "なんとかお出かけしても大丈夫な天気です。",
      "少し残念ですが、近くの公園の散歩くらいなら大丈夫です。",
      "天気がそれほど悪くないので、軽く外の空気を吸いに出かけましょう。",
      "完璧ではありませんが、軽い散歩程度なら悪くない日です。",
      "屋内と屋外のコースを適度に組み合わせて全州を楽しんでみてはいかがでしょうか？"
    ],
    msg_poor: [
      "今日は屋外活動を避けるのが良さそうです。",
      "天気が不安定です。できるだけ屋内活動をおすすめします。",
      "現在の気象条件は屋外活動に不向きです。",
      "屋外より全州のおしゃれなカフェや博物館を訪れてみてはいかがですか？",
      "残念ながら今日は天気が味方してくれませんね。屋内でゆっくり過ごしましょう。"
    ],
    msg_home_excellent: [
      "今日の全州は川辺の散歩からセビョンホへのお出かけまで思う存分楽しめる良い日です。",
      "全州の空と空気の流れがすべて安定しています。余裕を持って屋外の予定を入れても大丈夫です。",
      "全州特有のゆったりとした散歩コースを楽しむのにぴったりのコンディションです。",
      "徳津公園と全州川周辺が特に快適に感じられる天気です。",
      "今日は全州で長く歩き長く滞在するのに良い、バランスの取れたお出かけ日和です。"
    ],
    msg_home_good: [
      "全州基準で見るとかなり安定した天気で、軽いお出かけによく合います。",
      "大きな変数なく全州の屋外コースをこなすのに良い一日です。",
      "日差しと大気質が無難で、全州の路地散歩や公園の予定がよく合います。",
      "全州で半日程度の屋外予定を入れるのに良い流れです。",
      "今日の全州は屋外予定中心に動いても負担が大きくないでしょう。"
    ],
    msg_home_fair: [
      "全州は今日完璧ではありませんが、短い散歩程度は十分可能です。",
      "気象条件が少し惜しくて、全州では屋内と屋外を混ぜた予定がより合います。",
      "長く滞在する屋外予定よりは、短く動くコースが合います。",
      "全州基準では無難な方ですが、時間帯をよく選んで動くのが良さそうです。",
      "状況を見ながら柔軟に動線を変えれば十分楽しめる日です。"
    ],
    msg_home_poor: [
      "今日の全州は屋外より屋内コースを優先する方が安全です。",
      "全州地域の気象の流れが良くないため、屋外予定は短めにする方が良いです。",
      "天気の変数が大きく、全州ではカフェや屋内空間中心の動線がより合います。",
      "今日は無理なお出かけより屋内でゆっくり過ごす方が良さそうです。",
      "全州の空の状態が不安定なので、普段より保守的に予定を組むのが良いです。"
    ],
    msg_away_excellent: [
      "現在お住まいの地域は屋外活動を長めに取っても良いくらいコンディションが安定しています。",
      "現在地基準で見ると散歩や公園の予定にとてもよく合う天気です。",
      "今日は他の地域でも全州に負けないくらい快適な屋外予定が可能です。",
      "現在地の空気と気温の流れが良く、長い屋外コースを計画するのに良いです。",
      "今いる場所はしばらく外に滞在するのに良い、晴れて安定した状態です。"
    ],
    msg_away_good: [
      "現在地基準で無難に屋外予定をこなせる天気です。",
      "今いる地域は軽い散歩や近距離のお出かけによく合います。",
      "大きな危険信号なしに外部活動を楽しむのに良い条件です。",
      "現在の地域は半日程度の屋外予定によく合う流れです。",
      "今の場所では公園や散歩コースを気軽に楽しむのに良さそうです。"
    ],
    msg_away_fair: [
      "今いる地域は短い外出は大丈夫ですが、長く滞在する予定は慎重な方が良いです。",
      "現在地の天気は平凡なレベルなので、動線を柔軟に組むのが良さそうです。",
      "軽い散歩程度は大丈夫ですが、屋内の代替案を一緒に準備しておくと良いでしょう。",
      "現在の地域は瞬間的な変数に備えて短いコースで動く方が適切です。",
      "屋内と屋外を混ぜて動けば、今の場所でも十分一日を楽しめます。"
    ],
    msg_away_poor: [
      "今いる地域は屋外活動より屋内の代替案を優先する方が良いです。",
      "現在地の気象の流れが不安定で、無理な屋外予定はおすすめしません。",
      "外部滞在時間を減らし、屋内中心で動く方が安全です。",
      "今いる地域は屋外コンディションが良くないため、予定調整が必要に見えます。",
      "現在の地域は天気リスクがあり、短い移動と屋内計画がより合います。"
    ],

    // Knock-out Event Alert Messages
    alert_earthquake_title: "🚨 津波/地震特報発令中",
    alert_earthquake_desc: "近隣海域の地震発生により、屋外活動を絶対に禁止します。",
    alert_weather_wrn_title: "🚨 気象特報発令中",
    alert_weather_wrn_desc: "現在照会地域に気象特報が発令中です。安全のため外出を控えてください。",
    alert_heavy_rain_title: "☔ 現在激しい雨/雪が降っています",
    alert_heavy_rain_desc: "気象条件の悪化によりピクニック指数が大幅に下落しました。屋内活動に予定を変更してください。",

    // Fallback Location
    fallback_message: "現在お住まいの地域の大気情報を一時的に取得できないため、나들해のホームタウンである「全州」基準の天気をお見せします！🏡",

    // Detailed Data Descriptions
    about_data_title: "データ項目詳細案内",
    about_data_desc: "나들해で提供する10種類以上の精密気象データをわかりやすく説明します。",

    about_item_temp: "気温 (Temperature)",
    about_item_temp_desc: "空気の温度を意味し、18~24°Cの間がお出かけに最も快適です。10°C未満は寒く、30°C以上は猛暑に注意が必要です。",

    about_item_humi: "湿度 (Humidity)",
    about_item_humi_desc: "空気中の水蒸気量で、40~60%が最も快適です。70%を超えると蒸し暑く不快指数が高くなることがあります。",

    about_item_wind: "風速 (Wind Speed)",
    about_item_wind_desc: "風の強さで、4m/s以下は気持ち良いそよ風です。8m/s以上は持ち物が飛ばされる可能性があり注意が必要です。",

    about_item_vec: "風向 (Wind Direction)",
    about_item_vec_desc: "風が吹いてくる方向です。北風は主に冷たい空気を、西風は内陸の粉塵を伴う可能性があります。",

    about_item_pm10: "微細粉塵 (PM10)",
    about_item_pm10_desc: "直径10µg以下の粉塵で、30µg/m³以下は非常に良好です。80µg/m³を超えるとマスク着用が推奨されます。",

    about_item_pm25: "超微細粉塵 (PM2.5)",
    about_item_pm25_desc: "髪の毛の太さより20~30倍小さい微細な粉塵です。15µg/m³以下は安全ですが35µg/m³超過時は注意が必要です。",

    about_item_o3: "オゾン (Ozone)",
    about_item_o3_desc: "強い日差しによって生成され、0.03ppm以下は安全です。濃度が高いと目や呼吸器に刺激を与えることがあります。",

    about_item_no2: "二酸化窒素 (NO2)",
    about_item_no2_desc: "主に自動車の排気ガスから発生します。0.03ppm以下は清浄で、都市大気質の主要指標の一つです。",

    about_item_khai: "統合大気指数 (KHAI)",
    about_item_khai_desc: "複数の汚染物質を総合した大気質指数です。0~50は最高(Excellent)、100を超えると健康に有害な可能性があります。",

    about_item_precip: "降水量 (Precipitation)",
    about_item_precip_desc: "雨や雪の量です。お出かけには0mmが最も完璧で、少量でも降水があると指数が急激に下落します。",

    // Features
    about_feature_1_name: "リアルタイムお出かけ判断",
    about_feature_1_desc: "現在の天気を単純表示する代わりに、大気質、気温、空、風をスコア化して、今すぐ外に出ても大丈夫かを素早く読み取れるように整理します。",
    about_feature_2_name: "危険信号優先感知",
    about_feature_2_desc: "気象特報、公式通報、地震、降水の有無を一緒に確認し、実際に危険がある時だけ警告画面と文言を強く表示します。",
    about_feature_3_name: "地域カスタマイズ観測所連携",
    about_feature_3_desc: "ユーザーの位置に応じて近隣の観測所と予報圏域を異なるように接続し、同じサービスでも地域に合った大気質と通報を表示します。",
    about_feature_4_name: "呼び出し量を抑える構造",
    about_feature_4_desc: "気象、大気質、特報データを地域別キャッシュでまとめ、再読み込みが繰り返されても公共API呼び出しが過度に増えないように設計しました。",
    about_feature_cta: "実装内容を見る",
    about_data_driven: "公共データ基盤",
    about_live_title: "リアルタイムデータパイプライン",
    about_live_desc: "現在のサービスは公共APIをそのまま表示せず、地域判別とキャッシュポリシーを経て画面に合った形に再構成します。",
    about_live_card_1_title: "地域別観測所マッピング",
    about_live_card_1_desc: "ソウルはソウル観測所、全州は全北圏域と全州近隣観測所を優先接続し、実際の位置に合った大気質を表示します。",
    about_live_card_2_title: "条件付き危険表示",
    about_live_card_2_desc: "雨、特報、地震データが実際に感知された時だけ警告UIを表示し、平時は穏やかな通常画面のみ維持します。",
    about_live_card_3_title: "全州優先体験",
    about_live_card_3_desc: "位置権限がないか大気質応答が異常な時は全州ホーム基準で安全に代替し、その事実を明確に案内します。",
    about_structure_title: "サービス構成",
    about_structure_desc: "メイン、カレンダー、全州特化ページの役割を分離し、画面はシンプルに保ちながら必要な情報はより正確に表示します。",
    about_structure_home_title: "ホーム",
    about_structure_home_desc: "どの地域から接続しても現在地基準のピクニック指数、公式通報、近隣観測所、ブリーフィングをすぐに確認する汎用エントリー画面です。",
    about_structure_calendar_title: "カレンダー",
    about_structure_calendar_desc: "10日間予報の流れと日付別スコアを集中して見る専用画面です。地域予報カレンダーはこのページでのみ提供します。",
    about_structure_jeonju_title: "全州特化",
    about_structure_jeonju_desc: "全州ローカルコンテキスト、専用案内、今後場所DBとコース機能ロードマップをまとめる別途空間です。",
    about_structure_future_title: "今後オープン",
    about_structure_future_desc: "過去統計、飲食店・カフェ・屋外スポットDB、AI半日コースはバックエンドとDB接続後に段階的に公開予定です。",

    // Technical Labels & Briefing UI
    brief_station_engine: "状況分析エンジン",
    brief_observation_grid: "環境観測グリッド",
    brief_nrs_protocol: "NRS V1.0 - リアルタイムプロトコル",
    brief_kma_sync: "気象庁同期",
    brief_air_sync: "大気質同期",
    brief_data_source: "データソース",
    brief_ai_db_archive: "AIエンジン / DBアーカイブ",

    // Status & Levels
    level_excel: "非常に良い",
    level_good: "良い",
    level_mod: "普通",
    level_bad: "悪い",
    level_v_bad: "非常に悪い",

    uv_low: "低い",
    uv_mod: "中程度",
    uv_high: "高い",
    uv_v_high: "非常に高い",
    uv_extreme: "極端",

    // Meta & Sources
    interval_45m: "毎時45分",
    interval_0m: "毎時0分",
    data_source_kma: "気象庁",
    data_source_air: "韓国環境公団",
    data_source_combined: "気象庁, 韓国環境公団",
    label_domestic: "国内",
    label_who: "WHO",

    // Insights & Trends
    insight_1_title: "最適な曜日",
    insight_1_desc: "過去3年間の統計分析の結果、今月最も快適なピクニック曜日は「土曜日」です。",
    insight_1_cta: "統計カレンダーを見る",
    insight_2_title: "気候エネルギー",
    insight_2_desc: "今日の全州の気象エネルギーは92%で、外部活動に非常に肯定的な数値です。",
    insight_2_cta: "エネルギーレポート",
    insight_3_title: "リアルタイム混雑度",
    insight_3_desc: "徳津公園付近は現在「ゆとり」があり、快適な場所の確保が可能です。",
    insight_3_cta: "場所予約の問い合わせ",

    trend_header: "今、全州市民がよく訪れるスポット",
    trend_title: "{spot}",

    course_1_title: "暖かい屋外タイム - 徳津公園",
    course_1_desc: "日差しが最も暖かく微細粉塵がない時間帯です。徳津公園でレジャーシートを敷いてサンドイッチを食べるのをおすすめします！",
    course_2_title: "風を避けるタイム - カフェ整備",
    course_2_desc: "午後遅くからは冷たい風が吹いて体感温度が下がる可能性があります。カフェに移動してゆったり過ごしましょう。",

    // Metric Guide Title
    guide_title: "詳細気象及び大気データガイド",
    guide_desc: "나들해は気象庁と韓国環境公団のリアルタイムオープンAPIを通じて収集された10種類以上の精密データを分析し、ピクニック最適度を算出します。各指標の意味と基準は次のとおりです。",

    // Metrics
    guide_temp_t: "気温",
    guide_temp_d: "現在の地表付近の大気温度です。18°C~24°Cの間が屋外活動に最も快適で、30°C以上または5°C以下の場合は注意が必要です。",
    guide_humi_t: "湿度",
    guide_humi_d: "空気中の水蒸気の割合です。40%~60%が最も快適で、70%以上の場合不快指数が高くなり汗の蒸発が遅くなります。",
    guide_wind_t: "風速",
    guide_wind_d: "空気の移動速度です。1.5m/s~3.5m/sは涼しい風を感じるのに良いですが、5m/s以上の場合は物が飛ばされたりレジャーシートの使用に不便があります。",
    guide_vec_t: "風向",
    guide_vec_d: "風が吹いてくる方向です。全州の地形的特性上、北西風が吹くときに体感温度がより低く感じられることがあります。",
    guide_pm10_t: "微細粉塵(PM10)",
    guide_pm10_d: "直径10µg以下の微細汚染物質です。30µg/m³以下は「良い」、80µg/m³以上は「悪い」に分類され、長時間の屋外活動自粛を推奨します。",
    guide_pm25_t: "超微細粉塵(PM2.5)",
    guide_pm25_d: "直径2.5µg以下で肺胞まで浸透可能な高リスク物質です。15µg/m³以下が理想的で、35µg/m³超過時はマスク着用が必須です。",
    guide_o3_t: "オゾン",
    guide_o3_d: "大気中の濃度が高くなると目や呼吸器を刺激します。主に日差しが強い夏の午後に濃度が高くなり、0.09ppm超過時に注意報が発令されます。",
    guide_no2_t: "二酸化窒素",
    guide_no2_d: "主に自動車の排気ガスから排出され、気管支炎を引き起こす可能性があります。0.03ppm以下が快適なレベルです。",
    guide_khai_t: "統合大気環境指数",
    guide_khai_d: "超微細粉塵、オゾンなど複数の汚染物質を総合して算出した数値です。0~50は「良い」、100以上は「悪い」を意味します。",
    guide_rn1_t: "降水量",
    guide_rn1_d: "直近1時間に降った雨の量です。0.1mm以上の降水が感知されるとピクニックスコアが大きく下落します。",

    // Contributors & Status
    about_status_pending: "バックエンド接続準備中",
    about_contributors_desc: "全北大学校ソフトウェア工学科3年生(24学番)の同期3名が一緒に作成したデータベースチームプロジェクトです。すべてのチームメンバーがデータベース設計および構築に中核的に参加しました。",

    con_hm_name: "キム・ヒョンミン",
    con_hm_role: "全北大学校 ソフトウェア工学科 24学番",
     con_hm_desc: "フロントエンド、バックエンド、UI/UXデザイン、サーバー構築、DB設計、リアルタイムAPI連携を担当しました。",

    con_es_name: "キム・ウンス",
    con_es_role: "全北大学校 ソフトウェア工学科 24学番",
    con_es_desc: "公共APIと位置データを直接収集して、私たちのデータベースに合わせて一つ一つ積み上げる作業を担当しました。",

    con_jh_name: "イ・ジェヒョク",
    con_jh_role: "全北大学校 ソフトウェア工学科 24学番",
    con_jh_desc: "リアルタイムで変化する天気データを私たちのデータベースと接続するパイプラインを作りました。",

    con_university: "全北大学校",
    con_department: "ソフトウェア工学科 24学番",

    about_philosophy_title: "나들해を作った人々",
    about_philosophy_desc: "全北大学校ソフトウェア工学科24学番の同期3名が一緒に企画し開発しました。サービスの華やかさよりも、データがどのように流れ保存されるか、データベースの基本に集中して作りました。",

    // Statistics Page Extra
    cal_archive_title: "ピクニックアーカイブ",
    cal_archive_desc: "月単位カレンダーでピクニック指数上位のおすすめ日パターンを一目で確認します。",
    cal_insight_title: "インサイト",
    cal_insight_text: "全州は伝統的に5月第2~3週の週末が最も快適なピクニック指数を記録しました。",
    cal_origin_title: "データソース",
    cal_origin_desc: "キラキラアイコンの日付はピクニック指数80点以上のおすすめ日を意味します。",
  }
}


const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("ko")

  useEffect(() => {
    const savedLanguage = typeof window !== "undefined"
      ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
      : null

    if (savedLanguage === "ko" || savedLanguage === "en" || savedLanguage === "zh" || savedLanguage === "ja") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLanguage(savedLanguage)
      return
    }

    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ko'
    const targetLang: Language = (() => {
      if (browserLang === 'ko') return 'ko'
      if (browserLang === 'zh') return 'zh'
      if (browserLang === 'ja') return 'ja'
      return 'en'
    })()

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
    const val = translations[language]?.[key] ?? translations.ko?.[key]
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
