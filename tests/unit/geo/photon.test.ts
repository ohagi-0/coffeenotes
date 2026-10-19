// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { candidatesFromPhoton, photonReverseUrl, photonSearchUrl } from '@/lib/geo/providers/photon';
import { createNominatimProvider } from '@/lib/geo/providers/nominatim';

const SHIBUYA = { lat: 35.658, lng: 139.7016 };
const feature = (name: string, extra: Record<string, unknown> = {}) => ({
  properties: {
    osm_type: 'N',
    osm_id: 1,
    name,
    city: '東京都',
    district: '渋谷区',
    locality: '富ヶ谷',
    countrycode: 'JP',
    ...extra,
  },
  geometry: { coordinates: [139.69, 35.667] as [number, number] },
});

describe('candidatesFromPhoton', () => {
  it('ID を "node/1" の形にそろえ、住所を日本の順につなぎ、近さを付ける', () => {
    const [c] = candidatesFromPhoton([feature('Fuglen Tokyo')], SHIBUYA);
    expect(c).toMatchObject({
      name: 'Fuglen Tokyo',
      externalPlaceId: 'node/1',
      address: '東京都渋谷区富ヶ谷',
    });
    expect(c!.distanceM).toBeGreaterThan(500);
  });
  it('名前の無いもの・日本以外は捨てる', () => {
    expect(candidatesFromPhoton([feature(''), feature('Fuglen', { countrycode: 'NO' })])).toEqual([]);
  });
});

describe('photon の URL', () => {
  it('店名検索は現在地とカフェのタグ付き', () => {
    const u = new URL(photonSearchUrl('フグレン', SHIBUYA, 15));
    expect(u.pathname).toBe('/api');
    expect(u.searchParams.get('q')).toBe('フグレン');
    expect(u.searchParams.get('lat')).toBe('35.658');
    expect(u.searchParams.getAll('osm_tag')).toEqual(['amenity:cafe', 'shop:coffee']);
  });
  it('周辺は km 単位、件数は 50 まで', () => {
    const u = new URL(photonReverseUrl(35.6, 139.7, 2000, 300));
    expect(u.searchParams.get('radius')).toBe('2');
    expect(u.searchParams.get('limit')).toBe('50');
  });
});

describe('OSM プロバイダの切り替え', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('Overpass も Photon も失敗したら Overpass のエラーを返す', async () => {
    const fetchImpl = vi.fn(async () => new Response('busy', { status: 503 }));
    await expect(
      createNominatimProvider(fetchImpl as unknown as typeof fetch).searchNearby({ ...SHIBUYA }),
    ).rejects.toMatchObject({ code: 'provider', message: expect.stringContaining('Overpass') });
  });

  it('Overpass が本家・予備とも失敗したら Photon の周辺検索に切り替える', async () => {
    const fetchImpl = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes('overpass')) return new Response('busy', { status: 504 });
      return json({ features: [feature('タリーズコーヒー')] });
    });
    const list = await createNominatimProvider(fetchImpl as unknown as typeof fetch).searchNearby({
      ...SHIBUYA,
      radiusM: 2000,
      limit: 300,
    });
    expect(list.map((c) => c.name)).toEqual(['タリーズコーヒー']);
    // Photon は待たせないよう最初に同時に投げる
    expect(fetchImpl.mock.calls.map((c) => new URL(String(c[0])).host).sort()).toEqual([
      'overpass-api.de',
      'overpass.private.coffee',
      'photon.komoot.io',
    ]);
  });

  it('周辺検索は同じ場所なら使い回す（Overpass を 2 回叩かない）', async () => {
    const fetchImpl = vi.fn<(url: unknown) => Promise<Response>>(async () =>
      json({
        elements: [{ type: 'node', id: 1, lat: 35.659, lon: 139.702, tags: { name: 'A', 'name:en': 'Ay' } }],
      }),
    );
    const p = createNominatimProvider(fetchImpl as unknown as typeof fetch);
    const a = await p.searchNearby({ ...SHIBUYA, limit: 300 });
    const b = await p.searchNearby({ ...SHIBUYA, limit: 300 });
    // 1 回目の Overpass + 同時に投げた Photon の 2 回だけ
    expect(fetchImpl.mock.calls.filter((c) => String(c[0]).includes('overpass'))).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(b).toEqual(a);
    expect(a[0]!.aliases).toEqual(['Ay']);
  });

  it('かなだけの検索語はローマ字でも引き、結果をまとめる', async () => {
    const fetchImpl = vi.fn(async (url: unknown) => {
      const q = new URL(String(url)).searchParams.get('q');
      return json({ features: q === 'fuguren' ? [feature('Fuglen Tokyo')] : [] });
    });
    const list = await createNominatimProvider(fetchImpl as unknown as typeof fetch).searchPlaces({
      query: 'フグレン',
      near: SHIBUYA,
    });
    expect(list.map((c) => c.name)).toEqual(['Fuglen Tokyo']);
    expect(fetchImpl.mock.calls.map((c) => new URL(String(c[0])).searchParams.get('q'))).toEqual([
      'フグレン',
      'fuguren',
    ]);
  });

  it('Overpass が固まっていたら、Photon が返ってから少し待って Photon の結果を使う', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((url: unknown) =>
      String(url).includes('overpass')
        ? new Promise<Response>(() => {})
        : Promise.resolve(json({ features: [feature('タリーズコーヒー')] })),
    );
    const p = createNominatimProvider(fetchImpl as unknown as typeof fetch).searchNearby({ ...SHIBUYA });
    await vi.advanceTimersByTimeAsync(2_100);
    expect((await p).map((c) => c.name)).toEqual(['タリーズコーヒー']);
    vi.useRealTimers();
  });

  it('店名検索は Photon、失敗したら Nominatim に切り替える', async () => {
    const fetchImpl = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes('photon')) return new Response('down', { status: 502 });
      return json([
        {
          lat: '35.66',
          lon: '139.69',
          name: 'Fuglen Tokyo',
          display_name: 'Fuglen Tokyo, 渋谷区',
          osm_type: 'node',
          osm_id: 1,
        },
      ]);
    });
    const list = await createNominatimProvider(fetchImpl as unknown as typeof fetch).searchPlaces({
      query: 'Fuglen',
      near: SHIBUYA,
    });
    expect(list[0]).toMatchObject({ name: 'Fuglen Tokyo', externalPlaceId: 'node/1' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
