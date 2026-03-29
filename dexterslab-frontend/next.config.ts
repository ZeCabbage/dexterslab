import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Dexter's Lab — Next.js config */
  async rewrites() {
    return [
      {
        source: '/api/dungeon-buddy/:path*',
        destination: 'http://localhost:8888/api/dungeon-buddy/:path*',
      },
    ];
  },
};

export default nextConfig;
