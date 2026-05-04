/**
 * Core TypeScript types for the LLM subsystem.
 *
 * Defines the shapes of completion results, model options, API configuration,
 * token usage tracking, and request kind categories used across the
 * general-purpose, lab, and OpenAI-compatible API clients.
 */

/** Token usage statistics for an LLM completion. Includes cached token counts for providers that expose them. */
export interface LlmUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cachedPromptTokens: number
}

/** Standardised result shape returned by all LLM completion functions (both streaming and non-streaming). */
export interface LlmCompletionResult {
  providerRequestId: string | null
  requestedModel: string | null
  resolvedModel: string | null
  content: string
  finishReason: string | null
  usage: LlmUsage
}

/** Describes an LLM model available in the lab chat, with display metadata and an optional thinking/reasoning variant. */
export interface LlmModelOption {
  id: string
  slug: string
  label: string
  description: string
  warning?: string
  thinkingId?: string
  thinkingWarning?: string
}

/** Configuration required to connect to an OpenAI-compatible LLM API provider. */
export interface LlmConfig {
  apiKey: string
  baseUrl: string
  model: string
  fallbackModel?: string
  maxTokens?: number
}

/** Categorises an LLM request as a regular chat interaction or a content summarisation task. */
export type LlmRequestKind = "chat" | "summary"
