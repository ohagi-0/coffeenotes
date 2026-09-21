import { describe, expect, it } from 'vitest';
import { escapeLike, isNoRows, isUniqueViolation } from '@/lib/supabase/errors';

describe('supabase errors', () => {
  it('isUniqueViolation は 23505 だけ真', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ code: '42501' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(new Error('x'))).toBe(false);
  });
  it('isNoRows は PGRST116 だけ真', () => {
    expect(isNoRows({ code: 'PGRST116' })).toBe(true);
    expect(isNoRows({ code: '23505' })).toBe(false);
  });
  it('escapeLike は % _ \\ をエスケープする', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
    expect(escapeLike('kielo')).toBe('kielo');
  });
});
