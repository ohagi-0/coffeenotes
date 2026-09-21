'use client';

// カメラ / 画像選択のラッパー（ネイティブ化制約 N-4）。
// Web では <input type="file"> を動的に作って使い、将来 Capacitor の Camera プラグインに差し替える。
// UI からブラウザ API を直接呼ばないこと。戻り値は Blob（N-5。File は Blob なのでそのまま返す）。

export type PhotoSource = 'camera' | 'library';

export interface CapturePhotoOptions {
  /** camera はスマホの外向きカメラを優先、library はギャラリーから選ぶ。既定は camera。 */
  source?: PhotoSource;
  /** accept 属性。既定は image/*。 */
  accept?: string;
}

/** ファイル選択そのものが使えない環境（SSR 等）でないか。 */
export function isPhotoCaptureSupported(): boolean {
  return typeof document !== 'undefined';
}

/**
 * 写真を 1 枚撮る / 選ぶ。キャンセルされたら null を返す。
 * cancel イベントを出さないブラウザ向けに、ウィンドウがフォーカスを取り戻してから
 * 一定時間 change が来なければキャンセル扱いにするフォールバックを持つ（Promise を宙に浮かせないため）。
 */
export function capturePhoto(options: CapturePhotoOptions = {}): Promise<Blob | null> {
  if (!isPhotoCaptureSupported()) {
    return Promise.reject(new Error('この環境では写真を取得できません'));
  }
  const { source = 'camera', accept = 'image/*' } = options;

  return new Promise<Blob | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (source === 'camera') input.capture = 'environment';
    // 一部のブラウザは DOM に無い input のダイアログを開かないため、見えない状態で挿入する。
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';

    let settled = false;
    let cancelTimer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (cancelTimer !== undefined) clearTimeout(cancelTimer);
      window.removeEventListener('focus', onFocus);
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      input.remove();
    };
    const settle = (value: Blob | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    function onChange() {
      settle(input.files?.[0] ?? null);
    }
    function onCancel() {
      settle(null);
    }
    function onFocus() {
      // ダイアログを閉じた直後は change がまだ発火していないことがあるので少し待つ。
      if (cancelTimer !== undefined) clearTimeout(cancelTimer);
      cancelTimer = setTimeout(() => settle(null), 2000);
    }

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    document.body.appendChild(input);
    // クリックでダイアログが開いた後に登録する（click 直前の focus を拾わないため）。
    setTimeout(() => window.addEventListener('focus', onFocus), 0);
    input.click();
  });
}

/** ギャラリーから選ぶ（capturePhoto の薄い別名）。 */
export function pickPhoto(options: Omit<CapturePhotoOptions, 'source'> = {}): Promise<Blob | null> {
  return capturePhoto({ ...options, source: 'library' });
}
