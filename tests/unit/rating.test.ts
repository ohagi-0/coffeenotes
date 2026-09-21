import { describe, expect, it } from 'vitest';
import { ratingSchema } from '@/lib/schemas/rating';

describe('ratingSchema（星 0.5 刻み）', () => {
  it.each([1, 1.5, 3, 4.5, 5])('%s は有効', (v) => {
    expect(ratingSchema.safeParse(v).success).toBe(true);
  });

  it.each([0, 0.5, 5.5, 3.3, 4.25, -1])('%s は無効', (v) => {
    expect(ratingSchema.safeParse(v).success).toBe(false);
  });
});
