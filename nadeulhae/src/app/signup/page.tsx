"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, User, Mail, Lock, Sparkles } from "lucide-react"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { Particles } from "@/components/magicui/particles"
import { Meteors } from "@/components/magicui/meteors"
import { BorderBeam } from "@/components/magicui/border-beam"
import { useTheme } from "next-themes"
import { useLanguage } from "@/context/LanguageContext"

export default function SignupPage() {
  const { resolvedTheme } = useTheme()
  const { t } = useLanguage()
  const [name, setName] = useState("")
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
        <Link href="/login" className="inline-flex items-center gap-2 text-neutral-500 dark:text-neutral-400 hover:text-sky-blue dark:hover:text-sky-blue mb-8 transition-colors font-bold group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          로그인으로 돌아가기
        </Link>
        
        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl border border-sky-blue/20 dark:border-white/10 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl shadow-sky-blue/5 relative overflow-hidden group">
          <BorderBeam size={200} duration={12} delay={9} colorFrom="#87CEEB" colorTo="#F5F5DC" />
          
          <div className="absolute top-4 right-4 z-20">
            <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[10px] sm:text-[11px] font-black uppercase tracking-widest backdrop-blur-md animate-pulse">
               COMING SOON
            </span>
          </div>

          <div className="text-center mb-10 relative z-10">
            <h1 className="text-3xl font-black mb-2 tracking-tight">시작해볼까요?</h1>
            <p className="text-neutral-500 dark:text-neutral-400 font-medium">{t("nav_login_unsupported")}</p>
          </div>
          
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-sky-blue uppercase tracking-widest ml-2">이름</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                <input 
                  type="text" 
                  placeholder="홍길동"
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-sky-blue/50 transition-all font-medium"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-sky-blue uppercase tracking-widest ml-2">이메일</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                <input 
                  type="email" 
                  placeholder="name@example.com"
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-sky-blue/50 transition-all font-medium"
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
                  placeholder="최소 8자 이상"
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-sky-blue/50 transition-all font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 text-center px-4 font-medium leading-relaxed">
              가입 시 나들해의 <span className="underline cursor-pointer">서비스 이용약관</span> 및 <span className="underline cursor-pointer">개인정보 처리방침</span>에 동의하게 됩니다.
            </p>
            
            <ShimmerButton className="w-full py-4 rounded-2xl font-black text-lg shadow-sky-blue/20 shadow-xl flex items-center justify-center gap-2 opacity-50 cursor-not-allowed">
              회원가입 (준비 중)
              <Sparkles size={18} />
            </ShimmerButton>
          </form>
          
          <div className="mt-8 pt-8 border-t border-neutral-100 dark:border-neutral-800 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="text-sky-blue font-black hover:underline underline-offset-4">로그인</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
