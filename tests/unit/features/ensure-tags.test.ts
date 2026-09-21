import { describe, expect, it } from 'vitest';
import { ensureTags } from '@/features/tags/ensure-tags';
import { fakeClient, UNIQUE_VIOLATION } from './fake-client';

const UID = '00000000-0000-4000-8000-000000000000';
const tag = (id: string, name: string) => ({ id, name, user_id: UID, created_at: '2026-09-21T00:00:00Z' });

describe('ensureTags', () => {
  it('空配列なら DB に行かず空配列', async () => {
    const { client, calls } = fakeClient({});
    expect(await ensureTags(client, [], UID)).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('全部既存なら INSERT しない', async () => {
    const { client, calls } = fakeClient({
      selects: [{ data: [tag('t1', '朝'), tag('t2', 'ゲイシャ')], error: null }],
    });
    const r = await ensureTags(client, ['朝', 'ゲイシャ'], UID);
    expect(r.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(calls.map((c) => c.op)).toEqual(['select']);
  });

  it('無いものだけ INSERT し、入力順で返す。重複と空白は除く', async () => {
    const { client, calls } = fakeClient({
      selects: [{ data: [tag('t1', '朝')], error: null }],
      inserts: [{ data: tag('t3', 'インフューズド'), error: null }],
    });
    const r = await ensureTags(client, [' インフューズド ', '朝', 'インフューズド', ''], UID);
    expect(r.map((t) => t.id)).toEqual(['t3', 't1']);
    expect(calls.map((c) => c.op)).toEqual(['select', 'insert']);
    expect(calls[1]?.payload).toEqual({ name: 'インフューズド', user_id: UID });
  });

  it('INSERT が 23505 なら読み直して既存行を使う（同時登録の競合）', async () => {
    const { client, calls } = fakeClient({
      selects: [
        { data: [], error: null },
        { data: tag('t9', '朝'), error: null },
      ],
      inserts: [{ data: null, error: UNIQUE_VIOLATION }],
    });
    const r = await ensureTags(client, ['朝'], UID);
    expect(r[0]?.id).toBe('t9');
    expect(calls.map((c) => c.op)).toEqual(['select', 'insert', 'select']);
  });
});
