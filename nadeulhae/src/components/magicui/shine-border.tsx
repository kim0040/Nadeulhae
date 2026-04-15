"use client"

import * as React from "react"

import { shouldRunContinuousAnimation } from "@/lib/performance"
import { cn } from "@/lib/utils"

interface ShineBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  borderWidth?: number
  duration?: number
  shineColor?: string | string[]
}

export function ShineBorder({
  borderWidth = 1,
  duration = 14,
  shineColor = "#000000",
  className,
  style,
  ...props
}: ShineBorderProps) {
  const [canAnimate, setCanAnimate] = React.useState(false)

  React.useEffect(() => {
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

  if (!canAnimate) {
    const fallbackColor = Array.isArray(shineColor) ? shineColor[0] ?? "#000000" : shineColor
    return (
      <div
        style={
          {
            "--border-width": `${borderWidth}px`,
            border: `${borderWidth}px solid ${fallbackColor}`,
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          "pointer-events-none absolute inset-0 size-full rounded-[inherit]",
          className
        )}
        {...props}
      />
    )
  }

  return (
    <div
      style={
        {
          "--border-width": `${borderWidth}px`,
          "--duration": `${duration}s`,
          backgroundImage: `radial-gradient(transparent,transparent, ${
            Array.isArray(shineColor) ? shineColor.join(",") : shineColor
          },transparent,transparent)`,
          backgroundSize: "300% 300%",
          mask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          padding: "var(--border-width)",
          ...style,
        } as React.CSSProperties
      }
      className={cn(
        "animate-shine pointer-events-none absolute inset-0 size-full rounded-[inherit] will-change-[background-position]",
        className
      )}
      {...props}
    />
  )
}
