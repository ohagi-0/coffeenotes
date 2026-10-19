import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isStaleGoogleShop,
  refreshGoogleShops,
  REFRESH_STALE_DAYS,
} from '@/features/shops/refresh-google-shops';
import type { RefreshPlaceResult } from '@/lib/geo/providers/google';
import type { Database } from '@/types/database';
import { fakeClient } from './fake-client';

// Google の店の 30 日更新（ADR 0011）。更新 / 移転 / 消滅 / 一時失敗の 4 分岐と、対象の絞り込み。
const ok = <T>(data: T) => ({ data, error: null });
const NOW = new Date('2026-11-01T00:00:00Z');
const now = () => NOW;
const place = (name: string) => ({ name, address: '渋谷区', lat: 35.6, lng: 139.7, externalPlaceId: 'x' });
const okResult = (name: string): RefreshPlaceResult => ({ status: 'ok', place: place(name) });

describe('refreshGoogleShops', () => {
  it('更新: 名前・住所・座標と place_synced_at を取り直した値にする', async () => {
    const { client, calls } = fakeClient({
      selects: [ok([{ id: 's1', external_place_id: 'p1' }])],
      updates: [ok(null)],
    });
    const refresh = vi.fn(async () => okResult('FUGLEN TOKYO'));
    expect(await refreshGoogleShops(client, refresh, { now })).toEqual({
      refreshed: 1,
      moved: 0,
      demoted: 0,
      failed: 0,
    });
    expect(refresh).toHaveBeenCalledWith('p1');
    expect(calls[1]!.payload).toEqual({
      name: 'FUGLEN TOKYO',
      address: '渋谷区',
      lat: 35.6,
      lng: 139.7,
      place_synced_at: NOW.toISOString(),
    });
  });

  it('移転: 新しい place_id に付け替え、その最新の写しで更新する', async () => {
    const { client, calls } = fakeClient({
      selects: [ok([{ id: 's1', external_place_id: 'old' }])],
      updates: [ok(null)],
    });
    const refresh = vi.fn(async (id: string): Promise<RefreshPlaceResult> =>
      id === 'old' ? { status: 'moved', movedPlaceId: 'new' } : okResult('新店舗'),
    );
    const r = await refreshGoogleShops(client, refresh, { now });
    expect(r).toEqual({ refreshed: 0, moved: 1, demoted: 0, failed: 0 });
    expect(refresh.mock.calls.map((c) => c[0])).toEqual(['old', 'new']);
    expect(calls[1]!.payload).toMatchObject({ external_place_id: 'new', name: '新店舗' });
  });

  it('消滅: 手入力の店に落とす（名前は残し、ID・住所・座標・出どころを消す）', async () => {
    const { client, calls } = fakeClient({
      selects: [ok([{ id: 's1', external_place_id: 'gone' }])],
      updates: [ok(null)],
    });
    const r = await refreshGoogleShops(client, async () => ({ status: 'not_found' }), { now });
    expect(r).toEqual({ refreshed: 0, moved: 0, demoted: 1, failed: 0 });
    expect(calls[1]!.payload).toEqual({
      place_provider: null,
      external_place_id: null,
      place_synced_at: null,
      address: null,
      lat: null,
      lng: null,
    });
    expect(calls[1]!.payload).not.toHaveProperty('name');
  });

  it('一時的な失敗は飛ばして次へ進み、failed に数える', async () => {
    const { client, calls } = fakeClient({
      selects: [
        ok([
          { id: 's1', external_place_id: 'p1' },
          { id: 's2', external_place_id: 'p2' },
        ]),
      ],
      updates: [ok(null)],
    });
    const refresh = vi.fn(async (id: string): Promise<RefreshPlaceResult> => {
      if (id === 'p1') throw new Error('HTTP 429');
      return okResult('B');
    });
    expect(await refreshGoogleShops(client, refresh, { now })).toEqual({
      refreshed: 1,
      moved: 0,
      demoted: 0,
      failed: 1,
    });
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(1);
  });

  it('DB の更新に失敗しても止めずに failed に数える。place_id が無い行も failed', async () => {
    const { client } = fakeClient({
      selects: [
        ok([
          { id: 's1', external_place_id: 'p1' },
          { id: 's2', external_place_id: null },
        ]),
      ],
      updates: [{ data: null, error: { code: '23505', message: 'dup' } }],
    });
    const r = await refreshGoogleShops(client, async () => okResult('A'), { now });
    expect(r).toEqual({ refreshed: 0, moved: 0, demoted: 0, failed: 2 });
  });

  it('対象は place_provider=google で、20 日より古い（または時刻なし）店を古い順に最大件数まで', async () => {
    const filters: unknown[][] = [];
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'or', 'order', 'limit']) {
      chain[m] = (...a: unknown[]) => {
        filters.push([m, ...a]);
        return chain;
      };
    }
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve);
    const client = { from: () => chain } as unknown as SupabaseClient<Database>;
    await refreshGoogleShops(client, vi.fn(), { now, limit: 50 });
    const cutoff = new Date(NOW.getTime() - REFRESH_STALE_DAYS * 86_400_000).toISOString();
    expect(filters).toContainEqual(['eq', 'place_provider', 'google']);
    expect(filters).toContainEqual(['or', `place_synced_at.is.null,place_synced_at.lt.${cutoff}`]);
    expect(filters).toContainEqual(['order', 'place_synced_at', { ascending: true, nullsFirst: true }]);
    expect(filters).toContainEqual(['limit', 50]);
  });
});

describe('isStaleGoogleShop（表示時の保険の判定）', () => {
  it('Google の店で、写しが 30 日より古い・時刻が無いときだけ true', () => {
    const at = (iso: string | null, p: string | null = 'google') => ({
      place_provider: p,
      place_synced_at: iso,
    });
    expect(isStaleGoogleShop(at('2026-10-01T00:00:00Z'), NOW)).toBe(true); // 31 日前
    expect(isStaleGoogleShop(at('2026-10-05T00:00:00Z'), NOW)).toBe(false); // 27 日前
    expect(isStaleGoogleShop(at(null), NOW)).toBe(true);
    expect(isStaleGoogleShop(at('2020-01-01T00:00:00Z', 'osm'), NOW)).toBe(false);
    expect(isStaleGoogleShop(at('2020-01-01T00:00:00Z', null), NOW)).toBe(false);
  });
});
