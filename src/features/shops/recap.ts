import { frontImagePath } from '@/features/beans/images';
import {
  MIN_ROWS_FOR_TRENDS,
  HIGH_RATING,
  tasteAverages,
  type CountItem,
  type StatsRow,
  type TasteAverages,
} from '@/features/stats/aggregate';

// 店詳細（S6 の詳細）を「この店で何を飲んできたか」の振り返りにする集計（F-MAP-2 拡張、#44）。
// 記録の配列（useLogsByShop の結果）から、ベスト・豆ごと・傾向を出す純粋関数。画面は結果を描くだけ。

/** 振り返りに必要な記録の列（LogWithRelations が満たす） */
export interface RecapLog {
  id: string;
  logged_on: string;
  created_at?: string | null;
  rating: number | null;
  memo?: string | null;
  bean: {
    id: string;
    name: string;
    roaster: { name: string } | null;
    flavor_notes: string[];
    bean_images?: readonly { side: string; storage_path: string }[] | null;
    taste_flavor: number | null;
    taste_sweetness: number | null;
    taste_acidity: number | null;
    taste_aftertaste: number | null;
    taste_body: number | null;
  };
  log_tags: readonly { tag: { name: string } | null }[];
}

export interface ShopBest {
  logId: string;
  beanId: string;
  beanName: string;
  roasterName: string | null;
  rating: number;
  loggedOn: string;
  imagePath: string | null;
}

/** 豆ごとのまとめ（この店で飲んだ回数、平均星、最後の日付） */
export interface ShopBeanRecap {
  beanId: string;
  beanName: string;
  roasterName: string | null;
  count: number;
  avgRating: number | null;
  lastOn: string;
  flavorNotes: string[];
}

export interface ShopTrend {
  /** 星付きの記録のうち星 4 以上の割合（0〜1） */
  highRatio: number;
  /** 星付きの記録の数（割合の分母） */
  ratedCount: number;
  topTags: CountItem[];
  taste: TasteAverages;
}

export interface ShopRecap {
  count: number;
  /** 初回・前回（YYYY-MM-DD）。記録が無ければ null */
  firstOn: string | null;
  lastOn: string | null;
  avgRating: number | null;
  /** この店のベスト。記録が 2 件以上のときだけ（1 件ならそれが全部なので出さない） */
  best: ShopBest | null;
  beans: ShopBeanRecap[];
  /** 傾向。記録が MIN_ROWS_FOR_TRENDS 件以上のときだけ */
  trend: ShopTrend | null;
}

