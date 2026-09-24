import { describe, expect, it } from 'vitest';
import {
  filterByPeriod,
  monthly,
  summarize,
  tasteAverages,
  topFlavors,
  topHighRated,
  type StatsRow,
} from '@/features/stats/aggregate';

const bean = (id: string, over: Partial<StatsRow['bean']> = {}): StatsRow['bean'] => ({
  id,
  country: 'Colombia',
  process: 'Washed',
  roast_level: null,
  flavor_notes: [],
  taste_flavor: null,
  taste_sweetness: null,
  taste_acidity: null,
  taste_aftertaste: null,
  taste_body: null,
  ...over,
});
const rows: StatsRow[] = [
  {
    logged_on: '2026-09-20',
    rating: 4.5,
    shop_id: 's1',
    bean: bean('a', { flavor_notes: ['Lime', 'Bergamot'], taste_flavor: 5, taste_acidity: 5 }),
  },
  {
    logged_on: '2026-09-10',
    rating: 4,
    shop_id: 's1',
    bean: bean('a', { flavor_notes: ['Lime', 'Bergamot'], taste_flavor: 5, taste_acidity: 5 }),
  },
  {
    logged_on: '2026-08-01',
    rating: 3,
    shop_id: null,
    bean: bean('b', { country: 'Ethiopia', process: 'Natural', flavor_notes: ['Berry'], taste_flavor: 3 }),
  },
  {
    logged_on: '2026-03-01',
    rating: null,
    shop_id: 's2',
    bean: bean('c', { country: 'Ethiopia', process: 'Natural', flavor_notes: ['Berry', 'Floral'] }),
  },
  {
    logged_on: '2025-01-01',
    rating: 5,
    shop_id: 's2',
    bean: bean('c', { country: 'Ethiopia', process: 'Natural', flavor_notes: ['Berry', 'Floral'] }),
  },
];
const now = new Date('2026-09-22T00:00:00Z');

describe('summarize', () => {
  it('記録 / 豆 / 店 / 平均星', () => {
    expect(summarize(rows)).toEqual({ logs: 5, beans: 3, shops: 2, avgRating: 4.1 });
    expect(summarize([]).avgRating).toBeNull();
  });
});

describe('filterByPeriod', () => {
  it('期間で絞る', () => {
    expect(filterByPeriod(rows, '3m', now)).toHaveLength(3);
    expect(filterByPeriod(rows, '1y', now)).toHaveLength(4);
    expect(filterByPeriod(rows, 'all', now)).toHaveLength(5);
  });
});

describe('topHighRated / topFlavors', () => {
  it('星 4 以上の記録だけを数え、最大を 100% にする', () => {
    expect(topHighRated(rows, 'country')).toEqual([
      { label: 'Colombia', count: 2, percent: 100 },
      { label: 'Ethiopia', count: 1, percent: 50 },
    ]);
    expect(topHighRated(rows, 'process')[0]).toMatchObject({ label: 'Washed', count: 2 });
  });
  it('焙煎度は labelOf で表示名に変え、未設定は数えない', () => {
    const withRoast: StatsRow[] = [
      { ...rows[0]!, bean: bean('a', { roast_level: 'light' }) },
      { ...rows[1]!, bean: bean('a', { roast_level: 'light' }) },
      { ...rows[4]!, bean: bean('c', { roast_level: 'dark' }) },
      { ...rows[2]!, bean: bean('b', { roast_level: 'dark' }) }, // 星 3 は数えない
      { ...rows[0]!, bean: bean('d') }, // 未設定
    ];
    const labels: Record<string, string> = { light: '浅煎り', dark: '深煎り' };
    expect(topHighRated(withRoast, 'roast_level', 5, (v) => labels[v] ?? v)).toEqual([
      { label: '浅煎り', count: 2, percent: 100 },
      { label: '深煎り', count: 1, percent: 50 },
    ]);
  });
  it('フレーバーは豆ごとに 1 回', () => {
    const f = topFlavors(rows);
    expect(f.find((x) => x.label === 'Lime')?.count).toBe(1);
    expect(f.find((x) => x.label === 'Berry')?.count).toBe(1);
    expect(f.find((x) => x.label === 'Floral')?.count).toBe(1);
  });
});

describe('tasteAverages', () => {
  it('高評価の豆だけ / 全体、豆ごとに 1 回', () => {
    const high = tasteAverages(rows, true);
    expect(high.beans).toBe(2);
    expect(high.flavor).toBe(5);
    const all = tasteAverages(rows, false);
    expect(all.beans).toBe(3);
    expect(all.flavor).toBe(4);
    expect(all.sweetness).toBeNull();
  });
});

describe('monthly', () => {
  it('直近 N か月を 0 埋めで返す', () => {
    const m = monthly(rows, 3, now);
    expect(m.map((x) => x.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(m[2]).toEqual({ month: '2026-09', count: 2, avgRating: 4.3 });
    expect(m[0]).toEqual({ month: '2026-07', count: 0, avgRating: null });
  });
});
