'use client';

import { Suspense, useMemo, useState } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorCallout } from '@/components/error-callout';
import { FilterChips, type FilterChip } from '@/components/filter-chips';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { ShopForm } from '@/components/shops/shop-form';
import { ShopList } from '@/components/shops/shop-list';
import { geocodePlace, searchNearbyPlaces } from '@/features/geo/search';
import { useRatingStats } from '@/features/logs/queries';
import { useCreateShop } from '@/features/shops/mutations';
import { sortShopRows, toShopRow, type ShopSort } from '@/features/shops/presenters';
import { useShops } from '@/features/shops/queries';
import type { ShopKind } from '@/lib/schemas/shop';
import { routes } from '@/lib/routes';

// S6 記録したお店（F-SHOP-1/2/5/6）。?new=1 で登録フォームをページ内に出す（動的セグメントは使わない。ADR 0008）。
// 絞り込みチップの値: all / cafe / roaster / green_bean_shop / rating（評価順）

const CHIPS: FilterChip[] = [
  { value: 'all', label: 'すべて' },
  { value: 'cafe', label: 'カフェ' },
  { value: 'roaster', label: 'ロースター' },
  { value: 'green_bean_shop', label: '生豆' },
  { value: 'rating', label: '評価順' },
];
const KINDS: ShopKind[] = ['cafe', 'roaster', 'green_bean_shop', 'other'];

function ShopsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const showNew = params.get('new') === '1';
  // 地図の長押しから来たときは ?lat&lng に座標が入っている（F-SHOP-7）
  const presetLat = Number(params.get('lat'));
  const presetLng = Number(params.get('lng'));
  const preset =
    params.get('lat') && params.get('lng') && Number.isFinite(presetLat) && Number.isFinite(presetLng)
      ? { lat: presetLat, lng: presetLng }
      : undefined;
  const chip = params.get('f') ?? 'all';
  const [search, setSearch] = useState('');

  const kind = KINDS.includes(chip as ShopKind) ? (chip as ShopKind) : undefined;
  const sort: ShopSort = chip === 'rating' ? 'rating' : 'name';
  const shops = useShops({ kind, search: search.trim() || undefined });
  const stats = useRatingStats();
  const createShop = useCreateShop();

  const rows = useMemo(
    () =>
      sortShopRows(
        (shops.data ?? []).map((s) => toShopRow(s, stats.data?.byShop.get(s.id))),
        sort,
      ),
    [shops.data, stats.data, sort],
  );
  const noCoords = rows.filter((r) => !r.hasCoordinates).length;
  const newHref = `${routes.shops}?new=1` as Route;

  function setChip(value: string) {
    router.replace((value === 'all' ? pathname : `${pathname}?f=${encodeURIComponent(value)}`) as Route, {
      scroll: false,
    });
  }

  if (showNew) {
    return (
      <div className="pb-2">
        <h1 className="pt-2 pb-3 text-2xl font-bold">お店を登録</h1>
        {createShop.error && (
          <ErrorCallout
            title="登録できませんでした"
            what={createShop.error.message}
            next="入力は残っています。もう一度お試しください。"
            className="mb-4"
          />
        )}
        <ShopForm
          defaultValues={preset}
          candidates={{
            nearby: (pos) => searchNearbyPlaces(pos),
            geocode: (query, near) => geocodePlace({ query, near }),
          }}
          submitting={createShop.isPending}
          onSubmit={(values) =>
            createShop.mutate(values, {
              onSuccess: (shop) => {
                toast.success('登録しました');
                router.replace(routes.shop(shop.id) as Route);
              },
            })
          }
        />
      </div>
    );
  }

  return (
    <div className="pb-2">
      <div className="flex items-end justify-between pt-2 pb-3">
        <div>
          <h1 className="text-2xl font-bold">記録したお店</h1>
          <p className="text-muted-foreground font-num text-xs">
            {shops.data ? `${shops.data.length} 店${noCoords ? ` · 座標なし ${noCoords}` : ''}` : ' '}
          </p>
        </div>
        <a href={newHref} className="text-primary text-[13px] font-medium">
          ＋ お店を登録
        </a>
      </div>
      <label className="border-border bg-card text-muted-foreground mb-2.5 flex h-12 items-center gap-2 rounded-xl border px-3.5 text-sm">
        <Search className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="店名で探す"
          aria-label="店名で探す"
          className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>
      <FilterChips chips={CHIPS} value={chip} onChange={setChip} />
      <ShopList
        rows={rows}
        isPending={shops.isPending}
        error={shops.error}
        onRetry={() => void shops.refetch()}
        filtered={chip !== 'all' || search.trim() !== ''}
        onClearFilter={() => {
          setSearch('');
          setChip('all');
        }}
        newHref={newHref}
      />
    </div>
  );
}

export default function ShopsPage() {
  return (
    <Suspense fallback={<FullScreenLoading />}>
      <ShopsInner />
    </Suspense>
  );
}
