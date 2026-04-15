import type { LabCardSnapshot, LabGeneratedCardInput } from "@/lib/lab/types"

const CONTROL_CHARACTERS_REGEX = /[\u0000-\u001F\u007F]/g

function normalizeCell(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .replace(CONTROL_CHARACTERS_REGEX, "")
    .replace(/\s+/g, " ")
    .trim()
}

function trimTo(value: string, maxLength: number) {
  return value.slice(0, maxLength)
}

function normalizeCardDraft(input: Record<string, unknown>): LabGeneratedCardInput | null {
  const term = trimTo(normalizeCell(input.term ?? input.word ?? input.spell ?? input.단어), 80)
  const meaning = trimTo(normalizeCell(input.meaning ?? input.translation ?? input.뜻 ?? input.의미), 220)
  const example = trimTo(normalizeCell(input.example ?? input.sentence ?? input.예문), 280)
  const exampleTranslation = trimTo(normalizeCell(input.exampleTranslation ?? input.explanation ?? input.예문해설 ?? input.해설), 280)
  const partOfSpeech = trimTo(normalizeCell(input.partOfSpeech ?? input.pos ?? input.품사), 40)

  if (!term || !meaning) {
    return null
  }

  return {
    term,
    meaning,
    example: example || null,
    exampleTranslation: exampleTranslation || null,
    partOfSpeech: partOfSpeech || null,
  }
}

function toDedupKey(card: LabGeneratedCardInput) {
  return `${card.term.toLowerCase().replace(/\s+/g, "")}|${card.meaning.toLowerCase().replace(/\s+/g, "")}`
}

function dedupeCards(cards: LabGeneratedCardInput[]) {
  const normalized: LabGeneratedCardInput[] = []
  const seen = new Set<string>()

  for (const card of cards) {
    const key = toDedupKey(card)
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    normalized.push(card)
  }

  return normalized
}

function sanitizeImportSourceRaw(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .replace(/^\uFEFF/, "")
    .replace(/\u200B/g, "")
    .replace(/\u0000/g, "")
    .trim()
}

function normalizeJsonLikeSource(value: string) {
  return value
    .replace(/[""]/g, "\"")
    .replace(/['']/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim()
}

function extractCodeBlockJson(value: string) {
  const match = value.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return match?.[1]?.trim() ?? null
}

function extractBracketedJson(value: string, open: "{" | "[", close: "}" | "]") {
  const start = value.indexOf(open)
  const end = value.lastIndexOf(close)
  if (start < 0 || end < 0 || end <= start) {
    return null
  }
  return value.slice(start, end + 1).trim()
}

function tryParseJsonCandidate(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function parseJsonLoosely(source: string) {
  const candidates = [
    source,
    extractCodeBlockJson(source),
    extractBracketedJson(source, "{", "}"),
    extractBracketedJson(source, "[", "]"),
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim().length > 0))

  for (const candidate of candidates) {
    const strict = tryParseJsonCandidate(candidate)
    if (strict) {
      return strict
    }

    const normalized = normalizeJsonLikeSource(candidate)
    if (normalized !== candidate) {
      const relaxed = tryParseJsonCandidate(normalized)
      if (relaxed) {
        return relaxed
      }
    }
  }

  return null
}

function countDelimiterOutsideQuotes(value: string, delimiter: string) {
  let inQuotes = false
  let count = 0

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    if (char === "\"") {
      const next = value[i + 1]
      if (inQuotes && next === "\"") {
        i += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }

    if (!inQuotes && char === delimiter) {
      count += 1
    }
  }

  return count
}

function detectCsvDelimiter(source: string) {
  const candidates = [",", ";", "\t"] as const
  const sampleLines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 5)

  if (sampleLines.length === 0) {
    return ","
  }

  let bestDelimiter: "," | ";" | "\t" = ","
  let bestScore = -1

  for (const delimiter of candidates) {
    const score = sampleLines.reduce((sum, line) => sum + countDelimiterOutsideQuotes(line, delimiter), 0)
    if (score > bestScore) {
      bestScore = score
      bestDelimiter = delimiter
    }
  }

  return bestDelimiter
}

function parseCsvRows(source: string, delimiter: "," | ";" | "\t" = ",") {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ""
  let inQuotes = false

  const pushField = () => {
    currentRow.push(currentField)
    currentField = ""
  }

  const pushRow = () => {
    if (currentRow.length === 0) {
      return
    }

    const hasValue = currentRow.some((field) => field.trim().length > 0)
    if (hasValue) {
      rows.push(currentRow)
    }
    currentRow = []
  }

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]

    if (inQuotes) {
      if (char === '"') {
        const next = source[i + 1]
        if (next === '"') {
          currentField += '"'
          i += 1
          continue
        }

        inQuotes = false
        continue
      }

      currentField += char
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === delimiter) {
      pushField()
      continue
    }

    if (char === "\n") {
      pushField()
      pushRow()
      continue
    }

    if (char === "\r") {
      const next = source[i + 1]
      if (next === "\n") {
        continue
      }
      pushField()
      pushRow()
      continue
    }

    currentField += char
  }

  pushField()
  pushRow()

  return rows
}

