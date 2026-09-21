'use client';

import { Suspense, useMemo } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { BeanDetailPane } from '@/components/beans/bean-detail-pane';
import { FilterChips, type FilterChip } from '@/components/filter-chips';
import { LogTimeline } from '@/components/logs/log-timeline';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { XL_QUERY, useMediaQuery } from '@/components/use-media-query';
import { useBeanFilterOptions } from '@/features/beans/queries';
import { chipToFilters, toTimelineItem, type TimelineItem } from '@/features/logs/presenters';
import { useLogs, useMonthlyLogCount } from '@/features/logs/queries';
import { routes } from '@/lib/routes';

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
  const selectedBean = params.get('bean');
  const selectedLog = params.get('log');
  // 1280px 以上では行を選ぶと右ペインに豆詳細を出す（ページ遷移しない）。それ未満は記録詳細へ遷移
  const twoPane = useMediaQuery(XL_QUERY);
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

  function hrefFor(item: TimelineItem): Route {
    if (!twoPane || !item.beanId) return routes.log(item.id) as Route;
    const q = new URLSearchParams();
    if (chip !== 'all') q.set('f', chip);
    q.set('bean', item.beanId);
    q.set('log', item.id);
    return `${pathname}?${q.toString()}` as Route;
  }

  return (
    <div className="pb-2 xl:grid xl:grid-cols-[400px_minmax(0,1fr)] xl:items-start xl:gap-10">
      <div>
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
          hrefFor={hrefFor}
          selectedId={twoPane ? selectedLog : undefined}
        />
      </div>
      <aside className="hidden xl:block" aria-label="豆の詳細">
        <BeanDetailPane beanId={twoPane ? selectedBean : null} />
      </aside>
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
