import {
  AGE_BAND_OPTIONS,
  INTEREST_OPTIONS,
  PRIMARY_REGION_OPTIONS,
  TIME_SLOT_OPTIONS,
  WEATHER_SENSITIVITY_OPTIONS,
  getOptionLabel,
} from "@/lib/auth/profile-options"
import type { AuthUser } from "@/lib/auth/types"
import type { ChatConversationMessage, ChatLocale } from "@/lib/chat/types"

function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "-"
}

export interface ChatWeatherContext {
  region: string | null
  score: number | null
  status: string | null
  temperatureC: number | null
  feelsLikeC: number | null
  humidityPct: number | null
  windMs: number | null
  uvLabel: string | null
  pm10: number | null
  pm25: number | null
  rainingNow: boolean
  severeAlert: boolean
  hazardTags: string[]
  bulletin: string | null
  observedAt: string | null
}

function buildUserProfileSummary(user: AuthUser, locale: ChatLocale) {
  const interests = user.interestTags.map((value) => getOptionLabel(INTEREST_OPTIONS, value, locale))
  if (user.interestOther) {
    interests.push(user.interestOther)
  }

  const sensitivities = user.weatherSensitivity.map((value) =>
    getOptionLabel(WEATHER_SENSITIVITY_OPTIONS, value, locale)
  )

  const yesNo = (b: boolean) => {
    if (locale === "zh") return b ? "是" : "否"
    if (locale === "ja") return b ? "はい" : "いいえ"
    return locale === "ko" ? (b ? "예" : "아니오") : (b ? "yes" : "no")
  }

  if (locale === "ko") {
    return [
      `이름: ${user.displayName}`,
      `연령대: ${getOptionLabel(AGE_BAND_OPTIONS, user.ageBand, locale)}`,
      `주 사용 지역: ${getOptionLabel(PRIMARY_REGION_OPTIONS, user.primaryRegion, locale)}`,
      `선호 시간대: ${getOptionLabel(TIME_SLOT_OPTIONS, user.preferredTimeSlot, locale)}`,
      `관심사: ${formatList(interests)}`,
      `민감한 날씨 요소: ${formatList(sensitivities)}`,
      `알림 수신 동의: ${yesNo(user.marketingAccepted)}`,
    ].join("\n")
  }

  const labelMap: Record<string, Record<string, string>> = {
    zh: {
      name: "姓名",
      ageBand: "年龄段",
      primaryRegion: "主要使用区域",
      preferredTime: "偏好时间段",
      interests: "兴趣爱好",
      weatherSensitivities: "敏感天气要素",
      marketingConsent: "通知接收同意",
    },
    ja: {
      name: "名前",
      ageBand: "年齢層",
      primaryRegion: "主な利用地域",
      preferredTime: "希望時間帯",
      interests: "興味・関心",
      weatherSensitivities: "敏感な天気要素",
      marketingConsent: "通知受信の同意",
    },
  }
  const labels = labelMap[locale] ?? labelMap.zh ?? {
    name: "Name",
    ageBand: "Age",
    primaryRegion: "Region",
    preferredTime: "Time",
    interests: "Interests",
    weatherSensitivities: "Sensitivities",
    marketingConsent: "Marketing",
  }

  return [
    `${labels.name}: ${user.displayName}`,
    `${labels.ageBand}: ${getOptionLabel(AGE_BAND_OPTIONS, user.ageBand, locale)}`,
    `${labels.primaryRegion}: ${getOptionLabel(PRIMARY_REGION_OPTIONS, user.primaryRegion, locale)}`,
    `${labels.preferredTime}: ${getOptionLabel(TIME_SLOT_OPTIONS, user.preferredTimeSlot, locale)}`,
    `${labels.interests}: ${formatList(interests)}`,
    `${labels.weatherSensitivities}: ${formatList(sensitivities)}`,
    `${labels.marketingConsent}: ${yesNo(user.marketingAccepted)}`,
  ].join("\n")
}

