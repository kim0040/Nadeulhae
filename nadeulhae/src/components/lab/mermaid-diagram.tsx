"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Check, Copy, RefreshCw } from "lucide-react"

import {
  getMermaidErrorDetails,
  isUnsupportedMermaidSource,
  normalizeMermaidSource,
} from "@/lib/markdown/mermaid-source"

const MERMAID_ERROR_SVG_RE = /aria-roledescription="error"|class="error-icon"|Syntax error in text/i
const SCRIPT_TAG_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi
const EVENT_HANDLER_ATTR_RE = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const JS_URL_ATTR_RE = /\s(?:href|xlink:href)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi

type MermaidLocale = "ko" | "en" | "zh" | "ja"
type MermaidModule = typeof import("mermaid")["default"]

let mermaidModulePromise: Promise<MermaidModule> | null = null
let configuredTheme: "dark" | "default" | null = null
let nextMermaidRenderId = 0

const COPY = {
  ko: {
    loading: "다이어그램을 렌더링하는 중입니다.",
    retry: "다시 렌더링",
    unsupported: "지원하지 않는 Mermaid 타입입니다. useCaseDiagram 대신 flowchart 또는 classDiagram을 사용해 주세요.",
    syntax: "Mermaid 문법 오류가 발생했습니다.",
    line: (line: number) => `${line}줄 근처를 확인해 주세요.`,
    token: (token: string) => `예상하지 못한 토큰: ${token}`,
  },
  en: {
    loading: "Rendering the diagram.",
    retry: "Render again",
    unsupported: "This Mermaid diagram type is unsupported. Use flowchart or classDiagram instead of useCaseDiagram.",
    syntax: "Mermaid syntax error.",
    line: (line: number) => `Check near line ${line}.`,
    token: (token: string) => `Unexpected token: ${token}`,
  },
  zh: {
    loading: "正在渲染图表。",
    retry: "重新渲染",
    unsupported: "不支持此 Mermaid 图表类型。请使用 flowchart 或 classDiagram 代替 useCaseDiagram。",
    syntax: "Mermaid 语法错误。",
    line: (line: number) => `请检查第 ${line} 行附近。`,
    token: (token: string) => `意外的标记：${token}`,
  },
  ja: {
    loading: "図をレンダリングしています。",
    retry: "再レンダリング",
    unsupported: "この Mermaid 図形式は未対応です。useCaseDiagram の代わりに flowchart または classDiagram を使用してください。",
    syntax: "Mermaid の構文エラーです。",
    line: (line: number) => `${line} 行目付近を確認してください。`,
    token: (token: string) => `予期しないトークン: ${token}`,
  },
} as const

function resolveLocale(language: string): MermaidLocale {
  if (language === "ko" || language === "zh" || language === "ja") return language
  return "en"
}

function isDarkDocumentTheme() {
  if (typeof document === "undefined" || typeof window === "undefined") return false
  const root = document.documentElement
  const classTheme = root.classList.contains("dark")
  const dataTheme = root.getAttribute("data-theme") === "dark"
  const usesSystemTheme = !root.classList.contains("light") && root.getAttribute("data-theme") == null
  return classTheme || dataTheme || (usesSystemTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
}

async function getConfiguredMermaid(isDarkTheme: boolean) {
  mermaidModulePromise ??= import("mermaid").then((module) => module.default)
  const mermaid = await mermaidModulePromise
  const nextTheme = isDarkTheme ? "dark" : "default"

  if (configuredTheme !== nextTheme) {
    mermaid.initialize({
      startOnLoad: false,
      suppressErrorRendering: true,
      securityLevel: "strict",
      logLevel: "fatal",
      htmlLabels: false,
      theme: nextTheme,
      fontFamily: "inherit",
      themeVariables: isDarkTheme
        ? {
            background: "#0f172a",
            primaryColor: "#1f2937",
            primaryTextColor: "#e2e8f0",
            lineColor: "#94a3b8",
            textColor: "#e2e8f0",
            edgeLabelBackground: "#111827",
          }
        : {
            background: "#ffffff",
            primaryColor: "#f8fafc",
            primaryTextColor: "#0f172a",
            lineColor: "#334155",
            textColor: "#0f172a",
            edgeLabelBackground: "#f1f5f9",
          },
    })
    mermaid.setParseErrorHandler(() => {})
    configuredTheme = nextTheme
  }

  return mermaid
}

function sanitizeRenderedSvg(rawSvg: string) {
  return rawSvg
    .replace(SCRIPT_TAG_RE, "")
    .replace(EVENT_HANDLER_ATTR_RE, "")
    .replace(JS_URL_ATTR_RE, "")
}

function formatMermaidError(error: unknown, locale: MermaidLocale) {
  const copy = COPY[locale]
  const details = getMermaidErrorDetails(error)
  if (details.kind === "unsupported") return copy.unsupported

  return [
    copy.syntax,
    details.line ? copy.line(details.line) : null,
    details.token ? copy.token(details.token) : null,
  ].filter(Boolean).join(" ")
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "true")
  textarea.style.position = "fixed"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  document.body.removeChild(textarea)
}

