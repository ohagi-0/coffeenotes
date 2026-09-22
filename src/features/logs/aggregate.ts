// 記録から豆ごと・店ごとの「回数と平均星」を出す純粋関数。
// Phase 1 はクライアント側で集計する（Issue #5 の方針）。件数が増えて遅くなったら DB ビュー化を検討。

export interface RatingRow {
  bean_id: string;
  shop_id: string | null;
  rating: number | null;
  roast_id?: string | null;
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
  /** 焙煎バッチごと（F-ROAST-8） */
  byRoast: Map<string, RatingStat>;
} {
  const bean = new Map<string, (number | null)[]>();
  const shop = new Map<string, (number | null)[]>();
  const roast = new Map<string, (number | null)[]>();
  for (const r of rows) {
    (bean.get(r.bean_id) ?? bean.set(r.bean_id, []).get(r.bean_id)!).push(r.rating);
    if (r.shop_id) (shop.get(r.shop_id) ?? shop.set(r.shop_id, []).get(r.shop_id)!).push(r.rating);
    if (r.roast_id) (roast.get(r.roast_id) ?? roast.set(r.roast_id, []).get(r.roast_id)!).push(r.rating);
  }
  return {
    byBean: new Map(Array.from(bean, ([k, v]) => [k, summarize(v)])),
    byShop: new Map(Array.from(shop, ([k, v]) => [k, summarize(v)])),
    byRoast: new Map(Array.from(roast, ([k, v]) => [k, summarize(v)])),
  };
}

/** 自宅レシピの列（F-BREW-1〜6）。前回の複製とフォームの折りたたみ判定で使う */
export const RECIPE_KEYS = [
  'brew_method',
  'grinder',
  'grind_setting',
  'dose_g',
  'water_g',
  'water_temp_c',
  'brew_time_sec',
  'recipe_memo',
] as const;
export type RecipeKey = (typeof RECIPE_KEYS)[number];
export type RecipeValues = {
  brew_method: string | null;
  grinder: string | null;
  grind_setting: string | null;
  dose_g: number | null;
  water_g: number | null;
  water_temp_c: number | null;
  brew_time_sec: number | null;
  recipe_memo: string | null;
};

/** 記録にレシピ列が 1 つでも入っているか */
export function hasRecipe(log: Partial<RecipeValues> | null | undefined): boolean {
  if (!log) return false;
  return RECIPE_KEYS.some((k) => log[k] !== null && log[k] !== undefined && log[k] !== '');
}

/**
 * 同じ豆の直近の自宅記録からレシピを取り出す（F-BREW-7「前回のレシピを複製」）。
 * 記録は新しい順で渡す。自宅でレシピのある最初の記録を返し、無ければ null
 */
export function latestRecipe<T extends Partial<RecipeValues> & { place: string }>(
  logs: readonly T[],
): RecipeValues | null {
  const hit = logs.find((l) => l.place === 'home' && hasRecipe(l));
  if (!hit) return null;
  return {
    brew_method: hit.brew_method ?? null,
    grinder: hit.grinder ?? null,
    grind_setting: hit.grind_setting ?? null,
    dose_g: hit.dose_g ?? null,
    water_g: hit.water_g ?? null,
    water_temp_c: hit.water_temp_c ?? null,
    brew_time_sec: hit.brew_time_sec ?? null,
    recipe_memo: hit.recipe_memo ?? null,
  };
}
