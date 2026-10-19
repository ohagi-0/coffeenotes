import { describe, expect, it } from 'vitest';
import {
  formatMonthDay,
  formatYearMonth,
  groupByMonth,
  recapHeadline,
  shopRecap,
  type RecapLog,
} from '@/features/shops/recap';

// 店詳細の振り返り（#44）。ベスト / 豆ごと / 傾向。記録 1 件でも 0 件でも崩れない。
const NOW = new Date('2026-10-20T00:00:00Z');
let n = 0;
function log(
  over: Partial<RecapLog> & { beanId?: string; beanName?: string; tags?: string[] } = {},
): RecapLog {
  const { beanId = 'b1', beanName = '豆1', tags = [], ...rest } = over;
  n++;
  return {
    id: `l${n}`,
    logged_on: '2026-10-01',
    created_at: `2026-10-01T00:00:0${n % 10}Z`,
    rating: 4,
    bean: {
      id: beanId,
      name: beanName,
      roaster: { name: 'KIELO' },
      flavor_notes: ['ベリー', 'ナッツ', '蜜', '柑橘'],
      bean_images: [{ side: 'front', storage_path: `u/${beanId}/front.jpg` }],
      taste_flavor: 4,
      taste_sweetness: 3,
      taste_acidity: null,
      taste_aftertaste: null,
      taste_body: null,
    },
    log_tags: tags.map((name) => ({ tag: { name } })),
    ...rest,
  };
}

describe('shopRecap', () => {
  it('0 件: すべて空', () => {
    expect(shopRecap([])).toEqual({
      count: 0,
      firstOn: null,
      lastOn: null,
      avgRating: null,
      best: null,
      beans: [],
      trend: null,
    });
  });

  it('1 件: 見出しと豆は出るが、ベストと傾向は出さない', () => {
    const r = shopRecap([log({ rating: 5 })]);
    expect(r).toMatchObject({
      count: 1,
      firstOn: '2026-10-01',
      lastOn: '2026-10-01',
      avgRating: 5,
      best: null,
      trend: null,
    });
    expect(r.beans).toHaveLength(1);
  });

  it('ベスト: 星が最も高い記録。同点なら新しい方。星なしは対象外', () => {
    const r = shopRecap([
      log({ id: 'old', rating: 5, logged_on: '2026-03-01', beanId: 'x', beanName: 'X' }),
      log({ id: 'new', rating: 5, logged_on: '2026-09-01', beanId: 'y', beanName: 'Y' }),
      log({ id: 'low', rating: 3, logged_on: '2026-10-01' }),
      log({ id: 'none', rating: null, logged_on: '2026-10-05' }),
    ]);
    expect(r.best).toMatchObject({
      logId: 'new',
      beanName: 'Y',
      roasterName: 'KIELO',
      rating: 5,
      loggedOn: '2026-09-01',
      imagePath: 'u/y/front.jpg',
    });
  });

  it('星が 1 件も無ければベストは無い', () => {
    expect(shopRecap([log({ rating: null }), log({ rating: null })]).best).toBeNull();
  });

  it('豆ごと: 回数の多い順、同数は最後に飲んだ日が新しい順。回数・平均星・最後の日・フレーバー上位 3 つ', () => {
    const r = shopRecap([
      log({ beanId: 'a', beanName: 'A', rating: 5, logged_on: '2026-01-01' }),
      log({ beanId: 'a', beanName: 'A', rating: 4, logged_on: '2026-02-01' }),
      log({ beanId: 'b', beanName: 'B', rating: 3, logged_on: '2026-09-01' }),
      log({ beanId: 'c', beanName: 'C', rating: null, logged_on: '2026-10-01' }),
    ]);
    expect(r.beans.map((b) => b.beanName)).toEqual(['A', 'C', 'B']);
    expect(r.beans[0]).toMatchObject({
      count: 2,
      avgRating: 4.5,
      lastOn: '2026-02-01',
      flavorNotes: ['ベリー', 'ナッツ', '蜜'],
    });
    expect(r.beans[1]!.avgRating).toBeNull();
  });

  it('傾向（3 件以上）: 星 4 以上の割合、タグ上位 3 つ、味覚の平均（豆ごとに 1 回）', () => {
    const r = shopRecap([
      log({ beanId: 'a', rating: 5, tags: ['朝', 'ゲイシャ'] }),
      log({ beanId: 'a', rating: 4, tags: ['朝'] }),
      log({ beanId: 'b', rating: 2, tags: ['朝', '浅煎り', '甘い', '酸味'] }),
      log({ beanId: 'c', rating: null }),
    ]);
    expect(r.trend).not.toBeNull();
    expect(r.trend!.ratedCount).toBe(3);
    expect(r.trend!.highRatio).toBeCloseTo(2 / 3);
    expect(r.trend!.topTags).toHaveLength(3);
    expect(r.trend!.topTags[0]).toMatchObject({ label: '朝', count: 3, percent: 100 });
    expect(r.trend!.taste).toMatchObject({ flavor: 4, sweetness: 3, acidity: null, beans: 3 });
  });

  it('2 件では傾向を出さない', () => {
    expect(shopRecap([log(), log()]).trend).toBeNull();
  });
});

describe('表示用の整形', () => {
  it('見出しの 1 行、年月・月日（今年でなければ年つき）', () => {
    expect(formatYearMonth('2026-04-10')).toBe('2026.04');
    expect(formatMonthDay('2026-10-19', NOW)).toBe('10.19');
    expect(formatMonthDay('2025-12-31', NOW)).toBe('2025.12.31');
    expect(recapHeadline({ count: 12, firstOn: '2026-04-10', lastOn: '2026-10-19' }, NOW)).toBe(
      '12 回 · 初回 2026.04 · 前回 10.19',
    );
    expect(recapHeadline({ count: 0, firstOn: null, lastOn: null }, NOW)).toBeNull();
  });

  it('groupByMonth: 月ごとに小見出し、順序は保つ', () => {
    const g = groupByMonth([
      { loggedOn: '2026-10-19' },
      { loggedOn: '2026-10-02' },
      { loggedOn: '2026-09-30' },
    ]);
    expect(g.map((x) => [x.label, x.items.length])).toEqual([
      ['2026年10月', 2],
      ['2026年9月', 1],
    ]);
  });
});
