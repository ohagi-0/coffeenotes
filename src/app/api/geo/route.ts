// GET /api/geo?op=nearby&lat=&lng=[&radiusM=] | ?op=geocode&q=[&lat=&lng=]
// 店候補（F-SHOP-3）とジオコーディング（F-SHOP-4）。公開の OSM サーバーを叩くので、認証必須にして乱用を防ぐ。
import { GeoError } from '@/lib/geo';
import { getGeoProvider } from '@/lib/geo/factory';
import { geoQuerySchema, type GeoApiErrorCode, type GeoResponse } from '@/lib/schemas/geo-response';
import { createRouteClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(status: number, code: GeoApiErrorCode, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(request: Request): Promise<Response> {
  const supabase = createRouteClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, 'unauthorized', 'ログインが必要です');

  const url = new URL(request.url);
  const parsed = geoQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return fail(400, 'bad_request', 'パラメータが不正です');
  const q = parsed.data;

  try {
    const provider = getGeoProvider();
    const candidates =
      q.op === 'nearby'
        ? await provider.searchNearby({ lat: q.lat, lng: q.lng, radiusM: q.radiusM })
        : await provider.geocode({
            query: q.q,
            near: q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : undefined,
          });
    const body: GeoResponse = { candidates, provider: provider.name };
    return Response.json(body, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (err) {
    if (err instanceof GeoError) {
      return fail(err.code === 'timeout' ? 504 : 502, err.code, err.message);
    }
    console.error('[api/geo] unexpected error', err);
    return fail(500, 'provider', '店候補の取得中に予期しないエラーが起きました');
  }
}
