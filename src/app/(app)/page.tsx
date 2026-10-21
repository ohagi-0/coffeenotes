'use client';

import { Suspense, useMemo } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Package } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { BeanBag, BeanBagEmpty } from '@/components/beans/bean-bag';
import { CoffeeFarm } from '@/components/beans/coffee-farm';
import { MAP_LEGEND, WorldMap } from '@/components/beans/world-map';
import { ShelfRow, WoodPlank } from '@/components/beans/shelf-row';
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
  cupsByCountry,
  groupByCountry,
  groupByVariety,
  isCollectionSort,
  isCollectionView,
  sortCollection,
  type CollectionSort,
  type CollectionView,
} from '@/features/beans/collection';
import { buildFarm } from '@/features/beans/farm';
import { useLogs } from '@/features/logs/queries';
import { COUNTRY_SHELVES } from '@/lib/vocab';

// ホーム = S10 豆のコレクション（棚）。飲んだ豆を 1 袋ずつ棚に並べる。
// 見せ方は ?s=（生産国の棚 / 品種の棚 / すべての豆 / 産地の地図）、「すべての豆」のときだけ並び順 ?o=（最近 / 星 / 回数）を出す。
// 杯数の下にコーヒーの木（産地ごとに 1 本、杯数で育つ。features/beans/farm.ts）。「産地の地図」は飲んだ国を銅で塗る（2026-10-21、ADR 0012）。
// 一覧（S2、/logs）とは別の見せ方で、袋を押すと豆の詳細（S4）へ。記録は S2 と同じ useLogs から集計する。

/** 「すべての豆」のスマホ用: 2 袋ずつの段（横スクロールはしない）。下に木の棚板 */
function Shelf({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="relative z-10 grid grid-cols-2 gap-x-4 px-1">{children}</div>
    </div>
  );
}

