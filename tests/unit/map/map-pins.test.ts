import { describe, expect, it } from 'vitest';
import { DEFAULT_CENTER, initialCenter, pinTier, toMapShops } from '@/features/shops/map-pins';

describe('pinTier', () => {
  it.each([
    [null, 'none'],
    [2.5, 'low'],
    [3, 'mid'],
    [3.9, 'mid'],
    [4, 'high'],
    [4.4, 'high'],
    [4.5, 'top'],
    [5, 'top'],
  ] as const)('%s → %s', (avg, tier) => {
    expect(pinTier(avg)).toBe(tier);
  });
});

describe('toMapShops', () => {
  const shops = [
    { id: 'a', name: 'A', kind: 'cafe', address: null, lat: 35.6, lng: 139.7 },
    { id: 'b', name: 'B', kind: null, address: '住所', lat: null, lng: null },
  ];
  it('座標の無い店は落とし、回数と平均星を付ける', () => {
    const out = toMapShops(shops, new Map([['a', { count: 3, avgRating: 4.2 }]]));
    expect(out).toEqual([
      { id: 'a', name: 'A', kind: 'cafe', address: null, lat: 35.6, lng: 139.7, count: 3, avgRating: 4.2 },
    ]);
  });
  it('集計が無ければ 0 回・星なし', () => {
    expect(toMapShops(shops, undefined)[0]).toMatchObject({ count: 0, avgRating: null });
  });
});

describe('initialCenter', () => {
  it('店が無ければ東京駅、あれば重心', () => {
    expect(initialCenter([])).toEqual(DEFAULT_CENTER);
    expect(
      initialCenter([
        { lat: 35, lng: 139 },
        { lat: 36, lng: 140 },
      ]),
    ).toEqual({ lat: 35.5, lng: 139.5 });
  });
});
