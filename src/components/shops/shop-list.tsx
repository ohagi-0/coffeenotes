'use client';

import type { Route } from 'next';
import { Store } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { EmptyState } from '@/components/empty-state';
import { ErrorCallout } from '@/components/error-callout';
import { RatingStars } from '@/components/logs/rating-stars';
import { Row } from '@/components/row';
import { Skeleton } from '@/components/ui/skeleton';
import type { ShopRow } from '@/features/shops/presenters';
import { routes } from '@/lib/routes';

export type ShopListProps = {
  rows: ShopRow[];
  isPending: boolean;
  error: Error | null;
  onRetry?: () => void;
  /** 検索や種別で絞っているか（0 件の文言が変わる） */
  filtered?: boolean;
  onClearFilter?: () => void;
  /** 「＋ お店を登録」の遷移先 */
  newHref: Route;
};

// 店一覧（S6）。読み込み / 失敗 / 空 / 絞り込み 0 件 / 一覧の 5 状態。
export function ShopList({
  rows,
  isPending,
  error,
  onRetry,
  filtered,
  onClearFilter,
  newHref,
}: ShopListProps) {
  if (isPending) {
    return (
      <div role="status" aria-busy="true" aria-label="読み込み中">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="border-border flex items-center gap-3 border-b py-3.5" aria-hidden>
            <Skeleton className="bg-secondary size-10 rounded-full motion-reduce:animate-none" />
            <div className="flex-1">
              <Skeleton className="bg-secondary h-4 w-3/5 rounded-md motion-reduce:animate-none" />
              <Skeleton className="bg-secondary mt-2 h-3 w-2/5 rounded-md motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <ErrorCallout
        title="店を読み込めませんでした"
        what={error.message}
        next="通信状態を確認して、もう一度読み込んでください。"
        onRetry={onRetry}
        className="mt-3"
      />
    );
  }
  if (rows.length === 0) {
    return filtered ? (
      <EmptyState
        icon={Store}
        title="条件に合う店はありません"
        description="検索語や種別を変えてみてください。"
        action={
          onClearFilter && (
            <AppButton variant="secondary" size="md" width="auto" onClick={onClearFilter}>
              絞り込みを解除
            </AppButton>
          )
        }
      />
    ) : (
      <EmptyState
        icon={Store}
        title="店はまだありません"
        description="記録を作るときに店を選ぶと増えます。先に登録しておくこともできます。"
        action={
          <AppButton width="auto" href={newHref}>
            お店を登録
          </AppButton>
        }
      />
    );
  }
  return (
    <div>
      {rows.map((s) => (
        <Row
          key={s.id}
          initial={s.name.slice(0, 1).toUpperCase()}
          title={s.name}
          subtitle={
            <>
              {[s.kindLabel, s.area, s.count > 0 ? `${s.count} 回` : null].filter(Boolean).join(' · ')}
              {!s.hasCoordinates && (
                <span className="bg-secondary text-muted-foreground ml-2 rounded-[4px] px-[7px] text-[10px] leading-[1.7]">
                  座標なし
                </span>
              )}
            </>
          }
          value={
            s.avgRating !== null ? (
              <span className="flex flex-col items-end gap-0.5">
                <RatingStars value={s.avgRating} size="sm" hideValue />
                <span className="font-num text-[13px] font-extrabold">{s.avgRating.toFixed(1)}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
          href={routes.shop(s.id) as Route}
        />
      ))}
    </div>
  );
}
