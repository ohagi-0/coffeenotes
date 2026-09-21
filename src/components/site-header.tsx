'use client';

import Link from 'next/link';
import { Menu, Plus } from 'lucide-react';
import { ADD_LOG_HREF } from '@/components/nav';

type Props = {
  /** `wizard` は記録作成中。「＋ 記録する」の代わりに「やめる」を出す */
  variant?: 'default' | 'wizard';
  onOpenMenu: () => void;
};

// サイトヘッダー（DESIGN.md §3）: sticky、高さ 56px、左にワードマーク、右に「＋ 記録する」とメニュー。
// main の横余白 20px（px-5）を -mx-5 で打ち消し、画面端まで伸ばす。
export function SiteHeader({ variant = 'default', onOpenMenu }: Props) {
  return (
    <header className="bg-background border-border sticky top-[env(safe-area-inset-top,0px)] z-30 -mx-5 flex h-14 items-center justify-between border-b pr-2.5 pl-5">
      <Link href="/" className="font-display text-foreground text-[22px]" aria-label="Coffeenotes ホーム">
        Coffeenotes
      </Link>
      <div className="flex items-center gap-0.5">
        {variant === 'wizard' ? (
          <Link href="/" className="text-primary flex h-11 items-center px-3 text-sm font-medium">
            やめる
          </Link>
        ) : (
          <Link
            href={ADD_LOG_HREF}
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex h-9 items-center gap-1 rounded-full pr-3.5 pl-2.5 text-[13px] font-bold transition-colors"
          >
            <Plus className="size-4" strokeWidth={2.4} aria-hidden />
            記録する
          </Link>
        )}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="メニューを開く"
          className="text-foreground hover:bg-secondary grid size-11 place-items-center rounded-xl transition-colors"
        >
          <Menu className="size-6" aria-hidden />
        </button>
      </div>
    </header>
  );
}