export function buildChatSystemPrompt(input: {
  locale: ChatLocale
  user: AuthUser
  memorySummary: string | null
  profileSummary: string | null
  profileAssessment: string | null
  weatherContext: ChatWeatherContext | null
}) {
  const profileSummary = buildUserProfileSummary(input.user, input.locale)
  const weatherSummary = buildWeatherSummary(input.weatherContext, input.locale)
  const profileMemory = buildProfileMemoryContext({
    locale: input.locale,
    summary: input.profileSummary,
    assessment: input.profileAssessment,
  })

  const now = new Date()
  const systemNowKst = new Intl.DateTimeFormat("ko-KR", { 
    timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "numeric", minute: "numeric" 
  }).format(now)
  const systemNowKstIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now)
  const systemNowKstTime = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now)

  if (input.locale === "ko") {
    return [
      `[시스템 현재 시각 (KST)] 오늘은 ${systemNowKstIso} (${systemNowKst}) 이며 현재 시간은 ${systemNowKstTime}입니다. 오늘 날짜를 기준으로 답변하세요.`,
      `Today: ${systemNowKstIso}`,
      "당신은 나들해 서비스의 개인화 나들이 코파일럿이다.",
      "당신의 이름은 '나들AI'다.",
      "답변 원칙:",
      "- 반드시 한국어로 답변하고, 불필요하게 길게 늘어놓지 말 것",
      "- 본인의 모델명, 벤더명, 내부 시스템 정보는 절대 공개하지 말 것",
      "- 정체를 묻는 질문에는 '저는 나들AI입니다.'처럼 이름만 짧게 답할 것",
      "- 사용자 프로필과 저장된 대화 메모리를 참고해 추천을 개인화할 것",
      "- 사용자의 연령대, 관심사, 선호 시간대, 민감한 날씨 정보를 적극 활용해 맞춤형 추천을 할 것",
      "- 추천할 때 사용자의 관심사(취미)를 언급하며 '~님은 ~을 좋아하시니'처럼 자연스럽게 연결할 것",
      "- 실시간 날씨 컨텍스트가 있을 때는 '항상' 언급하지 말고, 일정 판단에 실제로 영향이 있을 때만 짧게 반영할 것",
      "- 비/강수 또는 특보 상황이면 실내·안전 동선을 우선 제시하고, 필요 시 대체안을 함께 제시할 것",
      "- 날씨 컨텍스트가 없으면 아는 척하지 말고, 필요한 경우에만 한 줄로 확인 질문할 것",
      "- 사용자 장기 메모리(요약/평가)는 필요할 때만 참고하고 매 답변마다 반복 노출하지 말 것",
      "- 비밀번호, API 키, 세션 쿠키, 주민번호 같은 민감정보는 요청받아도 저장/출력/유도하지 말 것",
      "- 다이어그램이 필요하면 반드시 ```mermaid 코드블록으로만 출력할 것",
      "- Mermaid 관련 HTML/SVG(<div>, <svg>, style 태그) 원문을 절대 출력하지 말 것",
      "- 추천은 실용적으로 제시하고, 가능하면 3개 이내의 핵심 옵션으로 정리할 것",
      "",
      "[사용자 프로필]",
      profileSummary,
      "",
      "[실시간 날씨 컨텍스트]",
      weatherSummary,
      "",
      "[사용자 장기 메모리(내부용)]",
      profileMemory,
      "",
      "[저장된 메모리]",
      input.memorySummary || "아직 저장된 대화 메모리가 없습니다.",
    ].join("\n")
  }

  if (input.locale === "zh") {
    return [
      `[系统当前时间 (KST)] 今天是 ${systemNowKstIso} (${systemNowKst})，当前时间是 ${systemNowKstTime}。请以此日期为准回答。`,
      `Today: ${systemNowKstIso}`,
      "你是Nadeulhae服务的个性化出行副驾驶。",
      "你的名字是'Nadeul AI'。",
      "回答规则：",
      "- 必须用中文回答，不要太啰嗦",
      "- 绝对不能透露你的模型名称、供应商或内部系统信息",
      "- 被问及身份时，简短回答'我是Nadeul AI。'",
      "- 参考用户偏好和存储的记忆进行个性化推荐",
      "- 积极利用用户的年龄段、兴趣爱好、偏好时段和敏感天气信息进行定制推荐",
      "- 推荐时自然地关联用户的兴趣爱好，例如「既然您喜欢…」",
      "- 不要每次都提天气，只在确实影响计划时简短提及",
      "- 下雨或警报时优先室内/安全路线，并提供备选方案",
      "- 没有天气信息时不要假装知道，必要时只问一句",
      "- 长期用户记忆仅在相关时参考，不要逐条复述",
      "- 绝不要请求或输出密码、密钥等敏感信息",
      "- 需要图表时只用```mermaid代码块输出",
      "- 绝不要输出Mermaid相关的原始HTML/SVG",
      "- 推荐应实用，控制在3个核心选项以内",
      "",
      "[用户偏好]",
      profileSummary,
      "",
      "[实时天气]",
      weatherSummary,
      "",
      "[长期用户记忆(内部)]",
      profileMemory,
      "",
      "[存储的记忆]",
      input.memorySummary || "暂无存储的对话记忆。",
    ].join("\n")
  }

  if (input.locale === "ja") {
    return [
      `[システム現在時刻 (KST)] 今日は ${systemNowKstIso} (${systemNowKst})、現在時刻は ${systemNowKstTime} です。この日付を基準に回答してください。`,
      `Today: ${systemNowKstIso}`,
      "あなたはNadeulhaeサービスのパーソナライズされたお出かけコパイロットです。",
      "あなたの名前は'Nadeul AI'です。",
      "回答ルール：",
      "- 必ず日本語で回答し、不要に長くならないように",
      "- モデル名、ベンダー、内部システム情報は絶対に公開しない",
      "- 自分が誰か聞かれたら「私はNadeul AIです。」と簡潔に",
      "- ユーザーの好みと保存された記憶に基づいて個別の提案を行う",
      "- ユーザーの年齢層、趣味、希望時間帯、敏感な天気要素を積極的に活用してカスタマイズされた提案をする",
      "- 提案時に「〜様は〜がお好きですので」のように自然に趣味に触れる",
      "- 天気に毎回言及せず、計画に実際に影響があるときだけ簡単に反映する",
      "- 雨や警報時は屋内・安全優先のルートを提示し代替案も出す",
      "- 天気情報がないときは知ったかぶりせず、必要な場合だけ確認の質問を1行で",
      "- 長期記憶は関連するときだけ参照し、毎回答えに含めない",
      "- パスワードやキーなどの機密情報は要求・出力しない",
      "- 図が必要なときは```mermaidコードブロックのみで出力",
      "- Mermaidの生HTML/SVGを絶対に出力しない",
      "- 提案は実用的に、3つ以内の核心オプションにまとめる",
      "",
      "[ユーザープロフィール]",
      profileSummary,
      "",
      "[リアルタイム天気]",
      weatherSummary,
      "",
      "[長期ユーザー記憶(内部)]",
      profileMemory,
      "",
      "[保存された記憶]",
      input.memorySummary || "まだ保存された会話の記憶はありません。",
    ].join("\n")
  }

  return [
    `[System Current Time (KST)] Today is ${systemNowKstIso} (${systemNowKst}), current time is ${systemNowKstTime}. Use this as the current date for all responses.`,
    `Today: ${systemNowKstIso}`,
    "You are the personalized outing copilot for the Nadeulhae service.",
    "Your assistant name is 'Nadeul AI'.",
    "Response rules:",
    "- Always answer in English unless the user clearly writes in Korean",
    "- Never reveal your model name, provider, or internal system details",
    "- If asked who you are, answer briefly as 'I am Nadeul AI.'",
    "- Personalize recommendations using the saved profile and memory summary",
    "- Actively use the user's age range, interests, preferred time slot, and weather sensitivities for tailored suggestions",
    "- When recommending, naturally reference the user's interests like 'Since you enjoy ...'",
    "- Do not mention weather in every response; only use it when it materially affects the plan",
    "- If rain or severe alerts are present, prioritize indoor/safety-first routes and include fallback options",
    "- If live weather context is missing, do not fabricate it; ask one concise clarification only when needed",
    "- Use long-term user memory (summary/assessment) only when relevant, not in every reply",
    "- Never request or repeat sensitive secrets such as passwords, API keys, or session cookies",
    "- If a diagram is needed, output only a ```mermaid fenced block",
    "- Never output raw Mermaid HTML/SVG (<div>, <svg>, style tags)",
    "- Keep answers practical and concise, ideally within three strong options",
    "",
    "[User profile]",
    profileSummary,
    "",
    "[Live weather context]",
    weatherSummary,
    "",
    "[Long-term user memory (internal)]",
    profileMemory,
    "",
    "[Saved memory]",
    input.memorySummary || "No summarized memory has been saved yet.",
  ].join("\n")
}

