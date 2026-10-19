// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { GeoError } from '@/lib/geo';
import {
  DETAILS_FIELD_MASK,
  NEARBY_FIELD_MASK,
  candidateFromPlaceDetails,
  candidatesFromGoogleNearby,
  createGoogleProvider,
  suggestionsFromAutocomplete,
} from '@/lib/geo/providers/google';

// tests/fixtures/geo/ は実 API（Places API (New)）の応答を 1 回録画したもの。鍵は含まない。
const fx = (name: string): unknown => JSON.parse(readFileSync(`tests/fixtures/geo/${name}.json`, 'utf8'));
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('変換関数', () => {
  it('Nearby の応答を候補にし、place_id をそのまま使う', () => {
    const list = candidatesFromGoogleNearby(fx('google-nearby'));
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toMatchObject({
      externalPlaceId: 'ChIJyW-BGzaLGGARYZlDAwIZ6KY',
      name: 'BETWEEN by THE YOMOGI STAND',
    });
    expect(list[0].address).not.toMatch(/〒/);
    expect(typeof list[0].lat).toBe('number');
  });
  it('Autocomplete の応答は座標なしの予測になり、距離が付く', () => {
    const list = suggestionsFromAutocomplete(fx('google-autocomplete'));
    expect(list[0]).toEqual({
      externalPlaceId: 'ChIJrWB6lbKMGGARp0QB0mMSNe4',
      name: 'フグレントウキョウ',
      address: '東京都渋谷区富ケ谷１丁目１６−１１',
      distanceM: 1269,
    });
    expect('lat' in list[0]).toBe(false);
  });
  it('Place Details の応答から座標つきの候補を作る', () => {
    expect(candidateFromPlaceDetails(fx('google-details'))).toMatchObject({
      name: 'FUGLEN TOKYO',
      externalPlaceId: 'ChIJrWB6lbKMGGARp0QB0mMSNe4',
      lat: 35.6666181,
    });
  });
  it('places が無い応答は空、形が違えば invalid_output', () => {
    expect(candidatesFromGoogleNearby({})).toEqual([]);
    expect(() => candidatesFromGoogleNearby({ places: [{ id: 1 }] })).toThrowError(GeoError);
    expect(candidateFromPlaceDetails({ id: 'x' })).toBeNull();
  });
});

describe('createGoogleProvider', () => {
  it('searchNearby は FieldMask・鍵・カフェ種別つきで POST し、距離を足す', async () => {
    const f = vi.fn(async () => jsonRes(fx('google-nearby')));
    const p = createGoogleProvider('KEY', f as unknown as typeof fetch);
    const list = await p.searchNearby({ lat: 35.658, lng: 139.7016, radiusM: 800, limit: 400 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchNearby');
    const h = init.headers as Record<string, string>;
    expect(h['X-Goog-Api-Key']).toBe('KEY');
    expect(h['X-Goog-FieldMask']).toBe(NEARBY_FIELD_MASK);
    expect(NEARBY_FIELD_MASK).not.toMatch(/rating|photos/);
    const body = JSON.parse(init.body as string);
    expect(body.includedTypes).toEqual(['cafe', 'coffee_shop']);
    expect(body.maxResultCount).toBe(20);
    expect(body.rankPreference).toBe('DISTANCE');
    expect(list[0].distanceM).toBeLessThan(100);
  });
  it('suggestPlaces は origin とセッショントークンを送る', async () => {
    const f = vi.fn(async () => jsonRes(fx('google-autocomplete')));
    const p = createGoogleProvider('KEY', f as unknown as typeof fetch);
    const list = await p.suggestPlaces({
      query: 'フグレン',
      near: { lat: 1, lng: 2 },
      sessionToken: 'tok',
      limit: 2,
    });
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({
      input: 'フグレン',
      origin: { latitude: 1, longitude: 2 },
      sessionToken: 'tok',
      includedPrimaryTypes: ['cafe', 'coffee_shop'],
    });
    expect(list).toHaveLength(2);
  });
  it('placeDetails は GET で FieldMask とセッションを付ける', async () => {
    const f = vi.fn(async () => jsonRes(fx('google-details')));
    const p = createGoogleProvider('KEY', f as unknown as typeof fetch);
    const c = await p.placeDetails({ placeId: 'ChIJrWB6lbKMGGARp0QB0mMSNe4', sessionToken: 'tok' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/places/ChIJrWB6lbKMGGARp0QB0mMSNe4?');
    expect(url).toContain('sessionToken=tok');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['X-Goog-FieldMask']).toBe(DETAILS_FIELD_MASK);
    expect(c?.name).toBe('FUGLEN TOKYO');
  });
  it('403 / 429 は上限か設定エラーと分かる文言、5xx は provider、ネットワーク断も provider', async () => {
    for (const status of [403, 429]) {
      const p = createGoogleProvider('K', (async () => jsonRes({}, status)) as unknown as typeof fetch);
      await expect(p.suggestPlaces({ query: 'a' })).rejects.toThrow(/上限か設定エラー/);
    }
    const p500 = createGoogleProvider('K', (async () => jsonRes({}, 500)) as unknown as typeof fetch);
    await expect(p500.searchNearby({ lat: 1, lng: 2 })).rejects.toMatchObject({ code: 'provider' });
    const pNet = createGoogleProvider('K', (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch);
    await expect(pNet.placeDetails({ placeId: 'x' })).rejects.toMatchObject({ code: 'provider' });
  });
  it('10 秒で応答が無ければ timeout', async () => {
    vi.useFakeTimers();
    const never = ((_: string, init: RequestInit) =>
      new Promise((_res, rej) => {
        init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
      })) as unknown as typeof fetch;
    const p = createGoogleProvider('K', never);
    const assertion = expect(p.searchNearby({ lat: 1, lng: 2 })).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(10_001);
    await assertion;
    vi.useRealTimers();
  });

  it('refreshPlace: 通常は ok、movedPlaceId があれば moved、404 は not_found（FieldMask に movedPlaceId）', async () => {
    const f = vi.fn(async () => jsonRes(fx('google-details')));
    const p = createGoogleProvider('KEY', f as unknown as typeof fetch);
    const r = await p.refreshPlace('ChIJrWB6lbKMGGARp0QB0mMSNe4');
    expect(r).toMatchObject({ status: 'ok', place: { name: 'FUGLEN TOKYO' } });
    const mask = ((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>)[
      'X-Goog-FieldMask'
    ];
    expect(mask).toContain('movedPlaceId');

    const moved = createGoogleProvider('KEY', (async () =>
      jsonRes({ id: 'old', movedPlaceId: 'new' })) as unknown as typeof fetch);
    expect(await moved.refreshPlace('old')).toEqual({ status: 'moved', movedPlaceId: 'new' });

    const gone = createGoogleProvider('KEY', (async () => jsonRes({}, 404)) as unknown as typeof fetch);
    expect(await gone.refreshPlace('x')).toEqual({ status: 'not_found' });

    const flaky = createGoogleProvider('KEY', (async () => jsonRes({}, 503)) as unknown as typeof fetch);
    await expect(flaky.refreshPlace('x')).rejects.toMatchObject({ code: 'provider' });
  });
});
