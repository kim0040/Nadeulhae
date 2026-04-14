import type { AuthUser } from "@/lib/auth/types"
import type { LabLocale } from "@/lib/lab/types"

export function buildLabGenerationPrompts(input: {
  locale: LabLocale
  user: AuthUser
  topic: string
  cardCount: number
}) {
  const languageGuide = input.locale === "ko"
    ? "설명과 뜻은 한국어 중심으로 작성하되, 표현(term)은 학습하기 좋은 원문 형태로 간결하게 작성해."
    : "Write meanings and tips in English, and keep term as a concise practical expression."

  const systemPrompt = [
    "You are Nadeul Lab, an assistant that creates practical mini study cards.",
    "Return ONLY valid JSON. No markdown, no code fences, no extra prose.",
    "JSON schema:",
    '{"title":"string","cards":[{"term":"string","meaning":"string","example":"string","tip":"string"}]}',
    `cards length must be between ${Math.max(4, input.cardCount - 1)} and ${input.cardCount}.`,
    "Each term should be short (max 24 chars when possible).",
    "Each meaning should be clear and concrete.",
    "Each example should be one sentence only.",
    "Each tip should be one short actionable sentence.",
    languageGuide,
  ].join("\n")

  const profileSummary = input.locale === "ko"
    ? [
        `사용자 지역: ${input.user.primaryRegion}`,
        `관심사: ${input.user.interestTags.join(", ") || "없음"}`,
        `선호 시간대: ${input.user.preferredTimeSlot}`,
      ].join("\n")
    : [
        `Region: ${input.user.primaryRegion}`,
        `Interests: ${input.user.interestTags.join(", ") || "none"}`,
        `Preferred time slot: ${input.user.preferredTimeSlot}`,
      ].join("\n")

  const userPrompt = input.locale === "ko"
    ? [
        "아래 조건으로 실험실 학습 카드를 만들어줘.",
        `주제: ${input.topic}`,
        `카드 수: ${input.cardCount}`,
        profileSummary,
        "날씨/나들이 상황에 적용 가능한 실전 표현 위주로 구성해줘.",
      ].join("\n")
    : [
        "Create lab learning cards with the following constraints.",
        `Topic: ${input.topic}`,
        `Card count: ${input.cardCount}`,
        profileSummary,
        "Prioritize practical expressions that can be used in outing and weather contexts.",
      ].join("\n")

  return {
    systemPrompt,
    userPrompt,
  }
}
