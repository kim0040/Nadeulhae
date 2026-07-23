import assert from "node:assert/strict"

import {
  LAB_AI_CHAT_STUDY_DRAFT_STORAGE_KEY,
  saveLabAiChatStudyDraft,
  takeLabAiChatStudyDraft,
} from "@/lib/lab-ai-chat/study-draft"

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const storage = new MemoryStorage()

saveLabAiChatStudyDraft(storage, "  BFS의 방문 처리 시점을 설명해줘.  ")
assert.equal(takeLabAiChatStudyDraft(storage), "BFS의 방문 처리 시점을 설명해줘.")
assert.equal(storage.getItem(LAB_AI_CHAT_STUDY_DRAFT_STORAGE_KEY), null)

storage.setItem(LAB_AI_CHAT_STUDY_DRAFT_STORAGE_KEY, JSON.stringify({
  message: "오래된 학습 초안",
  createdAt: Date.now() - (16 * 60 * 1000),
}))
assert.equal(takeLabAiChatStudyDraft(storage), null)

storage.setItem(LAB_AI_CHAT_STUDY_DRAFT_STORAGE_KEY, "not-json")
assert.equal(takeLabAiChatStudyDraft(storage), null)

console.log("Lab study draft handoff checks passed")
