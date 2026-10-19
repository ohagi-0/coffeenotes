// 店候補・ジオコーディングの抽象化（ADR 0003 / ADR 0010、F-SHOP-3/4）。実装は providers/nominatim.ts（OSM）。
// 候補検索は入力補助であり、失敗しても手入力 + 地図タップで店を作れること。`/api/geo` からのみ呼ぶ。

export interface PlaceCandidate {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  /** 地図サービス側の ID（OSM なら "node/123"）。shops.external_place_id に入れる */
  externalPlaceId: string | null;
  /** 現在地からの距離（m）。現在地が分かっているときだけ */
  distanceM?: number;
  /** 照合用の別名（英字名・読み・ブランド名など）。表示はしない（lib/geo/match.ts） */
  aliases?: string[];
}

export interface GeoProvider {
  readonly name: string;
  /** 現在地周辺のカフェ・ロースター候補（F-SHOP-3） */
  searchNearby(params: {
    lat: number;
    lng: number;
    radiusM?: number;
    limit?: number;
  }): Promise<PlaceCandidate[]>;
  /** 店名からカフェ・コーヒー店の候補（F-SHOP-2/4）。near を渡すと近い店を優先する。部分一致に強い */
  searchPlaces(params: {
    query: string;
    near?: { lat: number; lng: number };
    limit?: number;
  }): Promise<PlaceCandidate[]>;
  /** 住所・地名から座標（F-SHOP-4 / F-SHOP-6 の「住所から位置を付ける」） */
  geocode(params: {
    query: string;
    near?: { lat: number; lng: number };
    limit?: number;
  }): Promise<PlaceCandidate[]>;
}

export type GeoErrorCode = 'timeout' | 'provider' | 'invalid_output';

export class GeoError extends Error {
  constructor(
    message: string,
    public readonly code: GeoErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GeoError';
  }
}

/** 2 点間の距離（m）。ハバサイン。並び替えと表示に使う純粋関数 */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
