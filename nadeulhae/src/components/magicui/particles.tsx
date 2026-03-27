"use client"

import React, {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react"
import { cn } from "@/lib/utils"

interface MousePosition {
  x: number
  y: number
}

function useMousePosition(): MousePosition {
  const [mousePosition, setMousePosition] = useState<MousePosition>({
    x: 0,
    y: 0,
  })

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  return mousePosition
}

interface ParticlesProps extends ComponentPropsWithoutRef<"div"> {
  className?: string
  quantity?: number
  staticity?: number
  ease?: number
  size?: number
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

export const Particles: React.FC<ParticlesProps> = ({
  className = "",
  quantity = 100,
  staticity = 50,
  ease = 50,
  size = 0.4,
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
  const mousePosition = useMousePosition()
  const mouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1
  const rafID = useRef<number | null>(null)

  useEffect(() => {
    if (canvasRef.current) {
      context.current = canvasRef.current.getContext("2d")
    }
    rgb.current = hexToRgb(color)
    initCanvas()
    animate()
    window.addEventListener("resize", initCanvas)
    return () => {
      if (rafID.current != null) window.cancelAnimationFrame(rafID.current)
      window.removeEventListener("resize", initCanvas)
    }
  }, [color])

  useEffect(() => {
    onMouseMove()
  }, [mousePosition.x, mousePosition.y])

  useEffect(() => {
    initCanvas()
  }, [refresh])

  const initCanvas = () => {
    resizeCanvas()
    drawParticles()
  }

  const onMouseMove = () => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const { w, h } = canvasSize.current
      const x = mousePosition.x - rect.left - w / 2
      const y = mousePosition.y - rect.top - h / 2
      const inside = x < w / 2 && x > -w / 2 && y < h / 2 && y > -h / 2
      if (inside) {
        mouse.current.x = x
        mouse.current.y = y
      }
    }
  }

  const resizeCanvas = () => {
    if (canvasContainerRef.current && canvasRef.current && context.current) {
      canvasSize.current.w = canvasContainerRef.current.offsetWidth
      canvasSize.current.h = canvasContainerRef.current.offsetHeight
      canvasRef.current.width = canvasSize.current.w * dpr
      canvasRef.current.height = canvasSize.current.h * dpr
      canvasRef.current.style.width = `${canvasSize.current.w}px`
      canvasRef.current.style.height = `${canvasSize.current.h}px`
      context.current.scale(dpr, dpr)
      circles.current = []
      for (let i = 0; i < quantity; i++) {
        const circle = circleParams()
        drawCircle(circle)
      }
    }
  }

  const circleParams = (): Circle => {
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
  }

  const rgb = useRef<number[]>(hexToRgb(color))

  const drawCircle = (circle: Circle, update = false) => {
    if (context.current) {
      const { x, y, translateX, translateY, size, alpha } = circle
      context.current.translate(translateX, translateY)
      context.current.beginPath()
      context.current.arc(x, y, size, 0, 2 * Math.PI)
      context.current.fillStyle = `rgba(${rgb.current.join(", ")}, ${alpha})`
      context.current.fill()
      context.current.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!update) circles.current.push(circle)
    }
  }

  const animate = () => {
    if (context.current) {
      context.current.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h)
      circles.current.forEach((circle, i) => {
        circle.x += circle.dx + vx
        circle.y += circle.dy + vy
        circle.translateX += (mouse.current.x / (staticity / circle.magnetism) - circle.translateX) / ease
        circle.translateY += (mouse.current.y / (staticity / circle.magnetism) - circle.translateY) / ease
        
        // Simple alpha animation
        if (circle.alpha < circle.targetAlpha) circle.alpha += 0.01
        
        drawCircle(circle, true)

        if (circle.x < -circle.size || circle.x > canvasSize.current.w + circle.size ||
            circle.y < -circle.size || circle.y > canvasSize.current.h + circle.size) {
          circles.current[i] = circleParams()
        }
      })
    }
    rafID.current = window.requestAnimationFrame(animate)
  }

  const drawParticles = () => {
    if (context.current) {
      context.current.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h)
      for (let i = 0; i < quantity; i++) {
        drawCircle(circleParams())
      }
    }
  }

  return (
    <div className={cn("pointer-events-none", className)} ref={canvasContainerRef} aria-hidden="true" {...props}>
      <canvas ref={canvasRef} className="size-full" />
    </div>
  )
}
