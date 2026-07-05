import type { MetadataRoute } from "next"

const siteUrl = process.env.APP_BASE_URL ?? "https://nadeulhae.space"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep authenticated/utility surfaces out of the index.
      disallow: ["/api/", "/account", "/dashboard", "/code-share/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
