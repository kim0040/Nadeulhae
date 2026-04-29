// ===== Constants =====

/** Matches empty/no-alert bulletin text (e.g., "없음", "특보없음", "n/a") */
export const NON_ALERT_BULLETIN_PATTERN =
  /^(?:[oO○◯●□■▪︎ㆍ·\-\*\s]*)?(?:없음|없\s*음|특보없음|해당없음|none|no\s*alerts?|n\/a)(?:[\s.)\]]*)$/i

/** Alias for NON_ALERT_BULLETIN_PATTERN */
export const EMPTY_BULLETIN_PATTERN = NON_ALERT_BULLETIN_PATTERN

/** Matches non-bulletin fallback/system messages */
export const NON_BULLETIN_MESSAGE_PATTERN =
  /(전주 기준 대기질 데이터를 표시 중입니다|showing fallback air quality data)/i

export const BULLETIN_HIGHLIGHT_MAX_LENGTH = 96
export const BULLETIN_MAX_SEGMENTS = 6

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

export type BulletinSeverity = "critical" | "warning" | "advisory" | "info"

export type BulletinTagTone = "danger" | "caution" | "info" | "neutral"

export interface BulletinBodyItem {
  label: string | null
  content: string
}

export interface BulletinKeywordTag {
  id: string
  label: string
  tone: BulletinSeverity
}

export interface BulletinSegment {
  label: string
  text: string
}

export interface BulletinBriefTag {
  label: string
  tone: BulletinTagTone
}

export interface ParsedBulletin {
  headline: string
  segments: BulletinSegment[]
}

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

export const BULLETIN_SEVERITY_RULES: Array<{
  severity: BulletinSeverity
  regex: RegExp
}> = [
  {
    severity: "critical",
    regex:
      /(경보|긴급|재난|지진|해일|산사태|태풍\s*경보|호우\s*경보|대설\s*경보|폭염\s*경보|한파\s*경보|storm warning|emergency|tsunami warning)/i,
  },
  {
    severity: "warning",
    regex:
      /(주의보|특보|강풍|풍랑|호우|대설|폭염|한파|황사|안개|빙판|낙뢰|advisory|heavy rain|strong wind|typhoon)/i,
  },
  {
    severity: "advisory",
    regex: /(비|눈|소나기|천둥|번개|바람|rain|snow|shower|thunder|wind)/i,
  },
]

export const BULLETIN_TAG_RULES: Array<{
  id: string
  regex: RegExp
  tone: BulletinSeverity
  label: Record<"ko" | "en", string>
}> = [
  {
    id: "typhoon",
    regex: /(태풍|typhoon)/i,
    tone: "critical",
    label: { ko: "태풍", en: "Typhoon" },
  },
  {
    id: "heavy-rain",
    regex: /(호우|집중호우|heavy rain)/i,
    tone: "warning",
    label: { ko: "호우", en: "Heavy Rain" },
  },
  {
    id: "strong-wind",
    regex: /(강풍|돌풍|strong wind|gust)/i,
    tone: "warning",
    label: { ko: "강풍", en: "Strong Wind" },
  },
  {
    id: "snow",
    regex: /(대설|폭설|snow|blizzard)/i,
    tone: "warning",
    label: { ko: "대설", en: "Heavy Snow" },
  },
  {
    id: "thunder",
    regex: /(천둥|번개|낙뢰|thunder|lightning)/i,
    tone: "warning",
    label: { ko: "낙뢰", en: "Thunder" },
  },
  {
    id: "heatwave",
    regex: /(폭염|heat wave|heatwave)/i,
    tone: "warning",
    label: { ko: "폭염", en: "Heatwave" },
  },
  {
    id: "cold-wave",
    regex: /(한파|cold wave)/i,
    tone: "warning",
    label: { ko: "한파", en: "Cold Wave" },
  },
  {
    id: "dust",
    regex: /(황사|미세먼지|초미세먼지|dust|pm10|pm2\.?5)/i,
    tone: "advisory",
    label: { ko: "대기질", en: "Air Quality" },
  },
  {
    id: "fog",
    regex: /(안개|가시거리|fog|visibility)/i,
    tone: "advisory",
    label: { ko: "안개", en: "Fog" },
  },
  {
    id: "rain",
    regex: /(비|강수|rain|drizzle)/i,
    tone: "advisory",
    label: { ko: "비", en: "Rain" },
  },
]

// ===== Core Parsing Functions =====

export function splitBulletinSymbols(value: string) {
  return value
    .replace(/[□■]/g, "\n")
    .replace(/[○◯●]/g, "\n")
}

