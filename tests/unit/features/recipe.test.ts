import { describe, expect, it } from 'vitest';
import { aggregateRatings, hasRecipe, latestRecipe } from '@/features/logs/aggregate';

describe('latestRecipe（前回のレシピを複製）', () => {
  it('新しい順の記録から、自宅でレシピのある最初のものを返す', () => {
    const r = latestRecipe([
      { place: 'shop', brew_method: 'エスプレッソ' },
      { place: 'home', dose_g: null, water_g: null },
      {
        place: 'home',
        grinder: 'C40',
        grind_setting: '25',
        dose_g: 15,
        water_g: 225,
        water_temp_c: 92,
        brew_time_sec: 180,
      },
    ]);
    expect(r).toMatchObject({ grinder: 'C40', dose_g: 15, water_g: 225, brew_method: null });
  });
  it('無ければ null', () => {
    expect(latestRecipe([{ place: 'shop' }])).toBeNull();
    expect(hasRecipe({ dose_g: null, memo: 'x' } as never)).toBe(false);
  });
});

describe('aggregateRatings.byRoast', () => {
  it('焙煎バッチごとの回数と平均星', () => {
    const { byRoast } = aggregateRatings([
      { bean_id: 'b', shop_id: null, roast_id: 'r1', rating: 4 },
      { bean_id: 'b', shop_id: null, roast_id: 'r1', rating: 3 },
      { bean_id: 'b', shop_id: null, roast_id: null, rating: 5 },
    ]);
    expect(byRoast.get('r1')).toEqual({ count: 2, avgRating: 3.5 });
    expect(byRoast.size).toBe(1);
  });
});
