'use client';

import { useState } from 'react';
import { Flame, Plus } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { ErrorCallout } from '@/components/error-callout';
import { RatingStars } from '@/components/logs/rating-stars';
import { RoastForm, type GreenShopOption } from '@/components/roasts/roast-form';
import { Skeleton } from '@/components/ui/skeleton';
import type { RatingStat } from '@/features/logs/aggregate';
import type { Roast } from '@/features/roasts/queries';
import {
  ROAST_LEVEL_LABELS,
  formatDuration,
  weightLossPercent,
  type RoastFormValues,
  type RoastLevel,
} from '@/lib/schemas/roast';

// 豆詳細の「焙煎バッチ」（S4、F-ROAST-1〜8）。自家焙煎の豆だけに出す。バッチごとの回数と平均星を並べる。

export type RoastBatchesProps = {
  roasts: Roast[] | undefined;
  isPending: boolean;
  error: Error | null;
  onRetry?: () => void;
  statByRoast?: ReadonlyMap<string, RatingStat>;
  greenShops?: GreenShopOption[];
  onCreate: (values: RoastFormValues) => Promise<void>;
  creating?: boolean;
};

export function roastLevelLabel(level: string | null): string | null {
  return level && level in ROAST_LEVEL_LABELS ? ROAST_LEVEL_LABELS[level as RoastLevel] : null;
}

export function RoastBatches({
  roasts,
  isPending,
  error,
  onRetry,
  statByRoast,
  greenShops,
  onCreate,
  creating,
}: RoastBatchesProps) {
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <section className="mt-6" aria-label="焙煎バッチ">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[13px] font-bold">焙煎バッチ</h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-primary flex items-center gap-1 text-[13px] font-medium"
          >
            <Plus className="size-4" aria-hidden />
            バッチを追加
          </button>
        )}
      </div>
      {adding && (
        <>
          {failure && <ErrorCallout title="登録できませんでした" what={failure} className="mb-2" />}
          <RoastForm
            greenShops={greenShops}
            submitting={creating}
            onCancel={() => setAdding(false)}
            onSubmit={async (values) => {
              setFailure(null);
              try {
                await onCreate(values);
                setAdding(false);
              } catch (e) {
                setFailure(e instanceof Error ? e.message : '登録できませんでした');
              }
            }}
          />
        </>
      )}
      {isPending && (
        <div role="status" aria-busy="true" className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      )}
      {error && (
        <ErrorCallout title="焙煎バッチを読み込めませんでした" what={error.message} onRetry={onRetry} />
      )}
      {!isPending && !error && (roasts?.length ?? 0) === 0 && !adding && (
        <p className="text-muted-foreground py-3 text-sm">
          まだバッチがありません。焙煎したら「バッチを追加」で日付と条件を残せます。
        </p>
      )}
      {(roasts ?? []).map((r) => {
        const st = statByRoast?.get(r.id);
        const loss = weightLossPercent(r.green_grams, r.roasted_grams);
        return (
          <div key={r.id} className="border-border flex items-center gap-3 border-b py-3">
            <span
              className="bg-secondary text-primary grid size-10 shrink-0 place-items-center rounded-full"
              aria-hidden
            >
              <Flame className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                <span className="font-num">{r.roasted_on}</span>
                {roastLevelLabel(r.roast_level) && (
                  <span className="text-muted-foreground ml-2 text-xs">{roastLevelLabel(r.roast_level)}</span>
                )}
              </p>
              <p className="text-muted-foreground text-[12px]">
                {[
                  r.method,
                  r.green_grams !== null ? `${r.green_grams} g` : null,
                  loss !== null ? `減率 ${loss}%` : null,
                  formatDuration(r.duration_sec),
                  `${st?.count ?? 0} 回`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <RatingStars value={st?.avgRating ?? null} size="sm" aria-label="このバッチの平均星" />
          </div>
        );
      })}
      {(roasts ?? []).length > 0 && (
        <AppButton
          className="mt-3"
          variant="secondary"
          size="md"
          onClick={() => setAdding(true)}
          disabled={adding}
        >
          <Plus aria-hidden />
          バッチを追加
        </AppButton>
      )}
    </section>
  );
}
