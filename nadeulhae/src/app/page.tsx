"use client"

import { useState, useEffect } from "react"
import { 
  CalendarIcon, 
  ThermometerIcon, 
  MapPinIcon, 
  ClockIcon,
  SunIcon,
  CloudIcon,
  WindIcon,
  DropletsIcon,
  ArrowRight,
  Sparkles
} from "lucide-react"

import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { Particles } from "@/components/magicui/particles"
import { Meteors } from "@/components/magicui/meteors"
import { WordPullUp } from "@/components/magicui/word-pull-up"
import { NumberTicker } from "@/components/magicui/number-ticker"
import { BentoGrid, BentoCard } from "@/components/magicui/bento-grid"
import { Marquee } from "@/components/magicui/marquee"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import AnimatedCircularProgressBar from "@/components/magicui/animated-circular-progress-bar"
import { ShineBorder } from "@/components/magicui/shine-border"
import { BorderBeam } from "@/components/magicui/border-beam"
import { AnimatedList } from "@/components/magicui/animated-list"
import { PicnicBriefing } from "@/components/picnic-briefing"

// [BACKEND_LINK]: 아래 모든 가짜 데이터(mockData)는 백엔드 API 연결 시 실제 DB 데이터로 대체됩니다.
import { mockWeatherData, mockInsights, mockTrends, mockCourse } from "@/data/mockData"
import { dataService } from "@/services/dataService"
import { useLanguage } from "@/context/LanguageContext"

const icons = {
  CalendarIcon,
  ThermometerIcon,
  MapPinIcon,
}