/** 産地の地図（S10「産地の地図」）: 地図 + 凡例 + 押した国の案内 + 飲んだ国の一覧 */
function WorldMapView({
  cups,
  selected,
  onSelect,
}: {
  cups: ReadonlyMap<string, number>;
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const visited = COUNTRY_SHELVES.filter((c) => (cups.get(c.key) ?? 0) > 0).sort(
    (a, b) => (cups.get(b.key) ?? 0) - (cups.get(a.key) ?? 0),
  );
  const others = Array.from(cups.keys()).filter((k) => k.startsWith('other:')).length;
  const sel = selected ? COUNTRY_SHELVES.find((c) => c.key === selected) : undefined;
  const selCups = sel ? (cups.get(sel.key) ?? 0) : 0;
  const q = (s: string) => encodeURIComponent(s);
  return (
    <div>
      <div className="-mx-5 md:-mx-8">
        <WorldMap cups={cups} selected={selected} onSelect={onSelect} className="md:rounded-[14px]" />
      </div>
      <div className="font-num text-muted-foreground mt-2 flex gap-3 text-[10px]">
        {MAP_LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <span
              className="inline-block size-2.5 rounded-[2px]"
              style={{ background: l.color }}
              aria-hidden
            />
            {l.label}
          </span>
        ))}
        <span className="ml-auto">点線はコーヒーベルト</span>
      </div>
      {sel && (
        <div className="bg-card border-border mt-3 rounded-[14px] border px-4 py-3" role="status">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-[17px]">{sel.ja}</h2>
            <button type="button" className="text-muted-foreground text-xs" onClick={() => onSelect(null)}>
              閉じる
            </button>
          </div>
          {selCups > 0 ? (
            <p className="text-muted-foreground mt-1 text-xs">
              {selCups} 杯。
              <Link href={'/' as Route} className="text-primary ml-1 underline-offset-2 hover:underline">
                生産国の棚で見る
              </Link>
            </p>
          ) : (
            <>
              <p className="text-muted-foreground mt-1 text-xs">
                まだ飲んでいません。飲んだら、ここが塗られます。
              </p>
              <div className="mt-2.5 flex flex-col gap-2">
                <AppButton
                  width="auto"
                  size="md"
                  href={`https://www.google.com/maps/search/?api=1&query=${q(`${sel.ja} コーヒー`)}` as Route}
                  target="_blank"
                  rel="noopener"
                >
                  {sel.ja}の豆を飲める店を近くで探す
                </AppButton>
                <AppButton
                  width="auto"
                  size="md"
                  variant="secondary"
                  href={`https://www.google.com/search?q=${q(`${sel.ja} コーヒー豆 通販`)}` as Route}
                  target="_blank"
                  rel="noopener"
                >
                  {sel.ja}の豆を買う
                </AppButton>
              </div>
            </>
          )}
        </div>
      )}
      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-num text-[30px] leading-none font-extrabold">{visited.length}</span>
        <span className="font-num text-muted-foreground text-[13px] font-semibold">
          / {COUNTRY_SHELVES.length} か国
        </span>
        {others > 0 && <span className="text-muted-foreground text-xs">· 地図に無い産地 {others}</span>}
        <span className="text-muted-foreground ml-auto text-[11px]">杯数の多い順</span>
      </div>
      <ul className="mt-2" aria-label="飲んだ産地">
        {visited.map((c) => (
          <li key={c.key} className="border-border flex items-center gap-2.5 border-b py-2 text-sm">
            <span className="bg-primary inline-block size-2.5 rounded-full" aria-hidden />
            <button type="button" className="text-left" onClick={() => onSelect(c.key)}>
              {c.ja}
            </button>
            <span className="font-num text-muted-foreground ml-auto text-xs">{cups.get(c.key)} 杯</span>
          </li>
        ))}
      </ul>
    </div>
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
  const farm = useMemo(() => buildFarm(logs.data ?? []), [logs.data]);
  const cups = useMemo(() => cupsByCountry(logs.data ?? []), [logs.data]);
  // 産地の地図で押した国（?c=）。塗られた国なら杯数、塗られていない国なら「飲める店を探す / 豆を買う」の出口
  const selectedCountry = params.get('c');

  function replaceQuery(next: { s?: CollectionView; o?: CollectionSort; c?: string | null }) {
    const v = next.s ?? view;
    const o = next.o ?? sort;
    const c = next.c === undefined ? selectedCountry : next.c;
    const sp = new URLSearchParams();
    if (v !== 'country') sp.set('s', v);
    if (v === 'all' && o !== 'recent') sp.set('o', o);
    if (v === 'map' && c) sp.set('c', c);
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
        {/* これまでに記録した杯数を大きく（2026-09-25）。0 杯でも「0 杯」と出す */}
        {logs.data && (
          <p
            className="mt-2.5 flex items-baseline gap-1.5"
            aria-label={`これまでに ${logs.data.length} 杯を記録`}
          >
            <span className="font-num text-[44px] leading-none font-bold tracking-tight">
              {logs.data.length}
            </span>
            <span className="text-base font-bold">杯</span>
            <span className="text-muted-foreground ml-1 text-xs">これまでに記録したコーヒー</span>
          </p>
        )}
        <p className="text-muted-foreground font-num mt-1.5 text-xs">
          {logs.data
            ? byCountry
              ? `${items.length} 種類の豆 · ${byCountry.total} の${view === 'variety' ? '品種' : '産地'}のうち ${byCountry.visited} を制覇`
              : `${items.length} 種類の豆`
            : ' '}
        </p>
      </div>

      {/* コーヒーの木: 飲んだ産地ごとに 1 本。杯数で育ち、直近 30 日に飲んだ国には花（ADR 0012） */}
      {logs.data && items.length > 0 && (
        <section aria-label="コーヒーの木" className="-mx-5 mb-5 md:-mx-8">
          <CoffeeFarm farm={farm} className="md:rounded-[14px]" />
          <p className="text-muted-foreground font-num mt-2 px-5 text-[11px] md:px-8">
            {`木 ${farm.trees.length} 本 = 飲んだ産地`}
            {farm.flowering > 0 ? ` · 花はこの 30 日に飲んだ国（${farm.flowering} 本）` : ''}
            {farm.trees.some((t) => t.cherries > 0) ? ' · 実はその国の杯数' : ''}
          </p>
        </section>
      )}

      {logs.isPending && (
        <div role="status" aria-busy="true" aria-label="読み込み中" className="grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-[3/4.3] rounded-[5px_5px_14px_14px]" />
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
          {/* 空の棚板を 1 枚置いて、その下に案内を出す */}
          <div className="h-8" aria-hidden />
          <WoodPlank className="mb-6" />
          <EmptyState
            icon={Package}
            title="まだ記録がありません"
            description={
              <span className="mx-auto block max-w-[21em]">
                記録した豆がここに並びます。カードを撮れば、豆の名前や生産国は自動で入ります。
              </span>
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
              <ShelfRow count={Math.max(shelf.items.length, 1)} label={shelf.title}>
                {shelf.items.length > 0
                  ? shelf.items.map((item) => <BeanBag key={item.beanId} item={item} />)
                  : [<BeanBagEmpty key="empty" label={shelf.title} sub={shelf.sub} />]}
              </ShelfRow>
              <div className="h-8" />
            </section>
          ))}
        </>
      )}

      {logs.data && items.length > 0 && view === 'map' && (
        <>
          {chips}
          <WorldMapView cups={cups} selected={selectedCountry} onSelect={(c) => replaceQuery({ c })} />
        </>
      )}

      {logs.data && items.length > 0 && !byCountry && view !== 'map' && (
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
                <WoodPlank className="mb-8" />
              </div>
            ))}
          </div>
          <div className="hidden md:block">
            <div className="grid grid-cols-3 gap-x-5 gap-y-10 xl:grid-cols-4">
              {items.map((item) => (
                <div key={item.beanId}>
                  <BeanBag item={item} />
                  <WoodPlank className="mx-0 md:mx-0" />
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
