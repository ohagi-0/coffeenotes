// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { distanceM } from '@/lib/geo';
import {
  addressFromTags,
  candidatesFromNominatim,
  candidatesFromOverpass,
  createNominatimProvider,
  GEO_USER_AGENT,
} from '@/lib/geo/providers/nominatim';

const TOKYO = { lat: 35.6812, lng: 139.7671 };

describe('distanceM', () => {
  it('東京駅〜新宿駅はおよそ 6.5km', () => {
    expect(distanceM(TOKYO, { lat: 35.6896, lng: 139.7006 })).toBeGreaterThan(6000);
    expect(distanceM(TOKYO, { lat: 35.6896, lng: 139.7006 })).toBeLessThan(7000);
  });
});

describe('candidatesFromOverpass', () => {
  it('名前のある要素だけを近い順に返し、way は center を使う', () => {
    const list = candidatesFromOverpass(
      [
        { type: 'node', id: 1, lat: 35.69, lon: 139.77, tags: { name: '遠い店' } },
        {
          type: 'way',
          id: 2,
          center: { lat: 35.6815, lon: 139.7675 },
          tags: { name: 'Near Cafe', 'name:ja': '近い店', 'addr:city': '千代田区' },
        },
        { type: 'node', id: 3, lat: 35.68, lon: 139.76, tags: { amenity: 'cafe' } },
      ],
      TOKYO,
    );
    expect(list.map((c) => c.name)).toEqual(['近い店', '遠い店']);
    expect(list[0]).toMatchObject({ externalPlaceId: 'way/2', address: '千代田区' });
    expect(list[0]!.distanceM).toBeLessThan(list[1]!.distanceM!);
  });
});

describe('addressFromTags', () => {
  it('addr:* を日本の表記順につなぐ', () => {
    expect(
      addressFromTags({
        'addr:province': '東京都',
        'addr:city': '渋谷区',
        'addr:quarter': '神宮前',
        'addr:block_number': '3',
        'addr:housenumber': '12',
      }),
    ).toBe('東京都渋谷区神宮前3-12');
    expect(addressFromTags(undefined)).toBeNull();
    expect(addressFromTags({ name: 'x' })).toBeNull();
  });
});

describe('candidatesFromNominatim', () => {
  it('lat/lon の文字列を数値にし、名前は name か display_name の先頭', () => {
    const list = candidatesFromNominatim([
      {
        lat: '35.6',
        lon: '139.7',
        display_name: 'KIELO COFFEE, 渋谷区, 東京都',
        osm_type: 'node',
        osm_id: 9,
        address: { state: '東京都', city: '渋谷区' },
      },
      { lat: 'x', lon: '1', display_name: 'bad' },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      name: 'KIELO COFFEE',
      address: '東京都渋谷区',
      externalPlaceId: 'node/9',
    });
  });
});

describe('createNominatimProvider', () => {
  it('searchNearby は Overpass に POST し、User-Agent を付ける', async () => {
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)['User-Agent']).toBe(GEO_USER_AGENT);
      return new Response(
        JSON.stringify({
          elements: [{ type: 'node', id: 1, lat: 35.682, lon: 139.767, tags: { name: 'A' } }],
        }),
        { status: 200 },
      );
    });
    const list = await createNominatimProvider(fetchImpl as unknown as typeof fetch).searchNearby({
      ...TOKYO,
      radiusM: 500,
    });
    expect(list).toHaveLength(1);
    expect(String(fetchImpl.mock.calls[0]![0])).toContain('overpass');
  });
  it('geocode は空文字なら呼ばず、HTTP エラーは provider', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 503 }));
    const p = createNominatimProvider(fetchImpl as unknown as typeof fetch);
    expect(await p.geocode({ query: '   ' })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(p.geocode({ query: 'kielo' })).rejects.toMatchObject({ code: 'provider' });
  });
});
