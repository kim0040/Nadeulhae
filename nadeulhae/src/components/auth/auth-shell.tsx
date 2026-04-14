"use client"

import { useMemo } from "react"
import { Sparkles } from "lucide-react"
import { useTheme } from "next-themes"

import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text"
import { BlurFade } from "@/components/magicui/blur-fade"
import { BorderBeam } from "@/components/magicui/border-beam"
import { MagicCard } from "@/components/magicui/magic-card"
import { Marquee } from "@/components/magicui/marquee"
import { Meteors } from "@/components/magicui/meteors"
import { Particles } from "@/components/magicui/particles"
import { getMeteorCount, getParticleCount, shouldRunRichAnimation } from "@/lib/performance"
import { cn } from "@/lib/utils"

interface AuthShellProps {
  badge?: string
  title: string
  sideEyebrow?: string
  sideTitle?: string
  sideDescription?: string
  marqueeItems?: readonly string[]
  statItems?: ReadonlyArray<{
    label: string
    value: string
    meta?: string
  }>
  children: React.ReactNode
  footer?: React.ReactNode
  panelClassName?: string
  showSidePanel?: boolean
  performanceMode?: "default" | "fast"
}

function chunkItems(items: readonly string[]) {
  const middle = Math.ceil(items.length / 2)
  return [items.slice(0, middle), items.slice(middle)]
}

