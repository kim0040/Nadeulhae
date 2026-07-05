"use client"

import { useId } from "react"

import { cn } from "@/lib/utils"

interface AuthFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon: React.ComponentType<{ className?: string }>
  trailing?: React.ReactNode
}

export function AuthField({
  label,
  icon: Icon,
  trailing,
  ...props
}: AuthFieldProps) {
  // Associate the visible label with the input so screen readers announce a
  // name for every auth field. Respect a caller-supplied id if present.
  const generatedId = useId()
  const inputId = props.id ?? generatedId
  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="ml-1 text-[11px] font-black uppercase tracking-[0.28em] text-sky-blue"
      >
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          {...props}
          id={inputId}
          className={cn(
            "w-full rounded-[1.45rem] border border-interactive-border bg-interactive/75 py-4 pl-12 text-base font-medium text-foreground outline-none transition focus:border-sky-blue/50 focus-visible:border-sky-blue/60 focus-visible:ring-2 focus-visible:ring-sky-blue/40",
            trailing ? "pr-12" : "pr-4",
            props.className
          )}
        />
        {trailing ? (
          <div className="absolute right-3 top-1/2 z-10 -translate-y-1/2">{trailing}</div>
        ) : null}
      </div>
    </div>
  )
}
