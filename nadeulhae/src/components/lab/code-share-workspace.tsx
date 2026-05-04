"use client"

/**
 * CodeShareWorkspace — real-time collaborative code editor.
 * Manages session CRUD, WebSocket-based presence, code patching/saving,
 * and a shareable link model.  Supports auto-close on inactivity and
 * read-only mode for closed sessions.  Fully i18n via LanguageContext.
 */

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Code2,
  Copy,
  Link2,
  Loader2,
  Plus,
  RefreshCcw,
  Trash2,
  Users,
} from "lucide-react"

import { BorderBeam } from "@/components/magicui/border-beam"
import { MagicCard } from "@/components/magicui/magic-card"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { SectionCard } from "@/components/dashboard/ui"
import { CodeMirrorEditor } from "@/components/lab/code-mirror-editor"
import { useLanguage } from "@/context/LanguageContext"
import { useWebSocket } from "@/lib/websocket/use-websocket"
import { cn } from "@/lib/utils"

type CodeShareStatus = "active" | "closed"

type ViewerIdentity = {
  actorId: string
  alias: string
}

type PresenceParticipant = {
  actorId: string
  alias: string
  typing: boolean
}

type CodeShareSessionSummary = {
  sessionId: string
  title: string
  language: string
  status: CodeShareStatus
  version: number
  createdAt: string
  updatedAt: string
  lastActivityAt: string
  closedAt: string | null
  codeSize: number
}

type CodeShareSessionDetail = CodeShareSessionSummary & {
  code: string
  isOwner: boolean
  canDelete: boolean
  canEdit: boolean
}

type ApiErrorPayload = {
  error?: string
}

type SessionApiPayload = {
  session?: CodeShareSessionDetail
  viewer?: ViewerIdentity
}

type SessionsApiPayload = {
  sessions?: CodeShareSessionSummary[]
  viewer?: ViewerIdentity
}

type PatchPayload = {
  session?: CodeShareSessionDetail
  actor?: ViewerIdentity
}

type SavedPayload = {
  sessionId?: string
  version?: number
  actor?: ViewerIdentity
}

type PresencePayload = {
  sessionId?: string
  count?: number
  participants?: PresenceParticipant[]
}

type DeletedPayload = {
  sessionId?: string
  actor?: ViewerIdentity
}

