'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { CardImage } from '@/components/beans/card-image';
import { useBeanImageUrl } from '@/features/beans/images';
import type { CollectionItem } from '@/features/beans/collection';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

// 棚に並ぶ「豆の袋」（DESIGN.md S10）。上に折り返しの口、正面にカード（写真か印刷物風）、
// 下のラベルに豆名（display）・ロースター・最後に飲んだ場所・星と回数。押すと豆の詳細へ。

export type BeanBagProps = {
  item: CollectionItem;
  className?: string;
};

export function BeanBag({ item, className }: BeanBagProps) {
  const image = useBeanImageUrl(item.imagePath);
  return (
    <Link
      href={routes.bean(item.beanId) as Route}
      aria-label={`${item.name} の袋`}
      className={cn(
        'group focus-visible:outline-primary relative flex h-full flex-col rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-4',
        className,
      )}
    >
      {/* 袋の本体。上端は折り返しの帯（--bag-fold）で、折り目の影を付ける */}
      <span className="bg-bag border-border flex flex-1 flex-col gap-1.5 overflow-hidden rounded-[10px] rounded-t-[6px] border px-[9%] pb-[8%] shadow-[0_10px_18px_-12px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.05)] transition-transform group-hover:-translate-y-0.5">
        <span
          aria-hidden
          className="bg-bag-fold -mx-[10%] mb-[7%] h-[12px] shadow-[0_2px_3px_rgba(0,0,0,.45),inset_0_-1px_0_rgba(255,255,255,.06)]"
        />
        <CardImage
          src={image.data}
          beanName={item.name}
          roasterName={item.roasterName}
          country={item.country}
          size="full"
          className="text-[clamp(10px,3.2vw,14px)] shadow-[0_2px_6px_rgba(0,0,0,.35)] md:text-[13px]"
        />
        <span className="mt-1 flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-display line-clamp-2 text-[14px] leading-[1.1] break-words md:text-[15px]">
            {item.name}
          </span>
          {item.roasterName && (
            <span className="font-num text-primary truncate text-[9px] tracking-[.12em] uppercase">
              {item.roasterName}
            </span>
          )}
          <span className="text-muted-foreground truncate text-[10px]">{item.lastPlace ?? '場所なし'}</span>
          <span
            className="font-num mt-auto flex items-center gap-1 pt-1 text-[11px] whitespace-nowrap"
            aria-label={`${item.avgRating !== null ? `平均 ${item.avgRating.toFixed(1)}、` : ''}${item.count} 回`}
          >
            <Star
              className={
                item.avgRating !== null ? 'text-primary size-3 fill-current' : 'text-muted-foreground size-3'
              }
              aria-hidden
            />
            <span className={item.avgRating !== null ? 'font-bold' : 'text-muted-foreground'}>
              {item.avgRating !== null ? item.avgRating.toFixed(1) : '—'}
            </span>
            <span className="text-muted-foreground">· {item.count} 回</span>
          </span>
        </span>
      </span>
    </Link>
  );
}
