type BulletinLanguage = "ko" | "en" | "zh" | "ja"

/**
 * @fileoverview Shared bulletin text parsing and formatting utilities.
 *
 * This module provides the core business logic for handling Korean weather
 * bulletin messages — including text normalization, severity classification,
 * tag extraction, category parsing, Korean/English translation, and display
 * formatting (Tailwind tone classes).
 *
 * Extracted from two frontend components to keep parsing logic DRY:
 * - Dashboard bulletin cards (severity, tags, keyword extraction)
 * - Picnic / daily briefing panels (summary parsing, label localization)
 *
 * @module bulletin
 */

// ===== Constants =====

/**
 * Matches text indicating "no alert" or "no bulletin" conditions.
 *
 * Regex breakdown:
 *   ^                        — start of string
 *   (?:[oO○◯●□■▪︎ㆍ·\-\\*\\s]*)? — optional leading symbols/bullets/whitespace
 *   (?:없음|없\\s*음|...|n/a)    — empty-bulletin keywords (KO + EN)
 *   (?:[\\s.)\\]]*)$          — optional trailing punctuation/whitespace (end anchor)
 *
 * @example Matching texts:
 *   - "없음", "특보없음", "해당없음"
 *   - "none", "no alerts", "n/a"
 *   - "○ 없음" (with leading symbol)
 */
export const NON_ALERT_BULLETIN_PATTERN =
  /^(?:[oO○◯●□■▪︎ㆍ·\-\*\s]*)?(?:없음|없\s*음|특보없음|해당없음|none|no\s*alerts?|n\/a)(?:[\s.)\]]*)$/i

/**
 * Alias for {@link NON_ALERT_BULLETIN_PATTERN}.
 * Semantically equivalent — both patterns detect empty/no-alert states.
 */
export const EMPTY_BULLETIN_PATTERN = NON_ALERT_BULLETIN_PATTERN

/**
 * Matches non-bulletin fallback/system status messages that are not actual
 * weather advisories (e.g., placeholder text used when bulletin data is stale
 * or unavailable).
 *
 * @example Matching texts:
 *   - "전주 기준 대기질 데이터를 표시 중입니다"
 *   - "showing fallback air quality data"
 */
export const NON_BULLETIN_MESSAGE_PATTERN =
  /(전주 기준 대기질 데이터를 표시 중입니다|showing fallback air quality data)/i

/** Maximum character length for a bulletin headline before truncation (with ellipsis). */
export const BULLETIN_HIGHLIGHT_MAX_LENGTH = 96

/** Maximum number of segments rendered when building bulletin content. */
export const BULLETIN_MAX_SEGMENTS = 6

/**
 * Recognized category tokens used for labeling bulletin sections.
 * Includes Korean day-of-week terms (오늘, 내일, 모레, 글피, 그글피),
 * summary labels (종합, 요약, 긴급), and their English equivalents.
 */
export const BULLETIN_CATEGORY_SET = new Set([
  "종합",
  "요약",
  "긴급",
  "오늘",
  "내일",
  "모레",
  "글피",
  "그글피",
  "summary",
  "today",
  "tomorrow",
])

// ===== Types =====

/**
 * Severity tier for bulletin-level classification.
 * Used by {@link BULLETIN_SEVERITY_RULES} to assign priority when
 * multiple patterns match a single bulletin.
 *
 * `critical` > `warning` > `advisory` > `info`
 */
export type BulletinSeverity = "critical" | "warning" | "advisory" | "info"

/**
 * Tone used for visual tag badges in the picnic/briefing UI.
 * Separate from `BulletinSeverity` — tone controls display colour,
 * severity controls the overall card/Dashboard level.
 */
export type BulletinTagTone = "danger" | "caution" | "info" | "neutral"

/** A labelled content row inside a bulletin card body. */
export interface BulletinBodyItem {
  label: string | null
  content: string
}

/** A keyword tag extracted from bulletin text for dashboard display. */
export interface BulletinKeywordTag {
  id: string
  label: string
  tone: BulletinSeverity
}

/** A labelled segment of parsed bulletin text (e.g. "Tomorrow: Rain expected"). */
export interface BulletinSegment {
  label: string
  text: string
}

/** A brief tag badge shown in the picnic briefing panel. */
export interface BulletinBriefTag {
  label: string
  tone: BulletinTagTone
}

/** Result of {@link parseBulletinSummary}. */
export interface ParsedBulletin {
  headline: string
  segments: BulletinSegment[]
}

/** Tailwind CSS class strings for each visual element in a severity-toned bulletin card. */
export interface BulletinToneClasses {
  container: string
  iconWrapper: string
  icon: string
  kicker: string
  text: string
  itemContainer: string
  itemLabel: string
}

