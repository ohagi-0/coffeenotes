import type { SupabaseClient } from '@supabase/supabase-js';
import { shopInsertSchema, type ShopFormInput } from '@/lib/schemas/shop';
import type { Database } from '@/types/database';

// 店の解決（F-SHOP-1/2/3/6）。記録作成・記録の編集・豆の編集の「飲んだ店」が共通で使う。
// - 地図の候補（OSM の ID あり）から選んだ店は、同じ ID の店がすでにあればそれを使う（同じ店を二重に作らない）
// - 候補で決めた住所・座標は落とさずに保存する（地図に出るように）

/** 店を選ぶ部品が返す「選んだ店」。既存（id あり）か新規（名前 + 候補や住所で決めた住所・座標）か */
export type PickedShop = {
  id: string | null;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  externalPlaceId?: string | null;
};

/** 新規の店の登録内容（住所・座標・OSM の ID はあるときだけ付ける。座標は対でないと DB の CHECK で落ちる） */
export function shopInputFromPick(shop: PickedShop): ShopFormInput {
  return {
    name: shop.name.trim(),
    ...(shop.address != null ? { address: shop.address } : {}),
    ...(shop.lat != null && shop.lng != null ? { lat: shop.lat, lng: shop.lng } : {}),
    ...(shop.externalPlaceId != null ? { external_place_id: shop.externalPlaceId } : {}),
  };
}

/** 同じ OSM の ID の店があればその ID、無ければ登録して ID を返す */
export async function findOrCreateShop(
  client: SupabaseClient<Database>,
  userId: string,
  input: ShopFormInput,
): Promise<{ id: string; created: boolean }> {
  const externalId = typeof input.external_place_id === 'string' ? input.external_place_id : null;
  if (externalId) {
    // RLS で自分の店だけが見える
    const found = await client.from('shops').select('id').eq('external_place_id', externalId).limit(1);
    if (found.error) throw found.error;
    const hit = (found.data ?? [])[0];
    if (hit) return { id: hit.id, created: false };
  }
  const values = shopInsertSchema.parse({ ...input, user_id: userId });
  const { data, error } = await client.from('shops').insert(values).select('id').single();
  if (error) throw error;
  return { id: data.id, created: true };
}

/** 選んだ店 → 記録に入れる shop_id。選んでいない（null や名前が空）なら null */
export async function resolveShopId(
  client: SupabaseClient<Database>,
  userId: string,
  shop: PickedShop | null,
): Promise<string | null> {
  if (!shop) return null;
  if (shop.id) return shop.id;
  if (!shop.name.trim()) return null;
  return (await findOrCreateShop(client, userId, shopInputFromPick(shop))).id;
}
