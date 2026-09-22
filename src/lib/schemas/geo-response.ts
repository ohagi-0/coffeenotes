import { z } from 'zod';

// /api/geo の入出力。ブラウザ側（features/geo）とサーバー側（api/geo/route.ts）で共有する。

export const placeCandidateSchema = z.object({
  name: z.string(),
  address: z.string().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  externalPlaceId: z.string().nullable(),
  distanceM: z.number().nonnegative().optional(),
});
export type PlaceCandidateDto = z.infer<typeof placeCandidateSchema>;

export const geoResponseSchema = z.object({
  candidates: z.array(placeCandidateSchema),
  provider: z.string(),
});
export type GeoResponse = z.infer<typeof geoResponseSchema>;

export const geoNearbyQuerySchema = z.object({
  op: z.literal('nearby'),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().int().min(100).max(3000).default(800),
});
export const geoGeocodeQuerySchema = z.object({
  op: z.literal('geocode'),
  q: z.string().trim().min(1).max(200),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});
export const geoQuerySchema = z.discriminatedUnion('op', [geoNearbyQuerySchema, geoGeocodeQuerySchema]);

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
