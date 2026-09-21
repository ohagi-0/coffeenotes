import type { LogListItemProps } from '@/components/logs/log-list-item';
import type { LogFilters, LogWithRelations } from './queries';

// DB の行（LogWithRelations）を表示用の平らな型に変換する純関数（Issue #17 段階 2）。
// 画面コンポーネントは DB の形を知らない。

export type TimelineItem = Omit<LogListItemProps, 'className'> & {
  /** YYYY-MM-DD。日付見出しでのグループ化に使う */
  loggedOn: string;
  /** PC の 2 ペインで右に出す豆（テストの手作りデータでは省略可） */
  beanId?: string;
};

/** 豆量と湯量から「1:15」の形を作る。どちらか無ければ null */
export function formatBrewRatio(doseG: number | null, waterG: number | null): string | null {
  if (!doseG || !waterG || doseG <= 0) return null;
  const ratio = waterG / doseG;
  const rounded = Math.round(ratio * 10) / 10;
  return `1:${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}`;
}

/** 行の補足（飲み方、レシピの要約）。自宅なら器具 · 比率 · 湯温、店なら飲み方だけ */
export function formatLogDetail(log: LogWithRelations): string | null {
  const parts: string[] = [];
  if (log.brew_method) parts.push(log.brew_method);
  if (log.place === 'home') {
    const ratio = formatBrewRatio(log.dose_g, log.water_g);
    if (ratio) parts.push(ratio);
    if (log.water_temp_c !== null) parts.push(`${log.water_temp_c} ℃`);
  }
  return parts.length ? parts.join(' · ') : null;
}

export function toTimelineItem(log: LogWithRelations): TimelineItem {
  return {
    id: log.id,
    loggedOn: log.logged_on,
    beanId: log.bean.id,
    beanName: log.bean.name,
    roasterName: log.bean.roaster?.name ?? null,
    country: log.bean.country,
    rating: log.rating,
    place: log.place === 'home' ? 'home' : 'shop',
    shopName: log.shop?.name ?? null,
    detail: formatLogDetail(log),
    flavorNotes: [],
    // カード画像は Phase 2（F-BEAN-12）で署名付き URL に置き換える。それまでは印刷物風のプレースホルダ
    imageSrc: null,
  };
}

export type TimelineGroup = { date: string; items: TimelineItem[] };

/** 並んだ配列を日付ごとにまとめる（順序は入力のまま。useLogs は日付降順で返す） */
export function groupByDate(items: readonly TimelineItem[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.loggedOn) last.items.push(item);
    else groups.push({ date: item.loggedOn, items: [item] });
  }
  return groups;
}

/**
 * S2 の絞り込みチップの値（URL の ?f=）を useLogs の条件に変換する。
 * all / rating4 / home / shop / country:<国> / process:<精製>
 */
export function chipToFilters(value: string): LogFilters {
  if (value === 'rating4') return { minRating: 4 };
  if (value === 'home') return { place: 'home' };
  if (value === 'shop') return { place: 'shop' };
  if (value.startsWith('country:')) return { country: value.slice('country:'.length) };
  if (value.startsWith('process:')) return { process: value.slice('process:'.length) };
  return {};
}
