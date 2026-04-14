"use client"

import { useEffect, useMemo, useState, type ComponentPropsWithoutRef } from "react"

import { getMarqueeRepeat, shouldRunContinuousAnimation } from "@/lib/performance"
import { cn } from "@/lib/utils"

interface MarqueeProps extends ComponentPropsWithoutRef<"div"> {
  className?: string
  reverse?: boolean
  pauseOnHover?: boolean
  children: React.ReactNode
  vertical?: boolean
  repeat?: number
}

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  ...props
}: MarqueeProps) {
  const [canAnimate, setCanAnimate] = useState(false)

  useEffect(() => {
    const update = () => {
      setCanAnimate(shouldRunContinuousAnimation())
    }

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
  }, [])

  const effectiveRepeat = useMemo(() => {
    if (!canAnimate) {
      return 1
    }
    return getMarqueeRepeat(repeat)
  }, [canAnimate, repeat])

  return (
    <div
      {...props}
      className={cn(
        "group flex gap-(--gap) overflow-hidden p-2 [--duration:40s] [--gap:1rem]",
        {
          "flex-row": !vertical,
          "flex-col": vertical,
        },
        className
      )}
    >
      {Array(effectiveRepeat)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            className={cn("flex shrink-0 justify-around gap-(--gap)", {
              "flex-row": !vertical,
              "flex-col": vertical,
              "animate-marquee": canAnimate && !vertical,
              "animate-marquee-vertical": canAnimate && vertical,
              "group-hover:[animation-play-state:paused]": canAnimate && pauseOnHover,
              "[animation-direction:reverse]": canAnimate && reverse,
            })}
          >
            {children}
          </div>
        ))}
    </div>
  )
}
