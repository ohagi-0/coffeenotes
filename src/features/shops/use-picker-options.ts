'use client';

import { useMemo } from 'react';
import { useLastLogByShop, useRatingStats } from '@/features/logs/queries';
import { shopVisitInfo } from '@/features/shops/last-visit';
import type { Shop } from '@/features/shops/queries';
import type { ShopPickerOption } from '@/components/shops/shop-picker';

/**
 * 店を選ぶ部品（検索シート・選択中カード）に渡す「登録済みの店」。前回の記録と回数を足す（F-SHOP-8）。
 * 前回・回数が読み込み中・失敗でも店は選べる（その場合は「前回」を出さないだけ）。
 */
export function useShopPickerOptions(shops: readonly Shop[] | undefined): ShopPickerOption[] {
  const stats = useRatingStats();
  const last = useLastLogByShop();
  return useMemo(
    () =>
      (shops ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address,
        externalPlaceId: s.external_place_id,
        ...shopVisitInfo(stats.data?.byShop.get(s.id), last.data?.get(s.id)),
      })),
    [shops, stats.data, last.data],
  );
}
