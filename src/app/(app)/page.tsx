'use client';

import { Suspense, useMemo } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Package } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { BeanBag, BeanBagEmpty } from '@/components/beans/bean-bag';
import { EmptyState } from '@/components/empty-state';
import { ErrorCallout } from '@/components/error-callout';
import { FilterChips } from '@/components/filter-chips';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { ADD_LOG_HREF } from '@/components/nav';
import { Skeleton } from '@/components/ui/skeleton';
import {
  COLLECTION_SORT_CHIPS,
  COLLECTION_VIEW_CHIPS,
  buildCollection,
  groupByCountry,
  groupByVariety,
  isCollectionSort,
  isCollectionView,
  sortCollection,
  type CollectionSort,
  type CollectionView,
} from '@/features/beans/collection';
import { useLogs } from '@/features/logs/queries';

// ホーム = S10 豆のコレクション（棚）。飲んだ豆を 1 袋ずつ棚に並べる。
// 見せ方は ?s=（生産国の棚 / 品種の棚 / すべての豆）、「すべての豆」のときだけ並び順 ?o=（最近 / 星 / 回数）を出す。
// 一覧（S2、/logs）とは別の見せ方で、袋を押すと豆の詳細（S4）へ。記録は S2 と同じ useLogs から集計する。

/** 棚 1 段（横一列）。袋の間と下に板を描く */
function Shelf({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="relative z-10 grid grid-cols-2 gap-x-4 gap-y-8 px-1">{children}</div>
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
  const sParam = params.get('s');
  // 以前の ?s=recent|rating|count（並び順が見せ方を兼ねていた）は「すべての豆」+ その並び順として読む
  const view: CollectionView = isCollectionView(sParam)
    ? sParam
    : isCollectionSort(sParam)
      ? 'all'
      : 'country';
  const oParam = params.get('o');
  const sort: CollectionSort = isCollectionSort(oParam)
    ? oParam
    : isCollectionSort(sParam)
      ? sParam
      : 'recent';
  const logs = useLogs();
  const collection = useMemo(() => buildCollection(logs.data ?? []), [logs.data]);
  // 棚に分けるときは各棚の中を最近飲んだ順に。「すべての豆」は選んだ並び順で 1 本に
  const grouped = view !== 'all';
  const items = useMemo(
    () => sortCollection(collection, grouped ? 'recent' : sort),
    [collection, grouped, sort],
  );
  const byCountry = useMemo(
    () => (view === 'country' ? groupByCountry(items) : view === 'variety' ? groupByVariety(items) : null),
    [items, view],
  );

  function replaceQuery(next: { s?: CollectionView; o?: CollectionSort }) {
    const v = next.s ?? view;
    const o = next.o ?? sort;
    const sp = new URLSearchParams();
    if (v !== 'country') sp.set('s', v);
    if (v === 'all' && o !== 'recent') sp.set('o', o);
    const qs = sp.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route, { scroll: false });
  }
  const chips = (
    <>
      <FilterChips
        chips={COLLECTION_VIEW_CHIPS}
        value={view}
        onChange={(v) => replaceQuery({ s: v })}
        className={view === 'all' ? 'mb-1' : 'mb-4'}
      />
      {view === 'all' && (
        <FilterChips
          chips={COLLECTION_SORT_CHIPS}
          value={sort}
          onChange={(o) => replaceQuery({ o })}
          className="mb-4"
        />
      )}
    </>
  );

  // 棚は 3 袋ずつ（md 4、xl 5）で段を作る。段の数は CSS のグリッドに任せ、板は段ごとに描くため配列を切る
  const perRow = 2;
  const rowsOfItems = useMemo(() => {
    const out: (typeof items)[] = [];
    for (let i = 0; i < items.length; i += perRow) out.push(items.slice(i, i + perRow));
    return out;
  }, [items]);

  return (
    <div className="pb-2">
      <div className="pt-5 pb-4">
        <h1 className="text-2xl font-bold">豆のコレクション</h1>
        <p className="text-muted-foreground font-num text-xs">
          {logs.data
            ? byCountry
              ? `${byCountry.total} の${view === 'variety' ? '品種' : '産地'}のうち ${byCountry.visited} を制覇 · ${items.length} 袋 · ${logs.data.length} 杯`
              : `${items.length} 袋 · ${logs.data.length} 杯`
            : ' '}
        </p>
      </div>

      {logs.isPending && (
        <div role="status" aria-busy="true" aria-label="読み込み中" className="grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-[12px]" />
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
          {/* 棚板は袋の下に食い込む前提（mt-[-14px]）なので、空状態では上に余白を置いて小見出しから離す */}
          <div className="h-8" aria-hidden />
          <ShelfPlank />
          <EmptyState
            icon={Package}
            title="棚はまだ空です"
            description={
              <>
                最初の一杯を記録すると、飲んだ豆が袋になってここに並びます。
                <br />
                テイスティングカードを読み取れば、豆の名前や生産国がそのまま袋のラベルになります。
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

      {logs.data && items.length > 0 && byCountry && (
        <>
          {chips}
          {byCountry.shelves.map((shelf) => (
            <section key={shelf.key} aria-label={`${shelf.title}の棚`} className="mb-1">
              <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
                <h2 className="flex min-w-0 items-baseline gap-2">
                  <span className="font-display truncate text-[17px]">{shelf.title}</span>
                  {shelf.sub && (
                    <span className="font-num text-muted-foreground shrink-0 text-[10px] tracking-[.18em] uppercase">
                      {shelf.sub}
                    </span>
                  )}
                </h2>
                <span className="font-num text-muted-foreground shrink-0 text-[11px]">
                  {shelf.items.length > 0 ? `${shelf.items.length} 袋` : (shelf.note ?? '')}
                </span>
              </div>
              {shelf.items.length > 0 ? (
                <div className="md:hidden">
                  {Array.from({ length: Math.ceil(shelf.items.length / perRow) }, (_, i) =>
                    shelf.items.slice(i * perRow, i * perRow + perRow),
                  ).map((row, i) => (
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
              ) : (
                <div className="md:hidden">
                  <Shelf>
                    <BeanBagEmpty label={shelf.title} sub={shelf.sub} />
                  </Shelf>
                  <ShelfPlank />
                </div>
              )}
              <div className="hidden md:block">
                <div className="border-shelf grid grid-cols-3 gap-x-5 gap-y-10 border-b-[10px] pb-3 xl:grid-cols-4">
                  {shelf.items.length > 0 ? (
                    shelf.items.map((item) => <BeanBag key={item.beanId} item={item} />)
                  ) : (
                    <BeanBagEmpty label={shelf.title} sub={shelf.sub} />
                  )}
                </div>
                <div className="h-7" />
              </div>
            </section>
          ))}
        </>
      )}

      {logs.data && items.length > 0 && !byCountry && (
        <>
          {chips}
          {/* 画面幅で 1 段の袋数が変わるため、板は md 未満の 2 袋ずつの段に合わせて描く（md 以上は板を各袋の下に） */}
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
            <div className="grid grid-cols-3 gap-x-5 gap-y-10 xl:grid-cols-4">
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

export default function HomePage() {
  return (
    <Suspense fallback={<FullScreenLoading />}>
      <CollectionInner />
    </Suspense>
  );
}
