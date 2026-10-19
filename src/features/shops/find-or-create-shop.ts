import type { SupabaseClient } from '@supabase/supabase-js';
import { shopInsertSchema, type PlaceProvider, type ShopFormInput } from '@/lib/schemas/shop';
import type { Database } from '@/types/database';

// 店の解決（F-SHOP-1/2/3/6）。記録作成・記録の編集・豆の編集の「飲んだ店」が共通で使う。
// - 地図の候補（place_id / OSM の ID あり）から選んだ店は、同じ出どころ・同じ ID の店がすでにあればそれを使う（二重に作らない）
// - 候補で決めた住所・座標は落とさずに保存する（地図に出るように）

/** 店を選ぶ部品が返す「選んだ店」。既存（id あり）か新規（名前 + 候補や住所で決めた住所・座標）か */
export type PickedShop = {
  id: string | null;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  externalPlaceId?: string | null;
  /** 候補の出どころ。省略時は ID の形から決める（"node/123" なら osm）。ADR 0011 */
  placeProvider?: PlaceProvider | null;
};

const OSM_ID = /^(node|way|relation)\/[0-9]+$/;

/** 店の出どころ。明示が無ければ OSM の ID の形で判定し、それ以外（手入力）は null */
export function placeProviderOf(shop: PickedShop): PlaceProvider | null {
  if (shop.externalPlaceId == null) return null;
  if (shop.placeProvider) return shop.placeProvider;
  return OSM_ID.test(shop.externalPlaceId) ? 'osm' : null;
}

/** 新規の店の登録内容（住所・座標・OSM の ID はあるときだけ付ける。座標は対でないと DB の CHECK で落ちる） */
export function shopInputFromPick(shop: PickedShop, now: () => Date = () => new Date()): ShopFormInput {
  const provider = placeProviderOf(shop);
  return {
    name: shop.name.trim(),
    ...(shop.address != null ? { address: shop.address } : {}),
    ...(shop.lat != null && shop.lng != null ? { lat: shop.lat, lng: shop.lng } : {}),
    ...(shop.externalPlaceId != null ? { external_place_id: shop.externalPlaceId } : {}),
    ...(provider ? { place_provider: provider } : {}),
    // Google の写しは 30 日以内に更新する。いつ取った写しかを持つ
    ...(provider === 'google' ? { place_synced_at: now().toISOString() } : {}),
  };
}

/** 同じ出どころ・同じ ID の店があればその ID、無ければ登録して ID を返す */
export async function findOrCreateShop(
  client: SupabaseClient<Database>,
  userId: string,
  input: ShopFormInput,
): Promise<{ id: string; created: boolean }> {
  const externalId = typeof input.external_place_id === 'string' ? input.external_place_id : null;
  const provider = typeof input.place_provider === 'string' ? input.place_provider : null;

  // RLS で自分の店だけが見える。出どころが違えば別の店（place_id と OSM の ID は別の空間）
  async function findExisting(): Promise<string | null> {
    if (!externalId) return null;
    let q = client.from('shops').select('id').eq('external_place_id', externalId);
    q = provider ? q.eq('place_provider', provider) : q.is('place_provider', null);
    const found = await q.limit(1);
    if (found.error) throw found.error;
    return (found.data ?? [])[0]?.id ?? null;
  }

  const existing = await findExisting();
  if (existing) return { id: existing, created: false };
  const values = shopInsertSchema.parse({ ...input, user_id: userId });
  const { data, error } = await client.from('shops').insert(values).select('id').single();
  if (error) {
    // 同時登録で一意制約（shops_user_place_uidx）に当たったら、先に入った店を使う
    if (error.code === '23505') {
      const raced = await findExisting();
      if (raced) return { id: raced, created: false };
    }
    throw error;
  }
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
