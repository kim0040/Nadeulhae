"use client"

/**
 * Shiny Button — an animated button with a shimmering highlight effect.
 *
 * Uses framer-motion to animate a CSS custom property `--x` from 100% to -100%,
 * creating a diagonal light sweep across the button surface. The effect is
 * achieved through a CSS mask-image gradient that reveals a highlight layer
 * positioned by `--x`.
 *
 * The animation runs on a continuous spring loop with a 1-second delay
 * between sweeps. Works in both light and dark modes via Tailwind dark: prefix.
 *
 * @example
 * <ShinyButton onClick={handleClick}>Get Started</ShinyButton>
 */

import React from "react"
import { motion, type Transition } from "framer-motion"

import { cn } from "@/lib/utils"

const animationTransition: Transition = {
  repeat: Infinity,
  repeatType: "loop",
  repeatDelay: 1,
  type: "spring",
  stiffness: 20,
  damping: 15,
  mass: 2,
}

interface ShinyButtonProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
}

export const ShinyButton = React.forwardRef<HTMLButtonElement, ShinyButtonProps>(
  ({ children, className, onClick, disabled }, ref) => {
    return (
      <motion.button
        ref={ref}
        className={cn(
          "relative cursor-pointer rounded-lg border px-6 py-2 font-medium backdrop-blur-xl transition-shadow duration-300 ease-in-out hover:shadow dark:bg-[radial-gradient(circle_at_50%_0%,var(--primary)/10%_0%,transparent_60%)] dark:hover:shadow-[0_0_20px_var(--primary)/10%]",
          className
        )}
        initial={{ "--x": "100%", scale: 0.8 } as any}
        animate={{ "--x": "-100%", scale: 1 } as any}
        whileTap={{ scale: 0.95 }}
        transition={animationTransition}
        onClick={onClick}
        disabled={disabled}
      >
        <span
          className="relative block size-full text-sm tracking-wide text-[rgb(0,0,0,65%)] uppercase dark:font-light dark:text-[rgb(255,255,255,90%)]"
          style={{
            maskImage:
              "linear-gradient(-75deg,var(--primary) calc(var(--x) + 20%),transparent calc(var(--x) + 30%),var(--primary) calc(var(--x) + 100%))",
          }}
        >
          {children}
        </span>
        <span
          style={{
            mask: "linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box exclude,linear-gradient(rgb(0,0,0), rgb(0,0,0))",
            WebkitMask:
              "linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box exclude,linear-gradient(rgb(0,0,0), rgb(0,0,0))",
            backgroundImage:
              "linear-gradient(-75deg,var(--primary)/10% calc(var(--x)+20%),var(--primary)/50% calc(var(--x)+25%),var(--primary)/10% calc(var(--x)+100%))",
          }}
          className="absolute inset-0 z-10 block rounded-[inherit] p-px"
        />
      </motion.button>
    )
  }
)

ShinyButton.displayName = "ShinyButton"
