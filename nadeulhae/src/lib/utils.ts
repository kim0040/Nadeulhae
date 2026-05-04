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
