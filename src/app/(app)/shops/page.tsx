'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, LocateFixed, Search, Store } from 'lucide-react';
import { toast } from 'sonner';
import { AppButton } from '@/components/app-button';
import { EmptyState } from '@/components/empty-state';
import { ErrorCallout } from '@/components/error-callout';
import { FilterChips, type FilterChip } from '@/components/filter-chips';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { RatingStars } from '@/components/logs/rating-stars';
import { PinLegend } from '@/components/map/pin-legend';
import { InactiveShops } from '@/components/shops/inactive-shops';
import { ShopForm } from '@/components/shops/shop-form';
import { ShopList } from '@/components/shops/shop-list';
import { Skeleton } from '@/components/ui/skeleton';
import { ShopMapSwitch } from '@/components/map/shop-map-switch';
import { geocodePlace, searchNearbyPlaces, shopCandidateSources } from '@/features/geo/search';
import { useLastLogByShop, useLogsByShop, useRatingStats } from '@/features/logs/queries';
import { formatLastVisit } from '@/features/shops/last-visit';
import { initialCenter, toMapShops } from '@/features/shops/map-pins';
import { useCreateShop } from '@/features/shops/mutations';
import {
  filterShopRows,
  googleMapsUrl,
  sortShopRows,
  splitShopsByActivity,
  toShopRow,
  withDistance,
  type ShopRow,
  type ShopSort,
} from '@/features/shops/presenters';
import { useShops } from '@/features/shops/queries';
import { PlatformGeolocationError, getCurrentPosition } from '@/lib/platform/geolocation';
import { useOnline } from '@/lib/platform/network';
import { routes } from '@/lib/routes';
import type { ShopKind } from '@/lib/schemas/shop';

// S6 記録したお店（F-SHOP-1/2/5/6 + F-MAP-1〜4、F-SHOP-7）。地図と一覧を 1 画面にまとめる（2026-09-24）:
// 上に検索欄と絞り込みチップ、その下に 300px の地図（座標のある店のピン）、選んだ店のカード、店の一覧。
// 選択中の店は ?shop= に持つ（ADR 0008）。?new=1 で登録フォームをページ内に出す（動的セグメントは使わない）。
// 旧 /map はここへリダイレクトする。
// チップの値: all / cafe / roaster / green_bean_shop / often（よく行く順）/ recent（最近行った順）/ rating（評価順）/ near（近い順。現在地を取る）

