import { describe, expect, it } from 'vitest';
import { SUGGEST_LIMIT, suggestCountries, suggestVarieties } from '@/lib/vocab';

describe('suggestCountries', () => {
  it('空なら過去の値（表示名に寄せて重複なし）→ 語彙の順、上限まで', () => {
    const r = suggestCountries('', ['Ethiopia', 'エチオピア', 'Timor-Leste']);
    expect(r.slice(0, 2)).toEqual(['エチオピア', 'Timor-Leste']);
    expect(r[2]).toBe('ブラジル');
    expect(r).toHaveLength(SUGGEST_LIMIT);
  });
  it('入力で絞る。英語・カタカナ・産地ブランドのどれでも当たる', () => {
    expect(suggestCountries('eth')).toEqual(['エチオピア']);
    expect(suggestCountries('エチ')).toEqual(['エチオピア']);
    expect(suggestCountries('ブルーマ')).toEqual(['ジャマイカ']);
    expect(suggestCountries('kili')).toEqual(['タンザニア']);
  });
  it('入力と同じ 1 件だけなら出さない', () => {
    expect(suggestCountries('エチオピア')).toEqual([]);
    expect(suggestCountries('zzz')).toEqual([]);
  });
});

describe('suggestVarieties', () => {
  it('過去の複数入りの値は品種ごとにばらし、日本語名に寄せる', () => {
    const r = suggestVarieties('', ['SL28, SL34', 'Geisha', 'Sudan Rume']);
    expect(r.slice(0, 4)).toEqual(['SL28', 'SL34', 'ゲイシャ', 'sudan rume']);
  });
  it('入力で絞る', () => {
    expect(suggestVarieties('ブル')).toEqual(['ブルボン', 'ピンクブルボン', 'ブルーマウンテン']);
    expect(suggestVarieties('sl')).toEqual(['SL28', 'SL34']);
  });
});
