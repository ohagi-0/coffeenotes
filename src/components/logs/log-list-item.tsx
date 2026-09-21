import type { Route } from 'next';
import Link from 'next/link';
import { CardImage } from '@/components/beans/card-image';
import { RatingStars } from '@/components/logs/rating-stars';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

// ログ行（DESIGN.md §4、S2）。62px のカード画像 + 豆名（display 21px）+ ロースター + 星と数値 + 店名 or 「自宅」ピル + フレーバー最大 3 つ。
// props は表示用の平らな型で、DB の型に依存しない。行全体が記録詳細（S5）へのリンク。

export const LOG_LIST_ITEM_MAX_FLAVORS = 3;

export type LogListItemProps = {
  id: string;
  beanName: string;
  roasterName?: string | null;
  country?: string | null;
  rating: number | null;
  place: 'shop' | 'home';
  shopName?: string | null;
  /** 店名や「自宅」の右に添える短い補足（飲み方、レシピの要約など） */
  detail?: string | null;
  flavorNotes?: string[];
  imageSrc?: string | null;
  className?: string;
};

export function LogListItem({
  id,
  beanName,
  roasterName,
  country,
  rating,
  place,
  shopName,
  detail,
  flavorNotes = [],
  imageSrc,
  className,
}: LogListItemProps) {
  const flavors = flavorNotes.slice(0, LOG_LIST_ITEM_MAX_FLAVORS);
  // S5 のルート（/logs?id=）は #20 段階 2 で作る。それまで typedRoutes には無いので Route にキャストする
  const href = routes.log(id) as Route;

  return (
    <Link
      href={href}
      className={cn(
        'border-border grid grid-cols-[62px_1fr] items-start gap-3.5 border-b py-3.5',
        'focus-visible:outline-primary rounded-md focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
    >
      <CardImage src={imageSrc} beanName={beanName} roasterName={roasterName} country={country} size="sm" />
      <div className="min-w-0">
        <p className="font-display text-[21px] leading-[1.05] break-words">{beanName}</p>
        {roasterName && <p className="text-muted-foreground mt-1 text-[12px]">{roasterName}</p>}
        <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-[12px]">
          <RatingStars value={rating} size="sm" />
          {place === 'home' ? (
            <span className="bg-primary/14 text-primary rounded-[4px] px-[7px] text-[10px] leading-[1.7] font-medium">
              自宅
            </span>
          ) : (
            shopName && <span className="truncate">{shopName}</span>
          )}
          {detail && <span className="truncate">{detail}</span>}
        </div>
        {flavors.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {flavors.map((f) => (
              <li key={f} className="bg-secondary rounded-[5px] px-2 text-[11px] leading-[1.6]">
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  );
}
