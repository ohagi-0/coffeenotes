// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeoProvider } from '@/lib/geo';

const getUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ createRouteClient: () => ({ auth: { getUser } }) }));
const provider: GeoProvider = {
  name: 'fake',
  searchNearby: vi.fn(async () => [
    { name: 'A', address: null, lat: 1, lng: 2, externalPlaceId: null, distanceM: 10 },
  ]),
  geocode: vi.fn(async ({ query }) => [
    { name: query, address: '住所', lat: 3, lng: 4, externalPlaceId: 'node/1' },
  ]),
};
vi.mock('@/lib/geo/factory', () => ({ getGeoProvider: () => provider }));
const { GET } = await import('@/app/api/geo/route');

const req = (qs: string) => new Request(`http://localhost/api/geo?${qs}`);

beforeEach(() => getUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } } }));

describe('GET /api/geo', () => {
  it('未ログインは 401', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET(req('op=nearby&lat=1&lng=2'))).status).toBe(401);
  });
  it('パラメータ不正は 400', async () => {
    expect((await GET(req('op=nearby&lat=abc&lng=2'))).status).toBe(400);
    expect((await GET(req('op=geocode'))).status).toBe(400);
    expect((await GET(req('op=nearby&lat=1&lng=2&radiusM=99999'))).status).toBe(400);
  });
  it('nearby と geocode を振り分ける', async () => {
    const a = await (await GET(req('op=nearby&lat=35.68&lng=139.76'))).json();
    expect(a.candidates[0].name).toBe('A');
    expect(provider.searchNearby).toHaveBeenCalledWith({ lat: 35.68, lng: 139.76, radiusM: 800 });
    const b = await (await GET(req('op=geocode&q=kielo&lat=1&lng=2'))).json();
    expect(b.candidates[0].name).toBe('kielo');
    expect(provider.geocode).toHaveBeenCalledWith({ query: 'kielo', near: { lat: 1, lng: 2 } });
  });
});
