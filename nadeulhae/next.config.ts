import type { NextConfig } from "next";
import { resolve } from "node:path";

const turbopackRoot = resolve(process.cwd(), "..");

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
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
