/**
 * Sanitizes assistant-generated markdown by removing raw Mermaid error SVGs
 * and their HTML wrappers.
 *
 * The assistant's markdown renderer catches Mermaid syntax errors and embeds
 * the raw error SVG into the output. This function strips those artifacts so
 * the end-user sees a clean fallback message instead of broken diagrams.
 */

// Matches <div id="dmermaid-..."> wrappers that Mermaid may emit on error.
const RAW_MERMAID_ERROR_BLOCK_RE = /<div[^>]*id=["']dmermaid-[^"']*["'][\s\S]*?<\/div>/gi
// Matches raw <svg id="mermaid-..."> elements containing error content.
const RAW_MERMAID_ERROR_SVG_RE = /<svg[^>]*id=["']mermaid-[^"']*["'][\s\S]*?<\/svg>/gi
// Matches code fences whose inner text contains Mermaid error markers.
const RAW_MERMAID_ERROR_CODE_FENCE_RE = /```(?:html|xml|svg)?[\s\S]*?(?:dmermaid-|aria-roledescription=["']error["']|Syntax error in text|mermaid version)[\s\S]*?```/gi
// Matches HTML-escaped error div/svg elements (e.g. after markdown escaping).
const ESCAPED_RAW_MERMAID_ERROR_RE = /&lt;(?:div|svg)[\s\S]*?(?:dmermaid-|aria-roledescription=&quot;error&quot;|Syntax error in text|mermaid version)[\s\S]*?&lt;\/(?:div|svg)&gt;/gi
// Quick pre-check regex: if none of these markers appear, skip sanitization entirely.
const RAW_MERMAID_ERROR_MARKER_RE = /id=["']d?mermaid-|aria-roledescription=["']error["']|class=["']error-icon["']|Syntax error in text|mermaid version/i

/**
 * Strips raw Mermaid error artifacts from assistant-generated markdown.
 *
 * When the assistant renders a Mermaid diagram that fails to compile, the
 * renderer embeds the raw error SVG/HTML in the output. This function
 * replaces those artifacts with a localized fallback message.
 *
 * Returns the fallback message alone when sanitization cannot remove all
 * error markers, ensuring the user never sees broken diagram output.
 */
export function sanitizeAssistantMarkdown(input: {
  content: string
  language: string
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
    .replace(RAW_MERMAID_ERROR_CODE_FENCE_RE, fallback)
    .replace(ESCAPED_RAW_MERMAID_ERROR_RE, fallback)
    // Deduplicate consecutive fallback replacements from overlapping regex matches.
    .replace(new RegExp(`${fallback}(\\s*${fallback})+`, "g"), fallback)
    // Normalize excessive blank lines left after stripping large blocks.
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  // If error markers survive sanitization, replace the entire content with just the fallback.
  if (!sanitized || RAW_MERMAID_ERROR_MARKER_RE.test(sanitized)) {
    sanitized = fallback
  }

  return sanitized
}
