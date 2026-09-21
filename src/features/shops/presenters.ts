import type { RatingStat } from '@/features/logs/aggregate';
import { SHOP_KIND_LABELS, type ShopKind } from '@/lib/schemas/shop';
import type { Shop } from './queries';

// 店一覧（S6）の表示用。DB の行 + 集計を平らな型にし、並び替えもここで行う。

export type ShopRow = {
  id: string;
  name: string;
  kindLabel: string | null;
  /** 住所から市区までを抜いた短い表記（無ければ null） */
  area: string | null;
  hasCoordinates: boolean;
  count: number;
  avgRating: number | null;
};

export type ShopSort = 'name' | 'rating';

export function shopKindLabel(kind: string | null): string | null {
  return kind && kind in SHOP_KIND_LABELS ? SHOP_KIND_LABELS[kind as ShopKind] : null;
}

/** 「東京都台東区蔵前 3-1-2」→「台東区蔵前」。都道府県と番地を落とす。合わなければ先頭 12 文字 */
export function shortArea(address: string | null): string | null {
  if (!address) return null;
  const a = address.trim();
  if (!a) return null;
  const m = a.match(/^(?:.{2,3}?[都道府県])?(.+?[市区町村].*?)(?:[0-9０-９].*)?$/);
  const core = (m?.[1] ?? a).trim();
  return core.length > 14 ? `${core.slice(0, 12)}…` : core;
}

export function toShopRow(shop: Shop, stat: RatingStat | undefined): ShopRow {
  return {
    id: shop.id,
    name: shop.name,
    kindLabel: shopKindLabel(shop.kind),
    area: shortArea(shop.address),
    hasCoordinates: shop.lat !== null && shop.lng !== null,
    count: stat?.count ?? 0,
    avgRating: stat?.avgRating ?? null,
  };
}

export function sortShopRows(rows: readonly ShopRow[], sort: ShopSort): ShopRow[] {
  const copy = [...rows];
  if (sort === 'rating') {
    copy.sort(
      (a, b) =>
        (b.avgRating ?? -1) - (a.avgRating ?? -1) || b.count - a.count || a.name.localeCompare(b.name, 'ja'),
    );
  } else {
    copy.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }
  return copy;
}
