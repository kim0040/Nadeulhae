import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/AuthContext";
import { AnalyticsConsentBanner } from "@/components/analytics/analytics-consent-banner";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "나들해 | Nadeulhae",
  description: "날씨 기반 피크닉 지수와 지역별 나들이 브리핑 서비스",
};

import type { Viewport } from "next";

// Prevent iOS Safari auto-zoom on input focus (font-size < 16px triggers zoom).
// maximum-scale=1 stops the zoom while user-scalable=yes keeps pinch-zoom accessible.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { Navbar } from "@/components/navbar";

import { LanguageProvider } from "@/context/LanguageContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className="h-full antialiased bg-background text-foreground"
    >
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col bg-background text-foreground transition-colors duration-300`}>
        <LanguageProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthProvider>
              <Suspense fallback={null}>
                <PageViewTracker />
              </Suspense>
              <AnalyticsConsentBanner />
              <Navbar />
              <div className="relative">
                {children}
              </div>
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>

      </body>
    </html>
  );
}
