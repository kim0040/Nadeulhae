"use client"

import { useEffect } from "react"

import { ErrorExperience } from "@/components/error/error-experience"
import { ThemeProvider } from "@/components/theme-provider"
import { LanguageProvider } from "@/context/LanguageContext"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <LanguageProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ErrorExperience
              variant="globalError"
              error={error}
              reset={reset}
              showStandaloneControls
            />
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
