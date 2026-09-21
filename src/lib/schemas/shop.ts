import { z } from 'zod';
import type { Database } from '@/types/database';
import { enumOrNull, type Expect, type Extends, numberOrNull, textOrNull, uuidSchema } from './common';

export const shopKindSchema = z.enum(['cafe', 'roaster', 'green_bean_shop', 'other']);
export type ShopKind = z.infer<typeof shopKindSchema>;

export const SHOP_KIND_LABELS: Record<ShopKind, string> = {
  cafe: 'カフェ',
  roaster: 'ロースター',
  green_bean_shop: '生豆販売店',
  other: 'その他',
};

const shopBase = z.object({
  name: z.string().trim().min(1, '店名を入力してください').max(120, '店名は 120 文字までです'),
  kind: enumOrNull(shopKindSchema),
  address: textOrNull(300),
  // 座標は無くても保存できる（F-SHOP-6）。地図に出すかどうかは UI 側の判断
  lat: numberOrNull(z.number().min(-90, '緯度は -90〜90 です').max(90, '緯度は -90〜90 です')),
  lng: numberOrNull(z.number().min(-180, '経度は -180〜180 です').max(180, '経度は -180〜180 です')),
  external_place_id: textOrNull(200),
});

/** DB の CHECK 制約 `(lat is null) = (lng is null)` と同じ規則。 */
const latLngPair = (v: { lat: number | null; lng: number | null }) => (v.lat === null) === (v.lng === null);
const latLngIssue = { message: '緯度と経度は両方入力するか、両方空にしてください', path: ['lng'] };

export const shopFormSchema = shopBase.refine(latLngPair, latLngIssue);
export type ShopFormInput = z.input<typeof shopFormSchema>;
export type ShopFormValues = z.output<typeof shopFormSchema>;

export const shopInsertSchema = shopBase.extend({ user_id: uuidSchema }).refine(latLngPair, latLngIssue);
export type ShopInsert = z.output<typeof shopInsertSchema>;

export type _ShopInsertCompat = Expect<Extends<ShopInsert, Database['public']['Tables']['shops']['Insert']>>;
