'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { BEANS_PATTERN_SIZE, BEANS_PATTERN_URL } from '@/components/beans/bean-window';
import type { CollectionItem } from '@/features/beans/collection';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { countryEnglishName } from '@/lib/vocab';

// 棚に並ぶ「豆の袋」（DESIGN.md S10。2026-10-20 に窓付きのチャック袋へ作り替え。docs/design/bags.html 案 2-B）。
// 明るいクラフト紙のスタンドパック: 上にチャック、左右に側面の折りの陰影、底に影。中央の透明な窓から焙煎豆が見える。
// 窓の上に白い正方形のラベル: ロースター（小さな大文字）→ カップの印 → 筆記体の豆名 → 罫 → 産地 · 精製（小さな大文字）→ 手書きの朱の星。
// 日付は窓の下にクラフト紙へ印字。杯数は 2 杯以上のときだけ、右上に赤い丸シール「×N」。写真は使わない。押すと豆の詳細へ。

export type BeanBagProps = {
  item: CollectionItem;
  className?: string;
};

/** 筆記体で 3 行に収まらない長さの目安。これを超える豆名は 1 段小さく出す */
const LONG_NAME = 24;

/** 朱（ペンで書いた星）。装飾色なので DESIGN.md の銅・錆とは混ぜない */
const INK_RED = '#B8412E';

const KRAFT =
  'linear-gradient(90deg, rgba(0,0,0,.22) 0, rgba(0,0,0,.04) 8%, rgba(255,255,255,.08) 14%, rgba(255,255,255,0) 28%, rgba(255,255,255,0) 72%, rgba(255,255,255,.06) 86%, rgba(0,0,0,.05) 92%, rgba(0,0,0,.26) 100%), ' +
  'repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 4px), ' +
  'linear-gradient(175deg, #D6BB95 0%, #C7A982 50%, #B5946E 100%)';

