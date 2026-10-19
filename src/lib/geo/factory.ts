import 'server-only';

import { getServerEnv } from '@/lib/env';
import type { GeoProvider } from '@/lib/geo';
import { createGoogleProvider } from '@/lib/geo/providers/google';
import { createNominatimProvider } from '@/lib/geo/providers/nominatim';

let cached: GeoProvider | undefined;

/** 環境変数 GEO_PROVIDER でプロバイダを選ぶ。google は周辺・予測・詳細を Google、住所 → 座標は Nominatim（ADR 0011）。 */
export function getGeoProvider(): GeoProvider {
  if (cached) return cached;
  const env = getServerEnv();
  const nominatim = createNominatimProvider();
  if (env.GEO_PROVIDER === 'google') {
    // serverEnvSchema が GOOGLE_MAPS_API_KEY の存在を保証する
    const google = createGoogleProvider(env.GOOGLE_MAPS_API_KEY ?? '');
    cached = { ...google, geocode: (p) => nominatim.geocode(p) };
    return cached;
  }
  cached = nominatim;
  return cached;
}

export function resetGeoProviderForTest(): void {
  cached = undefined;
}
