import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { dateStringSchema, emptyToNull, numberOrNull, textOrNull } from '@/lib/schemas/common';

describe('dateStringSchema', () => {
  it.each(['2026-09-21', '2024-02-29', '2026-12-31'])('%s は有効', (v) => {
    expect(dateStringSchema.safeParse(v).success).toBe(true);
  });
  it.each(['2026-02-30', '2026-13-01', '2023-02-29', '2026/09/21', '20260921', ''])('%s は無効', (v) => {
    expect(dateStringSchema.safeParse(v).success).toBe(false);
  });
});

describe('emptyToNull', () => {
  it('空文字と空白のみを null にする', () => {
    expect(emptyToNull('')).toBeNull();
    expect(emptyToNull('   ')).toBeNull();
  });
  it('それ以外はそのまま', () => {
    expect(emptyToNull('a')).toBe('a');
    expect(emptyToNull(0)).toBe(0);
    expect(emptyToNull(null)).toBeNull();
    expect(emptyToNull(undefined)).toBeUndefined();
  });
});

describe('textOrNull', () => {
  const s = textOrNull(5);
  it('空・未指定は null、あれば trim', () => {
    expect(s.parse('')).toBeNull();
    expect(s.parse(undefined)).toBeNull();
    expect(s.parse(' ab ')).toBe('ab');
  });
  it('上限を超えると無効', () => {
    expect(s.safeParse('abcdef').success).toBe(false);
  });
});

describe('numberOrNull', () => {
  const s = numberOrNull(z.number().int().min(0));
  it('空文字・NaN・undefined は null', () => {
    expect(s.parse('')).toBeNull();
    expect(s.parse(Number.NaN)).toBeNull();
    expect(s.parse(undefined)).toBeNull();
  });
  it('数値文字列は数値に変換して検証する', () => {
    expect(s.parse('1650')).toBe(1650);
    expect(s.safeParse('-1').success).toBe(false);
    expect(s.safeParse('abc').success).toBe(false);
  });
});
