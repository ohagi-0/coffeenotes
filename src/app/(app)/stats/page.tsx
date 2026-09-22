'use client';

import { Suspense, useMemo } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { TasteRadar } from '@/components/beans/taste-radar';
import { EmptyState } from '@/components/empty-state';
import { ErrorCallout } from '@/components/error-callout';
import { FilterChips } from '@/components/filter-chips';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MIN_ROWS_FOR_TRENDS,
  PERIOD_CHIPS,
  filterByPeriod,
  monthly,
  summarize,
  tasteAverages,
  topFlavors,
  topHighRated,
  type CountItem,
  type StatsPeriod,
} from '@/features/stats/aggregate';
import { useStatsRows } from '@/features/stats/queries';
import { routes } from '@/lib/routes';

// S8 好みの分析（F-STAT-1〜4）。期間は ?p= に持つ（ADR 0008）。集計は features/stats/aggregate の純粋関数。

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-card border-border rounded-[14px] border px-3.5 py-3">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="font-num text-[26px] leading-tight font-extrabold">
        {value}
        {unit && <span className="text-muted-foreground ml-1 text-xs font-medium">{unit}</span>}
      </p>
    </div>
  );
}

function Bars({ title, items, empty }: { title: string; items: CountItem[]; empty: string }) {
  return (
    <section className="mt-6" aria-label={title}>
      <h2 className="mb-2 text-[13px] font-bold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li key={it.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
              <span className="truncate text-sm">{it.label}</span>
              <span className="font-num text-muted-foreground text-xs">{it.count} 回</span>
              <div className="bg-secondary col-span-2 h-2 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${it.percent}%` }}
                  role="presentation"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const period = (
    PERIOD_CHIPS.some((c) => c.value === params.get('p')) ? params.get('p') : 'all'
  ) as StatsPeriod;
  const rows = useStatsRows();

  const filtered = useMemo(() => filterByPeriod(rows.data ?? [], period), [rows.data, period]);
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const countries = useMemo(() => topHighRated(filtered, 'country'), [filtered]);
  const processes = useMemo(() => topHighRated(filtered, 'process'), [filtered]);
  const flavors = useMemo(() => topFlavors(filtered), [filtered]);
  const tasteHigh = useMemo(() => tasteAverages(filtered, true), [filtered]);
  const tasteAll = useMemo(() => tasteAverages(filtered, false), [filtered]);
  const months = useMemo(() => monthly(rows.data ?? [], 12), [rows.data]);
  const maxMonth = Math.max(1, ...months.map((m) => m.count));

  function setPeriod(v: string) {
    router.replace((v === 'all' ? pathname : `${pathname}?p=${v}`) as Route, { scroll: false });
  }

  return (
    <div className="pb-2">
      <div className="pt-2 pb-3">
        <h1 className="text-2xl font-bold">好みの分析</h1>
        <p className="text-muted-foreground text-xs">星 4 以上の記録から、好みの傾向を出します。</p>
      </div>
      <FilterChips chips={PERIOD_CHIPS} value={period} onChange={setPeriod} />

      {rows.isPending && (
        <div role="status" aria-busy="true" aria-label="読み込み中" className="mt-3 grid grid-cols-2 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[68px] rounded-[14px]" />
          ))}
        </div>
      )}

      {rows.error && (
        <ErrorCallout
          title="記録を読み込めませんでした"
          what={rows.error.message}
          next="通信状態を確認して、もう一度読み込んでください。"
          onRetry={() => void rows.refetch()}
          className="mt-3"
        />
      )}

      {rows.data && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Tile label="記録" value={String(summary.logs)} unit="回" />
            <Tile label="豆" value={String(summary.beans)} unit="種" />
            <Tile label="店" value={String(summary.shops)} unit="軒" />
            <Tile label="平均星" value={summary.avgRating?.toFixed(1) ?? '—'} />
          </div>

          {filtered.length < MIN_ROWS_FOR_TRENDS ? (
            <EmptyState
              icon={BarChart3}
              title="記録が 3 件たまると傾向が出ます"
              description={
                period === 'all'
                  ? '星を付けた記録が増えると、好みの生産国や精製方法、味の形が見えてきます。'
                  : 'この期間の記録が少ないので、期間を広げると傾向が出ます。'
              }
              action={<AppButton href={routes.newLog}>記録を追加</AppButton>}
              className="mt-6"
            />
          ) : (
            <>
              <Bars
                title="星 4 以上に多い生産国"
                items={countries}
                empty="星 4 以上の記録がまだありません。"
              />
              <Bars
                title="星 4 以上に多い精製方法"
                items={processes}
                empty="星 4 以上の記録がまだありません。"
              />

              <section className="mt-6" aria-label="よく出るフレーバー">
                <h2 className="mb-2 text-[13px] font-bold">よく出るフレーバー</h2>
                {flavors.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    高評価の豆にフレーバーノートが入ると、ここに並びます。
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {flavors.map((f) => (
                      <li key={f.label} className="bg-secondary rounded-[5px] px-2 text-[12px] leading-[1.9]">
                        {f.label} <span className="font-num text-muted-foreground">{f.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="mt-6" aria-label="好みの形">
                <h2 className="mb-1 text-[13px] font-bold">好みの形</h2>
                {tasteHigh.beans === 0 ||
                [
                  tasteHigh.flavor,
                  tasteHigh.sweetness,
                  tasteHigh.acidity,
                  tasteHigh.aftertaste,
                  tasteHigh.body,
                ].every((v) => v === null) ? (
                  <p className="text-muted-foreground text-sm">
                    高評価の豆に味覚チャートが入ると、好みの形が見えます。
                  </p>
                ) : (
                  <>
                    <p className="text-muted-foreground mb-2 text-[11px]">
                      銅 = 星 4 以上の豆（{tasteHigh.beans} 種）の平均 · 点線 = 全体（{tasteAll.beans} 種）
                    </p>
                    <TasteRadar
                      value={{
                        flavor: tasteHigh.flavor,
                        sweetness: tasteHigh.sweetness,
                        acidity: tasteHigh.acidity,
                        aftertaste: tasteHigh.aftertaste,
                        body: tasteHigh.body,
                      }}
                      compare={{
                        flavor: tasteAll.flavor,
                        sweetness: tasteAll.sweetness,
                        acidity: tasteAll.acidity,
                        aftertaste: tasteAll.aftertaste,
                        body: tasteAll.body,
                      }}
                      aria-label="好みの形（味覚チャートの平均）"
                    />
                  </>
                )}
              </section>
            </>
          )}

          <section className="mt-6" aria-label="月別の記録数">
            <h2 className="mb-2 text-[13px] font-bold">月別の記録</h2>
            <ol className="grid grid-cols-12 items-end gap-1" style={{ height: 96 }}>
              {months.map((m) => (
                <li
                  key={m.month}
                  className="flex h-full flex-col items-center justify-end gap-1"
                  title={`${m.month}: ${m.count} 回${m.avgRating !== null ? ` · 平均 ${m.avgRating}` : ''}`}
                >
                  <span className="font-num text-muted-foreground text-[9px]">{m.count || ''}</span>
                  <span
                    className="bg-primary/70 w-full rounded-t-[3px]"
                    style={{ height: `${Math.max(2, Math.round((m.count / maxMonth) * 64))}px` }}
                    aria-hidden
                  />
                  <span className="font-num text-muted-foreground text-[9px]">{m.month.slice(5)}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}

export default function StatsPage() {
  return (
    <Suspense fallback={<FullScreenLoading />}>
      <StatsInner />
    </Suspense>
  );
}