// ===== Severity & Tag Rule Sets =====

/**
 * Ordered severity classification rules — **evaluated top to bottom**.
 * The first matching regex wins, so higher-severity patterns are listed
 * first to take priority over lower-severity matches.
 *
 * Priority order:
 *   1. `critical` — disaster/emergency keywords (경보, 긴급, 재난, earthquake, tsunami)
 *   2. `warning`  — watch/advisory keywords (주의보, 특보, heavy rain, strong wind)
 *   3. `advisory`  — general weather keywords (비, 눈, rain, snow, wind)
 *   4. `info`      — fallback when nothing matches (returned by {@link getBulletinSeverity})
 *
 * Each rule’s regex is a case-insensitive alternation of Korean and English keywords.
 */
export const BULLETIN_SEVERITY_RULES: Array<{
  severity: BulletinSeverity
  regex: RegExp
}> = [
  {
    severity: "critical",
    regex:
      // Matches: "호우경보", "지진", "태풍 경보", "storm warning", "emergency", "tsunami warning"
      /(경보|긴급|재난|지진|해일|산사태|태풍\s*경보|호우\s*경보|대설\s*경보|폭염\s*경보|한파\s*경보|storm warning|emergency|tsunami warning)/i,
  },
  {
    severity: "warning",
    regex:
      // Matches: "호우주의보", "특보", "강풍", "황사", "안개", "advisory", "heavy rain", "typhoon"
      /(주의보|특보|강풍|풍랑|호우|대설|폭염|한파|황사|안개|빙판|낙뢰|advisory|heavy rain|strong wind|typhoon)/i,
  },
  {
    severity: "advisory",
    regex:
      // Matches: "비", "눈", "소나기", "바람", "rain", "snow", "shower", "thunder", "wind"
      /(비|눈|소나기|천둥|번개|바람|rain|snow|shower|thunder|wind)/i,
  },
]

/**
 * Ordered tag classification rules — **evaluated top to bottom**.
 * More specific/intense phenomena are listed first so they take priority
 * when multiple patterns overlap in the same text (e.g., "태풍" is matched
 * before the broader "rain" or "wind" patterns).
 *
 * Each rule maps a regex to a unique tag ID, a display label (KO + EN),
 * and a severity tone used for badge colouring.
 *
 * Priority highlights:
 *   1. Typhoon (태풍) — most intense, matched first
 *   2. Heavy rain, strong wind, snow, thunder — warning-tier weather
 *   3. Heatwave, cold wave — temperature extremes
 *   4. Dust, fog, rain — broader advisory-tier conditions
 */
export const BULLETIN_TAG_RULES: Array<{
  id: string
  regex: RegExp
  tone: BulletinSeverity
  label: Record<string, string>
}> = [
  {
    id: "typhoon",
    regex: /(태풍|typhoon)/i,
    tone: "critical",
    label: { ko: "태풍", en: "Typhoon", zh: "台风", ja: "台風" },
  },
  {
    id: "heavy-rain",
    regex: /(호우|집중호우|heavy rain)/i,
    tone: "warning",
    label: { ko: "호우", en: "Heavy Rain", zh: "暴雨", ja: "豪雨" },
  },
  {
    id: "strong-wind",
    regex: /(강풍|돌풍|strong wind|gust)/i,
    tone: "warning",
    label: { ko: "강풍", en: "Strong Wind", zh: "强风", ja: "強風" },
  },
  {
    id: "snow",
    regex: /(대설|폭설|snow|blizzard)/i,
    tone: "warning",
    label: { ko: "대설", en: "Heavy Snow", zh: "暴雪", ja: "大雪" },
  },
  {
    id: "thunder",
    regex: /(천둥|번개|낙뢰|thunder|lightning)/i,
    tone: "warning",
    label: { ko: "낙뢰", en: "Thunder", zh: "雷电", ja: "落雷" },
  },
  {
    id: "heatwave",
    regex: /(폭염|heat wave|heatwave)/i,
    tone: "warning",
    label: { ko: "폭염", en: "Heatwave", zh: "酷暑", ja: "猛暑" },
  },
  {
    id: "cold-wave",
    regex: /(한파|cold wave)/i,
    tone: "warning",
    label: { ko: "한파", en: "Cold Wave", zh: "寒潮", ja: "寒波" },
  },
  {
    id: "dust",
    regex: /(황사|미세먼지|초미세먼지|dust|pm10|pm2\.?5)/i,
    tone: "advisory",
    label: { ko: "대기질", en: "Air Quality", zh: "空气质量", ja: "大気質" },
  },
  {
    id: "fog",
    regex: /(안개|가시거리|fog|visibility)/i,
    tone: "advisory",
    label: { ko: "안개", en: "Fog", zh: "雾", ja: "霧" },
  },
  {
    id: "rain",
    regex: /(비|강수|rain|drizzle)/i,
    tone: "advisory",
    label: { ko: "비", en: "Rain", zh: "雨", ja: "雨" },
  },
]

