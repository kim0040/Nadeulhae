"use client"

import React, { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"

import { getMeteorCount, shouldRunContinuousAnimation } from "@/lib/performance"

interface MeteorsProps {
  number?: number
  minDelay?: number
  maxDelay?: number
  minDuration?: number
  maxDuration?: number
  angle?: number
  className?: string
}

export const Meteors = ({
  number = 5,
  minDelay = 0.5,
  maxDelay = 2,
  minDuration = 4,
  maxDuration = 12,
  angle = 215,
  className,
}: MeteorsProps) => {
  const [mounted, setMounted] = useState(false)
  const [canAnimate, setCanAnimate] = useState(false)
  const { resolvedTheme } = useTheme()
  const [meteorStyles, setMeteorStyles] = useState<Array<React.CSSProperties>>([])
  const effectiveCount = useMemo(() => getMeteorCount(number), [number])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) {
      return
    }

    const update = () => setCanAnimate(shouldRunContinuousAnimation())
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    update()

    const onVisibility = () => update()
    const onFocus = () => update()
    const onBlur = () => update()
    const onResize = () => update()
    const onMediaChange = () => update()

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onFocus)
    window.addEventListener("blur", onBlur)
    window.addEventListener("resize", onResize)
    media.addEventListener("change", onMediaChange)

    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("blur", onBlur)
      window.removeEventListener("resize", onResize)
      media.removeEventListener("change", onMediaChange)
    }
  }, [mounted])

  useEffect(() => {
    const styles = [...new Array(effectiveCount)].map(() => ({
      "--angle": -angle + "deg",
      top: "-5%",
      left: `${Math.floor(Math.random() * 100)}%`,
      animationDelay: Math.random() * (maxDelay - minDelay) + minDelay + "s",
      animationDuration: Math.floor(Math.random() * (maxDuration - minDuration) + minDuration) + "s",
    }))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMeteorStyles(styles)
  }, [effectiveCount, minDelay, maxDelay, minDuration, maxDuration, angle])

  if (!mounted || !canAnimate || effectiveCount <= 0) return null

  const isDark = resolvedTheme === "dark"
  const meteorColor = isDark ? "bg-white/80" : "bg-active-blue/60"
  const trailColor = isDark ? "from-white/50" : "from-active-blue/40"

  return (
    <>
      {meteorStyles.map((style, idx) => (
        <span
          key={idx}
          style={{ ...style }}
          className={cn(
            "animate-meteor pointer-events-none absolute size-0.5 rotate-(--angle) rounded-full shadow-[0_0_0_1px_#ffffff10]",
            meteorColor,
            className
          )}
        >
          <div className={cn("pointer-events-none absolute top-1/2 -z-10 h-px w-12.5 -translate-y-1/2 bg-linear-to-r to-transparent", trailColor)} />
        </span>
      ))}
    </>
  )
}
