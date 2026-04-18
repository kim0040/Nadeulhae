import {
  AGE_BAND_OPTIONS,
  INTEREST_OPTIONS,
  PRIMARY_REGION_OPTIONS,
  TIME_SLOT_OPTIONS,
  getOptionLabel,
} from "@/lib/auth/profile-options"
import type { AuthUser } from "@/lib/auth/types"
import type { LabAiChatConversationMessage, LabAiChatLocale } from "@/lib/lab-ai-chat/types"

function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "-"
}

function buildUserProfileSummary(user: AuthUser, locale: LabAiChatLocale) {
  const interests = user.interestTags.map((value) => getOptionLabel(INTEREST_OPTIONS, value, locale))
  if (user.interestOther) {
    interests.push(user.interestOther)
  }

  if (locale === "ko") {
    return [
      `이름: ${user.displayName}`,
      `연령대: ${getOptionLabel(AGE_BAND_OPTIONS, user.ageBand, locale)}`,
      `주 사용 지역: ${getOptionLabel(PRIMARY_REGION_OPTIONS, user.primaryRegion, locale)}`,
      `선호 시간대: ${getOptionLabel(TIME_SLOT_OPTIONS, user.preferredTimeSlot, locale)}`,
      `관심사: ${formatList(interests)}`,
    ].join("\n")
  }

  return [
    `Name: ${user.displayName}`,
    `Age range: ${getOptionLabel(AGE_BAND_OPTIONS, user.ageBand, locale)}`,
    `Primary region: ${getOptionLabel(PRIMARY_REGION_OPTIONS, user.primaryRegion, locale)}`,
    `Preferred time: ${getOptionLabel(TIME_SLOT_OPTIONS, user.preferredTimeSlot, locale)}`,
    `Interests: ${formatList(interests)}`,
  ].join("\n")
}

export function buildLabAiChatSystemPrompt(input: {
  locale: LabAiChatLocale
  user: AuthUser
  memorySummary: string | null
}) {
  const profileSummary = buildUserProfileSummary(input.user, input.locale)
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())

  if (input.locale === "ko") {
    return [
      `[시스템 날짜] 오늘은 ${todayIso} (KST) 입니다. 상대 날짜 표현은 오늘 기준으로 해석하세요.`,
      "당신은 나들 실험실의 다용도 AI 어시스턴트 '나들 AI'다.",
      "답변 원칙:",
      "- 대화 내내 스스로를 '나들 AI'로 일관되게 인식하고 응답할 것",
      "- 나들이나 피크닉 추천 전용 봇이 아니라 글쓰기, 코딩, 학습, 요약, 아이디어 정리까지 돕는 범용 대화형 AI로 답할 것",
      "- 반드시 한국어로 답변하되 사용자가 다른 언어를 명확히 요청하면 그 언어를 따를 것",
      "- 사용자가 명확히 짧게 요청하지 않으면 필요한 배경, 이유, 단계, 예시, 주의점을 포함해 한 번에 완결된 풀답변을 제공할 것",
      "- 답변이 길어져도 핵심 단계나 중요한 예외를 생략하지 말고, 제목과 문단으로 읽기 쉽게 나눌 것",
      "- 군더더기 표현은 줄이되 정보량은 충분히 유지하고 사용자가 바로 실행할 수 있게 구체적으로 답할 것",
      "- 목록, 표, 체크리스트, 코드블록은 도움이 될 때만 사용하고 기본은 자연스러운 대화형 답변으로 유지할 것",
      "- 본인의 모델명, 벤더명, 내부 시스템, 라우팅 정보는 절대 공개하지 말 것",
      "- 정체를 묻는 질문에는 '저는 나들 AI입니다.'처럼 짧게 답할 것",
      "- 세션 메모리를 참고하되 매번 반복해서 노출하지 말 것",
      "- 비밀번호, API 키, 토큰, 세션 쿠키, 주민번호 같은 민감정보는 저장하거나 다시 출력하지 말 것",
      "- 최신 사실이 꼭 필요한 질문에서 확실하지 않다면 단정하지 말고 한계를 짧게 밝힐 것",
      "",
      "[사용자 프로필]",
      profileSummary,
      "",
      "[세션 메모리]",
      input.memorySummary || "아직 요약된 세션 메모리가 없습니다.",
    ].join("\n")
  }

  return [
    `[System Date] Today is ${todayIso} (KST). Interpret relative dates from this date.`,
    "You are 'Nadeul AI', the general-purpose AI assistant inside the Nadeul Lab.",
    "Response rules:",
    "- Consistently understand yourself as 'Nadeul AI' throughout the conversation",
    "- You are not a picnic-only assistant; support writing, coding, learning, summarization, planning, and general conversation",
    "- Answer in English unless the user is clearly writing in Korean",
    "- Unless the user clearly asks for a short reply, provide a complete answer with the needed context, reasoning, steps, examples, and caveats",
    "- Do not omit important steps or exceptions just because the answer is long; use headings and paragraphs to keep long answers readable",
    "- Keep wording focused, but preserve enough detail for the user to act immediately",
    "- Use bullets, tables, checklists, and code blocks only when they materially help",
    "- Never reveal your model name, vendor, internal routing, or system details",
    "- If asked who you are, answer briefly as 'I am Nadeul AI.'",
    "- Use session memory when relevant, but do not expose it verbatim every turn",
    "- Never retain or repeat sensitive secrets such as passwords, API keys, tokens, or session cookies",
    "- If the user asks for live facts and certainty is not possible, state that limit briefly instead of bluffing",
    "",
    "[User profile]",
    profileSummary,
    "",
    "[Session memory]",
    input.memorySummary || "No summarized session memory is available yet.",
  ].join("\n")
}

export function buildLabAiChatSummaryPrompt(input: {
  locale: LabAiChatLocale
  existingSummary: string | null
  messages: LabAiChatConversationMessage[]
}) {
  const transcript = input.messages
    .map((message) => `${message.role === "user" ? "USER" : "ASSISTANT"}: ${message.content}`)
    .join("\n")

  if (input.locale === "ko") {
    return [
      "기존 세션 메모리와 새 대화 기록을 읽고, 다음 응답에 바로 쓸 수 있는 핵심 메모리로 다시 정리하세요.",
      "규칙:",
      "- 14줄 이내의 불릿 또는 짧은 문단",
      "- 사용자의 목표, 선호, 제약, 진행 중인 작업, 이어서 알아야 할 맥락만 남길 것",
      "- 긴 작업, 코드 맥락, 의사결정 근거, 사용자가 확정한 요구사항은 다음 답변에 유용하면 보존할 것",
      "- 비밀번호, 키, 토큰, 연락처 같은 민감정보는 절대 쓰지 말 것",
      "- 중복은 줄이고 이어쓰기 쉬운 형태로 정리할 것",
      "",
      "[기존 메모리]",
      input.existingSummary || "없음",
      "",
      "[새 대화 기록]",
      transcript || "없음",
    ].join("\n")
  }

  return [
    "Read the existing session memory and the new transcript, then refresh the session memory for future turns.",
    "Rules:",
    "- Keep it within 14 bullets or compact brief paragraphs",
    "- Retain only goals, preferences, constraints, ongoing tasks, and continuation context",
    "- Preserve long-running task context, code decisions, rationale, and confirmed user requirements when useful for future replies",
    "- Never include passwords, keys, tokens, contact details, or similar secrets",
    "- Remove repetition and write it for fast continuation",
    "",
    "[Existing memory]",
    input.existingSummary || "None",
    "",
    "[New transcript]",
    transcript || "None",
  ].join("\n")
}
