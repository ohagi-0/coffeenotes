import { describe, expect, it } from 'vitest';
import { beanFormSchema, beanInsertSchema, flavorNotesSchema } from '@/lib/schemas/bean';

const ROASTER = '11111111-1111-4111-8111-111111111111';
const UID = '00000000-0000-4000-8000-000000000000';
const minimal = { name: 'Lusitania Lime Geisha', roaster_id: ROASTER, source: 'purchased' as const };

describe('beanFormSchema', () => {
  it('豆名・ロースター・入手区分だけで有効', () => {
    const r = beanFormSchema.parse(minimal);
    expect(r.name).toBe('Lusitania Lime Geisha');
    expect(r.flavor_notes).toEqual([]);
    expect(r.taste_flavor).toBeNull();
    expect(r.roast_level).toBeNull();
  });
  it('豆名が空・ロースター未選択・入手区分なしは無効', () => {
    expect(beanFormSchema.safeParse({ ...minimal, name: '  ' }).success).toBe(false);
    expect(beanFormSchema.safeParse({ ...minimal, roaster_id: '' }).success).toBe(false);
    expect(beanFormSchema.safeParse({ name: 'A', roaster_id: ROASTER }).success).toBe(false);
  });
  it('サンプルカード相当の入力を受け付ける', () => {
    const r = beanFormSchema.parse({
      ...minimal,
      country: 'Colombia',
      region: 'Caicedonia, Valle del Cauca',
      farm: 'Finca Los Senisos',
      harvest_year: '2025',
      variety: 'Geisha',
      process: 'Lime infused',
      altitude_m: '1650',
      flavor_notes: ['Lime', ' Bergamot ', '', 'Laurier'],
      taste_flavor: 5,
      taste_sweetness: 3,
      taste_acidity: 5,
      taste_aftertaste: 3,
      taste_body: 3,
      price_jpy: 3800,
      price_grams: 100,
    });
    expect(r.altitude_m).toBe(1650);
    expect(r.harvest_year).toBe(2025);
    expect(r.farm).toBe('Finca Los Senisos');
    expect(r.flavor_notes).toEqual(['Lime', 'Bergamot', 'Laurier']);
  });
  it.each(['1899', '2101', '25'])('収穫年度 %s は無効', (v) => {
    expect(beanFormSchema.safeParse({ ...minimal, harvest_year: v }).success).toBe(false);
  });
  it.each([0, 6, 2.5])('味覚チャート %s は無効', (v) => {
    expect(beanFormSchema.safeParse({ ...minimal, taste_body: v }).success).toBe(false);
  });
  it('標高マイナス・価格マイナス・グラム 0 は無効', () => {
    expect(beanFormSchema.safeParse({ ...minimal, altitude_m: -1 }).success).toBe(false);
    expect(beanFormSchema.safeParse({ ...minimal, price_jpy: -100 }).success).toBe(false);
    expect(beanFormSchema.safeParse({ ...minimal, price_grams: 0 }).success).toBe(false);
  });
  it('焙煎度・焙煎日・参照 URL は空なら null、不正なら無効', () => {
    const ok = beanFormSchema.parse({ ...minimal, roast_level: '', roasted_on: '', reference_url: '' });
    expect(ok.roast_level).toBeNull();
    expect(ok.roasted_on).toBeNull();
    expect(ok.reference_url).toBeNull();
    expect(beanFormSchema.safeParse({ ...minimal, roast_level: 'burnt' }).success).toBe(false);
    expect(beanFormSchema.safeParse({ ...minimal, roasted_on: '2026-02-30' }).success).toBe(false);
    expect(beanFormSchema.safeParse({ ...minimal, reference_url: 'kielo' }).success).toBe(false);
    expect(beanFormSchema.parse({ ...minimal, roasted_on: '2026-09-01' }).roasted_on).toBe('2026-09-01');
  });
  it('insert は user_id 必須', () => {
    expect(beanInsertSchema.safeParse(minimal).success).toBe(false);
    expect(beanInsertSchema.safeParse({ ...minimal, user_id: UID }).success).toBe(true);
  });
});

describe('flavorNotesSchema', () => {
  it('未指定は空配列', () => {
    expect(flavorNotesSchema.parse(undefined)).toEqual([]);
  });
});