function splitLooseTermMeaning(value: string) {
  const normalized = normalizeCell(value)
  if (!normalized) {
    return { term: "", meaning: "" }
  }

  const delimiters = ["\t", "|", " - ", " – ", " — ", " :: ", " : ", ": ", "："]
  for (const delimiter of delimiters) {
    const index = normalized.indexOf(delimiter)
    if (index <= 0) {
      continue
    }

    const term = normalized.slice(0, index).trim()
    const meaning = normalized.slice(index + delimiter.length).trim()
    if (term && meaning) {
      return { term, meaning }
    }
  }

  const colonIndex = normalized.indexOf(":")
  if (colonIndex > 0) {
    const term = normalized.slice(0, colonIndex).trim()
    const meaning = normalized.slice(colonIndex + 1).trim()
    if (term && meaning) {
      return { term, meaning }
    }
  }

  return { term: "", meaning: "" }
}

function normalizeHeaderKey(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
}

function getHeaderIndexMap(headerRow: string[]) {
  const map = new Map<string, number>()

  for (let index = 0; index < headerRow.length; index += 1) {
    map.set(normalizeHeaderKey(headerRow[index]), index)
  }

  return map
}

function pickIndex(headerMap: Map<string, number>, keys: string[]) {
  for (const key of keys) {
    const index = headerMap.get(key)
    if (typeof index === "number") {
      return index
    }
  }

  return null
}

function toCsvCell(value: unknown) {
  const base = String(value ?? "")
  if (/[",\n\r]/.test(base)) {
    return `"${base.replace(/"/g, '""')}"`
  }
  return base
}

export interface ParsedLabImportResult {
  cards: LabGeneratedCardInput[]
  totalParsedRows: number
  invalidRows: number
  parseSucceeded: boolean
  sourceFormat: "csv" | "json"
  deckTitle: string | null
  deckTopic: string | null
}

export function parseLabImportPayload(input: {
  format: "csv" | "json"
  source: string
}) : ParsedLabImportResult {
  const source = sanitizeImportSourceRaw(input.source)
  if (!source) {
    return {
      cards: [],
      totalParsedRows: 0,
      invalidRows: 0,
      parseSucceeded: true,
      sourceFormat: input.format,
      deckTitle: null,
      deckTopic: null,
    }
  }

  if (input.format === "json") {
    const parsed = parseJsonLoosely(source)
    if (!parsed) {
      return {
        cards: [],
        totalParsedRows: 0,
        invalidRows: 0,
        parseSucceeded: false,
        sourceFormat: "json",
        deckTitle: null,
        deckTopic: null,
      }
    }

    const objectLike = parsed && typeof parsed === "object"
      ? parsed as Record<string, unknown>
      : null

    const cardsSourceRaw = Array.isArray(parsed)
      ? parsed
      : Array.isArray(objectLike?.cards)
        ? objectLike.cards
        : []

    const cardsSource = cardsSourceRaw
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null
        }
        return normalizeCardDraft(item as Record<string, unknown>)
      })

    const cards = dedupeCards(
      cardsSource.filter((card): card is LabGeneratedCardInput => Boolean(card))
    )

    const invalidRows = cardsSource.filter((card) => !card).length

    const deck = objectLike?.deck && typeof objectLike.deck === "object"
      ? objectLike.deck as Record<string, unknown>
      : null

    const deckTitle = trimTo(normalizeCell(deck?.title ?? objectLike?.title), 120) || null
    const deckTopic = trimTo(normalizeCell(deck?.topic ?? objectLike?.topic), 200) || null

    return {
      cards,
      totalParsedRows: cardsSourceRaw.length,
      invalidRows,
      parseSucceeded: true,
      sourceFormat: "json",
      deckTitle,
      deckTopic,
    }
  }

  const delimiter = detectCsvDelimiter(source)
  const rows = parseCsvRows(source, delimiter)
  if (rows.length === 0) {
    return {
      cards: [],
      totalParsedRows: 0,
      invalidRows: 0,
      parseSucceeded: true,
      sourceFormat: "csv",
      deckTitle: null,
      deckTopic: null,
    }
  }

  const headerMap = getHeaderIndexMap(rows[0])
  const headerTermIndex = pickIndex(headerMap, ["term", "word", "spell", "단어", "표현"])
  const headerMeaningIndex = pickIndex(headerMap, ["meaning", "translation", "뜻", "의미"])
  const headerExampleIndex = pickIndex(headerMap, ["example", "sentence", "예문"])
  const headerExplanationIndex = pickIndex(headerMap, ["exampletranslation", "explanation", "examplemeaning", "예문해설", "해설"])
  const headerPosIndex = pickIndex(headerMap, ["partofspeech", "pos", "품사"])

  const hasHeader = headerTermIndex != null && headerMeaningIndex != null
  const startIndex = hasHeader ? 1 : 0

  const termIndex = hasHeader ? headerTermIndex : 0
  const meaningIndex = hasHeader ? headerMeaningIndex : 1
  const exampleIndex = hasHeader ? headerExampleIndex : 2
  const explanationIndex = hasHeader ? headerExplanationIndex : null
  const posIndex = hasHeader ? headerPosIndex : null

  const cards: LabGeneratedCardInput[] = []
  let invalidRows = 0

  for (let i = startIndex; i < rows.length; i += 1) {
    const row = rows[i]
    const baseDraft = {
      term: typeof termIndex === "number" ? row[termIndex] ?? "" : "",
      meaning: typeof meaningIndex === "number" ? row[meaningIndex] ?? "" : "",
      example: typeof exampleIndex === "number" ? row[exampleIndex] ?? "" : "",
      exampleTranslation: typeof explanationIndex === "number" ? row[explanationIndex] ?? "" : "",
      partOfSpeech: typeof posIndex === "number" ? row[posIndex] ?? "" : "",
    }
    let draft = normalizeCardDraft(baseDraft)

    if (!draft && row.length === 1) {
      const loose = splitLooseTermMeaning(row[0] ?? "")
      if (loose.term && loose.meaning) {
        draft = normalizeCardDraft({
          term: loose.term,
          meaning: loose.meaning,
          example: "",
          exampleTranslation: "",
        })
      }
    }

    if (!draft) {
      invalidRows += 1
      continue
    }

    cards.push(draft)
  }

  return {
    cards: dedupeCards(cards),
    totalParsedRows: Math.max(0, rows.length - startIndex),
    invalidRows,
    parseSucceeded: true,
    sourceFormat: "csv",
    deckTitle: null,
    deckTopic: null,
  }
}

