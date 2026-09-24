import { describe, expect, it } from 'vitest';
import { buildCollection, sortCollection, type CollectionSourceLog } from '@/features/beans/collection';

const log = (over: Partial<CollectionSourceLog> & { id: string }): CollectionSourceLog => ({
  logged_on: '2026-09-20',
  rating: 4,
  place: 'shop',
  bean: { id: 'a', name: 'Lusitania Lime Geisha', country: 'Colombia', roaster: { name: 'KIELO COFFEE' } },
  shop: { name: 'KIELO COFFEE 蔵前' },
  ...over,
});

describe('buildCollection', () => {
  it('同じ豆の記録を 1 袋にまとめ、回数・平均星・最後に飲んだ場所を持つ', () => {
    const items = buildCollection([
      log({ id: 'l1', logged_on: '2026-09-10', rating: 5, shop: { name: '古い店' } }),
      log({ id: 'l2', logged_on: '2026-09-20', rating: 4, place: 'home', shop: null }),
      log({ id: 'l3', logged_on: '2026-09-15', rating: null }),
      log({
        id: 'l4',
        bean: {
          id: 'b',
          name: 'Kenya',
          country: 'Kenya',
          roaster: null,
          bean_images: [{ side: 'front', storage_path: 'u/b/front.jpg' }],
        },
        shop: null,
        rating: 3.5,
      }),
    ]);
    expect(items).toHaveLength(2);
    const a = items.find((i) => i.beanId === 'a')!;
    expect(a).toMatchObject({
      name: 'Lusitania Lime Geisha',
      roasterName: 'KIELO COFFEE',
      count: 3,
      avgRating: 4.5,
      lastLoggedOn: '2026-09-20',
      lastPlace: '自宅',
      lastLogId: 'l2',
      imagePath: null,
    });
    const b = items.find((i) => i.beanId === 'b')!;
    expect(b).toMatchObject({
      count: 1,
      avgRating: 3.5,
      lastPlace: null,
      imagePath: 'u/b/front.jpg',
      roasterName: null,
    });
  });
  it('星なしだけなら平均は null', () => {
    expect(buildCollection([log({ id: 'l1', rating: null })])[0]?.avgRating).toBeNull();
  });
});

describe('sortCollection', () => {
  const items = buildCollection([
    log({ id: '1', logged_on: '2026-09-01', rating: 5, bean: { id: 'x', name: 'X', country: null } }),
    log({ id: '2', logged_on: '2026-09-20', rating: 3, bean: { id: 'y', name: 'Y', country: null } }),
    log({ id: '3', logged_on: '2026-09-21', rating: 3, bean: { id: 'y', name: 'Y', country: null } }),
    log({ id: '4', logged_on: '2026-09-10', rating: null, bean: { id: 'z', name: 'Z', country: null } }),
  ]);
  it('最近 / 星 / 回数', () => {
    expect(sortCollection(items, 'recent').map((i) => i.beanId)).toEqual(['y', 'z', 'x']);
    expect(sortCollection(items, 'rating').map((i) => i.beanId)).toEqual(['x', 'y', 'z']);
    expect(sortCollection(items, 'count').map((i) => i.beanId)).toEqual(['y', 'z', 'x']);
  });
});
