import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: appRoot,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.weather.go.kr" },
      { protocol: "https", hostname: "vapi.kma.go.kr" },
      { protocol: "https", hostname: "apihub.kma.go.kr" },
    ],
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "X-DNS-Prefetch-Control",
          value: "on",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-XSS-Protection",
          value: "0",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(self)",
        },
        {
          key: "Content-Security-Policy",
          value: "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://www.weather.go.kr https://vapi.kma.go.kr https://apihub.kma.go.kr; font-src 'self'; connect-src 'self' https://www.weather.go.kr https://vapi.kma.go.kr https://apihub.kma.go.kr https://apis.data.go.kr wss://nadeulhae.space wss://www.nadeulhae.space ws://localhost:3000; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
        },
        {
          key: "Cross-Origin-Opener-Policy",
          value: "same-origin",
        },
        {
          key: "Cross-Origin-Resource-Policy",
          value: "same-origin",
        },
      ],
    },
  ],
};

export default nextConfig;
