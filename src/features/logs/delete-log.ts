import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// 記録の削除（F-LOG-7）。記録を消して、その店の記録が 0 件になったら店も消す。
// ライト層には「消したら消える」の方が分かりやすい（2026-09-24、CLAUDE.md §1）。
// 記録より先に登録した店はここを通らないので残る。豆は残る（同じ豆を何度も飲む前提）。

export interface DeleteLogsResult {
  /** 消した記録の数 */
  deleted: number;
  /** 記録が無くなって一緒に消した店の ID */
  removedShopIds: string[];
}

export async function deleteLogsAndOrphanShops(
  client: SupabaseClient<Database>,
  ids: readonly string[],
): Promise<DeleteLogsResult> {
  if (ids.length === 0) return { deleted: 0, removedShopIds: [] };

  const before = await client
    .from('logs')
    .select('id, shop_id')
    .in('id', [...ids]);
  if (before.error) throw before.error;
  const shopIds = Array.from(
    new Set((before.data ?? []).map((l) => l.shop_id).filter((s): s is string => s !== null)),
  );

  const del = await client
    .from('logs')
    .delete()
    .in('id', [...ids]);
  if (del.error) throw del.error;

  const removedShopIds: string[] = [];
  for (const shopId of shopIds) {
    const rest = await client.from('logs').select('id').eq('shop_id', shopId).limit(1);
    if (rest.error) throw rest.error;
    if ((rest.data ?? []).length > 0) continue;
    const gone = await client.from('shops').delete().eq('id', shopId);
    if (gone.error) throw gone.error;
    removedShopIds.push(shopId);
  }
  return { deleted: ids.length, removedShopIds };
}
