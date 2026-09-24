import { describe, expect, it } from 'vitest';
import { VARIETY_SHELVES, varietyDisplayName, varietyKeysOf, varietyShelfOf } from '@/lib/vocab';

describe('varietyKeysOf', () => {
  it('区切りで分け、表記ゆれと前後の語を吸収する', () => {
    expect(varietyKeysOf('Geisha')).toEqual(['geisha']);
    expect(varietyKeysOf('SL28, SL34')).toEqual(['sl28', 'sl34']);
    expect(varietyKeysOf('SL-28 / Ruiru 11')).toEqual(['sl28', 'ruiru11']);
    expect(varietyKeysOf('Red Bourbon')).toEqual(['bourbon']);
    expect(varietyKeysOf('Pink Bourbon')).toEqual(['pink-bourbon']);
    expect(varietyKeysOf('エチオピア在来種')).toEqual(['heirloom']);
    expect(varietyKeysOf('74158')).toEqual(['heirloom']);
    expect(varietyKeysOf('')).toEqual([]);
    expect(varietyKeysOf(null)).toEqual([]);
  });
  it('キーは重複しない', () => {
    expect(new Set(VARIETY_SHELVES.map((v) => v.key)).size).toBe(VARIETY_SHELVES.length);
  });
});

describe('varietyDisplayName', () => {
  it('主要品種は日本語名、当たらなければ入力のまま。複数は「, 」で結ぶ', () => {
    expect(varietyDisplayName('Geisha')).toBe('ゲイシャ');
    expect(varietyDisplayName('SL28, SL34')).toBe('SL28, SL34');
    expect(varietyDisplayName('Bourbon / Typica')).toBe('ブルボン, ティピカ');
    expect(varietyDisplayName('')).toBeNull();
    expect(varietyDisplayName(null)).toBeNull();
  });
  it('varietyShelfOf は定義を返す', () => {
    expect(varietyShelfOf('geisha')?.name).toBe('ゲイシャ');
    expect(varietyShelfOf('other:x')).toBeUndefined();
  });
});
