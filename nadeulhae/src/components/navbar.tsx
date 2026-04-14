"use client"

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Calendar as CalendarIcon,
  FlaskConical,
  InfoIcon,
  LayoutDashboard,
  Languages,
  LogInIcon,
  LogOutIcon,
  Monitor,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react"
import { useTheme } from "next-themes"

import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

const NAVBAR_COPY = {
  ko: {
    logout: "로그아웃",
    logoutError: "로그아웃에 실패했어요. 다시 시도해 주세요.",
    themeToggle: "테마 변경",
  },
  en: {
    logout: "Log out",
    logoutError: "Failed to log out. Please try again.",
    themeToggle: "Toggle theme",
  },
} as const

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: unknown }
    if (typeof payload?.error === "string" && payload.error.trim().length > 0) {
      return payload.error
    }
  } catch {
    // no-op
  }

  return fallback
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { language, setLanguage, t } = useLanguage()
  const { theme, setTheme } = useTheme()
  const { user, setAuthenticatedUser } = useAuth()
  const copy = NAVBAR_COPY[language]
  const mounted = useIsClient()
  const [isVisible, setIsVisible] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const lastScrollYRef = useRef(0)

  useEffect(() => {
    const controlNavbar = () => {
      if (window.scrollY > lastScrollYRef.current && window.scrollY > 100) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }

      lastScrollYRef.current = window.scrollY
    }

    window.addEventListener("scroll", controlNavbar, { passive: true })
    return () => window.removeEventListener("scroll", controlNavbar)
  }, [])

  const authItem = user
    ? {
        name: language === "ko" ? "대시보드" : "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      }
    : {
        name: t("nav_login"),
        href: "/login",
        icon: LogInIcon,
      }

  const labItem = user?.labEnabled
    ? {
        name: t("nav_lab"),
        href: "/lab",
        icon: FlaskConical,
      }
    : null

  const navItems = [
    { name: t("nav_about"), href: "/about", icon: InfoIcon },
    { name: t("nav_calendar"), href: "/statistics/calendar", icon: CalendarIcon },
    { name: t("nav_jeonju"), href: "/jeonju", icon: Sparkles },
    ...(labItem ? [labItem] : []),
    authItem,
  ]

  const handleLogout = () => {
    setFeedbackMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Accept-Language": language,
          },
          credentials: "include",
        })

        if (!response.ok) {
          setFeedbackMessage(await readErrorMessage(response, copy.logoutError))
          return
        }

        setAuthenticatedUser(null)
        router.push("/login")
        router.refresh()
      } catch (error) {
        console.error("Failed to log out:", error)
        setFeedbackMessage(copy.logoutError)
      }
    })
  }

  return (
    <header
      className={cn(
        "pointer-events-none fixed left-0 right-0 top-0 z-50 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center px-3 py-3.5 transition-all duration-500 sm:px-5 sm:py-4 lg:px-7 xl:px-8",
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      )}
    >
      <Link href="/" className="pointer-events-auto flex shrink-0 items-center gap-2 group">
        <div className="flex size-9 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-1.5 shadow-xl backdrop-blur-xl transition-transform group-hover:scale-105 sm:size-11 sm:p-2 lg:size-12">
          <Image
            src="/logo.png"
            alt="Nadeulhae Logo"
            width={32}
            height={32}
            className="h-full w-full object-contain"
            priority
          />
        </div>
        <div className="hidden lg:block">
          <span
            className={cn(
              "text-base font-black tracking-tighter text-foreground transition-colors group-hover:text-sky-blue xl:text-[1.6rem]",
              mounted && language === "en" && "xl:block"
            )}
          >
            {t("logo_text")}
          </span>
        </div>
      </Link>

      <nav className="pointer-events-auto relative z-50 mx-auto flex max-w-full justify-center transition-all">
        <div
          className={cn(
            "flex max-w-full shrink items-center rounded-full border border-[var(--card-border)] bg-[var(--card)] shadow-xl shadow-active-blue/10 backdrop-blur-2xl transition-all",
            mounted
              ? language === "en"
                ? "gap-0.5 px-1.5 py-1.5 sm:gap-3 sm:px-3 sm:py-2 lg:gap-3 lg:px-4 xl:gap-4 xl:px-5 xl:py-2.5"
                : "gap-1 px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2 lg:gap-3 lg:px-4 xl:gap-4 xl:px-5 xl:py-2.5"
              : "gap-1 px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2 lg:gap-3 lg:px-4 xl:gap-4 xl:px-5 xl:py-2.5"
          )}
        >
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto no-scrollbar sm:gap-4 lg:gap-5 xl:gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap py-1 text-[11px] font-black transition-all hover:text-sky-blue sm:gap-2 sm:text-xs lg:text-sm xl:text-[15px]",
                  pathname === item.href
                    ? "scale-105 text-sky-blue"
                    : "text-neutral-500 hover:scale-105 dark:text-neutral-400"
                )}
                >
                  <item.icon size={16} className="shrink-0 sm:size-[18px]" />
                  <span className="hidden max-w-[5.5rem] truncate sm:inline lg:max-w-none">
                    {item.name}
                  </span>
                </Link>
              ))}
            </div>

          <div className="ml-1 flex shrink-0 items-center gap-1 border-l border-neutral-200 pl-1.5 dark:border-neutral-800 sm:ml-2.5 sm:gap-1.5 sm:pl-2.5 lg:ml-3 lg:gap-2 lg:pl-3 xl:ml-3 xl:gap-2 xl:pl-3">
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isPending}
                className="flex items-center gap-1.5 p-1.5 text-[10px] font-black text-neutral-500 transition-all hover:text-sky-blue disabled:opacity-50 sm:p-2 sm:text-[11px] xl:text-[13px]"
                title={copy.logout}
              >
                <LogOutIcon size={17} />
                <span className="hidden xl:inline">
                  {copy.logout}
                </span>
              </button>
            ) : null}

            {mounted && (
              <button
                type="button"
                onClick={() => {
                  const modes: Array<"light" | "dark" | "system"> = ["light", "dark", "system"]
                  const currentIndex = modes.indexOf(theme as "light" | "dark" | "system")
                  const nextIndex = (currentIndex + 1) % modes.length
                  setTheme(modes[nextIndex])
                }}
                className="flex items-center gap-1.5 p-1.5 text-neutral-500 transition-all hover:text-sky-blue sm:p-2"
                title={copy.themeToggle}
              >
                {theme === "light" && <Sun size={17} />}
                {theme === "dark" && <Moon size={17} />}
                {theme === "system" && <Monitor size={17} />}
                <span className="hidden text-[10px] font-black uppercase xl:inline">
                  {theme}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setLanguage(language === "ko" ? "en" : "ko")}
              className="flex items-center gap-1.5 p-1.5 text-[10px] font-black text-neutral-500 transition-all hover:text-sky-blue sm:p-2 sm:text-[11px] xl:text-[13px]"
            >
              <Languages size={17} />
              <span className="hidden lg:inline">{language.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </nav>

      {feedbackMessage ? (
        <div className="pointer-events-none absolute inset-x-0 top-full mt-2 flex justify-center px-3">
          <div
            role="alert"
            aria-live="assertive"
            className="pointer-events-auto rounded-full border border-danger/25 bg-danger/10 px-4 py-2 text-xs font-bold text-danger shadow-lg backdrop-blur"
          >
            {feedbackMessage}
          </div>
        </div>
      ) : null}

      <div aria-hidden="true" className="invisible flex shrink-0 items-center gap-2">
        <div className="size-9 sm:size-11 lg:size-12" />
        <div className="hidden lg:block">
          <span
            className={cn(
              "text-base font-black tracking-tighter text-foreground xl:text-[1.6rem]",
              mounted && language === "en" && "xl:block"
            )}
          >
            {t("logo_text")}
          </span>
        </div>
      </div>
    </header>
  )
}
