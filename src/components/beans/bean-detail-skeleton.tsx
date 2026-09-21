import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// 豆詳細（S4）のスケルトン。ヘッダー（104px の画像 + ロースター + 豆名 + 星）、データグリッド、フレーバー、レーダーの形をなぞる。

const bar = 'rounded-md bg-secondary motion-reduce:animate-none';

export function BeanDetailSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label="読み込み中" className={cn('space-y-5', className)}>
      <div className="flex gap-4">
        <Skeleton className={cn(bar, 'aspect-[3/4] w-[104px] shrink-0 rounded-[5px]')} />
        <div className="min-w-0 flex-1 pt-1">
          <Skeleton className={cn(bar, 'h-3 w-24')} />
          <Skeleton className={cn(bar, 'mt-3 h-8 w-full')} />
          <Skeleton className={cn(bar, 'mt-2 h-8 w-3/5')} />
          <Skeleton className={cn(bar, 'mt-4 h-5 w-32')} />
        </div>
      </div>
      <div className="border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-card px-3 py-2.5">
            <Skeleton className={cn(bar, 'h-2.5 w-10')} />
            <Skeleton className={cn(bar, 'mt-2 h-4 w-4/5')} />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Skeleton className={cn(bar, 'h-[18px] w-12')} />
        <Skeleton className={cn(bar, 'h-[18px] w-16')} />
        <Skeleton className={cn(bar, 'h-[18px] w-14')} />
      </div>
      <Skeleton className={cn(bar, 'mx-auto h-[190px] w-[200px] rounded-full')} />
    </div>
  );
}
