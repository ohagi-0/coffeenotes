'use client';

import { useMemo, useState } from 'react';
import { COUNTRY_SHELVES } from '@/lib/vocab';
import { cn } from '@/lib/utils';
import { COFFEE_BELT, HAWAII_POINT, WORLD_COUNTRIES, WORLD_WIDTH } from './world-map-data';

// 飲んだ産地の地図（S10「産地の地図」、2026-10-21。docs/design/world.html、ADR 0012）。
// 飲んだ国を銅で塗り、杯数で 3 段階に濃くする（1 杯 / 2〜4 杯 / 5 杯以上）。コーヒーベルト（北緯・南緯 25 度）を点線で。
// 既定はベルトに寄せた表示（北緯 40 度〜南緯 40 度あたり）。国を押すと onSelect（塗られた国 → 棚へ、塗られていない国 → 出口）。
// ジャマイカは小さく、ハワイは米国の一部なので、どちらも点で出す。

const FILL = ['#6E4A2E', '#A5683A', '#D48C4E'] as const;
export const MAP_LEGEND = [
  { color: FILL[0], label: '1 杯' },
  { color: FILL[1], label: '2〜4 杯' },
  { color: FILL[2], label: '5 杯〜' },
] as const;

function level(cups: number): 0 | 1 | 2 {
  return cups >= 5 ? 2 : cups >= 2 ? 1 : 0;
}

const keyByIso = new Map<number, string>();
for (const c of COUNTRY_SHELVES) if (c.iso !== undefined) keyByIso.set(c.iso, c.key);
const jamaicaCenter = WORLD_COUNTRIES.find((c) => c.iso === 388)?.c;

export type WorldMapProps = {
  /** 国のキー → 杯数 */
  cups: ReadonlyMap<string, number>;
  /** 押した国（語彙の key。塗りのある国も無い国も） */
  onSelect?: (key: string) => void;
  selected?: string | null;
  /** 全体を見せる（既定はコーヒーベルトに寄せる） */
  wide?: boolean;
  className?: string;
};

export function WorldMap({ cups, onSelect, selected, wide, className }: WorldMapProps) {
  const [hover, setHover] = useState<string | null>(null);
  const visited = useMemo(() => Array.from(cups.keys()).filter((k) => cups.get(k)! > 0), [cups]);
  const viewBox = wide ? `0 0 ${WORLD_WIDTH} 480` : `0 100 ${WORLD_WIDTH} 280`;
  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={`飲んだ産地の地図。${visited.length} か国`}
      className={cn('block w-full bg-[#120E0B]', className)}
    >
      {WORLD_COUNTRIES.map((c) => {
        const key = keyByIso.get(c.iso) ?? null;
        const n = key ? (cups.get(key) ?? 0) : 0;
        const active = key !== null && (key === selected || key === hover);
        return (
          <path
            key={c.iso}
            d={c.d}
            fill={n > 0 ? FILL[level(n)] : '#241C16'}
            stroke={active ? '#F0B57A' : '#3B2F26'}
            strokeWidth={active ? 1.4 : 0.6}
            vectorEffect="non-scaling-stroke"
            className={key && onSelect ? 'cursor-pointer' : undefined}
            onClick={key && onSelect ? () => onSelect(key) : undefined}
            onPointerEnter={key ? () => setHover(key) : undefined}
            onPointerLeave={key ? () => setHover(null) : undefined}
            aria-label={key ? COUNTRY_SHELVES.find((s) => s.key === key)?.ja : undefined}
          />
        );
      })}
      {COFFEE_BELT.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="rgba(212,140,78,.3)"
          strokeWidth={1}
          strokeDasharray="3 4"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {jamaicaCenter && (cups.get('jamaica') ?? 0) > 0 && (
        <circle cx={jamaicaCenter[0]} cy={jamaicaCenter[1]} r={3} fill={FILL[level(cups.get('jamaica')!)]} />
      )}
      {(cups.get('hawaii') ?? 0) > 0 && (
        <circle cx={HAWAII_POINT[0]} cy={HAWAII_POINT[1]} r={3} fill={FILL[level(cups.get('hawaii')!)]} />
      )}
    </svg>
  );
}
