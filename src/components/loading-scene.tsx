'use client';

import { useId } from 'react';
import styles from './loading-scene.module.css';

// 読み込み中の小さな動き（DESIGN.md §4、2026-10-20。モックは docs/design/loading.html）。
// 3 つの所作から 1 つを出す: ハンドドリップ（ケトルを「の」の字に回しながら注ぐ）/ 手網の焙煎 / 手挽きミル。
// 形は定番の道具に寄せる（円すい型ドリッパー + ガラスサーバー + 電気ケトル、手網、縦長の手挽きミル）。ロゴは付けない。
// 色は銅（--primary）と生成り（--foreground）の線だけ。動きは CSS（loading-scene.module.css）。

export type LoadingSceneKind = 'drip' | 'roast' | 'grind';

export const LOADING_SCENES: readonly LoadingSceneKind[] = ['drip', 'roast', 'grind'];

/** 所作ごとの文言。読み上げは共通の「読み込み中」（role="status" の aria-label 側） */
export const LOADING_SCENE_LABELS: Record<LoadingSceneKind, string> = {
  drip: 'お湯を注いでいます…',
  roast: '豆を煎っています…',
  grind: '豆を挽いています…',
};

/** ランダムに 1 つ選ぶ（テストから差し替えられるように乱数を引数に） */
export function pickLoadingScene(random: () => number = Math.random): LoadingSceneKind {
  const i = Math.min(LOADING_SCENES.length - 1, Math.floor(random() * LOADING_SCENES.length));
  return LOADING_SCENES[i]!;
}

const CU = 'var(--primary)';
const INK = 'var(--foreground)';
const MUTE = 'var(--muted-foreground)';
const COFFEE = '#A8683A';