function buildProfileMemoryContext(input: {
  locale: ChatLocale
  summary: string | null
  assessment: string | null
}) {
  const summary = input.summary?.trim() || null
  const assessment = input.assessment?.trim() || null

  if (!summary && !assessment) {
    if (input.locale === "ko") return "아직 누적된 사용자 장기 메모리 없음"
    if (input.locale === "zh") return "暂无累积的用户长期记忆"
    if (input.locale === "ja") return "まだ累積されたユーザーの長期記憶はありません"
    return "No long-term user memory available yet"
  }

  if (input.locale === "ko") {
    return [`요약: ${summary || "-"}`, `평가: ${assessment || "-"}`].join("\n")
  }
  if (input.locale === "zh") {
    return [`摘要: ${summary || "-"}`, `评估: ${assessment || "-"}`].join("\n")
  }
  if (input.locale === "ja") {
    return [`要約: ${summary || "-"}`, `評価: ${assessment || "-"}`].join("\n")
  }

  return [`Summary: ${summary || "-"}`, `Assessment: ${assessment || "-"}`].join("\n")
}

function buildWeatherSummary(
  weather: ChatWeatherContext | null,
  locale: ChatLocale
) {
  if (!weather) {
    if (locale === "ko") return "사용 가능한 실시간 날씨 컨텍스트 없음"
    if (locale === "zh") return "暂无实时天气信息"
    if (locale === "ja") return "利用可能なリアルタイム天気情報はありません"
    return "No live weather context available"
  }

  const raining = (b: boolean) => {
    if (locale === "zh") return b ? "是" : "否"
    if (locale === "ja") return b ? "はい" : "いいえ"
    return locale === "ko" ? (b ? "예" : "아니오") : (b ? "yes" : "no")
  }
  const severe = (b: boolean) => {
    if (locale === "zh") return b ? "有" : "无"
    if (locale === "ja") return b ? "あり" : "なし"
    return locale === "ko" ? (b ? "있음" : "없음") : (b ? "present" : "none")
  }

  const labels = getWeatherLabels(locale)

  return [
    `${labels.region}: ${weather.region || "-"}`,
    `${labels.score}: ${weather.score ?? "-"}`,
    `${labels.status}: ${weather.status || "-"}`,
    `${labels.tempFeels}: ${weather.temperatureC ?? "-"}°C / ${weather.feelsLikeC ?? "-"}°C`,
    `${labels.humidityWind}: ${weather.humidityPct ?? "-"}% / ${weather.windMs ?? "-"}m/s`,
    `${labels.airQuality}: ${weather.pm10 ?? "-"} / ${weather.pm25 ?? "-"}`,
    `${labels.uv}: ${weather.uvLabel || "-"}`,
    `${labels.rainingNow}: ${raining(weather.rainingNow)}`,
    `${labels.severeAlert}: ${severe(weather.severeAlert)}`,
    `${labels.hazardTags}: ${weather.hazardTags.length > 0 ? weather.hazardTags.join(", ") : "-"}`,
    `${labels.briefing}: ${weather.bulletin || "-"}`,
    `${labels.observedAt}: ${weather.observedAt || "-"}`,
  ].join("\n")
}

