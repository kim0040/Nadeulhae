/**
 * Syntax-highlighting tokenizer for code blocks rendered in markdown.
 *
 * Produces a flat token stream with a semantic kind label (keyword, string,
 * comment, etc.) for a given code snippet and language ID. The tokenizer is
 * regex-based — it matches comments, quoted strings, template literals,
 * hex/float literals, known keywords, function-call patterns, and operator
 * characters — then classifies each token via simple heuristics rather than
 * a full parser.
 *
 * Language aliases (e.g. "js" → "javascript", "py" → "python") are resolved
 * through the LANGUAGE_ALIASES map. Per-language keyword sets live in
 * LANGUAGE_KEYWORDS and cover 14 languages (JS, TS, Python, Java, Go, Rust,
 * C, C++, C#, SQL, CSS, HTML, shell, YAML).
 */

/** Semantic category for a syntax token produced by the highlighter. */
export type HighlightKind =
  | "plain"
  | "comment"
  | "function"
  | "keyword"
  | "meta"
  | "number"
  | "operator"
  | "property"
  | "string"
  | "type"

/** A single token produced by the highlighter, carrying its text and semantic kind. */
export type HighlightToken = {
  text: string
  kind: HighlightKind
}

/** Resolved language identity: canonical ID and display label. */
export type NormalizedCodeLanguage = {
  id: string
  label: string
}

// Maps common aliases and extensions to canonical language IDs and display labels.
const LANGUAGE_ALIASES: Record<string, NormalizedCodeLanguage> = {
  bash: { id: "shell", label: "Shell" },
  c: { id: "c", label: "C" },
  cc: { id: "cpp", label: "C++" },
  cpp: { id: "cpp", label: "C++" },
  "c++": { id: "cpp", label: "C++" },
  cs: { id: "csharp", label: "C#" },
  csharp: { id: "csharp", label: "C#" },
  css: { id: "css", label: "CSS" },
  go: { id: "go", label: "Go" },
  golang: { id: "go", label: "Go" },
  html: { id: "html", label: "HTML" },
  java: { id: "java", label: "Java" },
  js: { id: "javascript", label: "JavaScript" },
  javascript: { id: "javascript", label: "JavaScript" },
  json: { id: "json", label: "JSON" },
  jsx: { id: "jsx", label: "JSX" },
  mermaid: { id: "mermaid", label: "Mermaid" },
  md: { id: "markdown", label: "Markdown" },
  markdown: { id: "markdown", label: "Markdown" },
  py: { id: "python", label: "Python" },
  python: { id: "python", label: "Python" },
  rs: { id: "rust", label: "Rust" },
  rust: { id: "rust", label: "Rust" },
  sh: { id: "shell", label: "Shell" },
  shell: { id: "shell", label: "Shell" },
  sql: { id: "sql", label: "SQL" },
  ts: { id: "typescript", label: "TypeScript" },
  tsx: { id: "tsx", label: "TSX" },
  typescript: { id: "typescript", label: "TypeScript" },
  xml: { id: "html", label: "XML" },
  yaml: { id: "yaml", label: "YAML" },
  yml: { id: "yaml", label: "YAML" },
  zsh: { id: "shell", label: "Shell" },
}

// Words classified as type annotations across languages.
const TYPE_WORDS = new Set([
  "Array", "BigInt", "Boolean", "Date", "Dict", "Error", "List", "Map", "Number", "Object", "Promise", "Record", "Set",
  "String", "Tuple", "any", "bigint", "bool", "boolean", "byte", "char", "dict", "double", "float", "int", "integer",
  "long", "number", "short", "str", "string", "symbol", "unknown", "void",
])

