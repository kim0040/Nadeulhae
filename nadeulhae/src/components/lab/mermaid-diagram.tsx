"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  const timeoutRef = useRef<number | null>(null)
  const renderIdRef = useRef(0)

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const currentRenderId = ++renderIdRef.current
    let cancelled = false

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          fontFamily: "inherit",
        })

        const id = `mermaid-${currentRenderId}-${Date.now()}`
        const { svg: renderedSvg } = await mermaid.render(id, code)

        if (!cancelled) {
          setSvg(renderedSvg)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram")
          setSvg(null)
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [code])

  const handleCopy = useCallback(async () => {
    await copyTextToClipboard(code)
    setCopied(true)
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setCopied(false), 1600)
  }, [code])

  return (
    <div className="not-prose my-4 overflow-hidden rounded-lg border border-border bg-[#101820] shadow-sm dark:border-white/10 dark:bg-black/35">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-3 py-2">
        <span className="truncate text-xs font-semibold text-[#d8ecff]/80">Mermaid</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-xs font-semibold text-[#d8ecff] transition hover:bg-white/[0.12] active:scale-[0.98]"
          aria-label={copied ? copiedLabel : copyLabel}
        >
          {copied ? <Check className="size-3.5 text-[#84d99d]" /> : <Copy className="size-3.5" />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <div ref={containerRef} className="overflow-auto p-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <pre className="whitespace-pre-wrap break-words font-mono">{error}</pre>
          </div>
        ) : svg ? (
          <div
            className="flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
          </div>
        )}
      </div>
    </div>
  )
}
