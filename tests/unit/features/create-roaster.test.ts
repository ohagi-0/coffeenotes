import { describe, expect, it } from 'vitest';
import { createRoasterWithDedupe } from '@/features/roasters/create-roaster';
import { fakeClient, UNIQUE_VIOLATION } from './fake-client';

const UID = '00000000-0000-4000-8000-000000000000';
const row = {
  id: 'r1',
  name: 'KIELO COFFEE',
  name_normalized: 'kielo coffee',
  website: null,
  created_by: UID,
};

describe('createRoasterWithDedupe', () => {
  it('新規なら INSERT の結果を返す', async () => {
    const { client, calls } = fakeClient({ inserts: [{ data: row, error: null }] });
    const r = await createRoasterWithDedupe(client, { name: ' KIELO COFFEE ' }, UID);
    expect(r).toEqual(row);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.payload).toMatchObject({ name: 'KIELO COFFEE', created_by: UID, website: null });
  });

  it('同名（大文字小文字・空白違い）が既にあれば 23505 を飲み込んで既存行を返す', async () => {
    const { client, calls } = fakeClient({
      inserts: [{ data: null, error: UNIQUE_VIOLATION }],
      selects: [{ data: row, error: null }],
    });
    const r = await createRoasterWithDedupe(client, { name: 'kielo coffee' }, UID);
    expect(r).toEqual(row);
    expect(calls.map((c) => c.op)).toEqual(['insert', 'select']);
  });

  it('23505 以外のエラーはそのまま投げる', async () => {
    const { client } = fakeClient({ inserts: [{ data: null, error: { code: '42501', message: 'RLS' } }] });
    await expect(createRoasterWithDedupe(client, { name: 'A' }, UID)).rejects.toMatchObject({
      code: '42501',
    });
  });

  it('名前が空なら DB に行かずに落ちる', async () => {
    const { client, calls } = fakeClient({});
    await expect(createRoasterWithDedupe(client, { name: '  ' }, UID)).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});
