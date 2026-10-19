'use client';

// ブラウザから /api/geo を呼ぶ（絶対 URL、Bearer 付き。ネイティブ化制約 N-2）。
import { apiUrl } from '@/lib/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  geoErrorResponseSchema,
  geoResponseSchema,
  type GeoApiErrorCode,
  type PlaceCandidateDto,
} from '@/lib/schemas/geo-response';

export type GeoRequestErrorCode = GeoApiErrorCode | 'network' | 'aborted' | 'unknown';

export class GeoRequestError extends Error {
  constructor(
    message: string,
    public readonly code: GeoRequestErrorCode,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = 'GeoRequestError';
  }
}

async function callGeo(params: Record<string, string>, signal?: AbortSignal): Promise<PlaceCandidateDto[]> {
  const {
    data: { session },
  } = await getSupabaseBrowserClient().auth.getSession();
  if (!session) throw new GeoRequestError('ログインが必要です', 'unauthorized', 401);
  const url = new URL(apiUrl('/api/geo'));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` }, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError')
      throw new GeoRequestError('中止しました', 'aborted', null);
    throw new GeoRequestError('店候補のサービスに接続できませんでした', 'network', null);
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const e = geoErrorResponseSchema.safeParse(json);
    throw new GeoRequestError(
      e.success ? e.data.error.message : `HTTP ${res.status}`,
      e.success ? e.data.error.code : 'unknown',
      res.status,
    );
  }
  const parsed = geoResponseSchema.safeParse(json);
  if (!parsed.success)
    throw new GeoRequestError('店候補の形式が想定と違います', 'invalid_output', res.status);
  return parsed.data.candidates;
}

/** 現在地周辺のカフェ・ロースター（F-SHOP-3） */
export function searchNearbyPlaces(
  p: { lat: number; lng: number; radiusM?: number; limit?: number },
  signal?: AbortSignal,
) {
  return callGeo(
    {
      op: 'nearby',
      lat: String(p.lat),
      lng: String(p.lng),
      ...(p.radiusM ? { radiusM: String(p.radiusM) } : {}),
      ...(p.limit ? { limit: String(p.limit) } : {}),
    },
    signal,
  );
}

/** 店名からカフェ・コーヒー店の候補（F-SHOP-2/4）。部分一致に強く、near を渡すと近い店を優先する */
export function searchPlacesByName(
  p: { query: string; near?: { lat: number; lng: number } },
  signal?: AbortSignal,
) {
  return callGeo(
    { op: 'search', q: p.query, ...(p.near ? { lat: String(p.near.lat), lng: String(p.near.lng) } : {}) },
    signal,
  );
}

/** 住所・地名から座標（F-SHOP-4/6）。near を渡すと近い順 */
export function geocodePlace(
  p: { query: string; near?: { lat: number; lng: number } },
  signal?: AbortSignal,
) {
  return callGeo(
    { op: 'geocode', q: p.query, ...(p.near ? { lat: String(p.near.lat), lng: String(p.near.lng) } : {}) },
    signal,
  );
}

/** 検索シートが近くの店をまとめて取るときの範囲と件数（絞り込みは端末で行う。ADR 0010） */
export const PICKER_NEARBY_RADIUS_M = 2000;
export const PICKER_NEARBY_LIMIT = 300;

/** 店を選ぶ部品に渡す候補の取り方（近くの店 / 店名で検索 / 住所から位置） */
export type ShopCandidateSources = {
  nearby: (pos: { lat: number; lng: number }) => Promise<PlaceCandidateDto[]>;
  search: (query: string, near?: { lat: number; lng: number }) => Promise<PlaceCandidateDto[]>;
  geocode: (query: string, near?: { lat: number; lng: number }) => Promise<PlaceCandidateDto[]>;
};

export const shopCandidateSources: ShopCandidateSources = {
  nearby: (pos) =>
    searchNearbyPlaces({ ...pos, radiusM: PICKER_NEARBY_RADIUS_M, limit: PICKER_NEARBY_LIMIT }),
  search: (query, near) => searchPlacesByName({ query, near }),
  geocode: (query, near) => geocodePlace({ query, near }),
};
