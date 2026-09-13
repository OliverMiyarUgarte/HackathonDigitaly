import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api",
    NEXT_PUBLIC_SOCKET_URL:
      process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "digitaly.tech",
      },
    ],
  },
};

export default nextConfig;
