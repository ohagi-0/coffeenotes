'use client';

import { useEffect, useRef, useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { AppButton } from '@/components/app-button';
import { BeanSpecGrid, type SpecItem } from '@/components/beans/bean-spec-grid';
import { CardImage } from '@/components/beans/card-image';
import { LogTimeline } from '@/components/logs/log-timeline';
import { RatingStars } from '@/components/logs/rating-stars';
import type { TimelineItem } from '@/features/logs/presenters';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

export type LogDetailProps = {
  loggedOn: string;
  bean: {
    id: string;
    name: string;
    roasterName: string | null;
    country: string | null;
    process: string | null;
    imageSrc?: string | null;
  };
  place: 'shop' | 'home';
  shopName: string | null;
  shopId: string | null;
  brewMethod: string | null;
  /** 自宅のレシピ（Phase 4 まで大半は null） */
  recipe?: SpecItem[];
  rating: number | null;
  memo: string | null;
  tags: string[];
  /** 同じ豆のほかの記録（この記録は除く） */
  others: TimelineItem[];
  othersPending: boolean;
  othersError: Error | null;
  editHref?: Route;
  onDelete: () => Promise<void> | void;
  deleting?: boolean;
  className?: string;
};

// 記録詳細（S5、DESIGN.md §5）。props 駆動。削除は破壊ボタン + 確認ダイアログ（何が消えて何が残るか）。
export function LogDetail({
  loggedOn,
  bean,
  place,
  shopName,
  shopId,
  brewMethod,
  recipe = [],
  rating,
  memo,
  tags,
  others,
  othersPending,
  othersError,
  editHref,
  onDelete,
  deleting,
  className,
}: LogDetailProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (confirming && !d.open) d.showModal();
    if (!confirming && d.open) d.close();
  }, [confirming]);

  const date = parseISO(loggedOn);
  const dateLabel = format(date, 'yyyy年M月d日（E）', { locale: ja });
  const spec: SpecItem[] = [
    { label: '場所', value: place === 'home' ? '自宅' : (shopName ?? '店（未設定）'), ja: true },
    { label: '飲み方', value: brewMethod, ja: true },
    ...recipe,
  ];

  return (
    <div className={cn('pb-2', className)}>
      <div className="text-muted-foreground flex items-center justify-between pt-3 pb-2.5 text-xs">
        <span>
          <Link href={routes.logs} className="text-muted-foreground">
            入力記録一覧
          </Link>{' '}
          › {format(date, 'M月d日', { locale: ja })}
        </span>
        {editHref && (
          <Link href={editHref} className="text-primary font-medium">
            編集
          </Link>
        )}
      </div>

      <p className="text-muted-foreground font-num text-xs">
        <time dateTime={loggedOn}>{dateLabel}</time>
      </p>

      <div className="mt-2 grid grid-cols-[62px_1fr] items-start gap-3.5">
        <CardImage
          src={bean.imageSrc}
          beanName={bean.name}
          roasterName={bean.roasterName}
          country={bean.country}
          size="sm"
        />
        <div className="min-w-0">
          <p className="font-display text-[21px] leading-[1.05] break-words">{bean.name}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {[bean.roasterName, bean.country, bean.process].filter(Boolean).join(' · ')}
          </p>
          <Link
            href={routes.bean(bean.id) as Route}
            className="text-primary mt-1.5 inline-block text-[13px] font-medium"
          >
            豆の詳細を見る
          </Link>
        </div>
      </div>

      <BeanSpecGrid items={spec} className="mt-3.5" />
      {place === 'shop' && shopId && (
        <Link
          href={routes.shop(shopId) as Route}
          className="text-primary mt-2 inline-block text-[13px] font-medium"
        >
          店の詳細を見る
        </Link>
      )}

      <div className="mt-4 flex flex-col gap-1">
        <span className="text-muted-foreground text-[11px]">評価</span>
        <RatingStars value={rating} size="lg" />
      </div>

      {memo && (
        <div className="mt-4 flex flex-col gap-1">
          <span className="text-muted-foreground text-[11px]">メモ</span>
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{memo}</p>
        </div>
      )}

      {tags.length > 0 && (
        <div className="mt-4 flex flex-col gap-1">
          <span className="text-muted-foreground text-[11px]">タグ</span>
          <ul className="flex flex-wrap gap-1.5" aria-label="タグ">
            {tags.map((t) => (
              <li key={t} className="bg-secondary rounded-[5px] px-2 text-[12px] leading-[1.9]">
                #{t}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mt-6 mb-1 text-[13px] font-bold">同じ豆のほかの記録</h2>
      {!othersPending && !othersError && others.length === 0 ? (
        <p className="text-muted-foreground py-3 text-sm">この豆の記録はこれだけです。</p>
      ) : (
        <LogTimeline items={others} isPending={othersPending} error={othersError} />
      )}

      <div className="mt-8">
        <AppButton variant="destructive" onClick={() => setConfirming(true)} disabled={deleting}>
          この記録を削除
        </AppButton>
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setConfirming(false)}
        aria-labelledby="log-delete-title"
        className="bg-background text-foreground border-border m-auto w-[calc(100%-40px)] max-w-sm rounded-[18px] border p-5 backdrop:bg-black/55"
      >
        <p id="log-delete-title" className="text-base font-bold">
          この記録を削除しますか？
        </p>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          {dateLabel} の記録が消えます。豆「{bean.name}」の情報とカード画像は残ります。元に戻せません。
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <AppButton
            variant="destructive"
            size="md"
            loading={deleting}
            onClick={async () => {
              await onDelete();
              setConfirming(false);
            }}
          >
            記録を削除
          </AppButton>
          <AppButton variant="ghost" size="md" onClick={() => setConfirming(false)}>
            やめる
          </AppButton>
        </div>
      </dialog>
    </div>
  );
}
