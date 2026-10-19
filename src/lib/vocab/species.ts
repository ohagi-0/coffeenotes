// 種（アラビカ / ロブスタ / リベリカ）。品種からほぼ機械的に決まるので、入力させず表示のときに推定する（F-BEAN-18、Issue #45）。
// 棚や見出しにはしない（CLAUDE.md §1 / §5.3。種は豆の情報として持つが、ライト層向けの分類軸にしない）。
import { VARIETY_SHELVES, varietyKeysOf } from './varieties';

export type Species = 'arabica' | 'robusta' | 'liberica' | 'mixed';

export const SPECIES_LABELS: Record<Species, string> = {
  arabica: 'アラビカ',
  robusta: 'ロブスタ',
  liberica: 'リベリカ',
  mixed: 'アラビカ + ロブスタ',
};

function normalize(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-_・･()（）]+/g, '');
}

/** 品種欄に書かれる種の名前 → 種 */
const SPECIES_ALIASES: Record<Exclude<Species, 'mixed'>, readonly string[]> = {
  arabica: ['arabica', 'アラビカ', 'アラビカ種', 'coffea arabica'],
  robusta: ['robusta', 'ロブスタ', 'ロブスタ種', 'canephora', 'カネフォラ', 'coffea canephora', 'ロブ'],
  liberica: ['liberica', 'リベリカ', 'リベリカ種', 'coffea liberica', 'excelsa', 'エクセルサ'],
};
const speciesAliasIndex = new Map<string, Exclude<Species, 'mixed'>>();
for (const [s, aliases] of Object.entries(SPECIES_ALIASES) as [
  Exclude<Species, 'mixed'>,
  readonly string[],
][])
  for (const a of aliases) speciesAliasIndex.set(normalize(a), s);

/** 主要品種の棚（VARIETY_SHELVES）はすべてアラビカ。ロブスタの品種名が棚に入ったらここに例外を足す */
const ARABICA_SHELF_KEYS = new Set(VARIETY_SHELVES.map((v) => v.key));

/** 主要品種に無いが、ロブスタ・リベリカと分かる品種名（部分一致） */
const NON_ARABICA_VARIETY_HINTS: readonly [string, Exclude<Species, 'arabica' | 'mixed'>][] = [
  ['conilon', 'robusta'],
  ['コニロン', 'robusta'],
  ['nganda', 'robusta'],
  ['erecta', 'robusta'],
  ['excelsa', 'liberica'],
];

/**
 * 品種の文字列から種を推定する。
 * - 種の名前（Arabica / ロブスタ / Canephora …）が書かれていればそれを採る
 * - 主要品種（ゲイシャ、ブルボン …）はアラビカ
 * - 「SL28, ロブスタ」のように種が混ざれば mixed
 * - 品種が空、または何も判断できなければ null（出さない）
 */
export function speciesOf(variety: string | null | undefined): Species | null {
  if (!variety || variety.trim() === '') return null;
  const found = new Set<Exclude<Species, 'mixed'>>();
  const tokens = variety
    .split(/[,、，/／&＆+＋]|\s+(?:and|と)\s+|\s*・\s*/i)
    .map((t) => t.trim())
    .filter(Boolean);
  for (const t of tokens) {
    const n = normalize(t);
    const direct = speciesAliasIndex.get(n);
    if (direct) {
      found.add(direct);
      continue;
    }
    // 「Red Bourbon (Arabica)」のように種の名前が添えてあるときは、それを優先する
    const embedded = Array.from(speciesAliasIndex.entries()).find(
      ([alias]) => alias.length >= 3 && n.includes(alias),
    );
    if (embedded) {
      found.add(embedded[1]);
      continue;
    }
    const hint = NON_ARABICA_VARIETY_HINTS.find(([h]) => n.includes(normalize(h)));
    if (hint) {
      found.add(hint[1]);
      continue;
    }
    if (varietyKeysOf(t).some((k) => ARABICA_SHELF_KEYS.has(k))) found.add('arabica');
  }
  if (found.size === 0) return null;
  if (found.size === 1) return Array.from(found)[0]!;
  return 'mixed';
}

/** 表示名。null は null のまま */
export function speciesLabel(s: Species | null): string | null {
  return s ? SPECIES_LABELS[s] : null;
}

/** 「ロブスタ入り」= ロブスタだけ、またはアラビカとの混合 */
export function hasRobusta(variety: string | null | undefined): boolean {
  const s = speciesOf(variety);
  return s === 'robusta' || s === 'mixed';
}
