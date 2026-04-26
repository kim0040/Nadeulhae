"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Copy, AlertTriangle } from "lucide-react"

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

    async function render() {
      if (isUnsupportedUseCaseDiagram) {
        setSvg(null)
        setError("`useCaseDiagram` is not supported in the current Mermaid version. Please rewrite it as `flowchart` or `classDiagram`.")
        return
      }

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

        const id = `mermaid-${currentRenderId}-${Date.now()}`
        const { svg: renderedSvg } = await mermaid.render(id, code)

        if (!cancelled) {
          setSvg(renderedSvg)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to render diagram"
          setError(message)
          setSvg(null)
        }
      }
    }

    render()

    return () => {
      cancelled = true
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
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background/70 px-2.5 text-xs font-semibold text-foreground/85 transition hover:bg-muted active:scale-[0.98]"
          aria-label={copied ? copiedLabel : copyLabel}
        >
          {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <div ref={containerRef} className="overflow-auto bg-card p-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <pre className="whitespace-pre-wrap break-words font-mono">{error}</pre>
          </div>
        ) : svg ? (
          <div
            className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full"
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
