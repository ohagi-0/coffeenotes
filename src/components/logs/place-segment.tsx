'use client';

import { Home, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LogPlace } from '@/lib/schemas/log';

const OPTIONS: { value: LogPlace; label: string; icon: typeof Store }[] = [
  { value: 'shop', label: '店で', icon: Store },
  { value: 'home', label: '自宅で', icon: Home },
];

type Props = {
  value: LogPlace;
  onChange: (value: LogPlace) => void;
  className?: string;
};

// 店で / 自宅で の切り替え（DESIGN.md §4、F-LOG-8）。自宅を選ぶと呼び出し側で店の欄を消す。
export function PlaceSegment({ value, onChange, className }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="飲んだ場所"
      className={cn('bg-secondary grid grid-cols-2 rounded-[13px] p-1', className)}
    >
      {OPTIONS.map(({ value: v, label, icon: Icon }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              'focus-visible:outline-primary flex h-[42px] items-center justify-center gap-1.5 rounded-[10px] text-sm font-bold transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2',
              active ? 'bg-foreground text-background' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-4" strokeWidth={2} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
