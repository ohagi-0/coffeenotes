import { describe, expect, it } from 'vitest';
import { formatDuration, parseDuration, roastFormSchema, weightLossPercent } from '@/lib/schemas/roast';

describe('roastFormSchema', () => {
  it('焙煎日だけで有効、他は任意', () => {
    const r = roastFormSchema.parse({ roasted_on: '2026-09-22' });
    expect(r.roast_level).toBeNull();
    expect(r.green_shop_id).toBeNull();
  });
  it('焙煎度は 5 段階のみ、重量は正の整数', () => {
    expect(roastFormSchema.safeParse({ roasted_on: '2026-09-22', roast_level: 'burnt' }).success).toBe(false);
    expect(roastFormSchema.safeParse({ roasted_on: '2026-09-22', green_grams: 0 }).success).toBe(false);
    expect(
      roastFormSchema.parse({ roasted_on: '2026-09-22', green_grams: '200', roasted_grams: '170' }),
    ).toMatchObject({ green_grams: 200, roasted_grams: 170 });
  });
});

describe('weightLossPercent / duration', () => {
  it('減率は小数 1 桁', () => {
    expect(weightLossPercent(200, 170)).toBe(15);
    expect(weightLossPercent(300, 251)).toBe(16.3);
    expect(weightLossPercent(null, 170)).toBeNull();
  });
  it('分:秒の表記と解釈', () => {
    expect(formatDuration(750)).toBe('12:30');
    expect(formatDuration(59)).toBe('0:59');
    expect(parseDuration('12:30')).toBe(750);
    expect(parseDuration('750')).toBe(750);
    expect(parseDuration('12:60')).toBeNull();
    expect(parseDuration('')).toBeNull();
  });
});
