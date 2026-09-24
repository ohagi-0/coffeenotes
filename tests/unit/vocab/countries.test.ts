import { describe, expect, it } from 'vitest';
import { COUNTRY_SHELVES, countryDisplayName, countryKeyOf, countryShelfOf } from '@/lib/vocab';

describe('countryKeyOf', () => {
  it('英語・日本語・略称・産地ブランド・国名で始まる表記を同じ国にする', () => {
    expect(countryKeyOf('Ethiopia')).toBe('ethiopia');
    expect(countryKeyOf('エチオピア')).toBe('ethiopia');
    expect(countryKeyOf('Ethiopia Yirgacheffe')).toBe('ethiopia');
    expect(countryKeyOf('Costa Rica')).toBe('costa-rica');
    expect(countryKeyOf('costarica')).toBe('costa-rica');
    expect(countryKeyOf('Brasil')).toBe('brazil');
    expect(countryKeyOf('PNG')).toBe('png');
    expect(countryKeyOf('キリマンジャロ')).toBe('tanzania');
    expect(countryKeyOf('Timor-Leste')).toBe('other:timor leste');
    expect(countryKeyOf('')).toBeNull();
    expect(countryKeyOf(null)).toBeNull();
  });
  it('キーは重複しない', () => {
    expect(new Set(COUNTRY_SHELVES.map((c) => c.key)).size).toBe(COUNTRY_SHELVES.length);
  });
});

describe('countryDisplayName', () => {
  it('主要国は日本語名、当たらなければ入力のまま', () => {
    expect(countryDisplayName('Ethiopia')).toBe('エチオピア');
    expect(countryDisplayName('エチオピア')).toBe('エチオピア');
    expect(countryDisplayName(' Colombia ')).toBe('コロンビア');
    expect(countryDisplayName('Timor-Leste')).toBe('Timor-Leste');
    expect(countryDisplayName('')).toBeNull();
    expect(countryDisplayName(null)).toBeNull();
  });
  it('countryShelfOf は定義を返す', () => {
    expect(countryShelfOf('kenya')?.ja).toBe('ケニア');
    expect(countryShelfOf('other:x')).toBeUndefined();
    expect(countryShelfOf(null)).toBeUndefined();
  });
});
