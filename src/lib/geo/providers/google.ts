// Google Places API (New) のプロバイダ（ADR 0011）。サーバー（/api/geo）からのみ呼ぶ。
// - 周辺: Nearby Search（Pro SKU）/ 入力中: Autocomplete（座標なしの予測）/ 選択: Place Details（Pro SKU）
// - FieldMask に rating や photos を入れない（Enterprise SKU になり無料枠が減る）。
// - geocode は持たない（住所 → 座標は Nominatim。factory.ts で合成する）。
// 返り値の名前・住所・座標は 30 日以内に更新する一時的な写し。永続してよいのは place_id だけ。
import { z } from 'zod';
import {
  GeoError,
  distanceM as distanceBetween,
  type GeoProvider,
  type PlaceCandidate,
  type PlaceSuggestion,
} from '@/lib/geo';

export const PLACES_URL = 'https://places.googleapis.com/v1';
export const GOOGLE_TIMEOUT_MS = 10_000;
/** Nearby Search が 1 回で返せる上限 */
export const GOOGLE_NEARBY_MAX = 20;
const CAFE_TYPES = ['cafe', 'coffee_shop'];
const PLACE_FIELDS = 'id,displayName,formattedAddress,shortFormattedAddress,location';
export const NEARBY_FIELD_MASK = PLACE_FIELDS.split(',')
  .map((f) => `places.${f}`)
  .join(',');
export const DETAILS_FIELD_MASK = PLACE_FIELDS;
/** 30 日更新ジョブ用。移転先の ID（movedPlaceId）も見る */
export const REFRESH_FIELD_MASK = `${PLACE_FIELDS},movedPlaceId`;

type Fetch = typeof fetch;

const placeSchema = z.object({
  id: z.string().min(1),
  displayName: z.object({ text: z.string() }).optional(),
  formattedAddress: z.string().optional(),
  shortFormattedAddress: z.string().optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
});
type GooglePlace = z.infer<typeof placeSchema>;

const refreshResponseSchema = placeSchema.extend({ movedPlaceId: z.string().min(1).optional() });

/** 更新ジョブの結果。ok = 最新の写し、moved = 移転先の place_id、not_found = Google に無い（閉店・ID の失効） */
export type RefreshPlaceResult =
  | { status: 'ok'; place: PlaceCandidate }
  | { status: 'moved'; movedPlaceId: string }
  | { status: 'not_found' };

const nearbyResponseSchema = z.object({ places: z.array(placeSchema).default([]) });
const autocompleteResponseSchema = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({
            placeId: z.string().min(1),
            text: z.object({ text: z.string() }).optional(),
            structuredFormat: z
              .object({
                mainText: z.object({ text: z.string() }),
                secondaryText: z.object({ text: z.string() }).optional(),
              })
              .optional(),
            distanceMeters: z.number().optional(),
          })
          .optional(),
      }),
    )
    .default([]),
});

/** 〒150-0002 のような郵便番号の頭を落として、住所を読みやすくする */
function cleanAddress(p: GooglePlace): string | null {
  const a = p.shortFormattedAddress ?? p.formattedAddress;
  return a?.replace(/^〒?\s?\d{3}-\d{4}\s*/, '').trim() || null;
}

function toCandidate(p: GooglePlace): PlaceCandidate | null {
  const name = p.displayName?.text.trim();
  if (!name || !p.location) return null;
  const c: PlaceCandidate = {
    name,
    address: cleanAddress(p),
    lat: p.location.latitude,
    lng: p.location.longitude,
    externalPlaceId: p.id,
  };
  return c;
}

/** Nearby Search の応答 → 候補（距離は Google が返さないので searchNearby 側で足す） */
export function candidatesFromGoogleNearby(json: unknown): PlaceCandidate[] {
  const parsed = nearbyResponseSchema.safeParse(json);
  if (!parsed.success)
    throw new GeoError('Google の店検索の応答が想定と違います', 'invalid_output', parsed.error);
  return parsed.data.places.flatMap((p) => toCandidate(p) ?? []);
}

/** Autocomplete の応答 → 予測（place_id・店名・住所・距離。座標は無い） */
export function suggestionsFromAutocomplete(json: unknown): PlaceSuggestion[] {
  const parsed = autocompleteResponseSchema.safeParse(json);
  if (!parsed.success)
    throw new GeoError('Google の店検索の応答が想定と違います', 'invalid_output', parsed.error);
  const out: PlaceSuggestion[] = [];
  for (const s of parsed.data.suggestions) {
    const p = s.placePrediction;
    if (!p) continue;
    const name = p.structuredFormat?.mainText.text ?? p.text?.text;
    if (!name) continue;
    const item: PlaceSuggestion = {
      externalPlaceId: p.placeId,
      name,
      address: p.structuredFormat?.secondaryText?.text ?? null,
    };
    if (p.distanceMeters !== undefined) item.distanceM = Math.round(p.distanceMeters);
    out.push(item);
  }
  return out;
}