const CHIPS: FilterChip[] = [
  { value: 'all', label: 'すべて' },
  { value: 'cafe', label: 'カフェ' },
  { value: 'roaster', label: 'ロースター' },
  { value: 'green_bean_shop', label: '生豆' },
  { value: 'often', label: 'よく行く順' },
  { value: 'recent', label: '最近行った順' },
  { value: 'rating', label: '評価順' },
  { value: 'near', label: '近い順' },
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
  const selectedId = params.get('shop');
  const [search, setSearch] = useState('');
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  /** 検索語に合う登録済みの店が地図に無いとき、その語の場所を引いて地図を寄せる（登録済みではない） */
  const [focus, setFocus] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [focusMiss, setFocusMiss] = useState<string | null>(null);

  const kind = KINDS.includes(chip as ShopKind) ? (chip as ShopKind) : undefined;
  const sort: ShopSort =
    chip === 'rating'
      ? 'rating'
      : chip === 'near'
        ? 'distance'
        : chip === 'often'
          ? 'frequency'
          : chip === 'recent'
            ? 'recent'
            : 'name';
  // 店は全件を 1 回取り、絞り込みは手元で行う（入力のたびに往復しない。地図のピンも同じ集合から）
  const shops = useShops();
  const stats = useRatingStats();
  // 前回の記録（F-SHOP-8）。取れなくても一覧は出す（「前回」を出さないだけ）
  const lastLogs = useLastLogByShop();
  const online = useOnline();
  const createShop = useCreateShop();

  const allRows = useMemo(
    () =>
      withDistance(
        (shops.data ?? []).map((s) => toShopRow(s, stats.data?.byShop.get(s.id), lastLogs.data?.get(s.id))),
        userPos,
      ),
    [shops.data, stats.data, lastLogs.data, userPos],
  );
  // 記録のある店だけを一覧・地図・件数に出し、記録の無い店は最下部の折りたたみへ（#43）。
  // 生豆販売店は「生豆」チップのときだけ、記録が無くても一覧に出す（焙煎バッチから参照されるため）
  const { active: activeRows, inactive: inactiveRows } = useMemo(
    () =>
      splitShopsByActivity(filterShopRows(allRows, { kind, query: search }), stats.data?.byShop, {
        keepGreenBeanShops: kind === 'green_bean_shop',
      }),
    [allRows, kind, search, stats.data],
  );
  const rows = useMemo(() => sortShopRows(activeRows, sort), [activeRows, sort]);
  // 見出しの件数も記録のある店だけ数える（全件・絞り込み前）
  const activeAll = useMemo(
    () => splitShopsByActivity(allRows, stats.data?.byShop).active,
    [allRows, stats.data],
  );
  const mapShops = useMemo(
    () =>
      toMapShops(
        rows
          .filter((r) => !stats.data || r.count > 0) // 生豆販売店（記録なし）は地図に出さない。集計が取れるまでは絞らない
          .map((r) => ({
            id: r.id,
            name: r.name,
            kind: r.kind,
            address: r.address,
            lat: r.lat,
            lng: r.lng,
          })),
        stats.data?.byShop,
      ),
    [rows, stats.data],
  );
  const selected = allRows.find((r) => r.id === selectedId) ?? null;
  const selectedLogs = useLogsByShop(selected?.id ?? null);
  const beanNames = useMemo(
    () => Array.from(new Set((selectedLogs.data ?? []).map((l) => l.bean.name))).slice(0, 8),
    [selectedLogs.data],
  );
  const center = useMemo(
    () =>
      selected?.lat != null && selected.lng != null
        ? { lat: selected.lat, lng: selected.lng }
        : initialCenter(mapShops),
    [selected, mapShops],
  );
  const noCoords = activeAll.filter((r) => !r.hasCoordinates).length;

  const searchTerm = search.trim();
  const needFocus = searchTerm.length >= 2 && mapShops.length === 0 && !shops.isPending;
  useEffect(() => {
    if (!needFocus) {
      setFocus(null);
      setFocusMiss(null);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      geocodePlace({ query: searchTerm, near: userPos ?? undefined })
        .then((c) => {
          if (!active) return;
          const first = c[0];
          setFocus(first ? { lat: first.lat, lng: first.lng, label: first.name } : null);
          setFocusMiss(first ? null : searchTerm);
        })
        .catch(() => {
          if (!active) return;
          setFocus(null);
          setFocusMiss(searchTerm);
        });
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [needFocus, searchTerm, userPos]);
  const filtered = chip !== 'all' || search.trim() !== '';
  const newHref = `${routes.shops}?new=1` as Route;

  function replaceQuery(next: Record<string, string | null>) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') q.delete(k);
      else q.set(k, v);
    }
    const qs = q.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route, { scroll: false });
  }
  function setChip(value: string) {
    replaceQuery({ f: value === 'all' ? null : value });
    if (value === 'near' && !userPos) void locate();
  }
  function select(id: string) {
    replaceQuery({ shop: id === selectedId ? null : id });
  }
  async function locate() {
    setLocating(true);
    setLocError(null);
    try {
      const p = await getCurrentPosition({ timeoutMs: 8000 });
      setUserPos({ lat: p.lat, lng: p.lng });
    } catch (e) {
      setLocError(
        e instanceof PlatformGeolocationError && e.kind === 'permission-denied'
          ? '位置情報が許可されていません。許可すると、距離と近い順が使えます。'
          : e instanceof Error
            ? e.message
            : '現在地を取得できませんでした',
      );
    } finally {
      setLocating(false);
    }
  }
  function onLongPress(pos: { lat: number; lng: number }) {
    router.push(`${routes.shops}?new=1&lat=${pos.lat.toFixed(6)}&lng=${pos.lng.toFixed(6)}` as Route);
  }

  if (showNew) {
    return (
      <div className="pb-2">
        <h1 className="pt-5 pb-4 text-2xl font-bold">お店を登録</h1>
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
            ...shopCandidateSources,
            nearby: (pos) => searchNearbyPlaces(pos),
          }}
          submitting={createShop.isPending}
          onSubmit={(values) =>
            createShop.mutate(values, {
              onSuccess: (shop) => {
                toast.success(shop.created ? '登録しました' : 'すでに登録済みの店です。その店を開きました');
                router.replace(routes.shop(shop.id) as Route);
              },
            })
          }
        />
      </div>
    );
  }

  const hasAny = (shops.data ?? []).length > 0;

  return (
    <div className="pb-2">
      <div className="flex items-end justify-between pt-5 pb-4">
        <div>
          <h1 className="text-2xl font-bold">記録したお店</h1>
          <p className="text-muted-foreground font-num mt-1.5 text-xs">
            {shops.data
              ? `${activeAll.length} 店 · 地図に ${activeAll.length - noCoords}${noCoords ? ` · 座標なし ${noCoords}` : ''}`
              : ' '}
          </p>
        </div>
        <a href={newHref} className="text-primary text-[13px] font-medium">
          ＋ お店を登録
        </a>
      </div>

      {hasAny && (
        <>
          <label className="border-border bg-card text-muted-foreground mb-2.5 flex h-12 items-center gap-2 rounded-xl border px-3.5 text-sm">
            <Search className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="店名・住所で探す"
              aria-label="店名・住所で探す"
              className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none"
            />
          </label>
          <FilterChips chips={CHIPS} value={chip} onChange={setChip} className="mb-2" />
        </>
      )}

      {!online && (
        <p
          role="status"
          className="border-border bg-card text-muted-foreground mb-3 rounded-[12px] border px-3.5 py-2 text-xs"
        >
          オフラインです。地図は表示できないことがあります。
        </p>
      )}

      {shops.isPending && (
        <div role="status" aria-busy="true" aria-label="読み込み中" className="flex flex-col gap-3">
          <Skeleton className="h-[300px] w-full rounded-[14px]" />
          <Skeleton className="h-16 w-full rounded-[14px]" />
          <Skeleton className="h-16 w-full rounded-[14px]" />
        </div>
      )}

      {shops.error && (
        <ErrorCallout
          title="店を読み込めませんでした"
          what={shops.error.message}
          next="通信状態を確認して、もう一度読み込んでください。"
          onRetry={() => void shops.refetch()}
        />
      )}

      {!shops.isPending && !shops.error && !hasAny && (
        <EmptyState
          icon={Store}
          title="店はまだありません"
          description="記録するときに店を選ぶと、ここに並びます。"
          action={
            <AppButton width="auto" href={newHref}>
              お店を登録
            </AppButton>
          }
        />
      )}

      {!shops.isPending && !shops.error && hasAny && (
        <>
          {mapShops.length > 0 || focus ? (
            <>
              <ShopMapSwitch
                shops={mapShops}
                selectedId={selectedId}
                onSelect={select}
                onLongPress={onLongPress}
                center={focus ?? center}
                zoom={focus || selected?.hasCoordinates ? 15 : 12}
                userLocation={userPos}
                focus={focus}
              />
              {focus && (
                <p role="status" className="text-primary mt-2 text-[12px]">
                  登録済みの店に該当が無いので「{focus.label}
                  」付近を表示しています。長押しでここに店を登録できます。
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <PinLegend />
                <AppButton
                  variant="ghost"
                  size="sm"
                  width="auto"
                  onClick={() => void locate()}
                  loading={locating}
                  aria-label="現在地へ移動"
                >
                  <LocateFixed aria-hidden />
                  現在地
                </AppButton>
              </div>
              <p className="text-muted-foreground mt-1 text-[11px]">
                地図を長押し（PC は右クリック）すると、その場所に店を登録できます。
              </p>
            </>
          ) : (
            <p className="border-border bg-card text-muted-foreground rounded-[14px] border px-3.5 py-3 text-xs">
              {focusMiss
                ? `「${focusMiss}」に合う登録済みの店も、地図上の場所も見つかりませんでした。`
                : filtered
                  ? '条件に合う店に座標のあるものがありません。'
                  : '位置のある店がまだありません。店名で検索するか地図で指定して登録すると、ここに地図が出ます。'}
            </p>
          )}
          {locError && (
            <p role="alert" className="text-destructive mt-1 text-xs">
              {locError}
            </p>
          )}

          {selected && (
            <SelectedShopCard shop={selected} beanNames={beanNames} pending={selectedLogs.isPending} />
          )}

          <section className="mt-5" aria-label={sort === 'distance' ? '近い順の店' : '店の一覧'}>
            <h2 className="mb-1 text-[13px] font-bold">
              {sort === 'distance'
                ? '近い順'
                : sort === 'rating'
                  ? '評価順'
                  : sort === 'frequency'
                    ? 'よく行く順'
                    : sort === 'recent'
                      ? '最近行った順'
                      : '店の一覧'}
              <span className="text-muted-foreground font-num ml-2 text-[11px] font-normal">
                {rows.length} 店
              </span>
            </h2>
            <ShopList
              rows={rows}
              isPending={false}
              error={null}
              filtered={filtered}
              onClearFilter={() => {
                setSearch('');
                setChip('all');
              }}
              newHref={newHref}
              selectedId={selectedId}
              onSelect={select}
            />
          </section>
          <InactiveShops shops={inactiveRows} />
        </>
      )}
    </div>
  );
}

function SelectedShopCard({
  shop,
  beanNames,
  pending,
}: {
  shop: ShopRow;
  beanNames: string[];
  pending: boolean;
}) {
  return (
    <div className="border-primary bg-card mt-3 rounded-[14px] border p-3.5" aria-label="選択中の店">
      <p className="text-base font-bold">{shop.name}</p>
      <p className="text-muted-foreground text-xs">
        {[shop.kindLabel, shop.address, `${shop.count} 回`].filter(Boolean).join(' · ')}
        {!shop.hasCoordinates && (
          <span className="bg-secondary text-muted-foreground ml-2 rounded-[4px] px-[7px] text-[10px] leading-[1.7]">
            座標なし
          </span>
        )}
      </p>
      {formatLastVisit(shop.last) && (
        <p className="text-foreground mt-1 text-[12px]">{formatLastVisit(shop.last)}</p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <RatingStars value={shop.avgRating} size="md" aria-label="平均星" />
        {googleMapsUrl(shop) && (
          <a
            href={googleMapsUrl(shop)!}
            target="_blank"
            rel="noreferrer"
            className="text-primary flex h-9 items-center gap-1 text-[12px] font-medium"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Google マップで開く
          </a>
        )}
      </div>
      {pending ? (
        <Skeleton className="mt-2 h-5 w-40" />
      ) : beanNames.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="ここで飲んだ豆">
          {beanNames.map((b) => (
            <li key={b} className="bg-secondary rounded-[5px] px-2 text-[12px] leading-[1.9]">
              {b}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <AppButton variant="secondary" size="md" href={routes.shop(shop.id) as Route}>
          このお店での記録を見る
        </AppButton>
        <AppButton size="md" href={routes.newLog}>
          ここで記録
        </AppButton>
      </div>
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
