export const en = {
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
  cal_origin_desc: "Dates with the sparkle icon indicate recommended days with picnic score 80+."
}
