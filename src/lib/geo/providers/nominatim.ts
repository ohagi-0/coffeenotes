// OpenStreetMap ベースのプロバイダ（ADR 0003）。
// - 現在地周辺の候補: Overpass API（amenity=cafe / shop=coffee）
// - 店名・住所 → 座標: Nominatim
// どちらも公開サーバーで、利用ポリシー上 User-Agent の明示と低頻度（1 req/秒）が求められる。
// サーバー（/api/geo）からのみ呼ぶ。テストからは fetch を注入する。
import { GeoError, distanceM, type GeoProvider, type PlaceCandidate } from '@/lib/geo';

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
export const GEO_USER_AGENT = 'coffeenotes/0.1 (https://coffee-notes.app; contact via GitHub issues)';
export const GEO_TIMEOUT_MS = 10_000;

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
    out.push({
      name,
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
    const candidate: PlaceCandidate = {
      name,
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

async function fetchJson<T>(fetchImpl: Fetch, url: string, init: RequestInit, label: string): Promise<T> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), GEO_TIMEOUT_MS);
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
      throw new GeoError(`${label} が ${GEO_TIMEOUT_MS / 1000} 秒以内に応答しませんでした`, 'timeout', err);
    }
    throw new GeoError(`${label} に接続できませんでした`, 'provider', err);
  } finally {
    clearTimeout(timer);
  }
}

export function createNominatimProvider(fetchImpl: Fetch = fetch): GeoProvider {
  return {
    name: 'nominatim',
    async searchNearby({ lat, lng, radiusM = 800, limit = 20 }) {
      const query = `[out:json][timeout:8];(node["amenity"="cafe"](around:${radiusM},${lat},${lng});way["amenity"="cafe"](around:${radiusM},${lat},${lng});node["shop"="coffee"](around:${radiusM},${lat},${lng});way["shop"="coffee"](around:${radiusM},${lat},${lng}););out center ${Math.min(limit * 2, 60)};`;
      const data = await fetchJson<{ elements?: OverpassElement[] }>(
        fetchImpl,
        OVERPASS_URL,
        {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
        'Overpass',
      );
      if (!Array.isArray(data.elements))
        throw new GeoError('Overpass の応答が想定と違います', 'invalid_output', data);
      return candidatesFromOverpass(data.elements, { lat, lng }).slice(0, limit);
    },
    async geocode({ query, near, limit = 8 }) {
      const q = query.trim();
      if (!q) return [];
      const params = new URLSearchParams({
        q,
        format: 'jsonv2',
        addressdetails: '1',
        namedetails: '0',
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
      if (!Array.isArray(data))
        throw new GeoError('Nominatim の応答が想定と違います', 'invalid_output', data);
      const list = candidatesFromNominatim(data, near);
      return near ? list.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0)) : list;
    },
  };
}
