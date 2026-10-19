import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { resolveShopId, type PickedShop } from '@/features/shops/find-or-create-shop';
import { deleteOrphanShops } from '@/features/shops/orphan-shops';

// 記録の「飲んだ店」だけを付け替える（豆の編集画面の「飲んだ店」。2026-10-19）。
// 新しい店は候補の住所・座標つきで作る（同じ OSM の店があれば使い回す）。
// 付け替えで記録が 0 件になった元の店は消す（記録を消したときと同じ規則。orphan-shops.ts）。

export type LogShopChange = {
  logId: string;
  /** 変更前の店（無ければ null） */
  previousShopId: string | null;
  /** 変更後の店。null は「店を外す（未設定に戻す）」 */
  shop: PickedShop | null;
};

export async function changeLogShops(
  client: SupabaseClient<Database>,
  userId: string,
  changes: readonly LogShopChange[],
): Promise<{ changed: number; removedShopIds: string[] }> {
  const left: (string | null)[] = [];
  let changed = 0;
  for (const c of changes) {
    const shopId = await resolveShopId(client, userId, c.shop);
    if (shopId === c.previousShopId) continue;
    const { error } = await client.from('logs').update({ shop_id: shopId }).eq('id', c.logId);
    if (error) throw error;
    changed++;
    left.push(c.previousShopId);
  }
  return { changed, removedShopIds: await deleteOrphanShops(client, left) };
}
