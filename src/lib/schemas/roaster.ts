import { z } from 'zod';
import type { Database } from '@/types/database';
import { emptyToNull, type Expect, type Extends, uuidSchema } from './common';

/**
 * ロースター名の正規化（前後空白の除去 + 小文字化）。
 * DB の生成列 `roasters.name_normalized = lower(btrim(name))` と同じ規則。
 * 重複登録の判定（一意制約 23505）を、送信前にクライアント側でも再現するために使う。
 */
export function normalizeRoasterName(name: string): string {
  return name.trim().toLowerCase();
}

export const roasterFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'ロースター名を入力してください')
    .max(120, 'ロースター名は 120 文字までです'),
  website: z.preprocess(emptyToNull, z.url('URL の形式が正しくありません').nullable()).default(null),
});
export type RoasterFormInput = z.input<typeof roasterFormSchema>;
export type RoasterFormValues = z.output<typeof roasterFormSchema>;

/** DB 投入用。RLS の WITH CHECK 条件により `created_by` は自分の uid でなければならない。 */
export const roasterInsertSchema = roasterFormSchema.extend({ created_by: uuidSchema });
export type RoasterInsert = z.output<typeof roasterInsertSchema>;

export type _RoasterInsertCompat = Expect<
  Extends<RoasterInsert, Database['public']['Tables']['roasters']['Insert']>
>;
