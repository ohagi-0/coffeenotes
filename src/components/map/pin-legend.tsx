import { PIN_COLORS, PIN_LEGEND } from '@/features/shops/map-pins';

/** 星色の凡例（S7）。地図の下に小さく出す */
export function PinLegend({ className }: { className?: string }) {
  return (
    <ul
      className={className}
      aria-label="ピンの色"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}
    >
      {PIN_LEGEND.map(({ tier, label }) => (
        <li key={tier} className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-full"
            style={{ background: PIN_COLORS[tier] }}
          />
          {label}
        </li>
      ))}
    </ul>
  );
}
