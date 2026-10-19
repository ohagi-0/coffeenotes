'use client';

import { useEffect, useRef } from 'react';
import { getPlaceDetails } from '@/features/geo/search';
import { useUpdateShop } from '@/features/shops/mutations';
import { isStaleGoogleShop } from '@/features/shops/refresh-google-shops';
import type { Shop } from '@/features/shops/queries';

/**
 * 店詳細を開いたとき、Google の店の写しが 30 日より古ければその場で取り直す（週次ジョブの保険。ADR 0011）。
 * 1 つの店につき 1 回だけ試し、失敗しても表示は続ける（消滅・移転の扱いはジョブに任せる）。
 */
export function useLazyRefreshGoogleShop(shop: Shop | null | undefined): void {
  const update = useUpdateShop();
  const tried = useRef<string | null>(null);
  const { mutate } = update;

  useEffect(() => {
    if (!shop || tried.current === shop.id || !isStaleGoogleShop(shop, new Date())) return;
    if (!shop.external_place_id) return;
    tried.current = shop.id;
    getPlaceDetails({ placeId: shop.external_place_id })
      .then((place) => {
        if (!place) return;
        mutate({
          id: shop.id,
          name: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          place_synced_at: new Date().toISOString(),
        });
      })
      .catch(() => {});
  }, [shop, mutate]);
}
