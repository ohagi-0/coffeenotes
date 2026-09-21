import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// データグリッド（DESIGN.md §4）。2 列、1px の --border で区切り、角丸 14px。
// ラベル 10px --muted-foreground、値 num 600 15px、溢れは省略記号。null の項目は行ごと省く。

export type SpecItem = {
  label: string;
  value: ReactNode | null | undefined;
  /** 値の後ろに小さく付ける単位（m、g、℃ など） */
  unit?: string;
  /** 日本語の値（店名など）は num 書体にしない */
  ja?: boolean;
};

export type BeanSpecGridProps = {
  items: SpecItem[];
  className?: string;
};

function hasValue(item: SpecItem): boolean {
  return item.value !== null && item.value !== undefined && item.value !== '';
}

export function BeanSpecGrid({ items, className }: BeanSpecGridProps) {
  const visible = items.filter(hasValue);
  if (visible.length === 0) return null;
  return (
    <dl
      className={cn(
        'border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border',
        // 奇数個のときは最後の項目を 2 列ぶち抜きにして、地の色が見える穴を作らない
        '[&>div:last-child:nth-child(odd)]:col-span-2',
        className,
      )}
    >
      {visible.map((item) => (
        <div key={item.label} className="bg-card min-w-0 px-3 py-2.5">
          <dt className="text-muted-foreground text-[10px]">{item.label}</dt>
          <dd className={cn('truncate text-[15px] font-semibold', !item.ja && 'font-num')}>
            {item.value}
            {item.unit && (
              <span className="text-muted-foreground ml-0.5 text-[12px] font-medium">{item.unit}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
