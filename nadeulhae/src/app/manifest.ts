import type { MetadataRoute } from "next"

// Web App Manifest → makes the site installable (Add to Home Screen) on mobile.
// This is purely additive: it does not register a service worker or intercept
// any requests, so it has no effect on the running app beyond enabling install.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "나들해 | Nadeulhae",
    short_name: "나들해",
    description: "날씨 기반 피크닉 지수와 지역별 나들이 브리핑 서비스",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fffd",
    theme_color: "#0b7d71",
    lang: "ko",
    categories: ["weather", "lifestyle", "travel"],
    icons: [
      {
        src: "/logo.png",
        sizes: "640x640",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
