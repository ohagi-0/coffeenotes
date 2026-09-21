import { cn } from '@/lib/utils';
import { TASTE_AXES, type TasteValues } from './taste-dots';

// 味覚レーダー（DESIGN.md §4、F-BEAN-10 / F-STAT-3）。SVG 200×190、中心 (100,100)、半径 80。
// 値のポリゴンは塗り銅 28%・線 2px、頂点に 3px の円。compare（全体平均など）は --mute の点線で重ねる。
// null の軸は 0 として描き、ラベルには — を出す。左右のラベルは viewBox の外に出るので overflow は visible にする。

const CX = 100;
const CY = 100;
const R = 80;
const GRID_STEPS = [1, 0.8, 0.6, 0.4, 0.2];

// ラベルの位置と寄せ（モック docs/design/mobile.html の値）
const LABEL_POS: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }[] = [
  { x: 100, y: 11, anchor: 'middle' },
  { x: 181, y: 72, anchor: 'start' },
  { x: 150, y: 180, anchor: 'middle' },
  { x: 50, y: 180, anchor: 'middle' },
  { x: 19, y: 72, anchor: 'end' },
];

/** 軸 i（0〜4、上から時計回り）の値 v（0〜5）の座標。 */
export function radarPoint(index: number, score: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / TASTE_AXES.length;
  const r = (R * Math.min(5, Math.max(0, score))) / 5;
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
}

const fmt = (n: number) => Math.round(n * 10) / 10;

/** SVG の points 属性用。null は 0。 */
export function radarPoints(values: TasteValues): string {
  return TASTE_AXES.map((axis, i) => {
    const p = radarPoint(i, values[axis.key] ?? 0);
    return `${fmt(p.x)},${fmt(p.y)}`;
  }).join(' ');
}

/** 軸ラベルの文字。整数はそのまま、平均などの小数は 1 桁。 */
function labelValue(v: number | null): string {
  if (v === null) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export type TasteRadarProps = {
  value: TasteValues;
  /** 重ねる比較値（統計の全体平均など）。点線で描く */
  compare?: TasteValues;
  className?: string;
  'aria-label'?: string;
};

export function TasteRadar({ value, compare, className, 'aria-label': ariaLabel }: TasteRadarProps) {
  const outline = radarPoints({ flavor: 5, sweetness: 5, acidity: 5, aftertaste: 5, body: 5 });
  const description = TASTE_AXES.map((a) => `${a.label} ${labelValue(value[a.key])}`).join(', ');

  return (
    <svg
      viewBox="0 0 200 190"
      role="img"
      aria-label={ariaLabel ?? `味覚チャート: ${description}`}
      className={cn('mx-auto block w-full max-w-[230px] overflow-visible', className)}
    >
      {/* 5 段のグリッド */}
      <g className="stroke-border fill-none" strokeWidth={1}>
        {GRID_STEPS.map((s) => (
          <polygon
            key={s}
            points={outline}
            transform={s === 1 ? undefined : `translate(${CX} ${CY}) scale(${s}) translate(${-CX} ${-CY})`}
          />
        ))}
      </g>
      {/* 軸 */}
      <g className="stroke-border" strokeWidth={1}>
        {TASTE_AXES.map((axis, i) => {
          const p = radarPoint(i, 5);
          return <line key={axis.key} x1={CX} y1={CY} x2={fmt(p.x)} y2={fmt(p.y)} />;
        })}
      </g>
      {/* 比較値（点線） */}
      {compare && (
        <polygon
          data-role="compare"
          points={radarPoints(compare)}
          className="stroke-muted-foreground fill-none"
          strokeWidth={1.2}
          strokeDasharray="3 3"
        />
      )}
      {/* 値 */}
      <polygon
        data-role="value"
        points={radarPoints(value)}
        className="fill-primary/28 stroke-primary"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {TASTE_AXES.map((axis, i) => {
        const p = radarPoint(i, value[axis.key] ?? 0);
        return <circle key={axis.key} cx={fmt(p.x)} cy={fmt(p.y)} r={3} className="fill-primary" />;
      })}
      {/* ラベル */}
      {TASTE_AXES.map((axis, i) => (
        <text
          key={axis.key}
          x={LABEL_POS[i].x}
          y={LABEL_POS[i].y}
          textAnchor={LABEL_POS[i].anchor}
          className="font-num fill-muted-foreground text-[9.5px] font-medium"
        >
          {axis.short} {labelValue(value[axis.key])}
        </text>
      ))}
    </svg>
  );
}