/** 新しい順（日付 → 作成の新しい方）。同点の比較に使う */
function isNewer(
  a: Pick<RecapLog, 'logged_on' | 'created_at'>,
  b: Pick<RecapLog, 'logged_on' | 'created_at'>,
) {
  return a.logged_on !== b.logged_on
    ? a.logged_on > b.logged_on
    : (a.created_at ?? '') > (b.created_at ?? '');
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function shopRecap(logs: readonly RecapLog[]): ShopRecap {
  if (logs.length === 0) {
    return { count: 0, firstOn: null, lastOn: null, avgRating: null, best: null, beans: [], trend: null };
  }
  const dates = logs.map((l) => l.logged_on).sort();
  const rated = logs.filter((l): l is RecapLog & { rating: number } => l.rating !== null);

  // ベスト: 星が最も高い記録。同点なら新しい方
  let bestLog: (RecapLog & { rating: number }) | null = null;
  for (const l of rated) {
    if (!bestLog || l.rating > bestLog.rating || (l.rating === bestLog.rating && isNewer(l, bestLog))) {
      bestLog = l;
    }
  }
  const best: ShopBest | null =
    logs.length >= 2 && bestLog
      ? {
          logId: bestLog.id,
          beanId: bestLog.bean.id,
          beanName: bestLog.bean.name,
          roasterName: bestLog.bean.roaster?.name ?? null,
          rating: bestLog.rating,
          loggedOn: bestLog.logged_on,
          imagePath: frontImagePath(bestLog.bean.bean_images),
        }
      : null;

  // 豆ごと: 回数の多い順 → 最後に飲んだ日が新しい順 → 名前
  const byBean = new Map<string, RecapLog[]>();
  for (const l of logs) (byBean.get(l.bean.id) ?? byBean.set(l.bean.id, []).get(l.bean.id)!).push(l);
  const beans: ShopBeanRecap[] = Array.from(byBean.values())
    .map((ls) => {
      const latest = ls.reduce((a, b) => (isNewer(b, a) ? b : a));
      return {
        beanId: latest.bean.id,
        beanName: latest.bean.name,
        roasterName: latest.bean.roaster?.name ?? null,
        count: ls.length,
        avgRating: avg(ls.map((l) => l.rating).filter((r): r is number => r !== null)),
        lastOn: latest.logged_on,
        flavorNotes: latest.bean.flavor_notes
          .map((f) => f.trim())
          .filter(Boolean)
          .slice(0, 3),
      };
    })
    .sort(
      (a, b) =>
        b.count - a.count || b.lastOn.localeCompare(a.lastOn) || a.beanName.localeCompare(b.beanName, 'ja'),
    );

  // 傾向（3 件以上）: 星 4 以上の割合、よく付けるタグ上位 3 つ、味覚の平均（豆ごとに 1 回。好みの分析と同じ集計）
  let trend: ShopTrend | null = null;
  if (logs.length >= MIN_ROWS_FOR_TRENDS) {
    const tagCounts = new Map<string, number>();
    for (const l of logs) {
      for (const t of l.log_tags) {
        const name = t.tag?.name.trim();
        if (name) tagCounts.set(name, (tagCounts.get(name) ?? 0) + 1);
      }
    }
    const sorted = Array.from(tagCounts, ([label, count]) => ({ label, count })).sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ja'),
    );
    const max = sorted[0]?.count ?? 0;
    const statsRows: StatsRow[] = logs.map((l) => ({
      logged_on: l.logged_on,
      rating: l.rating,
      shop_id: null,
      bean: {
        id: l.bean.id,
        country: null,
        process: null,
        roast_level: null,
        flavor_notes: l.bean.flavor_notes,
        taste_flavor: l.bean.taste_flavor,
        taste_sweetness: l.bean.taste_sweetness,
        taste_acidity: l.bean.taste_acidity,
        taste_aftertaste: l.bean.taste_aftertaste,
        taste_body: l.bean.taste_body,
      },
    }));
    trend = {
      highRatio: rated.length ? rated.filter((l) => l.rating >= HIGH_RATING).length / rated.length : 0,
      ratedCount: rated.length,
      topTags: sorted
        .slice(0, 3)
        .map((x) => ({ ...x, percent: max ? Math.round((x.count / max) * 100) : 0 })),
      taste: tasteAverages(statsRows, false),
    };
  }

  return {
    count: logs.length,
    firstOn: dates[0]!,
    lastOn: dates[dates.length - 1]!,
    avgRating: avg(rated.map((l) => l.rating)),
    best,
    beans,
    trend,
  };
}

/** 'YYYY-MM-DD' → '2026.04'（初回の表示） */
export function formatYearMonth(on: string): string {
  const [y, m] = on.split('-');
  return y && m ? `${y}.${m}` : on;
}

/** 'YYYY-MM-DD' → '10.19'。今年でなければ '2025.12.31'（前回の表示） */
export function formatMonthDay(on: string, now: Date = new Date()): string {
  const [y, m, d] = on.split('-');
  if (!y || !m || !d) return on;
  return Number(y) === now.getFullYear() ? `${m}.${d}` : `${y}.${m}.${d}`;
}

/** 見出しの 1 行「12 回 · 初回 2026.04 · 前回 10.19」。記録が無ければ null */
export function recapHeadline(
  r: Pick<ShopRecap, 'count' | 'firstOn' | 'lastOn'>,
  now: Date = new Date(),
): string | null {
  if (r.count === 0 || !r.firstOn || !r.lastOn) return null;
  return [
    `${r.count} 回`,
    `初回 ${formatYearMonth(r.firstOn)}`,
    `前回 ${formatMonthDay(r.lastOn, now)}`,
  ].join(' · ');
}

/** 月ごとにまとめる（入力の順を保つ。訪問の記録の小見出し用） */
export function groupByMonth<T extends { loggedOn: string }>(
  items: readonly T[],
): { month: string; label: string; items: T[] }[] {
  const groups: { month: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const month = item.loggedOn.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.items.push(item);
    else {
      const [y, m] = month.split('-');
      groups.push({ month, label: `${y}年${Number(m)}月`, items: [item] });
    }
  }
  return groups;
}
