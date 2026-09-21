import { describe, expect, it } from 'vitest';
import { brewRatio, logFormSchema, logInsertSchema } from '@/lib/schemas/log';

const BEAN = '11111111-1111-4111-8111-111111111111';
const SHOP = '22222222-2222-4222-8222-222222222222';
const UID = '00000000-0000-4000-8000-000000000000';

describe('logFormSchema', () => {
  it('星とメモだけ（レシピなし）で保存できる', () => {
    const r = logFormSchema.parse({
      bean_id: BEAN,
      place: 'home',
      logged_on: '2026-09-21',
      rating: 4.5,
      memo: 'よい',
    });
    expect(r.kind).toBe('drank');
    expect(r.shop_id).toBeNull();
    expect(r.dose_g).toBeNull();
    expect(r.tag_names).toEqual([]);
  });
  it('星なし・メモなしでも保存できる', () => {
    expect(logFormSchema.safeParse({ bean_id: BEAN, place: 'shop', logged_on: '2026-09-21' }).success).toBe(
      true,
    );
  });
  it('店で飲んだ記録は shop_id を持てる', () => {
    const r = logFormSchema.parse({ bean_id: BEAN, place: 'shop', shop_id: SHOP, logged_on: '2026-09-21' });
    expect(r.shop_id).toBe(SHOP);
  });
  it('自宅なのに shop_id があると無効（DB の CHECK 制約と同じ）', () => {
    const r = logFormSchema.safeParse({
      bean_id: BEAN,
      place: 'home',
      shop_id: SHOP,
      logged_on: '2026-09-21',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['shop_id']);
  });
  it('店で飲んだが店未選択（shop_id null）は許す', () => {
    expect(
      logFormSchema.safeParse({ bean_id: BEAN, place: 'shop', shop_id: '', logged_on: '2026-09-21' }).success,
    ).toBe(true);
  });
  it.each([0.5, 3.3, 5.5])('星 %s は無効', (v) => {
    expect(
      logFormSchema.safeParse({ bean_id: BEAN, place: 'home', logged_on: '2026-09-21', rating: v }).success,
    ).toBe(false);
  });
  it('レシピ列の境界値', () => {
    const base = { bean_id: BEAN, place: 'home', logged_on: '2026-09-21' };
    expect(logFormSchema.safeParse({ ...base, water_temp_c: 101 }).success).toBe(false);
    expect(logFormSchema.safeParse({ ...base, water_temp_c: 100 }).success).toBe(true);
    expect(logFormSchema.safeParse({ ...base, dose_g: 0 }).success).toBe(false);
    expect(logFormSchema.safeParse({ ...base, brew_time_sec: 2.5 }).success).toBe(false);
    const r = logFormSchema.parse({
      ...base,
      dose_g: '15',
      water_g: '225',
      water_temp_c: '92',
      brew_time_sec: '180',
    });
    expect(r.dose_g).toBe(15);
    expect(r.brew_time_sec).toBe(180);
  });
  it('タグは名前で受け取り、空や 33 文字以上は無効', () => {
    const base = { bean_id: BEAN, place: 'home', logged_on: '2026-09-21' };
    expect(logFormSchema.parse({ ...base, tag_names: [' 朝 ', 'ゲイシャ'] }).tag_names).toEqual([
      '朝',
      'ゲイシャ',
    ]);
    expect(logFormSchema.safeParse({ ...base, tag_names: [''] }).success).toBe(false);
  });
  it('insert は user_id 必須で tag_names を含まない', () => {
    const r = logInsertSchema.parse({ bean_id: BEAN, place: 'home', logged_on: '2026-09-21', user_id: UID });
    expect(r.user_id).toBe(UID);
    expect('tag_names' in r).toBe(false);
    expect(logInsertSchema.safeParse({ bean_id: BEAN, place: 'home', logged_on: '2026-09-21' }).success).toBe(
      false,
    );
  });
});

describe('brewRatio', () => {
  it('1:N の N を小数 1 桁で返す', () => {
    expect(brewRatio(15, 225)).toBe(15);
    expect(brewRatio(16, 250)).toBe(15.6);
  });
  it('どちらかが無ければ null', () => {
    expect(brewRatio(null, 225)).toBeNull();
    expect(brewRatio(15, null)).toBeNull();
    expect(brewRatio(0, 225)).toBeNull();
  });
});
