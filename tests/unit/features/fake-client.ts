import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export interface FakeResult<T = unknown> {
  data: T;
  error: { code: string; message: string } | null;
}

/**
 * 単体テスト用の最小の Supabase 偽クライアント。
 * `from(...).insert/select/update/delete` はそれぞれの配列の先頭を順に消費する（テーブルは区別しない）。
 * 以降のチェーン（eq / in / order / limit / select）は同じ結果を持ち回り、`single()` か `await` で解決する。
 */
export function fakeClient(script: {
  inserts?: FakeResult[];
  selects?: FakeResult[];
  updates?: FakeResult[];
  deletes?: FakeResult[];
}) {
  const inserts = [...(script.inserts ?? [])];
  const selects = [...(script.selects ?? [])];
  const updates = [...(script.updates ?? [])];
  const deletes = [...(script.deletes ?? [])];
  const calls: { table: string; op: 'insert' | 'select' | 'update' | 'delete'; payload?: unknown }[] = [];

  const chain = (result: FakeResult) => {
    const o: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'ilike']) o[m] = () => o;
    o.single = () => Promise.resolve(result);
    o.then = (resolve: (r: FakeResult) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return o;
  };
  const take = (queue: FakeResult[], label: string) => {
    const r = queue.shift();
    if (!r) throw new Error(`fakeClient: ${label} の結果が用意されていません`);
    return r;
  };

  const client = {
    from: (table: string) => ({
      insert: (payload: unknown) => {
        calls.push({ table, op: 'insert', payload });
        return chain(take(inserts, `${table}.insert`));
      },
      select: () => {
        calls.push({ table, op: 'select' });
        return chain(take(selects, `${table}.select`));
      },
      update: (payload: unknown) => {
        calls.push({ table, op: 'update', payload });
        return chain(take(updates, `${table}.update`));
      },
      delete: () => {
        calls.push({ table, op: 'delete' });
        return chain(take(deletes, `${table}.delete`));
      },
    }),
  } as unknown as SupabaseClient<Database>;

  return { client, calls };
}

export const UNIQUE_VIOLATION = { code: '23505', message: 'duplicate key value violates unique constraint' };
