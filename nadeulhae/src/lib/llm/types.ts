export interface LlmUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cachedPromptTokens: number
}

export interface LlmCompletionResult {
  providerRequestId: string | null
  requestedModel: string | null
  resolvedModel: string | null
  content: string
  finishReason: string | null
  usage: LlmUsage
}

export interface LlmModelOption {
  id: string
  slug: string
  label: string
  description: string
  warning?: string
  thinkingId?: string
  thinkingWarning?: string
}

export interface LlmConfig {
  apiKey: string
  baseUrl: string
  model: string
  fallbackModel?: string
  maxTokens?: number
}

export type LlmRequestKind = "chat" | "summary"