export function AuthShell({
  badge,
  title,
  sideEyebrow,
  sideTitle,
  sideDescription,
  marqueeItems = [],
  statItems = [],
  children,
  footer,
  panelClassName,
  showSidePanel = true,
  performanceMode = "default",
}: AuthShellProps) {
  const { resolvedTheme } = useTheme()
  const particleColor = resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"
  const isFastMode = performanceMode === "fast"
  const richAnimations = useMemo(() => shouldRunRichAnimation(), [])
  const particleQuantity = useMemo(() => getParticleCount(18), [])
  const meteorCount = useMemo(() => getMeteorCount(2), [])
  const useFastLayout = isFastMode || !richAnimations
  const hasBadge = Boolean(badge?.trim())
  const hasSidePanel =
    !useFastLayout &&
    showSidePanel &&
    Boolean(sideEyebrow && sideTitle && sideDescription) &&
    marqueeItems.length > 0 &&
    statItems.length > 0
  const [primaryRow, secondaryRow] = chunkItems(marqueeItems)

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-background px-4 pb-24 pt-20 sm:px-6 sm:pb-16 sm:pt-24 lg:px-8">
      {!useFastLayout ? (
        <>
          <Particles
            className="absolute inset-0 z-0 opacity-70"
            quantity={particleQuantity}
            ease={80}
            color={particleColor}
          />
          {meteorCount > 0 ? <Meteors number={meteorCount} className="z-0" /> : null}
        </>
      ) : null}

      <div
        className={cn(
          "relative z-10 mx-auto grid w-full gap-6",
          hasSidePanel
            ? "max-w-6xl xl:grid-cols-[1.1fr_minmax(0,0.9fr)] xl:items-start"
            : "max-w-2xl"
        )}
      >
        {hasSidePanel ? (
          <section className="hidden xl:flex xl:flex-col xl:justify-center xl:gap-6 xl:sticky xl:top-24 xl:pr-6">
            <BlurFade delay={0.05} inView>
              <div className="space-y-4">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-active-blue/20 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-active-blue">
                  <Sparkles className="size-3.5" />
                  {sideEyebrow}
                </span>
                <div className="max-w-2xl space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                    Nadeulhae Auth Flow
                  </p>
                  <h1 className="text-3xl font-black tracking-tight text-foreground lg:text-5xl">
                    {sideTitle}
                  </h1>
                  <p className="max-w-xl text-sm leading-7 text-muted-foreground lg:text-base">
                    {sideDescription}
                  </p>
                </div>
              </div>
            </BlurFade>

            <BlurFade delay={0.12} inView>
              <div className="grid grid-cols-3 gap-3">
                {statItems.map((item) => (
                  <MagicCard
                    key={item.label}
                    className="rounded-[1.7rem]"
                    gradientSize={220}
                    gradientOpacity={0.65}
                  >
                    <div className="h-full rounded-[inherit] border border-card-border/70 bg-card/90 p-4 backdrop-blur-xl">
                      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="mt-2 text-xl font-black tracking-tight text-foreground">
                        {item.value}
                      </p>
                      {item.meta ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.meta}</p>
                      ) : null}
                    </div>
                  </MagicCard>
                ))}
              </div>
            </BlurFade>

            <div className="overflow-hidden rounded-[2rem] border border-card-border/70 bg-card/70 p-3 backdrop-blur-xl">
              <Marquee pauseOnHover className="[--duration:28s]">
                {primaryRow.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-active-blue/20 bg-background/70 px-4 py-2 text-sm font-semibold text-foreground"
                  >
                    {item}
                  </span>
                ))}
              </Marquee>
              <Marquee pauseOnHover reverse className="[--duration:30s]">
                {secondaryRow.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-accent/20 bg-background/70 px-4 py-2 text-sm font-semibold text-foreground"
                  >
                    {item}
                  </span>
                ))}
              </Marquee>
            </div>
          </section>
        ) : null}

        {/* Form card: always visible, full-width on mobile/tablet */}
        <section className={cn(!hasSidePanel && "mx-auto w-full")}>
          {useFastLayout ? (
            <div className={cn("overflow-hidden rounded-[2rem] sm:rounded-[2.4rem]", panelClassName)}>
              <div className="relative rounded-[2rem] border border-card-border/70 bg-card/95 p-5 shadow-[0_16px_60px_rgba(17,32,39,0.12)] sm:rounded-[2.4rem] sm:p-6 lg:p-8">
                <div className={cn("relative z-10 mb-9 flex flex-col sm:mb-10", hasBadge && "gap-3")}>
                  {hasBadge ? (
                    <span className="inline-flex items-center rounded-full border border-active-blue/20 bg-active-blue/10 px-2.5 py-1 text-[10px] font-black leading-none tracking-[0.06em] text-active-blue">
                      {badge}
                    </span>
                  ) : null}
                  <AnimatedGradientText className="!block text-2xl font-black leading-[1.08] tracking-tight sm:text-3xl lg:text-4xl">
                    {title}
                  </AnimatedGradientText>
                </div>

                <div className="relative z-10">{children}</div>
                {footer ? <div className="relative z-10 mt-7">{footer}</div> : null}
              </div>
            </div>
          ) : (
            <MagicCard
              mode="orb"
              className={cn("overflow-hidden rounded-[2rem] sm:rounded-[2.4rem]", panelClassName)}
              glowSize={360}
              glowBlur={70}
              glowOpacity={0.48}
              glowFrom="#0b7d71"
              glowTo="#2f6fe4"
            >
              <div className="relative rounded-[2rem] border border-card-border/70 bg-card/90 p-5 shadow-[0_24px_120px_rgba(17,32,39,0.16)] backdrop-blur-2xl sm:rounded-[2.4rem] sm:p-6 lg:p-8">
                <BorderBeam
                  size={200}
                  duration={10}
                  delay={4}
                  colorFrom="var(--beam-from)"
                  colorTo="var(--beam-to)"
                />

                <BlurFade delay={0.05} inView className={cn("relative z-10 mb-8 sm:mb-9", hasBadge && "space-y-3")}>
                  {hasBadge ? (
                    <span className="inline-flex items-center rounded-full border border-active-blue/20 bg-active-blue/10 px-2.5 py-1 text-[10px] font-black leading-none tracking-[0.06em] text-active-blue">
                      {badge}
                    </span>
                  ) : null}
                  <AnimatedGradientText className="!block text-2xl font-black leading-[1.08] tracking-tight sm:text-3xl lg:text-4xl">
                    {title}
                  </AnimatedGradientText>
                </BlurFade>

                <BlurFade delay={0.15} inView className="relative z-10">
                  {children}
                </BlurFade>
                {footer ? <BlurFade delay={0.25} inView className="relative z-10 mt-7">{footer}</BlurFade> : null}
              </div>
            </MagicCard>
          )}
        </section>
      </div>
    </main>
  )
}
