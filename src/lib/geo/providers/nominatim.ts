// OpenStreetMap ベースのプロバイダ（ADR 0003 / ADR 0010）。
// - 現在地周辺の候補: Overpass API（amenity=cafe / shop=coffee / cuisine=coffee_shop）。落ちていたら Photon の reverse
// - 店名 → 候補: Photon（部分一致・近い順）。落ちていたら Nominatim
// - 住所 → 座標: Nominatim
// どちらも公開サーバーで、利用ポリシー上 User-Agent の明示と低頻度（1 req/秒）が求められる。
// 店名検索は Nominatim だけだと完全一致に近い名前しか当たらない（「フグレン」では英字名の Fuglen Tokyo が出ない）。
// そこで周辺の店をまとめて（別名つきで）返し、絞り込みは端末側のあいまい照合（lib/geo/match.ts）で行う（ADR 0010）。
// サーバー（/api/geo）からのみ呼ぶ。テストからは fetch を注入する。
import { GeoError, distanceM, type GeoProvider, type PlaceCandidate } from '@/lib/geo';
import { mergeCandidates } from '@/lib/geo/match';
import { isKanaQuery, kanaToRomaji } from '@/lib/geo/romaji';
import {
  candidatesFromPhoton,
  photonReverseUrl,
  photonSearchUrl,
  type PhotonFeature,
} from '@/lib/geo/providers/photon';

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
/** 本家が混んでいる（429 / 5xx / 接続できない）ときに 1 回だけ試す予備のサーバー */
export const OVERPASS_FALLBACK_URL = 'https://overpass.private.coffee/api/interpreter';
/** Photon の周辺検索が返ってから、Overpass をあと何ミリ秒待つか（それを過ぎたら Photon の結果を使う） */
export const OVERPASS_GRACE_MS = 2_000;
/** 周辺検索の結果を同じ場所で使い回す時間（Overpass の負荷を下げる） */
export const NEARBY_CACHE_TTL_MS = 10 * 60_000;
const NEARBY_CACHE_MAX = 50;
export const GEO_USER_AGENT = 'coffeenotes/0.1 (https://coffee-notes.app; contact via GitHub issues)';
export const GEO_TIMEOUT_MS = 10_000;
/** Overpass は固まると返ってこないので早めに切って Photon に回す */
export const OVERPASS_TIMEOUT_MS = 6_000;

type Fetch = typeof fetch;

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface NominatimResult {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
  namedetails?: Record<string, string>;
}

/** 照合に使う別名のタグ（英字名・読み・ブランド名など） */
const ALIAS_KEYS = [
  'name',
  'name:ja',
  'name:en',
  'name:ja-Latn',
  'name:ja_rm',
  'name:ja-Hira',
  'name:ja_kana',
  'name:ja-Kana',
  'brand',
  'brand:ja',
  'brand:en',
  'alt_name',
  'alt_name:ja',
  'short_name',
  'official_name',
  'old_name',
];

/** タグから表示名以外の別名を集める（重複と表示名そのものは除く）。無ければ undefined */
export function aliasesFromTags(
  tags: Record<string, string> | undefined,
  primary: string,
): string[] | undefined {
  if (!tags) return undefined;
  const seen = new Set([primary]);
  const out: string[] = [];
  for (const k of ALIAS_KEYS) {
    for (const v of (tags[k] ?? '').split(';')) {
      const t = v.trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
  }
  return out.length ? out : undefined;
}

/** OSM のタグから住所らしい 1 行を作る（無ければ null） */
export function addressFromTags(tags: Record<string, string> | undefined): string | null {
  if (!tags) return null;
  if (tags['addr:full']) return tags['addr:full'];
  const parts = [
    tags['addr:province'] ?? tags['addr:state'],
    tags['addr:city'],
    tags['addr:suburb'] ?? tags['addr:quarter'],
    tags['addr:neighbourhood'],
    tags['addr:block_number'] ? `${tags['addr:block_number']}-` : undefined,
    tags['addr:housenumber'],
  ].filter((v): v is string => !!v);
  return parts.length ? parts.join('').replace(/-$/, '') : null;
}

/** Overpass の要素を候補に変換する純粋関数（名前が無い要素は捨てる） */
export function candidatesFromOverpass(
  elements: OverpassElement[],
  origin: { lat: number; lng: number },
): PlaceCandidate[] {
  const out: PlaceCandidate[] = [];
  for (const el of elements) {
    const name = el.tags?.['name:ja'] ?? el.tags?.name;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!name || lat === undefined || lng === undefined) continue;
    const aliases = aliasesFromTags(el.tags, name);
    out.push({
      name,
      ...(aliases ? { aliases } : {}),
      address: addressFromTags(el.tags),
      lat,
      lng,
      externalPlaceId: `${el.type}/${el.id}`,
      distanceM: distanceM(origin, { lat, lng }),
    });
  }
  return out.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
}