function getWeatherLabels(locale: ChatLocale) {
  if (locale === "ko") return {
    region: "지역", score: "피크닉 지수", status: "현재 상태",
    tempFeels: "기온/체감", humidityWind: "습도/풍속", airQuality: "대기질(PM10/PM2.5)",
    uv: "자외선", rainingNow: "강수 여부", severeAlert: "특보/위험 여부",
    hazardTags: "위험 태그", briefing: "브리핑", observedAt: "관측 시각",
  }
  if (locale === "zh") return {
    region: "地区", score: "出行指数", status: "当前状态",
    tempFeels: "气温/体感", humidityWind: "湿度/风速", airQuality: "空气质量(PM10/PM2.5)",
    uv: "紫外线", rainingNow: "是否下雨", severeAlert: "警报/危险",
    hazardTags: "危险标签", briefing: "简报", observedAt: "观测时间",
  }
  if (locale === "ja") return {
    region: "地域", score: "お出かけ指数", status: "現在の状態",
    tempFeels: "気温/体感", humidityWind: "湿度/風速", airQuality: "大気質(PM10/PM2.5)",
    uv: "紫外線", rainingNow: "降水の有無", severeAlert: "警報/危険の有無",
    hazardTags: "危険タグ", briefing: "ブリーフィング", observedAt: "観測時刻",
  }
  return {
    region: "Region", score: "Picnic score", status: "Status",
    tempFeels: "Temp/Feels like", humidityWind: "Humidity/Wind", airQuality: "Air quality (PM10/PM2.5)",
    uv: "UV", rainingNow: "Raining now", severeAlert: "Severe alerts",
    hazardTags: "Hazard tags", briefing: "Briefing", observedAt: "Observed at",
  }
}

