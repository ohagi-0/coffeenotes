import { z } from 'zod';
import type { Database } from '@/types/database';
import {
  dateStringSchema,
  emptyToNull,
  type Expect,
  type Extends,
  numberOrNull,
  textOrNull,
  uuidSchema,
} from './common';
import { ratingSchema } from './rating';
import { tagNameSchema } from './tag';

export const logPlaceSchema = z.enum(['shop', 'home']);
export type LogPlace = z.infer<typeof logPlaceSchema>;

export const logKindSchema = z.enum(['drank', 'bought']);
export type LogKind = z.infer<typeof logKindSchema>;

const nullableUuid = z.preprocess(emptyToNull, uuidSchema.nullable()).default(null);

// レシピ列（F-BREW-1〜6）。すべて任意で、星とメモだけでも保存できる
const recipeFields = {
  brew_method: textOrNull(120),
  grinder: textOrNull(120),
  grind_setting: textOrNull(60),
  dose_g: numberOrNull(z.number().positive('豆量は 0 より大きい値です')),
  water_g: numberOrNull(z.number().positive('湯量は 0 より大きい値です')),
  water_temp_c: numberOrNull(
    z.number().int('整数で入力してください').min(0).max(100, '湯温は 0〜100 ℃ です'),
  ),
  brew_time_sec: numberOrNull(z.number().int('整数で入力してください').positive('抽出時間は 1 秒以上です')),
  recipe_memo: textOrNull(2000),
};

const logBase = z.object({
  bean_id: uuidSchema,
  roast_id: nullableUuid,
  shop_id: nullableUuid,
  place: logPlaceSchema,
  kind: logKindSchema.default('drank'),
  logged_on: dateStringSchema,
  rating: numberOrNull(ratingSchema),
  memo: textOrNull(4000),
  purchased_grams: numberOrNull(z.number().int('整数で入力してください').positive('購入量は 1 g 以上です')),
  photo_path: textOrNull(500),
  ...recipeFields,
});

/** DB の CHECK 制約 `place <> 'home' or shop_id is null` と同じ規則。 */
const noShopAtHome = (v: { place: LogPlace; shop_id: string | null }) =>
  v.place !== 'home' || v.shop_id === null;
const homeIssue = { message: '自宅で淹れた記録には店を付けられません', path: ['shop_id'] };

/** フォーム項目だけ（相互制約なし）。部分更新で `.partial()` するときに使う。 */
export const logFormFieldsSchema = logBase.extend({ tag_names: z.array(tagNameSchema).default([]) });

/** フォーム用。タグは名前の配列で受け取り、保存時に ID へ解決する（無ければ作る）。 */
export const logFormSchema = logBase
  .extend({ tag_names: z.array(tagNameSchema).default([]) })
  .refine(noShopAtHome, homeIssue);
export type LogFormInput = z.input<typeof logFormSchema>;
export type LogFormValues = z.output<typeof logFormSchema>;

/** DB 投入用（logs テーブルの列のみ。タグは log_tags に別途入れる）。 */
export const logInsertSchema = logBase.extend({ user_id: uuidSchema }).refine(noShopAtHome, homeIssue);
export type LogInsert = z.output<typeof logInsertSchema>;

export type _LogInsertCompat = Expect<Extends<LogInsert, Database['public']['Tables']['logs']['Insert']>>;

/** 豆量と湯量から比率（1:N）を返す。どちらかが無ければ null（F-BREW-3）。 */
export function brewRatio(doseG: number | null, waterG: number | null): number | null {
  if (doseG === null || waterG === null || doseG <= 0) return null;
  return Math.round((waterG / doseG) * 10) / 10;
}
