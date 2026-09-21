import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ネイティブ化（Capacitor）に備え、静的出力で動く範囲で書く（REQUIREMENTS.md §13.2 N-1）。
  // /api/* を同一リポジトリに置いているため output: 'export' は現時点では有効にしない（ADR 0002）。
  images: { unoptimized: true },
  typedRoutes: true,
};

export default nextConfig;
