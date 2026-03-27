"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

type Language = "ko" | "en"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const translations: Record<Language, Record<string, string>> = {
  ko: {
    // Navbar
    nav_home: "홈",
    nav_about: "소개",
    nav_stats: "통계 달력",
    nav_calendar: "달력",
    nav_login: "로그인",
    nav_login_status: "연결 준비 중",
    nav_login_unsupported: "현재 지원되지 않음",
    logo_text: "나들해",
    
    // UI General
    loading_weather: "전주 날씨 데이터를 불러오고 있습니다...",
    loading_locating: "위치 찾는 중...",
    footer_copy: "© 2026 전주 나들해 (Jeonju Nadeulhae). All rights reserved.",
    
    // Hero
    hero_title: "오늘 전주는 피크닉 가기 완벽한 날이에요!",
    hero_score_label: "피크닉 지수",
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
    about_features_title: "어떻게 도와드릴까요?",
    about_features_desc: "데이터와 인공지능이 만나 전주에서의 완벽한 반나절을 제안합니다.",
    about_built_with: "Built with Modern Stack",
    about_contributors_title: "만든 사람들",
    
    // Algorithm Section
    about_algo_title: "나들이 지수 알고리즘",
    about_algo_desc: "나들이 지수는 어떻게 계산될까요? 여러 환경 요인을 종합하여 0~100점 사이의 점수를 산출합니다.",
    about_algo_temp_title: "최적 온도 (18-24°C)",
    about_algo_temp_desc: "기본 100점에서 시작하여, 18도 미만(-3점/도) 혹은 24도 초과(-4점/도) 시 감점됩니다.",
    about_algo_dust_title: "이중 미세먼지 기준",
    about_algo_dust_desc: "국내(환경부)와 WHO 기준을 동시에 분석합니다. 30µg/m³ 초과 시 농도에 따라 감점폭이 커집니다.",
    about_algo_weather_title: "강수 및 풍속",
    about_algo_weather_desc: "비나 눈이 감지되면 즉시 35점으로 고정됩니다. 강풍(4m/s 초과) 시에도 쾌적함을 위해 감점됩니다.",
    about_algo_data_title: "실시간 데이터 동기화",
    about_algo_data_desc: "기상청(매시 45분 기준) 및 에어코리아(매시 정각 기준)의 공식 관측 데이터를 실시간으로 동기화하여 가장 정확한 정보를 제공합니다.",
    about_placeholder: "이곳에 당신의 정보가 들어갈 수 있도록 추후 정보를 업데이트할 예정입니다.",
    
    // Calendar
    cal_title: "전주 피크닉 캘린더",
    cal_desc: "전주의 날씨 데이터를 분석해 피크닉 최적 일정을 확인하세요.",
    cal_legend: "피크닉 최적일",
    cal_realtime_title: "실시간 피크닉 캘린더",
    cal_realtime_desc: "기상청 실시간 예보 기반, 최적의 피크닉 날짜를 확인하세요",
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
    
    msg_excellent: "오늘은 전주에서 피크닉 가기 완벽한 날이에요!",
    msg_excellent_1: "오늘 전주는 나들이하기에 더할 나위 없이 완벽해요!",
    msg_excellent_2: "기상 조건이 최상입니다. 지금 바로 세병호로 떠나보세요!",
    msg_excellent_3: "세병호의 맑은 공기를 만끽하기 가장 좋은 날이에요!",
    msg_excellent_4: "오늘 같은 날은 무심코 걷기만 해도 힐링이 되는 전주입니다.",
    msg_good: "산책하고 나들이하기 참 좋은 날씨입니다.",
    msg_good_1: "햇살이 기분 좋게 내리쬐는 전주의 오후네요.",
    msg_good_2: "가벼운 산책으로 기분 전환하기 딱 좋은 날씨입니다.",
    msg_good_3: "적당한 햇살과 바람이 어우러진 기분 좋은 나들이 날씨예요.",
    msg_good_4: "오늘 전주의 대기질은 아주 양호합니다. 야외 활동을 추천드려요.",
    msg_fair: "그럭저럭 나들이하기 괜찮은 날씨예요.",
    msg_fair_1: "조금은 아쉽지만, 근처 공원 산책 정도는 괜찮아요.",
    msg_fair_2: "날씨가 아주 나쁘진 않으니 가볍게 야외 공기를 쐬 보세요.",
    msg_fair_3: "완벽하진 않아도 가벼운 산책 정도는 즐기기 나쁘지 않은 날이에요.",
    msg_fair_4: "실내외 코스를 적절히 섞어서 전주를 즐겨보시는 건 어떨까요?",
    msg_poor: "오늘은 야외 활동을 피하는 것이 좋겠어요.",
    msg_poor_1: "날씨가 불안정합니다. 가급적 실내 활동을 권장드려요.",
    msg_poor_2: "현재 야외 활동을 하기엔 부적합한 기상 조건입니다.",
    msg_poor_3: "야외보다는 전주의 예쁜 카페나 박물관을 방문해보는 건 어떨까요?",
    msg_poor_4: "아쉽게도 오늘은 날씨가 도와주지 않네요. 실내에서 여유를 찾아보세요.",

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
    about_feature_1_name: "날씨 지능형 분석",
    about_feature_1_desc: "단순 온도를 넘어 습도, 풍속, 미세먼지를 종합하여 최적의 피크닉 순간을 포착합니다.",
    about_feature_2_name: "AI 코스 큐레이션",
    about_feature_2_desc: "LLM이 전주의 장소 DB와 실시간 날씨를 조합해 맞춤형 동선을 설계합니다.",
    about_feature_3_name: "로컬 장소 DB",
    about_feature_3_desc: "전주의 숨은 명소부터 인기 카페까지, 실내외 특성을 고려한 큐레이션을 제공합니다.",
    about_feature_4_name: "과거 데이터 통찰",
    about_feature_4_desc: "지난 3년의 기상 통계를 통해 가장 완벽한 요일과 시간대를 추천합니다.",
    about_feature_cta: "자세히 보기",
    about_data_driven: "100% 데이터 기반",

    // Technical Labels & Briefing UI
    brief_station_engine: "상황 분석 엔진",
    brief_observation_grid: "환경 관측 그리드",
    brief_nrs_protocol: "NRS V1.0 - 실시간 프로토콜",
    brief_kma_sync: "기상청 동기화",
    brief_air_sync: "대기질 동기화",
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
    
    trend_title: "지금 전주 시민들이 많이 찾는 스팟: {spot}",
    
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
    cal_archive_title: "과거 나들이 아카이브",
    cal_archive_desc: "지난 3년간의 데이터를 바탕으로 전주의 나들이 트렌드를 확인하세요",
    cal_insight_title: "💡 인사이트",
    cal_insight_text: "전주는 전통적으로 5월 2~3주차 주말이 가장 쾌적한 피크닉 지수를 기록했습니다.",
    cal_origin_title: "데이터 출처",
    cal_origin_desc: "위 데이터는 최근 3년간의 공공 기상 데이터와 자체 대기질 관측 결과를 결합한 나들해 나들이 수치입니다.",
  },

  en: {
    // Navbar
    nav_home: "Home",
    nav_about: "About",
    nav_calendar: "Calendar",
    nav_login: "Login",
    nav_login_status: "Sync Pending",
    nav_login_unsupported: "Unsupported",
    logo_text: "Nadeulhae",
    
    // Hero
    hero_title: "Jeonju is perfect for a picnic today!",
    hero_score_label: "Picnic Index",
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
    about_features_title: "Key Features",
    about_features_desc: "From real-time weather grids to AI-powered trip plans, we bring data to life.",
    about_built_with: "Built with Modern Stack",
    about_contributors_title: "Team Nadeulhae",
    
    // Algorithm Section
    about_algo_title: "The Picnic Index Algorithm",
    about_algo_desc: "How do we calculate the perfect moment? Our algorithm weighs multiple environmental factors to give you a score from 0 to 100.",
    about_algo_temp_title: "Optimal Temperature (18-24°C)",
    about_algo_temp_desc: "Base score starts at 100. We deduct points for extreme cold (-3 pts/°C) or heat (-4 pts/°C).",
    about_algo_dust_title: "Dual Air Quality Standards",
    about_algo_dust_desc: "We compare Domestic (KR) and WHO standards. Scores drop significantly if PM10 exceeds 30µg/m³.",
    about_algo_weather_title: "Precipitation & Wind",
    about_algo_weather_desc: "Rain or snow drops the score to 35 immediately. Strong winds (>4m/s) also reduce the score for comfort.",
    about_algo_data_title: "Real-time Syncing",
    about_algo_data_desc: "We sync with KMA (hourly at 45m) and AirKorea (hourly at 0m) official observation data to provide the most reliable information available.",
    about_placeholder: "Your information could be here. Updates coming soon.",
    
    // Calendar
    cal_title: "Jeonju Picnic Calendar",
    cal_desc: "Analyze Jeonju's weather data to find the best picnic dates.",
    cal_legend: "Optimal Picnic Day",
    cal_realtime_title: "Real-time Picnic Calendar",
    cal_realtime_desc: "Based on live KMA forecasts, find the best picnic dates",
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
    
    msg_excellent: "It's a perfect day for a picnic in Jeonju!",
    msg_excellent_1: "Conditions are absolutely perfect for an outing today!",
    msg_excellent_2: "Top-tier weather detected! Time to head to Deokjin Park.",
    msg_excellent_3: "The air is so fresh in Jeonju today, perfect for Sebyeong-ho!",
    msg_excellent_4: "Simply walking around Jeonju today will heal your soul.",
    msg_good: "The weather is great for an outing today.",
    msg_good_1: "A lovely afternoon in Jeonju with pleasant sunshine.",
    msg_good_2: "Perfect weather for a refreshing light walk.",
    msg_good_3: "Pleasant weather with a perfect mix of sun and breeze.",
    msg_good_4: "Air quality is very reliable today. Outdoor activities recommended.",
    msg_fair: "It's a decent day for a short walk.",
    msg_fair_1: "Not the best, but a quick stroll nearby is okay.",
    msg_fair_2: "The weather isn't too bad for a bit of fresh air.",
    msg_fair_3: "Not perfect, but it's a decent day for a light stroll.",
    msg_fair_4: "How about mixing indoor and outdoor spots to enjoy Jeonju?",
    msg_poor: "Better stay indoors and avoid outdoor activities today.",
    msg_poor_1: "Atmospheric conditions are unstable. Stay indoors if possible.",
    msg_poor_2: "Current weather is unsuitable for outdoor planning.",
    msg_poor_3: "How about visiting a pretty cafe or museum instead of outdoors?",
    msg_poor_4: "Sadly, the weather isn't helping today. Find comfort indoors.",

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
    about_feature_1_name: "Weather Intelligence",
    about_feature_1_desc: "Captures the optimal picnic moment by integrating humidity, wind, and dust beyond just temperature.",
    about_feature_2_name: "AI Course Curation",
    about_feature_2_desc: "LLM designs customized routes by combining Jeonju's place DB and real-time weather.",
    about_feature_3_name: "Local Place DB",
    about_feature_3_desc: "Provides curation considering indoor/outdoor characteristics, from hidden gems to popular cafes in Jeonju.",
    about_feature_4_name: "Past Data Insights",
    about_feature_4_desc: "Recommends the most perfect day and time through weather statistics of the past 3 years.",
    about_feature_cta: "View Details",
    about_data_driven: "100% Data-Driven",

    // Technical Labels & Briefing UI
    brief_station_engine: "Situational Analysis Engine",
    brief_observation_grid: "Environment Observation Grid",
    brief_nrs_protocol: "NRS V1.0 - Real-time Protocol",
    brief_kma_sync: "KMA Sync",
    brief_air_sync: "Air Poll",
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
    
    trend_title: "Popular spots in Jeonju: {spot}",
    
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
    cal_archive_title: "Picnic Data Archive",
    cal_archive_desc: "Check Jeonju's picnic trends based on data from the past few years.",
    cal_insight_title: "💡 Insight",
    cal_insight_text: "In Jeonju, the 2nd and 3rd weekends of May have traditionally recorded the most pleasant picnic index.",
    cal_origin_title: "Data Origin",
    cal_origin_desc: "This data is a combined metric from public weather data and local air quality observations over the last 3 years.",
  }
}


const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("ko")

  useEffect(() => {
    // Detect browser language
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ko'
    const targetLang = browserLang === 'ko' ? 'ko' : 'en'
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLanguage(targetLang)
  }, [])

  const t = (key: string) => {
    return translations[language][key] || key
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
