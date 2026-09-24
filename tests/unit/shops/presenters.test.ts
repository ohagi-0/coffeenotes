import { describe, expect, it } from 'vitest';
import {
  filterShopRows,
  formatDistance,
  shortArea,
  sortShopRows,
  toShopRow,
  withDistance,
  type ShopRow,
} from '@/features/shops/presenters';
import type { Shop } from '@/features/shops/queries';

const shop = (over: Partial<Shop> = {}): Shop => ({
  id: 's1',
  user_id: 'u',
  name: 'KIELO COFFEE 蔵前',
  kind: 'cafe',
  address: '東京都台東区蔵前 3-1-2',
  lat: 35.7,
  lng: 139.79,
  external_place_id: null,
  created_at: '',
  updated_at: '',
  ...over,
});

describe('shops presenters', () => {
  it('shortArea は都道府県と番地を落とす', () => {
    expect(shortArea('東京都台東区蔵前 3-1-2')).toBe('台東区蔵前');
    expect(shortArea('神奈川県横浜市中区元町1丁目')).toBe('横浜市中区元町');
    expect(shortArea('通販')).toBe('通販');
    expect(shortArea('  ')).toBeNull();
    expect(shortArea(null)).toBeNull();
  });

  it('toShopRow は種別ラベル・座標の有無・集計を平らにする', () => {
    expect(toShopRow(shop(), { count: 3, avgRating: 4.5 })).toEqual({
      id: 's1',
      name: 'KIELO COFFEE 蔵前',
      kind: 'cafe',
      kindLabel: 'カフェ',
      address: '東京都台東区蔵前 3-1-2',
      area: '台東区蔵前',
      lat: 35.7,
      lng: 139.79,
      hasCoordinates: true,
      count: 3,
      avgRating: 4.5,
      distanceM: null,
    });
    const r = toShopRow(shop({ kind: null, lat: null, lng: null, address: null }), undefined);
    expect(r).toMatchObject({
      kindLabel: null,
      area: null,
      hasCoordinates: false,
      count: 0,
      avgRating: null,
    });
  });

  it('sortShopRows: 名前順と評価順（星なしは最後）', () => {
    const mk = (name: string, avg: number | null, count = 1): ShopRow => ({
      id: name,
      name,
      kind: null,
      kindLabel: null,
      address: null,
      area: null,
      lat: null,
      lng: null,
      hasCoordinates: true,
      count,
      avgRating: avg,
      distanceM: null,
    });
    const rows = [mk('B', 3.5), mk('A', null), mk('C', 4.5, 2), mk('D', 4.5, 5)];
    expect(sortShopRows(rows, 'name').map((r) => r.name)).toEqual(['A', 'B', 'C', 'D']);
    expect(sortShopRows(rows, 'rating').map((r) => r.name)).toEqual(['D', 'C', 'B', 'A']);
  });

  it('withDistance は現在地からの距離を付け、距離順は不明な店を最後にする', () => {
    const near = toShopRow(shop({ id: 'near', name: 'Near', lat: 35.7, lng: 139.79 }), undefined);
    const far = toShopRow(shop({ id: 'far', name: 'Far', lat: 35.0, lng: 135.0 }), undefined);
    const none = toShopRow(shop({ id: 'none', name: 'Aaa', lat: null, lng: null }), undefined);
    const rows = withDistance([far, none, near], { lat: 35.701, lng: 139.79 });
    expect(rows.find((r) => r.id === 'near')?.distanceM).toBeLessThan(200);
    expect(rows.find((r) => r.id === 'none')?.distanceM).toBeNull();
    expect(sortShopRows(rows, 'distance').map((r) => r.id)).toEqual(['near', 'far', 'none']);
    // 現在地が無ければ距離は付かない
    expect(withDistance([near], null)[0]?.distanceM).toBeNull();
    expect(formatDistance(120)).toBe('120 m');
    expect(formatDistance(1400)).toBe('1.4 km');
    expect(formatDistance(null)).toBeNull();
  });

  it('filterShopRows は種別と検索語（店名・住所、大文字小文字を無視）で絞る', () => {
    const rows = [
      toShopRow(shop({ id: 'a', name: 'KIELO COFFEE 蔵前', kind: 'cafe' }), undefined),
      toShopRow(shop({ id: 'b', name: 'Onibus', kind: 'roaster', address: '東京都目黒区' }), undefined),
      toShopRow(shop({ id: 'c', name: '生豆本舗', kind: 'green_bean_shop', address: null }), undefined),
    ];
    expect(filterShopRows(rows, {}).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(filterShopRows(rows, { kind: 'roaster' }).map((r) => r.id)).toEqual(['b']);
    expect(filterShopRows(rows, { query: 'kielo' }).map((r) => r.id)).toEqual(['a']);
    expect(filterShopRows(rows, { query: '目黒' }).map((r) => r.id)).toEqual(['b']);
    expect(filterShopRows(rows, { kind: 'cafe', query: '目黒' })).toEqual([]);
  });
});
