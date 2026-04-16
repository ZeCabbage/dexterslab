import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Dexter's Lab — Next.js config */
  experimental: {
    webpackBuildWorker: false,
  },
  async rewrites() {
    return [
      {
        source: '/api/dungeon-buddy/:path*',
        destination: 'http://localhost:8888/api/dungeon-buddy/:path*',
      },
      {
        source: '/api/generate-dog',
        destination: 'http://localhost:8888/api/generate-dog',
      },
    ];
  },
};

export default nextConfig;