/** Place Details の応答 → 候補 */
export function candidateFromPlaceDetails(json: unknown): PlaceCandidate | null {
  const parsed = placeSchema.safeParse(json);
  if (!parsed.success)
    throw new GeoError('Google の店情報の応答が想定と違います', 'invalid_output', parsed.error);
  return toCandidate(parsed.data);
}

function httpError(status: number): GeoError {
  if (status === 429 || status === 403) {
    return new GeoError(
      `Google の店検索が上限か設定エラーです（HTTP ${status}）。鍵の制限と無料枠を確認してください`,
      'provider',
    );
  }
  return new GeoError(`Google の店検索がエラーを返しました（HTTP ${status}）`, 'provider');
}

export function createGoogleProvider(
  apiKey: string,
  fetchImpl: Fetch = fetch,
): Required<Pick<GeoProvider, 'searchNearby' | 'suggestPlaces' | 'placeDetails'>> & {
  readonly name: string;
  /** 30 日更新用。移転・消滅も結果で返す */
  refreshPlace(placeId: string): Promise<RefreshPlaceResult>;
} {
  async function call(
    path: string,
    init: { method: 'GET' | 'POST'; fieldMask?: string; body?: unknown; notFoundAsNull?: boolean },
  ): Promise<unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), GOOGLE_TIMEOUT_MS);
    try {
      const res = await fetchImpl(`${PLACES_URL}/${path}`, {
        method: init.method,
        headers: {
          'X-Goog-Api-Key': apiKey,
          ...(init.fieldMask ? { 'X-Goog-FieldMask': init.fieldMask } : {}),
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: ctrl.signal,
      });
      if (res.status === 404 && init.notFoundAsNull) return null;
      if (!res.ok) throw httpError(res.status);
      return await res.json();
    } catch (err) {
      if (err instanceof GeoError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError')
        throw new GeoError('Google の店検索がタイムアウトしました', 'timeout', err);
      throw new GeoError('Google の店検索に接続できませんでした', 'provider', err);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    name: 'google',

    async searchNearby({ lat, lng, radiusM = 800, limit = GOOGLE_NEARBY_MAX }) {
      const json = await call('places:searchNearby', {
        method: 'POST',
        fieldMask: NEARBY_FIELD_MASK,
        body: {
          includedTypes: CAFE_TYPES,
          maxResultCount: Math.max(1, Math.min(limit, GOOGLE_NEARBY_MAX)),
          languageCode: 'ja',
          regionCode: 'JP',
          rankPreference: 'DISTANCE',
          locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusM } },
        },
      });
      return candidatesFromGoogleNearby(json).map((c) => ({
        ...c,
        distanceM: distanceBetween({ lat, lng }, c),
      }));
    },

    async suggestPlaces({ query, near, limit, sessionToken }) {
      const json = await call('places:autocomplete', {
        method: 'POST',
        body: {
          input: query,
          // 種類では絞らない。includedPrimaryTypes は「主な種類」だけを見るので、焙煎所や豆売りが主の店
          // （例: TAOCA COFFEE 南青山店は primaryType=food_store、types に cafe を含む）が落ちる（2026-10-19 本番で確認）。
          // 店名を打つ人はその店を探しているので、国内に限るだけにして住所で見分けてもらう
          includedRegionCodes: ['JP'],
          languageCode: 'ja',
          regionCode: 'JP',
          ...(near
            ? {
                locationBias: {
                  circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 5000 },
                },
                origin: { latitude: near.lat, longitude: near.lng },
              }
            : {}),
          ...(sessionToken ? { sessionToken } : {}),
        },
      });
      const all = suggestionsFromAutocomplete(json);
      return limit ? all.slice(0, limit) : all;
    },

    /** 30 日以内の更新用（セッションなし）。404 は not_found、移転していれば moved。一時的な失敗は GeoError を投げる */
    async refreshPlace(placeId: string): Promise<RefreshPlaceResult> {
      const json = await call(`places/${encodeURIComponent(placeId)}?languageCode=ja&regionCode=JP`, {
        method: 'GET',
        fieldMask: REFRESH_FIELD_MASK,
        notFoundAsNull: true,
      });
      if (json === null) return { status: 'not_found' };
      const parsed = refreshResponseSchema.safeParse(json);
      if (!parsed.success)
        throw new GeoError('Google の店情報の応答が想定と違います', 'invalid_output', parsed.error);
      if (parsed.data.movedPlaceId && parsed.data.movedPlaceId !== placeId) {
        return { status: 'moved', movedPlaceId: parsed.data.movedPlaceId };
      }
      const place = toCandidate(parsed.data);
      return place ? { status: 'ok', place } : { status: 'not_found' };
    },

    async placeDetails({ placeId, sessionToken }) {
      const qs = new URLSearchParams({ languageCode: 'ja', regionCode: 'JP' });
      if (sessionToken) qs.set('sessionToken', sessionToken);
      const json = await call(`places/${encodeURIComponent(placeId)}?${qs}`, {
        method: 'GET',
        fieldMask: DETAILS_FIELD_MASK,
      });
      return candidateFromPlaceDetails(json);
    },
  };
}
