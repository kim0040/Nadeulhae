"use client"

import React, {
  useCallback,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
} from "react"
import { cn } from "@/lib/utils"

interface ParticlesProps extends ComponentPropsWithoutRef<"div"> {
  className?: string
  quantity?: number
  staticity?: number
  ease?: number
  size?: number
  fps?: number
  refresh?: boolean
  color?: string
  vx?: number
  vy?: number
}

function hexToRgb(hex: string): number[] {
  hex = hex.replace("#", "")
  if (hex.length === 3) {
    hex = hex.split("").map((char) => char + char).join("")
  }
  const hexInt = parseInt(hex, 16)
  const red = (hexInt >> 16) & 255
  const green = (hexInt >> 8) & 255
  const blue = hexInt & 255
  return [red, green, blue]
}

type Circle = {
  x: number
  y: number
  translateX: number
  translateY: number
  size: number
  alpha: number
  targetAlpha: number
  dx: number
  dy: number
  magnetism: number
}

const MAX_DPR = 1.5

export const Particles: React.FC<ParticlesProps> = ({
  className = "",
  quantity = 80,
  staticity = 50,
  ease = 50,
  size = 0.4,
  fps = 20,
  refresh = false,
  color = "#ffffff",
  vx = 0,
  vy = 0,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const context = useRef<CanvasRenderingContext2D | null>(null)
  const circles = useRef<Circle[]>([])
  const mouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  const dpr = useRef(1)
  const rafID = useRef<number | null>(null)
  const lastFrameTs = useRef(0)
  const inView = useRef(true)
  const pageVisible = useRef(true)
  const reducedMotion = useRef(false)
  const rgb = useRef<number[]>(hexToRgb(color))
  const frameIntervalMs = 1000 / Math.max(8, fps)

  const refreshDpr = useCallback(() => {
    if (typeof window === "undefined") {
      dpr.current = 1
      return
    }
    dpr.current = Math.min(window.devicePixelRatio || 1, MAX_DPR)
  }, [])

  const circleParams = useCallback((): Circle => {
    const x = Math.floor(Math.random() * canvasSize.current.w)
    const y = Math.floor(Math.random() * canvasSize.current.h)
    const translateX = 0
    const translateY = 0
    const pSize = Math.floor(Math.random() * 2) + size
    const alpha = 0
    const targetAlpha = parseFloat((Math.random() * 0.6 + 0.1).toFixed(1))
    const dx = (Math.random() - 0.5) * 0.1
    const dy = (Math.random() - 0.5) * 0.1
    const magnetism = 0.1 + Math.random() * 4
    return { x, y, translateX, translateY, size: pSize, alpha, targetAlpha, dx, dy, magnetism }
  }, [size])

  const drawCircle = useCallback((circle: Circle, update = false) => {
    if (context.current) {
      const { x, y, translateX, translateY, size, alpha } = circle
      context.current.translate(translateX, translateY)
      context.current.beginPath()
      context.current.arc(x, y, size, 0, 2 * Math.PI)
      context.current.fillStyle = `rgba(${rgb.current.join(", ")}, ${alpha})`
      context.current.fill()
      context.current.setTransform(dpr.current, 0, 0, dpr.current, 0, 0)
      if (!update) circles.current.push(circle)
    }
  }, [])

  const drawParticles = useCallback(() => {
    if (context.current) {
      context.current.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h)
      circles.current = []
      for (let i = 0; i < quantity; i++) {
        drawCircle(circleParams())
      }
    }
  }, [circleParams, drawCircle, quantity])

  const resizeCanvas = useCallback(() => {
    if (canvasContainerRef.current && canvasRef.current && context.current) {
      canvasSize.current.w = canvasContainerRef.current.offsetWidth
      canvasSize.current.h = canvasContainerRef.current.offsetHeight
      canvasRef.current.width = Math.floor(canvasSize.current.w * dpr.current)
      canvasRef.current.height = Math.floor(canvasSize.current.h * dpr.current)
      canvasRef.current.style.width = `${canvasSize.current.w}px`
      canvasRef.current.style.height = `${canvasSize.current.h}px`
      context.current.setTransform(dpr.current, 0, 0, dpr.current, 0, 0)
      drawParticles()
    }
  }, [drawParticles])

  const initCanvas = useCallback(() => {
    refreshDpr()
    resizeCanvas()
  }, [refreshDpr, resizeCanvas])

  const shouldAnimate = useCallback(() => {
    return !reducedMotion.current && pageVisible.current && inView.current
  }, [])

  const renderFrame = useCallback(() => {
    if (!context.current) {
      return
    }

    context.current.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h)
    circles.current.forEach((circle, i) => {
      circle.x += circle.dx + vx
      circle.y += circle.dy + vy
      circle.translateX += (mouse.current.x / (staticity / circle.magnetism) - circle.translateX) / ease
      circle.translateY += (mouse.current.y / (staticity / circle.magnetism) - circle.translateY) / ease
      if (circle.alpha < circle.targetAlpha) circle.alpha += 0.01
      drawCircle(circle, true)

      if (
        circle.x < -circle.size || circle.x > canvasSize.current.w + circle.size ||
        circle.y < -circle.size || circle.y > canvasSize.current.h + circle.size
      ) {
        circles.current[i] = circleParams()
      }
    })
  }, [circleParams, drawCircle, ease, staticity, vx, vy])

  const stopAnimation = useCallback(() => {
    if (rafID.current != null) {
      window.cancelAnimationFrame(rafID.current)
      rafID.current = null
    }
  }, [])

  const startAnimation = useCallback(() => {
    if (rafID.current != null || !shouldAnimate()) {
      return
    }

    const tick = (timestamp: number) => {
      if (!shouldAnimate()) {
        stopAnimation()
        return
      }

      if (timestamp - lastFrameTs.current >= frameIntervalMs) {
        renderFrame()
        lastFrameTs.current = timestamp
      }
      rafID.current = window.requestAnimationFrame(tick)
    }

    rafID.current = window.requestAnimationFrame(tick)
  }, [frameIntervalMs, renderFrame, shouldAnimate, stopAnimation])

  useEffect(() => {
    if (canvasRef.current) {
      context.current = canvasRef.current.getContext("2d")
    }
    rgb.current = hexToRgb(color)

    const onPointerMove = (event: PointerEvent) => {
      if (!canvasRef.current) {
        return
      }

      const rect = canvasRef.current.getBoundingClientRect()
      const { w, h } = canvasSize.current
      const x = event.clientX - rect.left - w / 2
      const y = event.clientY - rect.top - h / 2
      const inside = x < w / 2 && x > -w / 2 && y < h / 2 && y > -h / 2
      if (inside) {
        mouse.current.x = x
        mouse.current.y = y
      }
    }

    const onPointerLeave = () => {
      mouse.current.x = 0
      mouse.current.y = 0
    }

    const onResize = () => {
      initCanvas()
    }

    const onVisibilityChange = () => {
      pageVisible.current = !document.hidden
      if (shouldAnimate()) {
        startAnimation()
      } else {
        stopAnimation()
      }
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const applyReducedMotion = () => {
      reducedMotion.current = media.matches
      if (shouldAnimate()) {
        startAnimation()
      } else {
        stopAnimation()
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        inView.current = entries[0]?.isIntersecting ?? true
        if (shouldAnimate()) {
          startAnimation()
        } else {
          stopAnimation()
        }
      },
      {
        threshold: 0.01,
      }
    )

    if (canvasContainerRef.current) {
      observer.observe(canvasContainerRef.current)
    }

    initCanvas()
    const container = canvasContainerRef.current
    if (container) {
      container.addEventListener("pointermove", onPointerMove, { passive: true })
      container.addEventListener("pointerleave", onPointerLeave, { passive: true })
    }

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined" && container) {
      resizeObserver = new ResizeObserver(onResize)
      resizeObserver.observe(container)
    } else {
      window.addEventListener("resize", onResize)
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    media.addEventListener("change", applyReducedMotion)

    onVisibilityChange()
    applyReducedMotion()
    startAnimation()

    return () => {
      stopAnimation()
      observer.disconnect()
      if (container) {
        container.removeEventListener("pointermove", onPointerMove)
        container.removeEventListener("pointerleave", onPointerLeave)
      }
      if (resizeObserver) {
        resizeObserver.disconnect()
      } else {
        window.removeEventListener("resize", onResize)
      }
      document.removeEventListener("visibilitychange", onVisibilityChange)
      media.removeEventListener("change", applyReducedMotion)
    }
  }, [color, initCanvas, shouldAnimate, startAnimation, stopAnimation])

  useEffect(() => {
    rgb.current = hexToRgb(color)
    initCanvas()
  }, [color, initCanvas, refresh])

  return (
    <div className={cn("pointer-events-none", className)} ref={canvasContainerRef} aria-hidden="true" {...props}>
      <canvas ref={canvasRef} className="size-full" />
    </div>
  )
}
