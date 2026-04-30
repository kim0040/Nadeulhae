export const zh = {
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
  cal_origin_desc: "闪烁图标日期表示野餐指数80分以上的推荐日。"
}
