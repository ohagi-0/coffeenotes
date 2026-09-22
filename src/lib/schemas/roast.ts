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

// 自家焙煎バッチ（F-ROAST-1〜7）。beans.source = home_roasted の豆に 0〜複数付く。

export const roastLevelSchema = z.enum(['light', 'medium_light', 'medium', 'medium_dark', 'dark']);
export type RoastLevel = z.infer<typeof roastLevelSchema>;

export const ROAST_LEVEL_LABELS: Record<RoastLevel, string> = {
  light: '浅煎り',
  medium_light: '中浅煎り',
  medium: '中煎り',
  medium_dark: '中深煎り',
  dark: '深煎り',
};

export const roastFormSchema = z.object({
  roasted_on: dateStringSchema,
  method: textOrNull(120),
  green_grams: numberOrNull(z.number().int('整数で入力してください').positive('生豆の量は 1 g 以上です')),
  roasted_grams: numberOrNull(
    z.number().int('整数で入力してください').positive('焙煎後の重量は 1 g 以上です'),
  ),
  duration_sec: numberOrNull(z.number().int('整数で入力してください').positive('焙煎時間は 1 秒以上です')),
  roast_level: enumOrNull(roastLevelSchema),
  green_shop_id: z.preprocess(emptyToNull, uuidSchema.nullable()).default(null),
  memo: textOrNull(2000),
});
export type RoastFormInput = z.input<typeof roastFormSchema>;
export type RoastFormValues = z.output<typeof roastFormSchema>;

export const roastInsertSchema = roastFormSchema.extend({ bean_id: uuidSchema, user_id: uuidSchema });
export type RoastInsert = z.output<typeof roastInsertSchema>;

export type _RoastInsertCompat = Expect<
  Extends<RoastInsert, Database['public']['Tables']['roasts']['Insert']>
>;

/** 減率（%）。生豆と焙煎後の重量から。どちらか無ければ null（F-ROAST-3） */
export function weightLossPercent(greenGrams: number | null, roastedGrams: number | null): number | null {
  if (greenGrams === null || roastedGrams === null || greenGrams <= 0) return null;
  return Math.round(((greenGrams - roastedGrams) / greenGrams) * 1000) / 10;
}

/** 「分:秒」表記（F-ROAST-4） */
export function formatDuration(sec: number | null): string | null {
  if (sec === null || sec < 0) return null;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** 「12:30」や「750」を秒に。空や不正は null */
export function parseDuration(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return /^\d+$/.test(s) ? Number(s) : null;
}
