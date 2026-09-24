// 好みの分析（S8、F-STAT-1〜4）の集計。全部純粋関数で、画面は結果を描くだけ。
// 「高評価」= 星 4 以上（REQUIREMENTS.md UC5）。

export interface StatsRow {
  logged_on: string;
  rating: number | null;
  shop_id: string | null;
  bean: {
    id: string;
    country: string | null;
    process: string | null;
    /** light / medium / dark。表示名は BEAN_ROAST_LEVEL_LABELS */
    roast_level: string | null;
    flavor_notes: string[];
    taste_flavor: number | null;
    taste_sweetness: number | null;
    taste_acidity: number | null;
    taste_aftertaste: number | null;
    taste_body: number | null;
  };
}

export const HIGH_RATING = 4;
/** これ未満だと傾向を出さない（S8 の空状態） */
export const MIN_ROWS_FOR_TRENDS = 3;

export type StatsPeriod = 'all' | '1y' | '6m' | '3m';
export const PERIOD_CHIPS: { value: StatsPeriod; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: '1y', label: '1 年' },
  { value: '6m', label: '6 か月' },
  { value: '3m', label: '3 か月' },
];

function monthsAgo(now: Date, months: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, now.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

/** 期間で絞る（logged_on は YYYY-MM-DD の文字列比較でよい） */
export function filterByPeriod<T extends { logged_on: string }>(
  rows: readonly T[],
  period: StatsPeriod,
  now = new Date(),
): T[] {
  if (period === 'all') return [...rows];
  const from = monthsAgo(now, period === '1y' ? 12 : period === '6m' ? 6 : 3);
  return rows.filter((r) => r.logged_on >= from);
}

export interface Summary {
  logs: number;
  beans: number;
  shops: number;
  avgRating: number | null;
}

export function summarize(rows: readonly StatsRow[]): Summary {
  const rated = rows.map((r) => r.rating).filter((r): r is number => r !== null);
  return {
    logs: rows.length,
    beans: new Set(rows.map((r) => r.bean.id)).size,
    shops: new Set(rows.map((r) => r.shop_id).filter((s): s is string => !!s)).size,
    avgRating: rated.length ? Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10 : null,
  };
}

export interface CountItem {
  label: string;
  count: number;
  /** 最大値を 100 とした割合（横棒の幅） */
  percent: number;
}

function toCountItems(counts: Map<string, number>, limit: number): CountItem[] {
  const sorted = Array.from(counts, ([label, count]) => ({ label, count })).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ja'),
  );
  const max = sorted[0]?.count ?? 0;
  return sorted.slice(0, limit).map((x) => ({ ...x, percent: max ? Math.round((x.count / max) * 100) : 0 }));
}

/**
 * 高評価の記録に多い生産国 / 精製方法 / 焙煎度（F-STAT-2、F-BEAN-14）。同じ豆を何度飲んでも記録ごとに数える。
 * `labelOf` で表示名に変換できる（焙煎度の light → 浅煎り など）
 */
export function topHighRated(
  rows: readonly StatsRow[],
  field: 'country' | 'process' | 'roast_level',
  limit = 5,
  labelOf: (value: string) => string = (v) => v,
): CountItem[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.rating === null || r.rating < HIGH_RATING) continue;
    const v = r.bean[field]?.trim();
    if (!v) continue;
    const label = labelOf(v);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return toCountItems(counts, limit);
}

/** よく出るフレーバー（高評価の記録、豆ごとに 1 回ずつ数える） */
export function topFlavors(rows: readonly StatsRow[], limit = 12): CountItem[] {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.rating === null || r.rating < HIGH_RATING) continue;
    if (seen.has(r.bean.id)) continue;
    seen.add(r.bean.id);
    for (const f of r.bean.flavor_notes) {
      const v = f.trim();
      if (!v) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return toCountItems(counts, limit);
}

export interface TasteAverages {
  flavor: number | null;
  sweetness: number | null;
  acidity: number | null;
  aftertaste: number | null;
  body: number | null;
  /** 平均に使った豆の数 */
  beans: number;
}

/** 味覚チャートの平均（豆ごとに 1 回）。highOnly なら星 4 以上の記録がある豆だけ（F-STAT-3） */
export function tasteAverages(rows: readonly StatsRow[], highOnly: boolean): TasteAverages {
  const beans = new Map<string, StatsRow['bean']>();
  for (const r of rows) {
    if (highOnly && (r.rating === null || r.rating < HIGH_RATING)) continue;
    beans.set(r.bean.id, r.bean);
  }
  const axis = (
    key: 'taste_flavor' | 'taste_sweetness' | 'taste_acidity' | 'taste_aftertaste' | 'taste_body',
  ) => {
    const vals = Array.from(beans.values())
      .map((b) => b[key])
      .filter((v): v is number => v !== null);
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
  };
  return {
    flavor: axis('taste_flavor'),
    sweetness: axis('taste_sweetness'),
    acidity: axis('taste_acidity'),
    aftertaste: axis('taste_aftertaste'),
    body: axis('taste_body'),
    beans: beans.size,
  };
}

export interface MonthPoint {
  /** YYYY-MM */
  month: string;
  count: number;
  avgRating: number | null;
}

/** 月別の記録数と平均星（F-STAT-4）。直近 months か月、記録の無い月は 0 で埋める */
export function monthly(rows: readonly StatsRow[], months = 12, now = new Date()): MonthPoint[] {
  const buckets = new Map<string, (number | null)[]>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.set(d.toISOString().slice(0, 7), []);
  }
  for (const r of rows) {
    const m = r.logged_on.slice(0, 7);
    const b = buckets.get(m);
    if (b) b.push(r.rating);
  }
  return Array.from(buckets, ([month, ratings]) => {
    const rated = ratings.filter((x): x is number => x !== null);
    return {
      month,
      count: ratings.length,
      avgRating: rated.length
        ? Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10
        : null,
    };
  });
}
