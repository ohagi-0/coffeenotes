'use client';

import dynamic from 'next/dynamic';
import type { ShopMapProps } from '@/components/map/map-types';
import { Skeleton } from '@/components/ui/skeleton';
import { getPublicEnv } from '@/lib/env';

// 店の地図の出し分け（ADR 0011）。NEXT_PUBLIC_MAP_PROVIDER=google なら Google マップ、osm（既定）なら Leaflet + OSM。
// どちらも SSR 不可（window を使う）ので dynamic で読み込む。呼び出し側はここを import する。
const loading = () => <Skeleton className="h-[300px] w-full rounded-[14px]" />;
const LeafletShopMap = dynamic(() => import('@/components/map/shop-map'), { ssr: false, loading });
const GoogleShopMap = dynamic(() => import('@/components/map/google-shop-map'), { ssr: false, loading });

export function ShopMapSwitch(props: ShopMapProps) {
  return getPublicEnv().NEXT_PUBLIC_MAP_PROVIDER === 'google' ? (
    <GoogleShopMap {...props} />
  ) : (
    <LeafletShopMap {...props} />
  );
}
