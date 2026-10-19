import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLongPressDetector, LONG_PRESS_MS } from '@/lib/map/long-press';

// 地図の長押し判定（ADR 0011 / Issue #37）。押して 500ms 動かさなければ発火、動いたら・離したら取り消し。
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createLongPressDetector', () => {
  it('しきい値を超えて押し続けると、押した位置で 1 回だけ発火する', () => {
    const fn = vi.fn();
    const d = createLongPressDetector(fn);
    d.start(40, 80);
    vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledWith(40, 80);
    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('しきい値の前に離す（cancel）と発火しない', () => {
    const fn = vi.fn();
    const d = createLongPressDetector(fn);
    d.start(0, 0);
    vi.advanceTimersByTime(300);
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('許容距離を超えて動いたら（ドラッグ・スクロール）取り消す。小さな手ぶれは許す', () => {
    const fn = vi.fn();
    const d = createLongPressDetector(fn);
    d.start(100, 100);
    d.move(104, 103); // 5px
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(fn).toHaveBeenCalledTimes(1);

    d.start(100, 100);
    d.move(120, 100); // 20px
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('押し直すと前のタイマーは捨てる。しきい値は変えられる', () => {
    const fn = vi.fn();
    const d = createLongPressDetector(fn, { thresholdMs: 100 });
    d.start(1, 1);
    vi.advanceTimersByTime(80);
    d.start(2, 2);
    vi.advanceTimersByTime(80);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(2, 2);
  });

  it('押していない間の move は何もしない', () => {
    const d = createLongPressDetector(vi.fn());
    expect(() => d.move(10, 10)).not.toThrow();
  });
});
