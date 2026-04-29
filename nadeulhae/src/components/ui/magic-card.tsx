"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from "framer-motion"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

interface MagicCardBaseProps {
  children?: React.ReactNode
  className?: string
  gradientSize?: number
  gradientColor?: string
  gradientOpacity?: number
  gradientFrom?: string
  gradientTo?: string
}

type MagicCardProps = MagicCardBaseProps

export function MagicCard({
  children,
  className,
  gradientSize = 200,
  gradientColor = "#262626",
  gradientOpacity = 0.8,
  gradientFrom = "#9E7AFF",
  gradientTo = "#FE8BBB",
}: MagicCardProps) {
  const { theme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDarkTheme = useMemo(() => {
    if (!mounted) return true
    const currentTheme = theme === "system" ? systemTheme : theme
    return currentTheme === "dark"
  }, [theme, systemTheme, mounted])

  const mouseX = useMotionValue(-gradientSize)
  const mouseY = useMotionValue(-gradientSize)

  const reset = useCallback(
    () => {
      const off = -gradientSize
      mouseX.set(off)
      mouseY.set(off)
    },
    [mouseX, mouseY, gradientSize]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      mouseX.set(e.clientX - rect.left)
      mouseY.set(e.clientY - rect.top)
    },
    [mouseX, mouseY]
  )

  useEffect(() => {
    reset()
  }, [reset])

  return (
    <motion.div
      className={cn(
        "group relative isolate overflow-hidden rounded-[inherit]",
        className
      )}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      onPointerEnter={reset}
      style={{
        background: useMotionTemplate`
          radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
            ${gradientFrom},
            ${gradientTo},
            transparent 100%
          )
        `,
      }}
    >
      <motion.div
        suppressHydrationWarning
        className="pointer-events-none absolute inset-px z-30 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
              ${gradientColor},
              transparent 100%
            )
          `,
          opacity: gradientOpacity,
        }}
      />
      <div className="relative z-40">{children}</div>
    </motion.div>
  )
}
