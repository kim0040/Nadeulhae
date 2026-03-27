"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"

interface Props {
  max?: number
  value?: number
  min?: number
  gaugePrimaryColor?: string
  gaugeSecondaryColor?: string
  className?: string
}

export default function AnimatedCircularProgressBar({
  max = 100,
  min = 0,
  value = 0,
  gaugePrimaryColor,
  gaugeSecondaryColor,
  className,
}: Props) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === "dark"
  const primaryColor = gaugePrimaryColor ?? "#87CEEB"
  const secondaryColor = gaugeSecondaryColor ?? (isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)")

  const circumference = 2 * Math.PI * 45;
  const percentPx = circumference / 100;
  const currentPercent = ((value - min) / (max - min)) * 100;

  return (
    <div
      className={cn("relative size-40 text-2xl font-semibold", className)}
      style={
        {
          "--circle-size": "100px",
          "--circumference": circumference,
          "--percent-to-px": `${percentPx}px`,
          "--gap-percent": "5",
          "--offset-factor": "0",
          "--transition-length": "1s",
          "--transition-step": "200ms",
          "--delay": "0s",
          "--percent-to-deg": "3.6deg",
          transform: "translateZ(0)",
        } as React.CSSProperties
      }
    >
      <svg
        fill="none"
        className="size-full"
        strokeWidth="2"
        viewBox="0 0 100 100"
      >
        {currentPercent <= 90 && currentPercent >= 0 && (
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke={secondaryColor}
            strokeDasharray={`${
              (100 - currentPercent) * percentPx
            } ${circumference}`}
            strokeDashoffset="0"
            transform="rotate(-90 50 50)"
            strokeLinecap="round"
            className="opacity-100"
            style={{
              transition: "all var(--transition-length) ease var(--delay)",
            }}
          />
        )}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke={primaryColor}
          strokeDasharray={`${
            currentPercent * percentPx
          } ${circumference}`}
          strokeDashoffset="0"
          transform="rotate(-90 50 50)"
          strokeLinecap="round"
          style={{
            transition: "all var(--transition-length) ease var(--delay)",
          }}
        />
      </svg>
      <span
        data-current-value={value}
        className="duration-[var(--transition-length)] delay-[var(--delay)] absolute inset-0 m-auto size-fit ease-linear animate-in fade-in text-foreground"
      >
        {value}
      </span>

    </div>
  );
}