/** Nominatim の結果を候補に変換する純粋関数 */
export function candidatesFromNominatim(
  results: NominatimResult[],
  near?: { lat: number; lng: number },
): PlaceCandidate[] {
  const out: PlaceCandidate[] = [];
  for (const r of results) {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const name = r.name?.trim() || r.display_name.split(',')[0]?.trim() || r.display_name;
    const a = r.address ?? {};
    const address =
      [a.state ?? a.province, a.city ?? a.town ?? a.village, a.suburb ?? a.quarter, a.neighbourhood, a.road]
        .filter(Boolean)
        .join('') || r.display_name;
    const aliases = aliasesFromTags(r.namedetails, name);
    const candidate: PlaceCandidate = {
      name,
      ...(aliases ? { aliases } : {}),
      address,
      lat,
      lng,
      externalPlaceId: r.osm_type && r.osm_id ? `${r.osm_type}/${r.osm_id}` : null,
    };
    if (near) candidate.distanceM = distanceM(near, { lat, lng });
    out.push(candidate);
  }
  return out;
}

async function fetchJson<T>(
  fetchImpl: Fetch,
  url: string,
  init: RequestInit,
  label: string,
  timeoutMs: number = GEO_TIMEOUT_MS,
): Promise<T> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      ...init,
      signal: ac.signal,
      headers: { 'User-Agent': GEO_USER_AGENT, Accept: 'application/json', ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new GeoError(`${label} がエラーを返しました（HTTP ${res.status}）`, 'provider');
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof GeoError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GeoError(`${label} が ${timeoutMs / 1000} 秒以内に応答しませんでした`, 'timeout', err);
    }
    throw new GeoError(`${label} に接続できませんでした`, 'provider', err);
  } finally {
    clearTimeout(timer);
  }
}

/** 周辺のカフェ・コーヒー店を引く Overpass QL。名前のある要素だけ、中心座標とタグ付きで返す */
export function overpassNearbyQuery(lat: number, lng: number, radiusM: number, limit: number): string {
  const around = `(around:${radiusM},${lat},${lng})`;
  const filters = ['["amenity"="cafe"]', '["shop"="coffee"]', '["cuisine"~"coffee_shop"]'];
  const parts = filters.map((f) => `nwr${f}["name"]${around};`).join('');
  // 件数の打ち切りは近い順ではないので、多めに取ってから距離で並べて切る
  return `[out:json][timeout:8];(${parts});out center ${Math.min(limit * 2, 800)};`;
}

