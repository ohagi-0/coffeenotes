'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Home, Map, Plus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

// 下タブナビ（REQUIREMENTS.md §5）: ホーム / 地図 / ＋ / 統計 / 設定。タップ領域は 44px 以上。
const tabs = [
  { href: '/', label: 'ホーム', icon: Home },
  { href: '/map', label: '地図', icon: Map },
  { href: '/logs/new', label: '記録', icon: Plus, primary: true },
  { href: '/stats', label: '統計', icon: BarChart3 },
  { href: '/settings', label: '設定', icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="メインナビゲーション"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map(({ href, label, icon: Icon, ...tab }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          const primary = 'primary' in tab && tab.primary;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                aria-label={label}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {primary ? (
                  <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-full shadow">
                    <Icon className="size-6" aria-hidden />
                  </span>
                ) : (
                  <>
                    <Icon className="size-6" aria-hidden />
                    <span>{label}</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
