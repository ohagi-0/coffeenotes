'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { AppButton } from '@/components/app-button';
import { BeanSpecGrid } from '@/components/beans/bean-spec-grid';
import { ErrorCallout } from '@/components/error-callout';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { LogTimeline } from '@/components/logs/log-timeline';
import { RatingStars } from '@/components/logs/rating-stars';
import { ADD_LOG_HREF } from '@/components/nav';
import { Skeleton } from '@/components/ui/skeleton';
import { toTimelineItem } from '@/features/logs/presenters';
import { useLogsByShop, useRatingStats } from '@/features/logs/queries';
import { googleMapsUrl, shopKindLabel } from '@/features/shops/presenters';
import { useShop } from '@/features/shops/queries';
import { idFromSearchParams, routes } from '@/lib/routes';

// 店詳細（S6 の行から。F-MAP-2）。店情報 + その店の記録一覧。URL は /shops/detail?id=（ADR 0008）。

function ShopDetailInner() {
  const id = idFromSearchParams(useSearchParams());
  const shop = useShop(id);
  const logs = useLogsByShop(id);
  const stats = useRatingStats();
  const stat = id ? stats.data?.byShop.get(id) : undefined;
  const items = useMemo(() => (logs.data ?? []).map(toTimelineItem), [logs.data]);

  const crumb = (
    <div className="text-muted-foreground flex items-center justify-between pt-3 pb-2.5 text-xs">
      <span>
        <Link href={routes.shops} className="text-muted-foreground">
          記録したお店
        </Link>{' '}
        › 店
      </span>
    </div>
  );

  if (!id) {
    return (
      <div className="pb-2">
        {crumb}
        <ErrorCallout
          title="店が見つかりません"
          what="URL に店の ID がありません。"
          next="一覧から店を選び直してください。"
        />
      </div>
    );
  }
  if (shop.isPending) {
    return (
      <div className="pb-2" role="status" aria-busy="true" aria-label="読み込み中">
        {crumb}
        <Skeleton className="bg-secondary h-8 w-3/5 rounded-md" />
        <Skeleton className="bg-secondary mt-3 h-4 w-2/5 rounded-md" />
        <Skeleton className="bg-secondary mt-6 h-24 w-full rounded-[14px]" />
      </div>
    );
  }
  if (shop.error) {
    return (
      <div className="pb-2">
        {crumb}
        <ErrorCallout
          title="店を読み込めませんでした"
          what={shop.error.message}
          next="通信状態を確認して、もう一度読み込んでください。"
          onRetry={() => void shop.refetch()}
        />
      </div>
    );
  }

  const s = shop.data;
  return (
    <div className="pb-2">
      {crumb}
      <h1 className="text-2xl font-bold">{s.name}</h1>
      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {stat?.avgRating !== null && stat?.avgRating !== undefined ? (
          <span className="flex items-center gap-2">
            <RatingStars value={stat.avgRating} size="sm" hideValue />
            <span className="font-num text-foreground text-[13px] font-extrabold">
              {stat.avgRating.toFixed(1)}
            </span>
          </span>
        ) : null}
        {stat?.count ? <span className="font-num">{stat.count} 回</span> : null}
      </div>
      <BeanSpecGrid
        className="mt-4"
        items={[
          { label: '種別', value: shopKindLabel(s.kind) },
          { label: '住所', value: s.address },
          {
            label: '座標',
            value: s.lat !== null && s.lng !== null ? `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}` : null,
          },
        ]}
      />
      {googleMapsUrl(s) && (
        <a
          href={googleMapsUrl(s)!}
          target="_blank"
          rel="noreferrer"
          className="text-primary mt-2 inline-flex h-11 items-center gap-1.5 text-[13px] font-medium"
        >
          <ExternalLink className="size-4" aria-hidden />
          Google マップで開く
        </a>
      )}
      {(s.lat === null || s.lng === null) && (
        <p className="text-muted-foreground mt-2 text-xs">
          座標が無いので地図には出ません。編集で「店名で検索」か「地図で指定」を使うと付けられます。
        </p>
      )}
      <h2 className="mt-6 mb-1 text-[13px] font-bold">この店の記録</h2>
      <LogTimeline
        items={items}
        isPending={logs.isPending}
        error={logs.error}
        onRetry={() => void logs.refetch()}
      />
      <div className="mt-6">
        <AppButton href={ADD_LOG_HREF}>この店で記録する</AppButton>
      </div>
    </div>
  );
}

export default function ShopDetailPage() {
  return (
    <Suspense fallback={<FullScreenLoading />}>
      <ShopDetailInner />
    </Suspense>
  );
}
