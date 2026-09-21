'use client';

import { useMemo } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Coffee } from 'lucide-react';
import { BeanDetail } from '@/components/beans/bean-detail';
import { BeanDetailSkeleton } from '@/components/beans/bean-detail-skeleton';
import { ErrorCallout } from '@/components/error-callout';
import { beanSpecItems, beanTaste } from '@/features/beans/presenters';
import { useBean } from '@/features/beans/queries';
import { writeNewLogDraft } from '@/features/logs/new-log-draft';
import { toTimelineItem } from '@/features/logs/presenters';
import { useLogsByBean, useRatingStats } from '@/features/logs/queries';
import { routes } from '@/lib/routes';

// PC（1280px 以上）のホーム右ペイン（DESIGN.md §9.2 D1）。一覧で選んだ豆の詳細を、ページ遷移せずに出す。
// 選択は ?bean= クエリ（共有・戻るに対応）。

export function BeanDetailPane({ beanId }: { beanId: string | null }) {
  const router = useRouter();
  const bean = useBean(beanId);
  const logs = useLogsByBean(beanId);
  const stats = useRatingStats();
  const items = useMemo(() => (logs.data ?? []).map(toTimelineItem), [logs.data]);

  if (!beanId) {
    return (
      <div className="text-muted-foreground flex h-full min-h-[360px] flex-col items-center justify-center gap-3 text-center">
        <span className="bg-secondary grid size-16 place-items-center rounded-full" aria-hidden>
          <Coffee className="text-primary size-7" strokeWidth={1.6} />
        </span>
        <p className="text-sm">一覧の記録を選ぶと、ここに豆の詳細が出ます。</p>
      </div>
    );
  }
  if (bean.isPending) return <BeanDetailSkeleton className="pt-3" />;
  if (bean.error) {
    return (
      <ErrorCallout
        title="豆を読み込めませんでした"
        what={bean.error.message}
        next="通信状態を確認して、もう一度読み込んでください。"
        onRetry={() => void bean.refetch()}
        className="mt-3"
      />
    );
  }
  const b = bean.data;
  return (
    <BeanDetail
      layout="wide"
      crumb={<span>豆の詳細</span>}
      name={b.name}
      roasterName={b.roaster?.name ?? (b.source === 'home_roasted' ? '自家焙煎' : null)}
      country={b.country}
      spec={beanSpecItems(b)}
      flavorNotes={b.flavor_notes}
      description={b.description}
      taste={beanTaste(b)}
      stat={stats.data?.byBean.get(b.id)}
      logs={items}
      logsPending={logs.isPending}
      logsError={logs.error}
      onRetryLogs={() => void logs.refetch()}
      editHref={`${routes.bean(b.id)}&edit=1` as Route}
      onLogAgain={() => {
        writeNewLogDraft({ bean: { kind: 'existing', id: b.id, name: b.name } });
        router.push(`${routes.newLog}?step=place` as Route);
      }}
    />
  );
}
