"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Calendar as CalendarIcon,
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

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { language, setLanguage, t } = useLanguage()
  const { theme, setTheme } = useTheme()
  const { user, status, setAuthenticatedUser } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [isPending, startTransition] = useTransition()
  const lastScrollYRef = useRef(0)

  useEffect(() => {
    setMounted(true)

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

  const navItems = [
    { name: t("nav_about"), href: "/about", icon: InfoIcon },
    { name: t("nav_calendar"), href: "/statistics/calendar", icon: CalendarIcon },
    { name: t("nav_jeonju"), href: "/jeonju", icon: Sparkles },
    authItem,
  ]

  const authStateLabel = status === "authenticated"
    ? (language === "ko" ? "연결됨" : "Live")
    : status === "loading"
      ? (language === "ko" ? "확인 중" : "Checking")
      : (language === "ko" ? "게스트" : "Guest")

  const handleLogout = () => {
    startTransition(async () => {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        })
      } catch (error) {
        console.error("Failed to log out:", error)
      } finally {
        setAuthenticatedUser(null)
        router.push("/login")
        router.refresh()
      }
    })
  }

  return (
    <header
      className={cn(
        "pointer-events-none fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-5 transition-all duration-500 sm:px-8 lg:px-10 xl:px-12",
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      )}
    >
      <Link href="/" className="pointer-events-auto flex shrink-0 items-center gap-2 group">
        <div className="flex size-9 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-1.5 shadow-xl backdrop-blur-xl transition-transform group-hover:scale-105 sm:size-12 sm:p-2.5 lg:size-13">
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
              "text-base font-black tracking-tighter text-foreground transition-colors group-hover:text-sky-blue sm:text-2xl lg:text-[1.7rem]",
              mounted && language === "en" && "xl:block"
            )}
          >
            {t("logo_text")}
          </span>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">
            {authStateLabel}
          </p>
        </div>
      </Link>

      <nav className="pointer-events-auto absolute left-1/2 z-50 max-w-[calc(100vw-7.5rem)] -translate-x-1/2 transition-all sm:max-w-[calc(100vw-10rem)] lg:max-w-[95vw]">
        <div
          className={cn(
            "flex items-center rounded-full border border-[var(--card-border)] bg-[var(--card)] shadow-xl shadow-active-blue/10 backdrop-blur-2xl transition-all",
            mounted
              ? language === "en"
                ? "gap-0.5 px-1.5 py-1.5 sm:gap-7 sm:px-7 sm:py-3 lg:px-8"
                : "gap-1 px-2 py-1.5 sm:gap-7 sm:px-7 sm:py-3 lg:px-8"
              : "gap-1 px-2 py-1.5 sm:gap-7 sm:px-7 sm:py-3 lg:px-8"
          )}
        >
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:gap-6 lg:gap-7">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-1.5 whitespace-nowrap py-1 text-xs font-black transition-all hover:text-sky-blue sm:gap-2 sm:text-sm lg:text-[15px]",
                  pathname === item.href
                    ? "scale-105 text-sky-blue"
                    : "text-neutral-500 hover:scale-105 dark:text-neutral-400"
                )}
              >
                <item.icon size={16} className="shrink-0 sm:size-[18px]" />
                <span className={cn(item.href === "/about" && "hidden sm:inline")}>
                  {item.name}
                </span>
                {item.href === authItem.href && user ? (
                  <span className="absolute -top-4 left-1/2 hidden -translate-x-1/2 rounded-full bg-active-blue px-1.5 py-0.5 text-[8px] font-black text-white sm:inline-block">
                    {user.displayName}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>

          <div className="ml-1.5 flex items-center gap-1 border-l border-neutral-200 pl-2 dark:border-neutral-800 sm:ml-5 sm:gap-4 sm:pl-5 lg:ml-6 lg:gap-5 lg:pl-6">
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isPending}
                className="flex items-center gap-1.5 p-1.5 text-[10px] font-black text-neutral-500 transition-all hover:text-sky-blue disabled:opacity-50 sm:p-2 sm:text-xs lg:text-[13px]"
                title={language === "ko" ? "로그아웃" : "Log out"}
              >
                <LogOutIcon size={18} />
                <span className="hidden sm:inline">
                  {language === "ko" ? "로그아웃" : "Log out"}
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
                title="Theme Toggle"
              >
                {theme === "light" && <Sun size={18} />}
                {theme === "dark" && <Moon size={18} />}
                {theme === "system" && <Monitor size={18} />}
                <span className="hidden text-[10px] font-black uppercase sm:inline">
                  {theme}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setLanguage(language === "ko" ? "en" : "ko")}
              className="flex items-center gap-1.5 p-1.5 text-[10px] font-black text-neutral-500 transition-all hover:text-sky-blue sm:p-2 sm:text-xs lg:text-[13px]"
            >
              <Languages size={18} />
              <span className="hidden sm:inline">{language.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="hidden h-1 w-12 sm:block" />
    </header>
  )
}
