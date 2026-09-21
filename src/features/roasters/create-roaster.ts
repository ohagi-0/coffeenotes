import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeRoasterName, roasterInsertSchema, type RoasterFormInput } from '@/lib/schemas/roaster';
import { isUniqueViolation } from '@/lib/supabase/errors';
import type { Database, Tables } from '@/types/database';

/**
 * ロースターを登録する。同名（大文字小文字・前後空白を無視）が既にあれば、
 * 一意制約違反（23505）を UI に見せず既存行を返す。「既にあるロースターを選んだ」のと同じ結果にする。
 * フックから切り離してあるのは、偽クライアントで単体テストするため。
 */
export async function createRoasterWithDedupe(
  client: SupabaseClient<Database>,
  input: RoasterFormInput,
  userId: string,
): Promise<Tables<'roasters'>> {
  const values = roasterInsertSchema.parse({ ...input, created_by: userId });
  const inserted = await client.from('roasters').insert(values).select('*').single();
  if (!inserted.error) return inserted.data;
  if (!isUniqueViolation(inserted.error)) throw inserted.error;

  const existing = await client
    .from('roasters')
    .select('*')
    .eq('name_normalized', normalizeRoasterName(values.name))
    .single();
  if (existing.error) throw existing.error;
  return existing.data;
}
