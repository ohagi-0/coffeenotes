import { z } from 'zod';
import type { Database } from '@/types/database';
import { type Expect, type Extends, uuidSchema } from './common';

/** タグ名。前後の空白を除き 1〜32 文字。`(user_id, name)` で一意（F-TAG-1）。 */
export const tagNameSchema = z
  .string()
  .trim()
  .min(1, 'タグ名を入力してください')
  .max(32, 'タグ名は 32 文字までです');

export const tagInsertSchema = z.object({ name: tagNameSchema, user_id: uuidSchema });
export type TagInsert = z.output<typeof tagInsertSchema>;

export type _TagInsertCompat = Expect<Extends<TagInsert, Database['public']['Tables']['tags']['Insert']>>;
