import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: "..",
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