const CODE_SHARE_COPY = {
  ko: {
    badge: "realtime collaboration",
    title: "코드공유 실험실",
    subtitle:
      "세션 링크를 공유하면 로그인 없이도 함께 편집할 수 있습니다. 1시간 이상 활동이 없으면 세션이 자동 종료되고 기록은 유지됩니다.",
    listTitle: "내 코드공유 세션",
    listHint: "생성한 세션은 여기서 다시 열고 삭제할 수 있습니다.",
    noSessions: "아직 생성한 세션이 없습니다.",
    createSession: "새 세션 만들기",
    creating: "생성 중...",
    delete: "삭제",
    deleting: "삭제 중...",
    deleteConfirm: "이 세션을 완전히 삭제할까요?",
    loadFailed: "세션 정보를 불러오지 못했습니다.",
    saveFailed: "세션 저장에 실패했습니다.",
    saving: "저장 중...",
    saved: "모든 변경사항이 저장되었습니다.",
    remoteQueued: "다른 참가자 변경사항이 도착했습니다. 현재 입력 저장 후 동기화됩니다.",
    sessionStatusActive: "활성",
    sessionStatusClosed: "종료됨",
    sessionClosedHint: "비활동 자동 종료된 세션은 읽기 전용입니다.",
    activeUsers: "접속 인원",
    participants: "참가자",
    typing: "입력 중",
    me: "나",
    languageFormat: "코드 형식",
    languageHint: "예: markdown, c, python, typescript",
    language: "언어",
    titleLabel: "세션 제목",
    shareSettings: "공유 설정",
    shareAccess: "접근 방식",
    shareAccessValue: "링크를 가진 누구나 참여 및 편집 가능",
    shareRule: "1시간 비활동 시 자동 종료 · 기록은 유지",
    shareLink: "링크 공유",
    shareCopied: "링크가 복사되었습니다.",
    openPublicPage: "공유 링크 페이지 열기",
    editorPlaceholder: "여기에 코드를 입력하세요.",
    readonly: "읽기 전용",
    noSessionSelected: "왼쪽에서 세션을 선택하거나 새 세션을 생성해 주세요.",
    notFound: "세션을 찾을 수 없습니다.",
    deletedByOwner: "세션이 삭제되었습니다.",
    closedByInactivity: "세션이 비활동으로 종료되어 더 이상 편집할 수 없습니다.",
    versionConflict: "다른 사용자의 변경이 먼저 반영되어 최신본으로 동기화했습니다.",
    updatedBy: (name: string) => `${name} 님이 코드를 수정했습니다.`,
    deletedBy: (name: string) => `${name} 님이 세션을 삭제했습니다.`,
    refresh: "새로고침",
  },
  en: {
    badge: "realtime collaboration",
    title: "Code Share Lab",
    subtitle:
      "Share a session link for login-free collaboration. Sessions auto-close after 1 hour of inactivity and remain as history.",
    listTitle: "My code-share sessions",
    listHint: "Reopen or delete sessions you created.",
    noSessions: "No sessions created yet.",
    createSession: "Create session",
    creating: "Creating...",
    delete: "Delete",
    deleting: "Deleting...",
    deleteConfirm: "Delete this session permanently?",
    loadFailed: "Failed to load sessions.",
    saveFailed: "Failed to save the session.",
    saving: "Saving...",
    saved: "All changes saved.",
    remoteQueued: "Incoming changes detected. They will sync after your current edit is saved.",
    sessionStatusActive: "Active",
    sessionStatusClosed: "Closed",
    sessionClosedHint: "Auto-closed sessions are read-only.",
    activeUsers: "Active users",
    participants: "Participants",
    typing: "typing",
    me: "me",
    languageFormat: "Code format",
    languageHint: "Examples: markdown, c, python, typescript",
    language: "Language",
    titleLabel: "Session title",
    shareSettings: "Sharing settings",
    shareAccess: "Access",
    shareAccessValue: "Anyone with the link can join and edit",
    shareRule: "Auto-close after 1 hour inactivity · history remains",
    shareLink: "Share link",
    shareCopied: "Link copied.",
    openPublicPage: "Open shared page",
    editorPlaceholder: "Write or paste your code here.",
    readonly: "Read-only",
    noSessionSelected: "Pick a session from the left or create a new one.",
    notFound: "Session not found.",
    deletedByOwner: "Session was deleted.",
    closedByInactivity: "Session was closed due to inactivity and is now read-only.",
    versionConflict: "Another edit landed first. Synced to latest state.",
    updatedBy: (name: string) => `${name} updated the code.`,
    deletedBy: (name: string) => `${name} deleted the session.`,
    refresh: "Refresh",
  },
  zh: {
    badge: "realtime collaboration",
    title: "代码共享实验室",
    subtitle: "分享会话链接即可无需登录进行协作。超过1小时无活动将自动结束，记录保留。",
    listTitle: "我的代码共享会话",
    listHint: "在此重新打开或删除您创建的会话。",
    noSessions: "尚未创建任何会话。",
    createSession: "创建会话",
    creating: "正在创建...",
    delete: "删除",
    deleting: "正在删除...",
    deleteConfirm: "确定要永久删除此会话吗？",
    loadFailed: "加载会话信息失败。",
    saveFailed: "保存会话失败。",
    saving: "正在保存...",
    saved: "所有更改已保存。",
    remoteQueued: "检测到其他参与者的更改，将在当前编辑保存后同步。",
    sessionStatusActive: "活跃",
    sessionStatusClosed: "已结束",
    sessionClosedHint: "自动结束的会话为只读。",
    activeUsers: "在线人数",
    participants: "参与者",
    typing: "正在输入",
    me: "我",
    languageFormat: "代码格式",
    languageHint: "例如：markdown, c, python, typescript",
    language: "语言",
    titleLabel: "会话标题",
    shareSettings: "分享设置",
    shareAccess: "访问方式",
    shareAccessValue: "拥有链接的任何人都可参与和编辑",
    shareRule: "1小时无活动自动结束 · 记录保留",
    shareLink: "分享链接",
    shareCopied: "链接已复制。",
    openPublicPage: "打开共享页面",
    editorPlaceholder: "在此输入代码。",
    readonly: "只读",
    noSessionSelected: "请从左侧选择一个会话或创建新会话。",
    notFound: "未找到会话。",
    deletedByOwner: "会话已被删除。",
    closedByInactivity: "会话因无活动已结束，现为只读模式。",
    versionConflict: "其他用户的更改已先应用，已同步至最新版本。",
    updatedBy: (name: string) => `${name} 修改了代码。`,
    deletedBy: (name: string) => `${name} 删除了会话。`,
    refresh: "刷新",
  },
  ja: {
    badge: "realtime collaboration",
    title: "コード共有ラボ",
    subtitle: "セッションリンクを共有すればログイン不要で共同編集できます。1時間以上操作がないと自動終了し、記録は保持されます。",
    listTitle: "自分のコード共有セッション",
    listHint: "作成したセッションはここから再開または削除できます。",
    noSessions: "まだセッションが作成されていません。",
    createSession: "セッション作成",
    creating: "作成中...",
    delete: "削除",
    deleting: "削除中...",
    deleteConfirm: "このセッションを完全に削除しますか？",
    loadFailed: "セッション情報の読み込みに失敗しました。",
    saveFailed: "セッションの保存に失敗しました。",
    saving: "保存中...",
    saved: "すべての変更が保存されました。",
    remoteQueued: "他の参加者の変更を検出しました。現在の編集保存後に同期されます。",
    sessionStatusActive: "アクティブ",
    sessionStatusClosed: "終了",
    sessionClosedHint: "自動終了したセッションは読み取り専用です。",
    activeUsers: "接続人数",
    participants: "参加者",
    typing: "入力中",
    me: "自分",
    languageFormat: "コード形式",
    languageHint: "例：markdown, c, python, typescript",
    language: "言語",
    titleLabel: "セッションタイトル",
    shareSettings: "共有設定",
    shareAccess: "アクセス方法",
    shareAccessValue: "リンクを知っている全員が参加・編集可能",
    shareRule: "1時間操作がないと自動終了 · 記録は保持",
    shareLink: "リンクを共有",
    shareCopied: "リンクがコピーされました。",
    openPublicPage: "共有ページを開く",
    editorPlaceholder: "ここにコードを入力してください。",
    readonly: "読み取り専用",
    noSessionSelected: "左側からセッションを選択するか、新しく作成してください。",
    notFound: "セッションが見つかりません。",
    deletedByOwner: "セッションは削除されました。",
    closedByInactivity: "セッションは操作がないため終了し、読み取り専用になりました。",
    versionConflict: "別のユーザーの変更が先に反映されたため、最新版に同期しました。",
    updatedBy: (name: string) => `${name} さんがコードを修正しました。`,
    deletedBy: (name: string) => `${name} さんがセッションを削除しました。`,
    refresh: "更新",
  },
} as const

