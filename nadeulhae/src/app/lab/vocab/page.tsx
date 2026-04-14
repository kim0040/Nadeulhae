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
  Settings2,
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
  example: string | null
  tip: string | null
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
    generateHint: "AI가 주제에 맞춰 학습하기 좋은 실전 표현들을 자동으로 생성해 줍니다. 팁 부분에 발음 기호나 독음도 함께 추가됩니다.",
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
    whatToStudy: "어떤 단어장을 학습할까요?",
    stopStudy: "학습 중단",
    studyFinished: "단어장 복습을 마쳤습니다!",

    manageTitle: "단어장 관리",
    manageSubtitle: "수동 추가, 가져오기/내보내기, 단어장 설정을 한 번에 처리할 수 있습니다.",
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
    createDeck: "새 단어장 만들기",
    creatingDeck: "생성 중...",
    createDeckHint: "생성 후 수동 추가와 가져오기에서 바로 선택할 수 있습니다.",

    manualTitle: "수동 카드 추가",
    manualTarget: "추가 대상",
    targetExistingDeck: "기존 단어장",
    targetNewDeck: "새 단어장",
    termLabel: "단어",
    meaningLabel: "뜻",
    exampleLabel: "예문(선택)",
    tipLabel: "팁/메모(선택)",
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
    manageInvalidSource: "가져올 데이터 내용을 입력해 주세요.",
    manageInvalidDeckName: "단어장 이름을 입력해 주세요.",

    messageDeckCreated: "새 단어장을 만들었습니다.",
    messageDeckSaved: "단어장 설정을 저장했습니다.",
    messageManualAdded: "수동 카드가 추가되었습니다.",
    messageImported: "가져오기를 완료했습니다.",
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
    generateHint: "The AI automatically generates practical study cards tailored to your topic, complete with pronunciation guides.",
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
    whatToStudy: "Which deck would you like to study?",
    stopStudy: "Stop studying",
    studyFinished: "Finished reviewing this deck!",

    manageTitle: "Deck Management",
    manageSubtitle: "Handle manual cards, import/export, and deck settings in one place.",
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
    createDeck: "Create new deck",
    creatingDeck: "Creating...",
    createDeckHint: "After creation, it will be immediately available for manual add/import.",

    manualTitle: "Manual Card Entry",
    manualTarget: "Add target",
    targetExistingDeck: "Existing deck",
    targetNewDeck: "New deck",
    termLabel: "Term",
    meaningLabel: "Meaning",
    exampleLabel: "Example (optional)",
    tipLabel: "Tip / memo (optional)",
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
    manageInvalidSource: "Please provide import data.",
    manageInvalidDeckName: "Please enter a deck name.",

    messageDeckCreated: "New deck created.",
    messageDeckSaved: "Deck settings saved.",
    messageManualAdded: "Manual card added.",
    messageImported: "Import completed.",
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
  const [isReviewing, setIsReviewing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [answerVisible, setAnswerVisible] = useState(false)
  const [isCompactViewport, setIsCompactViewport] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [viewMode, setViewMode] = useState<"study" | "generate" | "manage">("study")
  const [selectedStudyDeckId, setSelectedStudyDeckId] = useState<string | null>(null)
  const [manageTab, setManageTab] = useState<"settings" | "manual" | "transfer">("settings")

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

  const [manualTargetMode, setManualTargetMode] = useState<"existing" | "new">("existing")
  const [manualNewDeckTitle, setManualNewDeckTitle] = useState("")
  const [manualNewDeckTopic, setManualNewDeckTopic] = useState("")
  const [manualTerm, setManualTerm] = useState("")
  const [manualMeaning, setManualMeaning] = useState("")
  const [manualExample, setManualExample] = useState("")
  const [manualTip, setManualTip] = useState("")
  const [isAddingManualCard, setIsAddingManualCard] = useState(false)

  const [importFormat, setImportFormat] = useState<"csv" | "json">("csv")
  const [importSource, setImportSource] = useState("")
  const [importTargetMode, setImportTargetMode] = useState<"existing" | "new">("existing")
  const [importDeckId, setImportDeckId] = useState("")
  const [importDeckTitle, setImportDeckTitle] = useState("")
  const [importDeckTopic, setImportDeckTopic] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const [manageError, setManageError] = useState<string | null>(null)
  const [manageMessage, setManageMessage] = useState<string | null>(null)

  const syncQueue = useRef<{cardId: number, grade: number}[]>([])
  const syncTimer = useRef<NodeJS.Timeout | null>(null)

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
        void loadState()
      } else {
        const payload = (await response.json()) as { state?: LabStateSnapshot }
        // To avoid race conditions, only set the remote state if the user hasn't clicked again (queue is empty).
        if (syncQueue.current.length === 0 && payload.state) {
          setState(payload.state)
        }
      }
    } catch {
      void loadState()
    }
  }, [language]) // loadState is unstable inside useCallback sometimes, so we omit unless needed

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
  const backgroundMotionEnabled = !prefersReducedMotion
  const particleQuantity = isCompactViewport ? 26 : 56
  const meteorCount = isCompactViewport ? 2 : 6

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

    applyMotionPreference()
    applyViewportMode()

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
      setImportDeckId("")
      return
    }

    setSelectedDeckId((previous) => (
      decks.some((deck) => deck.id === previous)
        ? previous
        : decks[0].id
    ))

    setImportDeckId((previous) => (
      decks.some((deck) => deck.id === previous)
        ? previous
        : decks[0].id
    ))
  }, [decks])

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
      await loadState()
    } catch (error) {
      console.error("Deck update failed:", error)
      setManageError(copy.stateError)
    } finally {
      setIsSavingDeck(false)
    }
  }

  const handleAddManualCard = async () => {
    const term = manualTerm.replace(/\s+/g, " ").trim()
    const meaning = manualMeaning.replace(/\s+/g, " ").trim()
    const example = manualExample.replace(/\s+/g, " ").trim()
    const tip = manualTip.replace(/\s+/g, " ").trim()

    if (!term || !meaning) {
      setManageError(copy.manageInvalidCard)
      return
    }

    if (manualTargetMode === "existing" && !selectedDeckId) {
      setManageError(copy.manageInvalidDeck)
      return
    }

    if (manualTargetMode === "new") {
      const deckName = manualNewDeckTitle.replace(/\s+/g, " ").trim()
      if (!deckName) {
        setManageError(copy.manageInvalidDeckName)
        return
      }
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
          deckId: manualTargetMode === "existing" ? Number(selectedDeckId) : null,
          deckTitle: manualTargetMode === "new" ? manualNewDeckTitle : null,
          deckTopic: manualTargetMode === "new" ? manualNewDeckTopic : null,
          card: {
            term,
            meaning,
            example: example || null,
            tip: tip || null,
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
      setManualExample("")
      setManualTip("")
      setManualNewDeckTitle("")
      setManualNewDeckTopic("")
      setManualTargetMode("existing")
      setManageMessage(copy.messageManualAdded)

      await loadDecks()
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

    if (importTargetMode === "existing" && !importDeckId) {
      setManageError(copy.manageInvalidDeck)
      return
    }

    if (importTargetMode === "new") {
      const title = importDeckTitle.replace(/\s+/g, " ").trim()
      if (!title) {
        setManageError(copy.manageInvalidDeckName)
        return
      }
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
          deckId: importTargetMode === "existing" ? Number(importDeckId) : null,
          deckTitle: importTargetMode === "new" ? importDeckTitle : null,
          deckTopic: importTargetMode === "new" ? importDeckTopic : null,
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
        state?: LabStateSnapshot
      }

      if (payload.state) {
        setState(payload.state)
      }
      if (payload.deck?.id) {
        setSelectedDeckId(payload.deck.id)
        setImportDeckId(payload.deck.id)
      }

      setImportSource("")
      setImportDeckTitle("")
      setImportDeckTopic("")
      setImportTargetMode("existing")
      setManageMessage(
        `${copy.messageImported} (+${payload.addedCount ?? 0}, skip ${payload.skippedCount ?? 0})`
      )

      await loadDecks()
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

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-center text-sm font-bold text-sky-blue">
        {copy.loading}
      </main>
    )
  }

  if (status === "guest" || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-center text-sm font-bold text-sky-blue">
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
              ease={80}
              color={particleColor}
              refresh
            />
            <Meteors number={meteorCount} className="z-0" />
          </>
        ) : null}
        <div className="relative z-10 mx-auto max-w-3xl">
          <SectionCard>
            <div className="space-y-4 text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-active-blue">
                <FlaskConical className="size-3.5" />
                {copy.badge}
              </span>
              <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                {copy.disabledTitle}
              </h1>
              <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {copy.disabledDescription}
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-[1.25rem] border border-sky-blue/30 bg-sky-blue/10 px-5 py-3 text-sm font-black text-sky-blue transition hover:border-sky-blue hover:bg-sky-blue/20"
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
            ease={80}
            color={particleColor}
            refresh
          />
          <Meteors number={meteorCount} className="z-0" />
        </>
      ) : null}

      <div className="relative z-10 mx-auto max-w-[82rem] 2xl:max-w-[86rem]">
        <SectionCard className="mb-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)] xl:items-end">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-active-blue">
                <Sparkles className="size-3.5" />
                {copy.badge}
              </span>
              <div className="space-y-2">
                <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">{copy.title}</h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{copy.subtitle}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <StatusMetric label={copy.usageRemaining} value={String(state?.usage.remainingGenerations ?? 0)} />
              <StatusMetric
                label={copy.usageCreated}
                value={`${state?.usage.generationCount ?? 0}/${state?.usage.dailyGenerationLimit ?? 0}`}
              />
              <StatusMetric label={copy.usageReviewed} value={String(state?.usage.reviewCount ?? 0)} />
            </div>
          </div>
        </SectionCard>

        <div className="mx-auto mb-8 flex max-w-fit items-center gap-1 rounded-full border border-card-border/70 bg-card/60 p-1.5 shadow-sm backdrop-blur-md">
          <button
            onClick={() => setViewMode("study")}
            className={cn(
              "rounded-full px-5 py-2.5 text-[13px] font-black transition-all sm:text-sm",
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
              "rounded-full px-5 py-2.5 text-[13px] font-black transition-all sm:text-sm",
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
              "rounded-full px-5 py-2.5 text-[13px] font-black transition-all sm:text-sm",
              viewMode === "manage"
                ? "bg-sky-blue/15 text-sky-blue"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            )}
          >
            {copy.tabManage}
          </button>
        </div>

        {viewMode === "generate" && (
          <div className="mx-auto max-w-3xl">
            <SectionCard className="min-w-0">
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
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

              <p className="text-xs leading-5 text-muted-foreground">{copy.generateHint}</p>

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
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
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
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
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
                           onClick={() => setSelectedStudyDeckId(deck.id)}
                           className="flex flex-col items-start gap-2 rounded-[1.3rem] border border-card-border/70 bg-background/60 p-5 text-left transition hover:bg-card-border/40 focus:ring-2 focus:ring-sky-blue/30"
                         >
                           <h4 className="text-lg font-black text-foreground">{deck.title}</h4>
                           {deck.topic && <p className="text-xs text-muted-foreground line-clamp-2">{deck.topic}</p>}
                           <span className="mt-2 inline-flex items-center rounded-full bg-sky-blue/15 px-2.5 py-1 text-[11px] font-bold text-sky-blue">
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
                      className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-card/60 px-3 py-1.5 text-xs font-bold text-muted-foreground transition hover:text-foreground hover:bg-card-border/50"
                    >
                      ← {copy.stopStudy}
                    </button>
                    <span className="rounded-full border border-card-border/70 bg-card/80 px-3 py-1.5 text-xs font-bold text-muted-foreground">
                      {copy.dueTitle} : {dueDecks.find((d) => String(d.id) === String(selectedStudyDeckId))?.count ?? 0}
                    </span>
                  </div>

                  {activeCard ? (
                    <MagicCard className="overflow-hidden rounded-[1.8rem]" gradientSize={200} gradientOpacity={0.72} >
                      <div className="relative rounded-[1.8rem] border border-card-border/70 bg-background/80 p-6 sm:p-10 min-h-[460px] flex flex-col justify-center">
                        <BorderBeam size={160} duration={10} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
                        <div className="relative z-10 flex flex-col h-full w-full grow">
                          {/* TOP AREA: Stats */}
                          <div className="flex w-full flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-muted-foreground shrink-0 mb-6 sm:mb-8 text-center pt-2">
                            <span className="rounded-full border border-card-border/70 bg-card/80 px-3 py-1.5">
                              {copy.stage} {Math.min(LAB_SRS_TOTAL_STAGES, activeCard.stage + 1)}/{LAB_SRS_TOTAL_STAGES}
                            </span>
                            <span className="rounded-full border border-card-border/70 bg-card/80 px-3 py-1.5">
                              {formatLearningState(activeCard.learningState, copy)}
                            </span>
                            <span className="rounded-full border border-card-border/70 bg-card/80 px-3 py-1.5">
                              {formatLabDate(activeCard.nextReviewAt, language)}
                            </span>
                          </div>

                          {/* CENTER AREA: Word displaying */}
                          <div className="flex-1 flex flex-col items-center justify-center -mt-2 my-auto">
                            <p className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-foreground text-center break-keep leading-tight px-4 pb-6">{activeCard.term}</p>
                            
                            {answerVisible ? (
                              <div className="mt-4 flex flex-col items-center gap-4 w-full px-2 max-w-xl mx-auto">
                                <p className="text-xl sm:text-2xl font-bold leading-relaxed text-foreground text-center break-keep">{activeCard.meaning}</p>
                                {activeCard.example ? (
                                  <p className="rounded-[1.2rem] border border-card-border/70 bg-background/75 px-5 py-4 text-sm sm:text-base leading-6 text-muted-foreground text-center break-keep w-full">
                                    "{activeCard.example}"
                                  </p>
                                ) : null}
                                {activeCard.tip ? (
                                  <p className="rounded-full bg-sky-blue/10 px-5 py-2 text-sm sm:text-base font-black tracking-tight text-sky-blue text-center">
                                    {activeCard.tip}
                                  </p>
                                ) : null}
                                
                                <div className="grid grid-cols-4 gap-2 text-[11px] text-muted-foreground w-full mt-4 sm:mt-6">
                                  <div className="rounded-[1rem] border border-card-border/70 bg-card/70 px-2 py-2.5 sm:px-3 text-center flex flex-col justify-center items-center">
                                    <p className="font-semibold text-[10px] sm:text-[11px] leading-tight">{copy.stability}</p>
                                    <p className="mt-1 text-xs sm:text-sm font-black text-foreground leading-none">{activeCard.stabilityDays.toFixed(1)}d</p>
                                  </div>
                                  <div className="rounded-[1rem] border border-card-border/70 bg-card/70 px-2 py-2.5 sm:px-3 text-center flex flex-col justify-center items-center">
                                    <p className="font-semibold text-[10px] sm:text-[11px] leading-tight">{copy.difficulty}</p>
                                    <p className="mt-1 text-xs sm:text-sm font-black text-foreground leading-none">{activeCard.difficulty.toFixed(1)}</p>
                                  </div>
                                  <div className="rounded-[1rem] border border-card-border/70 bg-card/70 px-2 py-2.5 sm:px-3 text-center flex flex-col justify-center items-center">
                                    <p className="font-semibold text-[10px] sm:text-[11px] leading-tight">{copy.retrievability}</p>
                                    <p className="mt-1 text-xs sm:text-sm font-black text-foreground leading-none">{formatRatioPercent(activeCard.retrievability)}</p>
                                  </div>
                                  <div className="rounded-[1rem] border border-card-border/70 bg-card/70 px-2 py-2.5 sm:px-3 text-center flex flex-col justify-center items-center">
                                    <p className="font-semibold text-[10px] sm:text-[11px] leading-tight">{copy.totalReviews}</p>
                                    <p className="mt-1 text-xs sm:text-sm font-black text-foreground leading-none">{activeCard.totalReviews}</p>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>

                          {/* BOTTOM AREA: Actions */}
                          <div className="shrink-0 pt-8 sm:pt-14 mb-2">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-border/70 mb-5">
                              <div
                                className="h-full rounded-full bg-linear-to-r from-[#0b7d71] to-[#2f6fe4]"
                                style={{ width: `${stageProgress}%` }}
                              />
                            </div>
                            
                            {!answerVisible ? (
                              <button
                                type="button"
                                onClick={() => setAnswerVisible(true)}
                                className="inline-flex w-full items-center justify-center rounded-[1.3rem] border border-card-border/70 bg-card/80 px-4 py-4 sm:py-5 text-base font-black text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue shadow-sm hover:shadow-md"
                              >
                                {copy.reveal}
                              </button>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <button
                                  type="button"
                                  onClick={() => void handleReview(1)}
                                  className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] border border-danger/25 bg-danger/10 px-4 py-4 sm:py-5 text-sm font-black text-danger transition hover:bg-danger/15 active:scale-95"
                                >
                                  <RefreshCcw className="size-4" />
                                  {copy.gradeAgain}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleReview(2)}
                                  className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] border border-orange-500/25 bg-orange-500/10 px-4 py-4 sm:py-5 text-sm font-black text-orange-600 transition hover:bg-orange-500/15 active:scale-95 dark:text-orange-300"
                                >
                                  <Flame className="size-4" />
                                  {copy.gradeHard}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleReview(3)}
                                  className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] border border-sky-blue/30 bg-sky-blue/10 px-4 py-4 sm:py-5 text-sm font-black text-sky-blue transition hover:bg-sky-blue/15 active:scale-95"
                                >
                                  <Gauge className="size-4" />
                                  {copy.gradeGood}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleReview(4)}
                                  className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] border border-success/25 bg-success/10 px-4 py-4 sm:py-5 text-sm font-black text-success transition hover:bg-success/15 active:scale-95"
                                >
                                  <TrendingUp className="size-4" />
                                  {copy.gradeEasy}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </MagicCard>
                  ) : (
                    <p className="rounded-[1.4rem] border border-success/30 bg-success/10 px-5 py-6 text-center text-sm font-black leading-7 text-success">
                      {copy.studyFinished}
                    </p>
                  )}
                  
                  {queuedCards.length > 0 ? (
                    <div className="space-y-3 pt-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">{copy.queueLabel}</p>
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
          </SectionCard>
          </div>
        )}

        {viewMode === "manage" && (
          <div className="mx-auto max-w-[56rem]">
            <SectionCard className="min-w-0">
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                {copy.manageTitle}
              </p>
              <p className="text-sm text-muted-foreground">{copy.manageSubtitle}</p>
            </div>

            {manageError ? (
              <p className="rounded-[1rem] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
                {manageError}
              </p>
            ) : null}

            {manageMessage ? (
              <p className="rounded-[1rem] border border-success/25 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
                {manageMessage}
              </p>
            ) : null}

            <div className="flex w-full overflow-hidden rounded-[1.2rem] border border-card-border/70 bg-card/50 p-1.5 text-[11px] font-black uppercase tracking-[0.16em]">
              <button
                type="button"
                onClick={() => setManageTab("settings")}
                className={cn(
                  "flex-1 rounded-[1rem] py-2.5 transition",
                  manageTab === "settings" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                )}
              >
                {copy.deckSettings}
              </button>
              <button
                type="button"
                onClick={() => setManageTab("manual")}
                className={cn(
                  "flex-1 rounded-[1rem] py-2.5 transition",
                  manageTab === "manual" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                )}
              >
                {copy.manualTitle}
              </button>
              <button
                type="button"
                onClick={() => setManageTab("transfer")}
                className={cn(
                  "flex-1 rounded-[1rem] py-2.5 transition",
                  manageTab === "transfer" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                )}
              >
                {copy.transferTitle}
              </button>
            </div>

            <div className="mt-4">
              {manageTab === "settings" && (
              <MagicCard className="overflow-hidden rounded-[1.5rem]" gradientSize={180} gradientOpacity={0.62}>
                <div className="relative rounded-[1.5rem] border border-card-border/70 bg-background/80 p-4 sm:p-5">
                  <BorderBeam size={140} duration={12} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                      <Settings2 className="size-3.5" />
                      {copy.deckSettings}
                      {isDecksLoading ? <RefreshCcw className="size-3.5 animate-spin" /> : null}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground">{copy.deckSelect}</label>
                      <select
                        value={selectedDeckId}
                        onChange={(event) => setSelectedDeckId(event.target.value)}
                        className="h-11 w-full rounded-[0.95rem] border border-card-border/70 bg-card/70 px-3 text-sm font-semibold text-foreground outline-none transition focus:border-sky-blue/35"
                      >
                        {decks.length === 0 ? (
                          <option value="">{copy.noDecks}</option>
                        ) : (
                          decks.map((deck) => (
                            <option key={deck.id} value={deck.id}>
                              {deck.title} ({deck.cardCount})
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground">{copy.deckName}</label>
                      <input
                        value={deckEditTitle}
                        onChange={(event) => setDeckEditTitle(event.target.value.slice(0, 120))}
                        className="h-11 w-full rounded-[0.95rem] border border-card-border/70 bg-card/70 px-3 text-sm font-semibold text-foreground outline-none transition focus:border-sky-blue/35"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground">{copy.deckTopic}</label>
                      <input
                        value={deckEditTopic}
                        onChange={(event) => setDeckEditTopic(event.target.value.slice(0, 200))}
                        placeholder={copy.deckTopicPlaceholder}
                        className="h-11 w-full rounded-[0.95rem] border border-card-border/70 bg-card/70 px-3 text-sm font-medium text-foreground outline-none transition focus:border-sky-blue/35"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isSavingDeck || !selectedDeckId}
                        onClick={() => void handleSaveDeck()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-[1rem] border border-sky-blue/30 bg-sky-blue/10 px-4 py-3 text-sm font-black text-sky-blue transition hover:bg-sky-blue/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <PencilLine className="size-4" />
                        {isSavingDeck ? copy.savingDeck : copy.saveDeck}
                      </button>

                      <button
                        type="button"
                        disabled={isDeletingDeck || !selectedDeckId}
                        onClick={() => void handleDeleteDeck()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-[1rem] border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-black text-danger transition hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="size-4" />
                        {isDeletingDeck ? copy.deletingDeck : copy.deleteDeck}
                      </button>
                    </div>

                    <div className="rounded-[1rem] border border-card-border/70 bg-card/60 p-3">
                      <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                        {copy.createDeck}
                      </p>
                      <div className="space-y-2">
                        <input
                          value={newDeckTitle}
                          onChange={(event) => setNewDeckTitle(event.target.value.slice(0, 120))}
                          placeholder={copy.deckName}
                          className="h-10 w-full rounded-[0.9rem] border border-card-border/70 bg-background/80 px-3 text-sm font-semibold text-foreground outline-none transition focus:border-sky-blue/35"
                        />
                        <input
                          value={newDeckTopic}
                          onChange={(event) => setNewDeckTopic(event.target.value.slice(0, 200))}
                          placeholder={copy.deckTopicPlaceholder}
                          className="h-10 w-full rounded-[0.9rem] border border-card-border/70 bg-background/80 px-3 text-sm font-medium text-foreground outline-none transition focus:border-sky-blue/35"
                        />
                        <button
                          type="button"
                          disabled={isCreatingDeck}
                          onClick={() => void handleCreateDeck()}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-[0.9rem] border border-foreground/15 bg-foreground/5 px-3 py-2.5 text-sm font-black text-foreground transition hover:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FolderPlus className="size-4" />
                          {isCreatingDeck ? copy.creatingDeck : copy.createDeck}
                        </button>
                        <p className="text-[11px] leading-5 text-muted-foreground">{copy.createDeckHint}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </MagicCard>
              )}

              {manageTab === "manual" && (
                <MagicCard className="overflow-hidden rounded-[1.5rem]" gradientSize={170} gradientOpacity={0.6}>
                  <div className="relative rounded-[1.5rem] border border-card-border/70 bg-background/80 p-4 sm:p-5">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                        <Plus className="size-3.5" />
                        {copy.manualTitle}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">{copy.manualTarget}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setManualTargetMode("existing")}
                            className={cn(
                              "rounded-[0.9rem] border px-3 py-2 text-xs font-black uppercase tracking-[0.16em] transition",
                              manualTargetMode === "existing"
                                ? "border-sky-blue/35 bg-sky-blue/12 text-sky-blue"
                                : "border-card-border/70 bg-card/60 text-muted-foreground"
                            )}
                          >
                            {copy.targetExistingDeck}
                          </button>
                          <button
                            type="button"
                            onClick={() => setManualTargetMode("new")}
                            className={cn(
                              "rounded-[0.9rem] border px-3 py-2 text-xs font-black uppercase tracking-[0.16em] transition",
                              manualTargetMode === "new"
                                ? "border-sky-blue/35 bg-sky-blue/12 text-sky-blue"
                                : "border-card-border/70 bg-card/60 text-muted-foreground"
                            )}
                          >
                            {copy.targetNewDeck}
                          </button>
                        </div>

                        {manualTargetMode === "existing" ? (
                          <select
                            value={selectedDeckId}
                            onChange={(event) => setSelectedDeckId(event.target.value)}
                            className="h-10 w-full rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-sm font-semibold text-foreground outline-none transition focus:border-sky-blue/35"
                          >
                            {decks.length === 0 ? (
                              <option value="">{copy.noDecks}</option>
                            ) : (
                              decks.map((deck) => (
                                <option key={deck.id} value={deck.id}>
                                  {deck.title}
                                </option>
                              ))
                            )}
                          </select>
                        ) : null}
                      </div>

                      {manualTargetMode === "new" ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            value={manualNewDeckTitle}
                            onChange={(event) => setManualNewDeckTitle(event.target.value.slice(0, 120))}
                            placeholder={copy.deckName}
                            className="h-10 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-sm font-semibold text-foreground outline-none transition focus:border-sky-blue/35"
                          />
                          <input
                            value={manualNewDeckTopic}
                            onChange={(event) => setManualNewDeckTopic(event.target.value.slice(0, 200))}
                            placeholder={copy.deckTopicPlaceholder}
                            className="h-10 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-sm text-foreground outline-none transition focus:border-sky-blue/35"
                          />
                        </div>
                      ) : null}

                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          value={manualTerm}
                          onChange={(event) => setManualTerm(event.target.value.slice(0, 80))}
                          placeholder={copy.termLabel}
                          className="h-10 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-sm font-semibold text-foreground outline-none transition focus:border-sky-blue/35"
                        />
                        <input
                          value={manualMeaning}
                          onChange={(event) => setManualMeaning(event.target.value.slice(0, 220))}
                          placeholder={copy.meaningLabel}
                          className="h-10 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-sm text-foreground outline-none transition focus:border-sky-blue/35"
                        />
                      </div>

                      <input
                        value={manualExample}
                        onChange={(event) => setManualExample(event.target.value.slice(0, 280))}
                        placeholder={copy.exampleLabel}
                        className="h-10 w-full rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-sm text-foreground outline-none transition focus:border-sky-blue/35"
                      />

                      <input
                        value={manualTip}
                        onChange={(event) => setManualTip(event.target.value.slice(0, 200))}
                        placeholder={copy.tipLabel}
                        className="h-10 w-full rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-sm text-foreground outline-none transition focus:border-sky-blue/35"
                      />

                      <button
                        type="button"
                        disabled={isAddingManualCard}
                        onClick={() => void handleAddManualCard()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-[0.95rem] border border-sky-blue/30 bg-sky-blue/10 px-4 py-2.5 text-sm font-black text-sky-blue transition hover:bg-sky-blue/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Plus className="size-4" />
                        {isAddingManualCard ? copy.addingCard : copy.addCard}
                      </button>

                      <p className="text-[11px] leading-5 text-muted-foreground">{copy.manualHint}</p>
                    </div>
                  </div>
                </MagicCard>
              )}

              {manageTab === "transfer" && (
                <MagicCard className="overflow-hidden rounded-[1.5rem]" gradientSize={170} gradientOpacity={0.6}>
                  <div className="relative rounded-[1.5rem] border border-card-border/70 bg-background/80 p-4 sm:p-5">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                        <Upload className="size-3.5" />
                        {copy.transferTitle}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-muted-foreground">{copy.importFormat}</label>
                        <select
                          value={importFormat}
                          onChange={(event) => setImportFormat(event.target.value === "json" ? "json" : "csv")}
                          className="h-10 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-sm font-semibold text-foreground outline-none transition focus:border-sky-blue/35"
                        >
                          <option value="csv">CSV</option>
                          <option value="json">JSON</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setImportTargetMode("existing")}
                            className={cn(
                              "rounded-[0.9rem] border px-3 py-2 text-xs font-black uppercase tracking-[0.16em] transition",
                              importTargetMode === "existing"
                                ? "border-sky-blue/35 bg-sky-blue/12 text-sky-blue"
                                : "border-card-border/70 bg-card/60 text-muted-foreground"
                            )}
                          >
                            {copy.targetExistingDeck}
                          </button>
                          <button
                            type="button"
                            onClick={() => setImportTargetMode("new")}
                            className={cn(
                              "rounded-[0.9rem] border px-3 py-2 text-xs font-black uppercase tracking-[0.16em] transition",
                              importTargetMode === "new"
                                ? "border-sky-blue/35 bg-sky-blue/12 text-sky-blue"
                                : "border-card-border/70 bg-card/60 text-muted-foreground"
                            )}
                          >
                            {copy.targetNewDeck}
                          </button>
                        </div>

                        {importTargetMode === "existing" ? (
                          <select
                            value={importDeckId}
                            onChange={(event) => setImportDeckId(event.target.value)}
                            className="h-10 w-full rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-sm font-semibold text-foreground outline-none transition focus:border-sky-blue/35"
                          >
                            {decks.length === 0 ? (
                              <option value="">{copy.noDecks}</option>
                            ) : (
                              decks.map((deck) => (
                                <option key={deck.id} value={deck.id}>
                                  {deck.title}
                                </option>
                              ))
                            )}
                          </select>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              value={importDeckTitle}
                              onChange={(event) => setImportDeckTitle(event.target.value.slice(0, 120))}
                              placeholder={copy.deckName}
                              className="h-10 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-sm font-semibold text-foreground outline-none transition focus:border-sky-blue/35"
                            />
                            <input
                              value={importDeckTopic}
                              onChange={(event) => setImportDeckTopic(event.target.value.slice(0, 200))}
                              placeholder={copy.deckTopicPlaceholder}
                              className="h-10 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 text-sm text-foreground outline-none transition focus:border-sky-blue/35"
                            />
                          </div>
                        )}
                      </div>

                      <label className="text-xs font-semibold text-muted-foreground">{copy.sourceLabel}</label>
                      <textarea
                        value={importSource}
                        onChange={(event) => setImportSource(event.target.value.slice(0, LAB_IMPORT_SOURCE_MAX))}
                        placeholder={importFormat === "csv" ? copy.sourcePlaceholderCsv : copy.sourcePlaceholderJson}
                        className="h-36 w-full resize-y rounded-[1rem] border border-card-border/70 bg-card/70 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-sky-blue/35"
                      />

                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue">
                          <Upload className="size-3.5" />
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

                        <button
                          type="button"
                          disabled={isImporting}
                          onClick={() => void handleImport()}
                          className="inline-flex items-center justify-center gap-2 rounded-[0.9rem] border border-sky-blue/30 bg-sky-blue/10 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-sky-blue transition hover:bg-sky-blue/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Upload className="size-3.5" />
                          {isImporting ? copy.importingCards : copy.importCards}
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          disabled={isDownloadingTemplate}
                          onClick={() => void handleTemplateDownload("csv")}
                          className="inline-flex items-center justify-center gap-2 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FileSpreadsheet className="size-3.5" />
                          {copy.downloadTemplateCsv}
                        </button>
                        <button
                          type="button"
                          disabled={isDownloadingTemplate}
                          onClick={() => void handleTemplateDownload("json")}
                          className="inline-flex items-center justify-center gap-2 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FileJson className="size-3.5" />
                          {copy.downloadTemplateJson}
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          disabled={isExporting || !selectedDeckId}
                          onClick={() => void handleExport("csv")}
                          className="inline-flex items-center justify-center gap-2 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Download className="size-3.5" />
                          {isExporting ? copy.exporting : copy.exportCsv}
                        </button>
                        <button
                          type="button"
                          disabled={isExporting || !selectedDeckId}
                          onClick={() => void handleExport("json")}
                          className="inline-flex items-center justify-center gap-2 rounded-[0.9rem] border border-card-border/70 bg-card/70 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-foreground transition hover:border-sky-blue/30 hover:text-sky-blue disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FileJson className="size-3.5" />
                          {isExporting ? copy.exporting : copy.exportJson}
                        </button>
                      </div>

                      <p className="text-[11px] leading-5 text-muted-foreground">{copy.transferHint}</p>
                    </div>
                  </div>
                </MagicCard>
              )}
            </div>
          </div>
            </SectionCard>
          </div>
        )}
      </div>
    </main>
  )
}
