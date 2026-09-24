// 豆のコレクション（S10「棚」）の集計。記録の配列から、飲んだ豆を 1 袋ずつにまとめる純粋関数。
// 画面は結果を「棚に並んだ袋」として描くだけ。

export type CollectionSourceLog = {
  id: string;
  logged_on: string;
  rating: number | null;
  place: string;
  bean: {
    id: string;
    name: string;
    country: string | null;
    process?: string | null;
    variety?: string | null;
    roaster?: { name: string } | null;
    bean_images?: { side: string; storage_path: string }[] | null;
  };
  shop?: { name: string } | null;
};

export interface CollectionItem {
  beanId: string;
  name: string;
  roasterName: string | null;
  country: string | null;
  process: string | null;
  variety: string | null;
  /** 表面のカード画像（Storage のパス）。無ければ印刷物風のプレースホルダ */
  imagePath: string | null;
  /** 飲んだ回数 */
  count: number;
  /** 星の平均（小数 1 桁）。星付きが無ければ null */
  avgRating: number | null;
  /** 最後に飲んだ日と場所（店名、自宅なら「自宅」、不明なら null） */
  lastLoggedOn: string;
  lastPlace: string | null;
  lastLogId: string;
}

/** 見せ方（?s=）。country / variety は棚に分け、all は全部の豆を 1 本に並べる */
export type CollectionView = 'country' | 'variety' | 'all';
export const COLLECTION_VIEW_CHIPS: { value: CollectionView; label: string }[] = [
  { value: 'country', label: '生産国の棚' },
  { value: 'variety', label: '品種の棚' },
  { value: 'all', label: 'すべての豆' },
];

/** 「すべての豆」の並び順（?o=）。棚の中は常に最近飲んだ順 */
export type CollectionSort = 'recent' | 'rating' | 'count';
export const COLLECTION_SORT_CHIPS: { value: CollectionSort; label: string }[] = [
  { value: 'recent', label: '最近飲んだ順' },
  { value: 'rating', label: '星が高い順' },
  { value: 'count', label: 'よく飲む順' },
];

export function isCollectionView(v: string | null): v is CollectionView {
  return COLLECTION_VIEW_CHIPS.some((c) => c.value === v);
}
export function isCollectionSort(v: string | null): v is CollectionSort {
  return COLLECTION_SORT_CHIPS.some((c) => c.value === v);
}

/** 記録を豆ごとにまとめる。入力の順序に依存せず、最後に飲んだ日を決める */
export function buildCollection(logs: readonly CollectionSourceLog[]): CollectionItem[] {
  const byBean = new Map<string, { item: CollectionItem; ratings: number[] }>();
  for (const l of logs) {
    const place = l.place === 'home' ? '自宅' : (l.shop?.name ?? null);
    const front = l.bean.bean_images?.find((i) => i.side === 'front')?.storage_path ?? null;
    const hit = byBean.get(l.bean.id);
    if (!hit) {
      byBean.set(l.bean.id, {
        ratings: l.rating === null ? [] : [l.rating],
        item: {
          beanId: l.bean.id,
          name: l.bean.name,
          roasterName: l.bean.roaster?.name ?? null,
          country: l.bean.country,
          process: l.bean.process ?? null,
          variety: l.bean.variety ?? null,
          imagePath: front,
          count: 1,
          avgRating: null,
          lastLoggedOn: l.logged_on,
          lastPlace: place,
          lastLogId: l.id,
        },
      });
      continue;
    }
    hit.item.count += 1;
    if (l.rating !== null) hit.ratings.push(l.rating);
    if (!hit.item.imagePath && front) hit.item.imagePath = front;
    if (l.logged_on > hit.item.lastLoggedOn) {
      hit.item.lastLoggedOn = l.logged_on;
      hit.item.lastPlace = place;
      hit.item.lastLogId = l.id;
    }
  }
  return Array.from(byBean.values()).map(({ item, ratings }) => ({
    ...item,
    avgRating: ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null,
  }));
}

export function sortCollection(items: readonly CollectionItem[], sort: CollectionSort): CollectionItem[] {
  const copy = [...items];
  switch (sort) {
    case 'rating':
      copy.sort(
        (a, b) =>
          (b.avgRating ?? -1) - (a.avgRating ?? -1) ||
          b.count - a.count ||
          b.lastLoggedOn.localeCompare(a.lastLoggedOn),
      );
      break;
    case 'count':
      copy.sort((a, b) => b.count - a.count || b.lastLoggedOn.localeCompare(a.lastLoggedOn));
      break;
    default:
      copy.sort((a, b) => b.lastLoggedOn.localeCompare(a.lastLoggedOn) || a.name.localeCompare(b.name, 'ja'));
  }
  return copy;
}