export function MermaidDiagram({
  code,
  language,
  copyLabel,
  copiedLabel,
}: {
  code: string
  language: string
  copyLabel: string
  copiedLabel: string
}) {
  const normalizedCode = useMemo(() => normalizeMermaidSource(code), [code])
  const locale = resolveLocale(language)
  const copy = COPY[locale]
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isDarkTheme, setIsDarkTheme] = useState(isDarkDocumentTheme)
  const [retryNonce, setRetryNonce] = useState(0)
  const timeoutRef = useRef<number | null>(null)
  const renderIdRef = useRef(0)

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const syncTheme = () => setIsDarkTheme(isDarkDocumentTheme())

    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] })
    media.addEventListener("change", syncTheme)

    return () => {
      observer.disconnect()
      media.removeEventListener("change", syncTheme)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const currentRenderId = ++renderIdRef.current
    let cancelled = false

    if (isUnsupportedMermaidSource(normalizedCode)) {
      setSvg(null)
      setError(copy.unsupported)
      return
    }

    setSvg(null)
    setError(null)

    async function render() {
      try {
        const mermaid = await getConfiguredMermaid(isDarkTheme)
        await mermaid.parse(normalizedCode)
        if (cancelled || currentRenderId !== renderIdRef.current) return

        const id = `mermaid-chat-${++nextMermaidRenderId}`
        const { svg: renderedSvg } = await mermaid.render(id, normalizedCode)
        const safeSvg = sanitizeRenderedSvg(renderedSvg)

        if (cancelled || currentRenderId !== renderIdRef.current) return
        if (MERMAID_ERROR_SVG_RE.test(safeSvg)) {
          setError(copy.syntax)
          return
        }
        setSvg(safeSvg)
      } catch (renderError) {
        if (cancelled || currentRenderId !== renderIdRef.current) return
        setError(formatMermaidError(renderError, locale))
        setSvg(null)
      }
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [copy.syntax, copy.unsupported, isDarkTheme, locale, normalizedCode, retryNonce])

  const handleCopy = useCallback(async () => {
    await copyTextToClipboard(normalizedCode)
    setCopied(true)
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setCopied(false), 1600)
  }, [normalizedCode])

  return (
    <div className="not-prose my-4 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-colors">
      <div className="flex items-center justify-between border-b border-border bg-muted/55 px-3 py-2">
        <span className="truncate text-xs font-semibold text-foreground/80">Mermaid</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background/70 px-2.5 text-xs font-semibold text-foreground/85 transition hover:bg-muted active:scale-[0.96]"
          aria-label={copied ? copiedLabel : copyLabel}
        >
          {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <div className="min-w-0 overflow-auto bg-card p-4">
        {error ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <pre className="whitespace-pre-wrap break-words font-mono">{error}</pre>
            </div>
            <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-5 text-foreground/80">
              <code className="font-mono">{normalizedCode}</code>
            </pre>
            <button
              type="button"
              onClick={() => setRetryNonce((current) => current + 1)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground/85 transition hover:bg-muted active:scale-[0.96]"
            >
              <RefreshCw className="size-3.5" />
              {copy.retry}
            </button>
          </div>
        ) : svg ? (
          <div
            className="flex min-w-0 justify-center [&_svg]:h-auto [&_svg]:max-w-full [&_svg]:overflow-visible"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground" aria-live="polite">
            <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-accent" />
            <span className="sr-only">{copy.loading}</span>
          </div>
        )}
      </div>
    </div>
  )
}
