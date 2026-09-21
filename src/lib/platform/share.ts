'use client';

// 共有のラッパー（ネイティブ化制約 N-4）。将来 Capacitor の Share プラグインに差し替える。
// UI から navigator.share を直接呼ばない。

export interface ShareInput {
  title?: string;
  text?: string;
  url?: string;
}

export class PlatformShareError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PlatformShareError';
  }
}

/** 共有シートを開けるか。開けない場合 UI はリンクのコピーなどに切り替える。 */
export function canShare(data?: ShareInput): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (data && typeof navigator.canShare === 'function') return navigator.canShare(data);
  return true;
}

/**
 * 共有シートを開く。共有できたら true、非対応またはユーザーがキャンセルしたら false。
 * それ以外の失敗は PlatformShareError を投げる。
 */
export async function share(data: ShareInput): Promise<boolean> {
  if (!canShare(data)) return false;
  try {
    await navigator.share(data);
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return false;
    throw new PlatformShareError('共有できませんでした', err);
  }
}
