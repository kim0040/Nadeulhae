/**
 * One-time handoff between the algorithm study path and Lab AI Chat.
 * This stays browser-only at the call sites and never triggers a model request.
 */

export const LAB_AI_CHAT_STUDY_DRAFT_STORAGE_KEY = "nadeulhae:lab-ai-chat:study-draft:v1"
export const LAB_AI_CHAT_STUDY_DRAFT_MAX_AGE_MS = 15 * 60 * 1000

type StudyDraftPayload = {
  message: string
  createdAt: number
}

export function saveLabAiChatStudyDraft(storage: Storage, message: string) {
  const normalized = message.trim().slice(0, 12_000)
  if (!normalized) return

  const payload: StudyDraftPayload = {
    message: normalized,
    createdAt: Date.now(),
  }
  storage.setItem(LAB_AI_CHAT_STUDY_DRAFT_STORAGE_KEY, JSON.stringify(payload))
}

export function takeLabAiChatStudyDraft(storage: Storage) {
  const raw = storage.getItem(LAB_AI_CHAT_STUDY_DRAFT_STORAGE_KEY)
  storage.removeItem(LAB_AI_CHAT_STUDY_DRAFT_STORAGE_KEY)
  if (!raw) return null

  try {
    const payload = JSON.parse(raw) as Partial<StudyDraftPayload>
    if (
      typeof payload.message !== "string"
      || typeof payload.createdAt !== "number"
      || !Number.isFinite(payload.createdAt)
      || Date.now() - payload.createdAt > LAB_AI_CHAT_STUDY_DRAFT_MAX_AGE_MS
    ) {
      return null
    }

    return payload.message.trim().slice(0, 12_000) || null
  } catch {
    return null
  }
}
