import { z } from 'zod';

/** 星評価: 1.0〜5.0 の 0.5 刻み（ADR 0004）。DB の CHECK 制約と対応。 */
export const ratingSchema = z
  .number()
  .min(1, '星は 1.0 以上です')
  .max(5, '星は 5.0 以下です')
  .refine((v) => Number.isInteger(v * 2), '星は 0.5 刻みで入力してください');

export type Rating = z.infer<typeof ratingSchema>;