// Per-language keyword lists used for token classification. `caseInsensitive` is set for SQL/CSS/HTML/YAML.
const LANGUAGE_KEYWORDS: Record<string, { words: string[]; caseInsensitive?: boolean }> = {
  javascript: {
    words: ["as", "async", "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "export", "extends", "finally", "for", "function", "if", "import", "in", "instanceof", "let", "new", "null", "return", "super", "switch", "this", "throw", "true", "false", "try", "typeof", "undefined", "var", "void", "while", "yield"],
  },
  typescript: {
    words: ["abstract", "any", "as", "asserts", "async", "await", "break", "case", "catch", "class", "const", "continue", "declare", "default", "do", "else", "enum", "export", "extends", "finally", "for", "function", "if", "implements", "import", "in", "infer", "interface", "is", "keyof", "let", "namespace", "never", "new", "null", "readonly", "return", "satisfies", "super", "switch", "this", "throw", "true", "false", "try", "type", "typeof", "undefined", "var", "void", "while"],
  },
  jsx: {
    words: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "switch", "case", "break", "new", "this", "true", "false", "null", "undefined", "import", "export", "class", "extends"],
  },
  tsx: {
    words: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "switch", "case", "break", "new", "this", "true", "false", "null", "undefined", "import", "export", "class", "extends", "type", "interface", "as", "readonly"],
  },
  python: {
    words: ["and", "as", "assert", "async", "await", "break", "case", "class", "continue", "def", "del", "elif", "else", "except", "False", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "match", "None", "nonlocal", "not", "or", "pass", "raise", "return", "True", "try", "while", "with", "yield"],
  },
  java: {
    words: ["abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue", "default", "do", "double", "else", "enum", "extends", "final", "finally", "float", "for", "if", "implements", "import", "instanceof", "int", "interface", "long", "native", "new", "null", "package", "private", "protected", "public", "return", "short", "static", "strictfp", "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try", "void", "volatile", "while"],
  },
  go: {
    words: ["break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough", "for", "func", "go", "goto", "if", "import", "interface", "map", "package", "range", "return", "select", "struct", "switch", "type", "var"],
  },
  rust: {
    words: ["as", "async", "await", "break", "const", "continue", "crate", "dyn", "else", "enum", "extern", "false", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return", "self", "Self", "static", "struct", "super", "trait", "true", "type", "unsafe", "use", "where", "while"],
  },
  c: {
    words: ["auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum", "extern", "float", "for", "goto", "if", "inline", "int", "long", "register", "restrict", "return", "short", "signed", "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while"],
  },
  cpp: {
    words: ["alignas", "alignof", "and", "asm", "auto", "bool", "break", "case", "catch", "char", "class", "const", "constexpr", "continue", "decltype", "default", "delete", "do", "double", "else", "enum", "explicit", "export", "extern", "false", "final", "float", "for", "friend", "goto", "if", "inline", "int", "long", "mutable", "namespace", "new", "noexcept", "nullptr", "operator", "private", "protected", "public", "register", "reinterpret_cast", "return", "short", "signed", "sizeof", "static", "struct", "switch", "template", "this", "throw", "true", "try", "typedef", "typename", "union", "unsigned", "using", "virtual", "void", "volatile", "while"],
  },
  csharp: {
    words: ["abstract", "as", "base", "bool", "break", "byte", "case", "catch", "char", "checked", "class", "const", "continue", "decimal", "default", "delegate", "do", "double", "else", "enum", "event", "explicit", "extern", "false", "finally", "fixed", "float", "for", "foreach", "goto", "if", "implicit", "in", "int", "interface", "internal", "is", "lock", "long", "namespace", "new", "null", "object", "operator", "out", "override", "params", "private", "protected", "public", "readonly", "ref", "return", "sbyte", "sealed", "short", "sizeof", "stackalloc", "static", "string", "struct", "switch", "this", "throw", "true", "try", "typeof", "uint", "ulong", "unchecked", "unsafe", "ushort", "using", "virtual", "void", "volatile", "while"],
  },
  sql: {
    words: ["SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "GROUP", "ORDER", "BY", "HAVING", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "TABLE", "INDEX", "VALUES", "INTO", "LIMIT", "OFFSET", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "NULL", "NOT", "DEFAULT", "DISTINCT", "COUNT", "SUM", "AVG", "MIN", "MAX", "AND", "OR", "AS", "ON", "LIKE", "BETWEEN", "IN"],
    caseInsensitive: true,
  },
  css: {
    words: ["@media", "@supports", "@keyframes", "@layer", "@import", "@font-face", "!important"],
  },
  html: {
    words: ["doctype"],
    caseInsensitive: true,
  },
  shell: {
    words: ["if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case", "esac", "function", "in", "export", "unset", "local", "readonly", "return"],
  },
  yaml: {
    words: ["true", "false", "null", "yes", "no", "on", "off"],
    caseInsensitive: true,
  },
}

/** Escapes special regex characters in a string so it can be used in a RegExp literal. */
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Returns a regex pattern string that matches comments in the given language. */
function getCommentPattern(languageId: string) {
  if (languageId === "html") return String.raw`<!--[\s\S]*?-->`
  if (languageId === "python" || languageId === "shell" || languageId === "yaml") return String.raw`#[^\n]*`
  if (languageId === "sql") return String.raw`--[^\n]*|\/\*[\s\S]*?\*\/`
  return String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`
}

/** Resolves the keyword configuration for a language, falling back to JS for JSX/TSX and null for unsupported. */
function resolveKeywordConfig(languageId: string) {
  if (languageId === "typescript" || languageId === "tsx") return LANGUAGE_KEYWORDS.typescript
  if (languageId === "javascript" || languageId === "jsx") return LANGUAGE_KEYWORDS.javascript
  return LANGUAGE_KEYWORDS[languageId] ?? null
}

/**
 * Classifies a single lexeme into a HighlightKind.
 *
 * Order matters: comment/string/number patterns are checked first, then
 * language-specific keywords, then type-words, then function-call syntax
 * (identifier followed by `(`), and finally operator characters. Anything
 * unmatched becomes "plain".
 */
function classifyToken(text: string, languageId: string, keywordConfig: { words: string[]; caseInsensitive?: boolean } | null): HighlightKind {
  if (!text) return "plain"
  // Check comment prefixes before anything else.
  if (/^(\/\/|\/\*|#|--|<!--)/.test(text)) return "comment"
  if (/^(['"`])/.test(text)) return "string"
  if (/^(0x[\da-f]+|\d[\d_]*(\.\d[\d_]*)?)/i.test(text)) return "number"
  if (languageId === "html" && /^<\/?[A-Za-z]/.test(text)) return "meta" // HTML tags
  if (languageId === "css" && /^[A-Za-z-]+(?=\s*:)/.test(text)) return "property" // CSS property names
  if (TYPE_WORDS.has(text)) return "type"

  if (keywordConfig) {
    if (keywordConfig.caseInsensitive) {
      const upper = text.toUpperCase()
      if (keywordConfig.words.some((word) => word.toUpperCase() === upper)) return "keyword"
    } else if (keywordConfig.words.includes(text)) {
      return "keyword"
    }
  }

  // Identifier followed by `(` — heuristic for function calls.
  if (/^[A-Za-z_$][\w$]*(?=\s*\()/.test(text)) return "function"
  if (/^[{}()[\].,;:+\-*/%=<>!&|^~?]+$/.test(text)) return "operator"
  return "plain"
}

