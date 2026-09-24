'use client';

import type { ReactNode } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { AppButton } from '@/components/app-button';
import { BeanSpecGrid, type SpecItem } from '@/components/beans/bean-spec-grid';
import { CardImage } from '@/components/beans/card-image';
import { TasteRadar } from '@/components/beans/taste-radar';
import type { TasteValues } from '@/components/beans/taste-dots';
import { LogTimeline } from '@/components/logs/log-timeline';
import { RatingStars } from '@/components/logs/rating-stars';
import type { TimelineItem } from '@/features/logs/presenters';
import { hasAnyTaste } from '@/features/beans/presenters';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

export type BeanDetailProps = {
  name: string;
  roasterName: string | null;
  country: string | null;
  imageSrc?: string | null;
  spec: SpecItem[];
  flavorNotes: string[];
  description: string | null;
  taste: TasteValues;
  /** 回数と平均星（無ければ 0 回） */
  stat?: { count: number; avgRating: number | null };
  logs: TimelineItem[];
  logsPending: boolean;
  logsError: Error | null;
  onRetryLogs?: () => void;
  editHref?: Route;
  /** 「この豆をもう一度記録する」 */
  onLogAgain: () => void;
  /** PC の詳細ペイン用: 左にカードとレーダー、右にデータ */
  layout?: 'default' | 'wide';
  className?: string;
  /** パンくずの左（既定は「入力記録一覧 › 豆」） */
  crumb?: ReactNode;
};

// 豆詳細（S4、DESIGN.md §5）。props 駆動。ルートは /beans?id=（ADR 0008）。
export function BeanDetail({
  name,
  roasterName,
  country,
  imageSrc,
  spec,
  flavorNotes,
  description,
  taste,
  stat,
  logs,
  logsPending,
  logsError,
  onRetryLogs,
  editHref,
  onLogAgain,
  layout = 'default',
  className,
  crumb,
}: BeanDetailProps) {
  const wide = layout === 'wide';
  const header = (
    <div>
      {roasterName && (
        <p className="font-num text-primary text-[11px] font-semibold tracking-[.14em] uppercase">
          {roasterName}
        </p>
      )}
      <h1 className={cn('font-display mt-1.5 break-words', wide ? 'text-[44px]' : 'text-[34px]')}>{name}</h1>
      <div className="mt-2.5 flex items-center gap-2">
        <RatingStars value={stat?.avgRating ?? null} size="md" />
        <span className="text-muted-foreground font-num text-xs">{stat?.count ?? 0} 回</span>
      </div>
    </div>
  );
  const dataPart = (
    <>
      <BeanSpecGrid items={spec} className="mt-3.5" />
      {flavorNotes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="フレーバー">
          {flavorNotes.map((f) => (
            <li key={f} className="bg-secondary rounded-[5px] px-2 text-[11px] leading-[1.6]">
              {f}
            </li>
          ))}
        </ul>
      )}
      {description && <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">{description}</p>}
    </>
  );
  const radar = hasAnyTaste(taste) ? (
    <>
      <h2 className={cn('text-[13px] font-bold', wide ? 'mt-5 mb-2' : 'mt-5')}>味覚チャート</h2>
      <TasteRadar value={taste} className={wide ? 'max-w-[220px]' : 'mx-auto my-1.5'} />
    </>
  ) : null;
  const logsPart = (
    <>
      <h2 className="mt-5 mb-1 flex items-baseline justify-between text-[13px] font-bold">この豆の記録</h2>
      <LogTimeline items={logs} isPending={logsPending} error={logsError} onRetry={onRetryLogs} />
      <div className="mt-4">
        <AppButton onClick={onLogAgain} width={wide ? 'auto' : 'full'} className={wide ? 'px-7' : undefined}>
          この豆をもう一度記録する
        </AppButton>
      </div>
    </>
  );

  return (
    <div className={cn('pb-2', className)}>
      <div className="text-muted-foreground flex items-center justify-between pt-3 pb-2.5 text-xs">
        <span>
          {crumb ?? (
            <>
              <Link href={routes.logs} className="text-muted-foreground">
                入力記録一覧
              </Link>{' '}
              › 豆
            </>
          )}
        </span>
        {editHref && (
          <Link href={editHref} className="text-primary font-medium">
            編集
          </Link>
        )}
      </div>

      {wide ? (
        <div className="grid grid-cols-[224px_1fr] items-start gap-9">
          <div>
            <CardImage
              src={imageSrc}
              beanName={name}
              roasterName={roasterName}
              country={country}
              size="full"
            />
            {radar}
          </div>
          <div>
            {header}
            {dataPart}
            {logsPart}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[104px_1fr] items-end gap-4">
            <CardImage src={imageSrc} beanName={name} roasterName={roasterName} country={country} size="md" />
            {header}
          </div>
          {dataPart}
          {radar}
          {logsPart}
        </>
      )}
    </div>
  );
}
