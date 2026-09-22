'use client';

import { useSyncExternalStore } from 'react';

// オンライン状態のラッパー（ネイティブ化制約 N-4）。UI から navigator.onLine を直接読まない。
function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** オンラインなら true。サーバー描画時は true（オフライン表示を初回に出さない）。 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (typeof navigator === 'undefined' ? true : navigator.onLine),
    () => true,
  );
}
