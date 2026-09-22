'use client';

// ブラウザから /api/ocr を呼ぶ（絶対 URL、Bearer 付き。ネイティブ化制約 N-2）。
import { apiUrl } from '@/lib/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  ocrErrorResponseSchema,
  ocrResponseSchema,
  type OcrApiErrorCode,
  type OcrResponse,
  type OcrUsage,
} from '@/lib/schemas/ocr-response';

export type OcrRequestErrorCode = OcrApiErrorCode | 'network' | 'aborted' | 'unknown';

export class OcrRequestError extends Error {
  constructor(
    message: string,
    public readonly code: OcrRequestErrorCode,
    public readonly status: number | null,
    public readonly usage?: OcrUsage,
  ) {
    super(message);
    this.name = 'OcrRequestError';
  }
}

export interface ExtractBeanCardInput {
  front: Blob;
  back?: Blob | null;
  signal?: AbortSignal;
}

/** カード画像を送って抽出結果を受け取る。失敗は OcrRequestError（code で UI が出し分ける）。 */
export async function requestBeanCardExtraction({
  front,
  back,
  signal,
}: ExtractBeanCardInput): Promise<OcrResponse> {
  const {
    data: { session },
  } = await getSupabaseBrowserClient().auth.getSession();
  if (!session) throw new OcrRequestError('ログインが必要です', 'unauthorized', 401);

  const body = new FormData();
  body.append('front', front, 'front.jpg');
  if (back) body.append('back', back, 'back.jpg');

  let res: Response;
  try {
    res = await fetch(apiUrl('/api/ocr'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body,
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new OcrRequestError('読み取りを中止しました', 'aborted', null);
    }
    throw new OcrRequestError('読み取りサービスに接続できませんでした', 'network', null);
  }

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ocrErrorResponseSchema.safeParse(json);
    if (parsed.success) {
      throw new OcrRequestError(
        parsed.data.error.message,
        parsed.data.error.code,
        res.status,
        parsed.data.usage,
      );
    }
    throw new OcrRequestError(`読み取りに失敗しました（HTTP ${res.status}）`, 'unknown', res.status);
  }
  const parsed = ocrResponseSchema.safeParse(json);
  if (!parsed.success)
    throw new OcrRequestError('読み取り結果の形式が想定と違います', 'invalid_output', res.status);
  return parsed.data;
}
