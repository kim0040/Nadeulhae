import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "전주 나들해 | Jeonju Nadeulhae",
  description: "날씨 기반 전주 피크닉 & 반나절 코스 추천 서비스",
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
            <Navbar />
            <div className="relative pt-12">
              {children}
            </div>
          </ThemeProvider>
        </LanguageProvider>

      </body>
    </html>
  );
}



