"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { type ChangeEvent, useCallback, useEffect, useMemo, useState, useRef } from "react"
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FlaskConical,
  Flame,
  FolderPlus,
  Gauge,
  PencilLine,
  Plus,
  RefreshCcw,
  Sparkles,
  TrendingUp,
  Upload,
  Trash2,
} from "lucide-react"
import { useTheme } from "next-themes"

import { BorderBeam } from "@/components/magicui/border-beam"
import { MagicCard } from "@/components/magicui/magic-card"
import { Meteors } from "@/components/magicui/meteors"
import { Particles } from "@/components/magicui/particles"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { SectionCard, StatusMetric } from "@/components/dashboard/ui"
import { VocabReportPanel } from "@/components/lab/vocab-report-panel"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import { formatServerDateTime, parseServerTimestamp } from "@/lib/time/server-time"
import { cn } from "@/lib/utils"

const LAB_MIN_CARD_COUNT = 4
const LAB_MAX_CARD_COUNT = 50
const LAB_DEFAULT_CARD_COUNT = 10
const LAB_TOPIC_MAX_LENGTH = 220
const LAB_SRS_TOTAL_STAGES = 8
const LAB_IMPORT_SOURCE_MAX = 120_000

type LabUsageSnapshot = {
  metricDate: string
  generationCount: number
  remainingGenerations: number
  dailyGenerationLimit: number
  reviewCount: number
}

type LabDeckSnapshot = {
  id: string
  title: string
  topic: string
  cardCount: number
  createdAt: string
  locale?: "ko" | "en"
}

type LabCardSnapshot = {
  id: string
  deckId: string
  term: string
  meaning: string
  partOfSpeech: string | null
  example: string | null
  exampleTranslation: string | null
  learningState: "new" | "learning" | "review" | "relearning"
  stage: number
  stabilityDays: number
  difficulty: number
  retrievability: number | null
  totalReviews: number
  lapses: number
  nextReviewAt: string
  lastReviewedAt: string | null
}

type LabStateSnapshot = {
  usage: LabUsageSnapshot
  dueCards: LabCardSnapshot[]
  recentDecks: LabDeckSnapshot[]
}

type ApiErrorPayload = {
  error?: string
}

const LAB_COPY = {
  ko: {
    loading: "실험실을 불러오는 중...",
    loginRequired: "로그인이 필요합니다. 로그인 페이지로 이동합니다.",
    disabledTitle: "실험실 기능이 꺼져 있어요.",
    disabledDescription:
      "대시보드 프로필 설정에서 '실험실 기능 활성화'를 켜면 바로 사용할 수 있습니다.",
    goDashboard: "대시보드로 이동",
    badge: "experimental lab",
    title: "나들 실험실 · 단어 암기",
    subtitle:
      "프로필 기반으로 맞춤 학습 카드를 생성하고, SRS 복습으로 기억을 유지하는 실험 기능입니다.",
    quickGuideTitle: "빠른 사용 가이드",
    quickGuideStudy: "정답 확인 후 다시/어려움/보통/쉬움으로 복습 간격을 조절합니다.",
    quickGuideGenerate: "주제와 카드 수를 선택해 새 단어장을 만듭니다.",
    quickGuideManage: "수동 추가, 가져오기·내보내기, 단어장 설정을 처리합니다.",
    quickGuideReport: "기간별 복습량·난이도·상태 분포를 확인합니다.",
    usageRemaining: "오늘 생성 가능",
    usageCreated: "오늘 생성",
    usageReviewed: "오늘 복습",
    stateError: "실험실 상태를 불러오지 못했습니다.",
    reload: "다시 불러오기",
    topicLabel: "주제 입력",
    topicPlaceholder: "예: 주말 전주 나들이 영어 표현",
    invalidTopic: "주제를 2자 이상 입력해 주세요.",
    cardCountLabel: "생성 카드 수",
    generate: "카드 생성",
    generating: "생성 중...",
    generateHint: "AI가 주제에 맞춰 학습하기 좋은 실전 단어들을 자동으로 생성해 줍니다. 예문 해설 필드에 해석도 함께 추가됩니다.",
    generateUsageTitle: "자동 생성 현황",
    dueTitle: "지금 복습할 카드",
    reveal: "정답 보기",
    gradeAgain: "다시",
    gradeHard: "어려움",
    gradeGood: "보통",
    gradeEasy: "쉬움",
    reviewing: "반영 중...",
    learningState: "학습 상태",
    learningNew: "새 카드",
    learningLearning: "학습 중",
    learningReview: "장기 복습",
    learningRelearning: "재학습",
    stability: "기억 안정성",
    difficulty: "난이도",
    retrievability: "회상 확률",
    totalReviews: "누적 복습",
    lapses: "재학습 횟수",
    noDue: "지금 복습할 카드가 없습니다. 새 카드를 만들거나 다음 복습 시간을 기다려 주세요.",
    queueLabel: "대기 카드",
    recentDecks: "최근 생성 덱",
    noDecks: "아직 생성된 덱이 없습니다.",
    nextReviewAt: "다음 복습",
    stage: "단계",
    cards: "카드",
    generatedAt: "생성",
    tabStudy: "학습",
    tabGenerate: "자동 생성",
    tabManage: "관리",
    tabReport: "학습 보고서",
    whatToStudy: "어떤 단어장을 학습할까요?",
    stopStudy: "학습 중단",
    studyFinished: "단어장 복습을 마쳤습니다!",

    manageTitle: "단어장 관리",
    manageSubtitle: "단어장을 선택하면 카드 목록/수정/삭제/추가와 가져오기·내보내기를 한 화면에서 처리할 수 있습니다.",
    deckListTitle: "단어장 리스트",
    deckListHint: "왼쪽에서 단어장을 선택하면 오른쪽에 카드 목록이 표시됩니다.",
    selectDeckPrompt: "단어장을 선택해 주세요.",
    cardListTitle: "카드 목록",
    cardListHint: "카드를 클릭해 수정하거나 바로 삭제할 수 있습니다.",
    cardSearchPlaceholder: "단어/뜻 검색",
    cardEmpty: "이 단어장에 등록된 카드가 없습니다.",
    editCard: "수정",
    saveCard: "저장",
    cancelEdit: "취소",
    deleteCard: "삭제",
    deletingCard: "삭제 중...",
    cardsLoading: "카드 목록 불러오는 중...",
    deckSettings: "단어장 설정",
    deckSelect: "대상 단어장",
    deckName: "단어장 이름",
    deckTopic: "주제/설명",
    deckTopicPlaceholder: "예: 출퇴근 영어 표현",
    saveDeck: "설정 저장",
    savingDeck: "저장 중...",
    deleteDeck: "단어장 삭제",
    deletingDeck: "삭제 중...",
    deleteConfirm: "이 단어장과 내부에 포함된 모든 단어 카드가 완전히 삭제됩니다. 진행하시겠습니까?",
    cardDeleteConfirm: "이 카드를 삭제하시겠습니까?",
    createDeck: "새 단어장 만들기",
    creatingDeck: "생성 중...",
    createDeckHint: "생성 후 수동 추가와 가져오기에서 바로 선택할 수 있습니다.",

    manualTitle: "수동 카드 추가",
    manualTarget: "추가 대상",
    targetExistingDeck: "기존 단어장",
    targetNewDeck: "새 단어장",
    termLabel: "단어 (Term)",
    meaningLabel: "뜻 (Meaning)",
    posLabel: "품사 (POS)",
    exampleLabel: "예문 (Example)",
    exampleTranslationLabel: "예문 해설 (Explanation)",
    autoFill: "뜻/품사/예문 자동 완성",
    autoFilling: "채우는 중...",
    autoFillHint: "단어만 입력하고 누르면 현재 언어 기준으로 뜻/품사/예문/해설을 자동 생성합니다.",
    addCard: "카드 추가",
    addingCard: "추가 중...",
    manualHint: "중복 단어/뜻 조합은 자동으로 건너뜁니다.",

    transferTitle: "가져오기 · 내보내기",
    importFormat: "가져오기 형식",
    sourceLabel: "데이터 내용",
    sourcePlaceholderCsv: "CSV 내용을 붙여넣거나 파일 불러오기를 사용하세요.",
    sourcePlaceholderJson: "JSON 내용을 붙여넣거나 파일 불러오기를 사용하세요.",
    loadFile: "파일 불러오기",
    downloadTemplateCsv: "CSV 템플릿",
    downloadTemplateJson: "JSON 템플릿",
    importCards: "가져오기 실행",
    importingCards: "가져오는 중...",
    exportCsv: "CSV 내보내기",
    exportJson: "JSON 내보내기",
    exporting: "내보내는 중...",
    transferHint: "CSV는 엑셀에서 바로 열립니다. JSON은 학습 상태까지 백업할 때 유용합니다.",

    manageInvalidDeck: "대상 단어장을 선택해 주세요.",
    manageInvalidCard: "단어와 뜻을 모두 입력해 주세요.",
    manageInvalidTerm: "단어를 먼저 입력해 주세요.",
    manageInvalidSource: "가져올 데이터 내용을 입력해 주세요.",
    manageInvalidDeckName: "단어장 이름을 입력해 주세요.",

    messageDeckCreated: "새 단어장을 만들었습니다.",
    messageDeckSaved: "단어장 설정을 저장했습니다.",
    messageCardUpdated: "카드 내용을 저장했습니다.",
    messageCardDeleted: "카드를 삭제했습니다.",
    messageManualAdded: "수동 카드가 추가되었습니다.",
    messageManualAutofilled: "의미/예문을 자동으로 채웠습니다.",
    messageImported: "가져오기를 완료했습니다.",
    importAddedLabel: "추가",
    importSkippedLabel: "중복/건너뜀",
    importInvalidLabel: "형식 오류 행",
    messageExported: "내보내기를 완료했습니다.",
    messageTemplateDownloaded: "템플릿을 다운로드했습니다.",
  },
  en: {
    loading: "Loading lab...",
    loginRequired: "You need to log in first. Redirecting to login.",
    disabledTitle: "Lab is disabled.",
    disabledDescription:
      "Enable 'experimental lab' in dashboard profile settings to access this page.",
    goDashboard: "Go to dashboard",
    badge: "experimental lab",
    title: "Nadeul Lab · Vocabulary",
    subtitle:
      "Generate profile-tailored learning cards and keep them with SRS-based review.",
    quickGuideTitle: "Quick Usage Guide",
    quickGuideStudy: "Reveal answers and set Again/Hard/Good/Easy to control review spacing.",
    quickGuideGenerate: "Choose a topic and card count to create a new deck.",
    quickGuideManage: "Handle manual entry, import/export, and deck settings.",
    quickGuideReport: "Monitor review volume, difficulty, and state distribution by period.",
    usageRemaining: "Remaining today",
    usageCreated: "Generated today",
    usageReviewed: "Reviewed today",
    stateError: "Failed to load lab state.",
    reload: "Reload",
    topicLabel: "Topic",
    topicPlaceholder: "Example: practical weather expressions for outings",
    invalidTopic: "Please enter a topic with at least 2 characters.",
    cardCountLabel: "Cards to generate",
    generate: "Generate cards",
    generating: "Generating...",
    generateHint: "The AI automatically generates practical study cards tailored to your topic, complete with example translations.",
    generateUsageTitle: "Generation Status",
    dueTitle: "Cards due now",
    reveal: "Reveal answer",
    gradeAgain: "Again",
    gradeHard: "Hard",
    gradeGood: "Good",
    gradeEasy: "Easy",
    reviewing: "Applying...",
    learningState: "Learning state",
    learningNew: "New",
    learningLearning: "Learning",
    learningReview: "Review",
    learningRelearning: "Relearning",
    stability: "Stability",
    difficulty: "Difficulty",
    retrievability: "Retrievability",
    totalReviews: "Total reviews",
    lapses: "Lapses",
    noDue: "No cards are due right now. Generate new cards or come back at next review time.",
    queueLabel: "Queue",
    recentDecks: "Recent decks",
    noDecks: "No decks generated yet.",
    nextReviewAt: "Next review",
    stage: "Stage",
    cards: "Cards",
    generatedAt: "Created",
    tabStudy: "Study",
    tabGenerate: "Generate",
    tabManage: "Manage",
    tabReport: "Report",
    whatToStudy: "Which deck would you like to study?",
    stopStudy: "Stop studying",
    studyFinished: "Finished reviewing this deck!",

    manageTitle: "Deck Management",
    manageSubtitle: "Pick a deck, then manage card list/edit/delete/add plus import/export in one place.",
    deckListTitle: "Deck list",
    deckListHint: "Select a deck on the left to open its cards on the right.",
    selectDeckPrompt: "Please select a deck.",
    cardListTitle: "Card list",
    cardListHint: "Click a card to edit, or remove it immediately.",
    cardSearchPlaceholder: "Search term/meaning",
    cardEmpty: "No cards in this deck yet.",
    editCard: "Edit",
    saveCard: "Save",
    cancelEdit: "Cancel",
    deleteCard: "Delete",
    deletingCard: "Deleting...",
    cardsLoading: "Loading cards...",
    deckSettings: "Deck settings",
    deckSelect: "Target deck",
    deckName: "Deck name",
    deckTopic: "Topic / description",
    deckTopicPlaceholder: "Example: expressions for commuting",
    saveDeck: "Save settings",
    savingDeck: "Saving...",
    deleteDeck: "Delete deck",
    deletingDeck: "Deleting...",
    deleteConfirm: "This deck and all enclosed cards will be permanently deleted. Proceed?",
    cardDeleteConfirm: "Delete this card?",
    createDeck: "Create new deck",
    creatingDeck: "Creating...",
    createDeckHint: "After creation, it will be immediately available for manual add/import.",

    manualTitle: "Manual Card Entry",
    manualTarget: "Add target",
    targetExistingDeck: "Existing deck",
    targetNewDeck: "New deck",
    termLabel: "Word",
    meaningLabel: "Meaning",
    posLabel: "POS",
    exampleLabel: "Example (optional)",
    exampleTranslationLabel: "Example Explanation (optional)",
    autoFill: "Autofill meaning/pos/example",
    autoFilling: "Autofilling...",
    autoFillHint: "Enter a word and click once to auto-generate meaning, pos, example, and explanation in the current language.",
    addCard: "Add card",
    addingCard: "Adding...",
    manualHint: "Duplicate term+meaning combinations are skipped automatically.",

    transferTitle: "Import · Export",
    importFormat: "Import format",
    sourceLabel: "Source data",
    sourcePlaceholderCsv: "Paste CSV content or use file load.",
    sourcePlaceholderJson: "Paste JSON content or use file load.",
    loadFile: "Load file",
    downloadTemplateCsv: "CSV template",
    downloadTemplateJson: "JSON template",
    importCards: "Run import",
    importingCards: "Importing...",
    exportCsv: "Export CSV",
    exportJson: "Export JSON",
    exporting: "Exporting...",
    transferHint: "CSV opens directly in Excel. JSON is useful for richer backups.",

    manageInvalidDeck: "Please select a target deck.",
    manageInvalidCard: "Please provide both term and meaning.",
    manageInvalidTerm: "Please enter a term first.",
    manageInvalidSource: "Please provide import data.",
    manageInvalidDeckName: "Please enter a deck name.",

    messageDeckCreated: "New deck created.",
    messageDeckSaved: "Deck settings saved.",
    messageCardUpdated: "Card changes saved.",
    messageCardDeleted: "Card deleted.",
    messageManualAdded: "Manual card added.",
    messageManualAutofilled: "Meaning/example autofilled.",
    messageImported: "Import completed.",
    importAddedLabel: "added",
    importSkippedLabel: "skipped",
    importInvalidLabel: "invalid rows",
    messageExported: "Export completed.",
    messageTemplateDownloaded: "Template downloaded.",
  },
} as const

