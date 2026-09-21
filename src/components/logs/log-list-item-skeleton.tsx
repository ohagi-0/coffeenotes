import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ログ行のスケルトン（DESIGN.md §6: 内容と同じ形）。S2 の読み込み中は 4 件並べる。
// prefers-reduced-motion では静止（motion-reduce:animate-none）。

const bar = 'rounded-md bg-secondary motion-reduce:animate-none';

export function LogListItemSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('border-border grid grid-cols-[62px_1fr] items-start gap-3.5 border-b py-3.5', className)}
      aria-hidden="true"
    >
      <Skeleton className={cn(bar, 'aspect-[3/4] w-[62px] rounded-[5px]')} />
      <div className="min-w-0">
        <Skeleton className={cn(bar, 'h-[22px] w-4/5')} />
        <Skeleton className={cn(bar, 'mt-2 h-3 w-2/5')} />
        <Skeleton className={cn(bar, 'mt-3 h-[15px] w-3/5')} />
        <div className="mt-2.5 flex gap-1.5">
          <Skeleton className={cn(bar, 'h-[18px] w-12')} />
          <Skeleton className={cn(bar, 'h-[18px] w-16')} />
        </div>
      </div>
    </div>
  );
}

export function LogListSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label="読み込み中" className={className}>
      {Array.from({ length: count }, (_, i) => (
        <LogListItemSkeleton key={i} />
      ))}
    </div>
  );
}
