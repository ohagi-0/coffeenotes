import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ネイティブ化（Capacitor）に備え、静的出力で動く範囲で書く（REQUIREMENTS.md §13.2 N-1）。
  // /api/* を同一リポジトリに置いているため output: 'export' は現時点では有効にしない（ADR 0002）。
  images: { unoptimized: true },
  typedRoutes: true,
};

// PWA（F-MISC-1）: serwist で Service Worker を生成し、オフラインでは閲覧のみ可能にする。
// 開発中は無効（dev サーバーのチャンクをキャッシュしないため）。
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  reloadOnOnline: true,
});

export default withSerwist(nextConfig);
