import { describe, expect, it } from 'vitest';
import { currentShopOf, isShopChanged } from '@/components/beans/bean-log-shops';

const row = (shop: { id: string; name: string } | null) => ({
  id: 'l1',
  logged_on: '2026-10-01',
  place: 'shop',
  shop,
});

describe('isShopChanged', () => {
  it('同じ店なら変更なし、別の店・外す・新しい店は変更あり', () => {
    const r = row({ id: 's1', name: 'A' });
    expect(isShopChanged(r, { id: 's1', name: 'A' })).toBe(false);
    expect(isShopChanged(r, { id: 's2', name: 'B' })).toBe(true);
    expect(isShopChanged(r, null)).toBe(true);
    expect(isShopChanged(r, { id: null, name: 'Fuglen' })).toBe(true);
  });
  it('店が無い記録に、名前が空の新規は変更なし（外したのと同じ）', () => {
    expect(isShopChanged(row(null), { id: null, name: '  ' })).toBe(false);
    expect(isShopChanged(row(null), null)).toBe(false);
  });
  it('今の店を店の欄の値の形にする', () => {
    expect(currentShopOf(row({ id: 's1', name: 'A' }))).toEqual({ id: 's1', name: 'A', address: null });
    expect(currentShopOf(row(null))).toBeNull();
  });
});
