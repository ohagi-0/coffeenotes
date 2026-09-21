'use client';

import { useCallback, useSyncExternalStore } from 'react';

// 端末ごとの表示設定（S9「表示」節）。サーバーには持たず localStorage に置く。
// 読めない環境（プライベートブラウズ等）では既定値で動く。

export type RatingInputMode = 'tap' | 'slider';

const RATING_INPUT_KEY = 'coffeenotes:rating-input';
const DEFAULT_RATING_INPUT: RatingInputMode = 'tap';

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export function readRatingInputMode(): RatingInputMode {
  try {
    const v = localStorage.getItem(RATING_INPUT_KEY);
    return v === 'slider' ? 'slider' : DEFAULT_RATING_INPUT;
  } catch {
    return DEFAULT_RATING_INPUT;
  }
}

export function writeRatingInputMode(mode: RatingInputMode): void {
  try {
    localStorage.setItem(RATING_INPUT_KEY, mode);
  } catch {
    // 保存できなくても画面は動かす
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === RATING_INPUT_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** 星の入力方法（タップ / スライダー）。`RatingStars` を置く画面がこれを見て切り替える。 */
export function useRatingInputMode(): [RatingInputMode, (mode: RatingInputMode) => void] {
  const mode = useSyncExternalStore(subscribe, readRatingInputMode, () => DEFAULT_RATING_INPUT);
  const set = useCallback((m: RatingInputMode) => writeRatingInputMode(m), []);
  return [mode, set];
}