function formatLabDate(value: string, language: "ko" | "en") {
  const parsed = parseServerTimestamp(value)
  if (!parsed) {
    return value
  }
  return formatServerDateTime(parsed, language)
}

function formatLearningState(
  state: LabCardSnapshot["learningState"],
  copy: typeof LAB_COPY.ko | typeof LAB_COPY.en
) {
  switch (state) {
    case "review":
      return copy.learningReview
    case "learning":
      return copy.learningLearning
    case "relearning":
      return copy.learningRelearning
    default:
      return copy.learningNew
  }
}

function formatRatioPercent(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-"
  }

  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

async function parseApiError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as ApiErrorPayload
    if (typeof payload.error === "string" && payload.error.trim().length > 0) {
      return payload.error
    }
  } catch {
    // no-op
  }
  return fallback
}

function parseFilenameFromDisposition(value: string | null) {
  if (!value) {
    return null
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const plainMatch = value.match(/filename="?([^";]+)"?/i)
  return plainMatch?.[1] ?? null
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export default function LabPage() {
  const router = useRouter()
  const { user, status } = useAuth()
  const { language } = useLanguage()
  const { resolvedTheme } = useTheme()
  const copy = LAB_COPY[language]

  const [state, setState] = useState<LabStateSnapshot | null>(null)
  const [stateError, setStateError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [topic, setTopic] = useState("")
  const [cardCount, setCardCount] = useState(LAB_DEFAULT_CARD_COUNT)
  const [isGenerating, setIsGenerating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [answerVisible, setAnswerVisible] = useState(false)
  const [isCompactViewport, setIsCompactViewport] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isLowPowerDevice, setIsLowPowerDevice] = useState(false)
  const [viewMode, setViewMode] = useState<"study" | "generate" | "manage" | "report">("study")
  const [selectedStudyDeckId, setSelectedStudyDeckId] = useState<string | null>(null)

  const [decks, setDecks] = useState<LabDeckSnapshot[]>([])
  const [isDecksLoading, setIsDecksLoading] = useState(false)
  const [selectedDeckId, setSelectedDeckId] = useState("")
  const [deckEditTitle, setDeckEditTitle] = useState("")
  const [deckEditTopic, setDeckEditTopic] = useState("")
  const [newDeckTitle, setNewDeckTitle] = useState("")
  const [newDeckTopic, setNewDeckTopic] = useState("")
  const [isCreatingDeck, setIsCreatingDeck] = useState(false)
  const [isSavingDeck, setIsSavingDeck] = useState(false)
  const [isDeletingDeck, setIsDeletingDeck] = useState(false)
  const [deckCards, setDeckCards] = useState<LabCardSnapshot[]>([])
  const [isDeckCardsLoading, setIsDeckCardsLoading] = useState(false)
  const [deckCardSearch, setDeckCardSearch] = useState("")
  const [editingCardId, setEditingCardId] = useState("")
  const [editingTerm, setEditingTerm] = useState("")
  const [editingMeaning, setEditingMeaning] = useState("")
  const [editingPos, setEditingPos] = useState("")
  const [editingExample, setEditingExample] = useState("")
  const [editingExampleTranslation, setEditingExampleTranslation] = useState("")
  const [isUpdatingCard, setIsUpdatingCard] = useState(false)
  const [deletingCardId, setDeletingCardId] = useState("")

  const [manualTerm, setManualTerm] = useState("")
  const [manualMeaning, setManualMeaning] = useState("")
  const [manualPos, setManualPos] = useState("")
  const [manualExample, setManualExample] = useState("")
  const [manualExampleTranslation, setManualExampleTranslation] = useState("")
  const [isAddingManualCard, setIsAddingManualCard] = useState(false)
  const [isAutofillingManualCard, setIsAutofillingManualCard] = useState(false)

  const [importFormat, setImportFormat] = useState<"csv" | "json">("csv")
  const [importSource, setImportSource] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const [manageError, setManageError] = useState<string | null>(null)
  const [manageMessage, setManageMessage] = useState<string | null>(null)
  const [isCreateMode, setIsCreateMode] = useState(false)

  const syncQueue = useRef<{cardId: number, grade: number}[]>([])
  const syncTimer = useRef<NodeJS.Timeout | null>(null)
  const loadStateRef = useRef<() => Promise<void>>(async () => {})

  const flushSyncQueue = useCallback(async () => {
    if (syncQueue.current.length === 0) return

    const currentBatch = [...syncQueue.current]
    syncQueue.current = [] // Clear locally

    try {
      const response = await fetch("/api/lab/review/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": language,
        },
        credentials: "include",
        body: JSON.stringify({ reviews: currentBatch }),
      })

      if (!response.ok) {
        void loadStateRef.current()
      } else {
        const payload = (await response.json()) as { state?: LabStateSnapshot }
        // To avoid race conditions, only set the remote state if the user hasn't clicked again (queue is empty).
        if (syncQueue.current.length === 0 && payload.state) {
          setState(payload.state)
        }
      }
    } catch {
      void loadStateRef.current()
    }
  }, [language])

  // Flush remaining ops safely if the user closes the app/tab
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (syncQueue.current.length > 0) {
        const blob = new Blob([JSON.stringify({ reviews: syncQueue.current })], { type: 'application/json' });
        navigator.sendBeacon("/api/lab/review/batch", blob);
        syncQueue.current = []
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [])

  const particleColor = resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"
  const reduceVisualEffects = prefersReducedMotion || isCompactViewport || isLowPowerDevice
  const backgroundMotionEnabled = !reduceVisualEffects
  const particleQuantity = reduceVisualEffects ? 18 : 36
  const particleFps = reduceVisualEffects ? 10 : 16
  const meteorCount = reduceVisualEffects ? 0 : 3

  const loadState = useCallback(async () => {
    if (!user?.labEnabled) {
      return
    }

    setIsLoading(true)
    setStateError(null)
    setActionError(null)

    try {
      const response = await fetch("/api/lab/state", {
        method: "GET",
        headers: {
          "Accept-Language": language,
        },
        cache: "no-store",
        credentials: "include",
      })

      if (response.status === 401) {
        router.replace("/login")
        return
      }

      if (!response.ok) {
        setStateError(await parseApiError(response, copy.stateError))
        return
      }

      const payload = (await response.json()) as { state?: LabStateSnapshot }
      setState(payload.state ?? null)
    } catch (error) {
      console.error("Failed to load lab state:", error)
      setStateError(copy.stateError)
    } finally {
      setIsLoading(false)
    }
  }, [copy.stateError, language, router, user?.labEnabled])

  useEffect(() => {
    loadStateRef.current = loadState
  }, [loadState])

  const loadDecks = useCallback(async () => {
    if (!user?.labEnabled) {
      return
    }

    setIsDecksLoading(true)

    try {
      const response = await fetch("/api/lab/decks", {
        method: "GET",
        headers: {
          "Accept-Language": language,
        },
        cache: "no-store",
        credentials: "include",
      })

      if (response.status === 401) {
        router.replace("/login")
        return
      }

      if (!response.ok) {
        setManageError(await parseApiError(response, copy.stateError))
        return
      }

      const payload = (await response.json()) as { decks?: LabDeckSnapshot[] }
      setDecks(Array.isArray(payload.decks) ? payload.decks : [])
    } catch (error) {
      console.error("Failed to load lab decks:", error)
      setManageError(copy.stateError)
    } finally {
      setIsDecksLoading(false)
    }
  }, [copy.stateError, language, router, user?.labEnabled])

  const loadDeckCards = useCallback(async (deckIdInput?: string) => {
    const targetDeckId = (deckIdInput ?? selectedDeckId).trim()
    if (!targetDeckId) {
      setDeckCards([])
      return
    }

    setIsDeckCardsLoading(true)

    try {
      const response = await fetch(`/api/lab/cards?deckId=${encodeURIComponent(targetDeckId)}`, {
        method: "GET",
        headers: {
          "Accept-Language": language,
        },
        cache: "no-store",
        credentials: "include",
      })

      if (response.status === 401) {
        router.replace("/login")
        return
      }

      if (!response.ok) {
        setManageError(await parseApiError(response, copy.stateError))
        return
      }

      const payload = (await response.json()) as {
        cards?: LabCardSnapshot[]
      }
      setDeckCards(Array.isArray(payload.cards) ? payload.cards : [])
    } catch (error) {
      console.error("Failed to load deck cards:", error)
      setManageError(copy.stateError)
    } finally {
      setIsDeckCardsLoading(false)
    }
  }, [copy.stateError, language, router, selectedDeckId])

  useEffect(() => {
    if (status === "authenticated" && user?.labEnabled) {
      void Promise.all([loadState(), loadDecks()])
    }
  }, [loadDecks, loadState, status, user?.labEnabled])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const applyMotionPreference = () => {
      setPrefersReducedMotion(media.matches)
    }
    const applyViewportMode = () => {
      setIsCompactViewport(window.innerWidth < 768)
    }
    const applyPowerProfile = () => {
      const nav = navigator as Navigator & { deviceMemory?: number }
      const cpuCores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : 8
      const memoryGiB = typeof nav.deviceMemory === "number" ? nav.deviceMemory : 8
      setIsLowPowerDevice(cpuCores <= 4 || memoryGiB <= 4)
    }

    applyMotionPreference()
    applyViewportMode()
    applyPowerProfile()

    window.addEventListener("resize", applyViewportMode, { passive: true })
    media.addEventListener("change", applyMotionPreference)

    return () => {
      window.removeEventListener("resize", applyViewportMode)
      media.removeEventListener("change", applyMotionPreference)
    }
  }, [])

  useEffect(() => {
    if (status === "guest") {
      const timeout = window.setTimeout(() => {
        router.replace("/login")
      }, 450)
      return () => window.clearTimeout(timeout)
    }
  }, [router, status])

  useEffect(() => {
    if (decks.length === 0) {
      setSelectedDeckId("")
      setDeckCards([])
      return
    }

    setSelectedDeckId((previous) => (
      decks.some((deck) => deck.id === previous)
        ? previous
        : decks[0].id
    ))
  }, [decks])

  useEffect(() => {
    if (!selectedDeckId) {
      setDeckCards([])
      return
    }
    void loadDeckCards(selectedDeckId)
  }, [loadDeckCards, selectedDeckId])

  useEffect(() => {
    const selectedDeck = decks.find((deck) => deck.id === selectedDeckId)
    if (!selectedDeck) {
      setDeckEditTitle("")
      setDeckEditTopic("")
      return
    }

    setDeckEditTitle(selectedDeck.title)
    setDeckEditTopic(selectedDeck.topic === "-" ? "" : selectedDeck.topic)
  }, [decks, selectedDeckId])

  useEffect(() => {
    setManageError(null)
    setManageMessage(null)
  }, [language])

  const dueDecks = useMemo(() => {
    if (!state?.dueCards) return []
    const groups: Record<string, { id: string; title: string; topic: string; count: number }> = {}
    for (const card of state.dueCards) {
      if (!groups[card.deckId]) {
        const deck = decks.find((d) => String(d.id) === String(card.deckId)) || state.recentDecks.find((d) => String(d.id) === String(card.deckId))
        groups[card.deckId] = {
          id: card.deckId,
          title: deck?.title || "알 수 없는 단어장",
          topic: deck?.topic || "",
          count: 0,
        }
      }
      groups[card.deckId].count++
    }
    return Object.values(groups)
  }, [state?.dueCards, decks, state?.recentDecks])

  const activeCard = useMemo(() => {
    if (!state?.dueCards || !selectedStudyDeckId) return null
    return state.dueCards.find((c) => String(c.deckId) === String(selectedStudyDeckId)) ?? null
  }, [state?.dueCards, selectedStudyDeckId])

  const queuedCards = useMemo(() => {
    if (!state?.dueCards || !selectedStudyDeckId) return []
    return state.dueCards.filter((c) => String(c.deckId) === String(selectedStudyDeckId) && c.id !== activeCard?.id).slice(0, 5)
  }, [state?.dueCards, selectedStudyDeckId, activeCard])

  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId) ?? null
  const filteredDeckCards = useMemo(() => {
    const keyword = deckCardSearch.trim().toLowerCase()
    if (!keyword) {
      return deckCards
    }
    return deckCards.filter((card) => {
      const term = card.term.toLowerCase()
      const meaning = card.meaning.toLowerCase()
      const example = (card.example ?? "").toLowerCase()
      return term.includes(keyword) || meaning.includes(keyword) || example.includes(keyword)
    })
  }, [deckCardSearch, deckCards])

  const stageProgress = useMemo(() => {
    if (!activeCard) return 0
    const safeStage = Math.max(0, Math.min(LAB_SRS_TOTAL_STAGES - 1, activeCard.stage))
    return ((safeStage + 1) / LAB_SRS_TOTAL_STAGES) * 100
  }, [activeCard])

  const handleGenerate = async () => {
    const normalizedTopic = topic.replace(/\s+/g, " ").trim()
    if (normalizedTopic.length < 2) {
      setActionError(copy.invalidTopic)
      return
    }

    setIsGenerating(true)
    setActionError(null)
    setAnswerVisible(false)

    try {
      const response = await fetch("/api/lab/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": language,
        },
        credentials: "include",
        body: JSON.stringify({
          topic: normalizedTopic,
          cardCount,
        }),
      })

      if (!response.ok) {
        setActionError(await parseApiError(response, copy.stateError))
        return
      }

      const payload = (await response.json()) as { state?: LabStateSnapshot }
      setState(payload.state ?? null)
      setTopic("")
      setManageMessage(null)
      setManageError(null)
      await loadDecks()
    } catch (error) {
      console.error("Lab generate failed:", error)
      setActionError(copy.stateError)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleReview = (grade: 1 | 2 | 3 | 4) => {
    if (!activeCard || !state) return

    const cardIdToReview = activeCard.id

    // Enqueue the review operation locally
    syncQueue.current.push({
      cardId: Number(cardIdToReview),
      grade
    })

    // Optimistic UI Update
    setState((prev) => {
      if (!prev) return prev
      const newDue = prev.dueCards.filter((c) => c.id !== cardIdToReview)
      if (grade === 1) {
        newDue.push(activeCard)
      }
      return { ...prev, dueCards: newDue }
    })
    
    setAnswerVisible(false)
    setActionError(null)

    // Manage Debouncing / Batching
    if (syncTimer.current) clearTimeout(syncTimer.current)
    
    // Auto-flush if threshold is hit, else wait 3.5s of inactivity
    if (syncQueue.current.length >= 5) {
       void flushSyncQueue()
    } else {
       syncTimer.current = setTimeout(() => {
          void flushSyncQueue()
       }, 3500)
    }
  }

  const handleCreateDeck = async () => {
    const title = newDeckTitle.replace(/\s+/g, " ").trim()
    const topicValue = newDeckTopic.replace(/\s+/g, " ").trim()

    if (!title) {
      setManageError(copy.manageInvalidDeckName)
      return
    }

    setIsCreatingDeck(true)
    setManageError(null)
    setManageMessage(null)

    try {
      const response = await fetch("/api/lab/decks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": language,
        },
        credentials: "include",
        body: JSON.stringify({
          title,
          topic: topicValue,
        }),
      })

      if (!response.ok) {
        setManageError(await parseApiError(response, copy.stateError))
        return
      }

      const payload = (await response.json()) as {
        deck?: LabDeckSnapshot
        decks?: LabDeckSnapshot[]
      }

      if (Array.isArray(payload.decks)) {
        setDecks(payload.decks)
      }

      if (payload.deck?.id) {
        setSelectedDeckId(payload.deck.id)
        setDeckCardSearch("")
        await loadDeckCards(payload.deck.id)
      }

      setNewDeckTitle("")
      setNewDeckTopic("")
      setManageMessage(copy.messageDeckCreated)
      await loadState()
    } catch (error) {
      console.error("Deck create failed:", error)
      setManageError(copy.stateError)
    } finally {
      setIsCreatingDeck(false)
    }
  }

  const handleDeleteDeck = async () => {
    if (!selectedDeckId) return
    if (!window.confirm(copy.deleteConfirm)) return

    setIsDeletingDeck(true)
    setManageError(null)
    setManageMessage(null)

    try {
      const response = await fetch(`/api/lab/decks?deckId=${encodeURIComponent(selectedDeckId)}`, {
        method: "DELETE",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": language,
        },
        credentials: "include",
      })

      if (!response.ok) {
        setManageError(await parseApiError(response, copy.stateError))
        return
      }

      const payload = await response.json()
      setDecks(payload.decks || [])
      setSelectedDeckId("")
      setDeckEditTitle("")
      setDeckEditTopic("")
      setDeckCards([])
      void loadState()
    } catch (error) {
      console.error("Deck delete failed:", error)
      setManageError(copy.stateError)
    } finally {
      setIsDeletingDeck(false)
    }
  }

  const handleSaveDeck = async () => {
    if (!selectedDeckId) {
      setManageError(copy.manageInvalidDeck)
      return
    }

    const title = deckEditTitle.replace(/\s+/g, " ").trim()
    const topicValue = deckEditTopic.replace(/\s+/g, " ").trim()

    if (!title) {
      setManageError(copy.manageInvalidDeckName)
      return
    }

    setIsSavingDeck(true)
    setManageError(null)
    setManageMessage(null)

    try {
      const response = await fetch("/api/lab/decks", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": language,
        },
        credentials: "include",
        body: JSON.stringify({
          deckId: Number(selectedDeckId),
          title,
          topic: topicValue,
        }),
      })

      if (!response.ok) {
        setManageError(await parseApiError(response, copy.stateError))
        return
      }

      const payload = (await response.json()) as {
        decks?: LabDeckSnapshot[]
      }

      if (Array.isArray(payload.decks)) {
        setDecks(payload.decks)
      }

      setManageMessage(copy.messageDeckSaved)
      await loadDeckCards(selectedDeckId)
      await loadState()
    } catch (error) {
      console.error("Deck update failed:", error)
      setManageError(copy.stateError)
    } finally {
      setIsSavingDeck(false)
    }
  }

  const handleAutofillManualCard = async () => {
    const term = manualTerm.replace(/\s+/g, " ").trim()
    if (!term) {
      setManageError(copy.manageInvalidTerm)
      return
    }

    setIsAutofillingManualCard(true)
    setManageError(null)
    setManageMessage(null)

    try {
      const response = await fetch("/api/lab/cards/autofill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": language,
        },
        credentials: "include",
        body: JSON.stringify({ term }),
      })

      if (!response.ok) {
        setManageError(await parseApiError(response, copy.stateError))
        return
      }

      const payload = (await response.json()) as {
        card?: {
          meaning?: string | null
          partOfSpeech?: string | null
          example?: string | null
          exampleTranslation?: string | null
        }
      }

      setManualMeaning((payload.card?.meaning ?? "").slice(0, 220))
      setManualPos((payload.card?.partOfSpeech ?? "").slice(0, 40))
      setManualExample((payload.card?.example ?? "").slice(0, 280))
      setManualExampleTranslation((payload.card?.exampleTranslation ?? "").slice(0, 280))
      setManageMessage(copy.messageManualAutofilled)
    } catch (error) {
      console.error("Manual card autofill failed:", error)
      setManageError(copy.stateError)
    } finally {
      setIsAutofillingManualCard(false)
    }
  }

  const handleAddManualCard = async () => {
    const term = manualTerm.replace(/\s+/g, " ").trim()
    const meaning = manualMeaning.replace(/\s+/g, " ").trim()
    const partOfSpeech = manualPos.replace(/\s+/g, " ").trim()
    const example = manualExample.replace(/\s+/g, " ").trim()
    const exampleTranslation = manualExampleTranslation.replace(/\s+/g, " ").trim()

    if (!term || !meaning) {
      setManageError(copy.manageInvalidCard)
      return
    }

    if (!selectedDeckId) {
      setManageError(copy.manageInvalidDeck)
      return
    }

    setIsAddingManualCard(true)
    setManageError(null)
    setManageMessage(null)

    try {
      const response = await fetch("/api/lab/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": language,
        },
        credentials: "include",
        body: JSON.stringify({
          deckId: Number(selectedDeckId),
          deckTitle: null,
          deckTopic: null,
          card: {
            term,
            meaning,
            partOfSpeech: partOfSpeech || null,
            example: example || null,
            exampleTranslation: exampleTranslation || null,
          },
        }),
      })

      if (!response.ok) {
        setManageError(await parseApiError(response, copy.stateError))
        return
      }

      const payload = (await response.json()) as {
        deck?: LabDeckSnapshot
        state?: LabStateSnapshot
      }

      if (payload.state) {
        setState(payload.state)
      }
      if (payload.deck?.id) {
        setSelectedDeckId(payload.deck.id)
      }

      setManualTerm("")
      setManualMeaning("")
      setManualPos("")
      setManualExample("")
      setManualExampleTranslation("")
      setManageMessage(copy.messageManualAdded)

      await loadDeckCards(selectedDeckId)
      await loadDecks()
      setIsCreateMode(false)
    } catch (error) {
      console.error("Manual card add failed:", error)
      setManageError(copy.stateError)
    } finally {
      setIsAddingManualCard(false)
    }
  }

  const handleImportFromFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) {
      return
    }

    try {
      const text = await file.text()
      setImportSource(text.slice(0, LAB_IMPORT_SOURCE_MAX))

      const lowered = file.name.toLowerCase()
      if (lowered.endsWith(".json")) {
        setImportFormat("json")
      } else if (lowered.endsWith(".csv")) {
        setImportFormat("csv")
      }
    } catch (error) {
      console.error("Failed to read import file:", error)
      setManageError(copy.stateError)
    }
  }

  const handleImport = async () => {
    const source = importSource.trim()

    if (!source) {
      setManageError(copy.manageInvalidSource)
      return
    }

    if (!selectedDeckId) {
      setManageError(copy.manageInvalidDeck)
      return
    }

    setIsImporting(true)
    setManageError(null)
    setManageMessage(null)

    try {
      const response = await fetch("/api/lab/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": language,
        },
        credentials: "include",
        body: JSON.stringify({
          format: importFormat,
          source: source.slice(0, LAB_IMPORT_SOURCE_MAX),
          deckId: Number(selectedDeckId),
          deckTitle: null,
          deckTopic: null,
        }),
      })

      if (!response.ok) {
        setManageError(await parseApiError(response, copy.stateError))
        return
      }

      const payload = (await response.json()) as {
        deck?: LabDeckSnapshot
        addedCount?: number
        skippedCount?: number
        invalidRows?: number
        state?: LabStateSnapshot
      }

      if (payload.state) {
        setState(payload.state)
      }
      if (payload.deck?.id) {
        setSelectedDeckId(payload.deck.id)
      }

      setImportSource("")
      const addedCount = payload.addedCount ?? 0
      const skippedCount = payload.skippedCount ?? 0
      const invalidRows = payload.invalidRows ?? 0
      setManageMessage([
        copy.messageImported,
        `(${copy.importAddedLabel}: ${addedCount}`,
        `${copy.importSkippedLabel}: ${skippedCount}`,
        `${copy.importInvalidLabel}: ${invalidRows})`,
      ].join(" "))

      await loadDeckCards(selectedDeckId)
      await loadDecks()
      setIsCreateMode(false)
    } catch (error) {
      console.error("Import failed:", error)
      setManageError(copy.stateError)
    } finally {
      setIsImporting(false)
    }
  }

  const handleTemplateDownload = async (format: "csv" | "json") => {
    setIsDownloadingTemplate(true)
    setManageError(null)

    try {
      const response = await fetch(`/api/lab/template?format=${format}`, {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) {
        setManageError(await parseApiError(response, copy.stateError))
        return
      }

      const blob = await response.blob()
      const fileName = parseFilenameFromDisposition(response.headers.get("content-disposition"))
        ?? `lab-import-template.${format}`
      downloadBlob(blob, fileName)
      setManageMessage(copy.messageTemplateDownloaded)
    } catch (error) {
      console.error("Template download failed:", error)
      setManageError(copy.stateError)
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  const handleExport = async (format: "csv" | "json") => {
    if (!selectedDeckId) {
      setManageError(copy.manageInvalidDeck)
      return
    }

    setIsExporting(true)
    setManageError(null)

    try {
      const response = await fetch(
        `/api/lab/export?deckId=${encodeURIComponent(selectedDeckId)}&format=${format}`,
        {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: {
            "Accept-Language": language,
          },
        }
      )

      if (!response.ok) {
        setManageError(await parseApiError(response, copy.stateError))
        return
      }

      const blob = await response.blob()
      const fileName = parseFilenameFromDisposition(response.headers.get("content-disposition"))
        ?? `${selectedDeck?.title ?? "lab-deck"}.${format}`
      downloadBlob(blob, fileName)
      setManageMessage(copy.messageExported)
    } catch (error) {
      console.error("Export failed:", error)
      setManageError(copy.stateError)
    } finally {
      setIsExporting(false)
    }
  }

  const handleStartCardEdit = (card: LabCardSnapshot) => {
    setEditingCardId(card.id)
    setEditingTerm(card.term)
    setEditingMeaning(card.meaning)
    setEditingPos(card.partOfSpeech ?? "")
    setEditingExample(card.example ?? "")
    setEditingExampleTranslation(card.exampleTranslation ?? "")
    setManageError(null)
    setManageMessage(null)
  }

  const handleCancelCardEdit = () => {
    setEditingCardId("")
    setEditingTerm("")
    setEditingMeaning("")
    setEditingExample("")
    setEditingExampleTranslation("")
  }

  const handleSaveCardEdit = async () => {
    if (!editingCardId) {
      return
    }

    const term = editingTerm.replace(/\s+/g, " ").trim()
    const meaning = editingMeaning.replace(/\s+/g, " ").trim()
    const partOfSpeech = editingPos.replace(/\s+/g, " ").trim()
    const example = editingExample.replace(/\s+/g, " ").trim()
    const exampleTranslation = editingExampleTranslation.replace(/\s+/g, " ").trim()

    if (!term || !meaning) {
      setManageError(copy.manageInvalidCard)
      return
    }

    setIsUpdatingCard(true)
    setManageError(null)
    setManageMessage(null)

    try {
      const response = await fetch("/api/lab/cards", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": language,
        },
        credentials: "include",
        body: JSON.stringify({
          cardId: Number(editingCardId),
          card: {
            term,
            meaning,
            partOfSpeech: partOfSpeech || null,
            example: example || null,
            exampleTranslation: exampleTranslation || null,
          },
        }),
      })

      if (!response.ok) {
        setManageError(await parseApiError(response, copy.stateError))
        return
      }

      const payload = (await response.json()) as {
        card?: LabCardSnapshot
        state?: LabStateSnapshot
      }

      if (payload.card) {
        setDeckCards((previous) => previous.map((card) => (
          card.id === payload.card?.id ? payload.card : card
        )))
      } else {
        await loadDeckCards(selectedDeckId)
      }

      if (payload.state) {
        setState(payload.state)
      }

      setManageMessage(copy.messageCardUpdated)
      handleCancelCardEdit()
      await loadDecks()
    } catch (error) {
      console.error("Card update failed:", error)
      setManageError(copy.stateError)
    } finally {
      setIsUpdatingCard(false)
    }
  }

  const handleDeleteCard = async (cardId: string) => {
    if (!cardId) {
      return
    }

    setDeletingCardId(cardId)
    setManageError(null)
    setManageMessage(null)

    try {
      const response = await fetch(`/api/lab/cards?cardId=${encodeURIComponent(cardId)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": language,
        },
        credentials: "include",
      })

      if (!response.ok) {
        setManageError(await parseApiError(response, copy.stateError))
        return
      }

      const payload = (await response.json()) as {
        state?: LabStateSnapshot
      }
      setDeckCards((previous) => previous.filter((card) => card.id !== cardId))
      if (payload.state) {
        setState(payload.state)
      }
      setManageMessage(copy.messageCardDeleted)
      if (editingCardId === cardId) {
        handleCancelCardEdit()
      }
      await loadDecks()
    } catch (error) {
      console.error("Card delete failed:", error)
      setManageError(copy.stateError)
    } finally {
      setDeletingCardId("")
    }
  }

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-center text-base font-bold text-sky-blue">
        {copy.loading}
      </main>
    )
  }

  if (status === "guest" || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-center text-base font-bold text-sky-blue">
        {copy.loginRequired}
      </main>
    )
  }

  if (!user.labEnabled) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-background px-4 pb-14 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        {backgroundMotionEnabled ? (
          <>
            <Particles
              className="absolute inset-0 z-0 opacity-65"
              quantity={particleQuantity}
              fps={particleFps}
              ease={80}
              color={particleColor}
              refresh
            />
            {meteorCount > 0 ? <Meteors number={meteorCount} className="z-0" /> : null}
          </>
        ) : null}
        <div className="relative z-10 mx-auto max-w-3xl">
          <SectionCard>
            <div className="space-y-4 text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-active-blue">
                <FlaskConical className="size-3.5" />
                {copy.badge}
              </span>
              <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                {copy.disabledTitle}
              </h1>
              <p className="mx-auto max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                {copy.disabledDescription}
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-[1.25rem] border border-sky-blue/30 bg-sky-blue/10 px-5 py-3 text-base font-black text-sky-blue transition hover:border-sky-blue hover:bg-sky-blue/20"
              >
                {copy.goDashboard}
              </Link>
            </div>
          </SectionCard>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 pb-14 pt-24 sm:px-6 sm:pt-28 lg:px-8">
      {backgroundMotionEnabled ? (
        <>
          <Particles
            className="absolute inset-0 z-0 opacity-70"
            quantity={particleQuantity}
            fps={particleFps}
            ease={80}
            color={particleColor}
            refresh
          />
          {meteorCount > 0 ? <Meteors number={meteorCount} className="z-0" /> : null}
        </>
      ) : null}

      <div className="relative z-10 mx-auto max-w-[82rem] 2xl:max-w-[86rem]">
        <SectionCard className="mb-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(18rem,0.88fr)] xl:items-stretch">
            <div className="space-y-4 rounded-[1.5rem] border border-card-border/70 bg-background/70 p-4 sm:p-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-active-blue">
                <Sparkles className="size-3.5" />
                {copy.badge}
              </span>
              <div className="space-y-3">
                <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">{copy.title}</h1>
                <p className="max-w-3xl text-lg leading-8 text-muted-foreground sm:text-xl">{copy.subtitle}</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-card-border/70 bg-background/70 p-4 sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">{copy.quickGuideTitle}</p>
              <ul className="mt-3 space-y-2.5 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                <li><span className="font-black text-foreground">{copy.tabStudy}</span> · {copy.quickGuideStudy}</li>
                <li><span className="font-black text-foreground">{copy.tabGenerate}</span> · {copy.quickGuideGenerate}</li>
                <li><span className="font-black text-foreground">{copy.tabManage}</span> · {copy.quickGuideManage}</li>
                <li><span className="font-black text-foreground">{copy.tabReport}</span> · {copy.quickGuideReport}</li>
              </ul>
            </div>
          </div>
        </SectionCard>

        <div className="mx-auto mb-8 flex max-w-fit items-center gap-1 rounded-full border border-card-border/70 bg-card/60 p-1.5 shadow-sm backdrop-blur-md">
          <button
            onClick={() => setViewMode("study")}
            className={cn(
              "rounded-full px-5 py-2.5 text-sm font-black transition-all sm:text-base",
              viewMode === "study"
                ? "bg-sky-blue/15 text-sky-blue"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            )}
          >
            {copy.tabStudy}
          </button>
          <button
            onClick={() => setViewMode("generate")}
            className={cn(
              "rounded-full px-5 py-2.5 text-sm font-black transition-all sm:text-base",
              viewMode === "generate"
                ? "bg-sky-blue/15 text-sky-blue"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            )}
          >
            {copy.tabGenerate}
          </button>
          <button
            onClick={() => setViewMode("manage")}
            className={cn(
              "rounded-full px-5 py-2.5 text-sm font-black transition-all sm:text-base",
              viewMode === "manage"
                ? "bg-sky-blue/15 text-sky-blue"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            )}
          >
            {copy.tabManage}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("report")}
            className={cn(
              "rounded-full px-5 py-2.5 text-sm font-black transition-all sm:text-base",
              viewMode === "report"
                ? "bg-sky-blue/15 text-sky-blue"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            )}
          >
            {copy.tabReport}
          </button>
        </div>

        {viewMode === "generate" && (
          <div className="mx-auto max-w-[66rem]">
            <SectionCard className="min-w-0">
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">{copy.generateUsageTitle}</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <StatusMetric label={copy.usageRemaining} value={String(state?.usage.remainingGenerations ?? 0)} compact />
                  <StatusMetric
                    label={copy.usageCreated}
                    value={`${state?.usage.generationCount ?? 0}/${state?.usage.dailyGenerationLimit ?? 0}`}
                    compact
                  />
                  <StatusMetric label={copy.usageReviewed} value={String(state?.usage.reviewCount ?? 0)} compact />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">
                  {copy.topicLabel}
                </p>
                <textarea
                  value={topic}
                  onChange={(event) => setTopic(event.target.value.slice(0, LAB_TOPIC_MAX_LENGTH))}
                  placeholder={copy.topicPlaceholder}
                  className="h-28 w-full resize-none rounded-[1.2rem] border border-card-border/70 bg-background/80 px-4 py-3 text-base font-medium text-foreground shadow-inner outline-none transition focus:border-sky-blue/35 focus:ring-2 focus:ring-sky-blue/15 sm:text-sm"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {copy.cardCountLabel}: <span className="font-black text-foreground">{cardCount}</span>
                  </label>
                  <input
                    type="range"
                    min={LAB_MIN_CARD_COUNT}
                    max={LAB_MAX_CARD_COUNT}
                    value={cardCount}
                    onChange={(event) => setCardCount(Number(event.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-card-border/60 accent-sky-blue sm:w-56"
                  />
                </div>
              </div>

              <ShimmerButton
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isGenerating}
                className="w-full rounded-[1.4rem] py-4 text-base font-black"
              >
                {isGenerating ? copy.generating : copy.generate}
              </ShimmerButton>

              <p className="text-sm leading-7 text-muted-foreground">{copy.generateHint}</p>

              {actionError ? (
                <p className="rounded-[1rem] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
                  {actionError}
                </p>
              ) : null}

              {stateError ? (
                <div className="rounded-[1rem] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
                  <div className="flex items-center justify-between gap-3">
                    <span>{stateError}</span>
                    <button
                      type="button"
                      onClick={() => void loadState()}
                      className="inline-flex items-center gap-1 rounded-full border border-danger/30 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em]"
                    >
                      <RefreshCcw className={cn("size-3.5", isLoading && "animate-spin")} />
                      {copy.reload}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">
                  {copy.recentDecks}
                </p>
                {state?.recentDecks.length ? (
                  <ul className="space-y-2.5">
                    {state.recentDecks.map((deck) => (
                      <li key={deck.id} className="rounded-[1.2rem] border border-card-border/70 bg-background/70 px-4 py-3">
                        <p className="text-sm font-black text-foreground">{deck.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{deck.topic}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                          <span className="rounded-full border border-card-border/70 bg-card/80 px-2.5 py-1">
                            {copy.cards}: {deck.cardCount}
                          </span>
                          <span className="rounded-full border border-card-border/70 bg-card/80 px-2.5 py-1">
                            {copy.generatedAt}: {formatLabDate(deck.createdAt, language)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-[1.2rem] border border-card-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                    {copy.noDecks}
                  </p>
                )}
              </div>
            </div>
          </SectionCard>
          </div>
        )}

        {viewMode === "study" && (
          <div className="mx-auto max-w-3xl">
            <SectionCard className="min-w-0">
              <div className="space-y-4">
                {selectedStudyDeckId === null ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">
                        {copy.whatToStudy}
                      </p>
                      <span className="rounded-full border border-sky-blue/30 bg-sky-blue/10 px-3 py-1.5 text-xs font-bold text-sky-blue">
                        {dueDecks.length} Decks
                      </span>
                    </div>

                    {dueDecks.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {dueDecks.map((deck) => (
                          <button
                            key={deck.id}
                            type="button"
                            onClick={() => setSelectedStudyDeckId(deck.id)}
                            className="flex flex-col items-start gap-2 rounded-[1.3rem] border border-card-border/70 bg-background/60 p-5 text-left transition hover:bg-card-border/40 focus:ring-2 focus:ring-sky-blue/30"
                          >
                            <h4 className="text-lg font-black text-foreground">{deck.title}</h4>
                            {deck.topic ? <p className="line-clamp-2 text-sm text-muted-foreground">{deck.topic}</p> : null}
                            <span className="mt-2 inline-flex items-center rounded-full bg-sky-blue/15 px-2.5 py-1 text-xs font-bold text-sky-blue">
                              {deck.count} {copy.cards}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-[1.2rem] border border-card-border/70 bg-background/70 px-4 py-4 text-sm leading-7 text-muted-foreground">
                        {copy.noDue}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedStudyDeckId(null)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-card/60 px-3 py-1.5 text-xs font-bold text-muted-foreground transition hover:bg-card-border/50 hover:text-foreground"
                      >
                        ← {copy.stopStudy}
                      </button>
                      <span className="rounded-full border border-card-border/70 bg-card/80 px-3 py-1.5 text-xs font-bold text-muted-foreground">
                        {copy.dueTitle} : {dueDecks.find((d) => String(d.id) === String(selectedStudyDeckId))?.count ?? 0}
                      </span>
                    </div>

                    {activeCard ? (
                      <MagicCard
                        className="h-[560px] overflow-hidden rounded-[2rem] sm:h-[640px]"
                        gradientSize={200}
                        gradientOpacity={0.72}
                      >
                        <div className="relative flex h-full flex-col rounded-[2rem] border border-card-border/70 bg-background/80 p-6 sm:p-10">
                          {!reduceVisualEffects ? (
                            <BorderBeam size={160} duration={10} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
                          ) : null}
                          <div className="relative z-10 flex h-full min-h-0 flex-col">
                            {/* Card Header - Fixed */}
                            <div className="mb-6 flex shrink-0 flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-muted-foreground sm:mb-8">
                              <span className="rounded-full border border-card-border/70 bg-card/80 px-3 py-1.5 shadow-sm">
                                {copy.stage} {Math.min(LAB_SRS_TOTAL_STAGES, activeCard.stage + 1)}/{LAB_SRS_TOTAL_STAGES}
                              </span>
                              <span className="rounded-full border border-card-border/70 bg-card/80 px-3 py-1.5 shadow-sm">
                                {formatLearningState(activeCard.learningState, copy)}
                              </span>
                              <span className="rounded-full border border-card-border/70 bg-card/80 px-3 py-1.5 shadow-sm">
                                {formatLabDate(activeCard.nextReviewAt, language)}
                              </span>
                            </div>

                            {/* Card Body - Scrollable if needed */}
                            <div className="scrollbar-hide flex flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-4 sm:px-8 sm:py-6">
                              <div className="flex flex-col items-center justify-center w-full py-4 text-center">
                                <p className="text-5xl font-black leading-[1.2] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                                  {activeCard.term}
                                </p>
                                {activeCard.partOfSpeech && (
                                  <span className="mt-4 inline-flex items-center rounded-full border border-sky-blue/25 bg-sky-blue/10 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-sky-blue shadow-sm">
                                    {activeCard.partOfSpeech}
                                  </span>
                                )}
                              </div>

                              {answerVisible ? (
                                <div className="mx-auto mt-6 w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 space-y-6 text-center duration-500 sm:mt-8">
                                  <div className="space-y-4">
                                    <p className="text-3xl font-bold leading-relaxed text-foreground sm:text-4xl lg:text-5xl">
                                      {activeCard.meaning}
                                    </p>
                                    {activeCard.example ? (
                                      <div className="mx-auto max-w-2xl space-y-2">
                                        <p className="rounded-[1.2rem] border border-card-border/70 bg-background/75 px-5 py-4 text-base leading-relaxed text-muted-foreground shadow-sm sm:text-lg">
                                          &ldquo;{activeCard.example}&rdquo;
                                        </p>
                                        {activeCard.exampleTranslation ? (
                                          <p className="px-5 text-sm font-semibold text-muted-foreground/80 sm:text-base">
                                            {activeCard.exampleTranslation}
                                          </p>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="mx-auto grid w-full max-w-3xl grid-cols-4 gap-2 text-[11px] text-muted-foreground sm:text-xs">
                                    <div className="rounded-[1.1rem] border border-card-border/70 bg-card/70 px-1 py-3 text-center shadow-sm">
                                      <p className="font-semibold uppercase tracking-wider">{copy.stability}</p>
                                      <p className="mt-1.5 text-sm font-black text-foreground sm:text-base">
                                        {activeCard.stabilityDays.toFixed(1)}d
                                      </p>
                                    </div>
                                    <div className="rounded-[1.1rem] border border-card-border/70 bg-card/70 px-1 py-3 text-center shadow-sm">
                                      <p className="font-semibold uppercase tracking-wider">{copy.difficulty}</p>
                                      <p className="mt-1.5 text-sm font-black text-foreground sm:text-base">
                                        {activeCard.difficulty.toFixed(1)}
                                      </p>
                                    </div>
                                    <div className="rounded-[1.1rem] border border-card-border/70 bg-card/70 px-1 py-3 text-center shadow-sm">
                                      <p className="font-semibold uppercase tracking-wider">{copy.retrievability}</p>
                                      <p className="mt-1.5 text-sm font-black text-foreground sm:text-base">
                                        {formatRatioPercent(activeCard.retrievability)}
                                      </p>
                                    </div>
                                    <div className="rounded-[1.1rem] border border-card-border/70 bg-card/70 px-1 py-3 text-center shadow-sm">
                                      <p className="font-semibold uppercase tracking-wider">{copy.totalReviews}</p>
                                      <p className="mt-1.5 text-sm font-black text-foreground sm:text-base">
                                        {activeCard.totalReviews}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            {/* Card Footer - Fixed */}
                            <div className="mt-auto shrink-0 space-y-6">
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-border/50 shadow-inner">
                                <div
                                  className="h-full rounded-full bg-linear-to-r from-[#0b7d71] to-[#2f6fe4] transition-all duration-500"
                                  style={{ width: `${stageProgress}%` }}
                                />
                              </div>

                              <div className="h-[64px] sm:h-[72px]">
                                {!answerVisible ? (
                                  <button
                                    type="button"
                                    onClick={() => setAnswerVisible(true)}
                                    className="h-full w-full rounded-[1.4rem] border border-sky-blue/30 bg-sky-blue/10 text-lg font-black text-sky-blue transition hover:bg-sky-blue/20 hover:shadow-lg hover:shadow-sky-blue/10"
                                  >
                                    {copy.reveal}
                                  </button>
                                ) : (
                                  <div className="grid h-full grid-cols-2 gap-2 sm:grid-cols-4">
                                    <button
                                      type="button"
                                      onClick={() => void handleReview(1)}
                                      className="flex flex-col items-center justify-center gap-1 rounded-[1.25rem] border border-danger/25 bg-danger/10 text-sm font-black tracking-tight text-danger transition hover:bg-danger/15"
                                    >
                                      <RefreshCcw className="size-4" />
                                      {copy.gradeAgain}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleReview(2)}
                                      className="flex flex-col items-center justify-center gap-1 rounded-[1.25rem] border border-orange-500/25 bg-orange-500/10 text-sm font-black tracking-tight text-orange-600 transition hover:bg-orange-500/15 dark:text-orange-300"
                                    >
                                      <Flame className="size-4" />
                                      {copy.gradeHard}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleReview(3)}
                                      className="flex flex-col items-center justify-center gap-1 rounded-[1.25rem] border border-sky-blue/30 bg-sky-blue/10 text-sm font-black tracking-tight text-sky-blue transition hover:bg-sky-blue/20"
                                    >
                                      <Gauge className="size-4" />
                                      {copy.gradeGood}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleReview(4)}
                                      className="flex flex-col items-center justify-center gap-1 rounded-[1.25rem] border border-success/25 bg-success/10 text-sm font-black tracking-tight text-success transition hover:bg-success/15"
                                    >
                                      <TrendingUp className="size-4" />
                                      {copy.gradeEasy}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </MagicCard>
                    ) : (
                      <p className="rounded-[1.4rem] border border-success/30 bg-success/10 px-5 py-6 text-center text-base font-black leading-8 text-success">
                        {copy.studyFinished}
                      </p>
                    )}

                    {queuedCards.length > 0 ? (
                      <div className="space-y-3 pt-4">
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">{copy.queueLabel}</p>
                        <ul className="space-y-2">
                          {queuedCards.map((card) => (
                            <li
                              key={card.id}
                              className="flex items-center justify-between gap-3 rounded-[1rem] border border-card-border/70 bg-background/70 px-3 py-2.5"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{card.term}</p>
                                <p className="text-xs text-muted-foreground">
                                  {copy.stage} {Math.min(LAB_SRS_TOTAL_STAGES, card.stage + 1)}
                                </p>
                              </div>
                              <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                                {formatLabDate(card.nextReviewAt, language)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        )}

        {viewMode === "manage" && (
          <div className="mx-auto max-w-[78rem]">
            <SectionCard className="min-w-0">
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">
                    {copy.manageTitle}
                  </p>
                  <p className="text-base leading-8 text-muted-foreground sm:text-lg">{copy.manageSubtitle}</p>
                </div>

                {manageError ? (
                  <p className="rounded-[1rem] border border-danger/20 bg-danger/10 px-4 py-3 text-base font-semibold text-danger">
                    {manageError}
                  </p>
                ) : null}

                {manageMessage ? (
                  <p className="rounded-[1rem] border border-success/25 bg-success/10 px-4 py-3 text-base font-semibold text-success">
                    {manageMessage}
                  </p>
                ) : null}

                <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.82fr)_minmax(0,1.18fr)]">
                  <MagicCard className="overflow-hidden rounded-[1.5rem]" gradientSize={180} gradientOpacity={0.62}>
                    <div className="relative rounded-[1.5rem] border border-card-border/70 bg-background/80 p-4 sm:p-5">
                      {!reduceVisualEffects ? (
                        <BorderBeam size={140} duration={12} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
                      ) : null}
                      <div className="relative z-10 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
                            {copy.deckListTitle}
                          </p>
                          {isDecksLoading ? <RefreshCcw className="size-3.5 animate-spin text-muted-foreground" /> : null}
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">{copy.deckListHint}</p>

                        <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                          {decks.length === 0 ? (
                            <p className="rounded-[1rem] border border-card-border/70 bg-card/50 px-3 py-3 text-sm text-muted-foreground">
                              {copy.noDecks}
                            </p>
                          ) : (
                            decks.map((deck) => (
                              <button
                                key={deck.id}
                                type="button"
                                onClick={() => setSelectedDeckId(deck.id)}
                                className={cn(
                                  "w-full rounded-[1rem] border px-3 py-3 text-left transition",
                                  selectedDeckId === deck.id
                                    ? "border-sky-blue/35 bg-sky-blue/10"
                                    : "border-card-border/70 bg-card/50 hover:border-sky-blue/30 hover:bg-sky-blue/8"
                                )}
                              >
                                <p className="text-base font-black text-foreground">{deck.title}</p>
                                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{deck.topic}</p>
                                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{copy.cards}: {deck.cardCount}</span>
                                  <span>{formatLabDate(deck.createdAt, language)}</span>
                                </div>
                              </button>
                            ))
                          )}
                        </div>

                        <div className="rounded-[1rem] border border-card-border/70 bg-card/60 p-3">
                          {!isCreateMode ? (
                            <button
                              type="button"
                              onClick={() => setIsCreateMode(true)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-[0.9rem] border border-sky-blue/30 bg-sky-blue/10 px-3 py-3 text-base font-black text-sky-blue transition hover:bg-sky-blue/15"
                            >
                              <Plus className="size-4" />
                              {copy.createDeck}
                            </button>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">
                                  {copy.createDeck}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setIsCreateMode(false)}
                                  className="text-xs font-bold text-muted-foreground transition hover:text-foreground"
                                >
                                  {copy.cancelEdit}
                                </button>
                              </div>
                              <div className="space-y-2">
                                <input
                                  value={newDeckTitle}
                                  onChange={(event) => setNewDeckTitle(event.target.value.slice(0, 120))}
                                  placeholder={copy.deckName}
                                  className="h-11 w-full rounded-[0.9rem] border border-card-border/70 bg-background/80 px-3 text-base font-semibold text-foreground outline-none transition focus:border-sky-blue/35"
                                />
                                <input
                                  value={newDeckTopic}
                                  onChange={(event) => setNewDeckTopic(event.target.value.slice(0, 200))}
                                  placeholder={copy.deckTopicPlaceholder}
                                  className="h-11 w-full rounded-[0.9rem] border border-card-border/70 bg-background/80 px-3 text-base font-medium text-foreground outline-none transition focus:border-sky-blue/35"
                                />
                                <button
                                  type="button"
                                  disabled={isCreatingDeck}
                                  onClick={() => {
                                    void handleCreateDeck().then(() => setIsCreateMode(false))
                                  }}
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-[0.9rem] border border-foreground/15 bg-foreground/5 px-3 py-2.5 text-base font-black text-foreground transition hover:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <FolderPlus className="size-4" />
                                  {isCreatingDeck ? copy.creatingDeck : copy.createDeck}
                                </button>

                                <div className="mt-4 pt-4 border-t border-card-border/40 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                                      {copy.transferTitle.split(" · ")[0]}
                                    </p>
                                  </div>
                                  <div className="grid gap-2 grid-cols-2">
                                    <select
                                      value={importFormat}
                                      onChange={(event) => setImportFormat(event.target.value === "json" ? "json" : "csv")}
                                      className="h-10 rounded-[0.8rem] border border-card-border/70 bg-card/70 px-3 text-sm font-semibold text-foreground outline-none transition focus:border-sky-blue/35"
                                    >
                                      <option value="csv">CSV</option>
                                      <option value="json">JSON</option>
                                    </select>
                                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[0.8rem] border border-card-border/70 bg-card/70 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue">
                                      <Upload className="size-3" />
                                      {copy.loadFile}
                                      <input
                                        type="file"
                                        accept=".csv,.json,text/csv,application/json"
                                        className="hidden"
                                        onChange={(event) => {
                                          void handleImportFromFile(event)
                                        }}
                                      />
                                    </label>
                                  </div>
                                  <textarea
                                    value={importSource}
                                    onChange={(event) => setImportSource(event.target.value.slice(0, LAB_IMPORT_SOURCE_MAX))}
                                    placeholder={importFormat === "csv" ? copy.sourcePlaceholderCsv : copy.sourcePlaceholderJson}
                                    className="h-24 w-full resize-y rounded-[0.8rem] border border-card-border/70 bg-card/70 px-3 py-2 text-sm text-foreground outline-none transition focus:border-sky-blue/35"
                                  />
                                  <button
                                    type="button"
                                    disabled={isImporting}
                                    onClick={() => void handleImport()}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-[0.8rem] border border-sky-blue/30 bg-sky-blue/10 px-3 py-2 text-sm font-black uppercase tracking-[0.1em] text-sky-blue transition hover:bg-sky-blue/15 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Upload className="size-3.5" />
                                    {isImporting ? copy.importingCards : copy.importCards}
                                  </button>
                                  
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      disabled={isDownloadingTemplate}
                                      onClick={() => void handleTemplateDownload("csv")}
                                      className="inline-flex items-center justify-center gap-2 rounded-[0.75rem] border border-card-border/70 bg-card/70 px-2 py-1.5 text-[10px] font-black uppercase text-muted-foreground transition hover:border-sky-blue/30 hover:text-sky-blue"
                                    >
                                      {copy.downloadTemplateCsv}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isDownloadingTemplate}
                                      onClick={() => void handleTemplateDownload("json")}
                                      className="inline-flex items-center justify-center gap-2 rounded-[0.75rem] border border-card-border/70 bg-card/70 px-2 py-1.5 text-[10px] font-black uppercase text-muted-foreground transition hover:border-sky-blue/30 hover:text-sky-blue"
                                    >
                                      {copy.downloadTemplateJson}
                                    </button>
                                  </div>
                                </div>
                                <p className="text-[11px] leading-5 text-muted-foreground py-1">{copy.createDeckHint}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </MagicCard>

                  <div className="space-y-4">
                    {!selectedDeck ? (
                      <p className="rounded-[1.2rem] border border-card-border/70 bg-card/50 px-4 py-4 text-base text-muted-foreground">
                        {copy.selectDeckPrompt}
                      </p>
                    ) : (
                      <>
                        <MagicCard className="overflow-hidden rounded-[1.5rem]" gradientSize={170} gradientOpacity={0.6}>
                          <div className="relative rounded-[1.5rem] border border-card-border/70 bg-background/80 p-4 sm:p-5">
                            {!reduceVisualEffects ? (
                              <BorderBeam size={140} duration={11} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
                            ) : null}
                            <div className="relative z-10 space-y-5">
                              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                                <div className="space-y-2">
                                  <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">{copy.deckSettings}</p>
                                  <input
                                    value={deckEditTitle}
                                    onChange={(event) => setDeckEditTitle(event.target.value.slice(0, 120))}
                                    placeholder={copy.deckName}
                                    className="h-11 w-full rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-base font-semibold text-foreground outline-none transition focus:border-sky-blue/35"
                                  />
                                  <input
                                    value={deckEditTopic}
                                    onChange={(event) => setDeckEditTopic(event.target.value.slice(0, 200))}
                                    placeholder={copy.deckTopicPlaceholder}
                                    className="h-11 w-full rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-base font-medium text-foreground outline-none transition focus:border-sky-blue/35"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:w-[16rem]">
                                  <button
                                    type="button"
                                    disabled={isSavingDeck}
                                    onClick={() => void handleSaveDeck()}
                                    className="inline-flex items-center justify-center gap-2 rounded-[0.9rem] border border-sky-blue/30 bg-sky-blue/10 px-3 py-2 text-sm font-black text-sky-blue transition hover:bg-sky-blue/15 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <PencilLine className="size-3.5" />
                                    {isSavingDeck ? copy.savingDeck : copy.saveDeck}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDeletingDeck}
                                    onClick={() => void handleDeleteDeck()}
                                    className="inline-flex items-center justify-center gap-2 rounded-[0.9rem] border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-black text-danger transition hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Trash2 className="size-3.5" />
                                    {isDeletingDeck ? copy.deletingDeck : copy.deleteDeck}
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-3 rounded-[1rem] border border-card-border/70 bg-card/60 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
                                    {copy.transferTitle.split(" · ")[1]}
                                  </p>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <button
                                    type="button"
                                    disabled={isExporting || !selectedDeckId}
                                    onClick={() => void handleExport("csv")}
                                    className="inline-flex items-center justify-center gap-2 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 py-2 text-sm font-black uppercase tracking-[0.14em] text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Download className="size-3.5" />
                                    {isExporting ? copy.exporting : copy.exportCsv}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isExporting || !selectedDeckId}
                                    onClick={() => void handleExport("json")}
                                    className="inline-flex items-center justify-center gap-2 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 py-2 text-sm font-black uppercase tracking-[0.14em] text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <FileJson className="size-3.5" />
                                    {isExporting ? copy.exporting : copy.exportJson}
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-3 rounded-[1rem] border border-card-border/70 bg-card/60 p-3">
                                <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
                                  {copy.manualTitle}
                                </p>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <input
                                    value={manualTerm}
                                    onChange={(event) => setManualTerm(event.target.value.slice(0, 80))}
                                    placeholder={copy.termLabel}
                                    className="h-11 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-base font-semibold text-foreground outline-none transition focus:border-sky-blue/35"
                                  />
                                  <input
                                    value={manualPos}
                                    onChange={(event) => setManualPos(event.target.value.slice(0, 40))}
                                    placeholder={copy.posLabel}
                                    className="h-11 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-base font-medium text-foreground outline-none transition focus:border-sky-blue/35"
                                  />
                                  <input
                                    value={manualMeaning}
                                    onChange={(event) => setManualMeaning(event.target.value.slice(0, 220))}
                                    placeholder={copy.meaningLabel}
                                    className="h-11 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-base text-foreground outline-none transition focus:border-sky-blue/35"
                                  />
                                </div>
                                <input
                                  value={manualExample}
                                  onChange={(event) => setManualExample(event.target.value.slice(0, 280))}
                                  placeholder={copy.exampleLabel}
                                  className="h-11 w-full rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-base text-foreground outline-none transition focus:border-sky-blue/35"
                                />
                                <input
                                  value={manualExampleTranslation}
                                  onChange={(event) => setManualExampleTranslation(event.target.value.slice(0, 280))}
                                  placeholder={copy.exampleTranslationLabel}
                                  className="h-11 w-full rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-base text-foreground outline-none transition focus:border-sky-blue/35"
                                />
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleAutofillManualCard()}
                                    disabled={isAutofillingManualCard || isAddingManualCard}
                                    className="inline-flex items-center justify-center gap-2 rounded-[0.9rem] border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm font-black uppercase tracking-[0.14em] text-indigo-600 transition hover:bg-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-indigo-300"
                                  >
                                    <Sparkles className="size-3.5" />
                                    {isAutofillingManualCard ? copy.autoFilling : copy.autoFill}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isAddingManualCard || isAutofillingManualCard}
                                    onClick={() => void handleAddManualCard()}
                                    className="inline-flex items-center justify-center gap-2 rounded-[0.9rem] border border-sky-blue/30 bg-sky-blue/10 px-3 py-2 text-sm font-black text-sky-blue transition hover:bg-sky-blue/15 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Plus className="size-3.5" />
                                    {isAddingManualCard ? copy.addingCard : copy.addCard}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </MagicCard>

                        <MagicCard className="overflow-hidden rounded-[1.5rem]" gradientSize={170} gradientOpacity={0.58}>
                          <div className="relative rounded-[1.5rem] border border-card-border/70 bg-background/80 p-4 sm:p-5">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
                                  {copy.cardListTitle}
                                </p>
                                {isDeckCardsLoading ? <RefreshCcw className="size-3.5 animate-spin text-muted-foreground" /> : null}
                              </div>
                              <p className="text-sm leading-6 text-muted-foreground">{copy.cardListHint}</p>
                              <input
                                value={deckCardSearch}
                                onChange={(event) => setDeckCardSearch(event.target.value.slice(0, 120))}
                                placeholder={copy.cardSearchPlaceholder}
                                className="h-11 w-full rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-base text-foreground outline-none transition focus:border-sky-blue/35"
                              />
                              <div className="max-h-[42rem] space-y-2 overflow-y-auto pr-1">
                                {isDeckCardsLoading ? (
                                  <p className="rounded-[1rem] border border-card-border/70 bg-card/50 px-3 py-3 text-sm text-muted-foreground">
                                    {copy.cardsLoading}
                                  </p>
                                ) : filteredDeckCards.length === 0 ? (
                                  <p className="rounded-[1rem] border border-card-border/70 bg-card/50 px-3 py-3 text-sm text-muted-foreground">
                                    {copy.cardEmpty}
                                  </p>
                                ) : (
                                  filteredDeckCards.map((card) => (
                                    <div key={card.id} className="rounded-[1rem] border border-card-border/70 bg-card/50 px-3 py-4 sm:py-5">
                                      {editingCardId === card.id ? (
                                        <div className="space-y-2">
                                          <div className="grid gap-2 sm:grid-cols-3">
                                            <input
                                              value={editingTerm}
                                              onChange={(event) => setEditingTerm(event.target.value.slice(0, 80))}
                                              className="h-12 rounded-[0.8rem] border border-card-border/70 bg-background/80 px-3 text-lg font-semibold text-foreground outline-none transition focus:border-sky-blue/35"
                                            />
                                            <input
                                              value={editingPos}
                                              onChange={(event) => setEditingPos(event.target.value.slice(0, 40))}
                                              placeholder={copy.posLabel}
                                              className="h-12 rounded-[0.8rem] border border-card-border/70 bg-background/80 px-3 text-base font-medium text-foreground outline-none transition focus:border-sky-blue/35"
                                            />
                                            <input
                                              value={editingMeaning}
                                              onChange={(event) => setEditingMeaning(event.target.value.slice(0, 220))}
                                              className="h-12 rounded-[0.8rem] border border-card-border/70 bg-background/80 px-3 text-base text-foreground outline-none transition focus:border-sky-blue/35"
                                            />
                                          </div>
                                          <input
                                            value={editingExample}
                                            onChange={(event) => setEditingExample(event.target.value.slice(0, 280))}
                                            placeholder={copy.exampleLabel}
                                            className="h-12 w-full rounded-[0.8rem] border border-card-border/70 bg-background/80 px-3 text-base text-foreground outline-none transition focus:border-sky-blue/35"
                                          />
                                          <input
                                            value={editingExampleTranslation}
                                            onChange={(event) => setEditingExampleTranslation(event.target.value.slice(0, 280))}
                                            placeholder={copy.exampleTranslationLabel}
                                            className="h-12 w-full rounded-[0.8rem] border border-card-border/70 bg-background/80 px-3 text-base text-foreground outline-none transition focus:border-sky-blue/35"
                                          />
                                          <div className="grid grid-cols-2 gap-2">
                                            <button
                                              type="button"
                                              disabled={isUpdatingCard}
                                              onClick={() => void handleSaveCardEdit()}
                                              className="inline-flex items-center justify-center gap-2 rounded-[0.8rem] border border-sky-blue/30 bg-sky-blue/10 px-3 py-2 text-sm font-black text-sky-blue transition hover:bg-sky-blue/15 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              <PencilLine className="size-3.5" />
                                              {isUpdatingCard ? copy.savingDeck : copy.saveCard}
                                            </button>
                                            <button
                                              type="button"
                                              disabled={isUpdatingCard}
                                              onClick={handleCancelCardEdit}
                                              className="inline-flex items-center justify-center gap-2 rounded-[0.8rem] border border-card-border/70 bg-background/80 px-3 py-2 text-sm font-black text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              {copy.cancelEdit}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="space-y-3">
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                              <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-2xl font-black tracking-tight text-foreground">{card.term}</p>
                                                {card.partOfSpeech ? (
                                                  <span className="inline-flex items-center rounded-full border border-sky-blue/20 bg-sky-blue/8 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-sky-blue transition-colors hover:bg-sky-blue/12">
                                                    {card.partOfSpeech}
                                                  </span>
                                                ) : null}
                                              </div>
                                              <p className="mt-2 text-lg font-medium leading-relaxed text-muted-foreground/90">{card.meaning}</p>
                                            </div>
                                            <div className="flex shrink-0 gap-1.5 sm:gap-2">
                                              <button
                                                type="button"
                                                onClick={() => handleStartCardEdit(card)}
                                                className="inline-flex size-9 items-center justify-center rounded-xl border border-card-border/70 bg-background/70 text-muted-foreground transition hover:border-sky-blue/30 hover:text-sky-blue"
                                                title={copy.editCard}
                                              >
                                                <PencilLine className="size-4" />
                                              </button>
                                              <button
                                                type="button"
                                                disabled={deletingCardId === card.id}
                                                onClick={() => {
                                                  if (window.confirm(copy.cardDeleteConfirm)) {
                                                    void handleDeleteCard(card.id)
                                                  }
                                                }}
                                                className="inline-flex items-center justify-center gap-1 rounded-[0.75rem] border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs font-black text-danger transition hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-60"
                                              >
                                                <Trash2 className="size-3" />
                                                {deletingCardId === card.id ? copy.deletingCard : copy.deleteCard}
                                              </button>
                                            </div>
                                          </div>
                                          {card.example ? (
                                            <div className="space-y-1.5">
                                              <p className="rounded-[0.75rem] border border-card-border/70 bg-background/70 px-4 py-3 text-base leading-relaxed text-muted-foreground">
                                                {card.example}
                                              </p>
                                              {card.exampleTranslation ? (
                                                <p className="px-1 text-sm font-semibold text-muted-foreground/80">
                                                  {card.exampleTranslation}
                                                </p>
                                              ) : null}
                                            </div>
                                          ) : null}
                                        </div>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </MagicCard>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {viewMode === "report" && (
          <div className="mx-auto max-w-[70rem]">
            <VocabReportPanel />
          </div>
        )}
      </div>
    </main>
  )
}
