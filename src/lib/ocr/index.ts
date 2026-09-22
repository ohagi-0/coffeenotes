// OCR プロバイダの抽象化（F-OCR-6）。アプリ本体はこのインターフェース以外を import しない。
// 実装は providers/claude.ts。`/api/ocr`（src/app/api/ocr/route.ts）からのみ呼ぶ。API キーはサーバーにしか無い。
import type { BeanCardExtraction } from '@/lib/schemas/bean-card';

export type { BeanCardExtraction };

/** 1 ユーザー 1 日の読み取り上限。DB の関数 `ocr_daily_limit()` と同じ値（表示用のミラー）。 */
export const OCR_DAILY_LIMIT = 50;

export interface OcrImages {
  /** 表面（必須）。長辺 1,600px の JPEG に圧縮済みであること */
  front: Blob;
  /** 裏面（任意） */
  back?: Blob;
}

export interface OcrResult {
  /** Zod 検証済みの抽出結果（各項目 { value, confidence }） */
  extraction: BeanCardExtraction;
  /** プロバイダの生出力。`beans.ocr_raw` に保存して再抽出・方式比較に使う */
  raw: unknown;
  provider: string;
  model: string | null;
  durationMs: number;
}

export interface OcrProvider {
  readonly name: string;
  extractBeanCard(images: OcrImages): Promise<OcrResult>;
}

export type OcrErrorCode =
  /** 画像の形式が受け付けられない */
  | 'unsupported_image'
  /** 規定時間内に応答が無かった */
  | 'timeout'
  /** プロバイダ側のエラー（認証、レート制限、5xx など） */
  | 'provider'
  /** 応答はあったが、期待した JSON にならなかった */
  | 'invalid_output';

export class OcrError extends Error {
  constructor(
    message: string,
    public readonly code: OcrErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'OcrError';
  }
}
