'use client';

// ブラウザから /api/geo を呼ぶ（絶対 URL、Bearer 付き。ネイティブ化制約 N-2）。
import { apiUrl } from '@/lib/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  geoDetailsResponseSchema,
  geoErrorResponseSchema,
  geoResponseSchema,
  type GeoApiErrorCode,
  type GeoResponse,
  type PlaceCandidateDto,
  type PlaceSuggestionDto,
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

async function callGeoJson(params: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
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
  return json;
}

async function callGeoResponse(params: Record<string, string>, signal?: AbortSignal): Promise<GeoResponse> {
  const parsed = geoResponseSchema.safeParse(await callGeoJson(params, signal));
  if (!parsed.success) throw new GeoRequestError('店候補の形式が想定と違います', 'invalid_output', null);
  return parsed.data;
}

async function callGeo(params: Record<string, string>, signal?: AbortSignal): Promise<PlaceCandidateDto[]> {
  return (await callGeoResponse(params, signal)).candidates;
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

/** 店名の予測（Google。座標なし）。session は入力 → 選択を 1 課金にまとめる UUID。candidates が返るのは OSM 系のとき */
export async function suggestPlacesByName(
  p: { query: string; near?: { lat: number; lng: number }; session?: string },
  signal?: AbortSignal,
): Promise<{ suggestions: PlaceSuggestionDto[]; candidates: PlaceCandidateDto[] }> {
  const r = await callGeoResponse(
    {
      op: 'search',
      q: p.query,
      ...(p.near ? { lat: String(p.near.lat), lng: String(p.near.lng) } : {}),
      ...(p.session ? { session: p.session } : {}),
    },
    signal,
  );
  return { suggestions: r.suggestions ?? [], candidates: r.candidates };
}

/** 予測で選んだ店の名前・住所・座標（Google の Place Details）。session を渡すと Autocomplete のセッションが閉じる */
export async function getPlaceDetails(
  p: { placeId: string; session?: string },
  signal?: AbortSignal,
): Promise<PlaceCandidateDto | null> {
  const parsed = geoDetailsResponseSchema.safeParse(
    await callGeoJson({ op: 'details', id: p.placeId, ...(p.session ? { session: p.session } : {}) }, signal),
  );
  if (!parsed.success) throw new GeoRequestError('店情報の形式が想定と違います', 'invalid_output', null);
  return parsed.data.candidate;
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
  /** 予測で選んだ店の座標を取る（Google のみ。#36 で検索シートが使う） */
  details?: (placeId: string, session?: string) => Promise<PlaceCandidateDto | null>;
};

export const shopCandidateSources: ShopCandidateSources = {
  nearby: (pos) =>
    searchNearbyPlaces({ ...pos, radiusM: PICKER_NEARBY_RADIUS_M, limit: PICKER_NEARBY_LIMIT }),
  search: (query, near) => searchPlacesByName({ query, near }),
  geocode: (query, near) => geocodePlace({ query, near }),
  details: (placeId, session) => getPlaceDetails({ placeId, session }),
};
