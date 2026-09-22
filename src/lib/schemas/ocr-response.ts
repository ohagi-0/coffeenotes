import { z } from 'zod';
import { beanCardExtractionSchema } from './bean-card';

// /api/ocr の応答。ブラウザ側（features/ocr）とサーバー側（api/ocr/route.ts）で共有する。

export const ocrUsageSchema = z.object({
  /** 今日の使用回数（今回分を含む） */
  used: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});
export type OcrUsage = z.infer<typeof ocrUsageSchema>;

export const ocrResponseSchema = z.object({
  extraction: beanCardExtractionSchema,
  raw: z.unknown(),
  provider: z.string(),
  model: z.string().nullable(),
  durationMs: z.number().nonnegative(),
  usage: ocrUsageSchema,
});
export type OcrResponse = z.infer<typeof ocrResponseSchema>;

export const ocrApiErrorCodeSchema = z.enum([
  'unauthorized',
  'bad_request',
  'unsupported_image',
  'payload_too_large',
  'ocr_disabled',
  'quota_exceeded',
  'timeout',
  'provider',
  'invalid_output',
]);
export type OcrApiErrorCode = z.infer<typeof ocrApiErrorCodeSchema>;

export const ocrErrorResponseSchema = z.object({
  error: z.object({ code: ocrApiErrorCodeSchema, message: z.string() }),
  usage: ocrUsageSchema.optional(),
});
export type OcrErrorResponse = z.infer<typeof ocrErrorResponseSchema>;

/** 1 枚あたりの上限（圧縮後は 300KB 前後なので十分） */
export const OCR_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const OCR_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
