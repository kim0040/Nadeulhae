/** Lab LLM prompt templates — builds system/user prompts for card generation and card autofill. */

import type { AuthUser } from "@/lib/auth/types"
import type { LabLocale } from "@/lib/lab/types"

/** Build prompts for generating a full deck of study cards from a topic. Returns system and user prompt strings. */
export function buildLabGenerationPrompts(input: {
  locale: LabLocale
  user: AuthUser
  topic: string
  cardCount: number
}) {
  // Locale-specific language instruction for the LLM
  const languageGuide = input.locale === "ko"
    ? "설명(meaning)은 한국어로 작성하고, 단어(term)는 학습하기 좋은 원문 형태로 간결하게 작성해. 그리고 반드시 exampleTranslation 필드에 예문에 대한 한국어 해설(번역)을 적어줘."
    : "Write meanings in English, keep term as a concise practical word, and MUST include the explanation of the example in the exampleTranslation field."

  // Current time in KST for context-aware card generation
  const now = new Date()
  const systemNowKst = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "numeric", minute: "numeric"
  }).format(now)
  const systemNowKstIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now)

  // System prompt: instructs the model on output format, constraints, and language rules
  const systemPrompt = [
    "You are Nadeul Lab, an assistant that creates practical mini study cards.",
    "Return ONLY valid JSON. No markdown, no code fences, no extra prose.",
    "JSON schema:",
    '{"title":"string","cards":[{"term":"string","meaning":"string","partOfSpeech":"string","example":"string","exampleTranslation":"string"}]}',
    `cards length must be between ${Math.max(4, input.cardCount - 1)} and ${input.cardCount}.`,
    "Each term should be short (max 24 chars when possible).",
    "Each meaning should be clear and concrete.",
    "Each example should be one sentence only.",
    "Each exampleTranslation MUST be an accurate explanation or translation of the example sentence.",
    "The partOfSpeech field must contain the word's grammatical category (e.g., noun, verb, 名詞, n. etc.) appropriate for the language.",
    languageGuide,
    `[System Time (KST)]\nToday: ${systemNowKstIso}\n${systemNowKst}`,
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
        "날씨/나들이 상황에 적용 가능한 실전 단어 위주로 구성해줘.",
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

/** Build prompts for autofilling a single existing card (meaning, example, POS). Returns system and user prompt strings. */
export function buildLabCardAutofillPrompts(input: {
  locale: LabLocale
  user: AuthUser
  term: string
  exampleLanguage?: "ko" | "en" | "ja"
}) {
  // Default example language follows the card locale
  const exampleLanguage = input.exampleLanguage ?? (input.locale === "en" ? "en" : "ko")
  const meaningLanguageInstruction =
    input.locale === "ko"
      ? "meaning은 한국어로 작성하세요."
      : "Write meaning in English."
  const exampleLanguageInstruction =
    exampleLanguage === "ja"
      ? "Write example in Japanese."
      : exampleLanguage === "en"
        ? "Write example in English."
        : "example은 한국어로 작성하세요."

  const systemPrompt = [
    "You are Nadeul Lab card assistant.",
    "Return ONLY valid JSON. No markdown, no code fences, no extra prose.",
    "JSON schema:",
    '{"meaning":"string","partOfSpeech":"string","example":"string","exampleTranslation":"string"}',
    meaningLanguageInstruction,
    exampleLanguageInstruction,
    "exampleTranslation MUST be an accurate explanation or translation of the example sentence.",
    "Keep output short and practical for everyday outdoor contexts.",
  ].join("\n")

  const profileSummary = input.locale === "ko"
    ? [
        `사용자 지역: ${input.user.primaryRegion}`,
        `관심사: ${input.user.interestTags.join(", ") || "없음"}`,
      ].join("\n")
    : [
        `Region: ${input.user.primaryRegion}`,
        `Interests: ${input.user.interestTags.join(", ") || "none"}`,
      ].join("\n")

  const userPrompt = input.locale === "ko"
    ? [
        "아래 단어를 단어장 카드용으로 보강해 주세요.",
        `term: ${input.term}`,
        `example_language: ${exampleLanguage}`,
        profileSummary,
        "meaning은 짧고 명확하게, example은 한 문장으로 써 주세요.",
      ].join("\n")
    : [
        "Enrich this term for a vocabulary card.",
        `term: ${input.term}`,
        `example_language: ${exampleLanguage}`,
        profileSummary,
        "Keep meaning concise and example to a single sentence.",
      ].join("\n")

  return {
    systemPrompt,
    userPrompt,
  }
}
