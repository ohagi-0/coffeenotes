'use client';

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
  /** Storage 上のカード画像パス。imageSrc が無いとき署名付き URL に解決して表示する */
  imagePath?: string | null;
  /** 遷移先を差し替える（PC の 2 ペインでは ?bean= にする）。既定は記録詳細 */
  href?: Route;
  /** 選択中（PC の 2 ペインで右に出している行） */
  selected?: boolean;
  /** 一括削除の選択モード。true のとき行はリンクではなくチェックボックスになる */
  selectable?: boolean;
  checked?: boolean;
  onToggle?: (id: string) => void;
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
  imagePath,
  href: hrefOverride,
  selected,
  selectable,
  checked = false,
  onToggle,
  className,
}: LogListItemProps) {
  const flavors = flavorNotes.slice(0, LOG_LIST_ITEM_MAX_FLAVORS);
  const href = hrefOverride ?? (routes.log(id) as Route);
  // 一覧では撮ったカード写真を出さず、常に印刷物風のカードで揃える（2026-09-24。写真は豆詳細で見る）
  void imageSrc;
  void imagePath;
  const src = null;

  const body = (
    <>
      <CardImage src={src} beanName={beanName} roasterName={roasterName} country={country} size="sm" />
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
    </>
  );

  if (selectable) {
    return (
      <label
        className={cn(
          'border-border grid grid-cols-[24px_62px_1fr] items-start gap-3.5 border-b py-3.5',
          'has-[:focus-visible]:outline-primary rounded-md has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
          checked && 'bg-card -mx-3 rounded-xl border-b-transparent px-3',
          className,
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle?.(id)}
          aria-label={`${beanName} を選択`}
          className="accent-primary mt-5 size-6 justify-self-center"
        />
        {body}
      </label>
    );
  }

  return (
    <Link
      href={href}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'border-border grid grid-cols-[62px_1fr] items-start gap-3.5 border-b py-3.5',
        'focus-visible:outline-primary rounded-md focus-visible:outline-2 focus-visible:outline-offset-2',
        selected && 'bg-card -mx-3 rounded-xl border-b-transparent px-3',
        className,
      )}
    >
      {body}
    </Link>
  );
}
