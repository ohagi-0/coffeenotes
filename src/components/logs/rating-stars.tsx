'use client';

import { useId, type KeyboardEvent, type MouseEvent } from 'react';
import { cn } from '@/lib/utils';

// 星評価（DESIGN.md §4、F-LOG-2）。値は 1.0〜5.0 の 0.5 刻み（ratingSchema と同じ規則）。
// onChange を渡すと入力モード: 各星の左半分タップで .5、右半分で .0。
// 入力モードはコンテナ 1 つを role="slider" にして左右キーで 0.5 ずつ動かす（星の中に別のボタンは置かない）。

export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const RATING_STEP = 0.5;

export type RatingStarsSize = 'sm' | 'md' | 'lg';

export type RatingStarsProps = {
  value: number | null;
  /** 表示サイズ。星の一辺が 15 / 22 / 44px */
  size?: RatingStarsSize;
  /** 渡すと入力モードになる */
  onChange?: (value: number) => void;
  /** 隣の数値を隠す（既定は常に表示） */
  hideValue?: boolean;
  className?: string;
  'aria-label'?: string;
};

const STAR_PATH = 'M12 2.2l3 6.5 7.1.8-5.3 4.9 1.5 7L12 17.9 5.7 21.4l1.5-7L1.9 9.5 9 8.7z';

// サイズごとの星の一辺・星の間隔・数値の大きさ（DESIGN.md §2.3: 36 / 20 / 13px、num 800）
const SIZE_CLASS: Record<RatingStarsSize, { star: string; gap: string; num: string }> = {
  sm: { star: 'size-[15px]', gap: 'gap-0.5', num: 'text-[13px]' },
  md: { star: 'size-[22px]', gap: 'gap-0.5', num: 'text-[20px]' },
  lg: { star: 'size-11', gap: 'gap-1.5', num: 'text-[36px]' },
};

/** 0.5 刻みに丸め、1.0〜5.0 に収める。 */
export function clampRating(value: number): number {
  const stepped = Math.round(value / RATING_STEP) * RATING_STEP;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, stepped));
}

/** 星 index（1〜5）の塗り: full / half / empty */
function fillOf(value: number | null, index: number): 'full' | 'half' | 'empty' {
  if (value === null) return 'empty';
  if (value >= index) return 'full';
  if (value >= index - RATING_STEP) return 'half';
  return 'empty';
}

export function formatRating(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}

export function RatingStars({
  value,
  size = 'md',
  onChange,
  hideValue = false,
  className,
  'aria-label': ariaLabel,
}: RatingStarsProps) {
  const clipId = useId();
  const editable = typeof onChange === 'function';
  const sizes = SIZE_CLASS[size];
  const label = ariaLabel ?? '星評価';
  const valueText = value === null ? '未評価' : `${value.toFixed(1)} / 5`;

  const handleHalfClick = (event: MouseEvent<HTMLSpanElement>) => {
    if (!onChange) return;
    const star = Number(event.currentTarget.dataset.star);
    const half = event.currentTarget.dataset.half === 'left';
    onChange(clampRating(half ? star - RATING_STEP : star));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onChange) return;
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = value === null ? RATING_MIN : clampRating(value + RATING_STEP);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value === null ? RATING_MIN : clampRating(value - RATING_STEP);
        break;
      case 'Home':
        next = RATING_MIN;
        break;
      case 'End':
        next = RATING_MAX;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next !== value) onChange(next);
  };

  const stars = (
    <span className={cn('inline-flex', sizes.gap)}>
      {/* 半分塗り用のクリップ。1 コンポーネントにつき 1 つ */}
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width="12" height="24" />
          </clipPath>
        </defs>
      </svg>
      {[1, 2, 3, 4, 5].map((index) => {
        const fill = fillOf(value, index);
        return (
          <span key={index} className={cn('relative block', sizes.star)} data-star={index} data-fill={fill}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="block size-full">
              <path d={STAR_PATH} className="fill-border" />
              {fill !== 'empty' && (
                <path
                  d={STAR_PATH}
                  className="fill-primary"
                  clipPath={fill === 'half' ? `url(#${clipId})` : undefined}
                />
              )}
            </svg>
            {editable && (
              <>
                <span
                  className="absolute inset-y-0 left-0 w-1/2"
                  data-star={index}
                  data-half="left"
                  onClick={handleHalfClick}
                />
                <span
                  className="absolute inset-y-0 right-0 w-1/2"
                  data-star={index}
                  data-half="right"
                  onClick={handleHalfClick}
                />
              </>
            )}
          </span>
        );
      })}
    </span>
  );

  const number = !hideValue && (
    <span
      className={cn(
        'font-num leading-none font-extrabold',
        sizes.num,
        value === null ? 'text-muted-foreground' : 'text-foreground',
      )}
      aria-hidden="true"
    >
      {formatRating(value)}
    </span>
  );

  if (!editable) {
    return (
      <span
        role="img"
        aria-label={`${label} ${valueText}`}
        className={cn('inline-flex items-center gap-2 align-middle', className)}
      >
        {stars}
        {number}
      </span>
    );
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={RATING_MIN}
      aria-valuemax={RATING_MAX}
      aria-valuenow={value ?? undefined}
      aria-valuetext={valueText}
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex cursor-pointer items-center gap-3 rounded-md select-none',
        'focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
    >
      {stars}
      {number}
    </div>
  );
}