export function normalizeBulletinText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return ""
  }

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

export function splitBulletinSummary(summary: string) {
  const cleaned = summary
    .replace(/\r/g, "\n")
    .split("\n")
    .map((segment) => segment.replace(/^[•·\-*\s]+/, "").trim())
    .filter(Boolean)
    .flatMap((line) =>
      line
        .split(/(?<=[.!?])\s+|(?<=다\.)\s+|(?<=요\.)\s+/)
        .map((segment) => segment.trim())
        .filter(Boolean)
    )

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

export function clampText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength).trimEnd()}…`
}

export function normalizeBulletinHeadline(value: string) {
  return value
    .replace(/^\((?:종합|요약|긴급)\)\s*/i, "")
    .replace(/^\[(?:종합|요약|긴급)\]\s*/i, "")
    .trim()
}

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

export function normalizeTagKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").trim()
}

// ===== Bulletin Building Functions =====

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

export function buildBulletinHighlight(sources: string[]) {
  const segments = buildBulletinSegments(sources)
  if (segments.length === 0) {
    return ""
  }

  const headline = normalizeBulletinHeadline(segments[0])
  return clampText(headline || segments[0], BULLETIN_HIGHLIGHT_MAX_LENGTH)
}

// ===== Severity & Tone (dashboard) =====

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

export function extractBulletinCategoryToken(segment: string) {
  const normalized = segment.replace(/^[\s\-:·•]+/, "").trim()

  const wrappedMatch = normalized.match(/^[\[(]([^\])]+)[\])]\s*(.*)$/)
  if (wrappedMatch) {
    const token =
      wrappedMatch[1].split(/[,\s/·:]+/).filter(Boolean)[0] ?? ""
    return {
      token: token.toLowerCase(),
      content: wrappedMatch[2]?.trim() ?? "",
    }
  }

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

export function formatBulletinCategoryLabel(
  token: string,
  language: "ko" | "en"
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

export function toBulletinBodyItem(
  segment: string,
  language: "ko" | "en"
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

export function extractBulletinKeywordTags(
  sources: string[],
  language: "ko" | "en"
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

export function translateBulletinText(
  text: string,
  language: "ko" | "en"
) {
  if (language === "ko") return text

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
    [/비와 눈/g, "rain and snow"],
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

export function localizeBulletinLabel(
  label: string,
  language: "ko" | "en"
) {
  if (language === "ko") return label
  const dayMatch = label.match(/(\d{1,2})일/)
  const dayNumber = dayMatch?.[1]

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

export function parseBulletinSummary(
  summary: string,
  language: "ko" | "en"
): ParsedBulletin {
  const normalized = summary.replace(/\s+/g, " ").trim()
  const cleanedSummary = normalized
    .replace(/^□\s*\(([^)]+)\)\s*/, "")
    .trim()
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
      const match = item.match(/^\(([^)]+)\)\s*(.*)$/)
      if (!match) {
        return {
          label: language === "ko" ? "안내" : "Note",
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

export function getBulletinTags(
  text: string,
  language: "ko" | "en"
): BulletinBriefTag[] {
  const entries = [
    {
      match: /건조|산불|화재/,
      ko: "건조·화재",
      en: "Dry / Fire",
      tone: "danger" as const,
    },
    {
      match: /호우|비|소나기/,
      ko: "강수",
      en: "Rain",
      tone: "caution" as const,
    },
    {
      match: /대설|눈|결빙/,
      ko: "눈·결빙",
      en: "Snow / Ice",
      tone: "caution" as const,
    },
    {
      match: /강풍|태풍/,
      ko: "강풍",
      en: "Strong Wind",
      tone: "danger" as const,
    },
    {
      match: /안개/,
      ko: "안개",
      en: "Fog",
      tone: "info" as const,
    },
    {
      match: /황사|미세먼지/,
      ko: "대기질",
      en: "Air Quality",
      tone: "caution" as const,
    },
    {
      match: /기온차|폭염|한파/,
      ko: "기온 변화",
      en: "Temperature",
      tone: "caution" as const,
    },
  ]

  return entries
    .filter((entry) => entry.match.test(text))
    .map((entry) => ({
      label: language === "ko" ? entry.ko : entry.en,
      tone: entry.tone,
    }))
}

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
 * Convenience: parses a raw bulletin summary into a formatted object
 * with headline, tags, tone, severity, and segments.
 */
export function formatBulletin(
  text: string,
  language: "ko" | "en"
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
