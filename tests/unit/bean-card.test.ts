import { describe, expect, it } from 'vitest';
import { beanCardExtractionSchema } from '@/lib/schemas/bean-card';

const ok = (value: unknown, confidence = 0.9) => ({ value, confidence });

const sample = {
  name: ok('Lusitania Lime Geisha'),
  roaster: ok('KIELO COFFEE'),
  country: ok('Colombia'),
  region: ok('Caicedonia, Valle del Cauca'),
  variety: ok('Geisha'),
  process: ok('Lime infused'),
  altitudeM: ok(1650),
  flavorNotes: ok(['Lime', 'Bergamot', 'Laurier']),
  description: ok('ライムを思わせるシトラス系の…'),
  taste: ok({ flavor: 5, sweetness: 3, acidity: 5, aftertaste: 3, body: 3 }),
  priceJpy: ok(3800),
  priceGrams: ok(100),
  roastLevel: ok(null, 0),
  referenceUrl: ok(null, 0),
};

describe('beanCardExtractionSchema', () => {
  it('サンプルカード相当の抽出結果を受け付ける', () => {
    const r = beanCardExtractionSchema.safeParse(sample);
    expect(r.success).toBe(true);
  });

  it('味覚チャートは 1〜5 の整数のみ', () => {
    const r = beanCardExtractionSchema.safeParse({
      ...sample,
      taste: ok({ flavor: 6, sweetness: null, acidity: null, aftertaste: null, body: null }),
    });
    expect(r.success).toBe(false);
  });

  it('confidence は 0〜1', () => {
    const r = beanCardExtractionSchema.safeParse({ ...sample, name: { value: 'x', confidence: 1.5 } });
    expect(r.success).toBe(false);
  });
});
