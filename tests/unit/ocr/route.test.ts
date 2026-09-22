// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OcrError, type OcrProvider } from '@/lib/ocr';

// /api/ocr の振る舞い（認証 → 上限 → プロバイダ → 応答）を、Supabase とプロバイダを差し替えて確かめる。
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createRouteClient: () => ({ auth: { getUser }, rpc }),
}));
const getOcrProvider = vi.fn<() => OcrProvider | null>();
vi.mock('@/lib/ocr/factory', () => ({ getOcrProvider: () => getOcrProvider() }));

const { POST } = await import('@/app/api/ocr/route');

const jpeg = (size = 4) => new Blob([new Uint8Array(size)], { type: 'image/jpeg' });
function request(parts: Record<string, Blob | string> = { front: jpeg() }) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(parts)) fd.append(k, v);
  return new Request('http://localhost/api/ocr', { method: 'POST', body: fd });
}
const okProvider: OcrProvider = {
  name: 'fake',
  extractBeanCard: async () => ({
    extraction: {} as never,
    raw: { ok: true },
    provider: 'fake',
    model: 'fake-1',
    durationMs: 12,
  }),
};

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } } });
  rpc.mockReset().mockResolvedValue({ data: [{ used: 3, daily_limit: 50, allowed: true }], error: null });
  getOcrProvider.mockReset().mockReturnValue(okProvider);
});

describe('POST /api/ocr', () => {
  it('未ログインは 401', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('unauthorized');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('OCR_PROVIDER=none は 503 ocr_disabled（上限を消費しない）', async () => {
    getOcrProvider.mockReturnValue(null);
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('ocr_disabled');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('表面が無ければ 400、PDF は 415、大きすぎれば 413', async () => {
    expect((await POST(request({}))).status).toBe(400);
    expect((await POST(request({ front: new Blob(['x'], { type: 'application/pdf' }) }))).status).toBe(415);
    expect((await POST(request({ front: jpeg(5 * 1024 * 1024 + 1) }))).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('上限に達していれば 429 と usage', async () => {
    rpc.mockResolvedValue({ data: [{ used: 50, daily_limit: 50, allowed: false }], error: null });
    const res = await POST(request());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe('quota_exceeded');
    expect(body.usage).toEqual({ used: 50, limit: 50 });
  });
  it('成功時は抽出結果・生出力・usage を返す', async () => {
    const res = await POST(request({ front: jpeg(), back: jpeg() }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe('fake');
    expect(body.raw).toEqual({ ok: true });
    expect(body.usage).toEqual({ used: 3, limit: 50 });
    expect(rpc).toHaveBeenCalledWith('consume_ocr_quota');
  });
  it('プロバイダの timeout は 504、invalid_output は 502（usage 付き）', async () => {
    getOcrProvider.mockReturnValue({
      name: 'fake',
      extractBeanCard: async () => {
        throw new OcrError('遅い', 'timeout');
      },
    });
    const t = await POST(request());
    expect(t.status).toBe(504);
    expect((await t.json()).usage).toEqual({ used: 3, limit: 50 });
    getOcrProvider.mockReturnValue({
      name: 'fake',
      extractBeanCard: async () => {
        throw new OcrError('形式', 'invalid_output');
      },
    });
    expect((await POST(request())).status).toBe(502);
  });
});
