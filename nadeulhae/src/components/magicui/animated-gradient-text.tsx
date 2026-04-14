"use client"

import { useEffect, useState, type ComponentPropsWithoutRef } from "react"

import { shouldRunContinuousAnimation } from "@/lib/performance"
import { cn } from "@/lib/utils"

export interface AnimatedGradientTextProps extends ComponentPropsWithoutRef<"span"> {
  speed?: number
  colorFrom?: string
  colorTo?: string
}

export function AnimatedGradientText({
  children,
  className,
  speed = 1,
  colorFrom = "#0b7d71",
  colorTo = "#2f6fe4",
  ...props
}: AnimatedGradientTextProps) {
  const [canAnimate, setCanAnimate] = useState(false)

  useEffect(() => {
    const update = () => setCanAnimate(shouldRunContinuousAnimation())
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    update()

    const onVisibility = () => update()
    const onFocus = () => update()
    const onBlur = () => update()
    const onMediaChange = () => update()

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onFocus)
    window.addEventListener("blur", onBlur)
    media.addEventListener("change", onMediaChange)

    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("blur", onBlur)
      media.removeEventListener("change", onMediaChange)
    }
  }, [])

  return (
    <span
      style={
        {
          "--bg-size": `${speed * 300}%`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
        } as React.CSSProperties
      }
      className={cn(
        "inline bg-linear-to-r from-(--color-from) via-(--color-to) to-(--color-from) bg-size-[var(--bg-size)_100%] bg-clip-text text-transparent",
        canAnimate && "animate-gradient",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
