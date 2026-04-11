import * as React from "react"
import { MagicCard } from "@/components/magicui/magic-card"
import { BorderBeam } from "@/components/magicui/border-beam"
import { cn } from "@/lib/utils"

export function SelectOptionTile({
  selected,
  label,
  description,
  onClick,
}: {
  selected: boolean
  label: string
  description?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full min-w-0 rounded-[1.2rem] border px-4 py-3 text-left transition",
        selected
          ? "border-sky-blue/40 bg-sky-blue/10 text-sky-blue"
          : "border-card-border/70 bg-background/70 text-foreground hover:border-sky-blue/25"
      )}
    >
      <p className="break-words text-sm font-black">{label}</p>
      {description ? (
        <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
    </button>
  )
}

export function ToggleChip({
  selected,
  label,
  onClick,
}: {
  selected: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "max-w-full min-w-0 rounded-full border px-4 py-2 text-left text-sm font-semibold leading-5 whitespace-normal break-words transition",
        selected
          ? "border-sky-blue/40 bg-sky-blue/10 text-sky-blue"
          : "border-card-border/70 bg-background/70 text-foreground hover:border-sky-blue/25"
      )}
    >
      {label}
    </button>
  )
}

export function SectionCard({
  children,
  className,
  panelClassName,
  contentClassName,
}: {
  children: React.ReactNode
  className?: string
  panelClassName?: string
  contentClassName?: string
}) {
  return (
    <MagicCard className={cn("overflow-hidden rounded-[2rem]", className)} gradientSize={220} gradientOpacity={0.7}>
      <div
        className={cn(
          "relative rounded-[2rem] border border-card-border/70 bg-card/90 p-5 backdrop-blur-2xl sm:p-6",
          panelClassName
        )}
      >
        <BorderBeam size={180} duration={10} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
        <div className={cn("relative z-10", contentClassName)}>{children}</div>
      </div>
    </MagicCard>
  )
}

export function StatusMetric({
  label,
  value,
  meta,
  compact = false,
}: {
  label: string
  value: string
  meta?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-[1.3rem] border border-card-border/70 bg-background/75",
        compact ? "p-3 sm:p-3.5" : "p-4"
      )}
    >
      <p className="break-words text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "break-words font-black tracking-tight text-foreground",
          compact ? "mt-2 text-lg sm:text-xl" : "mt-3 text-xl sm:text-2xl"
        )}
      >
        {value}
      </p>
      {meta ? (
        <p
          className={cn(
            "break-words text-muted-foreground",
            compact ? "mt-1.5 text-[11px] leading-4 sm:text-xs sm:leading-5" : "mt-2 text-xs leading-5 sm:text-sm"
          )}
        >
          {meta}
        </p>
      ) : null}
    </div>
  )
}
