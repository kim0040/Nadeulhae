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
    hero_uv: "자외선",
    
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
    about_contributors_desc: "전주 나들해를 함께 만들어가는 기여자들입니다.",
    about_placeholder: "이곳에 당신의 정보가 들어갈 수 있도록 추후 정보를 업데이트할 예정입니다.",
    
    // Calendar
    cal_title: "전주 피크닉 캘린더",
    cal_desc: "최근 3년간의 기상 데이터를 시각화한 결과입니다. 하이라이트된 날짜는 전주에서 피크닉을 즐기기에 가장 쾌적했던 날들을 나타냅니다.",
    cal_legend: "피크닉 최적일",
    
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

    // Statistics Page Extra
    cal_archive_title: "과거 나들이 아카이브",
    cal_archive_desc: "지난 몇 년간의 데이터를 바탕으로 전주의 나들이 트렌드를 확인하세요.",
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
    
    // Hero
    hero_title: "Jeonju is perfect for a picnic today!",
    hero_score_label: "Picnic Index",
    hero_unit: "pts",
    hero_temp: "Temp",
    hero_humidity: "Humi",
    hero_wind: "Wind",
    hero_dust: "Dust",
    hero_uv: "UV",
    
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
    ai_loading_detail: "Calculating atmospheric shifts...",
    
    // Result
    result_title: "Recommended Course",
    result_desc: "Optimized route based on weather transitions.",
    
    // About
    about_hero_tag: "Our Vision",
    about_hero_title: "Connecting every moment in Jeonju with weather",
    about_hero_desc: "Nadeulhae goes beyond simple weather info, designed to ensure your precious trips to Jeonju are beautiful within the flow of weather.",
    about_features_title: "How can we help?",
    about_features_desc: "Data and AI meet to suggest the perfect half-day in Jeonju.",
    about_built_with: "Built with Modern Stack",
    about_contributors_title: "Contributors",
    about_contributors_desc: "The people building Jeonju Nadeulhae together.",
    about_placeholder: "Your information could be here. Updates coming soon.",
    
    // Calendar
    cal_title: "Jeonju Picnic Calendar",
    cal_desc: "Visualization of weather data from the last 3 years. Highlighted dates represent the most pleasant days for a picnic in Jeonju.",
    cal_legend: "Optimal Picnic Day",
    
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
    const browserLang = navigator.language.split('-')[0]
    if (browserLang === 'ko') {
      setLanguage('ko')
    } else {
      setLanguage('en')
    }
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
