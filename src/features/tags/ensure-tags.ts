import type { SupabaseClient } from '@supabase/supabase-js';
import { tagInsertSchema } from '@/lib/schemas/tag';
import { isUniqueViolation } from '@/lib/supabase/errors';
import type { Database, Tables } from '@/types/database';

/**
 * タグ名の配列を tags の行に解決する。無ければ作り、あれば既存行を返す。
 * `(user_id, name)` の一意制約があるので、同時登録で 23505 が出たら読み直す。
 * 記録の保存（#6）とタグ単体の登録の両方から使う。
 */
export async function ensureTags(
  client: SupabaseClient<Database>,
  names: readonly string[],
  userId: string,
): Promise<Tables<'tags'>[]> {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter((n) => n !== '')));
  if (unique.length === 0) return [];

  const existing = await client.from('tags').select('*').eq('user_id', userId).in('name', unique);
  if (existing.error) throw existing.error;
  const found = new Map(existing.data.map((t) => [t.name, t]));

  const missing = unique.filter((n) => !found.has(n));
  for (const name of missing) {
    const values = tagInsertSchema.parse({ name, user_id: userId });
    const inserted = await client.from('tags').insert(values).select('*').single();
    if (!inserted.error) {
      found.set(name, inserted.data);
      continue;
    }
    if (!isUniqueViolation(inserted.error)) throw inserted.error;
    const again = await client.from('tags').select('*').eq('user_id', userId).eq('name', name).single();
    if (again.error) throw again.error;
    found.set(name, again.data);
  }

  return unique.map((n) => found.get(n)!);
}
