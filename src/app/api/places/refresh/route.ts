// POST /api/places/refresh — Google の店の 30 日更新ジョブ（ADR 0011、F-SHOP-1）。
// .github/workflows/google-places-refresh.yml が週 1 回叩く。合言葉は CRON_SECRET（/api/ocr/warm と同じ方式）。
// 全ユーザーの店が対象で RLS を越える必要があるため、ここだけ service role クライアントを使う（CLAUDE.md §3.1）。
// 1 回の実行は最大 200 件。結果（refreshed / moved / demoted / failed）を JSON で返す。
import { refreshGoogleShops } from '@/features/shops/refresh-google-shops';
import { isCronAuthorized } from '@/lib/cron-auth';
import { getServerEnv } from '@/lib/env';
import { createGoogleProvider } from '@/lib/geo/providers/google';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const NO_STORE = { 'Cache-Control': 'no-store' };

function fail(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  const { CRON_SECRET, GOOGLE_MAPS_API_KEY, SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  if (!CRON_SECRET) return fail(503, 'not_configured', 'CRON_SECRET が未設定です');
  if (!isCronAuthorized(request, CRON_SECRET)) return fail(401, 'unauthorized', '合言葉が違います');
  if (!GOOGLE_MAPS_API_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return fail(503, 'not_configured', 'GOOGLE_MAPS_API_KEY と SUPABASE_SERVICE_ROLE_KEY が必要です');
  }
  try {
    const provider = createGoogleProvider(GOOGLE_MAPS_API_KEY);
    const summary = await refreshGoogleShops(createServiceClient(), (id) => provider.refreshPlace(id));
    return Response.json(summary, { headers: NO_STORE });
  } catch (err) {
    console.error('[api/places/refresh] failed', err);
    return fail(500, 'provider', err instanceof Error ? err.message : '更新に失敗しました');
  }
}