// ===== Core Parsing Functions =====

/**
 * Replaces bulletin bullet symbols (□■○◯●) with newlines, converting
 * inline symbol-separated items into line-delimited segments.
 *
 * @param value - Raw bulletin text potentially containing bullet symbols
 * @returns Text with symbolic bullets replaced by line breaks
 *
 * @example
 *   splitBulletinSymbols("○ 호우경보 □ 강풍주의보")
 *   // → "\n 호우경보 \n 강풍주의보"
 */
export function splitBulletinSymbols(value: string) {
  return value
    .replace(/[□■]/g, "\n")
    .replace(/[○◯●]/g, "\n")
}

/**
 * Normalizes bulletin text by collapsing whitespace, stripping leading
 * symbols/bullets, and filtering out empty/no-alert text.
 *
 * Edge cases handled:
 *   - Whitespace-only input → `""`
 *   - Text that matches {@link NON_ALERT_BULLETIN_PATTERN} → `""`
 *   - Leading bullet symbols are stripped before the pattern check
 *   - Falls back to original normalized string if after stripping nothing remains
 *
 * @param value - Raw bulletin text segment
 * @returns Cleaned bulletin text, or empty string if it's an empty/no-alert message
 */
export function normalizeBulletinText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return ""
  }

  // Strip leading bullets/symbols (○ ■ - etc.) for cleaner comparison
  const withoutPrefix = normalized
    .replace(/^[oO○◯●□■▪︎ㆍ·\-\*\s]+/, "")
    .trim()

  if (
    NON_ALERT_BULLETIN_PATTERN.test(normalized) ||
    NON_ALERT_BULLETIN_PATTERN.test(withoutPrefix)
  ) {
    return ""
  }

  return withoutPrefix || normalized
}

/**
 * Splits a multi-line bulletin summary string into a deduplicated array
 * of up to 4 unique text segments.
 *
 * Processing steps:
 *   1. Normalize CRLF → LF
 *   2. Split on newlines, strip leading bullet characters from each line
 *   3. Further split long lines on sentence boundaries
 *      (English: `. ! ?` followed by space; Korean: `다.` or `요.` followed by space)
 *   4. Deduplicate in order of first appearance
 *   5. Return at most 4 segments
 *
 * @param summary - Raw bulletin summary text (may be multi-line)
 * @returns Up to 4 unique, trimmed segment strings
 */
export function splitBulletinSummary(summary: string) {
  const cleaned = summary
    .replace(/\r/g, "\n")
    .split("\n")
    .map((segment) => segment.replace(/^[•·\-*\s]+/, "").trim())
    .filter(Boolean)
    .flatMap((line) =>
      // Split on sentence boundaries: ".", "!", "?" or Korean "다.", "요."
      line
        .split(/(?<=[.!?])\s+|(?<=다\.)\s+|(?<=요\.)\s+/)
        .map((segment) => segment.trim())
        .filter(Boolean)
    )

  // Preserve first-seen order while deduplicating
  const uniqueSegments: string[] = []
  for (const segment of cleaned) {
    if (!uniqueSegments.includes(segment)) {
      uniqueSegments.push(segment)
    }
    if (uniqueSegments.length >= 4) {
      break
    }
  }

  return uniqueSegments
}

/**
 * Truncates a string to `maxLength` characters, appending an ellipsis `…`
 * if truncation occurred. Trailing whitespace is trimmed before the ellipsis.
 *
 * @param value - The string to clamp
 * @param maxLength - Maximum character length (excluding ellipsis)
 * @returns The original string or a truncated version ending with `…`
 */
