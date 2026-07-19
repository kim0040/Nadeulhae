const MERMAID_FENCE_RE = /^\s*```(?:mermaid)?[ \t]*\n([\s\S]*?)\n```\s*$/i
const MERMAID_LANGUAGE_MARKER_RE = /^\s*mermaid\s*\n(?=\s*(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|mindmap|timeline|journey)\b)/i
const UNSUPPORTED_USE_CASE_RE = /^\s*usecaseDiagram\b/i
const FLOWCHART_SOURCE_RE = /^\s*(?:flowchart|graph)\b/i
const FLOWCHART_EDGE_START_RE = /^(?:[\p{L}_][\p{L}\p{N}_-]*)(?:[ \t]+)(?:-->|---|-.->|==>|~~~)/u

export type MermaidErrorDetails = {
  kind: "syntax" | "unsupported"
  line: number | null
  token: string | null
  rawMessage: string
}

/**
 * LLMs occasionally concatenate two otherwise valid flowchart statements,
 * for example `D[수정]D --> B`. Insert the unambiguous missing line break,
 * while leaving quoted labels and every non-flowchart diagram untouched.
 */
function repairConcatenatedFlowchartStatements(source: string) {
  if (!FLOWCHART_SOURCE_RE.test(source)) return source

  return source.split("\n").map((line) => {
    const indent = line.match(/^\s*/)?.[0] ?? ""
    let quote: "\"" | "'" | "`" | null = null
    let repaired = ""

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index]
      const previous = line[index - 1]

      if ((character === "\"" || character === "'" || character === "`") && previous !== "\\") {
        quote = quote === character ? null : quote ?? character
      }

      repaired += character
      if (quote || !"])}".includes(character)) continue

      const remainder = line.slice(index + 1)
      if (FLOWCHART_EDGE_START_RE.test(remainder)) {
        repaired += `\n${indent}`
      }
    }

    return repaired
  }).join("\n")
}

/**
 * Remove transport/markdown artifacts that are not part of Mermaid syntax.
 * This deliberately avoids semantic rewrites: invalid diagram logic should
 * still fail validation instead of being silently changed into another graph.
 */
export function normalizeMermaidSource(input: string) {
  let normalized = String(input ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\r\n?/g, "\n")
    .trim()

  const fenced = MERMAID_FENCE_RE.exec(normalized)
  if (fenced) {
    normalized = fenced[1].trim()
  }

  normalized = normalized
    .replace(MERMAID_LANGUAGE_MARKER_RE, "")
    .trim()

  return repairConcatenatedFlowchartStatements(normalized)
}

export function isUnsupportedMermaidSource(source: string) {
  return UNSUPPORTED_USE_CASE_RE.test(normalizeMermaidSource(source))
}

function getRawMermaidErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; str?: unknown }
    if (typeof value.str === "string") return value.str
    if (typeof value.message === "string") return value.message
  }
  return ""
}

/** Extract the useful line/token information from Mermaid parser failures. */
export function getMermaidErrorDetails(error: unknown): MermaidErrorDetails {
  const rawMessage = getRawMermaidErrorMessage(error).replace(/\u001b\[[0-9;]*m/g, "").trim()
  const unsupported = /No diagram type detected|UnknownDiagramError|unsupported diagram/i.test(rawMessage)
  const lineMatch = /(?:Parse error on line|line)\s+(\d+)/i.exec(rawMessage)
  const tokenMatch = /got\s+['"]([^'"]+)['"]/i.exec(rawMessage)

  return {
    kind: unsupported ? "unsupported" : "syntax",
    line: lineMatch ? Number(lineMatch[1]) : null,
    token: tokenMatch?.[1]?.trim() || null,
    rawMessage,
  }
}
