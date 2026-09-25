import { z } from 'zod';

// OCR 抽出結果のスキーマ（CLAUDE.md §5.2）。
// 各項目は { value, confidence } で返し、UI で低信頼度を強調できるようにする。

const confidence = z.number().min(0).max(1);

function extracted<T extends z.ZodTypeAny>(value: T) {
  return z.object({ value: value.nullable(), confidence });
}

export const tasteScoreSchema = z.number().int().min(1).max(5);

export const beanCardExtractionSchema = z.object({
  name: extracted(z.string()),
  roaster: extracted(z.string()),
  country: extracted(z.string()),
  region: extracted(z.string()),
  farm: extracted(z.string()),
  harvestYear: extracted(z.number().int().min(1900).max(2100)),
  variety: extracted(z.string()),
  process: extracted(z.string()),
  altitudeM: extracted(z.number().int().nonnegative()),
  flavorNotes: extracted(z.array(z.string())),
  description: extracted(z.string()),
  taste: extracted(
    z.object({
      flavor: tasteScoreSchema.nullable(),
      sweetness: tasteScoreSchema.nullable(),
      acidity: tasteScoreSchema.nullable(),
      aftertaste: tasteScoreSchema.nullable(),
      body: tasteScoreSchema.nullable(),
    }),
  ),
  priceJpy: extracted(z.number().int().nonnegative()),
  priceGrams: extracted(z.number().int().positive()),
  roastLevel: extracted(z.enum(['light', 'medium', 'dark'])),
  referenceUrl: extracted(z.url()),
});

export type BeanCardExtraction = z.infer<typeof beanCardExtractionSchema>;

/** 信頼度がこの値未満の項目は UI で「要確認」として強調する */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;