export function clampText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength).trimEnd()}…`
}

/**
 * Strips parenthetical or bracketed category prefixes from a bulletin headline.
 *
 * Removes patterns like `(종합)`, `(요약)`, `(긴급)`, `[종합]`, etc.
 * so the display headline starts with the actual content.
 *
 * @param value - Raw headline text
 * @returns Headline with category prefix removed
 *
 * @example
 *   normalizeBulletinHeadline("(종합) 오늘 날씨 전망")
 *   // → "오늘 날씨 전망"
 */
export function normalizeBulletinHeadline(value: string) {
  return value
    .replace(/^\((?:종합|요약|긴급)\)\s*/i, "")
    .replace(/^\[(?:종합|요약|긴급)\]\s*/i, "")
    .trim()
}

/**
 * Normalizes a bulletin source string and filters out non-bulletin
 * system messages (e.g., fallback air quality placeholders).
 *
 * Edge cases:
 *   - Empty/normalized text → `""`
 *   - Text matching {@link NON_BULLETIN_MESSAGE_PATTERN} → `""`
 *
 * @param value - Raw source text (e.g., from weather API)
 * @returns Cleaned source text, or empty string if invalid
 */
export function sanitizeBulletinSource(value: string) {
  const normalized = normalizeBulletinText(value)
  if (!normalized) {
    return ""
  }

  if (NON_BULLETIN_MESSAGE_PATTERN.test(normalized)) {
    return ""
  }

  return normalized
}

/**
 * Normalizes a tag/category key for case-insensitive comparison.
 * Lowercases, strips whitespace, and trims.
 *
 * @param value - Raw tag key string
 * @returns Normalized key (e.g. "Heavy Rain" → "heavyrain")
 */
export function normalizeTagKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").trim()
}

// ===== Bulletin Building Functions =====

/**
 * Builds a deduplicated list of valid bulletin source strings by
 * sanitizing and filtering primary sources first, then falling back
 * to secondary sources if no primary sources are valid.
 *
 * @param primarySources - Preferred source strings (e.g., weather alert API)
 * @param fallbackSources - Fallback source strings (e.g., air quality API)
 * @returns Deduplicated, sanitized source strings in insertion order
 */
export function buildBulletinSourceCandidates(
  primarySources: string[],
  fallbackSources: string[]
) {
  const selected: string[] = []
  const seen = new Set<string>()

  const push = (source: string) => {
    const normalized = sanitizeBulletinSource(source)
    if (!normalized || seen.has(normalized)) {
      return
    }

    seen.add(normalized)
    selected.push(normalized)
  }

  primarySources.forEach(push)
  if (selected.length === 0) {
    fallbackSources.forEach(push)
  }

  return selected
}

/**
 * Builds an ordered list of bulletin text segments from an array of
 * source strings — splitting on bullet symbols, normalizing each line,
 * further splitting into sentences, and capping at {@link BULLETIN_MAX_SEGMENTS}.
 *
 * @param sources - Sanitized bulletin source strings
 * @returns Up to `BULLETIN_MAX_SEGMENTS` normalized segment strings
 */
export function buildBulletinSegments(sources: string[]) {
  const merged = sources
    .map((source) => splitBulletinSymbols(source))
    .join("\n")
    .split("\n")
    .map((line) => normalizeBulletinText(line))
    .filter(Boolean)

  if (merged.length === 0) {
    return []
  }

  return splitBulletinSummary(merged.join("\n"))
    .map((segment) => normalizeBulletinText(segment))
    .filter(Boolean)
    .slice(0, BULLETIN_MAX_SEGMENTS)
}

/**
 * Builds a display headline/highlight from bulletin sources.
 *
 * Takes the first normalized segment (after headline prefix stripping),
 * and clamps it to {@link BULLETIN_HIGHLIGHT_MAX_LENGTH} with an ellipsis
 * if necessary.
 *
 * @param sources - Sanitized bulletin source strings
 * @returns A single headline string, or `""` if no valid segments exist
 */
export function buildBulletinHighlight(sources: string[]) {
  const segments = buildBulletinSegments(sources)
  if (segments.length === 0) {
    return ""
  }

  const headline = normalizeBulletinHeadline(segments[0])
  return clampText(headline || segments[0], BULLETIN_HIGHLIGHT_MAX_LENGTH)
}

// ===== Severity & Tone (dashboard) =====

/**
 * Classifies bulletin text into a severity tier by testing against
 * {@link BULLETIN_SEVERITY_RULES} in priority order.
 *
 * @param value - Raw or normalized bulletin text
 * @returns The highest-priority severity found, or `"info"` as fallback
 */
export function getBulletinSeverity(value: string): BulletinSeverity {
  const normalized = normalizeBulletinText(value)
  if (!normalized) {
    return "info"
  }

  for (const rule of BULLETIN_SEVERITY_RULES) {
    if (rule.regex.test(normalized)) {
      return rule.severity
    }
  }

  return "info"
}

/**
 * Maps a {@link BulletinSeverity} to a full set of Tailwind CSS
 * class strings for styling the bulletin card (container, icon, kicker,
 * text, item rows, and item labels).
 *
 * Used by the Dashboard bulletin card component.
 *
 * @param severity - Severity tier
 * @returns CSS class strings for each bulletin card element
 */
export function getBulletinSeverityTone(
  severity: BulletinSeverity
): BulletinToneClasses {
  switch (severity) {
    case "critical":
      return {
        container: "border-danger/25 bg-danger/10",
        iconWrapper: "border-danger/30 bg-danger/15 text-danger",
        icon: "text-danger",
        kicker: "text-danger/85",
        text: "text-danger",
        itemContainer: "border-danger/20 bg-danger/6",
        itemLabel: "border-danger/25 bg-danger/10 text-danger",
      }
    case "warning":
      return {
        container: "border-orange-500/30 bg-orange-500/10",
        iconWrapper:
          "border-orange-500/35 bg-orange-500/12 text-orange-600 dark:text-orange-300",
        icon: "text-orange-600 dark:text-orange-300",
        kicker: "text-orange-600/90 dark:text-orange-300",
        text: "text-foreground",
        itemContainer: "border-orange-500/20 bg-orange-500/6",
        itemLabel:
          "border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-300",
      }
    case "advisory":
      return {
        container: "border-sky-blue/25 bg-sky-blue/8",
        iconWrapper: "border-sky-blue/25 bg-sky-blue/12 text-sky-blue",
        icon: "text-sky-blue",
        kicker: "text-sky-blue/90",
        text: "text-foreground",
        itemContainer: "border-sky-blue/18 bg-sky-blue/5",
        itemLabel: "border-sky-blue/25 bg-sky-blue/10 text-sky-blue",
      }
    default:
      return {
        container: "border-card-border/70 bg-card/70",
        iconWrapper: "border-card-border/70 bg-card/90 text-muted-foreground",
        icon: "text-muted-foreground",
        kicker: "text-muted-foreground",
        text: "text-foreground",
        itemContainer: "border-card-border/70 bg-card/70",
        itemLabel:
          "border-card-border/70 bg-background/70 text-muted-foreground",
      }
  }
}

/**
 * Maps a {@link BulletinSeverity} to a single Tailwind CSS class string
 * for colouring a tag badge.
 *
 * @param tone - Severity/tone tier
 * @returns Tailwind class string for the tag badge element
 */
export function getBulletinTagToneClass(tone: BulletinSeverity) {
  switch (tone) {
    case "critical":
      return "border-danger/25 bg-danger/10 text-danger"
    case "warning":
      return "border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-300"
    case "advisory":
      return "border-sky-blue/25 bg-sky-blue/10 text-sky-blue"
    default:
      return "border-card-border/70 bg-card/85 text-foreground"
  }
}

// ===== Tag Extraction (dashboard) =====

/**
 * Extracts a category token and the remaining content from a bulletin
 * text segment. Handles two formats:
 *
 * 1. **Wrapped**: `[종합] content` or `(summary) content`
 *    → token = `"종합"`, content = `"content"`
 *
 * 2. **Plain prefix**: `"내일 content"` or `"Today: content"`
 *    → token = `"내일"`, content = `"content"`
 *
 * If no recognizable prefix is found, returns the full segment as content
 * with an empty token.
 *
 * @param segment - A single bulletin text segment
 * @returns Object with extracted `token` (lowercased) and remaining `content`
 */
export function extractBulletinCategoryToken(segment: string) {
  const normalized = segment.replace(/^[\s\-:·•]+/, "").trim()

  // Match categories wrapped in brackets: e.g. "[종합] content" or "(summary) content"
  const wrappedMatch = normalized.match(/^[\[(]([^\])]+)[\])]\s*(.*)$/)
  if (wrappedMatch) {
    const token =
      wrappedMatch[1].split(/[,\s/·:]+/).filter(Boolean)[0] ?? ""
    return {
      token: token.toLowerCase(),
      content: wrappedMatch[2]?.trim() ?? "",
    }
  }

  // Match plain category prefix: e.g. "내일 content" or "Today: content"
  // The token is the first word-like group; picks up Korean + English characters
  const plainMatch = normalized.match(
    /^([A-Za-z가-힣]+)\s*[:\-]?\s*(.*)$/
  )
  if (plainMatch) {
    return {
      token: plainMatch[1].toLowerCase(),
      content: plainMatch[2]?.trim() ?? "",
    }
  }

  return { token: "", content: normalized }
}

/**
 * Converts a category token into a display label in the specified language.
 * Handles bidirectional Korean ↔ English translation for recognised tokens.
 *
 * @param token - Category token (lowercased, e.g. "summary", "오늘", "tomorrow")
 * @param language - Target display language
 * @returns Human-readable label
 */
export function formatBulletinCategoryLabel(
  token: string,
  language: BulletinLanguage
) {
  if (language === "ko") {
    switch (token) {
      case "summary":
        return "종합"
      case "today":
        return "오늘"
      case "tomorrow":
        return "내일"
      default:
        return token
    }
  }

  switch (token) {
    case "종합":
    case "요약":
      return "Summary"
    case "긴급":
      return "Urgent"
    case "오늘":
      return "Today"
    case "내일":
      return "Tomorrow"
    case "모레":
      return "Day After Tomorrow"
    case "글피":
      return "In 3 Days"
    case "그글피":
      return "In 4 Days"
    default:
      return token.charAt(0).toUpperCase() + token.slice(1)
  }
}

/**
 * Parses a segment into a {@link BulletinBodyItem} with an optional category
 * label. If the extracted token is in {@link BULLETIN_CATEGORY_SET}, the
 * label is included; otherwise the full segment is returned as unlabelled content.
 *
 * @param segment - A single bulletin text segment
 * @param language - Display language for the category label
 * @returns Labelled or unlabelled body item
 */
export function toBulletinBodyItem(
  segment: string,
  language: BulletinLanguage
): BulletinBodyItem {
  const normalized = normalizeBulletinText(segment)
  if (!normalized) {
    return { label: null, content: "" }
  }

  const { token, content } = extractBulletinCategoryToken(normalized)
  if (BULLETIN_CATEGORY_SET.has(token)) {
    return {
      label: formatBulletinCategoryLabel(token, language),
      content: content || normalized,
    }
  }

  return {
    label: null,
    content: normalized,
  }
}

/**
 * Scans all bulletin source strings for weather phenomenon keywords
 * and returns matching tag objects with localised labels and severity tones.
 *
 * Rules are evaluated in {@link BULLETIN_TAG_RULES} order — higher-priority
 * tags (e.g., typhoon) are matched before broader patterns (e.g., rain).
 *
 * @param sources - Array of bulletin source strings
 * @param language - Display language for tag labels
 * @returns Array of matching {@link BulletinKeywordTag} objects
 */
export function extractBulletinKeywordTags(
  sources: string[],
  language: BulletinLanguage
): BulletinKeywordTag[] {
  const merged = sources
    .map((source) => normalizeBulletinText(source))
    .filter(Boolean)
    .join(" ")

  if (!merged) {
    return []
  }

  return BULLETIN_TAG_RULES.filter((rule) => rule.regex.test(merged)).map(
    (rule) => ({
      id: rule.id,
      label: rule.label[language],
      tone: rule.tone,
    })
  )
}

// ===== Picnic / Briefing Functions =====

/**
 * Translates Korean weather bulletin text into English using a
 * fixed set of word/phrase replacements applied in order.
 *
 * The replacement order matters — multi-word phrases (e.g. "비와 눈")
 * are matched before single-word patterns (e.g. "비", "눈") so they
 * are not partially consumed by shorter matches.
 *
 * If `language` is `"ko"`, the text is returned unchanged.
 *
 * @param text - Korean bulletin text
 * @param language - Target language (`"ko"` or `"en"`)
 * @returns Translated text (English), or the original Korean text
 *
 * @example
 *   translateBulletinText("오늘 오후 비 예보", "en")
 *   // → "today afternoon rain forecast"
 */
export function translateBulletinText(
  text: string,
  language: BulletinLanguage
) {
  if (language === "ko") return text

  // Ordered replacements: longer/multi-word phrases first to avoid partial matches
  const replacements: Array<[RegExp, string]> = [
    [/전북/g, "Jeonbuk"],
    [/전주/g, "Jeonju"],
    [/오늘/g, "today"],
    [/내일/g, "tomorrow"],
    [/모레/g, "the day after tomorrow"],
    [/글피/g, "in 3 days"],
    [/오전/g, "morning"],
    [/오후/g, "afternoon"],
    [/새벽/g, "early morning"],
    [/밤/g, "night"],
    [/비와 눈/g, "rain and snow"],       // Must precede /비/ and /눈/
    [/소나기/g, "showers"],
    [/비/g, "rain"],
    [/눈/g, "snow"],
    [/안개/g, "fog"],
    [/황사/g, "dust"],
    [/미세먼지/g, "fine dust"],
    [/건조/g, "dry"],
    [/강풍/g, "strong wind"],
    [/호우/g, "heavy rain"],
    [/대설/g, "heavy snow"],
    [/폭염/g, "heat"],
    [/한파/g, "cold wave"],
    [/흐림/g, "cloudy"],
    [/구름많음/g, "mostly cloudy"],
    [/맑음/g, "clear"],
    [/기온/g, "temperature"],
    [/강수확률/g, "rain chance"],
    [/강수/g, "precipitation"],
    [/특보/g, "warning"],
    [/전망/g, "outlook"],
    [/예보/g, "forecast"],
    [/부터/g, "from"],
  ]

  let translated = text
  for (const [pattern, replacement] of replacements) {
    translated = translated.replace(pattern, replacement)
  }
  return translated
}

/**
 * Localizes a bulletin segment label (e.g. "오늘, 12일" → "Today, 12").
 *
 * Handles optional trailing `, DD일` (Korean date suffix) — extracts
 * the day number and appends it after the translated label.
 *
 * @param label - Korean bulletin label (e.g. "오늘, 12일", "모레")
 * @param language - Target display language
 * @returns Localized label, with day number preserved if present
 */
export function localizeBulletinLabel(
  label: string,
  language: BulletinLanguage
) {
  if (language === "ko") return label
  const dayMatch = label.match(/(\d{1,2})일/)
  const dayNumber = dayMatch?.[1]

  // Strip Korean day suffix to get the base label for translation
  const withoutDaySuffix = label
    .replace(/,\s*\d{1,2}일/g, "")
    .replace(/\d{1,2}일/g, "")
    .trim()
  const mapped = withoutDaySuffix
    .replace(/오늘/g, "Today")
    .replace(/내일/g, "Tomorrow")
    .replace(/모레/g, "Day after tomorrow")
    .replace(/글피/g, "In 3 days")

  return dayNumber ? `${mapped}, ${dayNumber}` : mapped
}

/**
 * Parses a raw bulletin summary string into a structured
 * {@link ParsedBulletin} with a headline and up to 3 labelled segments.
 *
 * Bullet format expected (from Korean weather API):
 *   `□ (종합) 오늘 날씨 전망 ○ (오늘, 12일) 맑음 ○ (내일, 13일) 비`
 *
 * Processing steps:
 *   1. Collapse whitespace, strip leading `□ (category)` prefix
 *   2. Split on `○ (...)` boundaries — first item is the headline,
 *      remaining items are segments
 *   3. Each segment may have a `(label)` prefix extracted for
 *      localization
 *   4. Text content is translated via {@link translateBulletinText}
 *   5. Capped at 3 segments
 *
 * @param summary - Raw bulletin summary text from the weather API
 * @param language - Display language for labels and text
 * @returns Parsed bulletin with headline and segments
 */
export function parseBulletinSummary(
  summary: string,
  language: BulletinLanguage
): ParsedBulletin {
  const normalized = summary.replace(/\s+/g, " ").trim()

  // Strip leading □ (category) prefix, e.g. "□ (종합) ..." → "..."
  const cleanedSummary = normalized
    .replace(/^□\s*\(([^)]+)\)\s*/, "")
    .trim()

  // Split on "○ (...)" boundaries — each ○ marks a new bulletin item
  const splitItems = cleanedSummary
    .split(/\s(?=○\s*\()/)
    .filter(Boolean)

  const headline = splitItems[0]?.startsWith("○")
    ? (language === "ko"
        ? "현재 공식 통보 요약입니다."
        : "This is the latest official bulletin summary.")
    : translateBulletinText(
        splitItems.shift() ||
          (language === "ko"
            ? "현재 공식 통보에 특이사항이 없습니다."
            : "No notable official bulletin right now."),
        language
      )

  const segments: BulletinSegment[] = splitItems
    .map((item) => item.replace(/^○\s*/, "").trim())
    .map((item) => {
      // Extract "(label) rest of text" pattern within each ○-item
      const match = item.match(/^\(([^)]+)\)\s*(.*)$/)
      if (!match) {
        return {
          label: language === "ko" ? "안내" : language === "zh" ? "通知" : language === "ja" ? "案内" : "Note",
          text: translateBulletinText(item, language),
        }
      }
      return {
        label: localizeBulletinLabel(match[1], language),
        text: translateBulletinText(match[2], language),
      }
    })

  return {
    headline,
    segments: segments.slice(0, 3),
  }
}

/**
 * Determines the display tone of a bulletin text snippet for the
 * picnic/briefing tag system (separate from dashboard severity).
 *
 * Priority:
 *   1. `danger`  — severe/emergency keywords (특보, 호우, 태풍, earthquake, fire)
 *   2. `caution`  — moderate/advisory keywords (건조, 비, 눈, fog, dust, ice)
 *   3. `info`     — neutral forecast keywords (맑음, 구름, forecast, outlook)
 *   4. `neutral`  — fallback
 *
 * @param text - Bulletin text to classify
 * @returns Tone classification for the tag badge
 */
export function getBulletinTone(text: string): BulletinTagTone {
  const normalized = text.replace(/\s+/g, "")
  if (
    /특보|호우|대설|태풍|강풍|폭염|한파|지진|산불|화재/.test(normalized)
  )
    return "danger"
  if (
    /건조|비|소나기|눈|안개|황사|미세먼지|기온차|결빙/.test(normalized)
  )
    return "caution"
  if (/맑음|구름|흐림|예보|전망/.test(normalized)) return "info"
  return "neutral"
}

/**
 * Extracts weather phenomenon tags from bulletin text for the picnic
 * briefing panel. Each matched tag includes a localised label and a
 * {@link BulletinTagTone}.
 *
 * Entry order determines priority: more severe/intense patterns
 * (danger/caution) are listed first so they appear before milder
 * info-level tags in the output array.
 *
 * @param text - Bulletin text to scan
 * @param language - Display language for tag labels
 * @returns Array of matching tag objects
 */
export function getBulletinTags(
  text: string,
  language: BulletinLanguage
): BulletinBriefTag[] {
  const entries = [
    {
      match: /건조|산불|화재/,
      ko: "건조·화재",
      en: "Dry / Fire",
      zh: "干燥·火灾",
      ja: "乾燥·火災",
      tone: "danger" as const,
    },
    {
      match: /호우|비|소나기/,
      ko: "강수",
      en: "Rain",
      zh: "降雨",
      ja: "降水",
      tone: "caution" as const,
    },
    {
      match: /대설|눈|결빙/,
      ko: "눈·결빙",
      en: "Snow / Ice",
      zh: "降雪·结冰",
      ja: "雪·凍結",
      tone: "caution" as const,
    },
    {
      match: /강풍|태풍/,
      ko: "강풍",
      en: "Strong Wind",
      zh: "强风",
      ja: "強風",
      tone: "danger" as const,
    },
    {
      match: /안개/,
      ko: "안개",
      en: "Fog",
      zh: "雾",
      ja: "霧",
      tone: "info" as const,
    },
    {
      match: /황사|미세먼지/,
      ko: "대기질",
      en: "Air Quality",
      zh: "空气质量",
      ja: "大気質",
      tone: "caution" as const,
    },
    {
      match: /기온차|폭염|한파/,
      ko: "기온 변화",
      en: "Temperature",
      zh: "温度变化",
      ja: "気温変化",
      tone: "caution" as const,
    },
  ]

  return entries
    .filter((entry) => entry.match.test(text))
    .map((entry) => ({
      label: language === "ko" ? entry.ko : language === "zh" ? entry.zh : language === "ja" ? entry.ja : entry.en,
      tone: entry.tone,
    }))
}

/**
 * Maps a {@link BulletinTagTone} to a Tailwind CSS class string
 * for styling a tag badge in the picnic briefing panel.
 *
 * @param tone - Tag tone classification
 * @returns Tailwind class string for the badge element
 */
export function getToneClasses(tone: BulletinTagTone) {
  switch (tone) {
    case "danger":
      return "border-red-500/20 bg-red-500/8 text-red-600 dark:text-red-300"
    case "caution":
      return "border-orange-500/20 bg-orange-500/8 text-orange-600 dark:text-orange-300"
    case "info":
      return "border-sky-blue/20 bg-sky-blue/8 text-sky-blue"
    default:
      return "border-border bg-card text-foreground/80"
  }
}

/**
 * Convenience function that parses a raw bulletin summary and enriches it
 * with severity, tone, tags, and CSS tone classes — all in one call.
 *
 * Combines {@link parseBulletinSummary}, {@link getBulletinSeverity},
 * {@link getBulletinTone}, {@link getBulletinTags}, and
 * {@link getBulletinSeverityTone}.
 *
 * @param text - Raw bulletin summary text (Korean or English)
 * @param language - Display language for labels, tags, and headline
 * @returns Enriched bulletin object ready for rendering
 */
export function formatBulletin(
  text: string,
  language: BulletinLanguage
) {
  const parsed = parseBulletinSummary(text, language)
  const severity = getBulletinSeverity(text)
  const tone = getBulletinTone(text)
  const tags = getBulletinTags(
    `${parsed.headline} ${parsed.segments.map((s) => s.text).join(" ")}`,
    language
  )
  const toneClasses = getBulletinSeverityTone(severity)

  return {
    ...parsed,
    severity,
    tone,
    tags,
    toneClasses,
  }
}
