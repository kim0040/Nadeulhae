import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { Geist, Geist_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/AuthContext";
import { AnalyticsConsentBanner } from "@/components/analytics/analytics-consent-banner";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { PageTransition } from "@/components/page-transition";
import { Navbar } from "@/components/navbar";
import { LanguageProvider } from "@/context/LanguageContext";
import {
  LANGUAGE_COOKIE_NAME,
  SKIP_TO_CONTENT_COPY,
  resolvePreferredLanguage,
  type AppLanguage,
} from "@/lib/language";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

const siteUrl = process.env.APP_BASE_URL ?? "https://nadeulhae.space";
const siteName = "나들해 | Nadeulhae";
const siteDescription = "날씨 기반 피크닉 지수와 지역별 나들이 브리핑 서비스";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: "%s | 나들해",
  },
  description: siteDescription,
  applicationName: "Nadeulhae",
  keywords: ["나들해", "전주 날씨", "피크닉 지수", "나들이", "날씨 브리핑", "Jeonju weather"],
  icons: { icon: "/icon.png", apple: "/icon.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "나들해" },
  openGraph: {
    type: "website",
    siteName: "Nadeulhae",
    title: siteName,
    description: siteDescription,
    url: siteUrl,
    locale: "ko_KR",
    alternateLocale: ["en_US", "zh_CN", "ja_JP"],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
  },
};

// Prevent iOS Safari auto-zoom on input focus while keeping pinch-zoom accessible.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fffd" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f0e" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const initialLanguage = resolvePreferredLanguage({
    stored: cookieStore.get(LANGUAGE_COOKIE_NAME)?.value,
    acceptLanguage: headerStore.get("accept-language"),
    fallback: "ko",
  }) as AppLanguage;

  return (
    <html
      lang={initialLanguage}
      suppressHydrationWarning
      className="h-full antialiased bg-background text-foreground"
    >
      <body className={`${geistSans.variable} ${geistMono.variable} ${notoSansKr.variable} min-h-full flex flex-col bg-background text-foreground transition-colors duration-300`}>
        <LanguageProvider initialLanguage={initialLanguage}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthProvider>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-card focus:px-5 focus:py-2.5 focus:text-sm focus:font-bold focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-sky-blue/50"
              >
                {SKIP_TO_CONTENT_COPY[initialLanguage]}
              </a>
              <Suspense fallback={null}>
                <PageViewTracker />
              </Suspense>
              <AnalyticsConsentBanner />
              <Navbar />
              {/* Skip-link target. A <div> (not <main>) because each page renders
                  its own <main> landmark — nesting <main> would be invalid HTML. */}
              <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
                <PageTransition>
                  {children}
                </PageTransition>
              </div>
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>

      </body>
    </html>
  );
}