export default function Home() {
  const { resolvedTheme } = useTheme()
  const { language, t } = useLanguage()
  const [particleColor, setParticleColor] = useState("#87CEEB")
  const [isLoading, setIsLoading] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  const [weatherData, setWeatherData] = useState<any>(null)
  const [insights, setInsights] = useState<any[]>([])
  const [trends, setTrends] = useState<string[]>([])
  const [recommendedCourse, setRecommendedCourse] = useState<any[]>([])
  
  const [location, setLocation] = useState(t("ai_loc_val"))
  const [isLocating, setIsLocating] = useState(false)

  useEffect(() => {
    setMounted(true)
    const loadInitialData = async () => {
      try {
        const [w, i, tData] = await Promise.all([
          dataService.getWeatherData(),
          dataService.getInsights(),
          dataService.getTrends()
        ])
        setWeatherData(w)
        setInsights(i)
        setTrends(tData)
        setLocation(t("ai_loc_val"))
      } catch (error) {
        console.error("Initial data load failed:", error)
        // Fallback to mock data directly to avoid stuck loading
        setWeatherData(mockWeatherData)
        setInsights(mockInsights)
        setTrends(mockTrends)
      }
    }
    loadInitialData()
  }, [])

  useEffect(() => {
    if (mounted) {
      setParticleColor(resolvedTheme === "dark" ? "#ffffff" : "#87CEEB")
    }
  }, [resolvedTheme, mounted])

  const handleUseLocation = () => {
    setIsLocating(true)
    // Mocking browser geolocation delay
    setTimeout(() => {
      setLocation(t("ai_loc_mock"))
      setIsLocating(false)
    }, 1500)
  }

  // [BACKEND_LINK]: 사용자의 입력 데이터와 날씨 정보를 조합해 LLM API를 호출하는 로직이 들어갈 자리입니다.
  const handleCreateCourse = async () => {
    setIsLoading(true)
    try {
      const course = await dataService.generateCourse({ timeRange: "13:00~18:00", location: location })
      setRecommendedCourse(course)
      setShowResult(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (!weatherData) return <div className="h-screen w-full flex items-center justify-center bg-background text-sky-blue animate-pulse font-bold">{t("loading_weather")}</div>


  const getScoreColor = (s: number) => {
    if (s >= 86) return { primary: "#2DD4BF", secondary: "#87CEEB", text: "text-teal-500", bg: "bg-teal-500/10", border: "border-teal-500/20" };
    if (s >= 66) return { primary: "#10B981", secondary: "#34D399", text: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
    if (s >= 36) return { primary: "#F59E0B", secondary: "#FBBF24", text: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" };
    return { primary: "#EF4444", secondary: "#F87171", text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" };
  }

  const scoreColors = getScoreColor(weatherData.score);

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-background">
      {/* Hero Section */}
      <section className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden py-24 sm:py-32">
        {/* ... */}
        <Particles
          className="absolute inset-0 z-0"
          quantity={100}
          ease={80}
          color={particleColor}
          refresh
        />
        <Meteors number={10} className="z-0" />
        
        <div className="z-10 flex flex-col items-center gap-6 p-4 text-center">
          <WordPullUp
            words={t(weatherData.message)}
            className="text-4xl sm:text-5xl md:text-7xl text-sky-blue px-4 font-black tracking-tight"
          />
          
          <div className="relative flex size-64 sm:size-80 items-center justify-center rounded-full bg-white/5 dark:bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl transition-all hover:scale-105 duration-500">
            <ShineBorder shineColor={[scoreColors.primary, scoreColors.secondary, "#ffffff"]} duration={10} borderWidth={2} className="rounded-full" />
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs sm:text-sm font-medium text-foreground/60">{t("hero_score_label")}</span>
              <div className="text-8xl sm:text-9xl font-black flex items-center text-foreground tabular-nums tracking-tighter">
                <NumberTicker value={weatherData.score} />
                <span className="text-3xl sm:text-5xl text-sky-blue ml-2">{t("hero_unit")}</span>
              </div>
              <div className={cn("px-6 py-1.5 rounded-full font-bold animate-pulse text-xs sm:text-sm", scoreColors.bg, scoreColors.text, "border", scoreColors.border)}>
                {t(weatherData.status)}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-5 sm:flex gap-1 sm:gap-12 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 text-foreground overflow-x-auto sm:overflow-visible no-scrollbar pb-4 sm:pb-0 w-full justify-center px-1 sm:px-4">
             <div className="flex flex-col items-center">
               <ThermometerIcon className="text-orange-400 mb-2 size-6 sm:size-8" />
               <span className="text-[10px] sm:text-[12px] text-neutral-400 uppercase tracking-widest font-black">{t("hero_temp")}</span>
               <span className="font-black text-xl sm:text-3xl">{weatherData.details.temp ?? "--"}°C</span>
             </div>
             <div className="flex flex-col items-center">
               <DropletsIcon className="text-blue-400 mb-2 size-6 sm:size-8" />
               <span className="text-[10px] sm:text-[12px] text-neutral-400 uppercase tracking-widest font-black">{t("hero_humidity")}</span>
               <span className="font-black text-xl sm:text-3xl">{weatherData.details.humidity ?? "--"}%</span>
             </div>
             <div className="flex flex-col items-center">
               <WindIcon className="text-teal-400 mb-2 size-6 sm:size-8" />
               <span className="text-[10px] sm:text-[12px] text-neutral-400 uppercase tracking-widest font-black">{t("hero_wind")}</span>
               <span className="font-black text-xl sm:text-3xl">{weatherData.details.wind ?? "--"}m/s</span>
             </div>
             <div className="flex flex-col items-center">
               <CloudIcon className="text-neutral-400 mb-2 size-6" />
               <span className="text-[10px] sm:text-[12px] text-neutral-400 uppercase tracking-widest font-black">{t("hero_dust")}</span>
               <div className="flex flex-col items-center">
                 <span className="font-black text-xl sm:text-2xl whitespace-nowrap">{weatherData.details.dust}</span>
                 <div className="flex gap-1.5 mt-2">
                   {weatherData.details.dust_domestic && (
                     <>
                       <span className="px-2 py-0.5 rounded-md bg-sky-blue/10 text-sky-blue text-[10px] font-black border border-sky-blue/20">
                         {t("label_domestic")}: {t(weatherData.details.dust_domestic)}
                       </span>
                       <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-500 text-[10px] font-black border border-purple-500/20">
                         {t("label_who")}: {t(weatherData.details.dust_who)}
                       </span>
                     </>
                   )}
                 </div>
               </div>
             </div>
             <div className="flex flex-col items-center">
               <SunIcon className="text-yellow-400 mb-2 size-6" />
               <span className="text-[10px] sm:text-[12px] text-neutral-400 uppercase tracking-widest font-black">{t("hero_uv")}</span>
               <span className="font-black text-xl sm:text-3xl">{t(weatherData.details.uv || "uv_mod")}</span>
             </div>
          </div>
        </div>

      </section>

      {/* Briefing Section */}
      <div className="container mx-auto px-4 relative z-20 pb-24 sm:pb-32">
        <PicnicBriefing weatherData={weatherData} />
      </div>

      {/* Statistics Section */}
      <section id="statistics" className="container mx-auto py-24 sm:py-32 px-4 bg-sky-blue/5 dark:bg-white/5 border border-sky-blue/10 dark:border-white/5 rounded-[2.5rem] mt-8 transition-colors">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-2 mb-4">
            <h2 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight">{t("stats_title")}</h2>
            <span className="px-2 py-0.5 rounded-md bg-orange-400/10 text-orange-500 text-[10px] font-black border border-orange-400/20">{t("status_coming_soon")}</span>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 mt-4 text-lg">{t("stats_desc")}</p>
        </div>
        <BentoGrid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-auto lg:auto-rows-[18rem] gap-6">
          {insights.map((insight) => (
            <BentoCard 
              key={insight.name} 
              {...insight} 
              name={t(insight.name)}
              description={t(insight.description)}
              cta={t(insight.cta)}
              Icon={icons[insight.icon as keyof typeof icons]} 
              className={cn(insight.className, "min-h-[14rem] transition-all hover:shadow-2xl")}
            />
          ))}
        </BentoGrid>
      </section>

      {/* Marquee Section */}
      <section className="w-full py-8 sm:py-12 bg-background border-y border-sky-blue/10 transition-colors">
        <Marquee pauseOnHover className="[--duration:25s]">
          {trends.map((trend, i) => (
            <span key={i} className="text-lg sm:text-xl font-medium text-sky-blue mx-6 flex items-center gap-2">
              <span className="size-1 rounded-full bg-sky-blue" />
              {t("trend_title").replace("{spot}", `#${trend}`)}
            </span>
          ))}
        </Marquee>
      </section>

      {/* AI Action Section */}
      <section id="ai-generator" className="container mx-auto py-24 sm:py-32 px-4 flex flex-col items-center max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-4xl sm:text-6xl font-black text-foreground tracking-tight">{t("ai_title")}</h2>
          <span className="px-3 py-1 rounded-full bg-orange-400/10 text-orange-500 text-xs font-black border border-orange-400/20">{t("status_coming_soon")}</span>
        </div>
        <p className="text-neutral-500 dark:text-neutral-400 mb-12 text-center max-w-2xl px-2 leading-relaxed text-xl font-medium">
          {t("ai_desc")}
        </p>
        
        <div className="w-full max-w-xl p-10 sm:12 rounded-[3.5rem] bg-[var(--card)] backdrop-blur-xl shadow-[0_30px_100px_rgba(135,206,235,0.15)] dark:shadow-[0_30px_100px_rgba(0,0,0,0.5)] border border-[var(--card-border)] relative overflow-hidden group transition-all hover:scale-[1.01]">
          <BorderBeam size={400} duration={12} delay={5} colorFrom="#87CEEB" colorTo="#F5F5DC" />
          
          <div className="space-y-10">
            <div className="flex flex-col gap-4">
              <label className="text-[12px] font-black text-sky-blue uppercase tracking-[0.3em] ml-2">{t("ai_time_label")}</label>
              <div className="flex items-center gap-5 bg-[var(--interactive)] p-5 rounded-[2rem] border border-[var(--interactive-border)] hover:border-sky-blue/50 transition-all cursor-pointer group/item">
                <ClockIcon size={28} className="text-sky-blue group-hover/item:scale-110 transition-transform" />
                <span className="font-black text-foreground text-xl">{t("ai_time_val")}</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <label className="text-[12px] font-black text-sky-blue uppercase tracking-[0.3em] ml-2">{t("ai_loc_label")}</label>
              <div 
                className={cn(
                  "flex items-center gap-5 bg-[var(--interactive)] p-5 rounded-[2rem] border border-[var(--interactive-border)] hover:border-sky-blue/50 transition-all cursor-pointer group/item relative overflow-hidden",
                  isLocating && "animate-pulse"
                )}
                onClick={handleUseLocation}
              >
                <MapPinIcon size={28} className={cn("text-sky-blue group-hover/item:scale-110 transition-transform", isLocating && "animate-bounce")} />
                <span className="font-black text-foreground text-xl">{isLocating ? t("loading_locating") : location}</span>
                {isLocating && <BorderBeam size={100} duration={2} />}
              </div>
              <button 
                onClick={handleUseLocation}
                className="text-[10px] font-black text-neutral-400 hover:text-sky-blue dark:text-neutral-500 dark:hover:text-sky-blue text-left ml-4 flex items-center gap-1 transition-colors uppercase tracking-widest"
              >
                <Sparkles size={12} />
                {t("ai_loc_current")}
              </button>
            </div>

            <ShimmerButton 
              className="w-full py-6 text-2xl font-black shadow-sky-blue/40 shadow-2xl hover:brightness-110 transition-all rounded-[1.5rem]" 
              onClick={handleCreateCourse}
              disabled={isLoading}
            >
              {isLoading ? t("ai_loading") : t("ai_button")}
            </ShimmerButton>
          </div>
        </div>
        
        {isLoading && (
          <div className="mt-16 flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-700">
            <AnimatedCircularProgressBar value={85} gaugePrimaryColor="#87CEEB" />
            <div className="flex flex-col items-center bg-sky-blue/10 dark:bg-sky-blue/20 px-10 py-5 rounded-[2.5rem] border border-sky-blue/30 backdrop-blur-xl">
              <p className="text-sky-blue font-black italic text-center text-xl animate-pulse">&quot;{t("ai_loading_detail")}&quot;</p>
              <p className="text-[12px] text-neutral-400 mt-2 font-bold uppercase tracking-[0.2em]">{t("ai_processing_label")}</p>
            </div>
          </div>
        )}
      </section>

      {/* Result Timeline Section */}
      {showResult && (
        <section id="course" className="container mx-auto py-24 sm:py-32 px-4 pb-64 animate-in fade-in slide-in-from-bottom-20 duration-1000">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-6xl font-black text-foreground tracking-tight">{t("result_title")}</h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-4 italic text-xl font-medium">{t("result_desc")}</p>
          </div>
          <div className="max-w-2xl mx-auto">
            <AnimatedList>
              {recommendedCourse.map((item, i) => (
                <div 
                  key={i} 
                  className="relative w-full p-8 rounded-2xl bg-[var(--card)] backdrop-blur-xl border border-[var(--card-border)] shadow-xl flex flex-col gap-4 overflow-hidden transition-all hover:border-sky-blue/30"
                >
                  <BorderBeam size={250} duration={20} colorFrom={item.type === "야외" ? "#87CEEB" : "#F5F5DC"} />
                  <div className="flex justify-between items-center text-foreground">
                    <span className="px-4 py-1.5 rounded-full bg-sky-blue/10 text-sky-blue text-xs font-black uppercase">
                      {item.time}
                    </span>
                    <div className="flex items-center gap-2">
                       {item.type === "야외" ? <SunIcon size={18} className="text-orange-400" /> : <CloudIcon size={18} className="text-sky-blue" />}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-foreground mb-1">{t(item.title)}</h3>
                    <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                      {t(item.description)}
                    </p>
                  </div>
                </div>
              ))}
            </AnimatedList>
          </div>
        </section>
      )}


      {/* Footer */}
      <footer className="py-12 border-t border-neutral-100 dark:border-neutral-800 text-center text-neutral-400 text-sm transition-colors">
        {t("footer_copy")}
      </footer>
    </main>
  )
}
