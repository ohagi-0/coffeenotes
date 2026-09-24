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

export type CollectionSort = 'recent' | 'rating' | 'count';
export const COLLECTION_SORT_CHIPS: { value: CollectionSort; label: string }[] = [
  { value: 'recent', label: '最近飲んだ順' },
  { value: 'rating', label: '星が高い順' },
  { value: 'count', label: 'よく飲む順' },
];

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
