// OCR プロバイダの抽象化（F-OCR-6）。アプリ本体はこのインターフェース以外を import しない。
// 実装は providers/claude.ts（Phase 2）。`/api/ocr` からのみ呼ぶ。
import type { BeanCardExtraction } from '@/lib/schemas/bean-card';

export type { BeanCardExtraction };

export interface OcrProvider {
  extractBeanCard(images: { front: Blob; back?: Blob }): Promise<BeanCardExtraction>;
}

export class OcrError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'OcrError';
  }
}
