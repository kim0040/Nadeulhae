"use client"

import { useEffect, useMemo, useState } from "react"
import { useTheme } from "next-themes"
import CodeMirror from "@uiw/react-codemirror"
import { EditorView } from "@codemirror/view"
import { cn } from "@/lib/utils"

// Language extensions are dynamically imported to keep initial bundle small.
async function getLanguageExtension(language: string) {
  try {
    switch (language.toLowerCase()) {
      case "typescript":
      case "ts":
      case "tsx": {
        const { javascript } = await import("@codemirror/lang-javascript")
        return javascript({ typescript: true, jsx: language === "tsx" })
      }
      case "javascript":
      case "js":
      case "jsx": {
        const { javascript } = await import("@codemirror/lang-javascript")
        return javascript({ jsx: language === "jsx" })
      }
      case "python":
      case "py": {
        const { python } = await import("@codemirror/lang-python")
        return python()
      }
      case "c":
      case "cpp":
      case "c++": {
        const { cpp } = await import("@codemirror/lang-cpp")
        return cpp()
      }
      case "java": {
        const { java } = await import("@codemirror/lang-java")
        return java()
      }
      case "html": {
        const { html } = await import("@codemirror/lang-html")
        return html()
      }
      case "css": {
        const { css } = await import("@codemirror/lang-css")
        return css()
      }
      case "json": {
        const { json } = await import("@codemirror/lang-json")
        return json()
      }
      case "yaml":
      case "yml": {
        const { yaml } = await import("@codemirror/lang-yaml")
        return yaml()
      }
      case "markdown":
      case "md": {
        const { markdown } = await import("@codemirror/lang-markdown")
        return markdown()
      }
      case "rust":
      case "rs": {
        const { rust } = await import("@codemirror/lang-rust")
        return rust()
      }
      case "go":
      case "golang": {
        const { go } = await import("@codemirror/lang-go")
        return go()
      }
      case "bash":
      case "sh":
      case "shell":
      case "plaintext":
      default:
        return null
    }
  } catch {
    return null
  }
}

// Lazy-load cache so language extensions are loaded once per language value.
const languageExtensionCache = new Map<string, ReturnType<typeof getLanguageExtension>>()

function getCachedLanguageExtension(language: string) {
  const key = language.toLowerCase()
  if (!languageExtensionCache.has(key)) {
    languageExtensionCache.set(key, getLanguageExtension(key))
  }
  return languageExtensionCache.get(key)!
}

// Custom theme that integrates with the site's CSS custom properties.
const siteThemeBase = EditorView.baseTheme({
  "&": {
    fontSize: "15px",
    fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  ".cm-gutters": {
    border: "none",
    borderRight: "1px solid var(--card-border)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftWidth: "2px",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-content": {
    padding: "12px 0",
  },
  ".cm-line": {
    padding: "0 12px",
  },
  // Remove the focused blue outline and let the parent container handle borders.
  "&.cm-editor": {
    borderRadius: "0",
  },
})

const siteLightTheme = EditorView.theme({
  "&": {
    backgroundColor: "rgba(255, 255, 255, 0.6) !important",
    color: "#112027 !important",
  },
  ".cm-gutters": {
    backgroundColor: "rgba(245, 251, 250, 0.6)",
    color: "#5f717a",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(47, 111, 228, 0.05)",
  },
  ".cm-activeLineGutter": {
    color: "#2f6fe4",
  },
  ".cm-cursor": {
    borderLeftColor: "#2f6fe4",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(47, 111, 228, 0.14) !important",
  },
})

const siteDarkTheme = EditorView.theme({
  "&": {
    backgroundColor: "rgba(10, 24, 32, 0.5) !important",
    color: "#e9f5f3 !important",
  },
  ".cm-gutters": {
    backgroundColor: "rgba(7, 17, 24, 0.5)",
    color: "#98aeb7",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(125, 179, 255, 0.06)",
  },
  ".cm-activeLineGutter": {
    color: "#7db3ff",
  },
  ".cm-cursor": {
    borderLeftColor: "#7db3ff",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(125, 179, 255, 0.18) !important",
  },
})

export function CodeMirrorEditor({
  value,
  onChange,
  onBlur,
  language = "plaintext",
  readOnly = false,
  placeholder = "",
  className,
}: {
  value: string
  onChange?: (value: string) => void
  onBlur?: () => void
  language?: string
  readOnly?: boolean
  placeholder?: string
  className?: string
}) {
  const { resolvedTheme } = useTheme()

  const [langExt, setLangExt] = useState<import("@codemirror/language").LanguageSupport | null>(null)

  // Load language extension on mount and when language prop changes.
  useEffect(() => {
    let cancelled = false
    setLangExt(null)

    getCachedLanguageExtension(language).then((ext) => {
      if (!cancelled && ext) {
        setLangExt(ext)
      }
    })

    return () => {
      cancelled = true
    }
  }, [language])

  const extensions = useMemo(() => {
    const exts = [
      siteThemeBase,
      resolvedTheme === "dark" ? siteDarkTheme : siteLightTheme,
      EditorView.lineWrapping,
    ]

    if (langExt) {
      exts.push(langExt)
    }

    return exts
  }, [langExt, resolvedTheme])

  return (
    <div className={cn("overflow-hidden rounded-xl border border-card-border/70", className)}>
      <CodeMirror
        value={value}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        onChange={onChange}
        onBlur={onBlur}
        readOnly={readOnly}
        editable={!readOnly}
        placeholder={placeholder}
        extensions={extensions}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: true,
          autocompletion: false,
          closeBrackets: true,
          indentOnInput: true,
          tabSize: 2,
          highlightSelectionMatches: true,
          searchKeymap: true,
        }}
        className="h-full"
      />
    </div>
  )
}

