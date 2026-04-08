"use client"

import { Sparkles } from "lucide-react"
import { useTheme } from "next-themes"

import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text"
import { BorderBeam } from "@/components/magicui/border-beam"
import { MagicCard } from "@/components/magicui/magic-card"
import { Marquee } from "@/components/magicui/marquee"
import { Meteors } from "@/components/magicui/meteors"
import { Particles } from "@/components/magicui/particles"
import { cn } from "@/lib/utils"

interface AuthShellProps {
  badge: string
  title: string
  description: string
  sideEyebrow: string
  sideTitle: string
  sideDescription: string
  marqueeItems: readonly string[]
  statItems: ReadonlyArray<{
    label: string
    value: string
  }>
  children: React.ReactNode
  footer?: React.ReactNode
  panelClassName?: string
}

function chunkItems(items: readonly string[]) {
  const middle = Math.ceil(items.length / 2)
  return [items.slice(0, middle), items.slice(middle)]
}

export function AuthShell({
  badge,
  title,
  description,
  sideEyebrow,
  sideTitle,
  sideDescription,
  marqueeItems,
  statItems,
  children,
  footer,
  panelClassName,
}: AuthShellProps) {
  const { resolvedTheme } = useTheme()
  const particleColor = resolvedTheme === "dark" ? "#d8ecff" : "#2f6fe4"
  const [primaryRow, secondaryRow] = chunkItems(marqueeItems)

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 pb-14 pt-24 sm:px-6 sm:pb-16 sm:pt-28 lg:px-8">
      <Particles
        className="absolute inset-0 z-0 opacity-75"
        quantity={84}
        ease={80}
        color={particleColor}
        refresh
      />
      <Meteors number={12} className="z-0" />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-6 xl:grid-cols-[1.02fr_minmax(0,0.98fr)] xl:items-center">
        <section className="order-2 flex flex-col justify-center gap-6 xl:order-1 xl:pr-8">
          <div className="space-y-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-active-blue/20 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-active-blue">
              <Sparkles className="size-3.5" />
              {sideEyebrow}
            </span>
            <div className="max-w-2xl space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                Nadeulhae Auth Flow
              </p>
              <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {sideTitle}
              </h1>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground sm:text-base lg:text-lg">
                {sideDescription}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
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
                  <p className="mt-2 text-xl font-black tracking-tight text-foreground sm:text-2xl">
                    {item.value}
                  </p>
                </div>
              </MagicCard>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-[2rem] border border-card-border/70 bg-card/70 p-3 backdrop-blur-xl sm:block">
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

        <section className="order-1 xl:order-2">
          <MagicCard
            mode="orb"
            className={cn("overflow-hidden rounded-[2.1rem] sm:rounded-[2.5rem]", panelClassName)}
            glowSize={360}
            glowBlur={70}
            glowOpacity={0.48}
            glowFrom="#0b7d71"
            glowTo="#2f6fe4"
          >
            <div className="relative rounded-[2.1rem] border border-card-border/70 bg-card/90 p-5 shadow-[0_24px_120px_rgba(17,32,39,0.16)] backdrop-blur-2xl sm:rounded-[2.5rem] sm:p-8">
              <BorderBeam
                size={220}
                duration={10}
                delay={4}
                colorFrom="var(--beam-from)"
                colorTo="var(--beam-to)"
              />

              <div className="relative z-10 mb-6 space-y-4 sm:mb-8">
                <span className="inline-flex rounded-full border border-active-blue/20 bg-active-blue/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.35em] text-active-blue">
                  {badge}
                </span>
                <div className="space-y-3">
                  <AnimatedGradientText className="text-2xl font-black tracking-tight sm:text-4xl">
                    {title}
                  </AnimatedGradientText>
                  <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                    {description}
                  </p>
                </div>
              </div>

              <div className="relative z-10">{children}</div>
              {footer ? <div className="relative z-10 mt-8">{footer}</div> : null}
            </div>
          </MagicCard>
        </section>
      </div>
    </main>
  )
}
