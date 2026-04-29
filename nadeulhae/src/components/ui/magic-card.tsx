"use client"

/**
 * Magic Card — a spotlight-glow hover effect component.
 *
 * Uses framer-motion to track the pointer position and render a
 * radial gradient that follows the mouse cursor. When the pointer
 * leaves the card, the gradient resets to an off-screen position.
 *
 * The component has two visual layers stacked via z-index:
 *   1. A background radial gradient (visible immediately)
 *   2. A foreground glow overlay (fades in on hover, z-30)
 *
 * @example
 * <MagicCard gradientFrom="#ff6b6b" gradientTo="#ffd93d">
 *   <p>Hover over me for a glow effect</p>
 * </MagicCard>
 */

import React, { useCallback, useEffect } from "react"
import {
  motion,
  useMotionTemplate,
  useMotionValue,
} from "framer-motion"

import { cn } from "@/lib/utils"

/** Props for the MagicCard component. */
interface MagicCardBaseProps {
  children?: React.ReactNode
  className?: string
  /** Diameter of the radial gradient spotlight in pixels */
  gradientSize?: number
  /** Foreground glow color (hex/rgb) */
  gradientColor?: string
  /** Opacity of the foreground glow overlay (0–1) */
  gradientOpacity?: number
  /** Start color for the background gradient */
  gradientFrom?: string
  /** End color for the background gradient */
  gradientTo?: string
}

type MagicCardProps = MagicCardBaseProps

/**
 * A card with a mouse-following gradient glow effect.
 * The gradient position is driven by `useMotionValue` which tracks
 * the pointer position relative to the card's bounding rectangle.
 */
export function MagicCard({
  children,
  className,
  gradientSize = 200,
  gradientColor = "#262626",
  gradientOpacity = 0.8,
  gradientFrom = "#9E7AFF",
  gradientTo = "#FE8BBB",
}: MagicCardProps) {
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
