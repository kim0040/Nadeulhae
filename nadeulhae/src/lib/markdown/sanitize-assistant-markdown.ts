const RAW_MERMAID_ERROR_BLOCK_RE = /<div[^>]*id=["']dmermaid-[^"']*["'][\s\S]*?<\/div>/gi
const RAW_MERMAID_ERROR_SVG_RE = /<svg[^>]*id=["']mermaid-[^"']*["'][\s\S]*?<\/svg>/gi
const RAW_MERMAID_ERROR_MARKER_RE = /id=["']d?mermaid-|aria-roledescription=["']error["']|class=["']error-icon["']|Syntax error in text|mermaid version/i

export function sanitizeAssistantMarkdown(input: {
  content: string
  language: "ko" | "en"
}) {
  const fallback = input.language === "ko"
    ? "Mermaid 오류 SVG 원문은 숨김 처리되었습니다. `mermaid` 코드블록으로 다시 요청해 주세요."
    : "Raw Mermaid error SVG was hidden. Please request the diagram again with a `mermaid` code block."

  if (!input.content || !RAW_MERMAID_ERROR_MARKER_RE.test(input.content)) {
    return input.content
  }

  let sanitized = input.content
    .replace(RAW_MERMAID_ERROR_BLOCK_RE, fallback)
    .replace(RAW_MERMAID_ERROR_SVG_RE, fallback)
    .trim()

  if (!sanitized || RAW_MERMAID_ERROR_MARKER_RE.test(sanitized)) {
    sanitized = fallback
  }

  return sanitized
}
