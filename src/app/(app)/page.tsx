'use client';

import { Suspense, useMemo } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { FilterChips, type FilterChip } from '@/components/filter-chips';
import { LogTimeline } from '@/components/logs/log-timeline';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { useBeanFilterOptions } from '@/features/beans/queries';
import { chipToFilters, toTimelineItem } from '@/features/logs/presenters';
import { useLogs, useMonthlyLogCount } from '@/features/logs/queries';

// S2 入力記録一覧（F-LIST-1 / F-LIST-2）。絞り込みは URL の ?f= に持ち、共有・戻るに対応する。
// チップの値: all / rating4 / home / shop / country:<国> / process:<精製>

const FIXED_CHIPS: FilterChip[] = [
  { value: 'all', label: 'すべて' },
  { value: 'rating4', label: '星 4 以上' },
  { value: 'home', label: '自宅' },
  { value: 'shop', label: '店で' },
];
const MAX_OPTION_CHIPS = 4;

function HomeInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const chip = params.get('f') ?? 'all';
  const filters = useMemo(() => chipToFilters(chip), [chip]);

  const logs = useLogs(filters);
  const monthly = useMonthlyLogCount();
  const options = useBeanFilterOptions();

  const chips = useMemo<FilterChip[]>(() => {
    const countries = (options.data?.countries ?? [])
      .slice(0, MAX_OPTION_CHIPS)
      .map((c) => ({ value: `country:${c}`, label: c }));
    const processes = (options.data?.processes ?? [])
      .slice(0, MAX_OPTION_CHIPS)
      .map((p) => ({ value: `process:${p}`, label: p }));
    return [...FIXED_CHIPS, ...countries, ...processes];
  }, [options.data]);

  function setChip(value: string) {
    const next = value === 'all' ? pathname : `${pathname}?f=${encodeURIComponent(value)}`;
    router.replace(next as Route, { scroll: false });
  }

  const items = useMemo(() => (logs.data ?? []).map(toTimelineItem), [logs.data]);

  return (
    <div className="pb-2">
      <div className="pt-2 pb-3">
        <h1 className="text-2xl font-bold">入力記録一覧</h1>
        <p className="text-muted-foreground font-num text-xs">
          {monthly.data !== undefined ? `今月 · ${monthly.data} 杯` : ' '}
        </p>
      </div>
      {/* フリーワード検索は Phase 5（F-LIST-3）。それまでは見た目だけ */}
      <div
        className="border-border bg-card text-muted-foreground mb-2.5 flex h-12 items-center gap-2 rounded-xl border px-3.5 text-sm"
        aria-disabled="true"
      >
        <Search className="size-[18px]" strokeWidth={2} aria-hidden />
        豆名・フレーバー・メモで探す（準備中）
      </div>
      <FilterChips chips={chips} value={chip} onChange={setChip} />
      <LogTimeline
        items={items}
        isPending={logs.isPending}
        error={logs.error}
        onRetry={() => void logs.refetch()}
        filtered={chip !== 'all'}
        onClearFilter={() => setChip('all')}
      />
    </div>
  );
}

export default function HomePage() {
  // useSearchParams は静的出力のため Suspense の中で呼ぶ（ADR 0008）
  return (
    <Suspense fallback={<FullScreenLoading />}>
      <HomeInner />
    </Suspense>
  );
}