function CupMark() {
  return (
    <svg className="mt-[3px] mb-[2px] h-[10px] w-[13px] opacity-85" viewBox="0 0 24 18" aria-hidden>
      <path d="M3 3h13v7a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z" fill="#2A2118" />
      <path d="M16 5h2.5a2.5 2.5 0 0 1 0 5H16" fill="none" stroke="#2A2118" strokeWidth="1.6" />
      <path d="M2 17h17" stroke="#2A2118" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function BeanBag({ item, className }: BeanBagProps) {
  const date = format(parseISO(item.lastLoggedOn), 'yyyy.MM.dd');
  // ラベルの産地は英字の大文字で（白いラベルの作法）。英名が分からない国は打ったまま
  const origin = [countryEnglishName(item.country) ?? item.country, item.process].filter(Boolean).join(' · ');
  const long = item.name.length > LONG_NAME;
  return (
    <Link
      href={routes.bean(item.beanId) as Route}
      aria-label={`${item.name} の袋`}
      className={cn(
        'group focus-visible:outline-primary relative flex aspect-[3/4.3] flex-col items-center rounded-[5px_5px_14px_14px] px-[8%] transition-transform outline-none hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4',
        'shadow-[0_16px_24px_-14px_rgba(0,0,0,.95),inset_0_-10px_14px_-10px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.2)]',
        className,
      )}
      style={{ backgroundImage: KRAFT }}
    >
      {/* チャック */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-[11px] h-[5px] border-t border-b border-t-black/25 border-b-white/20 bg-black/5"
      />
      {/* 底の影（立っている袋） */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[6%] bottom-0 h-[9px] rounded-b-[12px] bg-gradient-to-b from-transparent to-black/35"
      />

      {/* 窓: 中の焙煎豆 */}
      <span
        aria-hidden
        className="absolute inset-x-[12%] top-[20%] bottom-[15%] rounded-[4px] shadow-[inset_0_0_0_2px_rgba(255,255,255,.35),inset_0_10px_18px_rgba(0,0,0,.45),0_0_0_1px_rgba(0,0,0,.18)]"
        style={{
          backgroundColor: '#1E1008',
          backgroundImage: `url("${BEANS_PATTERN_URL}")`,
          backgroundSize: BEANS_PATTERN_SIZE,
        }}
      >
        {/* 窓のフィルムの反射 */}
        <span
          className="absolute inset-0 rounded-[4px]"
          style={{
            background:
              'linear-gradient(115deg, rgba(255,255,255,.22) 0, rgba(255,255,255,.05) 35%, rgba(255,255,255,0) 60%, rgba(255,255,255,.08) 100%)',
          }}
        />
      </span>

      {/* 白いラベル */}
      <span className="relative z-10 mt-[34%] flex w-[64%] min-w-0 flex-col items-center bg-[#FBF8F2] px-[6px] py-[7px] text-center text-[#2A2118] shadow-[0_2px_4px_rgba(0,0,0,.35)]">
        <span className="font-num line-clamp-2 w-full text-[6px] leading-[1.4] font-semibold tracking-[.16em] break-words text-[#6B5B4B] uppercase">
          {item.roasterName ?? 'Coffeenotes'}
        </span>
        <CupMark />
        <span
          className={cn(
            'font-script line-clamp-3 w-full leading-[1.08] break-words text-[#1F1812]',
            long ? 'text-[12px]' : 'text-[14.5px]',
          )}
        >
          {item.name}
        </span>
        <span aria-hidden className="mt-[4px] mb-[3px] h-px w-[56%] bg-[#2A2118]/35" />
        {origin && (
          <span className="font-num line-clamp-2 w-full text-[6px] leading-[1.5] font-medium tracking-[.12em] break-words text-[#6B5B4B] uppercase">
            {origin}
          </span>
        )}
        <span
          className={cn(
            'font-script mt-[3px] -mr-[2px] -mb-[3px] -rotate-6 self-end leading-none whitespace-nowrap',
            item.avgRating !== null ? 'text-[12.3px]' : 'text-[10px] text-[#B9AE9C]',
          )}
          style={item.avgRating !== null ? { color: INK_RED } : undefined}
          aria-label={item.avgRating !== null ? `平均 ${item.avgRating.toFixed(1)} 星` : '星なし'}
        >
          {item.avgRating !== null ? `★ ${item.avgRating.toFixed(1)}` : '—'}
        </span>
      </span>

      {/* 日付（窓の下の紙に印字） */}
      <span
        className="font-num absolute inset-x-0 bottom-[5%] text-center text-[7px] leading-none font-semibold tracking-[.14em] whitespace-nowrap"
        style={{ color: 'rgba(40,28,18,.7)' }}
      >
        {date}
      </span>

      {/* 杯数のシール（2 杯以上のときだけ） */}
      {item.count >= 2 && (
        <span
          className="font-num absolute top-[14%] right-[6%] z-20 grid size-6 -rotate-12 place-items-center rounded-full text-[9px] leading-none font-extrabold shadow-[0_1px_2px_rgba(0,0,0,.35)]"
          style={{ background: INK_RED, color: '#FBF8F2' }}
          aria-label={`${item.count} 杯`}
        >
          ×{item.count}
        </span>
      )}
    </Link>
  );
}

export type BeanBagEmptyProps = {
  /** 棚の名前（国名など）。「まだ飲んでいません」の下に出す */
  label: string;
  sub?: string | null;
  className?: string;
};

/** まだ飲んでいない棚の空き（点線の袋の輪郭）。コレクションの「まだ埋まっていない枠」 */
export function BeanBagEmpty({ label, sub, className }: BeanBagEmptyProps) {
  return (
    <span
      role="img"
      aria-label={`${label} はまだ飲んでいません`}
      className={cn(
        'border-border/80 text-muted-foreground flex aspect-[3/4.3] flex-col items-center justify-center gap-1 rounded-[5px_5px_14px_14px] border border-dashed px-3 text-center',
        className,
      )}
    >
      <span className="font-display text-foreground/70 text-[15px] leading-tight">{label}</span>
      {sub && <span className="font-num text-[9px] tracking-[.18em] uppercase">{sub}</span>}
      <span className="mt-2 text-[10px]">まだ飲んでいません</span>
    </span>
  );
}
