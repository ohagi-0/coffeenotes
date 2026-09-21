'use client';

import { cn } from '@/lib/utils';

// 味覚チャート（DESIGN.md §4、F-BEAN-10）。5 軸固定、各軸 1〜5 の整数か null。
// onChange を渡すと入力モード: 丸をタップで入力、同じ値をもう一度タップで null に戻す。

export const TASTE_AXES = [
  { key: 'flavor', label: 'Flavor', short: 'Flavor' },
  { key: 'sweetness', label: 'Sweetness', short: 'Sweet' },
  { key: 'acidity', label: 'Acidity', short: 'Acidity' },
  { key: 'aftertaste', label: 'After taste', short: 'After' },
  { key: 'body', label: 'Body', short: 'Body' },
] as const;

export type TasteAxisKey = (typeof TASTE_AXES)[number]['key'];

/** beans.taste_* 5 列に対応する値。未入力は null。 */
export type TasteValues = Record<TasteAxisKey, number | null>;

export const EMPTY_TASTE: TasteValues = {
  flavor: null,
  sweetness: null,
  acidity: null,
  aftertaste: null,
  body: null,
};

const SCORES = [1, 2, 3, 4, 5] as const;

export type TasteDotsProps = {
  value: TasteValues;
  /** 渡すと入力モードになる */
  onChange?: (next: TasteValues) => void;
  /** 入力モードでも一時的に操作不可にする */
  readOnly?: boolean;
  className?: string;
};

export function TasteDots({ value, onChange, readOnly = false, className }: TasteDotsProps) {
  const editable = typeof onChange === 'function' && !readOnly;

  const select = (key: TasteAxisKey, score: number) => {
    if (!onChange) return;
    // 同じ値をもう一度タップで未入力に戻す
    onChange({ ...value, [key]: value[key] === score ? null : score });
  };

  return (
    <div className={cn('grid gap-2', className)}>
      {TASTE_AXES.map((axis) => {
        const current = value[axis.key];
        return (
          <div
            key={axis.key}
            role={editable ? 'radiogroup' : undefined}
            aria-label={editable ? axis.label : undefined}
            className="grid grid-cols-[80px_1fr_auto] items-center gap-2 text-[12px]"
          >
            <span className="font-num text-muted-foreground font-medium">{axis.label}</span>
            <span className={cn('flex items-center', editable ? 'gap-1' : 'gap-[7px]')}>
              {SCORES.map((score) => {
                const on = current !== null && score <= current;
                const dot = (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'block size-5 rounded-full border-[1.5px]',
                      on ? 'border-primary bg-primary' : 'border-border bg-transparent',
                    )}
                  />
                );
                if (!editable) {
                  return <span key={score}>{dot}</span>;
                }
                return (
                  <button
                    key={score}
                    type="button"
                    role="radio"
                    aria-checked={current === score}
                    aria-label={`${axis.label} ${score}`}
                    onClick={() => select(axis.key, score)}
                    className={cn(
                      // タップ領域 44px（P3）。見た目の丸は 20px のまま
                      'flex h-11 w-10 items-center justify-center rounded-md',
                      'focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px]',
                    )}
                  >
                    {dot}
                  </button>
                );
              })}
            </span>
            <span
              className={cn(
                'font-num min-w-[1.5em] text-right font-bold',
                current === null ? 'text-muted-foreground' : 'text-foreground',
              )}
              aria-label={editable ? undefined : `${axis.label} ${current ?? '未入力'}`}
            >
              {current ?? '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
