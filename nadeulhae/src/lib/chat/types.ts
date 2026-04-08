export type ChatLocale = "ko" | "en"
export type ChatMessageRole = "user" | "assistant"
export type ChatRequestKind = "chat" | "summary"
export type ChatRequestStatus = "success" | "provider_error" | "rate_limited" | "validation_error"

export interface ChatConversationMessage {
  id: string
  role: ChatMessageRole
  content: string
  createdAt: string
  resolvedModel: string | null
}

export interface ChatMemorySnapshot {
  summary: string
  updatedAt: string
  summarizedMessageCount: number
  modelUsed: string | null
}

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

export interface ChatPolicySnapshot {
  dailyLimit: number
  maxInputCharacters: number
  resetTimeZone: string
}

export interface ChatStateResponse {
  messages: ChatConversationMessage[]
  memory: ChatMemorySnapshot | null
  usage: ChatUsageSnapshot
  policy: ChatPolicySnapshot
}

export interface FactChatUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cachedPromptTokens: number
}

export interface FactChatCompletionResult {
  providerRequestId: string | null
  requestedModel: string | null
  resolvedModel: string | null
  content: string
  usage: FactChatUsage
}
