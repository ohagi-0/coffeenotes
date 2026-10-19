'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// コレクションの棚 1 段（DESIGN.md S10。2026-10-20 に木の棚板 + 横スクロールへ。docs/design/bags.html 棚 A）。
// 袋は横一列に並べ、画面幅に入りきらない分は横にスクロールする（スマホは指で、PC は段の両端の「<」「>」で 1 袋ずつ）。
// 段の下に木の棚板（厚み 22px、前面に明るい縁、下に影）。板はスクロールせず、袋だけが滑る。
// 見える袋数: 375px で 2、md で 3、xl で 4。入りきらないときは袋を少し狭めて、次の袋の端が見えるようにする（続きがある合図）。

export type ShelfRowProps = {
  /** 段に並べる袋。`count` はその数（幅の計算に使う） */
  children: React.ReactNode;
  count: number;
  /** 棚の名前（矢印ボタンの読み上げ用） */
  label?: string;
  className?: string;
};

/** 木の棚板。前面に明るい縁、木目、下に影 */
export function WoodPlank({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative -mx-5 h-[22px] rounded-[2px] shadow-[0_10px_16px_-6px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.12)] md:-mx-8',
        className,
      )}
      style={{
        backgroundImage:
          'repeating-linear-gradient(90deg, rgba(0,0,0,.10) 0 1px, transparent 1px 7px, rgba(255,255,255,.05) 7px 8px, transparent 8px 23px), linear-gradient(180deg, #6B4A30 0%, #5A3D27 45%, #3E2919 100%)',
      }}
    >
      <span
        className="absolute inset-x-0 top-0 h-[5px] rounded-t-[2px] shadow-[0_1px_0_rgba(0,0,0,.4)]"
        style={{ background: 'linear-gradient(180deg, #9A7249, #7A5536)' }}
      />
    </div>
  );
}

export function ShelfRow({ children, count, label, className }: ShelfRowProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<{ overflow: boolean; atStart: boolean; atEnd: boolean }>({
    overflow: false,
    atStart: true,
    atEnd: true,
  });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge({ overflow: max > 4, atStart: el.scrollLeft <= 2, atEnd: el.scrollLeft >= max - 2 });
  }, []);

  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, [measure, count]);

  /** 1 袋ぶん滑らせる（袋の幅 + 間隔） */
  function slide(dir: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const step = first ? first.getBoundingClientRect().width + 16 : el.clientWidth / 2;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  }

  // 入りきらないときは袋を少し狭めて、次の袋の端を見せる
  const wide = count <= 2;
  const wideMd = count <= 3;
  const wideXl = count <= 4;

  return (
    <div className={cn('group/shelf relative', className)}>
      <div
        ref={scroller}
        className="relative z-10 -mx-5 flex snap-x snap-proximity [scrollbar-width:none] gap-4 overflow-x-auto px-5 pb-0 md:-mx-8 md:gap-5 md:px-8 [&::-webkit-scrollbar]:hidden"
        style={{ scrollPaddingInline: 20 }}
      >
        {Array.isArray(children)
          ? children.map((child, i) => (
              <div
                key={i}
                className={cn(
                  'flex-none snap-start',
                  wide ? 'w-[calc((100%-16px)/2)]' : 'w-[calc((100%-40px)/2)]',
                  wideMd ? 'md:w-[calc((100%-40px)/3)]' : 'md:w-[calc((100%-72px)/3)]',
                  wideXl ? 'xl:w-[calc((100%-60px)/4)]' : 'xl:w-[calc((100%-96px)/4)]',
                )}
              >
                {child}
              </div>
            ))
          : children}
      </div>
      <WoodPlank />

      {/* PC: 段の両端の矢印。入りきらないときだけ出す。端に着いたら薄くする */}
      {edge.overflow && (
        <div className="pointer-events-none absolute inset-x-0 top-[40%] z-20 hidden -translate-y-1/2 justify-between md:flex">
          <button
            type="button"
            onClick={() => slide(-1)}
            disabled={edge.atStart}
            aria-label={`${label ?? '棚'}を左へ`}
            className="border-border bg-background/85 text-foreground hover:text-primary pointer-events-auto ml-0 grid size-10 place-items-center rounded-full border shadow-[0_6px_14px_-4px_rgba(0,0,0,.8)] backdrop-blur transition-opacity disabled:opacity-25"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => slide(1)}
            disabled={edge.atEnd}
            aria-label={`${label ?? '棚'}を右へ`}
            className="border-border bg-background/85 text-foreground hover:text-primary pointer-events-auto mr-0 grid size-10 place-items-center rounded-full border shadow-[0_6px_14px_-4px_rgba(0,0,0,.8)] backdrop-blur transition-opacity disabled:opacity-25"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
