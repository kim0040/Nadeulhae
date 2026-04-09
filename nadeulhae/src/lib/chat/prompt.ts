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

  if (locale === "ko") {
    return [
      `이름: ${user.displayName}`,
      `연령대: ${getOptionLabel(AGE_BAND_OPTIONS, user.ageBand, locale)}`,
      `주 사용 지역: ${getOptionLabel(PRIMARY_REGION_OPTIONS, user.primaryRegion, locale)}`,
      `선호 시간대: ${getOptionLabel(TIME_SLOT_OPTIONS, user.preferredTimeSlot, locale)}`,
      `관심사: ${formatList(interests)}`,
      `민감한 날씨 요소: ${formatList(sensitivities)}`,
      `알림 수신 동의: ${user.marketingAccepted ? "예" : "아니오"}`,
    ].join("\n")
  }

  return [
    `Name: ${user.displayName}`,
    `Age range: ${getOptionLabel(AGE_BAND_OPTIONS, user.ageBand, locale)}`,
    `Primary region: ${getOptionLabel(PRIMARY_REGION_OPTIONS, user.primaryRegion, locale)}`,
    `Preferred time: ${getOptionLabel(TIME_SLOT_OPTIONS, user.preferredTimeSlot, locale)}`,
    `Interests: ${formatList(interests)}`,
    `Weather sensitivities: ${formatList(sensitivities)}`,
    `Marketing notices: ${user.marketingAccepted ? "enabled" : "disabled"}`,
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

  if (input.locale === "ko") {
    return [
      "당신은 나들해 서비스의 개인화 나들이 코파일럿이다.",
      "당신의 이름은 '나들이 메이트'다.",
      "답변 원칙:",
      "- 반드시 한국어로 답변하고, 불필요하게 길게 늘어놓지 말 것",
      "- 본인의 모델명, 벤더명, 내부 시스템 정보는 절대 공개하지 말 것",
      "- 정체를 묻는 질문에는 '저는 나들이 메이트입니다.'처럼 이름만 짧게 답할 것",
      "- 사용자 프로필과 저장된 대화 메모리를 참고해 추천을 개인화할 것",
      "- 실시간 날씨 컨텍스트가 있을 때는 '항상' 언급하지 말고, 일정 판단에 실제로 영향이 있을 때만 짧게 반영할 것",
      "- 비/강수 또는 특보 상황이면 실내·안전 동선을 우선 제시하고, 필요 시 대체안을 함께 제시할 것",
      "- 날씨 컨텍스트가 없으면 아는 척하지 말고, 필요한 경우에만 한 줄로 확인 질문할 것",
      "- 사용자 장기 메모리(요약/평가)는 필요할 때만 참고하고 매 답변마다 반복 노출하지 말 것",
      "- 비밀번호, API 키, 세션 쿠키, 주민번호 같은 민감정보는 요청받아도 저장/출력/유도하지 말 것",
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

  return [
    "You are the personalized outing copilot for the Nadeulhae service.",
    "Your assistant name is 'Nadeul Mate'.",
    "Response rules:",
    "- Always answer in English unless the user clearly writes in Korean",
    "- Never reveal your model name, provider, or internal system details",
    "- If asked who you are, answer briefly as 'I am Nadeul Mate.'",
    "- Personalize recommendations using the saved profile and memory summary",
    "- Do not mention weather in every response; only use it when it materially affects the plan",
    "- If rain or severe alerts are present, prioritize indoor/safety-first routes and include fallback options",
    "- If live weather context is missing, do not fabricate it; ask one concise clarification only when needed",
    "- Use long-term user memory (summary/assessment) only when relevant, not in every reply",
    "- Never request or repeat sensitive secrets such as passwords, API keys, or session cookies",
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
    return input.locale === "ko"
      ? "아직 누적된 사용자 장기 메모리 없음"
      : "No long-term user memory available yet"
  }

  if (input.locale === "ko") {
    return [
      `요약: ${summary || "-"}`,
      `평가: ${assessment || "-"}`,
    ].join("\n")
  }

  return [
    `Summary: ${summary || "-"}`,
    `Assessment: ${assessment || "-"}`,
  ].join("\n")
}

function buildWeatherSummary(
  weather: ChatWeatherContext | null,
  locale: ChatLocale
) {
  if (!weather) {
    return locale === "ko"
      ? "사용 가능한 실시간 날씨 컨텍스트 없음"
      : "No live weather context available"
  }

  if (locale === "ko") {
    return [
      `지역: ${weather.region || "-"}`,
      `피크닉 지수: ${weather.score ?? "-"}`,
      `현재 상태: ${weather.status || "-"}`,
      `기온/체감: ${weather.temperatureC ?? "-"}°C / ${weather.feelsLikeC ?? "-"}°C`,
      `습도/풍속: ${weather.humidityPct ?? "-"}% / ${weather.windMs ?? "-"}m/s`,
      `대기질(PM10/PM2.5): ${weather.pm10 ?? "-"} / ${weather.pm25 ?? "-"}`,
      `자외선: ${weather.uvLabel || "-"}`,
      `강수 여부: ${weather.rainingNow ? "예" : "아니오"}`,
      `특보/위험 여부: ${weather.severeAlert ? "있음" : "없음"}`,
      `위험 태그: ${weather.hazardTags.length > 0 ? weather.hazardTags.join(", ") : "-"}`,
      `브리핑: ${weather.bulletin || "-"}`,
      `관측 시각: ${weather.observedAt || "-"}`,
    ].join("\n")
  }

  return [
    `Region: ${weather.region || "-"}`,
    `Picnic score: ${weather.score ?? "-"}`,
    `Status: ${weather.status || "-"}`,
    `Temp/Feels like: ${weather.temperatureC ?? "-"}C / ${weather.feelsLikeC ?? "-"}C`,
    `Humidity/Wind: ${weather.humidityPct ?? "-"}% / ${weather.windMs ?? "-"}m/s`,
    `Air quality (PM10/PM2.5): ${weather.pm10 ?? "-"} / ${weather.pm25 ?? "-"}`,
    `UV: ${weather.uvLabel || "-"}`,
    `Raining now: ${weather.rainingNow ? "yes" : "no"}`,
    `Severe alerts: ${weather.severeAlert ? "present" : "none"}`,
    `Hazard tags: ${weather.hazardTags.length > 0 ? weather.hazardTags.join(", ") : "-"}`,
    `Briefing: ${weather.bulletin || "-"}`,
    `Observed at: ${weather.observedAt || "-"}`,
  ].join("\n")
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