const CODE_SHARE_LANGUAGE_PRESETS = [
  "plaintext",
  "markdown",
  "typescript",
  "javascript",
  "python",
  "c",
  "cpp",
  "java",
  "go",
  "rust",
  "json",
  "yaml",
  "html",
  "css",
  "bash",
]

function formatDateLabel(value: string, locale: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  const localeMap: Record<string, string> = { ko: "ko-KR", zh: "zh-CN", ja: "ja-JP" }
  return parsed.toLocaleString(localeMap[locale] ?? "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Server sends detail payloads; list view requires summary shape for ordering/upsert.
function toSummaryFromDetail(detail: CodeShareSessionDetail): CodeShareSessionSummary {
  const {
    code,
    isOwner,
    canDelete,
    canEdit,
    ...summary
  } = detail
  void code
  void isOwner
  void canDelete
  void canEdit
  return summary
}

// Defensive runtime parser: ignore malformed websocket payloads instead of crashing UI effects.
function parseSessionPatchPayload(payload: unknown): PatchPayload | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const source = payload as PatchPayload
  if (!source.session || typeof source.session !== "object") {
    return null
  }

  return source
}

function parsePresencePayload(payload: unknown): PresencePayload | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const source = payload as PresencePayload
  if (typeof source.sessionId !== "string" || typeof source.count !== "number") {
    return null
  }

  return {
    sessionId: source.sessionId,
    count: Math.max(0, Math.floor(source.count)),
    participants: Array.isArray(source.participants)
      ? source.participants
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          actorId: typeof (item as PresenceParticipant).actorId === "string" ? (item as PresenceParticipant).actorId : "",
          alias: typeof (item as PresenceParticipant).alias === "string" ? (item as PresenceParticipant).alias : "Guest",
          typing: Boolean((item as PresenceParticipant).typing),
        }))
        .filter((item) => item.actorId.length > 0)
      : [],
  }
}

function parseDeletedPayload(payload: unknown): DeletedPayload | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const source = payload as DeletedPayload
  if (typeof source.sessionId !== "string") {
    return null
  }

  return source
}

function parseSavedPayload(payload: unknown): SavedPayload | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const source = payload as SavedPayload
  if (typeof source.sessionId !== "string" || typeof source.version !== "number") {
    return null
  }

  return {
    sessionId: source.sessionId,
    version: Math.max(1, Math.floor(source.version)),
    actor: source.actor,
  }
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

// ---- Component ----

