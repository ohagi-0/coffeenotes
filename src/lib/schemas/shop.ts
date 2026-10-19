import { z } from 'zod';
import type { Database } from '@/types/database';
import { enumOrNull, type Expect, type Extends, numberOrNull, textOrNull, uuidSchema } from './common';

export const shopKindSchema = z.enum(['cafe', 'roaster', 'green_bean_shop', 'other']);
export type ShopKind = z.infer<typeof shopKindSchema>;

/** 店の出どころ。NULL = 手入力。google は place_id だけ永続し、名前・住所・座標は 30 日以内に更新する写し（ADR 0011） */
export const placeProviderSchema = z.enum(['google', 'osm']);
export type PlaceProvider = z.infer<typeof placeProviderSchema>;

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
  place_provider: enumOrNull(placeProviderSchema),
  /** Google の写しを最後に更新した時刻（ISO 8601）。Google 以外は null */
  place_synced_at: textOrNull(40),
});

/** DB の CHECK 制約 `(lat is null) = (lng is null)` と同じ規則。 */
const latLngPair = (v: { lat: number | null; lng: number | null }) => (v.lat === null) === (v.lng === null);
const latLngIssue = { message: '緯度と経度は両方入力するか、両方空にしてください', path: ['lng'] };
/** DB の CHECK 制約 shops_google_needs_place_id と同じ規則（Google の店は place_id が無いと更新できない）。 */
const googleNeedsPlaceId = (v: { place_provider: PlaceProvider | null; external_place_id: string | null }) =>
  v.place_provider !== 'google' || v.external_place_id !== null;
const googleNeedsPlaceIdIssue = {
  message: 'Google の店には place_id が必要です',
  path: ['external_place_id'],
};

export const shopFormSchema = shopBase
  .refine(latLngPair, latLngIssue)
  .refine(googleNeedsPlaceId, googleNeedsPlaceIdIssue);
export type ShopFormInput = z.input<typeof shopFormSchema>;
export type ShopFormValues = z.output<typeof shopFormSchema>;

export const shopInsertSchema = shopBase
  .extend({ user_id: uuidSchema })
  .refine(latLngPair, latLngIssue)
  .refine(googleNeedsPlaceId, googleNeedsPlaceIdIssue);
export type ShopInsert = z.output<typeof shopInsertSchema>;

export type _ShopInsertCompat = Expect<Extends<ShopInsert, Database['public']['Tables']['shops']['Insert']>>;
