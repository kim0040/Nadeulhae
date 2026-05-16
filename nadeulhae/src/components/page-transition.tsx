"use client"

import { useLayoutEffect, useRef } from "react"
import { usePathname } from "next/navigation"

/**
 * PageTransition — CSS keyframe-based fade-in wrapper for client-side
 * route transitions. Uses DOM class manipulation to avoid React state
 * overhead, making navigation feel fluid without cascading renders.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const isFirstRender = useRef(true)

  useLayoutEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const el = containerRef.current
    if (!el) return
    el.classList.remove("page-transition-enter")
    void el.offsetWidth
    el.classList.add("page-transition-enter")
  }, [pathname])

  return (
    <div ref={containerRef} className="relative page-transition-enter">
      {children}
    </div>
  )
}
