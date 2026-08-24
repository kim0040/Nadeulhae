import type { MetadataRoute } from "next"

const siteUrl = process.env.APP_BASE_URL ?? "https://nadeulhae.space"

// Public, indexable routes. Authenticated/utility routes (dashboard, account,
// /courses listing, code-share, api) are intentionally excluded (see robots.ts).
// Logged-in users reach saved courses via the navbar "내 코스" item and dashboard.
const routes: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/jeonju", changeFrequency: "daily", priority: 0.9 },
  { path: "/statistics/calendar", changeFrequency: "daily", priority: 0.7 },
  { path: "/lab", changeFrequency: "weekly", priority: 0.6 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/login", changeFrequency: "yearly", priority: 0.2 },
  { path: "/signup", changeFrequency: "yearly", priority: 0.2 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return routes.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
