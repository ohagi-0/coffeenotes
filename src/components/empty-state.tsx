import type { ReactNode } from 'react';
import { Coffee, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// 空状態（DESIGN.md §4 / §6）。96px の丸に銅の線画アイコン、見出し 17px、説明 13px、主ボタン 1 つ。
// 文言は「まだ〜がありません」+ 次にできること。ボタンは呼び出し側が 1 つだけ渡す（画面に主ボタンは 1 つ、P3）。

export type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  /** 主ボタン。Link か Button を 1 つだけ */
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
};

export function EmptyState({ title, description, action, icon: Icon = Coffee, className }: EmptyStateProps) {
  return (
    <div className={cn('px-5 pt-[60px] pb-5 text-center', className)}>
      <div
        className="bg-secondary mx-auto mb-[18px] grid size-24 place-items-center rounded-full"
        aria-hidden="true"
      >
        <Icon className="text-primary size-11" strokeWidth={1.6} />
      </div>
      <p className="text-[17px] font-bold">{title}</p>
      {description && <p className="text-muted-foreground mt-1.5 text-[13px]">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
