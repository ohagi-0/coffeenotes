import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  geolocationErrorKindFromCode,
  getCurrentPosition,
  isGeolocationSupported,
  PlatformGeolocationError,
} from '@/lib/platform/geolocation';

function stubGeolocation(impl: Partial<Geolocation>) {
  vi.stubGlobal('navigator', { geolocation: impl } as unknown as Navigator);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('geolocationErrorKindFromCode', () => {
  it('コードを kind に写す', () => {
    expect(geolocationErrorKindFromCode(1)).toBe('permission-denied');
    expect(geolocationErrorKindFromCode(2)).toBe('position-unavailable');
    expect(geolocationErrorKindFromCode(3)).toBe('timeout');
    expect(geolocationErrorKindFromCode(99)).toBe('position-unavailable');
  });
});

describe('getCurrentPosition', () => {
  it('座標と精度を返す', async () => {
    stubGeolocation({
      getCurrentPosition: (onSuccess) =>
        onSuccess({
          coords: { latitude: 35.6812, longitude: 139.7671, accuracy: 12 },
        } as GeolocationPosition),
    });
    await expect(getCurrentPosition()).resolves.toEqual({ lat: 35.6812, lng: 139.7671, accuracyM: 12 });
  });

  it('拒否は permission-denied のエラーになる', async () => {
    stubGeolocation({
      getCurrentPosition: (_onSuccess, onError) => onError?.({ code: 1 } as GeolocationPositionError),
    });
    await expect(getCurrentPosition()).rejects.toMatchObject({
      name: 'PlatformGeolocationError',
      kind: 'permission-denied',
    });
  });

  it('非対応環境は unsupported のエラーになる', async () => {
    vi.stubGlobal('navigator', {} as Navigator);
    expect(isGeolocationSupported()).toBe(false);
    await expect(getCurrentPosition()).rejects.toBeInstanceOf(PlatformGeolocationError);
  });

  it('指定したタイムアウトを渡す', async () => {
    const spy = vi.fn<Geolocation['getCurrentPosition']>((onSuccess) =>
      onSuccess({ coords: { latitude: 0, longitude: 0, accuracy: Number.NaN } } as GeolocationPosition),
    );
    stubGeolocation({ getCurrentPosition: spy });
    await expect(getCurrentPosition({ timeoutMs: 3000, highAccuracy: false })).resolves.toEqual({
      lat: 0,
      lng: 0,
      accuracyM: null,
    });
    expect(spy.mock.calls[0][2]).toMatchObject({ timeout: 3000, enableHighAccuracy: false, maximumAge: 0 });
  });
});
