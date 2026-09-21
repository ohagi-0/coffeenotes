'use client';

// 位置情報のラッパー（ネイティブ化制約 N-4、F-SHOP-3）。
// 将来 Capacitor の Geolocation プラグインに差し替える。UI から navigator.geolocation を直接呼ばない。
// 失敗は kind で区別できる独自エラーにして、UI が文言を出し分けられるようにする。

export interface Coordinates {
  lat: number;
  lng: number;
  /** 精度（m）。取れない環境では null。 */
  accuracyM: number | null;
}

export type GeolocationErrorKind = 'unsupported' | 'permission-denied' | 'position-unavailable' | 'timeout';

const MESSAGES: Record<GeolocationErrorKind, string> = {
  unsupported: 'この端末では位置情報を利用できません',
  'permission-denied': '位置情報の利用が許可されていません',
  'position-unavailable': '現在地を取得できませんでした',
  timeout: '現在地の取得がタイムアウトしました',
};

export class PlatformGeolocationError extends Error {
  constructor(
    public readonly kind: GeolocationErrorKind,
    public readonly cause?: unknown,
  ) {
    super(MESSAGES[kind]);
    this.name = 'PlatformGeolocationError';
  }
}

/** GeolocationPositionError.code を kind に写す（1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT）。 */
export function geolocationErrorKindFromCode(code: number): GeolocationErrorKind {
  switch (code) {
    case 1:
      return 'permission-denied';
    case 3:
      return 'timeout';
    default:
      return 'position-unavailable';
  }
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export interface GetCurrentPositionOptions {
  /** 既定 10 秒。 */
  timeoutMs?: number;
  /** キャッシュを許容する時間（ms）。既定 0。 */
  maximumAgeMs?: number;
  /** GPS を使う高精度モード。既定 true。 */
  highAccuracy?: boolean;
}

/** 現在地を 1 回取得する。失敗時は PlatformGeolocationError を投げる。 */
export function getCurrentPosition(options: GetCurrentPositionOptions = {}): Promise<Coordinates> {
  const { timeoutMs = 10_000, maximumAgeMs = 0, highAccuracy = true } = options;
  if (!isGeolocationSupported()) {
    return Promise.reject(new PlatformGeolocationError('unsupported'));
  }
  return new Promise<Coordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        }),
      (error) => reject(new PlatformGeolocationError(geolocationErrorKindFromCode(error.code), error)),
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: maximumAgeMs },
    );
  });
}
