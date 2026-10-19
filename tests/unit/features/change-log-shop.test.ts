import { describe, expect, it } from 'vitest';
import { changeLogShops } from '@/features/logs/change-log-shop';
import { findOrCreateShop, resolveShopId, shopInputFromPick } from '@/features/shops/find-or-create-shop';
import { fakeClient } from './fake-client';

const ok = <T>(data: T) => ({ data, error: null });
const U = '11111111-1111-4111-8111-111111111111';

describe('shopInputFromPick', () => {
  it('候補の住所・座標・OSM の ID を落とさない。座標は対のときだけ付ける', () => {
    expect(
      shopInputFromPick({
        id: null,
        name: ' Fuglen ',
        address: '渋谷区',
        lat: 35.6,
        lng: 139.6,
        externalPlaceId: 'node/1',
      }),
    ).toEqual({ name: 'Fuglen', address: '渋谷区', lat: 35.6, lng: 139.6, external_place_id: 'node/1' });
    expect(shopInputFromPick({ id: null, name: 'A', lat: 35.6, lng: null })).toEqual({ name: 'A' });
  });
});

describe('findOrCreateShop', () => {
  it('同じ OSM の ID の店があれば作らずにその ID を返す', async () => {
    const { client, calls } = fakeClient({ selects: [ok([{ id: 's1' }])] });
    expect(await findOrCreateShop(client, U, { name: 'Fuglen', external_place_id: 'node/1' })).toEqual({
      id: 's1',
      created: false,
    });
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual(['shops.select']);
  });
  it('無ければ user_id 付きで作る。OSM の ID が無ければ探さずに作る', async () => {
    const { client, calls } = fakeClient({
      selects: [ok([])],
      inserts: [ok({ id: 's2' }), ok({ id: 's3' })],
    });
    expect(await findOrCreateShop(client, U, { name: 'Fuglen', external_place_id: 'node/1' })).toEqual({
      id: 's2',
      created: true,
    });
    expect(await findOrCreateShop(client, U, { name: '手入力の店' })).toEqual({ id: 's3', created: true });
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual(['shops.select', 'shops.insert', 'shops.insert']);
    expect(calls[1]!.payload).toMatchObject({ name: 'Fuglen', user_id: U, external_place_id: 'node/1' });
  });
});

describe('resolveShopId', () => {
  it('既存の店はそのまま、未選択・名前が空は null', async () => {
    const { client, calls } = fakeClient({});
    expect(await resolveShopId(client, U, { id: 's9', name: 'x' })).toBe('s9');
    expect(await resolveShopId(client, U, null)).toBeNull();
    expect(await resolveShopId(client, U, { id: null, name: '  ' })).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('changeLogShops', () => {
  it('店を付け替え、記録が 0 件になった元の店を消す', async () => {
    const { client, calls } = fakeClient({
      updates: [ok(null)],
      selects: [ok([])],
      deletes: [ok(null)],
    });
    const r = await changeLogShops(client, U, [
      { logId: 'l1', previousShopId: 'old', shop: { id: 'new', name: 'B' } },
    ]);
    expect(r).toEqual({ changed: 1, removedShopIds: ['old'] });
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual(['logs.update', 'logs.select', 'shops.delete']);
    expect(calls[0]!.payload).toEqual({ shop_id: 'new' });
  });

  it('新しい店（候補）は作ってから付ける。元の店が無ければ何も消さない', async () => {
    const { client, calls } = fakeClient({
      selects: [ok([])],
      inserts: [ok({ id: 'created' })],
      updates: [ok(null)],
    });
    const r = await changeLogShops(client, U, [
      {
        logId: 'l1',
        previousShopId: null,
        shop: {
          id: null,
          name: 'Fuglen Tokyo',
          address: '渋谷区',
          lat: 35.6,
          lng: 139.6,
          externalPlaceId: 'node/1',
        },
      },
    ]);
    expect(r).toEqual({ changed: 1, removedShopIds: [] });
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual(['shops.select', 'shops.insert', 'logs.update']);
    expect(calls[2]!.payload).toEqual({ shop_id: 'created' });
  });

  it('外す（null）と shop_id を null にする。元の店に記録が残っていれば消さない', async () => {
    const { client, calls } = fakeClient({ updates: [ok(null)], selects: [ok([{ id: 'l9' }])] });
    const r = await changeLogShops(client, U, [{ logId: 'l1', previousShopId: 'old', shop: null }]);
    expect(r).toEqual({ changed: 1, removedShopIds: [] });
    expect(calls[0]!.payload).toEqual({ shop_id: null });
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual(['logs.update', 'logs.select']);
  });

  it('同じ店のままなら何もしない', async () => {
    const { client, calls } = fakeClient({});
    const r = await changeLogShops(client, U, [
      { logId: 'l1', previousShopId: 's1', shop: { id: 's1', name: 'A' } },
    ]);
    expect(r).toEqual({ changed: 0, removedShopIds: [] });
    expect(calls).toEqual([]);
  });
});
