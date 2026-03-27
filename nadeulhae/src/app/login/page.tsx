"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail, Lock, LogIn } from "lucide-react"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { Particles } from "@/components/magicui/particles"
import { Meteors } from "@/components/magicui/meteors"
import { BorderBeam } from "@/components/magicui/border-beam"
import { useTheme } from "next-themes"
import { useLanguage } from "@/context/LanguageContext"

export default function LoginPage() {
  const { resolvedTheme } = useTheme()
  const { t } = useLanguage()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      <Particles
        className="absolute inset-0 z-0"
        quantity={50}
        color={resolvedTheme === "dark" ? "#ffffff" : "#87CEEB"}
      />
      <Meteors number={20} />
      
      <div className="w-full max-w-md z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 dark:text-neutral-400 hover:text-sky-blue dark:hover:text-sky-blue mb-8 transition-colors font-bold group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          홈으로 돌아가기
        </Link>
        
        <div className="bg-[var(--card)] backdrop-blur-2xl border border-[var(--card-border)] p-8 sm:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
          <BorderBeam size={200} duration={12} delay={9} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
          
          <div className="absolute top-4 right-4 z-20">
            <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[10px] sm:text-[11px] font-black uppercase tracking-widest backdrop-blur-md animate-pulse">
               COMING SOON
            </span>
          </div>

          <div className="text-center mb-10 relative z-10">
            <h1 className="text-3xl font-black mb-2 tracking-tight">{t("nav_login")}</h1>
            <p className="text-neutral-500 dark:text-neutral-400 font-medium">{t("nav_login_unsupported")}</p>
          </div>
          
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-sky-blue uppercase tracking-widest ml-2">이메일</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                <input 
                  type="email" 
                  placeholder="name@example.com"
                  className="w-full bg-[var(--interactive)] border border-[var(--interactive-border)] rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-sky-blue/50 transition-all font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[11px] font-black text-sky-blue uppercase tracking-widest ml-2">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                <input 
                  type="password" 
                  placeholder="••••••••"
                  className="w-full bg-[var(--interactive)] border border-[var(--interactive-border)] rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-sky-blue/50 transition-all font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button className="text-xs font-bold text-neutral-400 dark:text-neutral-500 hover:text-sky-blue transition-colors">비밀번호를 잊으셨나요?</button>
            </div>
            
            <ShimmerButton className="w-full py-4 rounded-2xl font-black text-lg shadow-sky-blue/20 shadow-xl opacity-50 cursor-not-allowed">
              {t("nav_login")} (준비 중)
            </ShimmerButton>
          </form>
          
          <div className="mt-8 pt-8 border-t border-neutral-100 dark:border-neutral-800 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
              계정이 없으신가요?{" "}
              <Link href="/signup" className="text-sky-blue font-black hover:underline underline-offset-4">회원가입</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
