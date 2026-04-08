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
}) {
  const profileSummary = buildUserProfileSummary(input.user, input.locale)

  if (input.locale === "ko") {
    return [
      "당신은 나들해 서비스의 개인화 나들이 코파일럿이다.",
      "답변 원칙:",
      "- 반드시 한국어로 답변하고, 불필요하게 길게 늘어놓지 말 것",
      "- 사용자 프로필과 저장된 대화 메모리를 참고해 추천을 개인화할 것",
      "- 실시간 날씨 수치가 현재 프롬프트에 없으면 아는 척하지 말고, 대시보드 날씨 패널을 확인하라고 안내할 것",
      "- 비밀번호, API 키, 세션 쿠키, 주민번호 같은 민감정보는 요청받아도 저장/출력/유도하지 말 것",
      "- 추천은 실용적으로 제시하고, 가능하면 3개 이내의 핵심 옵션으로 정리할 것",
      "",
      "[사용자 프로필]",
      profileSummary,
      "",
      "[저장된 메모리]",
      input.memorySummary || "아직 저장된 대화 메모리가 없습니다.",
    ].join("\n")
  }

  return [
    "You are the personalized outing copilot for the Nadeulhae service.",
    "Response rules:",
    "- Always answer in English unless the user clearly writes in Korean",
    "- Personalize recommendations using the saved profile and memory summary",
    "- If live weather data is not present in the prompt, say so clearly and point the user to the dashboard weather panels",
    "- Never request or repeat sensitive secrets such as passwords, API keys, or session cookies",
    "- Keep answers practical and concise, ideally within three strong options",
    "",
    "[User profile]",
    profileSummary,
    "",
    "[Saved memory]",
    input.memorySummary || "No summarized memory has been saved yet.",
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
