'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ADD_LOG_HREF, NAV_ITEMS, isActivePath } from '@/components/nav';
import { signOut } from '@/features/auth/sign-in';

type Props = {
  open: boolean;
  onClose: () => void;
  email?: string | null;
};

// 右から開くナビのドロワー（DESIGN.md §3）。ネイティブの <dialog> を使い、
// フォーカストラップ・Esc で閉じる・最前面（top layer）をブラウザに任せる。
export function NavDrawer({ open, onClose, email }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      onClose();
      router.replace('/login');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ログアウトできませんでした');
      setSigningOut(false);
    }
  }

  const initial = (email?.[0] ?? '?').toUpperCase();

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // 背景（dialog 自身）のクリックで閉じる。中身のクリックは stopPropagation で止める
        if (e.target === ref.current) onClose();
      }}
      aria-label="メニュー"
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none justify-end bg-transparent p-0 backdrop:bg-black/55 open:flex"
    >
      <div
        className="bg-background border-border relative flex h-full w-[82%] max-w-sm flex-col border-l px-5 pt-16 pb-[max(env(safe-area-inset-bottom,0px),24px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="メニューを閉じる"
          className="bg-secondary text-foreground absolute top-3 right-3 grid size-10 place-items-center rounded-xl"
        >
          <X className="size-5" aria-hidden />
        </button>

        <nav aria-label="メインナビゲーション">
          <ul>
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'border-border flex h-[54px] items-center gap-3.5 border-b text-[17px] font-bold',
                      active ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    <Icon className="size-[22px]" strokeWidth={1.8} aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <Link
          href={ADD_LOG_HREF}
          onClick={onClose}
          className="bg-primary text-primary-foreground hover:bg-primary-hover mt-5 flex h-13 items-center justify-center gap-2 rounded-[14px] text-[15px] font-bold transition-colors"
        >
          <Plus className="size-5" strokeWidth={2.4} aria-hidden />
          記録を追加
        </Link>

        <div className="text-muted-foreground mt-auto flex items-center gap-2.5 text-xs">
          <span className="bg-primary text-primary-foreground font-num grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-foreground block truncate text-[13px] font-bold">
              {email ?? 'ログイン中'}
            </span>
            <span>アカウント</span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="text-primary h-11 shrink-0 px-2 text-[13px] font-medium disabled:opacity-50"
          >
            {signingOut ? 'ログアウト中…' : 'ログアウト'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
