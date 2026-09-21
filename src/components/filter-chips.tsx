'use client';

import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FilterChip<V extends string = string> = { value: V; label: string };

type Props<V extends string> = {
  chips: readonly FilterChip<V>[];
  value: V;
  onChange: (value: V) => void;
  /** 渡すと先頭に銅の枠線の「絞り込み」ボタンを出す（詳細な絞り込みを開く操作） */
  onOpenFilter?: () => void;
  className?: string;
};

const chipClass =
  'inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

// 絞り込みチップ（DESIGN.md §4）。高さ 34px、上下 5px の余白でタップ領域 44px を確保。
// 横スクロールし、main の余白（px-5）を -mx-5 で打ち消して画面端まで伸ばす。
export function FilterChips<V extends string>({ chips, value, onChange, onOpenFilter, className }: Props<V>) {
  return (
    <div
      role="group"
      aria-label="絞り込み"
      className={cn(
        '-mx-5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-5 py-[5px] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {onOpenFilter && (
        <button type="button" onClick={onOpenFilter} className={cn(chipClass, 'border-primary text-primary')}>
          <SlidersHorizontal className="size-3.5" strokeWidth={2} aria-hidden />
          絞り込み
        </button>
      )}
      {chips.map((chip) => {
        const active = chip.value === value;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(chip.value)}
            className={cn(
              chipClass,
              active ? 'bg-foreground text-background border-foreground' : 'border-border text-foreground',
            )}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
