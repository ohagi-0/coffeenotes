import type { ReactNode } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// 汎用のリスト行（DESIGN.md §4）。左 40px の丸アバター（頭文字、num 700、銅文字）、中央にタイトルと補助、右に数値または chevron。

export type RowProps = {
  /** アバターの頭文字。avatar を渡せばそちらを優先 */
  initial?: string;
  avatar?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** 右側の主値（星の数値など） */
  value?: ReactNode;
  /** 右側の補助（回数など） */
  valueSub?: ReactNode;
  /** 渡すと行全体がリンクになる */
  href?: Route;
  onClick?: () => void;
  /** 右端に chevron を出す。href か onClick があるときの既定は true */
  chevron?: boolean;
  className?: string;
};

export function Row({
  initial,
  avatar,
  title,
  subtitle,
  value,
  valueSub,
  href,
  onClick,
  chevron,
  className,
}: RowProps) {
  const interactive = Boolean(href || onClick);
  const showChevron = chevron ?? (interactive && value === undefined);

  const body = (
    <>
      <span
        aria-hidden="true"
        className="font-num bg-secondary text-primary grid size-10 shrink-0 place-items-center rounded-full text-[14px] font-bold"
      >
        {avatar ?? (initial ?? '').slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{title}</span>
        {subtitle && <span className="text-muted-foreground block truncate text-[12px]">{subtitle}</span>}
      </span>
      {(value !== undefined || valueSub !== undefined) && (
        <span className="text-muted-foreground text-right text-[12px]">
          {value !== undefined && (
            <span className="font-num text-foreground block text-[15px] font-bold">{value}</span>
          )}
          {valueSub !== undefined && <span className="block">{valueSub}</span>}
        </span>
      )}
      {showChevron && <ChevronRight className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />}
    </>
  );

  const base = cn(
    'flex min-h-[68px] w-full items-center gap-3 border-b border-border py-3.5 text-left',
    interactive &&
      'rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={base}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={base}>
        {body}
      </button>
    );
  }
  return <div className={base}>{body}</div>;
}
