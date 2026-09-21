import { describe, expect, it } from 'vitest';
import { tagNameSchema } from '@/lib/schemas/tag';

describe('tagNameSchema', () => {
  it('前後の空白を除く', () => {
    expect(tagNameSchema.parse(' #ゲイシャ ')).toBe('#ゲイシャ');
  });
  it('空・空白のみ・33 文字以上は無効', () => {
    expect(tagNameSchema.safeParse('').success).toBe(false);
    expect(tagNameSchema.safeParse('   ').success).toBe(false);
    expect(tagNameSchema.safeParse('あ'.repeat(33)).success).toBe(false);
    expect(tagNameSchema.safeParse('あ'.repeat(32)).success).toBe(true);
  });
});
