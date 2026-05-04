/** Lab AI Chat — type definitions for session state, usage, web search, and model options. */

export type LabAiChatLocale = "ko" | "en" | "zh" | "ja"
export type LabAiChatMessageRole = "user" | "assistant"
export type LabAiChatRequestKind = "chat" | "summary"
export type LabAiChatRequestStatus = "success" | "provider_error" | "rate_limited" | "validation_error"

/** A single message in the conversation visible to the user. */
export interface LabAiChatConversationMessage {
  id: string
  role: LabAiChatMessageRole
  content: string
  createdAt: string
  resolvedModel: string | null
}

/** Summarised memory snapshot for a session — used to inject into the system prompt. */
export interface LabAiChatMemorySnapshot {
  summary: string
  updatedAt: string
  summarizedMessageCount: number
  modelUsed: string | null
}

/** Summary of a single session for the session-list sidebar. */
export interface LabAiChatSessionSnapshot {
  id: string
  title: string
  locale: LabAiChatLocale
  messageCount: number
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
}

/** Daily usage snapshot: how many requests used / remaining against the daily limit. */
export interface LabAiChatUsageSnapshot {
  metricDate: string
  requestCount: number
  remainingRequests: number
  dailyLimit: number
  successCount: number
  failureCount: number
  summaryCount: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cachedPromptTokens: number
  summaryPromptTokens: number
  summaryCompletionTokens: number
  summaryTotalTokens: number
}

/** Read-only policy limits exposed to the client for UI hints. */
export interface LabAiChatPolicySnapshot {
  dailyLimit: number
  maxInputCharacters: number
  resetTimeZone: string
}

/** Web-search quota + cache availability for the current session/month. */
export interface LabAiChatWebSearchSnapshot {
  sessionLimit: number
  sessionUsed: number
  sessionRemaining: number
  primaryLimit: number
  primaryUsed: number
  primaryRemaining: number
  fallbackLimit: number
  fallbackUsed: number
  fallbackRemaining: number
  monthLimit: number
  monthUsed: number
  monthRemaining: number
  cacheAvailable: boolean
  cacheQuery: string | null
  cacheUpdatedAt: string | null
}

/** A model choice the user can pick from in the chat UI. */
export interface LabAiChatModelOption {
  id: string
  slug: string
  label: string
  description: string
  warning?: string
  thinkingId?: string
  thinkingWarning?: string
}

/** The minimum server-side state needed to render the chat page. */
export interface LabAiChatStateCore {
  messages: LabAiChatConversationMessage[]
  memory: LabAiChatMemorySnapshot | null
  usage: LabAiChatUsageSnapshot
  policy: LabAiChatPolicySnapshot
  webSearch: LabAiChatWebSearchSnapshot
  sessions: LabAiChatSessionSnapshot[]
  activeSessionId: string
}

/** Full chat-page response: core state + model list. */
export interface LabAiChatStateResponse extends LabAiChatStateCore {
  models: LabAiChatModelOption[]
  defaultModelId: string
}

export { type LlmUsage as NanoGptUsage, type LlmCompletionResult as NanoGptCompletionResult } from "@/lib/llm/types"
