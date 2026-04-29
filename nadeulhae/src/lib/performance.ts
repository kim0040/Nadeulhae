/**
 * Device capability detection and animation optimization helpers.
 *
 * Detects hardware tier (low / mid / high), reduced-motion preference, and
 * mobile viewport so that expensive visual effects can be scaled or disabled
 * per device. Every animation helper respects `prefers-reduced-motion` and
 * returns a minimum-viable output (often `0` or `1`) when the user has opted
 * into reduced motion.
 *
 * The tier-based scaling strategy uses progressively smaller multipliers for
 * lower tiers so that animations remain visually coherent rather than being
 * disabled outright — the site still "feels" animated, but the GPU / CPU
 * cost stays within a safe budget for the device.
 *
 * | Tier | CPU cores | Memory    | Strategy                            |
 * |------|-----------|-----------|-------------------------------------|
 * | low  | ≤2        | ≤2 GiB    | Heavily reduce or disable effects   |
 * | mid  | ≤4        | ≤4 GiB    | Moderate reduction; 50-70 % of high |
 * | high | >4        | >4 GiB    | Full effects at the given count     |
 */
export type DeviceTier = "low" | "mid" | "high"

/**
 * Detects the user's device hardware tier from `navigator.hardwareConcurrency`
 * and `navigator.deviceMemory`.
 *
 * The returned tier drives the scaling multipliers used by every animation
 * helper in this module. On the server (no `window`) it defaults to `"mid"`
 * so SSR output is a reasonable middle-ground.
 *
 * @returns `"low"` when ≤2 cores or ≤2 GiB memory; `"mid"` when ≤4 cores or ≤4 GiB memory; `"high"` otherwise.
 */
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

/**
 * Returns a scaled particle count for canvas / DOM particle effects.
 *
 * Scaling strategy by tier and viewport:
 * - Low device: capped at 8, 15 % of `highCount` (bare minimum)
 * - Mobile + mid: capped at 16, 30 % (lightweight mobile)
 * - Mobile (high): 50 % (fast phone, still smaller screen)
 * - Desktop mid: 70 % (sufficient CPU but not top-tier)
 * - Desktop high: 100 % of `highCount`
 *
 * @param highCount - The particle count intended for a high-tier desktop device.
 * @returns `0` when the user prefers reduced motion; otherwise a scaled count.
 */
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

/**
 * Returns a scaled meteor count for meteor / shooting-star effects.
 *
 * Scaling strategy by tier and viewport:
 * - Low device: capped at 2, 30 % of `highCount` (almost off)
 * - Mobile + mid: at least 1, 50 % (lightweight mobile)
 * - Mobile (high): at least 1, 70 % (fast phone)
 * - All other tiers: 100 % of `highCount`
 *
 * @param highCount - The meteor count intended for a high-tier desktop device.
 * @returns `0` when the user prefers reduced motion; otherwise a scaled count.
 */
export function getMeteorCount(highCount: number): number {
  if (prefersReducedMotion()) return 0
  const tier = detectDeviceTier()
  const mobile = isMobileViewport()

  if (tier === "low") return Math.min(2, Math.max(0, Math.ceil(highCount * 0.3)))
  if (mobile && tier === "mid") return Math.max(1, Math.ceil(highCount * 0.5))
  if (mobile) return Math.max(1, Math.ceil(highCount * 0.7))
  return highCount
}

/**
 * Returns the number of times a marquee element should be repeated to fill the
 * viewport without creating unnecessarily long DOM strings on low-end devices.
 *
 * Scaling strategy by tier and viewport:
 * - Low device or reduced motion: 1 (no repetition)
 * - Mobile: clamped to [1, 2] including `defaultRepeat`
 * - Mid: clamped to [1, 3] including `defaultRepeat`
 * - High: at least 1, using `defaultRepeat` as-is
 *
 * @param defaultRepeat - The repeat count intended for a high-tier desktop.
 * @returns `1` when the user prefers reduced motion; otherwise a scaled repeat count.
 */
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

/**
 * Returns whether expensive ("rich") animations should be allowed to run.
 *
 * Rich animations include effects like shaders, heavy CSS transforms, or
 * large canvas compositions. The tier-based logic prevents them on:
 * - Low-tier devices (regardless of viewport)
 * - Mid-tier devices on mobile viewports
 *
 * Also returns `false` when the user prefers reduced motion.
 *
 * @returns `true` only on high-tier devices and desktop mid-tier devices
 *          where the user has not opted into reduced motion.
 */
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