// ---- 生産国の棚（S10「生産国の棚」モード） ----
// 主要な生産国（src/lib/vocab/countries.ts）を固定で並べ、まだ飲んでいない国は空き棚として見せる（コレクションの「埋まっていない枠」）。
// 表記ゆれは語彙側の aliases で吸収し、どれにも当たらない国名はその名前で棚を作る。

import { COUNTRY_SHELVES, countryKeyOf, VARIETY_SHELVES, varietyKeysOf } from '@/lib/vocab';

export { COUNTRY_SHELVES, countryKeyOf, VARIETY_SHELVES, varietyKeysOf };

/** 1 本の棚（生産国・品種で共通） */
export interface ShelfGroup {
  key: string;
  /** 見出し（日本語名。主要でない値はそのままの表記） */
  title: string;
  /** 見出しの右に添える英名など */
  sub: string | null;
  /** 空き棚のときに右端に出す補足（地域・系統） */
  note: string | null;
  items: CollectionItem[];
}

export interface ShelfGroups {
  shelves: ShelfGroup[];
  /** 主要な棚のうち、飲んだことのある数 */
  visited: number;
  total: number;
}

/** 生産国ごとの棚。主要国は地域順に固定で（空でも）並べ、そのあとにその他の国と「生産国なし」を続ける */
export function groupByCountry(items: readonly CollectionItem[]): ShelfGroups {
  const buckets = new Map<string, CollectionItem[]>();
  const unknown: CollectionItem[] = [];
  for (const it of items) {
    const k = countryKeyOf(it.country);
    if (k === null) {
      unknown.push(it);
      continue;
    }
    const arr = buckets.get(k) ?? [];
    arr.push(it);
    buckets.set(k, arr);
  }
  const shelves: ShelfGroup[] = COUNTRY_SHELVES.map((c) => ({
    key: c.key,
    title: c.ja,
    sub: c.en,
    note: c.region,
    items: buckets.get(c.key) ?? [],
  }));
  const visited = shelves.filter((s) => s.items.length > 0).length;
  const others = Array.from(buckets.entries())
    .filter(([k]) => k.startsWith('other:'))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, arr]) => ({ key: k, title: arr[0]!.country ?? k.slice(6), sub: null, note: null, items: arr }));
  const out = [...shelves, ...others];
  if (unknown.length > 0)
    out.push({ key: 'unknown', title: '生産国なし', sub: null, note: null, items: unknown });
  return { shelves: out, visited, total: COUNTRY_SHELVES.length };
}

// ---- 品種の棚（S10「品種の棚」モード） ----
// よくある品種（src/lib/vocab/varieties.ts）を固定で並べる。1 つの豆に「SL28, SL34」のように複数あれば両方の棚に置く。

/** 品種ごとの棚。主要品種は店で見る頻度の順に固定で（空でも）並べ、そのあとにその他と「品種なし」を続ける */
export function groupByVariety(items: readonly CollectionItem[]): ShelfGroups {
  const buckets = new Map<string, CollectionItem[]>();
  const unknown: CollectionItem[] = [];
  for (const it of items) {
    const keys = varietyKeysOf(it.variety);
    if (keys.length === 0) {
      unknown.push(it);
      continue;
    }
    for (const k of keys) {
      const arr = buckets.get(k) ?? [];
      arr.push(it);
      buckets.set(k, arr);
    }
  }
  const shelves: ShelfGroup[] = VARIETY_SHELVES.map((v) => ({
    key: v.key,
    title: v.name,
    sub: v.en,
    note: null,
    items: buckets.get(v.key) ?? [],
  }));
  const visited = shelves.filter((s) => s.items.length > 0).length;
  const others = Array.from(buckets.entries())
    .filter(([k]) => k.startsWith('other:'))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, arr]) => ({ key: k, title: k.slice(6), sub: null, note: null, items: arr }));
  const out = [...shelves, ...others];
  if (unknown.length > 0)
    out.push({ key: 'unknown', title: '品種なし', sub: null, note: null, items: unknown });
  return { shelves: out, visited, total: VARIETY_SHELVES.length };
}
