'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Star } from 'lucide-react';
import type { CollectionItem } from '@/features/beans/collection';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

// 棚に並ぶ「豆の袋」（DESIGN.md S10）。写真は使わず、袋の正面に貼ったラベル（紙）に
// ロースター / 豆名（Bodoni）/ 生産国 · 精製 / 星の封蝋 / 最後に飲んだ日と場所 / 杯数 を印字する。
// クラフト紙の袋（--bag 系のグラデーション）+ 上部の折り返し + 圧着の点線。押すと豆の詳細へ。

export type BeanBagProps = {
  item: CollectionItem;
  className?: string;
};

const PRINT_FONT = { fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' } as const;

export function BeanBag({ item, className }: BeanBagProps) {
  const date = format(parseISO(item.lastLoggedOn), 'yyyy.MM.dd');
  const origin = [item.country, item.process].filter(Boolean).join(' · ');
  return (
    <Link
      href={routes.bean(item.beanId) as Route}
      aria-label={`${item.name} の袋`}
      className={cn(
        'group focus-visible:outline-primary relative flex h-full flex-col rounded-[12px] outline-none focus-visible:outline-2 focus-visible:outline-offset-4',
        className,
      )}
    >
      <span
        className={cn(
          'relative flex flex-1 flex-col rounded-[12px] rounded-t-[7px] border border-white/6 px-[8%] pb-[9%]',
          'shadow-[0_14px_22px_-14px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.05),inset_0_-2px_0_rgba(0,0,0,.35)]',
          'transition-transform group-hover:-translate-y-0.5',
        )}
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgba(255,255,255,.035) 0%, rgba(255,255,255,0) 22%, rgba(255,255,255,0) 78%, rgba(0,0,0,.12) 100%), linear-gradient(170deg, var(--bag-fold) 0%, var(--bag) 55%, #1f1712 100%)',
        }}
      >
        {/* 折り返しと圧着の点線 */}
        <span
          aria-hidden
          className="-mx-[8%] mb-[10%] h-[16px] rounded-t-[6px] shadow-[0_3px_4px_rgba(0,0,0,.5),inset_0_-1px_0_rgba(255,255,255,.05)]"
          style={{
            backgroundColor: 'var(--bag-fold)',
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(255,255,255,.10) 0 2px, transparent 2px 6px)',
            backgroundSize: '100% 1px',
            backgroundPosition: '0 9px',
            backgroundRepeat: 'repeat-x',
          }}
        />

        {/* ラベル（紙） */}
        <span
          className="bg-card-paper text-card-ink relative flex flex-1 flex-col items-center rounded-[3px] px-[9%] pt-[12%] pb-[8%] text-center shadow-[0_2px_5px_rgba(0,0,0,.45),inset_0_0_0_1px_rgba(0,0,0,.08)]"
          style={{
            ...PRINT_FONT,
            backgroundImage:
              'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.55), rgba(255,255,255,0) 60%), radial-gradient(80% 60% at 50% 110%, rgba(0,0,0,.06), rgba(0,0,0,0) 70%)',
          }}
        >
          {/* 内側の二重罫 */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-[5%] rounded-[2px] border border-[#1d1610]/25 outline outline-1 outline-offset-2 outline-[#1d1610]/10"
          />

          {/* 星の封蝋（ラベルの上端中央に貼る） */}
          <span
            aria-hidden
            className={cn(
              'font-num absolute -top-[15px] left-1/2 grid size-[30px] -translate-x-1/2 place-items-center rounded-full text-[11px] leading-none font-extrabold shadow-[0_2px_4px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.35)]',
              item.avgRating !== null
                ? 'bg-primary text-primary-foreground'
                : 'bg-card-paper text-card-ink/45 border border-dashed border-[#1d1610]/35 shadow-none',
            )}
          >
            {item.avgRating !== null ? item.avgRating.toFixed(1) : '—'}
          </span>

          <span className="mt-[6%] w-[86%] truncate text-[8px] font-bold tracking-[.22em] uppercase opacity-80">
            {item.roasterName ?? 'Coffeenotes'}
          </span>
          <span aria-hidden className="mt-[5%] h-px w-[26%] bg-[#1d1610]/30" />

          <span className="font-display mt-[9%] line-clamp-3 w-full text-[19px] leading-[1.03] tracking-[-.01em] break-words">
            {item.name}
          </span>
          {origin && (
            <span className="mt-[6%] line-clamp-1 w-full text-[8.5px] tracking-[.06em] uppercase opacity-70">
              {origin}
            </span>
          )}

          <span aria-hidden className="mt-auto mb-[6%] h-px w-[46%] bg-[#1d1610]/25" />
          <span className="font-num flex w-full items-center justify-between gap-1 text-[8.5px] tracking-[.04em]">
            <span className="shrink-0 opacity-75">{date}</span>
            <span className="truncate text-right font-bold">{item.lastPlace ?? '—'}</span>
          </span>
          <span className="font-num mt-[4%] flex items-center gap-1 text-[8px] tracking-[.18em] uppercase opacity-70">
            <Star className="size-[8px] fill-current" aria-hidden />
            {item.count} cups
          </span>
        </span>
      </span>
    </Link>
  );
}

export type BeanBagEmptyProps = {
  /** 棚の名前（国名など）。「まだ飲んでいません」の下に出す */
  label: string;
  sub?: string | null;
  className?: string;
};

/** まだ飲んでいない棚の空き（点線の袋の輪郭）。コレクションの「まだ埋まっていない枠」 */
export function BeanBagEmpty({ label, sub, className }: BeanBagEmptyProps) {
  return (
    <span
      role="img"
      aria-label={`${label} はまだ飲んでいません`}
      className={cn(
        'border-border/80 text-muted-foreground flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-[12px] rounded-t-[7px] border border-dashed px-3 text-center',
        className,
      )}
    >
      <span className="font-display text-foreground/70 text-[15px] leading-tight">{label}</span>
      {sub && <span className="font-num text-[9px] tracking-[.18em] uppercase">{sub}</span>}
      <span className="mt-2 text-[10px]">まだ飲んでいません</span>
    </span>
  );
}
