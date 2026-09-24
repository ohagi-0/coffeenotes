'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppButton } from '@/components/app-button';
import { BeanDetailPane } from '@/components/beans/bean-detail-pane';
import { FilterChips, type FilterChip } from '@/components/filter-chips';
import { LogTimeline } from '@/components/logs/log-timeline';
import { XL_QUERY, useMediaQuery } from '@/components/use-media-query';
import { useBeanFilterOptions } from '@/features/beans/queries';
import {
  chipToFilters,
  matchesLogSearch,
  toTimelineItem,
  type TimelineItem,
} from '@/features/logs/presenters';
import { useDeleteLogs } from '@/features/logs/mutations';
import { useLogs, useMonthlyLogCount } from '@/features/logs/queries';
import { routes } from '@/lib/routes';
import { COUNTRY_SHELVES, countryDisplayName, countryKeyOf } from '@/lib/vocab';
import { cn } from '@/lib/utils';

// S2 入力記録一覧（F-LIST-1 / F-LIST-2）。/logs（id なし）で描く。絞り込みは URL の ?f= に持ち、共有・戻るに対応する。
// 2026-09-24 にホーム（/）は豆のコレクション（S10）になり、一覧はここへ移った。
// チップの値: all / rating4 / home / shop / country:<国> / process:<精製>
// 「選択」で一括削除の選択モード（F-LOG-7）。行がチェックボックスになり、下のバーから確認ダイアログ → 削除。

const FIXED_CHIPS: FilterChip[] = [
  { value: 'all', label: 'すべて' },
  { value: 'rating4', label: '星 4 以上' },
  { value: 'home', label: '自宅' },
  { value: 'shop', label: '店で' },
];
const MAX_OPTION_CHIPS = 4;

/** 自分の豆に出てくる生産国の表記を国ごとにまとめ、日本語名のチップにする（Ethiopia とエチオピアは 1 つ）。語彙の順 */
function groupCountryChips(values: readonly string[]): FilterChip[] {
  const seen = new Map<string, string>();
  for (const v of values) {
    const key = countryKeyOf(v);
    if (key && !seen.has(key)) seen.set(key, countryDisplayName(v) ?? v);
  }
  const order = new Map(COUNTRY_SHELVES.map((c, i) => [c.key, i]));
  return Array.from(seen.entries())
    .sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999) || a[1].localeCompare(b[1], 'ja'))
    .map(([key, label]) => ({ value: `country:${key}`, label }));
}

export function LogListView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const chip = params.get('f') ?? 'all';
  const q = params.get('q') ?? '';
  const selectedBean = params.get('bean');
  const selectedLog = params.get('log');
  // 1280px 以上では行を選ぶと右ペインに豆詳細を出す（ページ遷移しない）。それ未満は記録詳細へ遷移
  const twoPane = useMediaQuery(XL_QUERY);
  const options = useBeanFilterOptions();
  const filters = useMemo(() => chipToFilters(chip, options.data?.countries ?? []), [chip, options.data]);

  const logs = useLogs(filters);
  const monthly = useMonthlyLogCount();
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
      onSuccess: (r) => {
        setConfirming(false);
        exitSelecting();
        toast.success(
          r.removedShopIds.length > 0
            ? `${r.deleted} 件の記録を削除しました。記録の無くなった店も消しました`
            : `${r.deleted} 件の記録を削除しました`,
        );
      },
      onError: (e) => {
        setConfirming(false);
        toast.error(e instanceof Error ? e.message : '削除できませんでした');
      },
    });
  }

  const chips = useMemo<FilterChip[]>(() => {
    const countries = groupCountryChips(options.data?.countries ?? []).slice(0, MAX_OPTION_CHIPS);
    const processes = (options.data?.processes ?? [])
      .slice(0, MAX_OPTION_CHIPS)
      .map((p) => ({ value: `process:${p}`, label: p }));
    return [...FIXED_CHIPS, ...countries, ...processes];
  }, [options.data]);

  function replaceQuery(next: { f?: string; q?: string }) {
    const sp = new URLSearchParams();
    const f = next.f ?? chip;
    const query = next.q ?? q;
    if (f !== 'all') sp.set('f', f);
    if (query.trim()) sp.set('q', query);
    const qs = sp.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route, { scroll: false });
  }
  function setChip(value: string) {
    replaceQuery({ f: value });
  }
  function setQuery(value: string) {
    replaceQuery({ q: value });
  }

  // フリーワード検索（F-LIST-3）は手元で絞る（一覧は全件取っているので往復しない）
  const items = useMemo(
    () => (logs.data ?? []).filter((l) => matchesLogSearch(l, q)).map(toTimelineItem),
    [logs.data, q],
  );
  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));

  function hrefFor(item: TimelineItem): Route {
    if (!twoPane || !item.beanId) return routes.log(item.id) as Route;
    const sp = new URLSearchParams();
    if (chip !== 'all') sp.set('f', chip);
    if (q.trim()) sp.set('q', q);
    sp.set('bean', item.beanId);
    sp.set('log', item.id);
    return `${pathname}?${sp.toString()}` as Route;
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
        <label className="border-border bg-card text-muted-foreground mb-2.5 flex h-12 items-center gap-2 rounded-xl border px-3.5 text-sm">
          <Search className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="豆名・フレーバー・メモ・店名で探す"
            aria-label="豆名・フレーバー・メモ・店名で探す"
            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <FilterChips chips={chips} value={chip} onChange={setChip} />
        <LogTimeline
          items={items}
          isPending={logs.isPending}
          error={logs.error}
          onRetry={() => void logs.refetch()}
          filtered={chip !== 'all' || q.trim() !== ''}
          onClearFilter={() => replaceQuery({ f: 'all', q: '' })}
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
          選んだ記録が消えます。記録が無くなった店も一緒に消えます。豆の情報とカード画像は残ります。元に戻せません。
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
