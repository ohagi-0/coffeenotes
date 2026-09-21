import type { ReactNode } from 'react';
import { format, isSameDay, parseISO, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// 日付見出し（DESIGN.md S2）。「今日 · 9月21日（日）」「昨日 · 9月20日（土）」「9月19日（金）」。年が違えば年も出す。

function toDate(date: string | Date): Date {
  return typeof date === 'string' ? parseISO(date) : date;
}

export function formatDateGroupLabel(date: string | Date, now: Date = new Date()): string {
  const d = toDate(date);
  const sameYear = d.getFullYear() === now.getFullYear();
  const body = format(d, sameYear ? 'M月d日（E）' : 'yyyy年M月d日（E）', { locale: ja });
  if (isSameDay(d, now)) return `今日 · ${body}`;
  if (isSameDay(d, subDays(now, 1))) return `昨日 · ${body}`;
  return body;
}

export type DateGroupProps = {
  /** YYYY-MM-DD か Date */
  date: string | Date;
  /** テスト用。省略時は現在時刻 */
  now?: Date;
  children?: ReactNode;
  className?: string;
};

export function DateGroup({ date, now, children, className }: DateGroupProps) {
  const d = toDate(date);
  return (
    <section className={className}>
      <h2 className={cn('text-muted-foreground mt-[18px] text-[12px] font-medium')}>
        <time dateTime={format(d, 'yyyy-MM-dd')}>{formatDateGroupLabel(d, now)}</time>
      </h2>
      {children}
    </section>
  );
}
