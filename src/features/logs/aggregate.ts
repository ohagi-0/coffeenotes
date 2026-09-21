// 記録から豆ごと・店ごとの「回数と平均星」を出す純粋関数。
// Phase 1 はクライアント側で集計する（Issue #5 の方針）。件数が増えて遅くなったら DB ビュー化を検討。

export interface RatingRow {
  bean_id: string;
  shop_id: string | null;
  rating: number | null;
}

export interface RatingStat {
  /** 記録の件数（星なしも含む） */
  count: number;
  /** 星の平均（小数 1 桁）。星付きの記録が無ければ null */
  avgRating: number | null;
}

function summarize(ratings: (number | null)[]): RatingStat {
  const rated = ratings.filter((r): r is number => r !== null);
  const avg = rated.length ? Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10 : null;
  return { count: ratings.length, avgRating: avg };
}

export function aggregateRatings(rows: readonly RatingRow[]): {
  byBean: Map<string, RatingStat>;
  byShop: Map<string, RatingStat>;
} {
  const bean = new Map<string, (number | null)[]>();
  const shop = new Map<string, (number | null)[]>();
  for (const r of rows) {
    (bean.get(r.bean_id) ?? bean.set(r.bean_id, []).get(r.bean_id)!).push(r.rating);
    if (r.shop_id) (shop.get(r.shop_id) ?? shop.set(r.shop_id, []).get(r.shop_id)!).push(r.rating);
  }
  return {
    byBean: new Map(Array.from(bean, ([k, v]) => [k, summarize(v)])),
    byShop: new Map(Array.from(shop, ([k, v]) => [k, summarize(v)])),
  };
}