/**
 * Normalizes a raw language tag (e.g. "js", "py", "c++") to a canonical
 * language ID and display label. Falls back to uppercase raw input or "Text".
 */
export function normalizeCodeLanguage(rawLanguage?: string | null): NormalizedCodeLanguage {
  const key = String(rawLanguage ?? "").trim().toLowerCase()
  return LANGUAGE_ALIASES[key] ?? {
    id: key || "text",
    label: key ? key.toUpperCase() : "Text",
  }
}

/**
 * Tokenizes a code string into an array of HighlightTokens.
 *
 * Builds a single RegExp per call that captures comments, quoted strings,
 * template literals, number literals, keywords, function-call identifiers,
 * and operators in priority order. The regex is executed in a loop via
 * `exec` to interleave unmatched plain text between matches.
 */
export function highlightCode(code: string, languageId: string): HighlightToken[] {
  if (!code) return []

  const keywordConfig = resolveKeywordConfig(languageId)
  const commentPattern = getCommentPattern(languageId)
  // Sort keywords longest-first so multi-word matches (e.g. "!important") take priority.
  const keywordPattern = keywordConfig
    ? String.raw`\b(?:${keywordConfig.words.map(escapeRegex).sort((a, b) => b.length - a.length).join("|")})\b`
    : String.raw`(?!x)x` // Never-matching pattern when there are no keywords.

  const templateStringPattern = "`(?:\\\\.|[^`\\\\])*`"
  const tokenPattern = languageId === "html"
    ? String.raw`${commentPattern}|<\/?[A-Za-z][^>]*>|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|0x[\da-fA-F]+|\b\d[\d_]*(?:\.\d[\d_]*)?\b|\b[A-Za-z_$][\w$]*(?=\s*\()|[{}()[\].,;:+\-*/%=<>!&|^~?]+`
    : String.raw`${commentPattern}|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|${templateStringPattern}|0x[\da-fA-F]+|\b\d[\d_]*(?:\.\d[\d_]*)?\b|${keywordPattern}|\b[A-Za-z_$][\w$]*(?=\s*\()|[{}()[\].,;:+\-*/%=<>!&|^~?]+`

  const flags = keywordConfig?.caseInsensitive ? "gi" : "g"
  const matcher = new RegExp(tokenPattern, flags)
  const tokens: HighlightToken[] = []
  let cursor = 0
  let match: RegExpExecArray | null

  // Walk through code, pushing plain text between matches and classified tokens for each match.
  while ((match = matcher.exec(code)) !== null) {
    if (match.index > cursor) {
      tokens.push({ text: code.slice(cursor, match.index), kind: "plain" })
    }

    const text = match[0]
    tokens.push({ text, kind: classifyToken(text, languageId, keywordConfig) })
    cursor = match.index + text.length
  }

  // Flush any remaining trailing plain text.
  if (cursor < code.length) {
    tokens.push({ text: code.slice(cursor), kind: "plain" })
  }

  return tokens
}
