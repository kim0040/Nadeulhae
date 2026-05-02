"use client"

import { ReactNode } from "react"
import { ArrowRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

export const BentoGrid = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-min lg:auto-rows-[22rem] grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4",
        className
      )}
    >
      {children}
    </div>
  )
}

export const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
  bgText,
  bgEffect,
}: {
  name: string
  className?: string
  background?: ReactNode;
  bgText?: string;
  bgEffect?: string;
  Icon: any;
  description: string;
  href: string;
  cta: string;
}) => (
  <div
    key={name}
    className={cn(
      "group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-xl transition-all duration-300",
      "bg-[var(--card)]",
      "shadow-[0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
      "dark:shadow-[0_0_0_1px_rgba(255,255,255,.05),0_-20px_80px_-20px_rgba(255,255,255,.1)_inset]",
      "hover:scale-[1.02] transform-gpu",
      className
    )}
  >
    {background}
    {bgText && (
      <div className="absolute right-0 -top-4 opacity-[0.03] dark:opacity-[0.05] pointer-events-none select-none group-hover:scale-110 transition-transform duration-500">
        <span className="text-[12rem] font-black tracking-tighter leading-none">{bgText}</span>
      </div>
    )}
    {bgEffect === "bloom-orange" && (
      <div className="absolute -right-16 -bottom-16 opacity-[0.1] dark:opacity-[0.2] pointer-events-none select-none group-hover:scale-125 transition-transform duration-700">
        <div className="size-80 rounded-full bg-nature-green blur-[80px]" />
      </div>
    )}
    {bgEffect === "circle-blue" && (
      <div className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-[0.05] dark:opacity-[0.1] pointer-events-none select-none translate-x-1/2 group-hover:rotate-45 transition-transform duration-1000">
        <div className="size-64 rounded-full border-[32px] border-sky-blue" />
      </div>
    )}
    <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-2 p-6 sm:p-8 transition-all duration-300 group-hover:-translate-y-10">
      <Icon className="h-10 w-10 sm:h-14 sm:w-14 origin-left transform-gpu text-sky-blue transition-all duration-300 ease-in-out group-hover:scale-75 opacity-80" />
      <h3 className="text-2xl sm:text-3xl font-black text-foreground tracking-tighter mt-2 break-words">
        {name}
      </h3>
      <p className="max-w-sm text-foreground/60 text-base sm:text-lg font-medium leading-relaxed break-words">{description}</p>
    </div>

    <div
      className={cn(
        "pointer-events-none absolute bottom-0 flex w-full translate-y-10 transform-gpu flex-row items-center p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
      )}
    >
      <Link
        href={href}
        className="pointer-events-auto flex items-center font-black text-xs sm:text-sm text-sky-blue hover:underline bg-sky-blue/10 px-4 py-2 rounded-full border border-sky-blue/20"
      >
        {cta}
        <ArrowRightIcon className="ml-2 h-4 w-4" />
      </Link>
    </div>
    <Link href={href} className="absolute inset-0 z-0 pointer-events-auto" aria-label={name} />
    <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-black/[.03] dark:group-hover:bg-white/[.03]" />
  </div>
)
