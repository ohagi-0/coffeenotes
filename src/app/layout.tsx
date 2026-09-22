import type { Metadata, Viewport } from 'next';
import { Bodoni_Moda, Manrope } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { DevTestHooks } from '@/components/dev-test-hooks';

// 書体（ADR 0006 / DESIGN.md §2.3）: 豆名とワードマークは Bodoni Moda、数字は Manrope、日本語は端末フォント。
// next/font は self-host されるので PWA のオフライン閲覧でも崩れない。日本語の Web フォントは読み込まない。
const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  weight: 'variable', // 可変フォント。ウェイト 500 は CSS 側（.font-display）で指定する
  axes: ['opsz'],
  variable: '--font-bodoni',
  display: 'swap',
});
const manrope = Manrope({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'coffeenotes', template: '%s | coffeenotes' },
  description: '飲んだコーヒー豆をカード写真から記録し、店・評価と紐づけて振り返るアプリ',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'coffeenotes' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#17120f',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${bodoni.variable} ${manrope.variable}`}>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
        {/* E2E 用の seam。本番では何もしない */}
        <DevTestHooks />
      </body>
    </html>
  );
}
