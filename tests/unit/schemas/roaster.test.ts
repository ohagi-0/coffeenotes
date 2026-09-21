import { describe, expect, it } from 'vitest';
import { normalizeRoasterName, roasterFormSchema, roasterInsertSchema } from '@/lib/schemas/roaster';

describe('normalizeRoasterName', () => {
  it('前後の空白を除いて小文字にする（DB の name_normalized と同じ規則）', () => {
    expect(normalizeRoasterName(' KIELO Coffee ')).toBe('kielo coffee');
  });
  it('内側の空白は保持する', () => {
    expect(normalizeRoasterName('Blue  Bottle')).toBe('blue  bottle');
  });
});

describe('roasterFormSchema', () => {
  it('名前は必須で trim される', () => {
    expect(roasterFormSchema.parse({ name: ' KIELO COFFEE ' })).toEqual({
      name: 'KIELO COFFEE',
      website: null,
    });
    expect(roasterFormSchema.safeParse({ name: '   ' }).success).toBe(false);
  });
  it('website は空なら null、不正な URL は無効', () => {
    expect(roasterFormSchema.parse({ name: 'A', website: '' }).website).toBeNull();
    expect(roasterFormSchema.safeParse({ name: 'A', website: 'not a url' }).success).toBe(false);
    expect(roasterFormSchema.parse({ name: 'A', website: 'https://kielocoffee.com' }).website).toBe(
      'https://kielocoffee.com',
    );
  });
  it('insert には created_by が必要', () => {
    expect(roasterInsertSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(
      roasterInsertSchema.safeParse({ name: 'A', created_by: '00000000-0000-4000-8000-000000000000' })
        .success,
    ).toBe(true);
  });
});
