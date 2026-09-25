import { describe, expect, it } from 'vitest';
import { PROCESSES, processDisplayName, processKeyOf, suggestProcesses } from '@/lib/vocab';

describe('processKeyOf / processDisplayName', () => {
  it('英語・カタカナ・和名・前後に語が付く表記を同じ精製方法にする', () => {
    expect(processKeyOf('Washed')).toBe('washed');
    expect(processKeyOf('ウォッシュド')).toBe('washed');
    expect(processKeyOf('水洗式')).toBe('washed');
    expect(processKeyOf('Fully Washed')).toBe('washed');
    expect(processKeyOf('Red Honey')).toBe('honey');
    expect(processKeyOf('パルプドナチュラル')).toBe('honey');
    expect(processKeyOf('Anaerobic Natural')).toBe('anaerobic');
    expect(processKeyOf('Lime infused')).toBe('infused');
    expect(processKeyOf('Giling Basah')).toBe('wet-hulled');
    expect(processKeyOf('Thermal Shock')).toBe('other:thermal shock');
    expect(processKeyOf('')).toBeNull();
  });
  it('表示名は日本語名、当たらなければそのまま', () => {
    expect(processDisplayName('Honey')).toBe('ハニー');
    expect(processDisplayName('ハニー')).toBe('ハニー');
    expect(processDisplayName('Thermal Shock')).toBe('Thermal Shock');
    expect(processDisplayName(null)).toBeNull();
  });
  it('キーは重複しない', () => {
    expect(new Set(PROCESSES.map((p) => p.key)).size).toBe(PROCESSES.length);
  });
});

describe('suggestProcesses', () => {
  it('過去の値を日本語名に寄せて先に、そのあと語彙の順', () => {
    expect(suggestProcesses('', ['Honey', 'ハニー']).slice(0, 3)).toEqual([
      'ハニー',
      'ウォッシュド',
      'ナチュラル',
    ]);
    expect(suggestProcesses('ana')).toEqual(['アナエロビック']);
    expect(suggestProcesses('ウォッシュド')).toEqual([]);
  });
});
