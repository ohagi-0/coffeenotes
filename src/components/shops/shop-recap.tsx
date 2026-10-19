'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { TasteRadar } from '@/components/beans/taste-radar';
import { CardImage } from '@/components/beans/card-image';
import { LogListItem } from '@/components/logs/log-list-item';
import { RatingStars } from '@/components/logs/rating-stars';
import { useBeanImageUrl } from '@/features/beans/images';
import type { TimelineItem } from '@/features/logs/presenters';
import {
  formatMonthDay,
  groupByMonth,
  type ShopBeanRecap,
  type ShopBest,
  type ShopTrend,
} from '@/features/shops/recap';
import { routes } from '@/lib/routes';

// 店詳細の振り返り（#44）。「この店のベスト」「飲んだ豆」「訪問の記録」「傾向」。集計は features/shops/recap.ts。

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 mb-2 text-[13px] font-bold">{children}</h2>;
}

/** この店のベスト（星が最も高い記録の豆。同点なら新しい方）。カード画像があればサムネイル */
export function ShopBestCard({ best }: { best: ShopBest }) {
  const img = useBeanImageUrl(best.imagePath);
  return (
    <section aria-label="この店のベスト">
      <SectionTitle>この店のベスト</SectionTitle>
      <Link
        href={routes.log(best.logId) as Route}
        className="border-primary bg-card grid grid-cols-[62px_1fr] items-start gap-3.5 rounded-[14px] border p-3.5"
      >
        <CardImage src={img.data} beanName={best.beanName} roasterName={best.roasterName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[21px] leading-[1.05] break-words">{best.beanName}</p>
          {best.roasterName && <p className="text-muted-foreground mt-1 text-[12px]">{best.roasterName}</p>}
          <div className="mt-2 flex items-center gap-2">
            <RatingStars value={best.rating} size="sm" />
            <span className="text-muted-foreground font-num text-[12px]">
              {formatMonthDay(best.loggedOn)}
            </span>
          </div>
        </div>
      </Link>
    </section>
  );
}

/** 飲んだ豆（種類ごと）。同じ豆を何度飲んでいるかが分かる。押すと豆詳細 */
export function ShopBeansList({ beans }: { beans: ShopBeanRecap[] }) {
  if (beans.length === 0) return null;
  return (
    <section aria-label="飲んだ豆">
      <SectionTitle>
        飲んだ豆
        <span className="text-muted-foreground font-num ml-2 text-[11px] font-normal">{beans.length} 種</span>
      </SectionTitle>
      <ul>
        {beans.map((b) => (
          <li key={b.beanId}>
            <Link
              href={routes.bean(b.beanId) as Route}
              className="border-border flex min-h-[60px] items-center gap-3 border-b py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{b.beanName}</p>
                <p className="text-muted-foreground truncate text-[11px]">
                  <span className="font-num">{b.count} 回</span>
                  {' · '}最後 <span className="font-num">{formatMonthDay(b.lastOn)}</span>
                  {b.roasterName ? ` · ${b.roasterName}` : ''}
                </p>
                {b.flavorNotes.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {b.flavorNotes.map((f) => (
                      <li key={f} className="bg-secondary rounded-[5px] px-2 text-[11px] leading-[1.6]">
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {b.avgRating !== null ? (
                <span className="flex flex-col items-end gap-0.5">
                  <RatingStars value={b.avgRating} size="sm" hideValue />
                  <span className="font-num text-[13px] font-extrabold">{b.avgRating.toFixed(1)}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 訪問の記録。日付降順、月ごとの小見出し。各行に豆名・星・メモの冒頭・飲み方 */
export function ShopVisits({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="訪問の記録">
      <SectionTitle>訪問の記録</SectionTitle>
      {groupByMonth(items).map((g) => (
        <div key={g.month}>
          <h3 className="text-muted-foreground mt-3 text-[12px] font-medium">{g.label}</h3>
          {g.items.map((item) => (
            <LogListItem key={item.id} {...item} />
          ))}
        </div>
      ))}
    </section>
  );
}

/** 傾向（記録が 3 件以上のとき）。星 4 以上の割合、よく付けるタグ上位 3 つ、味覚の平均 */
export function ShopTrendCard({ trend }: { trend: ShopTrend }) {
  const t = trend.taste;
  const hasTaste = [t.flavor, t.sweetness, t.acidity, t.aftertaste, t.body].some((v) => v !== null);
  return (
    <section aria-label="この店での傾向">
      <SectionTitle>この店での傾向</SectionTitle>
      <div className="border-border bg-card rounded-[14px] border p-3.5">
        {trend.ratedCount > 0 && (
          <p className="text-sm">
            星 4 以上が{' '}
            <span className="font-num text-primary text-lg font-extrabold">
              {Math.round(trend.highRatio * 100)}%
            </span>
            <span className="text-muted-foreground font-num ml-2 text-[11px]">
              星付き {trend.ratedCount} 件中
            </span>
          </p>
        )}
        {trend.topTags.length > 0 && (
          <div className="mt-3">
            <p className="text-muted-foreground text-[11px]">よく付けるタグ</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {trend.topTags.map((x) => (
                <li key={x.label} className="bg-secondary rounded-[5px] px-2 text-[12px] leading-[1.9]">
                  {x.label}
                  <span className="text-muted-foreground font-num ml-1 text-[10px]">{x.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {hasTaste && (
          <div className="mt-3">
            <p className="text-muted-foreground text-[11px]">味覚の平均（{t.beans} 種の豆）</p>
            <TasteRadar
              value={{
                flavor: t.flavor,
                sweetness: t.sweetness,
                acidity: t.acidity,
                aftertaste: t.aftertaste,
                body: t.body,
              }}
              aria-label="この店で飲んだ豆の味覚チャートの平均"
            />
          </div>
        )}
      </div>
    </section>
  );
}
