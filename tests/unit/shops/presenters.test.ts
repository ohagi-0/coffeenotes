import { describe, expect, it } from 'vitest';
import { shortArea, sortShopRows, toShopRow, type ShopRow } from '@/features/shops/presenters';
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
      kindLabel: 'カフェ',
      area: '台東区蔵前',
      hasCoordinates: true,
      count: 3,
      avgRating: 4.5,
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
      kindLabel: null,
      area: null,
      hasCoordinates: true,
      count,
      avgRating: avg,
    });
    const rows = [mk('B', 3.5), mk('A', null), mk('C', 4.5, 2), mk('D', 4.5, 5)];
    expect(sortShopRows(rows, 'name').map((r) => r.name)).toEqual(['A', 'B', 'C', 'D']);
    expect(sortShopRows(rows, 'rating').map((r) => r.name)).toEqual(['D', 'C', 'B', 'A']);
  });
});
