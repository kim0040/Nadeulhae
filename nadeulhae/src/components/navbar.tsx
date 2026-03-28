"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { InfoIcon, Calendar as CalendarIcon, Languages, Sun, Moon, Monitor, LogInIcon, Sparkles } from "lucide-react"
import { useLanguage } from "@/context/LanguageContext"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function Navbar() {
  const pathname = usePathname()
  const { language, setLanguage, t } = useLanguage()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    
    const controlNavbar = () => {
      if (typeof window !== 'undefined') {
        if (window.scrollY > lastScrollY && window.scrollY > 100) {
          setIsVisible(false);
        } else {
          setIsVisible(true);
        }
        setLastScrollY(window.scrollY);
      }
    };

    window.addEventListener('scroll', controlNavbar);
    return () => {
      window.removeEventListener('scroll', controlNavbar);
    };
  }, [lastScrollY])

  const navItems = [
    { name: t("nav_about"), href: "/about", icon: InfoIcon },
    { name: t("nav_calendar"), href: "/statistics/calendar", icon: CalendarIcon },
    { name: t("nav_jeonju"), href: "/jeonju", icon: Sparkles },
    { name: t("nav_login"), href: "/login", icon: LogInIcon },
  ]

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 px-4 py-5 sm:px-8 lg:px-10 xl:px-12 flex items-center justify-between transition-all duration-500",
      isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
      "pointer-events-none"
    )}>
      {/* Logo on the far left */}
      <Link href="/" className="pointer-events-auto flex items-center gap-2.5 sm:gap-3 group shrink-0">
        <div className="size-10 sm:size-12 lg:size-13 bg-[var(--card)] backdrop-blur-xl border border-[var(--card-border)] rounded-2xl flex items-center justify-center p-2 sm:p-2.5 shadow-xl group-hover:scale-105 transition-transform">
          <Image src="/logo.png" alt="Nadeulhae Logo" width={36} height={36} className="w-full h-full object-contain" />
        </div>
        <span className={cn(
          "text-base sm:text-2xl lg:text-[1.7rem] font-black tracking-tighter text-foreground group-hover:text-sky-blue transition-colors",
          language === "en" ? "hidden lg:block" : "hidden sm:block"
        )}>{t("logo_text")}</span>
      </Link>

      {/* Navigation Pill (Centered on Large / Compact on Small) */}
      <nav className="absolute left-1/2 -translate-x-1/2 pointer-events-auto z-50 transition-all">
        <div className={cn(
          "bg-[var(--card)] backdrop-blur-2xl border border-[var(--card-border)] rounded-full flex items-center shadow-xl shadow-active-blue/10 max-w-[96vw] sm:max-w-none transition-all",
          language === "en" ? "px-2 sm:px-7 lg:px-8 py-2 sm:py-3 gap-1 sm:gap-7" : "px-2.5 sm:px-7 lg:px-8 py-2 sm:py-3 gap-1.5 sm:gap-7"
        )}>
        <div className="flex items-center gap-3 sm:gap-6 lg:gap-7 overflow-x-auto no-scrollbar">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm lg:text-[15px] font-black transition-all hover:text-sky-blue whitespace-nowrap relative group/nav py-1",
                pathname === item.href ? "text-sky-blue scale-105" : "text-neutral-500 dark:text-neutral-400 hover:scale-105"
              )}
            >
              <item.icon size={18} className="shrink-0" />
              <span className={cn(item.href === "/login" && "hidden sm:inline")}>{item.name}</span>
              {item.href === "/login" && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-active-blue text-[8px] text-white px-1.5 py-0.5 rounded-full opacity-0 group-hover/nav:opacity-100 transition-opacity whitespace-nowrap font-black">
                  {t("nav_login_unsupported")}
                </span>
              )}
            </Link>
          ))}
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 lg:gap-5 border-l border-neutral-200 dark:border-neutral-800 pl-3 sm:pl-5 lg:pl-6 ml-2 sm:ml-5 lg:ml-6">
           {mounted && (
             <button 
               onClick={() => {
                 const modes: ("light" | "dark" | "system")[] = ["light", "dark", "system"]
                 const currentIndex = modes.indexOf(theme as any)
                 const nextIndex = (currentIndex + 1) % modes.length
                 setTheme(modes[nextIndex])
               }}
               className="text-neutral-500 hover:text-sky-blue transition-all p-1.5 sm:p-2 flex items-center gap-1.5"
               title="Theme Toggle"
             >
               {theme === "light" && <Sun size={18} />}
               {theme === "dark" && <Moon size={18} />}
               {theme === "system" && <Monitor size={18} />}
               <span className="text-[10px] font-black hidden sm:inline uppercase">{theme}</span>
             </button>
           )}
           <button 
             onClick={() => setLanguage(language === "ko" ? "en" : "ko")}
             className="text-neutral-500 hover:text-sky-blue transition-all flex items-center gap-1.5 font-black text-[10px] sm:text-xs lg:text-[13px] p-1.5 sm:p-2"
           >
             <Languages size={18} />
             <span className="hidden sm:inline">{language.toUpperCase()}</span>
           </button>
</div>
      </div>
      </nav>

      {/* Right side balance spacer */}
      <div className="w-12 h-1 hidden sm:block" />
    </header>

  )
}
