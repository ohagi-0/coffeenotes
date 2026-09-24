// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { beanCardExtractionSchema } from '@/lib/schemas/bean-card';
import { sanitizeExtraction } from '@/lib/ocr/providers/claude';
import { extractionToBeanForm } from '@/features/ocr/to-bean-form';
import { beanFormSchema } from '@/lib/schemas/bean';

const fixture = JSON.parse(readFileSync('tests/fixtures/cards/sample-card-front.recorded.json', 'utf8'));
const extraction = beanCardExtractionSchema.parse(sanitizeExtraction(fixture.response.content[0].input));

describe('extractionToBeanForm', () => {
  it('値のある項目だけをフォームの初期値と信頼度に写す', () => {
    const { values, confidence } = extractionToBeanForm(extraction);
    expect(values.name).toBe('Lusitania Lime Geisha');
    expect(values.roaster_name).toBe('KIELO COFFEE');
    expect(values.altitude_m).toBe(1650);
    expect(values.flavor_notes).toEqual(['Lime', 'Bergamot', 'Laurier']);
    expect(values.taste_flavor).toBe(5);
    expect(values.price_jpy).toBe(3800);
    expect('description' in values).toBe(false);
    expect('roast_level' in values).toBe(false);
    // 信頼度は録画済み応答の confidence オブジェクトの値がそのまま写る
    const recorded = fixture.response.content[0].input.confidence;
    expect(confidence.name).toBeCloseTo(recorded.name);
    expect(confidence.taste_body).toBeCloseTo(recorded.taste);
    expect(confidence.description).toBeUndefined();
  });
  it('初期値は豆フォームのスキーマに（ロースター ID を足せば）通る', () => {
    const { values } = extractionToBeanForm(extraction);
    const r = beanFormSchema.safeParse({
      ...values,
      source: 'purchased',
      roaster_id: '11111111-1111-4111-8111-111111111111',
    });
    expect(r.success).toBe(true);
  });
});
