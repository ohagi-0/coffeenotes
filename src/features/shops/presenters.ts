import type { LastLog, RatingStat } from '@/features/logs/aggregate';
import { formatLastVisit } from '@/features/shops/last-visit';
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
  /** 店の出どころと地図サービス側の ID（Google の店は place_id でリンクする） */
  placeProvider?: string | null;
  externalPlaceId?: string | null;
  /** 前回の記録（F-SHOP-8）。記録が無い・まだ読み込めていなければ null */
  last?: LastLog | null;
};

export type ShopSort = 'name' | 'rating' | 'distance' | 'frequency' | 'recent';

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

export function toShopRow(shop: Shop, stat: RatingStat | undefined, last?: LastLog): ShopRow {
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
    placeProvider: shop.place_provider,
    externalPlaceId: shop.external_place_id,
    last: last ?? null,
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
  } else if (sort === 'frequency') {
    // よく行く順: 回数の多い順 → 最近行った順 → 名前
    copy.sort(
      (a, b) =>
        b.count - a.count ||
        (b.last?.loggedOn ?? '').localeCompare(a.last?.loggedOn ?? '') ||
        a.name.localeCompare(b.name, 'ja'),
    );
  } else if (sort === 'recent') {
    // 最近行った順: 前回の日付が新しい順。記録の無い店は最後に名前順
    copy.sort(
      (a, b) =>
        (b.last?.loggedOn ?? '').localeCompare(a.last?.loggedOn ?? '') || a.name.localeCompare(b.name, 'ja'),
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

/** Google マップで開く URL。Google の店は place_id で、そうでなければ座標、無ければ店名と住所で検索する。どれも無ければ null */
export function googleMapsUrl(shop: {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  placeProvider?: string | null;
  externalPlaceId?: string | null;
  place_provider?: string | null;
  external_place_id?: string | null;
}): string | null {
  const base = 'https://www.google.com/maps/search/?api=1&query=';
  const provider = shop.placeProvider ?? shop.place_provider;
  const placeId = shop.externalPlaceId ?? shop.external_place_id;
  if (provider === 'google' && placeId) {
    return `${base}${encodeURIComponent(shop.name)}&query_place_id=${encodeURIComponent(placeId)}`;
  }
  if (shop.lat != null && shop.lng != null) return `${base}${shop.lat},${shop.lng}`;
  const q = [shop.name, shop.address].filter((v): v is string => !!v && v.trim() !== '').join(' ');
  return q ? `${base}${encodeURIComponent(q)}` : null;
}

/**
 * 記録のある店と無い店に分ける（F-SHOP-1/5、#43）。記録の有無は byShop（店 ID → 件数）で判定する。
 * byShop がまだ無い（読み込み中・失敗）ときは全部「ある」にして、一覧が消えないようにする。
 * 生豆販売店は焙煎バッチから参照されるので、keepGreenBeanShops のとき（「生豆」チップ）は記録が無くても「ある」側に置く。
 */
export function splitShopsByActivity<T extends { id: string; kind: string | null }>(
  shops: readonly T[],
  byShop: ReadonlyMap<string, { count: number }> | undefined,
  opts: { keepGreenBeanShops?: boolean } = {},
): { active: T[]; inactive: T[] } {
  if (!byShop) return { active: [...shops], inactive: [] };
  const active: T[] = [];
  const inactive: T[] = [];
  for (const s of shops) {
    const has = (byShop.get(s.id)?.count ?? 0) > 0;
    const keep = has || (!!opts.keepGreenBeanShops && s.kind === 'green_bean_shop');
    (keep ? active : inactive).push(s);
  }
  return { active, inactive };
}

/**
 * 店の一覧の 2 行目（F-SHOP-8）。記録のある店は「3 回 · 前回 10/19 豆名」（狭いので種別と区は省く）、
 * 記録の無い店は従来どおり「種別 · 距離か市区」。現在地が分かっていれば距離を先頭に足す
 */
export function shopRowSubtitle(row: ShopRow, now: Date = new Date()): string {
  const distance = formatDistance(row.distanceM);
  if (row.count > 0) {
    const last = row.last ? formatLastVisit(row.last, now)?.replace(/ ★[\d.]+$/, '') : null;
    return [distance, `${row.count} 回`, last].filter(Boolean).join(' · ');
  }
  return [row.kindLabel, distance ?? row.area].filter(Boolean).join(' · ');
}

/** 一覧の距離表示。「120 m」「1.4 km」 */
export function formatDistance(m: number | null | undefined): string | null {
  if (m === null || m === undefined) return null;
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}
