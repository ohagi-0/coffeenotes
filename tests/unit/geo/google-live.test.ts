// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createGoogleProvider } from '@/lib/geo/providers/google';

// 実 API を叩く確認用。GOOGLE_MAPS_API_KEY が無ければ skip（通常の pnpm test では走らない）。
//   GOOGLE_MAPS_API_KEY=… pnpm vitest run tests/unit/geo/google-live.test.ts
const key = process.env.GOOGLE_MAPS_API_KEY;
const SHIBUYA = { lat: 35.658, lng: 139.7016 };

describe.skipIf(!key)('Places API (New)（実 API）', () => {
  const p = createGoogleProvider(key ?? '');
  it('渋谷のカフェが 20 件、フグレンの予測から座標まで取れる', async () => {
    const near = await p.searchNearby({ ...SHIBUYA, radiusM: 800, limit: 20 });
    expect(near).toHaveLength(20);
    const s = await p.suggestPlaces({ query: 'フグレン', near: SHIBUYA, sessionToken: crypto.randomUUID() });
    expect(s.length).toBeGreaterThan(0);
    const d = await p.placeDetails({ placeId: s[0].externalPlaceId });
    expect(d?.lat).toBeGreaterThan(35);
  });
});
