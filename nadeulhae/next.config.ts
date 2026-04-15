import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Keep Turbopack root on the app directory so module resolution uses this package's node_modules.
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.weather.go.kr" },
      { protocol: "https", hostname: "vapi.kma.go.kr" },
      { protocol: "https", hostname: "apihub.kma.go.kr" },
    ],
  },
};

export default nextConfig;
