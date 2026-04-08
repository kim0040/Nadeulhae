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
        "rounded-[1.2rem] border px-4 py-3 text-left transition",
        selected
          ? "border-sky-blue/40 bg-sky-blue/10 text-sky-blue"
          : "border-card-border/70 bg-background/70 text-foreground hover:border-sky-blue/25"
      )}
    >
      <p className="text-sm font-black">{label}</p>
      {description ? (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
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
        "rounded-full border px-4 py-2 text-sm font-semibold transition",
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
}: {
  label: string
  value: string
  meta?: string
}) {
  return (
    <div className="rounded-[1.3rem] border border-card-border/70 bg-background/75 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-3 break-words text-xl font-black tracking-tight text-foreground sm:text-2xl">{value}</p>
      {meta ? <p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm">{meta}</p> : null}
    </div>
  )
}