const common = {
  viewBox: '0 0 160 160',
  fill: 'none',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function DripScene() {
  const id = useId();
  const clip = `${id}-server`;
  const server = 'M61 116c-10 4-19 12-19 22v8a4 4 0 0 0 4 4h48a4 4 0 0 0 4-4v-8c0-10-9-18-19-22';
  return (
    <svg {...common} className={styles.svg}>
      <defs>
        <clipPath id={clip}>
          <path d={`${server}z`} />
        </clipPath>
      </defs>
      {/* ガラスサーバー（丸い胴、首の帯、横に取っ手） */}
      <g stroke={INK} strokeWidth={1.4}>
        <path d={server} />
        <path d="M98 124c8 1 8 13 0 14" />
      </g>
      <path d="M60 113h20" stroke={INK} strokeWidth={3.2} />
      <g clipPath={`url(#${clip})`}>
        <rect className={styles.level} x="40" y="120" width="60" height="30" fill={COFFEE} opacity={0.85} />
      </g>
      <ellipse
        className={`${styles.meniscus} ${styles.self}`}
        cx="70"
        cy="146"
        rx="22"
        ry="2.2"
        stroke={CU}
        strokeWidth={1.2}
        opacity={0.9}
      />
      {/* 円すい型ドリッパー（らせんのリブ、太い縁、底のリング） */}
      <g stroke={INK}>
        <path d="M44 72h52" strokeWidth={2.6} />
        <path d="M48 74l18 30h8l18-30" />
        <path d="M62 106h16" strokeWidth={1.4} />
        <path d="M66 108h8" strokeWidth={1.4} />
      </g>
      <g stroke={MUTE} strokeWidth={1.4}>
        <path d="M58 78c4 6 6 12 7 18M70 77v20M82 78c-4 6-6 12-7 18" />
      </g>
      {/* 滴 */}
      <g className={styles.dropGate} fill={COFFEE}>
        <ellipse className={`${styles.drop} ${styles.self}`} cx="70" cy="110" rx="1.5" ry="2" />
        <ellipse
          className={`${styles.drop} ${styles.drop2} ${styles.self}`}
          cx="70"
          cy="110"
          rx="1.5"
          ry="2"
        />
        <ellipse
          className={`${styles.drop} ${styles.drop3} ${styles.self}`}
          cx="70"
          cy="110"
          rx="1.5"
          ry="2"
        />
      </g>
      {/* ケトル（入ってくる / 引く）の中で、「の」の字に回る */}
      <g className={styles.kettle}>
        <g className={styles.circle}>
          <path className={styles.stream} d="M76 56c-2 10-4 18-5 30" stroke={CU} />
          <path
            className={styles.stream}
            d="M76 56c-2 10-4 18-5 30"
            stroke={INK}
            strokeWidth={0.7}
            opacity={0.6}
          />
          <g stroke={CU}>
            <path d="M104 36l28-6 8 32-32 8z" />
            <path d="M104 36l28-6" strokeWidth={2.6} />
            <path d="M117 33l-1-5" strokeWidth={1.4} />
            <circle cx="115.5" cy="27" r="1.6" fill={CU} />
            <path d="M132 30c12 2 20 14 12 26" strokeWidth={2.6} />
            <path d="M106 62c-12-2-24-4-30-6" strokeWidth={2.6} />
            <path d="M76 56c-2 0-3 .4-4 1" strokeWidth={1.4} />
          </g>
        </g>
      </g>
    </svg>
  );
}

function RoastScene() {
  const id = useId();
  const clip = `${id}-net`;
  const mesh = `${id}-mesh`;
  const beans = [
    [48, 84],
    [58, 86],
    [68, 84],
    [78, 86],
    [88, 84],
    [63, 79],
    [83, 79],
  ] as const;
  const beanClass = [
    styles.bean,
    `${styles.bean} ${styles.bean2}`,
    `${styles.bean} ${styles.bean3}`,
    `${styles.bean} ${styles.bean4}`,
    `${styles.bean} ${styles.bean5}`,
    `${styles.bean} ${styles.bean6}`,
    `${styles.bean} ${styles.bean7}`,
  ];
  return (
    <svg {...common} className={styles.svg}>
      <defs>
        <clipPath id={clip}>
          <rect x="38" y="60" width="64" height="30" rx="4" />
        </clipPath>
        <pattern id={mesh} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 3h6M3 0v6" stroke={MUTE} strokeWidth={0.6} />
        </pattern>
      </defs>
      <g className={styles.net}>
        {/* 手網（金網のかご + 長い柄） */}
        <rect x="38" y="60" width="64" height="30" rx="4" fill={`url(#${mesh})`} />
        <rect x="38" y="60" width="64" height="30" rx="4" stroke={INK} />
        <path d="M102 66l40 8M102 84l40-8" stroke={INK} strokeWidth={1.4} />
        <path d="M140 70v8" stroke={INK} strokeWidth={3} />
        <g clipPath={`url(#${clip})`} stroke="#2A150A" strokeWidth={1}>
          {beans.map(([cx, cy], i) => (
            <ellipse key={i} className={beanClass[i]} cx={cx} cy={cy} rx="5.5" ry="3.6" />
          ))}
        </g>
        <g fill="#C9B16A" stroke="none">
          <path className={`${styles.chaff} ${styles.self}`} d="M60 58l3 1-2 2z" />
          <path className={`${styles.chaff} ${styles.chaff2} ${styles.self}`} d="M84 58l3 1-2 2z" />
        </g>
      </g>
      {/* ガスの火（五徳と炎） */}
      <g stroke={CU} strokeWidth={1.8}>
        <path className={styles.flame} d="M52 122c-4-6 0-10 2-14 2 4 6 8 2 14" />
        <path className={`${styles.flame} ${styles.flame2}`} d="M64 124c-5-7 0-12 2-16 2 5 7 9 2 16" />
        <path className={`${styles.flame} ${styles.flame3}`} d="M78 124c-5-7 0-12 2-16 2 5 7 9 2 16" />
        <path className={`${styles.flame} ${styles.flame4}`} d="M92 122c-4-6 0-10 2-14 2 4 6 8 2 14" />
        <path d="M40 126h64" strokeWidth={1.4} />
        <path d="M46 102h52" strokeWidth={1.4} stroke={MUTE} />
      </g>
      <g stroke={MUTE} strokeWidth={1.4}>
        <path className={styles.smoke} d="M62 52c-3-4 3-7 0-11" />
        <path className={`${styles.smoke} ${styles.smoke2}`} d="M80 50c-3-4 3-7 0-11" />
      </g>
    </svg>
  );
}

function GrindScene() {
  const id = useId();
  const clip = `${id}-jar`;
  const jar = 'M64 96h32v24a8 8 0 0 1-8 8H72a8 8 0 0 1-8-8z';
  return (
    <svg {...common} className={styles.svg}>
      <defs>
        <clipPath id={clip}>
          <path d={jar} />
        </clipPath>
      </defs>
      <g className={styles.mill}>
        {/* 筒（木目の胴、上に金属の蓋、下に金属のリング） */}
        <path d="M64 40h32v50H64z" stroke={INK} />
        <ellipse cx="80" cy="40" rx="16" ry="4" stroke={INK} />
        <path d="M70 46v40M90 46v40" stroke={MUTE} strokeWidth={1.4} />
        <path d="M64 86h32" stroke={INK} strokeWidth={1.4} />
        {/* ガラスの受け */}
        <path d={jar} stroke={INK} strokeWidth={1.4} />
        <path d="M62 94h36" stroke={INK} strokeWidth={2.6} />
        <g fill={COFFEE} stroke="none">
          <circle className={`${styles.grain} ${styles.self}`} cx="77" cy="98" r="1.3" />
          <circle className={`${styles.grain} ${styles.grain2} ${styles.self}`} cx="81" cy="98" r="1.3" />
          <circle className={`${styles.grain} ${styles.grain3} ${styles.self}`} cx="84" cy="98" r="1.3" />
          <circle className={`${styles.grain} ${styles.grain4} ${styles.self}`} cx="79" cy="98" r="1.3" />
        </g>
        <g clipPath={`url(#${clip})`}>
          <path className={styles.pile} d="M64 128c4-9 9-13 16-13s12 4 16 13z" fill={COFFEE} opacity={0.9} />
        </g>
      </g>
      {/* クランク（上から見た楕円の軌道。先に木の握り） */}
      <path d="M80 36v-6" stroke={CU} strokeWidth={2.4} />
      <g transform="translate(80 30) scale(1 .38) translate(-80 -30)">
        <g className={styles.crank} stroke={CU}>
          <path d="M80 30h40" strokeWidth={2.4} />
          <ellipse cx="124" cy="30" rx="4" ry="6" fill="#6B4A30" />
        </g>
      </g>
    </svg>
  );
}

export function LoadingScene({ kind }: { kind: LoadingSceneKind }) {
  if (kind === 'roast') return <RoastScene />;
  if (kind === 'grind') return <GrindScene />;
  return <DripScene />;
}
