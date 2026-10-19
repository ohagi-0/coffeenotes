// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/places/refresh（Google の店の 30 日更新）。合言葉なしは 401、設定が足りなければ 503、成功すれば件数の JSON。
const refreshGoogleShops = vi.fn();
vi.mock('@/features/shops/refresh-google-shops', () => ({ refreshGoogleShops }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => ({}) }));
vi.mock('@/lib/geo/providers/google', () => ({ createGoogleProvider: () => ({ refreshPlace: vi.fn() }) }));
vi.mock('server-only', () => ({}));

const SECRET = 'x'.repeat(24);
const req = (auth?: string) =>
  new Request('http://localhost/api/places/refresh', {
    method: 'POST',
    headers: auth ? { Authorization: auth } : {},
  });

async function load() {
  vi.resetModules();
  return (await import('@/app/api/places/refresh/route')).POST;
}

beforeEach(() => {
  refreshGoogleShops.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3100';
  process.env.CRON_SECRET = SECRET;
  process.env.GOOGLE_MAPS_API_KEY = 'gkey';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
});

describe('POST /api/places/refresh', () => {
  it('合言葉が無い・違うと 401（更新は走らない）', async () => {
    const POST = await load();
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req('Bearer wrong'))).status).toBe(401);
    expect(refreshGoogleShops).not.toHaveBeenCalled();
  });

  it('CRON_SECRET や鍵が未設定なら 503', async () => {
    delete process.env.CRON_SECRET;
    expect((await (await load())(req(`Bearer ${SECRET}`))).status).toBe(503);
    process.env.CRON_SECRET = SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect((await (await load())(req(`Bearer ${SECRET}`))).status).toBe(503);
  });

  it('成功すると件数を JSON で返し、キャッシュさせない', async () => {
    refreshGoogleShops.mockResolvedValue({ refreshed: 3, moved: 1, demoted: 0, failed: 0 });
    const res = await (await load())(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ refreshed: 3, moved: 1, demoted: 0, failed: 0 });
  });

  it('途中で例外が出たら 500', async () => {
    refreshGoogleShops.mockRejectedValue(new Error('db down'));
    const res = await (await load())(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(500);
  });
});
