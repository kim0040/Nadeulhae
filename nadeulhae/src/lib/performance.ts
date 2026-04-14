export type DeviceTier = "low" | "mid" | "high"

export function detectDeviceTier(): DeviceTier {
  if (typeof window === "undefined") return "mid"

  const nav = navigator as Navigator & { deviceMemory?: number }
  const cpuCores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : 8
  const memoryGiB = typeof nav.deviceMemory === "number" ? nav.deviceMemory : 8

  if (cpuCores <= 2 || memoryGiB <= 2) return "low"
  if (cpuCores <= 4 || memoryGiB <= 4) return "mid"
  return "high"
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false
  return window.innerWidth < 768
}

export function getParticleCount(highCount: number): number {
  if (prefersReducedMotion()) return 0
  const tier = detectDeviceTier()
  const mobile = isMobileViewport()

  if (tier === "low") return Math.min(8, Math.floor(highCount * 0.15))
  if (mobile && tier === "mid") return Math.min(16, Math.floor(highCount * 0.3))
  if (mobile) return Math.floor(highCount * 0.5)
  if (tier === "mid") return Math.floor(highCount * 0.7)
  return highCount
}

export function getMeteorCount(highCount: number): number {
  if (prefersReducedMotion()) return 0
  const tier = detectDeviceTier()
  const mobile = isMobileViewport()

  if (tier === "low") return Math.min(2, Math.max(0, Math.ceil(highCount * 0.3)))
  if (mobile && tier === "mid") return Math.max(1, Math.ceil(highCount * 0.5))
  if (mobile) return Math.max(1, Math.ceil(highCount * 0.7))
  return highCount
}

export function getMarqueeRepeat(defaultRepeat: number): number {
  if (prefersReducedMotion()) return 1
  const tier = detectDeviceTier()
  const mobile = isMobileViewport()

  if (tier === "low") return 1
  if (mobile) return Math.min(2, Math.max(1, defaultRepeat))
  if (tier === "mid") return Math.min(3, Math.max(1, defaultRepeat))
  return Math.max(1, defaultRepeat)
}

export function shouldRunAnimation(): boolean {
  if (typeof window === "undefined") return false
  return !prefersReducedMotion()
}

export function shouldRunRichAnimation(): boolean {
  if (!shouldRunAnimation()) return false

  const tier = detectDeviceTier()
  const mobile = isMobileViewport()
  if (tier === "low") return false
  if (mobile && tier === "mid") return false
  return true
}

export function shouldRunContinuousAnimation(): boolean {
  if (typeof window === "undefined") return false
  if (prefersReducedMotion()) return false
  if (document.hidden) return false
  return true
}
