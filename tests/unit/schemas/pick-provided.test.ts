import { describe, expect, it } from 'vitest';
import { beanFormSchema } from '@/lib/schemas/bean';
import { pickProvided } from '@/lib/schemas/common';

describe('pickProvided（部分更新で省略した項目を消さない）', () => {
  it('渡したキーだけが残る', () => {
    const patch = { name: ' New ', altitude_m: '1200' };
    const values = pickProvided(beanFormSchema.partial().parse(patch), patch);
    expect(values).toEqual({ name: 'New', altitude_m: 1200 });
    expect('country' in values).toBe(false);
    expect('flavor_notes' in values).toBe(false);
  });
  it('undefined を明示的に渡したキーも送らない', () => {
    const patch = { name: 'A', country: undefined };
    const values = pickProvided(beanFormSchema.partial().parse(patch), patch);
    expect(values).toEqual({ name: 'A' });
  });
  it('空文字を渡したキーは null として送る（値を消す意図）', () => {
    const patch = { country: '' };
    const values = pickProvided(beanFormSchema.partial().parse(patch), patch);
    expect(values).toEqual({ country: null });
  });
});
