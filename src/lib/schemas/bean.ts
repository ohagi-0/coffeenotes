import { z } from 'zod';
import type { Database } from '@/types/database';
import {
  dateStringSchema,
  emptyToNull,
  enumOrNull,
  type Expect,
  type Extends,
  numberOrNull,
  textOrNull,
  uuidSchema,
} from './common';

export const beanSourceSchema = z.enum(['purchased', 'home_roasted']);
export type BeanSource = z.infer<typeof beanSourceSchema>;

export const beanRoastLevelSchema = z.enum(['light', 'medium', 'dark']);
export type BeanRoastLevel = z.infer<typeof beanRoastLevelSchema>;
/** 焙煎度の表示名（フォームのチップと好みの分析で共有） */
export const BEAN_ROAST_LEVEL_LABELS: Record<BeanRoastLevel, string> = {
  light: '浅煎り',
  medium: '中煎り',
  dark: '深煎り',
};

/** 味覚チャートの 1 軸。1〜5 の整数、未入力は null（F-BEAN-10）。 */
export const tasteAxisSchema = numberOrNull(z.number().int('整数で入力してください').min(1).max(5));

/** フレーバーノート。空要素を除き、前後の空白を落とす（F-BEAN-8）。 */
export const flavorNotesSchema = z
  .array(z.string())
  .default([])
  .transform((arr) => arr.map((s) => s.trim()).filter((s) => s !== ''));

export const beanFormSchema = z.object({
  name: z.string().trim().min(1, '豆名を入力してください').max(200, '豆名は 200 文字までです'),
  // DB 列は NULL 可だが、アプリ要件（F-BEAN-2）としてフォームでは必須
  // ロースターは任意（どこで焙煎したか分からない豆もある。2026-09-24）。DB も NULL 可
  roaster_id: uuidSchema.nullable().default(null),
  source: beanSourceSchema,
  country: textOrNull(120),
  region: textOrNull(200),
  variety: textOrNull(120),
  process: textOrNull(120),
  altitude_m: numberOrNull(z.number().int('整数で入力してください').min(0, '標高は 0 以上です')),
  flavor_notes: flavorNotesSchema,
  description: textOrNull(4000),
  taste_flavor: tasteAxisSchema,
  taste_sweetness: tasteAxisSchema,
  taste_acidity: tasteAxisSchema,
  taste_aftertaste: tasteAxisSchema,
  taste_body: tasteAxisSchema,
  price_jpy: numberOrNull(z.number().int('整数で入力してください').min(0, '価格は 0 以上です')),
  price_grams: numberOrNull(z.number().int('整数で入力してください').min(1, 'グラム数は 1 以上です')),
  roast_level: enumOrNull(beanRoastLevelSchema),
  roasted_on: z.preprocess(emptyToNull, dateStringSchema.nullable()).default(null),
  reference_url: z.preprocess(emptyToNull, z.url('URL の形式が正しくありません').nullable()).default(null),
});
export type BeanFormInput = z.input<typeof beanFormSchema>;
export type BeanFormValues = z.output<typeof beanFormSchema>;

/** DB 投入用。`ocr_raw` は OCR 経由のときだけ別途付ける。 */
export const beanInsertSchema = beanFormSchema.extend({ user_id: uuidSchema });
export type BeanInsert = z.output<typeof beanInsertSchema>;

export type _BeanInsertCompat = Expect<Extends<BeanInsert, Database['public']['Tables']['beans']['Insert']>>;
