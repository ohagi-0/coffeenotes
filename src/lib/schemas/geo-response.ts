import { z } from 'zod';

// /api/geo の入出力。ブラウザ側（features/geo）とサーバー側（api/geo/route.ts）で共有する。

export const placeCandidateSchema = z.object({
  name: z.string(),
  address: z.string().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  externalPlaceId: z.string().nullable(),
  distanceM: z.number().nonnegative().optional(),
  aliases: z.array(z.string()).optional(),
});
export type PlaceCandidateDto = z.infer<typeof placeCandidateSchema>;

/** 入力途中の予測（Google。座標なし）。選んだら details で座標を取る */
export const placeSuggestionSchema = z.object({
  externalPlaceId: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  distanceM: z.number().nonnegative().optional(),
});
export type PlaceSuggestionDto = z.infer<typeof placeSuggestionSchema>;

export const geoResponseSchema = z.object({
  candidates: z.array(placeCandidateSchema),
  /** op=search で provider が予測を返すときだけ入る（このとき candidates は空） */
  suggestions: z.array(placeSuggestionSchema).optional(),
  provider: z.string(),
});
export type GeoResponse = z.infer<typeof geoResponseSchema>;

export const geoNearbyQuerySchema = z.object({
  op: z.literal('nearby'),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().int().min(100).max(3000).default(800),
  /** 検索シートは周辺の店をまとめて取り、絞り込みは端末で行う（ADR 0010）ので多めに取れるようにする */
  limit: z.coerce.number().int().min(1).max(400).default(20),
});
export const geoSearchQuerySchema = z.object({
  op: z.literal('search'),
  q: z.string().trim().min(1).max(200),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  /** Autocomplete のセッション（入力 → 選択を 1 課金にまとめる）。クライアントが UUID を作る */
  session: z.string().uuid().optional(),
});
export const geoDetailsQuerySchema = z.object({
  op: z.literal('details'),
  id: z.string().trim().min(1).max(300),
  session: z.string().uuid().optional(),
});
/** details の応答。見つからなければ candidate は null */
export const geoDetailsResponseSchema = z.object({
  candidate: placeCandidateSchema.nullable(),
  provider: z.string(),
});
export type GeoDetailsResponse = z.infer<typeof geoDetailsResponseSchema>;
export const geoGeocodeQuerySchema = z.object({
  op: z.literal('geocode'),
  q: z.string().trim().min(1).max(200),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});
export const geoQuerySchema = z.discriminatedUnion('op', [
  geoNearbyQuerySchema,
  geoSearchQuerySchema,
  geoGeocodeQuerySchema,
  geoDetailsQuerySchema,
]);

export const geoApiErrorCodeSchema = z.enum([
  'unauthorized',
  'bad_request',
  'timeout',
  'provider',
  'invalid_output',
]);
export type GeoApiErrorCode = z.infer<typeof geoApiErrorCodeSchema>;
export const geoErrorResponseSchema = z.object({
  error: z.object({ code: geoApiErrorCodeSchema, message: z.string() }),
});
