import * as React from "react"
import { MagicCard } from "@/components/magicui/magic-card"
import { BorderBeam } from "@/components/magicui/border-beam"
import { shouldRunRichAnimation } from "@/lib/performance"
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
  const [enableSectionAnimations, setEnableSectionAnimations] = React.useState(false)

  React.useEffect(() => {
    const update = () => setEnableSectionAnimations(shouldRunRichAnimation())
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    update()

    const onVisibility = () => update()
    const onResize = () => update()
    const onFocus = () => update()
    const onBlur = () => update()
    const onMediaChange = () => update()

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("resize", onResize)
    window.addEventListener("focus", onFocus)
    window.addEventListener("blur", onBlur)
    media.addEventListener("change", onMediaChange)

    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("blur", onBlur)
      media.removeEventListener("change", onMediaChange)
    }
  }, [])

  return enableSectionAnimations ? (
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
  ) : (
    <div className={cn("overflow-hidden rounded-[2rem]", className)}>
      <div
        className={cn(
          "relative rounded-[2rem] border border-card-border/70 bg-card/90 p-5 backdrop-blur-2xl sm:p-6",
          panelClassName
        )}
      >
      <div className={cn("relative z-10", contentClassName)}>{children}</div>
      </div>
    </div>
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
  if (compact) {
    return (
      <div className="min-w-0 rounded-[1.2rem] border border-card-border/70 bg-background/75 px-3 py-2.5 sm:rounded-[1.3rem] sm:px-3.5 sm:py-3">
        <div className="flex h-full min-h-[94px] flex-col justify-between gap-2 sm:min-h-[108px] sm:gap-2.5">
          <p className="line-clamp-2 break-words text-xs font-black uppercase tracking-[0.16em] leading-5 text-muted-foreground sm:text-sm sm:tracking-[0.2em] sm:leading-6">
            {label}
          </p>
          <p className="break-words text-base font-black leading-tight tracking-tight text-foreground sm:text-xl">
            {value}
          </p>
          {meta ? (
            <p className="line-clamp-2 break-words text-[11px] leading-5 text-muted-foreground sm:text-xs sm:leading-5">
              {meta}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-0 rounded-[1.3rem] border border-card-border/70 bg-background/75 p-4">
      <p
        className="break-words text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground"
      >
        {label}
      </p>
      <p className="mt-3 break-words text-xl font-black tracking-tight text-foreground sm:text-2xl">
        {value}
      </p>
      {meta ? (
        <p className="mt-2 break-words text-xs leading-5 text-muted-foreground sm:text-sm">
          {meta}
        </p>
      ) : null}
    </div>
  )
}
