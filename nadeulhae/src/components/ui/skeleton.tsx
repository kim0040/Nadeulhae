import { cn } from "@/lib/utils"

/**
 * Skeleton — reusable Shimmer loading skeleton component.
 * Uses Tailwind v4 keyframe-based transition class to show a smooth,
 * premium glowing gradient wave moving from left to right.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1rem] bg-neutral-200/50 dark:bg-neutral-800/40",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/[0.04] dark:before:via-white/[0.04] before:to-transparent",
        className
      )}
      {...props}
    />
  )
}
