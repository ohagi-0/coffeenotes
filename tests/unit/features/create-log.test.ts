import { describe, expect, it } from 'vitest';
import { createLogWithTags, syncLogTags, updateLogWithTags } from '@/features/logs/create-log';
import { fakeClient } from './fake-client';

const UID = '00000000-0000-4000-8000-000000000000';
const BEAN = '11111111-1111-4111-8111-111111111111';
const SHOP = '22222222-2222-4222-8222-222222222222';
const tag = (id: string, name: string) => ({ id, name, user_id: UID, created_at: '2026-09-21T00:00:00Z' });
const ok = <T>(data: T) => ({ data, error: null });

describe('createLogWithTags', () => {
  it('自宅の記録は店を落として保存し、タグを付ける', async () => {
    const { client, calls } = fakeClient({
      inserts: [ok({ id: 'log1' }), ok(tag('t1', '朝')), ok(null)],
      selects: [ok([]), ok([])],
    });
    const id = await createLogWithTags(
      client,
      { bean_id: BEAN, place: 'home', shop_id: SHOP, logged_on: '2026-09-21', rating: 4, tag_names: ['朝'] },
      UID,
    );
    expect(id).toBe('log1');
    expect(calls[0]).toMatchObject({ table: 'logs', op: 'insert' });
    expect(calls[0]?.payload).toMatchObject({
      bean_id: BEAN,
      place: 'home',
      shop_id: null,
      user_id: UID,
      rating: 4,
    });
    expect('tag_names' in (calls[0]?.payload as object)).toBe(false);
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual([
      'logs.insert',
      'tags.select',
      'tags.insert',
      'log_tags.select',
      'log_tags.insert',
    ]);
    expect(calls[4]?.payload).toEqual([{ log_id: 'log1', tag_id: 't1', user_id: UID }]);
  });

  it('店の記録は shop_id を保持し、タグなしなら log_tags を触らない', async () => {
    const { client, calls } = fakeClient({ inserts: [ok({ id: 'log2' })], selects: [ok([])] });
    await createLogWithTags(
      client,
      { bean_id: BEAN, place: 'shop', shop_id: SHOP, logged_on: '2026-09-21' },
      UID,
    );
    expect(calls[0]?.payload).toMatchObject({ shop_id: SHOP, kind: 'drank' });
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual(['logs.insert', 'log_tags.select']);
  });

  it('不正な入力は DB に行かずに落ちる', async () => {
    const { client, calls } = fakeClient({});
    await expect(
      createLogWithTags(client, { bean_id: BEAN, place: 'home', logged_on: '2026-02-30' }, UID),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe('updateLogWithTags', () => {
  it('渡した項目だけ UPDATE し、tag_names が無ければタグを触らない', async () => {
    const { client, calls } = fakeClient({ updates: [ok(null)] });
    await updateLogWithTags(client, 'log1', { rating: 3.5, memo: '' }, UID);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.payload).toEqual({ rating: 3.5, memo: null });
  });

  it('自宅に変えると shop_id も null で送る', async () => {
    const { client, calls } = fakeClient({ updates: [ok(null)] });
    await updateLogWithTags(client, 'log1', { place: 'home' }, UID);
    expect(calls[0]?.payload).toEqual({ place: 'home', shop_id: null });
  });

  it('tag_names だけなら UPDATE せずタグを差し替える（外す 1・足す 1）', async () => {
    const { client, calls } = fakeClient({
      selects: [ok([tag('t1', '朝'), tag('t2', '新')]), ok([{ tag_id: 't1' }, { tag_id: 't0' }])],
      deletes: [ok(null)],
      inserts: [ok(null)],
    });
    await updateLogWithTags(client, 'log1', { tag_names: ['朝', '新'] }, UID);
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual([
      'tags.select',
      'log_tags.select',
      'log_tags.delete',
      'log_tags.insert',
    ]);
    expect(calls[3]?.payload).toEqual([{ log_id: 'log1', tag_id: 't2', user_id: UID }]);
  });
});

describe('syncLogTags', () => {
  it('差分が無ければ削除も追加もしない', async () => {
    const { client, calls } = fakeClient({ selects: [ok([tag('t1', '朝')]), ok([{ tag_id: 't1' }])] });
    await syncLogTags(client, 'log1', ['朝'], UID);
    expect(calls.map((c) => c.op)).toEqual(['select', 'select']);
  });
  it('空配列なら既存のタグを全部外す', async () => {
    const { client, calls } = fakeClient({ selects: [ok([{ tag_id: 't1' }])], deletes: [ok(null)] });
    await syncLogTags(client, 'log1', [], UID);
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual(['log_tags.select', 'log_tags.delete']);
  });
});
