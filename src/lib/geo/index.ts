// 店候補・ジオコーディングの抽象化（ADR 0003）。実装は providers/nominatim.ts（Phase 3）。
// 候補検索は入力補助であり、失敗しても手入力 + 地図タップで店を作れること。

export interface PlaceCandidate {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  externalPlaceId: string | null;
}

export interface GeoProvider {
  searchNearby(params: {
    lat: number;
    lng: number;
    radiusM?: number;
    query?: string;
  }): Promise<PlaceCandidate[]>;
  geocode(query: string): Promise<PlaceCandidate[]>;
}
