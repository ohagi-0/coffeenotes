// コーヒーの木と農園（S10、2026-10-21。docs/design/room.html、ADR 0012）。
// 飲んだ産地ごとに木が 1 本植わり、その国の杯数で 苗 → 若木 → 葉が茂る → 実 と育つ。直近 30 日に飲んだ国には白い花。
// 木の本数で 鉢（1〜2 本）→ 畑（3〜7 本）→ 丘の農園（8 本〜）と景色が広がる。純粋関数。画面は結果を描くだけ。
import { COUNTRY_SHELVES, countryKeyOf } from '@/lib/vocab';
import type { CollectionSourceLog } from './collection';

export type TreeStage = 1 | 2 | 3 | 4;
/** 段階の境目（杯数）。1 杯 = 苗、3 杯 = 若木、6 杯 = 葉が茂る、10 杯 = 実がなる */
export const TREE_STAGE_CUPS: readonly [number, number, number, number] = [1, 3, 6, 10];
export const TREE_STAGE_LABELS: Record<TreeStage, string> = {
  1: '苗',
  2: '若木',
  3: '葉が茂る',
  4: '実がなる',
};
/** 花が咲く期間（この日数のうちに飲んだ国） */
export const FLOWER_DAYS = 30;
/** 実の上限（杯数ぶん付けるが、これ以上は増やさない） */
export const MAX_CHERRIES = 12;

export interface FarmTree {
  key: string;
  /** 木の下の札（英名の大文字。語彙に無い国は入力のまま） */
  label: string;
  cups: number;
  stage: TreeStage;
  /** 直近 30 日に飲んだ */
  flowering: boolean;
  /** 実の数（段階 4 のみ。杯数ぶん、上限 MAX_CHERRIES） */
  cherries: number;
}

export type FarmScene = 'pot' | 'field' | 'hill';

export interface Farm {
  trees: FarmTree[];
  scene: FarmScene;
  /** 花の咲いている木の数 */
  flowering: number;
  totalCups: number;
}

export function treeStage(cups: number): TreeStage {
  if (cups >= TREE_STAGE_CUPS[3]) return 4;
  if (cups >= TREE_STAGE_CUPS[2]) return 3;
  if (cups >= TREE_STAGE_CUPS[1]) return 2;
  return 1;
}

/** 次の段階まであと何杯か。実がなっていれば null */
export function cupsToNextStage(cups: number): number | null {
  const next = TREE_STAGE_CUPS.find((c) => c > cups);
  return next === undefined ? null : next - cups;
}

export function farmScene(treeCount: number): FarmScene {
  if (treeCount >= 8) return 'hill';
  if (treeCount >= 3) return 'field';
  return 'pot';
}

const enByKey = new Map(COUNTRY_SHELVES.map((c) => [c.key, c.en]));

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 記録から農園を作る。木は杯数の多い順（同数なら先に飲んだ順）。生産国が空の記録は木にならない */
export function buildFarm(logs: readonly CollectionSourceLog[], now = new Date()): Farm {
  const since = isoDate(new Date(now.getTime() - FLOWER_DAYS * 24 * 60 * 60 * 1000));
  const acc = new Map<string, { cups: number; flowering: boolean; first: string; label: string }>();
  for (const l of logs) {
    const key = countryKeyOf(l.bean.country);
    if (key === null) continue;
    const hit = acc.get(key);
    const recent = l.logged_on >= since;
    if (!hit) {
      const label = enByKey.get(key) ?? (l.bean.country ?? key).trim();
      acc.set(key, { cups: 1, flowering: recent, first: l.logged_on, label: label.toUpperCase() });
      continue;
    }
    hit.cups += 1;
    hit.flowering ||= recent;
    if (l.logged_on < hit.first) hit.first = l.logged_on;
  }
  const trees: FarmTree[] = Array.from(acc, ([key, v]) => {
    const stage = treeStage(v.cups);
    return {
      key,
      label: v.label,
      cups: v.cups,
      stage,
      flowering: v.flowering,
      cherries: stage === 4 ? Math.min(MAX_CHERRIES, v.cups) : 0,
    };
  }).sort((a, b) => b.cups - a.cups || a.key.localeCompare(b.key));
  // 同数の並びは「先に飲んだ順」にしたいので、キー順で安定させたあと first で並べ直す
  const firstOf = new Map(Array.from(acc, ([k, v]) => [k, v.first]));
  trees.sort((a, b) => b.cups - a.cups || firstOf.get(a.key)!.localeCompare(firstOf.get(b.key)!));
  return {
    trees,
    scene: farmScene(trees.length),
    flowering: trees.filter((t) => t.flowering).length,
    totalCups: trees.reduce((s, t) => s + t.cups, 0),
  };
}
