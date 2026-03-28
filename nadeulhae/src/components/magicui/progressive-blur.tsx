"use client"

import React from "react"
import { cn } from "@/lib/utils"

type BlurPosition = "top" | "bottom" | "left" | "right" | "both-y" | "both-x"

export interface ProgressiveBlurProps {
  className?: string
  size?: string
  position?: BlurPosition
  blurLevels?: number[]
}

export function ProgressiveBlur({
  className,
  size = "20%",
  position = "bottom",
  blurLevels = [0.5, 1, 2, 4, 8, 16, 24, 32],
}: ProgressiveBlurProps) {
  const layers = Array.from({ length: blurLevels.length - 2 })

  const isHorizontal = position === "left" || position === "right" || position === "both-x"
  const dimensionStyle = isHorizontal ? { width: position === "both-x" ? "100%" : size } : { height: position === "both-y" ? "100%" : size }

  const containerPosition =
    position === "top"
      ? "top-0 inset-x-0"
      : position === "bottom"
        ? "bottom-0 inset-x-0"
        : position === "left"
          ? "left-0 inset-y-0"
          : position === "right"
            ? "right-0 inset-y-0"
            : position === "both-x"
              ? "inset-x-0 inset-y-0"
              : "inset-y-0 inset-x-0"

  const buildMask = (index: number) => {
    const start = index * 12.5
    const middle = (index + 1) * 12.5
    const end = (index + 2) * 12.5

    if (position === "bottom") {
      return `linear-gradient(to bottom, rgba(0,0,0,0) ${start}%, rgba(0,0,0,1) ${middle}%, rgba(0,0,0,1) ${end}%, rgba(0,0,0,0) ${end + 12.5}%)`
    }
    if (position === "top") {
      return `linear-gradient(to top, rgba(0,0,0,0) ${start}%, rgba(0,0,0,1) ${middle}%, rgba(0,0,0,1) ${end}%, rgba(0,0,0,0) ${end + 12.5}%)`
    }
    if (position === "left") {
      return `linear-gradient(to left, rgba(0,0,0,0) ${start}%, rgba(0,0,0,1) ${middle}%, rgba(0,0,0,1) ${end}%, rgba(0,0,0,0) ${end + 12.5}%)`
    }
    if (position === "right") {
      return `linear-gradient(to right, rgba(0,0,0,0) ${start}%, rgba(0,0,0,1) ${middle}%, rgba(0,0,0,1) ${end}%, rgba(0,0,0,0) ${end + 12.5}%)`
    }
    if (position === "both-x") {
      return "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 5%, rgba(0,0,0,0) 95%, rgba(0,0,0,1) 100%)"
    }
    return "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 5%, rgba(0,0,0,0) 95%, rgba(0,0,0,1) 100%)"
  }

  const buildBackground = () => {
    if (position === "bottom") return "linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--background) 72%, transparent) 100%)"
    if (position === "top") return "linear-gradient(to top, transparent 0%, color-mix(in srgb, var(--background) 72%, transparent) 100%)"
    if (position === "left") return "linear-gradient(to left, transparent 0%, color-mix(in srgb, var(--background) 72%, transparent) 100%)"
    if (position === "right") return "linear-gradient(to right, transparent 0%, color-mix(in srgb, var(--background) 72%, transparent) 100%)"
    if (position === "both-x") return "linear-gradient(to right, color-mix(in srgb, var(--background) 72%, transparent) 0%, transparent 12%, transparent 88%, color-mix(in srgb, var(--background) 72%, transparent) 100%)"
    return "linear-gradient(to bottom, color-mix(in srgb, var(--background) 72%, transparent) 0%, transparent 12%, transparent 88%, color-mix(in srgb, var(--background) 72%, transparent) 100%)"
  }

  return (
    <div className={cn("pointer-events-none absolute z-10", containerPosition, className)} style={dimensionStyle}>
      <div
        className="absolute inset-0"
        style={{
          zIndex: 1,
          background: buildBackground(),
          backdropFilter: `blur(${blurLevels[0]}px)`,
          WebkitBackdropFilter: `blur(${blurLevels[0]}px)`,
          maskImage: buildMask(0),
          WebkitMaskImage: buildMask(0),
        }}
      />
      {layers.map((_, index) => (
        <div
          key={`blur-layer-${index}`}
          className="absolute inset-0"
          style={{
            zIndex: index + 2,
            background: buildBackground(),
            backdropFilter: `blur(${blurLevels[index + 1]}px)`,
            WebkitBackdropFilter: `blur(${blurLevels[index + 1]}px)`,
            maskImage: buildMask(index + 1),
            WebkitMaskImage: buildMask(index + 1),
          }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{
          zIndex: blurLevels.length,
          background: buildBackground(),
          backdropFilter: `blur(${blurLevels.at(-1) ?? 32}px)`,
          WebkitBackdropFilter: `blur(${blurLevels.at(-1) ?? 32}px)`,
          maskImage: buildMask(blurLevels.length - 2),
          WebkitMaskImage: buildMask(blurLevels.length - 2),
        }}
      />
    </div>
  )
}
