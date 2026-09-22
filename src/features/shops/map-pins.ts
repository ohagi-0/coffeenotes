// 地図のピン（S7、F-MAP-3）。平均星で 4 段階 + 星なしの色分け。純粋関数で、地図部品とテストから使う。

export type PinTier = 'none' | 'low' | 'mid' | 'high' | 'top';

/** 平均星 → 段階。null は星なし */
export function pinTier(avgRating: number | null | undefined): PinTier {
  if (avgRating === null || avgRating === undefined) return 'none';
  if (avgRating >= 4.5) return 'top';
  if (avgRating >= 4) return 'high';
  if (avgRating >= 3) return 'mid';
  return 'low';
}

/** DESIGN.md §2.1 の色。銅の濃淡で段階を表し、星なしは --mute */
export const PIN_COLORS: Record<PinTier, string> = {
  none: '#6A5B4E',
  low: '#8F4D1F',
  mid: '#B4632A',
  high: '#D48C4E',
  top: '#F0B57A',
};

export const PIN_LEGEND: { tier: PinTier; label: string }[] = [
  { tier: 'top', label: '4.5 以上' },
  { tier: 'high', label: '4.0〜' },
  { tier: 'mid', label: '3.0〜' },
  { tier: 'low', label: '3.0 未満' },
  { tier: 'none', label: '星なし' },
];

/** ピンの中の文字色。明るい銅には濃い文字 */
export function pinTextColor(tier: PinTier): string {
  return tier === 'top' || tier === 'high' ? '#17120F' : '#F1E8DA';
}

export interface MapShop {
  id: string;
  name: string;
  kind: string | null;
  address: string | null;
  lat: number;
  lng: number;
  count: number;
  avgRating: number | null;
}

/** 座標のある店だけを地図用に変換する */
export function toMapShops<
  T extends {
    id: string;
    name: string;
    kind: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
  },
>(
  shops: readonly T[],
  stats: ReadonlyMap<string, { count: number; avgRating: number | null }> | undefined,
): MapShop[] {
  const out: MapShop[] = [];
  for (const s of shops) {
    if (s.lat === null || s.lng === null) continue;
    const st = stats?.get(s.id);
    out.push({
      id: s.id,
      name: s.name,
      kind: s.kind,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      count: st?.count ?? 0,
      avgRating: st?.avgRating ?? null,
    });
  }
  return out;
}

/** 地図の初期中心。店が無ければ東京駅 */
export const DEFAULT_CENTER = { lat: 35.6812, lng: 139.7671 };
export function initialCenter(shops: readonly { lat: number; lng: number }[]): { lat: number; lng: number } {
  if (shops.length === 0) return DEFAULT_CENTER;
  const lat = shops.reduce((a, s) => a + s.lat, 0) / shops.length;
  const lng = shops.reduce((a, s) => a + s.lng, 0) / shops.length;
  return { lat, lng };
}
