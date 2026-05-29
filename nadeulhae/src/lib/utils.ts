/**
 * @fileoverview General-purpose utility helpers.
 *
 * @module utils
 */

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges Tailwind class strings, resolving conflicts via `tailwind-merge`
 * after combining inputs with `clsx`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Supported locale codes.
 */
export type Locale = "ko" | "en" | "zh" | "ja"

/**
 * Type-safe i18n copy lookup. Falls back to `ko` when the locale is missing.
 *
 * @example
 * const copy = getCopy(DASHBOARD_COPY, language)
 * // copy.title is typed as string
 */
export function getCopy<T extends Record<string, unknown>>(
  copyMap: T,
  locale: string,
  fallback: Locale = "ko",
): T[keyof T] {
  return (copyMap as Record<string, T[keyof T]>)[locale]
    ?? (copyMap as Record<string, T[keyof T]>)[fallback]
    ?? (copyMap as Record<string, T[keyof T]>).ko
}
