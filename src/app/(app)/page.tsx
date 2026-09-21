'use client';

import Link from 'next/link';
import { Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLogCount } from '@/features/logs/queries';

// ホーム（タイムライン）。Phase 0 は空状態まで。一覧本体は Phase 1（F-LIST-1）。
export default function HomePage() {
  const { data: count, isPending, isError, error, refetch } = useLogCount();

  return (
    <div className="space-y-6 py-4">
      <h1 className="text-2xl font-bold">入力記録一覧</h1>

      {isPending && (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {isError && (
        <div className="border-destructive/40 space-y-3 rounded-lg border p-4 text-sm">
          <p className="text-destructive font-medium">記録を読み込めませんでした</p>
          <p className="text-muted-foreground">{error.message}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            再試行
          </Button>
        </div>
      )}

      {!isPending && !isError && count === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8 text-center">
          <Coffee className="text-muted-foreground size-10" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">まだ記録がありません</p>
            <p className="text-muted-foreground text-sm">飲んだコーヒーを記録して振り返りましょう</p>
          </div>
          <Button size="lg" className="h-11 px-5" render={<Link href="/logs/new" />}>
            最初の記録を作る
          </Button>
        </div>
      )}

      {!isPending && !isError && count !== undefined && count > 0 && (
        <p className="text-muted-foreground text-sm">{count} 件の記録があります（一覧は Phase 1 で実装）</p>
      )}
    </div>
  );
}
