// Photon（komoot が公開している OSM の検索サーバー）。入力途中の語でも当たり、位置を渡すと近い順に寄せてくれる。
// 店名での検索（searchPlaces）と、Overpass が落ちているときの周辺検索の予備に使う（ADR 0010）。
// 公開サーバーなので User-Agent を付け、乱用しない（/api/geo は認証必須）。
import { distanceM, type PlaceCandidate } from '@/lib/geo';

export const PHOTON_URL = 'https://photon.komoot.io';
/** カフェ・コーヒー店だけに絞るタグ */
export const PHOTON_CAFE_TAGS = ['amenity:cafe', 'shop:coffee'] as const;
/** reverse（周辺）で返ってくる最大件数（サーバー側の上限） */
export const PHOTON_REVERSE_MAX = 50;

export interface PhotonFeature {
  properties?: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    state?: string;
    countrycode?: string;
  };
  geometry?: { coordinates?: [number, number] };
}

const OSM_TYPE: Record<string, string> = { N: 'node', W: 'way', R: 'relation' };

/** Photon の結果を候補に変換する純粋関数。ID は Overpass / Nominatim と同じ "node/123" の形にそろえる */
export function candidatesFromPhoton(
  features: PhotonFeature[],
  near?: { lat: number; lng: number },
): PlaceCandidate[] {
  const out: PlaceCandidate[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const [lng, lat] = f.geometry?.coordinates ?? [];
    const name = p.name?.trim();
    if (!name || typeof lat !== 'number' || typeof lng !== 'number') continue;
    if (p.countrycode && p.countrycode.toUpperCase() !== 'JP') continue;
    // 日本の住所の順（都道府県 → 市区 → 町 → 番地）。city に都道府県が入ることがあるので重複は除く
    const parts = [p.state, p.city, p.district, p.locality, p.housenumber].filter(
      (v, i, a): v is string => !!v && a.indexOf(v) === i,
    );
    const type = p.osm_type ? OSM_TYPE[p.osm_type] : undefined;
    const c: PlaceCandidate = {
      name,
      address: parts.length ? parts.join('') : null,
      lat,
      lng,
      externalPlaceId: type && p.osm_id ? `${type}/${p.osm_id}` : null,
    };
    if (near) c.distanceM = distanceM(near, { lat, lng });
    out.push(c);
  }
  return out;
}

/** 店名検索の URL */
export function photonSearchUrl(
  query: string,
  near: { lat: number; lng: number } | undefined,
  limit: number,
): string {
  const u = new URL('/api', PHOTON_URL);
  u.searchParams.set('q', query);
  u.searchParams.set('limit', String(limit));
  if (near) {
    u.searchParams.set('lat', String(near.lat));
    u.searchParams.set('lon', String(near.lng));
  }
  for (const t of PHOTON_CAFE_TAGS) u.searchParams.append('osm_tag', t);
  return u.toString();
}

/** 周辺検索の URL（radiusKm は Photon の単位） */
export function photonReverseUrl(lat: number, lng: number, radiusM: number, limit: number): string {
  const u = new URL('/reverse', PHOTON_URL);
  u.searchParams.set('lat', String(lat));
  u.searchParams.set('lon', String(lng));
  u.searchParams.set('radius', String(Math.max(0.1, radiusM / 1000)));
  u.searchParams.set('limit', String(Math.min(limit, PHOTON_REVERSE_MAX)));
  for (const t of PHOTON_CAFE_TAGS) u.searchParams.append('osm_tag', t);
  return u.toString();
}