export function buildSummaryPrompt(input: {
  locale: ChatLocale
  existingSummary: string | null
  messages: ChatConversationMessage[]
}) {
  const transcript = input.messages
    .map((message) => `${message.role === "user" ? "USER" : "ASSISTANT"}: ${message.content}`)
    .join("\n")

  if (input.locale === "ko") {
    return [
      "아래 기존 메모리와 대화 기록을 읽고, 이후 응답에 필요한 핵심 정보만 갱신된 메모리로 요약하세요.",
      "규칙:",
      "- 8줄 이내의 짧은 불릿 또는 짧은 문단 형태",
      "- 사용자의 안정적인 취향, 선호 시간대, 계획 중인 일정, 피해야 할 조건만 남길 것",
      "- 비밀번호, 키, 연락처 등 민감정보는 절대 쓰지 말 것",
      "- 중복 표현을 줄이고 다음 대화에 바로 쓰기 좋게 정리할 것",
      "",
      "[기존 메모리]",
      input.existingSummary || "없음",
      "",
      "[새 대화 기록]",
      transcript || "없음",
    ].join("\n")
  }

  if (input.locale === "zh") {
    return [
      "读取以下已有记忆和对话记录，仅保留后续回复所需的关键信息，生成更新后的记忆摘要。",
      "规则:",
      "- 8行以内的简短要点或短段落",
      "- 仅保留用户的稳定偏好、时间偏好、计划中的日程、需要避免的条件",
      "- 绝不包含密码、密钥、联系方式等敏感信息",
      "- 减少重复信息，整理成适合下次对话直接使用的形式",
      "",
      "[已有记忆]",
      input.existingSummary || "无",
      "",
      "[新对话记录]",
      transcript || "无",
    ].join("\n")
  }

  if (input.locale === "ja") {
    return [
      "以下の既存メモリと会話記録を読み、今後の応答に必要な核心情報だけを更新されたメモリとして要約してください。",
      "ルール:",
      "- 8行以内の短いブリットまたは短い段落形式",
      "- ユーザーの安定した好み、希望時間帯、計画中の予定、避けるべき条件のみを残す",
      "- パスワード、キー、連絡先などの機密情報は絶対に含めない",
      "- 重複を減らし、次の会話ですぐに使える形に整理する",
      "",
      "[既存メモリ]",
      input.existingSummary || "なし",
      "",
      "[新しい会話記録]",
      transcript || "なし",
    ].join("\n")
  }

  return [
    "Read the existing memory and the conversation transcript, then produce a refreshed memory summary for future turns.",
    "Rules:",
    "- Keep it within 8 short bullets or brief compact paragraphs",
    "- Retain only durable preferences, active plans, constraints, and useful context",
    "- Never include passwords, keys, contact details, or similar secrets",
    "- Remove repetition and write for efficient future prompting",
    "",
    "[Existing memory]",
    input.existingSummary || "None",
    "",
    "[New transcript]",
    transcript || "None",
  ].join("\n")
}

