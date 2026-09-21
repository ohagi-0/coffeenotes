import { describe, expect, it } from 'vitest';
import { shopFormSchema, shopInsertSchema } from '@/lib/schemas/shop';

const UID = '00000000-0000-4000-8000-000000000000';

describe('shopFormSchema', () => {
  it('店名だけで保存できる（座標なし、F-SHOP-6）', () => {
    const r = shopFormSchema.parse({ name: 'KIELO COFFEE' });
    expect(r).toEqual({
      name: 'KIELO COFFEE',
      kind: null,
      address: null,
      lat: null,
      lng: null,
      external_place_id: null,
    });
  });
  it('フォームの空文字は null に寄る', () => {
    const r = shopFormSchema.parse({ name: 'A', kind: '', address: '', lat: '', lng: '' });
    expect(r.kind).toBeNull();
    expect(r.lat).toBeNull();
  });
  it('座標は両方あれば有効', () => {
    expect(shopFormSchema.safeParse({ name: 'A', lat: 35.68, lng: 139.76 }).success).toBe(true);
    expect(shopFormSchema.parse({ name: 'A', lat: '35.68', lng: '139.76' }).lat).toBe(35.68);
  });
  it('座標が片方だけだと無効（DB の CHECK 制約と同じ）', () => {
    const r = shopFormSchema.safeParse({ name: 'A', lat: 35.68 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['lng']);
  });
  it('範囲外の座標は無効', () => {
    expect(shopFormSchema.safeParse({ name: 'A', lat: 91, lng: 0 }).success).toBe(false);
    expect(shopFormSchema.safeParse({ name: 'A', lat: 0, lng: -181 }).success).toBe(false);
  });
  it('種別は決まった値のみ', () => {
    expect(shopFormSchema.safeParse({ name: 'A', kind: 'cafe' }).success).toBe(true);
    expect(shopFormSchema.safeParse({ name: 'A', kind: 'bar' }).success).toBe(false);
  });
  it('insert は user_id 必須で、片方だけの座標は同じく無効', () => {
    expect(shopInsertSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(shopInsertSchema.safeParse({ name: 'A', user_id: UID }).success).toBe(true);
    expect(shopInsertSchema.safeParse({ name: 'A', user_id: UID, lat: 1 }).success).toBe(false);
  });
});
