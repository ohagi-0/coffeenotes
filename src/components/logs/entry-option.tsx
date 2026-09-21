'use client';

import type { ReactNode } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  /** 主候補（銅地）。画面に 1 つ */
  primary?: boolean;
  href?: Route;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

// 記録作成の入口の選択肢カード（DESIGN.md §4、S3 入口）。角丸 18px、左に 48px のアイコン地。
export function EntryOption({
  icon: Icon,
  title,
  description,
  primary,
  href,
  onClick,
  disabled,
  className,
}: Props) {
  const cls = cn(
    'flex w-full items-center gap-3.5 rounded-[18px] border p-4 text-left transition-colors outline-none',
    'focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2',
    primary
      ? 'bg-primary border-primary text-primary-foreground hover:bg-primary-hover'
      : 'bg-card border-border text-foreground hover:bg-secondary',
    disabled && 'pointer-events-none opacity-50',
    className,
  );
  const body = (
    <>
      <span
        className={cn(
          'grid size-12 shrink-0 place-items-center rounded-[14px]',
          primary ? 'bg-black/15' : 'bg-secondary',
        )}
        aria-hidden
      >
        <Icon className="size-6" strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-bold">{title}</span>
        <span className={cn('block text-xs', primary ? 'opacity-80' : 'text-muted-foreground')}>
          {description}
        </span>
      </span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} aria-disabled={disabled || undefined}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {body}
    </button>
  );
}