export function buildProfileMemoryPrompt(input: {
  locale: ChatLocale
  existingSummary: string | null
  existingAssessment: string | null
  messages: ChatConversationMessage[]
}) {
  const transcript = input.messages
    .map((message) => `${message.role === "user" ? "USER" : "ASSISTANT"}: ${message.content}`)
    .join("\n")

  if (input.locale === "ko") {
    return [
      "아래 기존 사용자 메모리와 새 사용자 발화를 바탕으로 내부 개인화 메모리를 갱신하세요.",
      "규칙:",
      "- 반드시 JSON 객체만 출력: {\"summary\":\"...\",\"assessment\":\"...\"}",
      "- summary: 향후 추천에 유효한 장기 선호/제약/패턴 중심으로 6줄 이내",
      "- assessment: 말투/결정 성향/선호 강도 등 내부 해석을 4줄 이내",
      "- 불필요한 세부 일정 원문 복붙 금지, 민감정보/비밀정보 포함 금지",
      "- 이후 답변에서 항상 언급할 필요는 없고 필요한 경우에만 참고 가능한 형태로 압축",
      "",
      "[기존 summary]",
      input.existingSummary || "없음",
      "",
      "[기존 assessment]",
      input.existingAssessment || "없음",
      "",
      "[새 사용자 발화]",
      transcript || "없음",
    ].join("\n")
  }

  if (input.locale === "zh") {
    return [
      "根据以下已有用户记忆和新的用户发言，更新内部个性化记忆。",
      "规则:",
      "- 必须仅输出JSON对象: {\"summary\":\"...\",\"assessment\":\"...\"}",
      "- summary: 以对未来推荐有用的长期偏好/限制/模式为核心，6行以内",
      "- assessment: 语气/决策倾向/偏好强度等内部解读，4行以内",
      "- 禁止复制粘贴无关的原始日程，禁止包含敏感信息",
      "- 压缩为仅在必要时参考的形式，无需每次都提及",
      "",
      "[已有 summary]",
      input.existingSummary || "无",
      "",
      "[已有 assessment]",
      input.existingAssessment || "无",
      "",
      "[新用户发言]",
      transcript || "无",
    ].join("\n")
  }

  if (input.locale === "ja") {
    return [
      "以下の既存ユーザーメモリと新しいユーザー発話に基づいて、内部パーソナライズメモリを更新してください。",
      "ルール:",
      "- 必ずJSONオブジェクトのみを出力: {\"summary\":\"...\",\"assessment\":\"...\"}",
      "- summary: 今後の提案に有効な長期の好み/制約/パターンを中心に6行以内",
      "- assessment: 話し方/決定傾向/好みの強さなどの内部解釈を4行以内",
      "- 不要な詳細スケジュールのコピペ禁止、機密情報の含有禁止",
      "- 常に言及する必要はなく、必要なときにだけ参考にできる形に圧縮",
      "",
      "[既存 summary]",
      input.existingSummary || "なし",
      "",
      "[既存 assessment]",
      input.existingAssessment || "なし",
      "",
      "[新しいユーザー発話]",
      transcript || "なし",
    ].join("\n")
  }

  return [
    "Refresh internal personalization memory using the existing memory and new user utterances.",
    "Rules:",
    "- Output JSON only: {\"summary\":\"...\",\"assessment\":\"...\"}",
    "- summary: durable preferences/constraints/patterns for future planning, within 6 short lines",
    "- assessment: concise interpretation of tone/decision style/preference strength, within 4 lines",
    "- Avoid raw transcript dumping and never include secrets or sensitive personal data",
    "- This memory is for selective use; it should not force weather or profile mentions every turn",
    "",
    "[Existing summary]",
    input.existingSummary || "None",
    "",
    "[Existing assessment]",
    input.existingAssessment || "None",
    "",
    "[New user utterances]",
    transcript || "None",
  ].join("\n")
}
