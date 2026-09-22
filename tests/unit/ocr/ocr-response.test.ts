import { describe, expect, it } from 'vitest';
import { ocrErrorResponseSchema, ocrResponseSchema } from '@/lib/schemas/ocr-response';

describe('ocr-response schemas', () => {
  it('エラー応答は code と message、任意で usage', () => {
    expect(
      ocrErrorResponseSchema.safeParse({
        error: { code: 'quota_exceeded', message: 'x' },
        usage: { used: 50, limit: 50 },
      }).success,
    ).toBe(true);
    expect(ocrErrorResponseSchema.safeParse({ error: { code: 'nope', message: 'x' } }).success).toBe(false);
  });
  it('成功応答は usage が必須', () => {
    expect(
      ocrResponseSchema.safeParse({
        extraction: {},
        raw: null,
        provider: 'claude',
        model: null,
        durationMs: 1,
      }).success,
    ).toBe(false);
  });
});
