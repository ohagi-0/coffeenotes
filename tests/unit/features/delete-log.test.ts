import { describe, expect, it } from 'vitest';
import { deleteLogsAndOrphanShops } from '@/features/logs/delete-log';
import { fakeClient } from './fake-client';

const ok = <T>(data: T) => ({ data, error: null });

describe('deleteLogsAndOrphanShops', () => {
  it('記録を消し、その店の記録が 0 件になったら店も消す', async () => {
    const { client, calls } = fakeClient({
      selects: [
        ok([
          { id: 'l1', shop_id: 's1' },
          { id: 'l2', shop_id: null },
        ]),
        ok([]),
      ],
      deletes: [ok(null), ok(null)],
    });
    const r = await deleteLogsAndOrphanShops(client, ['l1', 'l2']);
    expect(r).toEqual({ deleted: 2, removedShopIds: ['s1'] });
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual([
      'logs.select',
      'logs.delete',
      'logs.select',
      'shops.delete',
    ]);
  });
  it('同じ店の記録が残っていれば店は消さない', async () => {
    const { client, calls } = fakeClient({
      selects: [ok([{ id: 'l1', shop_id: 's1' }]), ok([{ id: 'l9' }])],
      deletes: [ok(null)],
    });
    const r = await deleteLogsAndOrphanShops(client, ['l1']);
    expect(r).toEqual({ deleted: 1, removedShopIds: [] });
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual(['logs.select', 'logs.delete', 'logs.select']);
  });
  it('空なら何もしない', async () => {
    const { client, calls } = fakeClient({});
    expect(await deleteLogsAndOrphanShops(client, [])).toEqual({ deleted: 0, removedShopIds: [] });
    expect(calls).toEqual([]);
  });
});
