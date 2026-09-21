import { afterEach, describe, expect, it, vi } from 'vitest';
import { canShare, PlatformShareError, share } from '@/lib/platform/share';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canShare', () => {
  it('navigator.share が無ければ false', () => {
    vi.stubGlobal('navigator', {} as Navigator);
    expect(canShare()).toBe(false);
  });

  it('navigator.canShare の判定に従う', () => {
    vi.stubGlobal('navigator', { share: vi.fn(), canShare: () => false } as unknown as Navigator);
    expect(canShare({ url: 'https://example.com' })).toBe(false);
  });
});

describe('share', () => {
  it('非対応なら false を返し、例外にしない', async () => {
    vi.stubGlobal('navigator', {} as Navigator);
    await expect(share({ url: 'https://example.com' })).resolves.toBe(false);
  });

  it('共有できたら true', async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share: shareSpy } as unknown as Navigator);
    await expect(share({ title: 'a', url: 'https://example.com' })).resolves.toBe(true);
    expect(shareSpy).toHaveBeenCalledWith({ title: 'a', url: 'https://example.com' });
  });

  it('キャンセル（AbortError）は false', async () => {
    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(new DOMException('canceled', 'AbortError')),
    } as unknown as Navigator);
    await expect(share({ url: 'https://example.com' })).resolves.toBe(false);
  });

  it('それ以外の失敗は PlatformShareError', async () => {
    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as Navigator);
    await expect(share({ url: 'https://example.com' })).rejects.toBeInstanceOf(PlatformShareError);
  });
});
