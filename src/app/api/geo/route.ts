// GET /api/geo?op=nearby&lat=&lng=[&radiusM=&limit=] | ?op=search&q=[&lat=&lng=&session=] | ?op=geocode&q=[&lat=&lng=]
//   | ?op=details&id=[&session=]（Google の予測で選んだ店の座標）
// 周辺の店（F-SHOP-3）、店名での検索（F-SHOP-2/4）、住所 → 座標（F-SHOP-4/6）。
// 公開の OSM サーバーを叩くので、認証必須にして乱用を防ぐ。
import { GeoError } from '@/lib/geo';
import { getGeoProvider } from '@/lib/geo/factory';
import {
  geoQuerySchema,
  type GeoApiErrorCode,
  type GeoDetailsResponse,
  type GeoResponse,
} from '@/lib/schemas/geo-response';
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
    const cache = { 'Cache-Control': 'private, max-age=60' };
    if (q.op === 'details') {
      if (!provider.placeDetails) return fail(400, 'bad_request', 'この店検索サービスでは詳細を取れません');
      const candidate = await provider.placeDetails({ placeId: q.id, sessionToken: q.session });
      const detailsBody: GeoDetailsResponse = { candidate, provider: provider.name };
      return Response.json(detailsBody, { headers: cache });
    }
    const near =
      q.op !== 'nearby' && q.lat !== undefined && q.lng !== undefined
        ? { lat: q.lat, lng: q.lng }
        : undefined;
    if (q.op === 'search' && provider.suggestPlaces) {
      const suggestions = await provider.suggestPlaces({ query: q.q, near, sessionToken: q.session });
      const suggestBody: GeoResponse = { candidates: [], suggestions, provider: provider.name };
      return Response.json(suggestBody, { headers: cache });
    }
    const candidates =
      q.op === 'nearby'
        ? await provider.searchNearby({ lat: q.lat, lng: q.lng, radiusM: q.radiusM, limit: q.limit })
        : q.op === 'search'
          ? await (provider.searchPlaces?.({ query: q.q, near }) ?? Promise.resolve([]))
          : await provider.geocode({ query: q.q, near });
    const body: GeoResponse = { candidates, provider: provider.name };
    return Response.json(body, { headers: cache });
  } catch (err) {
    if (err instanceof GeoError) {
      return fail(err.code === 'timeout' ? 504 : 502, err.code, err.message);
    }
    console.error('[api/geo] unexpected error', err);
    return fail(500, 'provider', '店候補の取得中に予期しないエラーが起きました');
  }
}
