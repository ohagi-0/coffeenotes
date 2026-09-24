'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { CardImage } from '@/components/beans/card-image';
import { RatingStars } from '@/components/logs/rating-stars';
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
        'group focus-visible:outline-primary relative flex flex-col rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-4',
        className,
      )}
    >
      {/* 袋の口（折り返し） */}
      <span
        aria-hidden
        className="bg-bag-fold border-border mx-[7%] h-[10px] rounded-t-[6px] border border-b-0 shadow-[inset_0_-3px_4px_rgba(0,0,0,.35)]"
      />
      {/* 袋の本体 */}
      <span className="bg-bag border-border flex flex-col gap-1.5 rounded-[10px] rounded-t-[4px] border px-[9%] pt-[9%] pb-[8%] shadow-[0_10px_18px_-12px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.05)] transition-transform group-hover:-translate-y-0.5">
        <CardImage
          src={image.data}
          beanName={item.name}
          roasterName={item.roasterName}
          country={item.country}
          size="full"
          className="text-[clamp(10px,3.2vw,14px)] shadow-[0_2px_6px_rgba(0,0,0,.35)] md:text-[13px]"
        />
        <span className="mt-1 flex min-w-0 flex-col gap-0.5">
          <span className="font-display line-clamp-2 text-[14px] leading-[1.1] break-words md:text-[15px]">
            {item.name}
          </span>
          {item.roasterName && (
            <span className="font-num text-primary truncate text-[9px] tracking-[.12em] uppercase">
              {item.roasterName}
            </span>
          )}
          <span className="text-muted-foreground truncate text-[10px]">{item.lastPlace ?? '場所なし'}</span>
          <span className="flex items-center justify-between gap-1">
            <RatingStars value={item.avgRating} size="sm" hideValue />
            <span className="font-num text-muted-foreground text-[10px]">
              {item.avgRating !== null ? `${item.avgRating.toFixed(1)} · ` : ''}
              {item.count} 回
            </span>
          </span>
        </span>
      </span>
    </Link>
  );
}
