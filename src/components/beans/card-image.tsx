'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// カード画像（DESIGN.md §4）。3:4。src があれば画像（読み込み中はスケルトン）、
// 無ければ --card-paper 地にロースター・豆名・生産国を印刷物風（Helvetica）に描く。

export type CardImageSize = 'sm' | 'md' | 'full';

export type CardImageProps = {
  src?: string | null;
  beanName: string;
  roasterName?: string | null;
  country?: string | null;
  /** sm 62px / md 104px / full 親の幅 */
  size?: CardImageSize;
  alt?: string;
  className?: string;
};

// 幅と、プレースホルダの文字の基準サイズ（モックは 62px 幅で 11px、2 列で 16px）
const SIZE_CLASS: Record<CardImageSize, string> = {
  sm: 'w-[62px] text-[11px]',
  md: 'w-[104px] text-[12px]',
  full: 'w-full text-[16px]',
};

const PRINT_FONT = { fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' } as const;

export function CardImage({
  src,
  beanName,
  roasterName,
  country,
  size = 'sm',
  alt,
  className,
}: CardImageProps) {
  const [loaded, setLoaded] = useState(false);
  const frame = cn(
    'relative aspect-[3/4] shrink-0 overflow-hidden rounded-[5px]',
    SIZE_CLASS[size],
    className,
  );

  if (src) {
    return (
      <div className={frame} data-card-image="photo">
        {!loaded && (
          <Skeleton className="bg-secondary absolute inset-0 rounded-none motion-reduce:animate-none" />
        )}
        <Image
          src={src}
          alt={alt ?? `${beanName} のカード`}
          fill
          sizes={size === 'full' ? '100vw' : size === 'md' ? '104px' : '62px'}
          className={cn('object-cover transition-opacity', loaded ? 'opacity-100' : 'opacity-0')}
          onLoad={() => setLoaded(true)}
        />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={alt ?? `${beanName} のカード（画像なし）`}
      data-card-image="placeholder"
      className={cn(
        frame,
        'bg-card-paper text-card-ink flex flex-col px-[10%] py-[9%] shadow-[inset_0_0_0_1px_rgba(0,0,0,.06)]',
      )}
      style={PRINT_FONT}
    >
      {roasterName && (
        <span className="text-[0.5em] leading-none font-bold tracking-[.14em] uppercase">{roasterName}</span>
      )}
      <span className="mt-auto line-clamp-3 text-[1em] leading-[1.05] font-bold tracking-[-.02em] break-words">
        {beanName}
      </span>
      {country && <span className="text-card-ink/60 mt-[.25em] text-[0.5em] leading-none">{country}</span>}
    </div>
  );
}
