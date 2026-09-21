'use client';

import { useSyncExternalStore } from 'react';

// CSS だけでは切り替えられないもの（リンク先の違いなど）のための最小の hook。
// 初回描画（サーバー / ハイドレーション）では false。

export const XL_QUERY = '(min-width: 1280px)';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
