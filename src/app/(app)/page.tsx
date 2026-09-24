'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppButton } from '@/components/app-button';
import { BeanDetailPane } from '@/components/beans/bean-detail-pane';
import { FilterChips, type FilterChip } from '@/components/filter-chips';
import { LogTimeline } from '@/components/logs/log-timeline';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { XL_QUERY, useMediaQuery } from '@/components/use-media-query';
import { useBeanFilterOptions } from '@/features/beans/queries';
import { chipToFilters, toTimelineItem, type TimelineItem } from '@/features/logs/presenters';
import { useDeleteLogs } from '@/features/logs/mutations';
import { useLogs, useMonthlyLogCount } from '@/features/logs/queries';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

// S2 入力記録一覧（F-LIST-1 / F-LIST-2）。絞り込みは URL の ?f= に持ち、共有・戻るに対応する。
// チップの値: all / rating4 / home / shop / country:<国> / process:<精製>
// 「選択」で一括削除の選択モード（F-LOG-7）。行がチェックボックスになり、下のバーから確認ダイアログ → 削除。

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
  const deleteLogs = useDeleteLogs();

  // 一括削除の選択モード
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (confirming && !d.open) d.showModal();
    if (!confirming && d.open) d.close();
  }, [confirming]);
  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function exitSelecting() {
    setSelecting(false);
    setSelectedIds(new Set());
  }
  function deleteSelected() {
    deleteLogs.mutate([...selectedIds], {
      onSuccess: (n) => {
        setConfirming(false);
        exitSelecting();
        toast.success(`${n} 件の記録を削除しました`);
      },
      onError: (e) => {
        setConfirming(false);
        toast.error(e instanceof Error ? e.message : '削除できませんでした');
      },
    });
  }

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
  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));

  function hrefFor(item: TimelineItem): Route {
    if (!twoPane || !item.beanId) return routes.log(item.id) as Route;
    const q = new URLSearchParams();
    if (chip !== 'all') q.set('f', chip);
    q.set('bean', item.beanId);
    q.set('log', item.id);
    return `${pathname}?${q.toString()}` as Route;
  }

  return (
    <div
      className={cn(
        'xl:grid xl:grid-cols-[400px_minmax(0,1fr)] xl:items-start xl:gap-10',
        selecting ? 'pb-28' : 'pb-2',
      )}
    >
      <div>
        <div className="flex items-end justify-between pt-2 pb-3">
          <div>
            <h1 className="text-2xl font-bold">入力記録一覧</h1>
            <p className="text-muted-foreground font-num text-xs">
              {monthly.data !== undefined ? `今月 · ${monthly.data} 杯` : ' '}
            </p>
          </div>
          {items.length > 0 &&
            (selecting ? (
              <button
                type="button"
                onClick={exitSelecting}
                className="text-primary h-11 text-[13px] font-medium"
              >
                やめる
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSelecting(true)}
                className="text-primary h-11 text-[13px] font-medium"
              >
                選択
              </button>
            ))}
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
          selectable={selecting}
          selectedIds={selectedIds}
          onToggle={toggle}
        />
      </div>
      <aside className="hidden xl:block" aria-label="豆の詳細">
        <BeanDetailPane beanId={twoPane ? selectedBean : null} />
      </aside>

      {selecting && (
        <div
          role="toolbar"
          aria-label="選択した記録の操作"
          className="bg-background/95 border-border fixed inset-x-0 bottom-0 z-20 border-t px-5 pt-3 pb-[max(env(safe-area-inset-bottom,0px),12px)] backdrop-blur"
        >
          <div className="mx-auto flex max-w-[640px] items-center gap-3">
            <p className="font-num min-w-0 flex-1 text-sm">
              <span className="font-bold">{selectedIds.size}</span> 件を選択中
            </p>
            <button
              type="button"
              onClick={() => setSelectedIds(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
              className="text-primary h-11 shrink-0 text-[13px] font-medium"
            >
              {allSelected ? '選択を解除' : 'すべて選択'}
            </button>
            <AppButton
              variant="destructive"
              size="md"
              width="auto"
              disabled={selectedIds.size === 0}
              onClick={() => setConfirming(true)}
            >
              <Trash2 aria-hidden />
              削除
            </AppButton>
          </div>
        </div>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setConfirming(false)}
        aria-labelledby="logs-bulk-delete-title"
        className="bg-background text-foreground border-border m-auto w-[calc(100%-40px)] max-w-sm rounded-[18px] border p-5 backdrop:bg-black/55"
      >
        <p id="logs-bulk-delete-title" className="text-base font-bold">
          {selectedIds.size} 件の記録を削除しますか？
        </p>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          選んだ記録が消えます。豆の情報とカード画像は残ります。元に戻せません。
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <AppButton variant="destructive" onClick={deleteSelected} loading={deleteLogs.isPending}>
            {selectedIds.size} 件を削除する
          </AppButton>
          <AppButton variant="secondary" onClick={() => setConfirming(false)} disabled={deleteLogs.isPending}>
            やめる
          </AppButton>
        </div>
      </dialog>
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
