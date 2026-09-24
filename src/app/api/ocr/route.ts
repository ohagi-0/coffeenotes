// POST /api/ocr — カード画像から豆情報を抽出する（F-OCR-2 / F-OCR-6）。
// 認証（Bearer または Cookie）→ 1 日 50 回の上限（DB 関数）→ プロバイダ呼び出し → Zod 検証。
// API キーはここ（サーバー）でしか使わない。ブラウザは NEXT_PUBLIC_API_BASE_URL 基点の絶対 URL でここを呼ぶ。
import { OcrError } from '@/lib/ocr';
import { getOcrProvider } from '@/lib/ocr/factory';
import {
  OCR_IMAGE_MIME_TYPES,
  OCR_MAX_IMAGE_BYTES,
  type OcrApiErrorCode,
  type OcrErrorResponse,
  type OcrResponse,
  type OcrUsage,
} from '@/lib/schemas/ocr-response';
import { createRouteClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// プロバイダのタイムアウト 30 秒 × SDK のリトライ 1 回に収まるように
export const maxDuration = 60;

function fail(status: number, code: OcrApiErrorCode, message: string, usage?: OcrUsage): Response {
  const body: OcrErrorResponse = { error: { code, message }, ...(usage ? { usage } : {}) };
  return Response.json(body, { status });
}

function checkImage(
  value: FormDataEntryValue | null,
  label: string,
  required: boolean,
): Blob | null | Response {
  if (value === null || value === '') {
    return required ? fail(400, 'bad_request', `${label}面の画像がありません`) : null;
  }
  if (typeof value === 'string') return fail(400, 'bad_request', `${label}面はファイルで送ってください`);
  if (value.size > OCR_MAX_IMAGE_BYTES) {
    return fail(413, 'payload_too_large', `${label}面の画像が大きすぎます（上限 5MB）`);
  }
  if (!(OCR_IMAGE_MIME_TYPES as readonly string[]).includes(value.type)) {
    return fail(
      415,
      'unsupported_image',
      `${label}面の画像形式に対応していません（${value.type || '不明'}）`,
    );
  }
  return value;
}

export async function POST(request: Request): Promise<Response> {
  const supabase = createRouteClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, 'unauthorized', 'ログインが必要です');

  const provider = getOcrProvider();
  if (!provider) return fail(503, 'ocr_disabled', 'カードの読み取りは現在無効です。手で入力してください');

  const form = await request.formData().catch(() => null);
  if (!form) return fail(400, 'bad_request', '画像を multipart/form-data で送ってください');
  const front = checkImage(form.get('front'), '表', true);
  if (front instanceof Response) return front;
  const back = checkImage(form.get('back'), '裏', false);
  if (back instanceof Response) return back;
  if (!front) return fail(400, 'bad_request', '表面の画像がありません');

  // 上限の消費は本人の JWT で DB 関数を呼ぶ（SECURITY DEFINER。上限値は DB 側に固定）
  const quota = await supabase.rpc('consume_ocr_quota');
  if (quota.error) return fail(500, 'provider', `読み取り回数を確認できませんでした: ${quota.error.message}`);
  const row = quota.data?.[0];
  if (!row) return fail(500, 'provider', '読み取り回数を確認できませんでした');
  const usage: OcrUsage = { used: row.used, limit: row.daily_limit };
  if (!row.allowed) {
    return fail(
      429,
      'quota_exceeded',
      `今日の読み取り回数（${row.daily_limit} 回）を使い切りました。明日 0 時に戻ります`,
      usage,
    );
  }

  try {
    const result = await provider.extractBeanCard({ front, back: back ?? undefined });
    const body: OcrResponse = { ...result, usage };
    return Response.json(body);
  } catch (err) {
    if (err instanceof OcrError) {
      const status =
        err.code === 'timeout'
          ? 504
          : err.code === 'unsupported_image'
            ? 415
            : err.code === 'invalid_output'
              ? 502
              : 502;
      return fail(status, err.code, err.message, usage);
    }
    console.error('[api/ocr] unexpected error', err);
    return fail(500, 'provider', '読み取り中に予期しないエラーが起きました', usage);
  }
}
