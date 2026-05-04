/**
 * Type definitions for the chat module.
 *
 * This module defines the shape of all data objects flowing through the
 * dashboard chat feature: messages, sessions, memory, usage tracking,
 * policy metadata, and the top-level state response returned to the UI.
 */

/** Supported UI locales for the chat copilot */
export type ChatLocale = "ko" | "en" | "zh" | "ja"
/** Message author: the logged-in user ("user") or the LLM ("assistant") */
export type ChatMessageRole = "user" | "assistant"
/** Kind of LLM request: regular "chat" or internal "summary" compaction */
export type ChatRequestKind = "chat" | "summary"
/** Outcome of an LLM request event */
export type ChatRequestStatus = "success" | "provider_error" | "rate_limited" | "validation_error"

/** A single message in a chat conversation, as returned to the frontend */
export interface ChatConversationMessage {
  id: string
  role: ChatMessageRole
  content: string
  createdAt: string
  resolvedModel: string | null
}

/** Compacted memory summary for a session or the user's long-term profile */
export interface ChatMemorySnapshot {
  summary: string
  updatedAt: string
  summarizedMessageCount: number
  modelUsed: string | null
}

/** A chat session as listed in the sidebar, with summary metadata */
export interface ChatSessionSnapshot {
  id: string
  title: string
  locale: ChatLocale
  isAutoTitle: boolean
  messageCount: number
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
}

/** Daily usage and rate-limit snapshot for the current user */
export interface ChatUsageSnapshot {
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

/** Policy constraints returned to the frontend for client-side enforcement */
export interface ChatPolicySnapshot {
  dailyLimit: number
  maxInputCharacters: number
  resetTimeZone: string
}

/** Full chat state payload returned by the chat state endpoint */
export interface ChatStateResponse {
  messages: ChatConversationMessage[]
  memory: ChatMemorySnapshot | null
  usage: ChatUsageSnapshot
  policy: ChatPolicySnapshot
  sessions: ChatSessionSnapshot[]
  activeSessionId: string
}

export { type LlmUsage as FactChatUsage, type LlmCompletionResult as FactChatCompletionResult } from "@/lib/llm/types"
