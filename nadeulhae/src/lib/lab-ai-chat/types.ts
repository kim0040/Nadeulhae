export type LabAiChatLocale = "ko" | "en"
export type LabAiChatMessageRole = "user" | "assistant"
export type LabAiChatRequestKind = "chat" | "summary"
export type LabAiChatRequestStatus = "success" | "provider_error" | "rate_limited" | "validation_error"

export interface LabAiChatConversationMessage {
  id: string
  role: LabAiChatMessageRole
  content: string
  createdAt: string
  resolvedModel: string | null
}

export interface LabAiChatMemorySnapshot {
  summary: string
  updatedAt: string
  summarizedMessageCount: number
  modelUsed: string | null
}

export interface LabAiChatSessionSnapshot {
  id: string
  title: string
  locale: LabAiChatLocale
  messageCount: number
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
}

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

export interface LabAiChatPolicySnapshot {
  dailyLimit: number
  maxInputCharacters: number
  resetTimeZone: string
}

export interface LabAiChatWebSearchSnapshot {
  sessionLimit: number
  sessionUsed: number
  sessionRemaining: number
  monthLimit: number
  monthUsed: number
  monthRemaining: number
  cacheAvailable: boolean
  cacheQuery: string | null
  cacheUpdatedAt: string | null
}

export interface LabAiChatModelOption {
  id: string
  slug: string
  label: string
  description: string
  warning?: string
  thinkingId?: string
  thinkingWarning?: string
}

export interface LabAiChatStateCore {
  messages: LabAiChatConversationMessage[]
  memory: LabAiChatMemorySnapshot | null
  usage: LabAiChatUsageSnapshot
  policy: LabAiChatPolicySnapshot
  webSearch: LabAiChatWebSearchSnapshot
  sessions: LabAiChatSessionSnapshot[]
  activeSessionId: string
}

export interface LabAiChatStateResponse extends LabAiChatStateCore {
  models: LabAiChatModelOption[]
  defaultModelId: string
}

export interface NanoGptUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cachedPromptTokens: number
}

export interface NanoGptCompletionResult {
  providerRequestId: string | null
  requestedModel: string | null
  resolvedModel: string | null
  content: string
  finishReason: string | null
  usage: NanoGptUsage
}
