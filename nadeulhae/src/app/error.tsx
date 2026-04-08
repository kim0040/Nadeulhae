"use client"

import { useEffect } from "react"

import { ErrorExperience } from "@/components/error/error-experience"

export default function ErrorPage({
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
    <ErrorExperience
      variant="routeError"
      error={error}
      reset={reset}
      hasExternalNav
    />
  )
}
