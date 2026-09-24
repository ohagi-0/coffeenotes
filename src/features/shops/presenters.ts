import type { RatingStat } from '@/features/logs/aggregate';
import { distanceM } from '@/lib/geo';
import { SHOP_KIND_LABELS, type ShopKind } from '@/lib/schemas/shop';
import type { Shop } from './queries';

// 店一覧（S6）の表示用。DB の行 + 集計を平らな型にし、絞り込み・並び替えもここで行う（純粋関数）。

export type ShopRow = {
  id: string;
  name: string;
  kind: string | null;
  kindLabel: string | null;
  address: string | null;
  /** 住所から市区までを抜いた短い表記（無ければ null） */
  area: string | null;
  lat: number | null;
  lng: number | null;
  hasCoordinates: boolean;
  count: number;
  avgRating: number | null;
  /** 現在地からの距離（m）。現在地が無い・座標が無い店は null */
  distanceM: number | null;
};

export type ShopSort = 'name' | 'rating' | 'distance';

export type ShopRowFilter = {
  kind?: ShopKind;
  /** 店名・住所の部分一致（大文字小文字を区別しない） */
  query?: string;
};

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
    kind: shop.kind,
    kindLabel: shopKindLabel(shop.kind),
    address: shop.address,
    area: shortArea(shop.address),
    lat: shop.lat,
    lng: shop.lng,
    hasCoordinates: shop.lat !== null && shop.lng !== null,
    count: stat?.count ?? 0,
    avgRating: stat?.avgRating ?? null,
    distanceM: null,
  };
}

/** 現在地からの距離を付ける。現在地が無ければそのまま */
export function withDistance(
  rows: readonly ShopRow[],
  from: { lat: number; lng: number } | null | undefined,
): ShopRow[] {
  if (!from) return [...rows];
  return rows.map((r) =>
    r.lat !== null && r.lng !== null ? { ...r, distanceM: distanceM(from, { lat: r.lat, lng: r.lng }) } : r,
  );
}

export function matchesShopQuery(row: Pick<ShopRow, 'name' | 'address'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return row.name.toLowerCase().includes(q) || (row.address ?? '').toLowerCase().includes(q);
}

/** 種別と検索語で絞る（順序は保つ） */
export function filterShopRows(rows: readonly ShopRow[], filter: ShopRowFilter): ShopRow[] {
  return rows.filter(
    (r) => (!filter.kind || r.kind === filter.kind) && matchesShopQuery(r, filter.query ?? ''),
  );
}

export function sortShopRows(rows: readonly ShopRow[], sort: ShopSort): ShopRow[] {
  const copy = [...rows];
  if (sort === 'rating') {
    copy.sort(
      (a, b) =>
        (b.avgRating ?? -1) - (a.avgRating ?? -1) || b.count - a.count || a.name.localeCompare(b.name, 'ja'),
    );
  } else if (sort === 'distance') {
    // 距離が分からない店（座標なし・現在地なし）は最後に名前順
    copy.sort(
      (a, b) =>
        (a.distanceM ?? Number.POSITIVE_INFINITY) - (b.distanceM ?? Number.POSITIVE_INFINITY) ||
        a.name.localeCompare(b.name, 'ja'),
    );
  } else {
    copy.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }
  return copy;
}

/** Google マップで開く URL。座標があれば座標、無ければ店名と住所で検索する。どちらも無ければ null */
export function googleMapsUrl(shop: {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}): string | null {
  const base = 'https://www.google.com/maps/search/?api=1&query=';
  if (shop.lat != null && shop.lng != null) return `${base}${shop.lat},${shop.lng}`;
  const q = [shop.name, shop.address].filter((v): v is string => !!v && v.trim() !== '').join(' ');
  return q ? `${base}${encodeURIComponent(q)}` : null;
}

/** 一覧の距離表示。「120 m」「1.4 km」 */
export function formatDistance(m: number | null | undefined): string | null {
  if (m === null || m === undefined) return null;
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}
