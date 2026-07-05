"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Copy, AlertTriangle } from "lucide-react"

const MERMAID_ERROR_SVG_RE = /aria-roledescription="error"|class="error-icon"|Syntax error in text/i
const HTML_BLOCK_RE = /<\s*(svg|div)\b/i
const SCRIPT_TAG_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi
const EVENT_HANDLER_ATTR_RE = /\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi
const JS_URL_ATTR_RE = /\s(?:href|xlink:href)\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi

function normalizeMermaidErrorMessage(raw: string) {
  const compact = raw.replace(/\s+/g, " ").trim()
  if (!compact) return "Failed to render Mermaid diagram. Check the syntax and try again."

  if (/No diagram type detected/i.test(compact)) {
    return "Unsupported Mermaid diagram type. Use supported types such as flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, or erDiagram."
  }

  if (MERMAID_ERROR_SVG_RE.test(compact) || HTML_BLOCK_RE.test(compact)) {
    return "Mermaid syntax error. Please check the diagram type and syntax."
  }

  return compact.length > 320 ? `${compact.slice(0, 317)}...` : compact
}

function sanitizeRenderedSvg(rawSvg: string) {
  return rawSvg
    .replace(SCRIPT_TAG_RE, "")
    .replace(EVENT_HANDLER_ATTR_RE, "")
    .replace(JS_URL_ATTR_RE, "")
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
  copyLabel,
  copiedLabel,
}: {
  code: string
  copyLabel: string
  copiedLabel: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isDarkTheme, setIsDarkTheme] = useState(false)
  const timeoutRef = useRef<number | null>(null)
  const renderIdRef = useRef(0)
  const isUnsupportedUseCaseDiagram = useMemo(() => /^\s*usecaseDiagram\b/i.test(code), [code])

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const syncTheme = () => {
      const classTheme = root.classList.contains("dark")
      const dataTheme = root.getAttribute("data-theme") === "dark"
      const prefersDark = !root.classList.contains("light") && root.getAttribute("data-theme") == null && media.matches
      setIsDarkTheme(classTheme || dataTheme || prefersDark)
    }

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

    if (isUnsupportedUseCaseDiagram) {
      setSvg(null)
      setError("`useCaseDiagram` is not supported in Mermaid 11.14.0. Please rewrite it as `flowchart` or `classDiagram`.")
      return
    }

    // The `code` prop grows token-by-token while the assistant streams. Rendering
    // every partial snapshot flashes parse errors for half-written diagrams, so
    // debounce: only attempt a render once the code has stopped changing for a
    // beat (which, during streaming, effectively defers rendering to completion).
    const RENDER_DEBOUNCE_MS = 320

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          theme: isDarkTheme ? "dark" : "default",
          securityLevel: "loose",
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

        // Validate first (suppressErrors → resolves false instead of throwing),
        // so incomplete/invalid diagrams never throw or inject error DOM.
        const parseOk = await mermaid.parse(code, { suppressErrors: true })
        if (cancelled || currentRenderId !== renderIdRef.current) return
        if (!parseOk) {
          setSvg(null)
          setError("Mermaid syntax error. Please check the diagram type and syntax.")
          return
        }

        const id = `mermaid-${currentRenderId}-${Date.now()}`
        const { svg: renderedSvg } = await mermaid.render(id, code)
        const safeSvg = sanitizeRenderedSvg(renderedSvg)

        if (cancelled || currentRenderId !== renderIdRef.current) return
        if (MERMAID_ERROR_SVG_RE.test(safeSvg)) {
          setSvg(null)
          setError("Mermaid syntax error. Please check the diagram type and syntax.")
          return
        }
        setSvg(safeSvg)
        setError(null)
      } catch (err) {
        if (cancelled || currentRenderId !== renderIdRef.current) return
        const message = err instanceof Error ? err.message : "Failed to render Mermaid diagram."
        setError(normalizeMermaidErrorMessage(message))
        setSvg(null)
      }
    }

    const debounceTimer = window.setTimeout(() => {
      void render()
    }, RENDER_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(debounceTimer)
    }
  }, [code, isDarkTheme, isUnsupportedUseCaseDiagram])

  const handleCopy = useCallback(async () => {
    await copyTextToClipboard(code)
    setCopied(true)
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setCopied(false), 1600)
  }, [code])

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
      <div ref={containerRef} className="overflow-auto bg-card p-4 min-w-0">
        {error ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <pre className="whitespace-pre-wrap break-words font-mono">{error}</pre>
            </div>
            {/* Fallback: the diagram couldn't render, so show the raw Mermaid
                source instead of nothing — the content is still readable/copyable. */}
            <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-5 text-foreground/80">
              <code className="font-mono">{code}</code>
            </pre>
          </div>
        ) : svg ? (
          <div
            className="flex justify-center min-w-0 [&_svg]:h-auto [&_svg]:max-w-full [&_svg]:overflow-visible"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-accent" />
          </div>
        )}
      </div>
    </div>
  )
}
