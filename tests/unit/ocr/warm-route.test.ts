// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OcrError, type OcrProvider } from '@/lib/ocr';
import { resetEnvCacheForTest } from '@/lib/env';

// /api/ocr/warm の振る舞い（合言葉 → プロバイダの warmUp）。プロバイダは差し替える。
const getOcrProvider = vi.fn<() => OcrProvider | null>();
vi.mock('@/lib/ocr/factory', () => ({ getOcrProvider: () => getOcrProvider() }));

const { POST, GET } = await import('@/app/api/ocr/warm/route');

const SECRET = 'test-secret-0123456789abcdef';
const warmUp = vi.fn();
const provider: OcrProvider = { name: 'fake', extractBeanCard: vi.fn(), warmUp };

function request(token?: string, method = 'POST') {
  return new Request('http://localhost/api/ocr/warm', {
    method,
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
  resetEnvCacheForTest();
  getOcrProvider.mockReset().mockReturnValue(provider);
  warmUp.mockReset().mockResolvedValue({ provider: 'fake', model: 'fake-1', durationMs: 1234 });
});
afterEach(() => {
  delete process.env.CRON_SECRET;
  resetEnvCacheForTest();
});

describe('/api/ocr/warm', () => {
  it('CRON_SECRET が未設定なら 503（プロバイダを呼ばない）', async () => {
    delete process.env.CRON_SECRET;
    resetEnvCacheForTest();
    const res = await POST(request(SECRET));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('not_configured');
    expect(warmUp).not.toHaveBeenCalled();
  });
  it('合言葉が無い・違うと 401', async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request('wrong'))).status).toBe(401);
    expect((await POST(request(SECRET + 'x'))).status).toBe(401);
    expect(warmUp).not.toHaveBeenCalled();
  });
  it('合言葉が合えば warmUp を呼び、結果を返す（GET でも同じ）', async () => {
    const res = await POST(request(SECRET));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ warmed: true, provider: 'fake', model: 'fake-1', durationMs: 1234 });
    const res2 = await GET(request(SECRET, 'GET'));
    expect(res2.status).toBe(200);
    expect(warmUp).toHaveBeenCalledTimes(2);
  });
  it('OCR_PROVIDER=none なら 200 で warmed: false（ジョブは失敗にしない）', async () => {
    getOcrProvider.mockReturnValue(null);
    const res = await POST(request(SECRET));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ warmed: false, reason: 'ocr_disabled' });
  });
  it('プロバイダのエラーは 502 にコードと文言を写す', async () => {
    warmUp.mockRejectedValue(new OcrError('ウォームアップが時間内に終わりませんでした', 'timeout'));
    const res = await POST(request(SECRET));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      warmed: false,
      error: { code: 'timeout', message: 'ウォームアップが時間内に終わりませんでした' },
    });
  });
});
