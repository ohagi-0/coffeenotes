import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteMyAccount, removeAllBeanImages } from '@/features/account/delete-account';
import type { Database } from '@/types/database';

const UID = '00000000-0000-4000-8000-000000000000';

function fake(opts: { entries?: unknown[]; files?: Record<string, unknown[]>; rpcError?: unknown }) {
  const list = vi.fn(async (prefix: string) => {
    if (prefix === UID) return { data: opts.entries ?? [], error: null };
    return { data: opts.files?.[prefix] ?? [], error: null };
  });
  const remove = vi.fn(async () => ({ data: null, error: null }));
  const rpc = vi.fn(async () => ({ data: null, error: opts.rpcError ?? null }));
  const signOut = vi.fn(async () => ({ error: null }));
  const client = {
    storage: { from: () => ({ list, remove }) },
    rpc,
    auth: { signOut },
  } as unknown as SupabaseClient<Database>;
  return { client, list, remove, rpc, signOut };
}

describe('removeAllBeanImages', () => {
  it('豆ごとのフォルダを辿ってファイルを集め、一括で消す', async () => {
    const f = fake({
      entries: [
        { name: 'bean-1', id: null },
        { name: 'bean-2', id: null },
      ],
      files: {
        [`${UID}/bean-1`]: [
          { name: 'front.jpg', id: 'x' },
          { name: 'back.jpg', id: 'y' },
        ],
        [`${UID}/bean-2`]: [{ name: 'front.jpg', id: 'z' }],
      },
    });
    const n = await removeAllBeanImages(f.client, UID);
    expect(n).toBe(3);
    expect(f.remove).toHaveBeenCalledWith([
      `${UID}/bean-1/front.jpg`,
      `${UID}/bean-1/back.jpg`,
      `${UID}/bean-2/front.jpg`,
    ]);
  });
  it('画像が無ければ remove を呼ばない', async () => {
    const f = fake({ entries: [] });
    expect(await removeAllBeanImages(f.client, UID)).toBe(0);
    expect(f.remove).not.toHaveBeenCalled();
  });
});

describe('deleteMyAccount', () => {
  it('画像削除 → DB 関数 → ローカルの signOut の順', async () => {
    const f = fake({ entries: [] });
    await deleteMyAccount(f.client, UID);
    expect(f.rpc).toHaveBeenCalledWith('delete_my_account');
    expect(f.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
  it('DB 関数が失敗したら signOut しない', async () => {
    const f = fake({ entries: [], rpcError: { message: 'boom' } });
    await expect(deleteMyAccount(f.client, UID)).rejects.toMatchObject({ message: 'boom' });
    expect(f.signOut).not.toHaveBeenCalled();
  });
});
