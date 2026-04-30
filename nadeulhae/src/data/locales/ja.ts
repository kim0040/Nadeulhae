export const ja = {
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
  cal_origin_desc: "キラキラアイコンの日付はピクニック指数80点以上のおすすめ日を意味します。"
}
