import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_EDGE, DEFAULT_QUALITY, fitWithin, ImageCompressError } from '@/lib/image/compress';

describe('fitWithin', () => {
  it('横長は幅を上限に合わせ、縦横比を保つ', () => {
    expect(fitWithin(3000, 2000, 1600)).toEqual({ width: 1600, height: 1067 });
  });

  it('縦長は高さを上限に合わせ、縦横比を保つ', () => {
    expect(fitWithin(2000, 3000, 1600)).toEqual({ width: 1067, height: 1600 });
  });

  it('正方形は両辺が上限になる', () => {
    expect(fitWithin(4000, 4000, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it('長辺が上限以下なら拡大しない', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 900, 1600)).toEqual({ width: 1600, height: 900 });
  });

  it('極端に細長くても 0px にならない', () => {
    expect(fitWithin(6000, 2, 1600)).toEqual({ width: 1600, height: 1 });
  });

  it.each([
    [0, 100],
    [100, 0],
    [-1, 100],
    [Number.NaN, 100],
  ])('寸法 %s x %s は弾く', (w, h) => {
    expect(() => fitWithin(w, h, 1600)).toThrow(ImageCompressError);
  });

  it('maxEdge が 0 以下なら弾く', () => {
    expect(() => fitWithin(100, 100, 0)).toThrow(ImageCompressError);
  });
});

describe('既定値', () => {
  it('REQUIREMENTS.md §9 の長辺 1,600px・品質 0.8', () => {
    expect(DEFAULT_MAX_EDGE).toBe(1600);
    expect(DEFAULT_QUALITY).toBe(0.8);
  });
});
