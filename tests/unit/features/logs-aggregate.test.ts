import { describe, expect, it } from 'vitest';
import { aggregateRatings } from '@/features/logs/aggregate';

describe('aggregateRatings', () => {
  it('豆ごと・店ごとに回数と平均星（小数 1 桁）を出す', () => {
    const { byBean, byShop } = aggregateRatings([
      { bean_id: 'b1', shop_id: 's1', rating: 4.5 },
      { bean_id: 'b1', shop_id: null, rating: 3.5 },
      { bean_id: 'b1', shop_id: 's1', rating: null },
      { bean_id: 'b2', shop_id: 's2', rating: 5 },
    ]);
    expect(byBean.get('b1')).toEqual({ count: 3, avgRating: 4 });
    expect(byBean.get('b2')).toEqual({ count: 1, avgRating: 5 });
    expect(byShop.get('s1')).toEqual({ count: 2, avgRating: 4.5 });
    expect(byShop.get('s2')).toEqual({ count: 1, avgRating: 5 });
    expect(byShop.has('null')).toBe(false);
  });
  it('星なしだけなら平均は null、回数は数える', () => {
    const { byBean } = aggregateRatings([{ bean_id: 'b1', shop_id: null, rating: null }]);
    expect(byBean.get('b1')).toEqual({ count: 1, avgRating: null });
  });
  it('平均は小数 1 桁に丸める', () => {
    const { byBean } = aggregateRatings([
      { bean_id: 'b1', shop_id: null, rating: 4 },
      { bean_id: 'b1', shop_id: null, rating: 4.5 },
      { bean_id: 'b1', shop_id: null, rating: 4.5 },
    ]);
    expect(byBean.get('b1')?.avgRating).toBe(4.3);
  });
  it('空なら空の Map', () => {
    const { byBean, byShop } = aggregateRatings([]);
    expect(byBean.size).toBe(0);
    expect(byShop.size).toBe(0);
  });
});
