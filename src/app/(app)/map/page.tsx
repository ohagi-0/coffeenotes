'use client';

import { Suspense, useMemo, useState } from 'react';
import type { Route } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LocateFixed, Store } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { EmptyState } from '@/components/empty-state';
import { ErrorCallout } from '@/components/error-callout';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { RatingStars } from '@/components/logs/rating-stars';
import { PinLegend } from '@/components/map/pin-legend';
import { Row } from '@/components/row';
import { Skeleton } from '@/components/ui/skeleton';
import { useLogsByShop, useRatingStats } from '@/features/logs/queries';
import { initialCenter, toMapShops, type MapShop } from '@/features/shops/map-pins';
import { shopKindLabel } from '@/features/shops/presenters';
import { useShops } from '@/features/shops/queries';
import { distanceM } from '@/lib/geo';
import { PlatformGeolocationError, getCurrentPosition } from '@/lib/platform/geolocation';
import { useOnline } from '@/lib/platform/network';
import { routes } from '@/lib/routes';

// S7 記録したお店のマップ（F-MAP-1〜4、F-SHOP-7）。選択中の店は ?shop= に持つ（ADR 0008）。
// 地図は SSR 不可なので dynamic。座標の無い店は出さない（一覧にだけ出る）。

const ShopMap = dynamic(() => import('@/components/map/shop-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-[300px] w-full rounded-[14px]" />,
});

function formatDistance(m: number | null): string | null {
  if (m === null) return null;
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

function MapInner() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('shop');
  const shops = useShops();
  const stats = useRatingStats();
  const online = useOnline();
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const mapShops = useMemo(() => toMapShops(shops.data ?? [], stats.data?.byShop), [shops.data, stats.data]);
  const selected = mapShops.find((s) => s.id === selectedId) ?? null;
  const selectedLogs = useLogsByShop(selected?.id ?? null);
  const beanNames = useMemo(
    () => Array.from(new Set((selectedLogs.data ?? []).map((l) => l.bean.name))).slice(0, 8),
    [selectedLogs.data],
  );
  const ordered = useMemo(() => {
    const withDistance = mapShops.map((s) => ({ ...s, d: userPos ? distanceM(userPos, s) : null }));
    return userPos
      ? withDistance.sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
      : withDistance.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [mapShops, userPos]);
  const center = useMemo(
    () => (selected ? { lat: selected.lat, lng: selected.lng } : initialCenter(mapShops)),
    [selected, mapShops],
  );

  function select(id: string) {
    router.replace(`${routes.map}?shop=${encodeURIComponent(id)}` as Route, { scroll: false });
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
          ? '位置情報が許可されていません。端末の設定で許可すると、現在地へ移動できます。'
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

  const noCoords = (shops.data ?? []).length - mapShops.length;

  return (
    <div className="pb-2">
      <div className="flex items-end justify-between pt-2 pb-3">
        <div>
          <h1 className="text-2xl font-bold">記録したお店のマップ</h1>
          <p className="text-muted-foreground font-num text-xs">
            {shops.data ? `座標のある店 ${mapShops.length}${noCoords ? ` · 座標なし ${noCoords}` : ''}` : ' '}
          </p>
        </div>
        <Link href={routes.shops} className="text-primary text-[13px] font-medium">
          お店の一覧へ
        </Link>
      </div>

      {!online && (
        <p
          role="status"
          className="border-border bg-card text-muted-foreground mb-3 rounded-[12px] border px-3.5 py-2 text-xs"
        >
          オフラインです。地図のタイルは表示できないことがあります。
        </p>
      )}

      {shops.isPending && (
        <div role="status" aria-busy="true" aria-label="読み込み中" className="flex flex-col gap-3">
          <Skeleton className="h-[300px] w-full rounded-[14px]" />
          <Skeleton className="h-20 w-full rounded-[14px]" />
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

      {!shops.isPending && !shops.error && mapShops.length === 0 && (
        <EmptyState
          icon={Store}
          title="座標のある店がまだありません"
          description="店を登録するときに「店名で検索」か「地図で指定」で位置を入れると、ここに出ます。"
          action={<AppButton href={`${routes.shops}?new=1` as Route}>お店を登録</AppButton>}
        />
      )}

      {!shops.isPending && !shops.error && mapShops.length > 0 && (
        <>
          <ShopMap
            shops={mapShops}
            selectedId={selectedId}
            onSelect={select}
            onLongPress={onLongPress}
            center={center}
            zoom={selected ? 15 : 12}
            userLocation={userPos}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <PinLegend />
            <AppButton
              variant="ghost"
              size="sm"
              width="auto"
              onClick={locate}
              loading={locating}
              aria-label="現在地へ移動"
            >
              <LocateFixed aria-hidden />
              現在地
            </AppButton>
          </div>
          {locError && (
            <p role="alert" className="text-destructive mt-1 text-xs">
              {locError}
            </p>
          )}
          <p className="text-muted-foreground mt-1 text-[11px]">
            地図を長押し（PC は右クリック）すると、その場所に店を登録できます。
          </p>

          {selected && (
            <SelectedShopCard shop={selected} beanNames={beanNames} pending={selectedLogs.isPending} />
          )}

          <section className="mt-5" aria-label={userPos ? '近い順の店' : '店の一覧'}>
            <h2 className="mb-1 text-[13px] font-bold">{userPos ? '近い順' : '店の一覧'}</h2>
            {ordered.map((s) => (
              <Row
                key={s.id}
                initial={s.name.slice(0, 1)}
                title={s.name}
                subtitle={[shopKindLabel(s.kind), formatDistance(s.d), `${s.count} 回`]
                  .filter(Boolean)
                  .join(' · ')}
                onClick={() => select(s.id)}
                className={
                  s.id === selectedId ? 'bg-card -mx-3 rounded-xl border-b-transparent px-3' : undefined
                }
              />
            ))}
          </section>
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
  shop: MapShop;
  beanNames: string[];
  pending: boolean;
}) {
  return (
    <div className="border-primary bg-card mt-3 rounded-[14px] border p-3.5" aria-label="選択中の店">
      <p className="text-base font-bold">{shop.name}</p>
      <p className="text-muted-foreground text-xs">
        {[shopKindLabel(shop.kind), shop.address, `${shop.count} 回`].filter(Boolean).join(' · ')}
      </p>
      <div className="mt-2">
        <RatingStars value={shop.avgRating} size="md" aria-label="平均星" />
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
          店の詳細
        </AppButton>
        <AppButton size="md" href={routes.newLog}>
          ここで記録
        </AppButton>
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<FullScreenLoading />}>
      <MapInner />
    </Suspense>
  );
}
