import 'server-only';

import { getServerEnv } from '@/lib/env';
import type { GeoProvider } from '@/lib/geo';
import { createNominatimProvider } from '@/lib/geo/providers/nominatim';

let cached: GeoProvider | undefined;

/** 環境変数 GEO_PROVIDER でプロバイダを選ぶ。google は未実装（精度に不満が出たら差し替える。ADR 0003）。 */
export function getGeoProvider(): GeoProvider {
  if (cached) return cached;
  const env = getServerEnv();
  if (env.GEO_PROVIDER === 'google') {
    throw new Error('GEO_PROVIDER=google はまだ実装されていません。nominatim を使ってください');
  }
  cached = createNominatimProvider();
  return cached;
}

export function resetGeoProviderForTest(): void {
  cached = undefined;
}