export function createNominatimProvider(
  fetchImpl: Fetch = fetch,
  now: () => number = Date.now,
): GeoProvider & Required<Pick<GeoProvider, 'searchPlaces'>> {
  const nearbyCache = new Map<string, { at: number; list: PlaceCandidate[] }>();

  async function overpass(query: string): Promise<{ elements?: OverpassElement[] }> {
    const init: RequestInit = {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    };
    try {
      return await fetchJson(fetchImpl, OVERPASS_URL, init, 'Overpass', OVERPASS_TIMEOUT_MS);
    } catch (err) {
      // 混雑・接続エラーのときだけ予備へ。時間切れは待たせすぎになるのでそのまま返す
      if (err instanceof GeoError && err.code === 'provider')
        return fetchJson(fetchImpl, OVERPASS_FALLBACK_URL, init, 'Overpass', OVERPASS_TIMEOUT_MS);
      throw err;
    }
  }

  async function photon(url: string): Promise<PhotonFeature[]> {
    const data = await fetchJson<{ features?: PhotonFeature[] }>(fetchImpl, url, { method: 'GET' }, 'Photon');
    if (!Array.isArray(data.features))
      throw new GeoError('Photon の応答が想定と違います', 'invalid_output', data);
    return data.features;
  }

  async function nominatim(query: string, limit: number): Promise<NominatimResult[]> {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      namedetails: '1',
      countrycodes: 'jp',
      limit: String(limit),
      'accept-language': 'ja',
    });
    const data = await fetchJson<NominatimResult[]>(
      fetchImpl,
      `${NOMINATIM_URL}?${params}`,
      { method: 'GET' },
      'Nominatim',
    );
    if (!Array.isArray(data)) throw new GeoError('Nominatim の応答が想定と違います', 'invalid_output', data);
    return data;
  }

  const byDistance = (list: PlaceCandidate[]) => list.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));

  return {
    name: 'osm',
    async searchNearby({ lat, lng, radiusM = 800, limit = 20 }) {
      // 約 100m 四方で丸めて使い回す（検索シートを開き直すたびに Overpass を叩かない）
      const key = `${lat.toFixed(3)},${lng.toFixed(3)},${radiusM},${limit}`;
      const hit = nearbyCache.get(key);
      if (hit && now() - hit.at < NEARBY_CACHE_TTL_MS) {
        return hit.list.map((c) => ({ ...c, distanceM: distanceM({ lat, lng }, c) }));
      }
      // Overpass は公開サーバーがよく混む・落ちる（2026-10-19 に本家・予備とも応答なしを確認）。
      // 待たせないよう Photon の周辺検索（最大 50 件・別名なし）を同時に投げておき、Overpass がだめならそちらを使う
      const overpassResult = overpass(overpassNearbyQuery(lat, lng, radiusM, limit));
      const photonNearby = photon(photonReverseUrl(lat, lng, radiusM, limit)).then(
        (features) => byDistance(candidatesFromPhoton(features, { lat, lng })).slice(0, limit),
        (err: unknown) => err as Error,
      );
      // 結果を使わなくなった Overpass の失敗が「未処理の拒否」にならないようにしておく
      overpassResult.catch(() => undefined);
      // Photon が返ってから OVERPASS_GRACE_MS 待っても Overpass が返らなければ、Photon の結果を使う
      const graceExpired = photonNearby.then((r) =>
        r instanceof Error
          ? new Promise<never>(() => {})
          : new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new GeoError('Overpass の応答が遅いので Photon の結果を使います', 'timeout')),
                OVERPASS_GRACE_MS,
              ),
            ),
      );
      let list: PlaceCandidate[];
      try {
        const data = await Promise.race([overpassResult, graceExpired]);
        if (!Array.isArray(data.elements))
          throw new GeoError('Overpass の応答が想定と違います', 'invalid_output', data);
        list = candidatesFromOverpass(data.elements, { lat, lng }).slice(0, limit);
      } catch (err) {
        if (!(err instanceof GeoError)) throw err;
        const fallback = await photonNearby;
        if (fallback instanceof Error) throw err;
        return fallback;
      }
      if (nearbyCache.size >= NEARBY_CACHE_MAX) {
        const oldest = nearbyCache.keys().next().value;
        if (oldest !== undefined) nearbyCache.delete(oldest);
      }
      nearbyCache.set(key, { at: now(), list });
      return list;
    },
    async searchPlaces({ query, near, limit = 15 }) {
      const q = query.trim();
      if (!q) return [];
      try {
        // かなだけの検索語は、ローマ字にした語でも引いて英字名の店に当てる（フグレン → fuguren → Fuglen）
        const romaji = isKanaQuery(q) ? kanaToRomaji(q) : null;
        const [main, alt] = await Promise.all([
          photon(photonSearchUrl(q, near, limit)),
          romaji ? photon(photonSearchUrl(romaji, near, limit)).catch(() => []) : Promise.resolve([]),
        ]);
        return mergeCandidates(candidatesFromPhoton(main, near), candidatesFromPhoton(alt, near));
      } catch (err) {
        if (!(err instanceof GeoError)) throw err;
        const list = candidatesFromNominatim(await nominatim(q, limit), near);
        return near ? byDistance(list) : list;
      }
    },
    async geocode({ query, near, limit = 8 }) {
      const q = query.trim();
      if (!q) return [];
      const list = candidatesFromNominatim(await nominatim(q, limit), near);
      return near ? byDistance(list) : list;
    },
  };
}
