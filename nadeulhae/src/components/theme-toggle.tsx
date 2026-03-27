"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-1 p-1 rounded-full bg-white/80 dark:bg-neutral-900/90 backdrop-blur-2xl border border-sky-blue/20 dark:border-white/10 shadow-xl">
      <button
        onClick={() => setTheme("light")}
        className={cn(
          "p-2 rounded-full transition-all",
          theme === "light" ? "bg-sky-blue/20 text-sky-blue shadow-sm" : "text-neutral-500 dark:text-neutral-400 hover:text-sky-blue dark:hover:text-white"
        )}
      >
        <Sun size={18} />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={cn(
          "p-2 rounded-full transition-all",
          theme === "dark" ? "bg-sky-blue/20 dark:bg-white/20 text-sky-blue dark:text-white shadow-sm" : "text-neutral-500 dark:text-neutral-400 hover:text-sky-blue dark:hover:text-white"
        )}
      >
        <Moon size={18} />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={cn(
          "p-2 rounded-full transition-all",
          theme === "system" ? "bg-sky-blue/20 dark:bg-white/20 text-sky-blue dark:text-white shadow-sm" : "text-neutral-500 dark:text-neutral-400 hover:text-sky-blue dark:hover:text-white"
        )}
      >
        <Monitor size={18} />
      </button>
    </div>
  )
}