export function buildLabTemplateCsv() {
  const rows = [
    ["term", "meaning", "partOfSpeech", "example", "exampleTranslation"],
    ["breeze", "산들바람", "noun", "A cool breeze makes the trail pleasant.", "시원한 바람이 산길을 쾌적하게 만든다."],
    ["drizzle", "이슬비", "noun", "Light drizzle started near the river.", "강가에 가랑비가 내리기 시작했다."],
    ["shelter", "대피소", "noun", "We found shelter from the sudden rain.", "갑작스러운 비를 피할 대피소를 찾았다."],
  ]

  return `\uFEFF${rows.map((row) => row.map(toCsvCell).join(",")).join("\n")}`
}

export function buildLabTemplateJson() {
  return JSON.stringify(
    {
      deck: {
        title: "Weekend Outing Vocabulary",
        topic: "Weather and safety words for local outings",
      },
      cards: [
        {
          term: "breeze",
          meaning: "산들바람",
          partOfSpeech: "noun",
          example: "A cool breeze makes the trail pleasant.",
          exampleTranslation: "시원한 바람이 산길을 쾌적하게 만든다.",
        },
        {
          term: "drizzle",
          meaning: "이슬비",
          partOfSpeech: "noun",
          example: "Light drizzle started near the river.",
          exampleTranslation: "강가에 가랑비가 내리기 시작했다.",
        },
        {
          term: "shelter",
          meaning: "대피소",
          partOfSpeech: "noun",
          example: "We found shelter from the sudden rain.",
          exampleTranslation: "갑작스러운 비를 피할 대피소를 찾았다.",
        },
      ],
    },
    null,
    2
  )
}

export function buildLabExportCsv(input: {
  deckTitle: string
  deckTopic: string
  cards: LabCardSnapshot[]
}) {
  const rows: Array<Array<string | number>> = [
    [
      "deckTitle",
      "deckTopic",
      "term",
      "meaning",
      "partOfSpeech",
      "example",
      "exampleTranslation",
      "learningState",
      "stage",
      "nextReviewAt",
      "lastReviewedAt",
      "totalReviews",
      "lapses",
      "difficulty",
      "stabilityDays",
      "retrievability",
    ],
  ]

  for (const card of input.cards) {
    rows.push([
      input.deckTitle,
      input.deckTopic,
      card.term,
      card.meaning,
      card.partOfSpeech ?? "",
      card.example ?? "",
      card.exampleTranslation ?? "",
      card.learningState,
      card.stage,
      card.nextReviewAt,
      card.lastReviewedAt ?? "",
      card.totalReviews,
      card.lapses,
      card.difficulty,
      card.stabilityDays,
      card.retrievability != null ? card.retrievability.toFixed(4) : "",
    ])
  }

  return `\uFEFF${rows.map((row) => row.map(toCsvCell).join(",")).join("\n")}`
}

export function sanitizeLabFilename(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return normalized || "lab-deck"
}