export function CodeShareWorkspace({
  initialSessionId = null,
  showSessionList = true,
}: {
  initialSessionId?: string | null
  showSessionList?: boolean
}) {
  const router = useRouter()
  const { language } = useLanguage()
  const copy = ((CODE_SHARE_COPY as any)[language] ?? CODE_SHARE_COPY.ko)
  const { connected: wsConnected, subscribe, send } = useWebSocket()

  const [viewer, setViewer] = useState<ViewerIdentity | null>(null)
  const [participants, setParticipants] = useState<PresenceParticipant[]>([])
  const [sessions, setSessions] = useState<CodeShareSessionSummary[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSessionId)
  const [sessionDetail, setSessionDetail] = useState<CodeShareSessionDetail | null>(null)
  const [queuedRemoteDetail, setQueuedRemoteDetail] = useState<CodeShareSessionDetail | null>(null)
  const [needsRemoteRefresh, setNeedsRemoteRefresh] = useState(false)

  const [titleDraft, setTitleDraft] = useState("")
  const [languageDraft, setLanguageDraft] = useState("plaintext")
  const [codeDraft, setCodeDraft] = useState("")

  const [presenceCount, setPresenceCount] = useState(1)

  const [isListLoading, setIsListLoading] = useState(false)
  const [isSessionLoading, setIsSessionLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const typingLastSentAtRef = useRef(0)
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track the absolute most recent typed state to prevent sync overwrites during flight.
  const draftsRef = useRef({ code: "", title: "", language: "" })
  useEffect(() => {
    draftsRef.current = { code: codeDraft, title: titleDraft, language: languageDraft }
  }, [codeDraft, titleDraft, languageDraft])

  const sessionVersionRef = useRef(0)
  useEffect(() => {
    sessionVersionRef.current = sessionDetail?.version ?? 0
  }, [sessionDetail?.version])

  // Public share URL is calculated on client only.
  const shareUrl = useMemo(() => {
    if (!selectedSessionId || typeof window === "undefined") {
      return ""
    }

    return `${window.location.origin}/code-share/${selectedSessionId}`
  }, [selectedSessionId])

  const applyViewerIfPresent = useCallback((identity?: ViewerIdentity) => {
    if (!identity || typeof identity.actorId !== "string" || typeof identity.alias !== "string") {
      return
    }

    setViewer(identity)
  }, [])

  // Keep local list cache fresh when this editor receives updates from API or websocket.
  const upsertSessionSummary = useCallback((summary: CodeShareSessionSummary) => {
    setSessions((previous) => {
      const next = [...previous]
      const index = next.findIndex((item) => item.sessionId === summary.sessionId)
      if (index >= 0) {
        next[index] = summary
      } else {
        next.unshift(summary)
      }

      next.sort((a, b) => {
        const aTime = new Date(a.updatedAt).getTime()
        const bTime = new Date(b.updatedAt).getTime()
        if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
          return b.updatedAt.localeCompare(a.updatedAt)
        }
        return bTime - aTime
      })

      return next
    })
  }, [])

  const applySessionDetail = useCallback((detail: CodeShareSessionDetail) => {
    setSessionDetail(detail)
    setTitleDraft(detail.title)
    setLanguageDraft(detail.language)
    setCodeDraft(detail.code)
    setIsDirty(false)
    setQueuedRemoteDetail(null)
    setNeedsRemoteRefresh(false)
    upsertSessionSummary(toSummaryFromDetail(detail))
  }, [upsertSessionSummary])

  // Typing events are best-effort UX signals and only sent while WS is connected.
  const emitTyping = useCallback((isTyping: boolean) => {
    if (!selectedSessionId || !wsConnected) {
      return
    }

    send("code_share_typing", {
      sessionId: selectedSessionId,
      isTyping,
    })
  }, [selectedSessionId, send, wsConnected])

  const clearTypingStopTimer = useCallback(() => {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current)
      typingStopTimerRef.current = null
    }
  }, [])

  const scheduleTypingStop = useCallback(() => {
    clearTypingStopTimer()
    typingStopTimerRef.current = setTimeout(() => {
      emitTyping(false)
    }, 1200)
  }, [clearTypingStopTimer, emitTyping])

  const loadSessionDetail = useCallback(async (sessionId: string, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsSessionLoading(true)
    }

    try {
      const response = await fetch(`/api/code-share/sessions/${sessionId}`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      })

      if (!response.ok) {
        const fallback = response.status === 404 ? copy.notFound : copy.loadFailed
        throw new Error(await parseApiError(response, fallback))
      }

      const payload = await response.json() as SessionApiPayload
      if (!payload.session) {
        throw new Error(copy.loadFailed)
      }

      applyViewerIfPresent(payload.viewer)
      applySessionDetail(payload.session)
      setError(null)
      // Presence is room-scoped; reset until ws presence event arrives for this session.
      setParticipants([])
      setPresenceCount(1)
    } catch (loadError) {
      console.error("Failed to load code-share session:", loadError)
      setSessionDetail(null)
      setTitleDraft("")
      setLanguageDraft("plaintext")
      setCodeDraft("")
      setIsDirty(false)
      setQueuedRemoteDetail(null)
      setParticipants([])
      setError(loadError instanceof Error ? loadError.message : copy.loadFailed)
    } finally {
      if (!options?.silent) {
        setIsSessionLoading(false)
      }
    }
  }, [applySessionDetail, applyViewerIfPresent, copy.loadFailed, copy.notFound])

  const loadSessions = useCallback(async () => {
    if (!showSessionList) {
      return
    }

    setIsListLoading(true)

    try {
      const response = await fetch("/api/code-share/sessions", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response, copy.loadFailed))
      }

      const payload = await response.json() as SessionsApiPayload
      const nextSessions = Array.isArray(payload.sessions) ? payload.sessions : []
      setSessions(nextSessions)
      applyViewerIfPresent(payload.viewer)

      // Hub mode auto-selects first session to reduce empty-state friction.
      if (!selectedSessionId && nextSessions.length > 0) {
        setSelectedSessionId(nextSessions[0].sessionId)
      }

      setError(null)
    } catch (loadError) {
      console.error("Failed to load code-share sessions:", loadError)
      setError(loadError instanceof Error ? loadError.message : copy.loadFailed)
    } finally {
      setIsListLoading(false)
    }
  }, [applyViewerIfPresent, copy.loadFailed, selectedSessionId, showSessionList])

  const createSession = useCallback(async () => {
    setIsCreating(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch("/api/code-share/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          title: language === "ko" ? "새 코드공유 세션" : language === "zh" ? "新建代码共享会话" : language === "ja" ? "新しいコード共有セッション" : "New code-share session",
          language: "typescript",
          code: "",
        }),
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response, copy.loadFailed))
      }

      const payload = await response.json() as {
        session?: CodeShareSessionSummary
        viewer?: ViewerIdentity
      }
      if (!payload.session) {
        throw new Error(copy.loadFailed)
      }

      applyViewerIfPresent(payload.viewer)
      upsertSessionSummary(payload.session)
      setSelectedSessionId(payload.session.sessionId)
      await loadSessionDetail(payload.session.sessionId)
      setMessage(null)

      if (!showSessionList) {
        // Shared view always resolves to canonical session URL after creation.
        router.replace(`/code-share/${payload.session.sessionId}`)
      }
    } catch (createError) {
      console.error("Failed to create code-share session:", createError)
      setError(createError instanceof Error ? createError.message : copy.loadFailed)
    } finally {
      setIsCreating(false)
    }
  }, [applyViewerIfPresent, copy.loadFailed, language, loadSessionDetail, router, showSessionList, upsertSessionSummary])

  const deleteSession = useCallback(async () => {
    if (!selectedSessionId || !sessionDetail?.canDelete) {
      return
    }

    if (!window.confirm(copy.deleteConfirm)) {
      return
    }

    setIsDeleting(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(`/api/code-share/sessions/${selectedSessionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ reason: "owner_request" }),
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response, copy.loadFailed))
      }

      const remainingSessions = sessions.filter((item) => item.sessionId !== selectedSessionId)
      setSessions(remainingSessions)
      setSessionDetail(null)
      setTitleDraft("")
      setLanguageDraft("plaintext")
      setCodeDraft("")
      setIsDirty(false)
      setQueuedRemoteDetail(null)
      setParticipants([])

      if (showSessionList) {
        setSelectedSessionId((current) => {
          if (current !== selectedSessionId) {
            return current
          }
          return remainingSessions[0]?.sessionId ?? null
        })
      } else {
        setSelectedSessionId(null)
      }

      setMessage(null)
    } catch (deleteError) {
      console.error("Failed to delete code-share session:", deleteError)
      setError(deleteError instanceof Error ? deleteError.message : copy.loadFailed)
    } finally {
      setIsDeleting(false)
    }
  }, [copy.deleteConfirm, copy.loadFailed, selectedSessionId, sessionDetail?.canDelete, sessions, showSessionList])

  useEffect(() => {
    if (showSessionList) {
      void loadSessions()
    }
  }, [loadSessions, showSessionList])

  useEffect(() => {
    if (!initialSessionId) {
      return
    }

    setSelectedSessionId(initialSessionId)
  }, [initialSessionId])

  useEffect(() => {
    if (!selectedSessionId) {
      return
    }

    void loadSessionDetail(selectedSessionId)
  }, [loadSessionDetail, selectedSessionId])

  useEffect(() => {
    if (!selectedSessionId) {
      setPresenceCount(1)
      setParticipants([])
      return
    }

    if (!wsConnected) {
      setPresenceCount((current) => Math.max(1, current))
      return
    }

    send("code_share_subscribe", { sessionId: selectedSessionId })

    return () => {
      // Explicit unsubscribe avoids stale presence counts when navigating quickly.
      send("code_share_typing", { sessionId: selectedSessionId, isTyping: false })
      send("code_share_unsubscribe", { sessionId: selectedSessionId })
    }
  }, [selectedSessionId, send, wsConnected])

  useEffect(() => {
    const unsubscribePatch = subscribe("code_share_patch", (payload: unknown) => {
      const parsed = parseSessionPatchPayload(payload)
      if (!parsed?.session) {
        return
      }

      const next = parsed.session
      upsertSessionSummary(toSummaryFromDetail(next))

      if (!selectedSessionId || next.sessionId !== selectedSessionId) {
        return
      }

      if (next.version <= sessionVersionRef.current) {
        // Echo or stale message: we already have this version (or newer).
        return
      }

      if (isDirty || isSaving) {
        // Do not clobber local unsaved edits; queue latest remote and apply after local save settles.
        setQueuedRemoteDetail(next)
        setMessage(copy.remoteQueued)
        return
      }

      applySessionDetail(next)
      if (parsed.actor?.actorId && viewer?.actorId && parsed.actor.actorId !== viewer.actorId) {
        setMessage(copy.updatedBy(parsed.actor.alias || "Guest"))
      } else {
        setMessage(copy.saved)
      }
      setError(null)
    })

    const unsubscribePresence = subscribe("code_share_presence", (payload: unknown) => {
      const parsed = parsePresencePayload(payload)
      if (!parsed) {
        return
      }

      if (!selectedSessionId || parsed.sessionId !== selectedSessionId) {
        return
      }

      setPresenceCount(Math.max(1, parsed.count ?? 1))
      setParticipants(Array.isArray(parsed.participants) ? parsed.participants : [])
    })

    const unsubscribeDeleted = subscribe("code_share_deleted", (payload: unknown) => {
      const parsed = parseDeletedPayload(payload)
      if (!parsed) {
        return
      }

      setSessions((previous) => previous.filter((item) => item.sessionId !== parsed.sessionId))

      if (!selectedSessionId || parsed.sessionId !== selectedSessionId) {
        return
      }

      setSessionDetail(null)
      setSelectedSessionId(null)
      setTitleDraft("")
      setLanguageDraft("plaintext")
      setCodeDraft("")
      setIsDirty(false)
      setQueuedRemoteDetail(null)
      setParticipants([])
      setError(parsed.actor?.alias ? copy.deletedBy(parsed.actor.alias) : copy.deletedByOwner)
      setMessage(null)
    })

    const unsubscribeSaved = subscribe("code_share_saved", (payload: unknown) => {
      const parsed = parseSavedPayload(payload)
      if (!parsed) {
        return
      }

      if (!selectedSessionId || parsed.sessionId !== selectedSessionId) {
        return
      }

      if (parsed.actor?.actorId && viewer?.actorId && parsed.actor.actorId === viewer.actorId) {
        return
      }

      if (isDirty || isSaving) {
        setNeedsRemoteRefresh(true)
        setMessage(copy.remoteQueued)
        return
      }

      void loadSessionDetail(selectedSessionId, { silent: true })
      if (parsed.actor?.alias) {
        setMessage(copy.updatedBy(parsed.actor.alias))
      }
    })

    return () => {
      unsubscribePatch()
      unsubscribePresence()
      unsubscribeDeleted()
      unsubscribeSaved()
    }
  }, [
    applySessionDetail,
    copy,
    isDirty,
    isSaving,
    loadSessionDetail,
    selectedSessionId,
    subscribe,
    upsertSessionSummary,
    viewer?.actorId,
  ])

  useEffect(() => {
    if (!queuedRemoteDetail) {
      return
    }

    if (isDirty || isSaving) {
      return
    }

    // Apply queued payload only if it is newer than the currently rendered version.
    if (!sessionDetail || queuedRemoteDetail.version > sessionDetail.version) {
      applySessionDetail(queuedRemoteDetail)
      setMessage(copy.saved)
      setError(null)
    }

    setQueuedRemoteDetail(null)
  }, [applySessionDetail, copy.saved, isDirty, isSaving, queuedRemoteDetail, sessionDetail])

  useEffect(() => {
    if (!needsRemoteRefresh || !selectedSessionId) {
      return
    }

    if (isDirty || isSaving) {
      return
    }

    void loadSessionDetail(selectedSessionId, { silent: true })
    setNeedsRemoteRefresh(false)
  }, [isDirty, isSaving, loadSessionDetail, needsRemoteRefresh, selectedSessionId])

  useEffect(() => {
    if (!selectedSessionId || !sessionDetail || !isDirty || isSaving) {
      return
    }

    if (sessionDetail.status !== "active" || !sessionDetail.canEdit) {
      return
    }

    // Debounced autosave: collapse burst typing into fewer PATCH calls.
    const codeToSave = codeDraft
    const titleToSave = titleDraft
    const languageToSave = languageDraft

    // User-requested debounce duration: wait 2.5s after typing stops before auto-saving.
    const timer = window.setTimeout(async () => {
      setIsSaving(true)

      try {
        const response = await fetch(`/api/code-share/sessions/${selectedSessionId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            title: titleToSave,
            language: languageToSave,
            code: codeToSave,
            version: sessionDetail.version,
          }),
        })

        if (!response.ok) {
          if (response.status === 409) {
            const conflictPayload = await response.json() as SessionApiPayload & { error?: string }

            if (conflictPayload.session) {
              applySessionDetail(conflictPayload.session)
            }
            applyViewerIfPresent(conflictPayload.viewer)

            const errorMessage = conflictPayload.error
              || (conflictPayload.session?.status === "closed"
                ? copy.closedByInactivity
                : copy.versionConflict)

            setError(errorMessage)
            setMessage(null)
            return
          }

          throw new Error(await parseApiError(response, copy.saveFailed))
        }

        const payload = await response.json() as SessionApiPayload
        if (!payload.session) {
          throw new Error(copy.saveFailed)
        }

        applyViewerIfPresent(payload.viewer)

        setSessionDetail(payload.session)
        upsertSessionSummary(toSummaryFromDetail(payload.session))

        // Only clear the dirty flag if the user hasn't typed *since* we fired the save request.
        // We purposefully DO NOT call `applySessionDetail` (which runs setCodeDraft) because
        // overwriting the React state with the identical string will interrupt the browser's
        // IME composition (Korean character composing) and cause the jumping/disappearing text.
        if (
          draftsRef.current.code === codeToSave &&
          draftsRef.current.title === titleToSave &&
          draftsRef.current.language === languageToSave
        ) {
          setIsDirty(false)
          setQueuedRemoteDetail(null)
          setNeedsRemoteRefresh(false)
        }

        // Secondary signal so peers can refresh even if direct patch broadcast is delayed/missed.
        send("code_share_saved", {
          sessionId: payload.session.sessionId,
          version: payload.session.version,
        })
        setError(null)
        setMessage(copy.saved)
      } catch (saveError) {
        console.error("Failed to save code-share session:", saveError)
        setError(saveError instanceof Error ? saveError.message : copy.saveFailed)
        setMessage(null)
      } finally {
        setIsSaving(false)
      }
    }, 520)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    applySessionDetail,
    applyViewerIfPresent,
    codeDraft,
    copy.closedByInactivity,
    copy.saveFailed,
    copy.saved,
    copy.versionConflict,
    isDirty,
    isSaving,
    languageDraft,
    send,
    selectedSessionId,
    sessionDetail,
    titleDraft,
    upsertSessionSummary,
  ])

  useEffect(() => {
    if (!selectedSessionId) {
      return
    }

    // Lightweight polling fallback improves eventual consistency under unstable WS conditions.
    const interval = window.setInterval(() => {
      if (isDirty || isSaving) {
        return
      }
      void loadSessionDetail(selectedSessionId, { silent: true })
    }, 2_500)

    return () => {
      window.clearInterval(interval)
    }
  }, [isDirty, isSaving, loadSessionDetail, selectedSessionId])

  useEffect(() => {
    return () => {
      clearTypingStopTimer()
      if (selectedSessionId) {
        send("code_share_typing", { sessionId: selectedSessionId, isTyping: false })
      }
    }
  }, [clearTypingStopTimer, selectedSessionId, send])

  const handleTitleChange = (value: string) => {
    setTitleDraft(value)
    setIsDirty(true)
    setMessage(null)
  }

  const handleLanguageChange = (value: string) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9#+._-]/g, "").slice(0, 40)
    setLanguageDraft(normalized)
    setIsDirty(true)
    setMessage(null)
  }

  const handleCodeChange = (value: string) => {
    setCodeDraft(value)
    setIsDirty(true)
    setMessage(null)

    const now = Date.now()
    // Throttle typing signal updates to avoid event spam.
    if (now - typingLastSentAtRef.current >= 850) {
      emitTyping(true)
      typingLastSentAtRef.current = now
    }
    scheduleTypingStop()
  }

  const handleCodeBlur = () => {
    clearTypingStopTimer()
    emitTyping(false)
  }

  const copyShareLink = async () => {
    if (!shareUrl) {
      return
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setError(null)
      setMessage(copy.shareCopied)
    } catch {
      setError(copy.loadFailed)
    }
  }

  const activeStatusLabel = sessionDetail?.status === "closed"
    ? copy.sessionStatusClosed
    : copy.sessionStatusActive


  return (
    <main className={cn(
      "min-h-screen bg-background",
      showSessionList
        ? "px-4 pb-14 pt-24 sm:px-6 sm:pt-28 lg:px-8"
        : "px-0 pb-0 pt-14 sm:pt-16"
    )}>
      <div className={cn(
        "mx-auto",
        showSessionList
          ? "max-w-7xl space-y-6"
          : "h-[calc(100dvh-3.5rem)] w-full sm:h-[calc(100dvh-4rem)]"
      )}>
        {/* Header - only in list mode */}
        {showSessionList ? (
          <SectionCard>
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-active-blue">
              <Code2 className="size-3.5" />
              {copy.badge}
            </span>
            <div className="space-y-2">
              <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">{copy.title}</h1>
              <p className="max-w-4xl text-base leading-8 text-muted-foreground">{copy.subtitle}</p>
              {viewer?.alias ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-card-border/70 bg-card/60 px-3 py-1.5 text-xs font-bold text-muted-foreground">
                  {copy.me}: {viewer.alias}
                </span>
              ) : null}
            </div>
          </div>
          </SectionCard>
        ) : null}

        <div className={cn(
          "grid",
          showSessionList
            ? "gap-6 lg:grid-cols-[280px_1fr]"
            : "h-full grid-cols-1"
        )}>
          {/* Session list sidebar */}
          {showSessionList ? (
            <SectionCard className="h-fit sticky top-28">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">{copy.listTitle}</p>
                  <p className="text-sm text-muted-foreground">{copy.listHint}</p>
                </div>

                <ShimmerButton
                  type="button"
                  className="w-full rounded-[1rem] px-4 py-2.5 text-sm font-black"
                  onClick={() => void createSession()}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      {copy.creating}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Plus className="size-4" />
                      {copy.createSession}
                    </span>
                  )}
                </ShimmerButton>

                <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                  {isListLoading ? (
                    <p className="rounded-[1rem] border border-card-border/70 bg-background/70 px-3 py-4 text-sm text-muted-foreground">
                      {copy.loadFailed}
                    </p>
                  ) : sessions.length === 0 ? (
                    <p className="rounded-[1rem] border border-card-border/70 bg-background/70 px-3 py-4 text-sm text-muted-foreground">
                      {copy.noSessions}
                    </p>
                  ) : (
                    sessions.map((item) => {
                      const selected = item.sessionId === selectedSessionId

                      return (
                        <button
                          key={item.sessionId}
                          type="button"
                          onClick={() => {
                            setSelectedSessionId(item.sessionId)
                            setError(null)
                            setMessage(null)
                          }}
                          className={cn(
                            "w-full rounded-[1rem] border px-3 py-3 text-left transition",
                            selected
                              ? "border-sky-blue/45 bg-sky-blue/10"
                              : "border-card-border/70 bg-background/70 hover:border-sky-blue/30"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-2 text-sm font-black text-foreground">{item.title}</p>
                            <span className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.15em]",
                              item.status === "active"
                                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-400"
                                : "border-zinc-400/40 bg-zinc-400/10 text-zinc-300"
                            )}>
                              {item.status === "active" ? copy.sessionStatusActive : copy.sessionStatusClosed}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {formatDateLabel(item.updatedAt, language)} · v{item.version}
                          </p>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </SectionCard>
          ) : null}

          {/* Main editor area */}
          <div className={cn(
            "flex flex-col",
            showSessionList ? "min-w-0" : "h-full px-2 pb-2 sm:px-4 sm:pb-4"
          )}>
            {!selectedSessionId ? (
              <SectionCard>
                <div className="space-y-3 rounded-[1.2rem] border border-card-border/70 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
                  <p>{copy.noSessionSelected}</p>
                  <ShimmerButton
                    type="button"
                    className="rounded-[1rem] px-4 py-2.5 text-sm font-black"
                    onClick={() => void createSession()}
                    disabled={isCreating}
                  >
                    {isCreating ? copy.creating : copy.createSession}
                  </ShimmerButton>
                </div>
              </SectionCard>
            ) : isSessionLoading ? (
              <SectionCard>
                <div className="flex items-center justify-center rounded-[1.2rem] border border-card-border/70 bg-background/70 px-4 py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {copy.loadFailed}
                </div>
              </SectionCard>
            ) : !sessionDetail ? (
              <SectionCard>
                <div className="space-y-3 rounded-[1.2rem] border border-card-border/70 bg-background/70 px-4 py-6">
                  <p className="text-sm text-muted-foreground">{error ?? copy.notFound}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSessionId) {
                        void loadSessionDetail(selectedSessionId)
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-card-border/70 bg-card/60 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground transition hover:border-sky-blue/35 hover:text-foreground"
                  >
                    <RefreshCcw className="size-3.5" />
                    {copy.refresh}
                  </button>
                </div>
              </SectionCard>
            ) : (
              <MagicCard
                className={cn(
                  "overflow-hidden flex flex-col",
                  showSessionList ? "rounded-[1.6rem]" : "h-full rounded-[1.15rem]"
                )}
                gradientSize={190}
                gradientOpacity={0.68}
              >
                <div className={cn(
                  "relative flex flex-col border border-card-border/70 bg-background/80",
                  showSessionList
                    ? "rounded-[1.6rem] flex-1"
                    : "h-full rounded-[1.15rem]"
                )}>
                  <BorderBeam size={160} duration={12} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />

                  {/* === Toolbar === */}
                  <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-card-border/50 px-3 py-2.5 sm:px-4">
                    {/* Left: title + status */}
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        type="text"
                        value={titleDraft}
                        disabled={!sessionDetail.canEdit}
                        onChange={(event) => handleTitleChange(event.target.value)}
                        className="min-w-0 flex-1 truncate rounded-lg bg-transparent px-2 py-1 text-sm font-bold text-foreground outline-none transition hover:bg-card/60 focus:bg-card/80 focus:ring-1 focus:ring-sky-blue/30 disabled:cursor-not-allowed disabled:opacity-70"
                        maxLength={120}
                      />
                      <span className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.15em]",
                        sessionDetail.status === "active"
                          ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-400"
                          : "border-zinc-400/35 bg-zinc-400/10 text-zinc-300"
                      )}>
                        {activeStatusLabel}
                      </span>
                    </div>

                    {/* Center: language selector */}
                    <label className="flex items-center gap-1.5 rounded-lg border border-card-border/60 bg-card/50 px-2.5 py-1 text-xs font-bold text-muted-foreground">
                      {copy.language}
                      <input
                        value={languageDraft}
                        list="code-share-language-options"
                        onChange={(event) => handleLanguageChange(event.target.value)}
                        disabled={!sessionDetail.canEdit}
                        className="min-w-0 w-24 rounded bg-transparent px-1.5 py-0.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-sky-blue/30"
                        maxLength={40}
                        placeholder={copy.languageHint}
                      />
                      <datalist id="code-share-language-options">
                        {CODE_SHARE_LANGUAGE_PRESETS.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                    </label>

                    {/* Right: presence + actions */}
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full border border-card-border/70 bg-card/60 px-2 py-0.5 text-[10px] font-black text-muted-foreground">
                        <Users className="size-3" />
                        {presenceCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyShareLink()}
                        disabled={!shareUrl}
                        className="inline-flex items-center gap-1 rounded-full border border-card-border/70 bg-card/60 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground transition hover:border-sky-blue/35 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Copy className="size-3" />
                        {copy.shareLink}
                      </button>
                      {showSessionList ? (
                        <Link
                          href={shareUrl || `/code-share/${selectedSessionId}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded-full border border-card-border/70 bg-card/60 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground transition hover:border-sky-blue/35 hover:text-foreground"
                        >
                          <Link2 className="size-3" />
                        </Link>
                      ) : null}
                      {sessionDetail.canDelete ? (
                        <button
                          type="button"
                          onClick={() => void deleteSession()}
                          disabled={isDeleting}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-400/35 bg-rose-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-rose-300 transition hover:border-rose-300 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Mobile language selector */}
                  <div className="flex sm:hidden items-center gap-2 border-b border-card-border/50 px-3 py-1.5">
                    <label className="flex flex-1 items-center gap-1.5 text-xs font-bold text-muted-foreground">
                      {copy.language}
                      <input
                        value={languageDraft}
                        list="code-share-language-options-mobile"
                        onChange={(event) => handleLanguageChange(event.target.value)}
                        disabled={!sessionDetail.canEdit}
                        className="min-w-0 flex-1 rounded bg-transparent px-1.5 py-0.5 text-xs text-foreground outline-none"
                        maxLength={40}
                        placeholder={copy.languageHint}
                      />
                      <datalist id="code-share-language-options-mobile">
                        {CODE_SHARE_LANGUAGE_PRESETS.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                    </label>
                  </div>

                  {/* === Editor === */}
                  <div className={cn(
                    "relative z-10 flex-1",
                    showSessionList ? "min-h-[60vh]" : "min-h-0"
                  )}>
                    <CodeMirrorEditor
                      value={codeDraft}
                      onChange={handleCodeChange}
                      onBlur={handleCodeBlur}
                      language={languageDraft}
                      readOnly={!sessionDetail.canEdit}
                      placeholder={copy.editorPlaceholder}
                      className="h-full rounded-none border-0"
                    />
                  </div>

                  {/* === Status Bar === */}
                  <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-card-border/50 px-3 py-1.5 text-[11px] sm:px-4">
                    <div className="flex items-center gap-2">
                      {sessionDetail.canEdit ? (
                        <span className="rounded-full border border-card-border/70 bg-card/60 px-2 py-0.5 font-bold text-muted-foreground">
                          {isSaving ? copy.saving : isDirty ? copy.saving : copy.saved}
                        </span>
                      ) : (
                        <span className="rounded-full border border-zinc-500/40 bg-zinc-500/10 px-2 py-0.5 font-bold text-zinc-300">
                          {copy.readonly}
                        </span>
                      )}
                    </div>

                    {/* Typing indicators */}
                    <div className="flex items-center gap-2">
                      {participants.filter((p) => p.typing && p.actorId !== viewer?.actorId).map((p) => (
                        <span
                          key={p.actorId}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-300"
                        >
                          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                          {p.alias} · {copy.typing}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      {message ? (
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-300">
                          {message}
                        </span>
                      ) : null}
                      {error ? (
                        <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 font-bold text-rose-300">
                          {error}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </MagicCard>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
