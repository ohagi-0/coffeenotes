'use client';

import { type Farm, type FarmTree, cupsToNextStage, TREE_STAGE_LABELS } from '@/features/beans/farm';
import { cn } from '@/lib/utils';
import styles from './coffee-farm.module.css';

// コーヒーの木と農園の絵（S10、2026-10-21。docs/design/room.html、ADR 0012）。
// 木は SVG を手続きで描く（位置・葉の数は杯数と並び順から決まり、同じ記録なら同じ絵）。画像は持たない。
// 緑は木にだけ使う。線は銅（#D48C4E）、花は生成り、実は朱（袋の星と同じ #B8412E）。
// 1〜2 本は鉢植え、3〜7 本は畑、8 本からは丘の農園（小屋が建つ）。

const GREENS = ['#4E6B3A', '#5F7F45', '#6B8A4A', '#7A9A55'] as const;
const TRUNK = '#6E4A2E';
const COPPER = '#D48C4E';
const FLOWER = '#F1E8DA';
const CHERRY = '#B8412E';
const W = 375;
const H = 300;

/** 決定的な疑似乱数（同じ木は何度描いても同じ形） */
function rnd(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const HEIGHT = [0, 30, 54, 74, 94] as const;
const WIDTH = [0, 18, 34, 50, 62] as const;
const LEAVES = [0, 5, 12, 22, 32] as const;

function Tree({
  x,
  ground,
  tree,
  seed,
  scale,
}: {
  x: number;
  ground: number;
  tree: FarmTree;
  seed: number;
  scale: number;
}) {
  const r = rnd(seed);
  const st = tree.stage;
  const h = HEIGHT[st] * scale;
  const w = WIDTH[st] * scale;
  const branches = Array.from({ length: st }, (_, i) => {
    const by = ground - h * (0.45 + i * 0.14);
    const dir = i % 2 ? 1 : -1;
    return `M${x} ${by} q${dir * w * 0.25} -${h * 0.06} ${dir * w * 0.42} -${h * 0.14}`;
  });
  const leaves = Array.from({ length: LEAVES[st] }, () => ({
    cy: ground - h * (0.35 + r() * 0.65),
    cx: x + (r() - 0.5) * w,
    rx: (4 + r() * 5) * scale,
    ry: (2.6 + r() * 3) * scale,
    ang: (r() - 0.5) * 80,
    fill: GREENS[Math.floor(r() * GREENS.length)]!,
  }));
  const cherries = Array.from({ length: tree.cherries }, () => ({
    cy: ground - h * (0.4 + r() * 0.5),
    cx: x + (r() - 0.5) * w * 0.8,
  }));
  const flowers =
    tree.flowering && st >= 2
      ? Array.from({ length: 3 + st }, () => ({
          cy: ground - h * (0.45 + r() * 0.45),
          cx: x + (r() - 0.5) * w * 0.9,
        }))
      : [];
  return (
    <g className={styles.tree}>
      <path
        d={`M${x} ${ground} C${x - 1} ${ground - h * 0.5} ${x + 1} ${ground - h * 0.7} ${x} ${ground - h}`}
        stroke={TRUNK}
        strokeWidth={1.2 + st * 0.5}
        fill="none"
        strokeLinecap="round"
      />
      {branches.map((d, i) => (
        <path key={i} d={d} stroke={TRUNK} strokeWidth={1} fill="none" strokeLinecap="round" />
      ))}
      {leaves.map((l, i) => (
        <ellipse
          key={i}
          cx={l.cx.toFixed(1)}
          cy={l.cy.toFixed(1)}
          rx={l.rx.toFixed(1)}
          ry={l.ry.toFixed(1)}
          fill={l.fill}
          transform={`rotate(${l.ang.toFixed(0)} ${l.cx.toFixed(1)} ${l.cy.toFixed(1)})`}
        />
      ))}
      {cherries.map((c, i) => (
        <circle
          key={i}
          cx={c.cx.toFixed(1)}
          cy={c.cy.toFixed(1)}
          r={(1.9 * scale).toFixed(1)}
          fill={CHERRY}
        />
      ))}
      {flowers.map((f, i) => (
        <g key={i}>
          <circle cx={f.cx.toFixed(1)} cy={f.cy.toFixed(1)} r={1.4} fill={FLOWER} />
          <circle cx={(f.cx + 1.8).toFixed(1)} cy={(f.cy - 1).toFixed(1)} r={1.1} fill={FLOWER} />
        </g>
      ))}
    </g>
  );
}

function Label({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      className="font-num"
      style={{ fontSize: 7, fontWeight: 600, letterSpacing: '.12em', fill: '#A39181' }}
    >
      {text}
    </text>
  );
}

function Pot({ x, y }: { x: number; y: number }) {
  return (
    <>
      <path d={`M${x - 14} ${y - 16}h28l-3 18h-22z`} fill="#8C5A3A" stroke={COPPER} strokeWidth={1} />
      <path d={`M${x - 16} ${y - 16}h32`} stroke={COPPER} strokeWidth={2} strokeLinecap="round" />
    </>
  );
}

function Shed({ x, y }: { x: number; y: number }) {
  return (
    <>
      <path d={`M${x - 16} ${y}v-16l16-10 16 10v16z`} fill="#2C231C" stroke={COPPER} strokeWidth={1} />
      <path
        d={`M${x - 20} ${y - 16}l20-13 20 13`}
        fill="none"
        stroke={COPPER}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <rect x={x - 4} y={y - 10} width={8} height={10} fill="#17120F" />
    </>
  );
}

/** 丘の農園の木の位置（9 本目からは前の列に詰める） */
const HILL_SPOTS: readonly [number, number][] = [
  [40, 222],
  [95, 214],
  [150, 226],
  [205, 212],
  [262, 224],
  [318, 214],
  [70, 258],
  [130, 262],
  [190, 262],
  [250, 262],
  [300, 258],
  [25, 250],
  [345, 250],
];

export type CoffeeFarmProps = {
  farm: Farm;
  className?: string;
};

/** 農園の絵。読み上げは 1 文（木の本数・段階・花） */
export function CoffeeFarm({ farm, className }: CoffeeFarmProps) {
  const { trees, scene } = farm;
  const first = trees[0];
  const description =
    trees.length === 0
      ? '最初の一杯で、苗が 1 本植わります'
      : `コーヒーの木 ${trees.length} 本。${first!.label} は${TREE_STAGE_LABELS[first!.stage]}${
          farm.flowering > 0 ? `、花が咲いている木が ${farm.flowering} 本` : ''
        }`;
  let body: React.ReactNode;
  if (scene === 'pot') {
    const xs = trees.length <= 1 ? [187] : [120, 255];
    body = (
      <>
        <path d={`M0 230h${W}`} stroke="#3B2F26" strokeWidth={1} />
        {trees.length === 0 && (
          <>
            <Pot x={187} y={232} />
            <Label x={187} y={252} text="まだ木がありません" />
          </>
        )}
        {trees.map((t, i) => {
          const next = cupsToNextStage(t.cups);
          return (
            <g key={t.key}>
              <Pot x={xs[i]!} y={232} />
              <Tree x={xs[i]!} ground={216} tree={t} seed={11 + i} scale={1.5} />
              <Label x={xs[i]!} y={252} text={t.label} />
              <Label
                x={xs[i]!}
                y={266}
                text={`${t.cups} 杯${next !== null ? ` · あと ${next} 杯で${TREE_STAGE_LABELS[(t.stage + 1) as 2 | 3 | 4]}` : ''}`}
              />
            </g>
          );
        })}
      </>
    );
  } else if (scene === 'field') {
    const n = trees.length;
    const xs = trees.map((_, i) => Math.round(((i + 0.5) / n) * (W - 40) + 20));
    body = (
      <>
        <path d={`M0 226 C100 216 240 232 ${W} 222 L${W} ${H} 0 ${H}Z`} fill="#1F1A14" />
        <path d={`M0 230h${W}`} stroke="#3B2F26" strokeWidth={1} />
        {trees.map((t, i) => (
          <g key={t.key}>
            <Tree x={xs[i]!} ground={228} tree={t} seed={20 + i} scale={n <= 4 ? 1.15 : 0.95} />
            <Label x={xs[i]!} y={250} text={t.label} />
          </g>
        ))}
      </>
    );
  } else {
    const shown = trees.slice(0, HILL_SPOTS.length);
    body = (
      <>
        <circle cx={320} cy={60} r={18} fill="none" stroke={COPPER} strokeWidth={1.2} opacity={0.7} />
        <circle cx={320} cy={60} r={10} fill={COPPER} opacity={0.35} />
        <path
          d={`M0 215 C60 190 120 205 190 196 C250 188 310 205 ${W} 192 L${W} ${H} 0 ${H}Z`}
          fill="#1F1A14"
        />
        <path
          d={`M0 240 C80 220 160 236 240 228 C300 222 340 232 ${W} 226 L${W} ${H} 0 ${H}Z`}
          fill="#26201A"
        />
        {shown.map((t, i) => {
          const [x, y] = HILL_SPOTS[i]!;
          return <Tree key={t.key} x={x} ground={y} tree={t} seed={30 + i} scale={y > 240 ? 1.05 : 0.9} />;
        })}
        <Shed x={345} y={282} />
        <Label
          x={187}
          y={292}
          text={`${trees.length} 本 · ${farm.totalCups} 杯${trees.length > shown.length ? `（${trees.length - shown.length} 本は丘の向こう）` : ''}`}
        />
      </>
    );
  }
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={description}
      className={cn('block w-full', className)}
      style={{ background: 'linear-gradient(180deg,#120E0B 0%,#1A1310 55%,#241A13 100%)' }}
    >
      {body}
    </svg>
  );
}
