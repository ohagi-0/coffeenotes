import { describe, expect, it } from 'vitest';
import {
  COUNTRY_SHELVES,
  buildCollection,
  countryKeyOf,
  groupByCountry,
  sortCollection,
  type CollectionSourceLog,
} from '@/features/beans/collection';

const log = (over: Partial<CollectionSourceLog> & { id: string }): CollectionSourceLog => ({
  logged_on: '2026-09-20',
  rating: 4,
  place: 'shop',
  bean: { id: 'a', name: 'Lusitania Lime Geisha', country: 'Colombia', roaster: { name: 'KIELO COFFEE' } },
  shop: { name: 'KIELO COFFEE 蔵前' },
  ...over,
});

describe('buildCollection', () => {
  it('同じ豆の記録を 1 袋にまとめ、回数・平均星・最後に飲んだ場所を持つ', () => {
    const items = buildCollection([
      log({ id: 'l1', logged_on: '2026-09-10', rating: 5, shop: { name: '古い店' } }),
      log({ id: 'l2', logged_on: '2026-09-20', rating: 4, place: 'home', shop: null }),
      log({ id: 'l3', logged_on: '2026-09-15', rating: null }),
      log({
        id: 'l4',
        bean: {
          id: 'b',
          name: 'Kenya',
          country: 'Kenya',
          roaster: null,
          bean_images: [{ side: 'front', storage_path: 'u/b/front.jpg' }],
        },
        shop: null,
        rating: 3.5,
      }),
    ]);
    expect(items).toHaveLength(2);
    const a = items.find((i) => i.beanId === 'a')!;
    expect(a).toMatchObject({
      name: 'Lusitania Lime Geisha',
      roasterName: 'KIELO COFFEE',
      process: null,
      count: 3,
      avgRating: 4.5,
      lastLoggedOn: '2026-09-20',
      lastPlace: '自宅',
      lastLogId: 'l2',
      imagePath: null,
    });
    const b = items.find((i) => i.beanId === 'b')!;
    expect(b).toMatchObject({
      count: 1,
      avgRating: 3.5,
      lastPlace: null,
      imagePath: 'u/b/front.jpg',
      roasterName: null,
    });
  });
  it('星なしだけなら平均は null', () => {
    expect(buildCollection([log({ id: 'l1', rating: null })])[0]?.avgRating).toBeNull();
  });
});

describe('sortCollection', () => {
  const items = buildCollection([
    log({ id: '1', logged_on: '2026-09-01', rating: 5, bean: { id: 'x', name: 'X', country: null } }),
    log({ id: '2', logged_on: '2026-09-20', rating: 3, bean: { id: 'y', name: 'Y', country: null } }),
    log({ id: '3', logged_on: '2026-09-21', rating: 3, bean: { id: 'y', name: 'Y', country: null } }),
    log({ id: '4', logged_on: '2026-09-10', rating: null, bean: { id: 'z', name: 'Z', country: null } }),
  ]);
  it('最近 / 星 / 回数', () => {
    expect(sortCollection(items, 'recent').map((i) => i.beanId)).toEqual(['y', 'z', 'x']);
    expect(sortCollection(items, 'rating').map((i) => i.beanId)).toEqual(['x', 'y', 'z']);
    expect(sortCollection(items, 'count').map((i) => i.beanId)).toEqual(['y', 'z', 'x']);
  });
});

describe('countryKeyOf / groupByCountry', () => {
  it('英語・日本語・略称・国名で始まる表記を同じ棚にする', () => {
    expect(countryKeyOf('Ethiopia')).toBe('ethiopia');
    expect(countryKeyOf('エチオピア')).toBe('ethiopia');
    expect(countryKeyOf('Ethiopia Yirgacheffe')).toBe('ethiopia');
    expect(countryKeyOf('Costa Rica')).toBe('costa-rica');
    expect(countryKeyOf('costarica')).toBe('costa-rica');
    expect(countryKeyOf('Brasil')).toBe('brazil');
    expect(countryKeyOf('PNG')).toBe('png');
    expect(countryKeyOf('Timor-Leste')).toBe('other:timor leste');
    expect(countryKeyOf('')).toBeNull();
    expect(countryKeyOf(null)).toBeNull();
  });
  it('主要国は地域順に空でも並び、その他と生産国なしを最後に足す。制覇数を数える', () => {
    const items = buildCollection([
      log({ id: '1', bean: { id: 'a', name: 'A', country: 'Kenya' } }),
      log({ id: '2', bean: { id: 'b', name: 'B', country: 'コロンビア' } }),
      log({ id: '3', bean: { id: 'c', name: 'C', country: 'Timor-Leste' } }),
      log({ id: '4', bean: { id: 'd', name: 'D', country: null } }),
    ]);
    const g = groupByCountry(items);
    expect(g.total).toBe(COUNTRY_SHELVES.length);
    expect(g.visited).toBe(2);
    expect(g.shelves.slice(0, COUNTRY_SHELVES.length).map((s) => s.key)).toEqual(
      COUNTRY_SHELVES.map((c) => c.key),
    );
    expect(g.shelves.find((s) => s.key === 'kenya')?.items.map((i) => i.beanId)).toEqual(['a']);
    expect(g.shelves.find((s) => s.key === 'ethiopia')?.items).toEqual([]);
    const tail = g.shelves.slice(COUNTRY_SHELVES.length);
    expect(tail.map((s) => s.ja)).toEqual(['Timor-Leste', '生産国なし']);
    expect(tail[1]?.items.map((i) => i.beanId)).toEqual(['d']);
  });
});
