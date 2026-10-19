import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// 記録が 0 件になった店を消す（F-LOG-7 の規則を、記録の店を付け替えたときにも同じく使う）。
// ライト層には「記録から外したら、その店も一覧と地図から消える」方が分かりやすい（2026-09-24、CLAUDE.md §1）。
// 記録より先に登録した店（どの記録も指したことがない店）はここを通らないので残る。

/** 渡した店のうち、記録が 1 件も無いものを消して、その ID を返す */
export async function deleteOrphanShops(
  client: SupabaseClient<Database>,
  shopIds: readonly (string | null)[],
): Promise<string[]> {
  const removed: string[] = [];
  for (const shopId of new Set(shopIds.filter((s): s is string => !!s))) {
    const rest = await client.from('logs').select('id').eq('shop_id', shopId).limit(1);
    if (rest.error) throw rest.error;
    if ((rest.data ?? []).length > 0) continue;
    const gone = await client.from('shops').delete().eq('id', shopId);
    if (gone.error) throw gone.error;
    removed.push(shopId);
  }
  return removed;
}
