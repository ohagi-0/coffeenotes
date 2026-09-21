import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// 失敗表示（DESIGN.md §4 / §6）。枠は錆色、地は錆色 10%、角丸 14px。
// 見出し + 「何が起きたか」「次にできること」を 1 文ずつ。謝罪語・曖昧語は使わない。

export type ErrorCalloutProps = {
  title: string;
  /** 何が起きたか（1 文） */
  what: ReactNode;
  /** 次にできること（1 文） */
  next?: ReactNode;
  /** 渡すと再試行ボタンを出す */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

export function ErrorCallout({
  title,
  what,
  next,
  onRetry,
  retryLabel = 'もう一度読み込む',
  className,
}: ErrorCalloutProps) {
  return (
    <div
      role="alert"
      className={cn('border-destructive bg-destructive/10 rounded-[14px] border p-3.5', className)}
    >
      <p className="text-destructive text-[15px] font-bold">{title}</p>
      <p className="mt-1 text-[13px]">{what}</p>
      {next && <p className="text-muted-foreground mt-1 text-[13px]">{next}</p>}
      {onRetry && (
        <Button
          type="button"
          variant="secondary"
          onClick={onRetry}
          className="mt-3 h-11 rounded-[12px] px-4 text-[14px] font-bold"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
