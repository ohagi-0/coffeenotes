'use client';

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  /** ラベルの右に薄く出す現在値 */
  value?: ReactNode;
  /** 右端に置く要素。省略時は onClick があれば chevron */
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** 行の下に出す 1 文の説明 */
  note?: ReactNode;
  className?: string;
};

// 設定の 1 行（DESIGN.md §5 S9 の `.acc`）。高さ 52px 以上、下に 1px の --border。
export function SettingRow({ label, value, trailing, onClick, disabled, note, className }: Props) {
  const interactive = typeof onClick === 'function' && !disabled;
  const body = (
    <>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="text-foreground font-bold">{label}</span>
        {value !== undefined && (
          <span className="text-muted-foreground font-num truncate text-xs font-normal">{value}</span>
        )}
      </span>
      {trailing ??
        (interactive && <ChevronRight className="text-muted-foreground size-[18px]" aria-hidden />)}
    </>
  );
  const rowClass = cn(
    'border-border flex min-h-[52px] w-full items-center justify-between gap-3 border-b py-3 text-left text-sm',
    disabled && 'opacity-50',
    className,
  );
  return (
    <div>
      {interactive ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            rowClass,
            'focus-visible:outline-primary rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2',
          )}
        >
          {body}
        </button>
      ) : (
        <div className={rowClass} aria-disabled={disabled || undefined}>
          {body}
        </div>
      )}
      {note && <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">{note}</p>}
    </div>
  );
}

export function SettingSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mt-5">
      <h2 className="text-foreground mb-1 text-[13px] font-bold">{title}</h2>
      {children}
    </section>
  );
}
