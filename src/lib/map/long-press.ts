// 地図の長押し判定（純粋ロジック。DOM に依存しない）。ADR 0011 / Issue #37。
// スマホはタッチの長押し（押して一定時間動かさない）、PC は右クリック（contextmenu）で店登録に使う。
// タイマーは注入できるようにして単体テストする。

export const LONG_PRESS_MS = 500;
/** この距離（px）以上動いたらスクロール・ドラッグとみなして取り消す */
export const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

export interface LongPressDetector {
  start(x: number, y: number): void;
  move(x: number, y: number): void;
  /** 指を離した・キャンセルされた・2 本指になった */
  cancel(): void;
}

export function createLongPressDetector(
  onLongPress: (x: number, y: number) => void,
  opts: {
    thresholdMs?: number;
    moveTolerancePx?: number;
    setTimer?: (fn: () => void, ms: number) => unknown;
    clearTimer?: (id: unknown) => void;
  } = {},
): LongPressDetector {
  const thresholdMs = opts.thresholdMs ?? LONG_PRESS_MS;
  const tolerance = opts.moveTolerancePx ?? LONG_PRESS_MOVE_TOLERANCE_PX;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let origin: { x: number; y: number } | null = null;

  function cancel() {
    if (timer !== null) clearTimer(timer);
    timer = null;
    origin = null;
  }

  return {
    start(x, y) {
      cancel();
      origin = { x, y };
      timer = setTimer(() => {
        const o = origin;
        timer = null;
        origin = null;
        if (o) onLongPress(o.x, o.y);
      }, thresholdMs);
    },
    move(x, y) {
      if (!origin) return;
      if (Math.hypot(x - origin.x, y - origin.y) > tolerance) cancel();
    },
    cancel,
  };
}
