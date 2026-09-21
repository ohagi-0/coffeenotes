'use client';

import type { Route } from 'next';
import { AppButton } from '@/components/app-button';
import { DateGroup } from '@/components/date-group';
import { EmptyState } from '@/components/empty-state';
import { ErrorCallout } from '@/components/error-callout';
import { LogListItem } from '@/components/logs/log-list-item';
import { LogListSkeleton } from '@/components/logs/log-list-item-skeleton';
import { ADD_LOG_HREF } from '@/components/nav';
import { groupByDate, type TimelineItem } from '@/features/logs/presenters';

export type LogTimelineProps = {
  items: TimelineItem[];
  isPending: boolean;
  error: Error | null;
  onRetry?: () => void;
  /** 絞り込み中か（0 件のときの文言とボタンが変わる） */
  filtered?: boolean;
  onClearFilter?: () => void;
  /** テスト用。日付見出しの「今日」判定 */
  now?: Date;
  /** 行の遷移先を差し替える（PC の 2 ペイン用）。省略時は記録詳細 */
  hrefFor?: (item: TimelineItem) => Route;
  /** 選択中の記録 ID（PC の 2 ペイン用） */
  selectedId?: string | null;
};

// タイムライン（DESIGN.md S2）。読み込み・失敗・空・絞り込み 0 件・一覧の 5 状態を持つ。
export function LogTimeline({
  items,
  isPending,
  error,
  onRetry,
  filtered,
  onClearFilter,
  now,
  hrefFor,
  selectedId,
}: LogTimelineProps) {
  if (isPending) return <LogListSkeleton />;

  if (error) {
    return (
      <ErrorCallout
        title="記録を読み込めませんでした"
        what={error.message}
        next="通信状態を確認して、もう一度読み込んでください。"
        onRetry={onRetry}
        className="mt-3"
      />
    );
  }

  if (items.length === 0) {
    return filtered ? (
      <EmptyState
        title="条件に合う記録はありません"
        description="絞り込みを外すと、すべての記録が見られます。"
        action={
          onClearFilter && (
            <AppButton variant="secondary" size="md" width="auto" onClick={onClearFilter}>
              絞り込みを解除
            </AppButton>
          )
        }
      />
    ) : (
      <EmptyState
        title="まだ記録がありません"
        description={
          <>
            最初の一杯を残しましょう。
            <br />
            豆名だけでも登録できます。
          </>
        }
        action={
          <AppButton width="auto" href={ADD_LOG_HREF}>
            最初の記録を追加
          </AppButton>
        }
      />
    );
  }

  return (
    <div>
      {groupByDate(items).map((group) => (
        <DateGroup key={group.date} date={group.date} now={now}>
          {group.items.map((item) => (
            // loggedOn / beanId は LogListItem では使わない（受け取っても DOM には流れない）
            <LogListItem
              key={item.id}
              {...item}
              href={hrefFor?.(item)}
              selected={selectedId !== undefined && selectedId === item.id}
            />
          ))}
        </DateGroup>
      ))}
    </div>
  );
}
