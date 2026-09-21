'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ADD_LOG_HREF, NAV_ITEMS, isActivePath } from '@/components/nav';
import { signOut } from '@/features/auth/sign-in';
import { cn } from '@/lib/utils';

type Props = {
  email?: string | null;
  className?: string;
};

// PC のナビ（DESIGN.md §9.1、ADR 0007）。nav.ts から描く 3 形態のうちの 1 つ。
//   768〜1279px: アイコンレール 72px（ラベル無し。title と aria-label で名前を出す）
//   1280px〜   : ラベル付きサイドバー 236px。上にワードマーク、下に「記録を追加」とアカウント
// 767px 以下ではヘッダー + ドロワー（site-header / nav-drawer）を使い、これは出さない。
export function SiteNav({ email, className }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const initial = (email?.[0] ?? '?').toUpperCase();

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/login');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ログアウトできませんでした');
      setSigningOut(false);
    }
  }

  return (
    <aside
      aria-label="サイドバー"
      className={cn(
        'border-border bg-background sticky top-0 hidden h-dvh shrink-0 flex-col border-r px-3 pt-5 pb-4 md:flex xl:w-[236px] xl:px-3.5',
        'w-[72px] items-center xl:items-stretch',
        className,
      )}
    >
      <Link
        href="/"
        aria-label="Coffeenotes ホーム"
        className="font-display text-foreground mb-5 hidden px-3 text-[26px] xl:block"
      >
        Coffeenotes
      </Link>
      <Link
        href="/"
        aria-label="Coffeenotes ホーム"
        className="font-display text-foreground mb-4 grid size-11 place-items-center text-[26px] xl:hidden"
      >
        C
      </Link>

      <nav aria-label="メインナビゲーション">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  title={label}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-11 items-center gap-3 rounded-xl text-sm font-medium transition-colors',
                    'w-11 justify-center xl:w-full xl:justify-start xl:px-3',
                    'focus-visible:outline-primary outline-none focus-visible:outline-2 focus-visible:outline-offset-2',
                    active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-5 shrink-0" strokeWidth={1.8} aria-hidden />
                  <span className="hidden truncate xl:inline">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Link
        href={ADD_LOG_HREF}
        title="記録を追加"
        aria-label="記録を追加"
        className={cn(
          'bg-primary text-primary-foreground hover:bg-primary-hover mt-4 flex h-11 items-center justify-center gap-2 rounded-[12px] text-sm font-bold transition-colors',
          'w-11 xl:w-full',
        )}
      >
        <Plus className="size-5" strokeWidth={2.2} aria-hidden />
        <span className="hidden xl:inline">記録を追加</span>
      </Link>

      <div className="mt-auto flex items-center gap-2.5 xl:px-1">
        <span
          className="bg-primary text-primary-foreground font-num grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold"
          title={email ?? undefined}
        >
          {initial}
        </span>
        <span className="text-foreground hidden min-w-0 flex-1 truncate text-[13px] font-bold xl:block">
          {email ?? 'ログイン中'}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          title="ログアウト"
          aria-label="ログアウト"
          className="text-muted-foreground hover:text-foreground hidden size-9 shrink-0 place-items-center rounded-lg disabled:opacity-50 xl:grid"
        >
          <LogOut className="size-[18px]" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
