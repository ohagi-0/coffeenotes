import { describe, expect, it } from 'vitest';
import {
  MATCH_SCORE,
  consonantSkeleton,
  matchScore,
  mergeCandidates,
  normalizeForMatch,
  rankCandidates,
} from '@/lib/geo/match';

describe('normalizeForMatch', () => {
  it('全角半角・大文字小文字・ひらがな/カタカナ・空白と記号の違いをそろえる', () => {
    expect(normalizeForMatch('ＢＬＵＥ　Bottle')).toBe('bluebottle');
    expect(normalizeForMatch('さるたひこ')).toBe(normalizeForMatch('サルタヒコ'));
    expect(normalizeForMatch('ｽﾀｰﾊﾞｯｸｽ')).toBe('スターバックス');
    expect(normalizeForMatch('Café・Bach')).toBe('cafébach');
  });
});

describe('consonantSkeleton', () => {
  it.each([
    ['フグレン', 'Fuglen Tokyo'],
    ['ブルーボトル', 'Blue Bottle Coffee'],
    ['リトルナップ', 'Little Nap COFFEE STAND'],
    ['スターバックス', 'Starbucks'],
    ['ドトール', 'Doutor Coffee'],
    ['グリッチ', 'GLITCH COFFEE'],
  ])('カタカナ「%s」の骨格が英字名「%s」に含まれる', (kana, latin) => {
    expect(consonantSkeleton(latin)).toContain(consonantSkeleton(kana));
  });
});

describe('matchScore', () => {
  it('完全一致 > 部分一致 > 骨格一致 の順に点が高い', () => {
    expect(matchScore('猿田彦珈琲', ['猿田彦珈琲'])).toBe(MATCH_SCORE.exact);
    expect(matchScore('猿田彦', ['猿田彦珈琲 恵比寿'])).toBe(MATCH_SCORE.substring);
    expect(matchScore('フグレン', ['Fuglen Tokyo'])).toBe(MATCH_SCORE.skeleton);
  });

  it('別名（name:en など）にも当たる', () => {
    expect(matchScore('ブルーボトル', ['Blue Bottle Coffee', 'ブルーボトルコーヒー'])).toBe(
      MATCH_SCORE.substring,
    );
  });

  it('ひらがなで打ってもカタカナの店名に当たる', () => {
    expect(matchScore('どとーる', ['ドトールコーヒーショップ'])).toBe(MATCH_SCORE.substring);
  });

  it('空白区切りの語はすべて一致が必要（順不同）。住所にも部分一致で当たる', () => {
    expect(matchScore('渋谷 フグレン', ['Fuglen Tokyo'], '東京都渋谷区富ヶ谷')).toBe(MATCH_SCORE.skeleton);
    expect(matchScore('新宿 フグレン', ['Fuglen Tokyo'], '東京都渋谷区富ヶ谷')).toBe(0);
  });

  it('短い語では骨格の照合をしない（誤爆を防ぐ）', () => {
    expect(matchScore('ふく', ['Hikari Coffee'])).toBe(0);
  });

  it('骨格は語の頭からの一致だけ（語の途中に同じ並びがあっても当たらない）', () => {
    expect(matchScore('グリッチ', ['GLITCH COFFEE & ROASTERS'])).toBe(MATCH_SCORE.skeleton);
    expect(matchScore('グリッチ', ['Margaret Howell Cafe'])).toBe(0);
    expect(matchScore('ストリーマー', ['Streamer Coffee Company'])).toBe(MATCH_SCORE.skeleton);
  });

  it('関係ない店には当たらない', () => {
    expect(matchScore('フグレン', ['Blue Bottle Coffee'])).toBe(0);
    expect(matchScore('スターバックス', ['ドトールコーヒーショップ'])).toBe(0);
  });

  it('検索語が空ならすべて一致扱い', () => {
    expect(matchScore('  ', ['なんでも'])).toBe(1);
  });
});

describe('rankCandidates', () => {
  const c = (name: string, distanceM: number, aliases: string[] = []) => ({
    name,
    aliases,
    address: null,
    distanceM,
  });

  it('当たったものだけを、点の高い順 → 近い順に並べる', () => {
    const list = [
      c('Fuglen Tokyo', 900),
      c('フグレン 浅草', 2500),
      c('Fuglen Coffee Roasters', 300),
      c('Blue Bottle Coffee', 100),
    ];
    expect(rankCandidates('フグレン', list).map((x) => x.name)).toEqual([
      'フグレン 浅草',
      'Fuglen Coffee Roasters',
      'Fuglen Tokyo',
    ]);
  });
});

describe('mergeCandidates', () => {
  const p = (name: string, id: string | null, lat = 35.66, lng = 139.7) => ({
    name,
    externalPlaceId: id,
    lat,
    lng,
  });

  it('同じ OSM の ID、または同じ名前で近い店は重複として後ろを捨てる', () => {
    const merged = mergeCandidates(
      [p('Fuglen Tokyo', 'node/1')],
      [
        p('Fuglen Tokyo (Nominatim)', 'node/1'),
        p('fuglen tokyo', null, 35.6601, 139.7001),
        p('Other', 'node/2'),
      ],
    );
    expect(merged.map((x) => x.name)).toEqual(['Fuglen Tokyo', 'Other']);
  });
});

import { isKanaQuery, kanaToRomaji } from '@/lib/geo/romaji';

describe('kanaToRomaji', () => {
  it.each([
    ['フグレン', 'fuguren'],
    ['ぶるーぼとる', 'burubotoru'],
    ['リトルナップ', 'ritorunappu'],
    ['グリッチ', 'guritchi'],
    ['カフェ', 'kafe'],
    ['ティー', 'ti'],
  ])('%s → %s', (kana, romaji) => {
    expect(kanaToRomaji(kana)).toBe(romaji);
  });
  it('かなだけの検索語か', () => {
    expect(isKanaQuery('フグレン')).toBe(true);
    expect(isKanaQuery('ふぐれん ')).toBe(true);
    expect(isKanaQuery('猿田彦')).toBe(false);
    expect(isKanaQuery('スタバ渋谷')).toBe(false);
    expect(isKanaQuery('Fuglen')).toBe(false);
  });
});
