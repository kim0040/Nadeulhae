import type { LlmCompletionResult, LlmConfig } from "@/lib/llm/types"

export class OpenAiClientError extends Error {
  statusCode: number
  code: string | null

  constructor(message: string, statusCode: number, code?: string | null) {
    super(message)
    this.name = "OpenAiClientError"
    this.statusCode = statusCode
    this.code = code ?? null
  }
}

interface OpenAiErrorPayload {
  error?: {
    code?: string | number
    message?: string
  }
}

interface OpenAiModelPayload {
  data?: Array<{ id?: string }>
}

interface OpenAiCompletionPayload {
  id?: string
  model?: string
  choices?: Array<{
    finish_reason?: unknown
    message?: { content?: unknown; reasoning_content?: string }
    delta?: { content?: string; reasoning_content?: string }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    prompt_tokens_details?: { cached_tokens?: number }
    reasoning_tokens?: number
  }
}

function extractAssistantText(content: unknown) {
  if (typeof content === "string") {
    return content.trim()
  }
  if (Array.isArray(content)) {
    return content
      .flatMap((part) => {
        if (typeof part === "string") return [part]
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return [part.text]
        }
        return []
      })
      .join("\n")
      .trim()
  }
  return ""
}

function normalizeFinishReason(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.trim().length / 4))
}

function normalizeModelId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function buildUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
}

async function fetchJson<T>(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(input, { ...init, signal: controller.signal })
    const json = await response.json().catch(() => ({}))
    return { response, json: json as T }
  } finally {
    clearTimeout(timeout)
  }
}

export function pickModelCandidate(preferred: string | null, available: string[]) {
  if (!preferred) return null
  const exact = available.find((modelId) => modelId === preferred)
  if (exact) return exact
  const normalizedPreferred = normalizeModelId(preferred)
  const normalizedExact = available.find((modelId) => normalizeModelId(modelId) === normalizedPreferred)
  if (normalizedExact) return normalizedExact
  return (
    available.find((modelId) => normalizeModelId(modelId).includes(normalizedPreferred))
    || available.find((modelId) => normalizedPreferred.includes(normalizeModelId(modelId)))
    || null
  )
}

export async function fetchModels(config: LlmConfig, timeoutMs: number): Promise<string[]> {
  const { response, json } = await fetchJson<OpenAiModelPayload>(
    buildUrl(config.baseUrl, "models"),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      cache: "no-store",
    },
    timeoutMs
  )

  if (!response.ok) {
    const payload = json as OpenAiErrorPayload
    throw new OpenAiClientError(
      payload.error?.message ?? "Failed to fetch models.",
      response.status,
      payload.error?.code ? String(payload.error.code) : null
    )
  }

  return (json.data ?? [])
    .map((item) => item.id?.trim())
    .filter((value): value is string => Boolean(value))
}

export async function requestCompletion(
  config: LlmConfig,
  input: {
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
    temperature: number
    maxTokens: number
    timeoutMs: number
  }
): Promise<Omit<LlmCompletionResult, "requestedModel">> {
  const { response, json } = await fetchJson<OpenAiCompletionPayload | OpenAiErrorPayload>(
    buildUrl(config.baseUrl, "chat/completions"),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: input.messages,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
      }),
      cache: "no-store",
    },
    input.timeoutMs
  )

  if (!response.ok) {
    const payload = json as OpenAiErrorPayload
    throw new OpenAiClientError(
      payload.error?.message ?? "LLM request failed.",
      response.status,
      payload.error?.code ? String(payload.error.code) : null
    )
  }

  const payload = json as OpenAiCompletionPayload
  const firstChoice = payload.choices?.[0]
  const content = extractAssistantText(firstChoice?.message?.content)
  if (!content) {
    throw new OpenAiClientError("LLM returned an empty response.", 502, "empty_content")
  }

  return {
    providerRequestId: payload.id ?? null,
    resolvedModel: payload.model ?? config.model,
    content,
    finishReason: normalizeFinishReason(firstChoice?.finish_reason),
    usage: {
      promptTokens: Math.max(0, payload.usage?.prompt_tokens ?? 0),
      completionTokens: Math.max(0, payload.usage?.completion_tokens ?? 0),
      totalTokens: Math.max(0, payload.usage?.total_tokens ?? 0),
      cachedPromptTokens: Math.max(0, payload.usage?.prompt_tokens_details?.cached_tokens ?? 0),
    },
  }
}

export async function requestCompletionStream(
  config: LlmConfig,
  input: {
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
    temperature: number
    maxTokens: number
    timeoutMs: number
    onToken: (token: string) => void
  }
): Promise<Omit<LlmCompletionResult, "requestedModel">> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs)

  try {
    const response = await fetch(buildUrl(config.baseUrl, "chat/completions"), {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: input.messages,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        stream: true,
      }),
      cache: "no-store",
      signal: controller.signal,
    })

    if (!response.ok) {
      let errorPayload: OpenAiErrorPayload = {}
      try { errorPayload = await response.json() } catch {}
      throw new OpenAiClientError(
        errorPayload.error?.message ?? "LLM streaming request failed.",
        response.status,
        errorPayload.error?.code ? String(errorPayload.error.code) : null
      )
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new OpenAiClientError("No response body for streaming.", 502, "no_body")
    }

    const decoder = new TextDecoder()
    let accumulated = ""
    let buffer = ""
    let providerRequestId: string | null = null
    let resolvedModel: string | null = config.model
    let finishReason: string | null = null

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop() ?? ""

        for (const part of parts) {
          for (const rawLine of part.split("\n")) {
            const trimmed = rawLine.trim()
            if (!trimmed.startsWith("data: ")) continue
            const data = trimmed.slice(6)
            if (data === "[DONE]") continue

            try {
              const parsed = JSON.parse(data) as OpenAiCompletionPayload
              providerRequestId = parsed.id ?? providerRequestId
              resolvedModel = parsed.model ?? resolvedModel
              finishReason = normalizeFinishReason(parsed.choices?.[0]?.finish_reason) ?? finishReason

              const token = typeof parsed.choices?.[0]?.delta?.content === "string"
                ? parsed.choices[0].delta.content
                : ""
              if (!token) continue
              accumulated += token
              input.onToken(token)
            } catch {}
          }
        }
      }
    } finally {
      try { await reader.cancel() } catch {}
    }

    if (!accumulated.trim()) {
      throw new OpenAiClientError("LLM returned an empty streaming response.", 502, "empty_content")
    }

    return {
      providerRequestId,
      resolvedModel: resolvedModel ?? config.model,
      content: accumulated,
      finishReason,
      usage: {
        promptTokens: 0,
        completionTokens: Math.max(1, estimateTokens(accumulated)),
        totalTokens: Math.max(1, estimateTokens(accumulated)),
        cachedPromptTokens: 0,
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}
