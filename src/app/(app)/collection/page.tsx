'use client';

import { Suspense, useMemo } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Package } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { BeanBag } from '@/components/beans/bean-bag';
import { EmptyState } from '@/components/empty-state';
import { ErrorCallout } from '@/components/error-callout';
import { FilterChips } from '@/components/filter-chips';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { ADD_LOG_HREF } from '@/components/nav';
import { Skeleton } from '@/components/ui/skeleton';
import {
  COLLECTION_SORT_CHIPS,
  buildCollection,
  sortCollection,
  type CollectionSort,
} from '@/features/beans/collection';
import { useLogs } from '@/features/logs/queries';

// S10 豆のコレクション（棚）。飲んだ豆を 1 袋ずつ棚に並べる。並び順は ?s=（最近 / 星 / 回数）。
// 一覧（S2）とは別の見せ方で、袋を押すと豆の詳細（S4）へ。記録は S2 と同じ useLogs から集計する。

/** 棚 1 段（横一列）。袋の間と下に板を描く */
function Shelf({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="relative z-10 grid grid-cols-3 gap-x-3 gap-y-8 px-1 md:grid-cols-4 md:gap-x-4 xl:grid-cols-5">
        {children}
      </div>
    </div>
  );
}

function ShelfPlank() {
  return (
    <div
      aria-hidden
      className="bg-shelf -mx-5 mt-[-14px] mb-7 h-[14px] shadow-[0_8px_14px_-6px_rgba(0,0,0,.85),inset_0_1px_0_rgba(255,255,255,.08)] md:-mx-8"
    />
  );
}

function CollectionInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const sort = (
    COLLECTION_SORT_CHIPS.some((c) => c.value === params.get('s')) ? params.get('s') : 'recent'
  ) as CollectionSort;
  const logs = useLogs();
  const items = useMemo(() => sortCollection(buildCollection(logs.data ?? []), sort), [logs.data, sort]);

  function setSort(v: string) {
    router.replace((v === 'recent' ? pathname : `${pathname}?s=${v}`) as Route, { scroll: false });
  }

  // 棚は 3 袋ずつ（md 4、xl 5）で段を作る。段の数は CSS のグリッドに任せ、板は段ごとに描くため配列を切る
  const perRow = 3;
  const rowsOfItems = useMemo(() => {
    const out: (typeof items)[] = [];
    for (let i = 0; i < items.length; i += perRow) out.push(items.slice(i, i + perRow));
    return out;
  }, [items]);

  return (
    <div className="pb-2">
      <div className="pt-2 pb-3">
        <h1 className="text-2xl font-bold">豆のコレクション</h1>
        <p className="text-muted-foreground font-num text-xs">
          {logs.data ? `${items.length} 袋 · ${logs.data.length} 杯` : ' '}
        </p>
      </div>

      {logs.isPending && (
        <div role="status" aria-busy="true" aria-label="読み込み中" className="grid grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="aspect-[3/5] rounded-[10px]" />
          ))}
        </div>
      )}

      {logs.error && (
        <ErrorCallout
          title="記録を読み込めませんでした"
          what={logs.error.message}
          next="通信状態を確認して、もう一度読み込んでください。"
          onRetry={() => void logs.refetch()}
        />
      )}

      {logs.data && items.length === 0 && (
        <>
          <ShelfPlank />
          <EmptyState
            icon={Package}
            title="棚はまだ空です"
            description={
              <>
                最初の一杯を記録すると、飲んだ豆が袋になってここに並びます。
                <br />
                カードを撮れば、袋にその写真が付きます。
              </>
            }
            action={
              <AppButton width="auto" href={ADD_LOG_HREF}>
                最初の一杯を記録する
              </AppButton>
            }
            className="pt-8"
          />
        </>
      )}

      {logs.data && items.length > 0 && (
        <>
          <FilterChips chips={COLLECTION_SORT_CHIPS} value={sort} onChange={setSort} className="mb-4" />
          {/* 画面幅で 1 段の袋数が変わるため、板は md 未満の 3 袋ずつの段に合わせて描く（md 以上は板を連続した背景に） */}
          <div className="md:hidden">
            {rowsOfItems.map((row, i) => (
              <div key={i}>
                <Shelf>
                  {row.map((item) => (
                    <BeanBag key={item.beanId} item={item} />
                  ))}
                </Shelf>
                <ShelfPlank />
              </div>
            ))}
          </div>
          <div className="hidden md:block">
            <div className="grid grid-cols-4 gap-x-4 gap-y-10 xl:grid-cols-5">
              {items.map((item) => (
                <div key={item.beanId} className="border-shelf border-b-[10px] pb-2">
                  <BeanBag item={item} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function CollectionPage() {
  return (
    <Suspense fallback={<FullScreenLoading />}>
      <CollectionInner />
    </Suspense>
  );
}
