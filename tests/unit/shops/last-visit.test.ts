import { describe, expect, it } from 'vitest';
import { lastLogByShop } from '@/features/logs/aggregate';
import {
  formatLastVisit,
  formatVisitDate,
  shopVisitInfo,
  sortByRecentVisit,
} from '@/features/shops/last-visit';
import { shopRowSubtitle, sortShopRows, type ShopRow } from '@/features/shops/presenters';

// 店ごとの振り返り（F-SHOP-8、#42）。前回の一杯・よく行く順・最近行った順。
const NOW = new Date('2026-10-19T00:00:00Z');
const row = (id: string, shop_id: string | null, logged_on: string, extra: object = {}) => ({
  id,
  shop_id,
  logged_on,
  rating: 4.5,
  bean: { name: `豆${id}` },
  ...extra,
});

describe('lastLogByShop', () => {
  it('店ごとに日付が最も新しい記録を 1 件選び、店の無い記録は数えない', () => {
    const m = lastLogByShop([
      row('a', 's1', '2026-09-01'),
      row('b', 's1', '2026-10-05'),
      row('c', 's2', '2026-08-01', { rating: null }),
      row('d', null, '2026-10-10'),
    ]);
    expect(m.get('s1')).toEqual({ logId: 'b', loggedOn: '2026-10-05', beanName: '豆b', rating: 4.5 });
    expect(m.get('s2')?.rating).toBeNull();
    expect(m.size).toBe(2);
  });
  it('同じ日付なら作成が新しい方。豆が取れなければ豆名は空', () => {
    const m = lastLogByShop([
      row('a', 's1', '2026-10-05', { created_at: '2026-10-05T01:00:00Z' }),
      row('b', 's1', '2026-10-05', { created_at: '2026-10-05T09:00:00Z', bean: null }),
    ]);
    expect(m.get('s1')).toMatchObject({ logId: 'b', beanName: '' });
  });
  it('記録が無ければ空', () => expect(lastLogByShop([]).size).toBe(0));
});

describe('formatLastVisit', () => {
  const last = { logId: 'x', loggedOn: '2026-10-05', beanName: 'El Paraiso Lychee', rating: 5 };
  it('「前回 10/05 · 豆名 ★5.0」。今年でなければ年を付ける。星なし・前回なしは省く', () => {
    expect(formatLastVisit(last, NOW)).toBe('前回 10/05 · El Paraiso Lychee ★5.0');
    expect(formatLastVisit({ ...last, loggedOn: '2025-12-31' }, NOW)).toBe(
      '前回 2025/12/31 · El Paraiso Lychee ★5.0',
    );
    expect(formatLastVisit({ ...last, rating: null }, NOW)).toBe('前回 10/05 · El Paraiso Lychee');
    expect(formatLastVisit(undefined, NOW)).toBeNull();
    expect(formatVisitDate('bad', NOW)).toBe('bad');
  });
  it('shopVisitInfo は回数・前回・並べ替え用の日付をまとめる', () => {
    expect(shopVisitInfo({ count: 3, avgRating: 4 }, last, NOW)).toEqual({
      lastVisit: '前回 10/05 · El Paraiso Lychee ★5.0',
      visitCount: 3,
      lastLoggedOn: '2026-10-05',
    });
    expect(shopVisitInfo(undefined, undefined, NOW)).toEqual({
      lastVisit: null,
      visitCount: 0,
      lastLoggedOn: null,
    });
  });
});

describe('並び順', () => {
  it('sortByRecentVisit: 新しい順、記録の無い店は後ろで元の順を保つ', () => {
    const r = sortByRecentVisit([
      { n: 'none1', lastLoggedOn: null },
      { n: 'old', lastLoggedOn: '2026-01-01' },
      { n: 'new', lastLoggedOn: '2026-10-01' },
      { n: 'none2' },
    ]);
    expect(r.map((x) => x.n)).toEqual(['new', 'old', 'none1', 'none2']);
  });

  const mk = (name: string, count: number, loggedOn: string | null): ShopRow =>
    ({
      id: name,
      name,
      kind: 'cafe',
      kindLabel: 'カフェ',
      address: null,
      area: '台東区',
      lat: null,
      lng: null,
      hasCoordinates: false,
      count,
      avgRating: null,
      distanceM: null,
      last: loggedOn ? { logId: name, loggedOn, beanName: '豆', rating: 4 } : null,
    }) as ShopRow;
  const rows = [
    mk('A', 1, '2026-10-19'),
    mk('B', 5, '2026-01-01'),
    mk('C', 5, '2026-06-01'),
    mk('D', 0, null),
  ];

  it('よく行く順: 回数 → 最近 → 名前。最近行った順: 前回の日付、記録なしは最後', () => {
    expect(sortShopRows(rows, 'frequency').map((r) => r.name)).toEqual(['C', 'B', 'A', 'D']);
    expect(sortShopRows(rows, 'recent').map((r) => r.name)).toEqual(['A', 'C', 'B', 'D']);
  });

  it('一覧の 2 行目: 記録あり = 「3 回 · 前回 10/19 豆」、記録なし = 「種別 · 市区」。距離は先頭', () => {
    expect(shopRowSubtitle({ ...rows[0]!, count: 3 }, NOW)).toBe('3 回 · 前回 10/19 · 豆');
    expect(shopRowSubtitle({ ...rows[0]!, count: 3, distanceM: 120 }, NOW)).toBe(
      '120 m · 3 回 · 前回 10/19 · 豆',
    );
    expect(shopRowSubtitle(rows[3]!, NOW)).toBe('カフェ · 台東区');
  });
});
