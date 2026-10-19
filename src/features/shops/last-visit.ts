import type { RatingStat, LastLog } from '@/features/logs/aggregate';

// 店ごとの振り返り（F-SHOP-8）の表示用。「前回 10/05 · El Paraiso Lychee ★5.0」の 1 行を作る純粋関数。

/** 'YYYY-MM-DD' → '10/05'。今年でなければ '2025/10/05' */
export function formatVisitDate(loggedOn: string, now: Date = new Date()): string {
  const [y, m, d] = loggedOn.split('-');
  if (!y || !m || !d) return loggedOn;
  return Number(y) === now.getFullYear() ? `${m}/${d}` : `${y}/${m}/${d}`;
}

/** 「前回 10/05 · El Paraiso Lychee ★5.0」。豆名・星が無ければ省く。前回が無ければ null */
export function formatLastVisit(last: LastLog | null | undefined, now: Date = new Date()): string | null {
  if (!last) return null;
  const parts = [`前回 ${formatVisitDate(last.loggedOn, now)}`, last.beanName || null].filter(
    Boolean,
  ) as string[];
  const text = parts.join(' · ');
  return last.rating !== null ? `${text} ★${last.rating.toFixed(1)}` : text;
}

/** 店を選ぶ部品（検索シート・選択中カード）に渡す、店ごとの訪問情報 */
export type ShopVisitInfo = {
  /** 「前回 …」の 1 行。記録が無ければ null */
  lastVisit: string | null;
  /** 記録の回数 */
  visitCount: number;
  /** 最近行った順に並べる用（YYYY-MM-DD）。記録が無ければ null */
  lastLoggedOn: string | null;
};

export function shopVisitInfo(
  stat: RatingStat | undefined,
  last: LastLog | undefined,
  now: Date = new Date(),
): ShopVisitInfo {
  return {
    lastVisit: formatLastVisit(last, now),
    visitCount: stat?.count ?? 0,
    lastLoggedOn: last?.loggedOn ?? null,
  };
}

/** 最近行った順（記録の無い店は後ろ。同じ日付・記録なし同士は元の順を保つ） */
export function sortByRecentVisit<T extends { lastLoggedOn?: string | null }>(items: readonly T[]): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const x = a.item.lastLoggedOn ?? '';
      const y = b.item.lastLoggedOn ?? '';
      if (x === y) return a.i - b.i;
      return x < y ? 1 : -1;
    })
    .map(({ item }) => item);
}
