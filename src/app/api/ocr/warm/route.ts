// POST/GET /api/ocr/warm — OCR プロバイダのウォームアップ（F-OCR-2 の体感速度対策）。
// Claude の strict ツールスキーマは初回に文法コンパイルが走り、丸 1 日使わないとキャッシュ（24 時間）が切れて
// 最初の 1 回が 15〜30 秒かかる。GitHub Actions（.github/workflows/ocr-warmup.yml）が 12 時間ごとにここを叩いて
// 切らさないようにする。合言葉は CRON_SECRET（Vercel と GitHub Secrets に同じ値）。ユーザーの上限は消費しない。
import { isCronAuthorized } from '@/lib/cron-auth';
import { getServerEnv } from '@/lib/env';
import { OcrError } from '@/lib/ocr';
import { getOcrProvider } from '@/lib/ocr/factory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 初回コンパイルが終わるまで待つ（プロバイダ側のウォームアップ用タイムアウト 90 秒 + 余裕）
export const maxDuration = 120;

async function handle(request: Request): Promise<Response> {
  const { CRON_SECRET } = getServerEnv();
  if (!CRON_SECRET) {
    return Response.json(
      { error: { code: 'not_configured', message: 'CRON_SECRET が未設定です' } },
      { status: 503 },
    );
  }
  if (!isCronAuthorized(request, CRON_SECRET)) {
    return Response.json({ error: { code: 'unauthorized', message: '合言葉が違います' } }, { status: 401 });
  }

  const provider = getOcrProvider();
  if (!provider?.warmUp) {
    return Response.json({ warmed: false, reason: provider ? 'not_supported' : 'ocr_disabled' });
  }
  try {
    const result = await provider.warmUp();
    return Response.json({ warmed: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof OcrError ? err.code : 'provider';
    return Response.json({ warmed: false, error: { code, message } }, { status: 502 });
  }
}

export const POST = handle;
export const GET = handle;
